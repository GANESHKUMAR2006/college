const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../config/db');

// Import Milestone 2 files
const MockProvider = require('../services/connectors/MockProvider');
const studentSyncQueue = require('../services/studentSyncQueue');
const snapshotEngine = require('../services/snapshotEngine');
const SyncLockManager = require('../services/syncLockManager');
const EventBus = require('../services/EventBus');
const controller = require('../controllers/contestmasterController');

test('MockProvider - returns mock data structure', async () => {
  const provider = new MockProvider();
  
  const detected = await provider.detectContest();
  assert.equal(detected.length, 1);
  assert.equal(detected[0].contestSlug, 'mock-weekly-contest-1');
  assert.equal(detected[0].status, 'Live');

  const stats1 = await provider.getStudentContestStatus('user_present_1', 'mock-weekly-contest-1');
  assert.equal(stats1.participating, true);
  assert.equal(stats1.rank, 5);

  const stats2 = await provider.getStudentContestStatus('user_absent', 'mock-weekly-contest-1');
  assert.equal(stats2.participating, false);
});

test('studentSyncQueue & snapshotEngine - manages locks, concurrency, diff writes, and logs', async () => {
  await db.initializeDatabase();
  
  // 1. Setup a test live contest in database
  const slug = `test-contest-${Date.now()}`;
  await db.query(`
    INSERT INTO LiveContests (platform, contestSlug, contestName, contestType, startTime, endTime, status)
    VALUES ('LeetCode', ?, 'Test Mock Contest', 'Weekly', NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), 'Live')
  `, [slug]);
  
  const [contest] = await db.query("SELECT id FROM LiveContests WHERE contestSlug = ?", [slug]);
  const contestId = contest.id;

  // 2. Setup mock students in database
  // Clear other active students temporarily or query what is active
  const activeStudents = await db.query("SELECT id, name, leetcode_username FROM Users LIMIT 5");
  if (activeStudents.length === 0) {
    // Seed a couple of mock students if none exist
    await db.query(`
      INSERT INTO Users (name, roll_no, department, section, leetcode_username, academic_batch, academic_start_date, academic_end_date, status)
      VALUES 
        ('Student A', 'R001', 'DEC', 'A', 'user_present_1', '2024-2028', '2024-07-01', '2028-06-30', 'active'),
        ('Student B', 'R002', 'DEC', 'A', 'user_absent', '2024-2028', '2024-07-01', '2028-06-30', 'active')
    `);
  }
  
  const studentsToSync = await db.query("SELECT id, name, leetcode_username FROM Users WHERE status = 'active' LIMIT 5");

  // 3. Reset lock and snapshot engines
  SyncLockManager.release('Idle');
  snapshotEngine.clearCache(contestId);

  // 4. Test snapshot load
  await snapshotEngine.loadSnapshot(contestId);
  assert.deepEqual(snapshotEngine.previousSnapshots[contestId], {});

  // 5. Test queue process execution
  const provider = new MockProvider();
  let syncFunctionCalls = 0;

  const syncFunc = async (student, prov) => {
    syncFunctionCalls++;
    const stats = await prov.getStudentContestStatus(student.leetcode_username, slug);
    const status = stats.participating ? 'Participating' : 'Unknown';
    
    await snapshotEngine.compareAndUpdate(contestId, student.id, student.leetcode_username, {
      attendanceStatus: status,
      rank: stats.rank || null,
      solved: stats.solved || 0,
      score: stats.score || 0.00,
      penalty: stats.penalty || 0,
      ratingBefore: stats.ratingBefore || null
    });
  };

  // Start Sync Lock check
  assert.equal(SyncLockManager.isRunning(), false);

  // Trigger sync queue execution
  await studentSyncQueue.start(contestId, studentsToSync, provider, syncFunc);

  // Lock must be active immediately during execution
  assert.equal(SyncLockManager.isRunning(), true);

  // Wait for queue execution completion
  await new Promise(resolve => setTimeout(resolve, 500));

  // Lock should be released after finalization
  assert.equal(SyncLockManager.isRunning(), false);
  assert.equal(studentSyncQueue.activeContestId, null);

  // 6. Verify database records updated
  const attendance = await db.query("SELECT * FROM ContestAttendance WHERE contestId = ?", [contestId]);
  assert.equal(attendance.length > 0, true);

  // 7. Verify aggregates snapshot recorded
  const snapshots = await db.query("SELECT * FROM ContestSnapshots WHERE contestId = ?", [contestId]);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].contestId, contestId);

  // 8. Verify ContestSyncLog recorded
  const logs = await db.query("SELECT * FROM ContestSyncLog WHERE contestId = ?", [contestId]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].contestId, contestId);
});

test('Controller - getLiveCurrent returns current active contest', async () => {
  const req = {};
  const res = {
    json: (data) => {
      assert.equal(data.success, true);
      assert.ok(data.hasOwnProperty('contest'));
      return data;
    },
    status: (code) => {
      return res;
    }
  };

  await controller.getLiveCurrent(req, res);
});

test('Controller - getLiveHealth returns health metrics', async () => {
  const req = {};
  const res = {
    json: (data) => {
      assert.equal(data.success, true);
      assert.equal(data.health.platform, 'LeetCode');
      assert.equal(data.health.providerStatus, 'Healthy');
      return data;
    }
  };

  await controller.getLiveHealth(req, res);
});

after(async () => {
  const pool = db.getPool();
  if (pool) {
    await pool.end();
  }
});
