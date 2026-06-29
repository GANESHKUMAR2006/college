const db = require('../config/db');
const SyncLockManager = require('./syncLockManager');
const snapshotEngine = require('./snapshotEngine');

/**
 * Recovery engine (Singleton) invoked on server startup to handle interrupted synchronizations.
 */
class StartupRecovery {
  async run() {
    console.log('[StartupRecovery] Running startup checks for interrupted contest syncs...');
    try {
      const activeContests = await db.query(
        "SELECT * FROM LiveContests WHERE status IN ('Live', 'Synchronizing')"
      );

      if (activeContests.length === 0) {
        console.log('[StartupRecovery] No interrupted live contests found on boot.');
        return;
      }

      const now = new Date();

      for (const contest of activeContests) {
        const endTime = new Date(contest.endTime);

        if (now > endTime) {
          console.log(`[StartupRecovery] Finalizing contest "${contest.contestName}" (ID: ${contest.id}) which ended while server was down.`);

          // Release locks
          SyncLockManager.release('Idle');

          // Transition status to Completed
          await db.query("UPDATE LiveContests SET status = 'Completed', lastSyncAt = NOW() WHERE id = ?", [contest.id]);

          // Load active students and database snapshot
          const students = await db.query("SELECT id, leetcode_username FROM Users WHERE status = 'active'");
          await snapshotEngine.loadSnapshot(contest.id);

          for (const s of students) {
            const prev = snapshotEngine.previousSnapshots[contest.id] || {};
            const old = prev[s.id];

            let finalStatus = 'Absent';
            let solved = 0;
            let score = 0;
            let rank = null;
            let penalty = 0;
            let ratingBefore = null;

            // If detected as participating during the contest, mark as Present
            if (old && (old.attendanceStatus === 'Participating' || old.attendanceStatus === 'Present')) {
              finalStatus = 'Present';
              solved = old.solved;
              score = old.score;
              rank = old.rank;
              penalty = old.penalty;
              ratingBefore = old.ratingBefore;
            }

            await snapshotEngine.compareAndUpdate(contest.id, s.id, s.leetcode_username, {
              attendanceStatus: finalStatus,
              rank,
              solved,
              score,
              penalty,
              ratingBefore
            });
          }

          // Generate final snapshot aggregates
          await snapshotEngine.recordContestSnapshot(contest.id);
          console.log(`[StartupRecovery] Finalized and recorded stats for recovered contest ID: ${contest.id}`);
        } else {
          console.log(`[StartupRecovery] Contest "${contest.contestName}" (ID: ${contest.id}) is still live. Resetting sync locks so scheduler loops can execute.`);
          SyncLockManager.release('Idle');
        }
      }
    } catch (err) {
      console.error('[StartupRecovery] Error during startup recovery execution:', err.message);
    }
  }
}

module.exports = new StartupRecovery();
