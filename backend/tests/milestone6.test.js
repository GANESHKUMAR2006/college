const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../config/db');

// Import system files
const SyncLockManager = require('../services/syncLockManager');
const studentSyncQueue = require('../services/studentSyncQueue');
const CapabilityResolver = require('../services/connectors/CapabilityResolver');
const FeatureFlags = require('../config/featureFlags');
const startupRecovery = require('../services/startupRecovery');
const EventBus = require('../services/EventBus');

test('Hardening - SyncLockManager prevents concurrent executions', () => {
  SyncLockManager.release('Idle');
  
  assert.equal(SyncLockManager.isRunning(), false);

  const lock1 = SyncLockManager.acquire(101);
  assert.equal(lock1, true);
  assert.equal(SyncLockManager.isRunning(), true);
  assert.equal(SyncLockManager.getStatus().activeContestId, 101);

  // Attempt duplicate lock acquisition
  const lock2 = SyncLockManager.acquire(102);
  assert.equal(lock2, false); // must fail
  assert.equal(SyncLockManager.getStatus().activeContestId, 101);

  // Release lock
  SyncLockManager.release('Completed');
  assert.equal(SyncLockManager.isRunning(), false);
  assert.equal(SyncLockManager.getStatus().state, 'Completed');
});

test('Hardening - studentSyncQueue timeout and retry handling', async () => {
  await db.initializeDatabase();

  // Seed a test contest
  const slug = `retry-contest-${Date.now()}`;
  await db.query(`
    INSERT INTO LiveContests (platform, contestSlug, contestName, contestType, startTime, endTime, status)
    VALUES ('LeetCode', ?, 'Retry Test Contest', 'Weekly', NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), 'Live')
  `, [slug]);
  const [contest] = await db.query("SELECT id FROM LiveContests WHERE contestSlug = ?", [slug]);
  const contestId = contest.id;

  // Mock list of students: one passes, one always fails
  const testStudents = [
    { id: 99901, name: 'Pass Student', leetcode_username: 'user_pass' },
    { id: 99902, name: 'Fail Student', leetcode_username: 'user_fail' }
  ];

  SyncLockManager.release('Idle');

  // Set timeout low to execute quickly
  studentSyncQueue.timeoutMs = 100;
  studentSyncQueue.maxRetries = 2; // 2 retries (3 total attempts)

  const mockProvider = {};
  
  // Custom sync function that forces error for 'user_fail'
  const syncFunc = async (student, provider) => {
    if (student.leetcode_username === 'user_fail') {
      throw new Error('Network Timeout Error');
    }
    // Success path
    return true;
  };

  // Wait for the sync to finalize
  const syncCompletePromise = new Promise((resolve) => {
    EventBus.once('ContestCompleted', (payload) => {
      if (payload.contestId === contestId) {
        resolve(payload);
      }
    });
  });

  await studentSyncQueue.start(contestId, testStudents, mockProvider, syncFunc);

  const payload = await syncCompletePromise;

  assert.equal(payload.processed, 1); // Pass Student completed
  assert.equal(payload.failedCount, 1); // Fail Student failed after retries
});

test('Hardening - CapabilityResolver fallback and failover reporting', async () => {
  const resolver = new CapabilityResolver('PlatformTest', {
    liveParticipation: ['graphql', 'cache']
  });

  // Mock strategies
  const mockGraphql = {
    fetchStudentStatus: async () => {
      throw new Error('Graphql endpoint offline');
    }
  };
  const mockCache = {
    fetchStudentStatus: async () => {
      return { source: 'cache_data' };
    }
  };

  const sourcesMap = {
    graphql: mockGraphql,
    cache: mockCache
  };

  // Reset feature flags
  FeatureFlags.graphql = true;
  FeatureFlags.cache = true;

  // Reset decisions
  delete resolver.decisionsCache.liveParticipation;

  let eventFired = false;
  let eventDetails = null;

  EventBus.once('DatasourceChanged', (details) => {
    if (details.provider === 'PlatformTest' && details.capability === 'liveParticipation') {
      eventFired = true;
      eventDetails = details;
    }
  });

  // Resolve must fallback from graphql to cache
  const result = await resolver.resolve('liveParticipation', sourcesMap, 'fetchStudentStatus');
  assert.deepEqual(result, { source: 'cache_data' });
  assert.equal(resolver.decisionsCache.liveParticipation, 'cache');
  assert.equal(eventFired, true);
  assert.equal(eventDetails.current, 'cache');
});

test('Hardening - StartupRecovery finalizes stale contests', async () => {
  const slug = `stale-contest-${Date.now()}`;
  
  // Seed a contest that ended 5 hours ago but has status Stuck in Live
  await db.query(`
    INSERT INTO LiveContests (platform, contestSlug, contestName, contestType, startTime, endTime, status)
    VALUES ('LeetCode', ?, 'Stale Stuck Contest', 'Weekly', DATE_SUB(NOW(), INTERVAL 7 HOUR), DATE_SUB(NOW(), INTERVAL 5 HOUR), 'Live')
  `, [slug]);

  const [contest] = await db.query("SELECT id FROM LiveContests WHERE contestSlug = ?", [slug]);
  const contestId = contest.id;

  // Run startup checks
  await startupRecovery.run();

  // Verify it recovered status to Completed
  const [recovered] = await db.query("SELECT status FROM LiveContests WHERE id = ?", [contestId]);
  assert.equal(recovered.status, 'Completed');
});

after(async () => {
  const pool = db.getPool();
  if (pool) {
    await pool.end();
  }
});
