const db = require('../config/db');
const studentSyncQueue = require('./studentSyncQueue');
const snapshotEngine = require('./snapshotEngine');
const LeetCodeProvider = require('./connectors/LeetCodeProvider');
const MockProvider = require('./connectors/MockProvider');
const FeatureFlags = require('../config/featureFlags');

/**
 * Background loop manager (Singleton) that orchestrates live contest checks and schedules sync runs.
 */
class LiveContestScheduler {
  constructor() {
    this.intervalId = null;
    this.detectIntervalId = null;
    this.syncIntervalMs = 60 * 1000; // Check contest state every minute
    this.detectIntervalMs = 60 * 60 * 1000; // Query provider for new contests hourly
    this.leetcodeProvider = new LeetCodeProvider();
    this.mockProvider = new MockProvider();
  }

  /**
   * Starts background loops for live checks and contest discovery.
   */
  start() {
    if (this.intervalId) return;

    console.log('[LiveContestScheduler] Initializing background contest schedulers...');
    
    // Check for live updates
    this._checkLiveContests();
    this.intervalId = setInterval(() => this._checkLiveContests(), this.syncIntervalMs);

    // Hourly detection scans
    this._runContestDetection();
    this.detectIntervalId = setInterval(() => this._runContestDetection(), this.detectIntervalMs);
  }

  /**
   * Stops background schedulers.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.detectIntervalId) {
      clearInterval(this.detectIntervalId);
      this.detectIntervalId = null;
    }
    console.log('[LiveContestScheduler] Background scheduler loops stopped.');
  }

  /**
   * Core poll method evaluating live, synchronizing, and upcoming contest windows.
   */
  async _checkLiveContests() {
    try {
      const now = new Date();

      // 1. Process active/live contests
      const liveContests = await db.query(
        "SELECT * FROM LiveContests WHERE status IN ('Live', 'Synchronizing')"
      );

      for (const contest of liveContests) {
        const endTime = new Date(contest.endTime);

        if (now > endTime) {
          console.log(`[LiveContestScheduler] Contest "${contest.contestName}" has passed its scheduled end time. Finalizing...`);
          await this._finalizeContest(contest.id);
        } else {
          const lastSync = contest.lastSyncAt ? new Date(contest.lastSyncAt) : null;
          const timeSinceLastSync = lastSync ? (now - lastSync) : Infinity;

          // Run sync if 5 minutes have elapsed since the last execution
          if (timeSinceLastSync >= 5 * 60 * 1000) {
            console.log(`[LiveContestScheduler] 5 minutes elapsed since last sync. Initiating sync run for: "${contest.contestName}"`);
            await this._triggerSync(contest.id);
          }
        }
      }

      // 2. Promote upcoming contests to live when their startTime arrives
      const upcomingContests = await db.query(
        "SELECT * FROM LiveContests WHERE status = 'Upcoming' AND startTime <= NOW()"
      );

      for (const contest of upcomingContests) {
        console.log(`[LiveContestScheduler] Upcoming contest "${contest.contestName}" is starting. Transitioning state to Live.`);
        await db.query("UPDATE LiveContests SET status = 'Live' WHERE id = ?", [contest.id]);
        await this._triggerSync(contest.id);
      }
    } catch (err) {
      console.error('[LiveContestScheduler] State check loop exception:', err.message);
    }
  }

  /**
   * Invokes the concurrent sync queue for a live contest.
   */
  async _triggerSync(contestId) {
    if (studentSyncQueue.activeContestId) {
      console.log('[LiveContestScheduler] Synchronization queue is currently busy. Skipping this cycle.');
      return;
    }

    try {
      await db.query("UPDATE LiveContests SET status = 'Synchronizing', lastSyncAt = NOW() WHERE id = ?", [contestId]);

      const provider = FeatureFlags.isEnabled('scraper') || FeatureFlags.isEnabled('graphql')
        ? this.leetcodeProvider
        : this.mockProvider;

      const students = await db.query("SELECT id, name, leetcode_username FROM Users WHERE status = 'active'");
      
      const syncFunc = async (student, prov) => {
        const stats = await prov.getStudentContestStatus(student.leetcode_username, 'mock-weekly');
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

      await snapshotEngine.loadSnapshot(contestId);
      
      studentSyncQueue.start(contestId, students, provider, syncFunc)
        .then(async () => {
          await db.query("UPDATE LiveContests SET status = 'Live', lastSyncAt = NOW() WHERE id = ?", [contestId]);
        })
        .catch(async (queueErr) => {
          console.error('[LiveContestScheduler] Sync queue processing failed:', queueErr.message);
          await db.query("UPDATE LiveContests SET status = 'Live' WHERE id = ?", [contestId]);
        });
    } catch (err) {
      console.error(`[LiveContestScheduler] Failed to initialize sync for ID ${contestId}:`, err.message);
      await db.query("UPDATE LiveContests SET status = 'Live' WHERE id = ?", [contestId]);
    }
  }

  /**
   * Finalizes the contest attendance record mappings.
   */
  async _finalizeContest(contestId) {
    try {
      await db.query("UPDATE LiveContests SET status = 'Completed', lastSyncAt = NOW() WHERE id = ?", [contestId]);
      
      const students = await db.query("SELECT id, leetcode_username FROM Users WHERE status = 'active'");
      await snapshotEngine.loadSnapshot(contestId);

      for (const s of students) {
        const prev = snapshotEngine.previousSnapshots[contestId] || {};
        const old = prev[s.id];

        let finalStatus = 'Absent';
        let solved = 0;
        let score = 0;
        let rank = null;
        let penalty = 0;
        let ratingBefore = null;

        if (old && (old.attendanceStatus === 'Participating' || old.attendanceStatus === 'Present')) {
          finalStatus = 'Present';
          solved = old.solved;
          score = old.score;
          rank = old.rank;
          penalty = old.penalty;
          ratingBefore = old.ratingBefore;
        }

        await snapshotEngine.compareAndUpdate(contestId, s.id, s.leetcode_username, {
          attendanceStatus: finalStatus,
          rank, solved, score, penalty, ratingBefore
        });
      }

      await snapshotEngine.recordContestSnapshot(contestId);
      console.log(`[LiveContestScheduler] Finalized contest ID: ${contestId}`);
    } catch (err) {
      console.error(`[LiveContestScheduler] Finalization routine failed for ID ${contestId}:`, err.message);
    }
  }

  /**
   * Seeding process querying the provider for upcoming and live contests.
   */
  async _runContestDetection() {
    console.log('[LiveContestScheduler] Executing contest discovery scan...');
    try {
      const provider = FeatureFlags.isEnabled('graphql') ? this.leetcodeProvider : this.mockProvider;
      const list = await provider.detectContest();

      for (const c of list) {
        await db.query(`
          INSERT INTO LiveContests (platform, contestSlug, contestName, contestType, startTime, endTime, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            contestName = VALUES(contestName),
            startTime = VALUES(startTime),
            endTime = VALUES(endTime)
        `, [
          c.platform,
          c.contestSlug,
          c.contestName,
          c.contestType,
          c.startTime,
          c.endTime,
          c.status
        ]);
      }
      console.log(`[LiveContestScheduler] Discovery scan finished. Synced ${list.length} contests.`);
    } catch (err) {
      console.error('[LiveContestScheduler] Discovery scan exception:', err.message);
    }
  }
}

module.exports = new LiveContestScheduler();
