/**
 * ContestLeaderboardSyncService.js
 * ================================
 * Production-ready backend service to sync LeetCode contest attendance.
 * Fetches rankings from official LeetCode JSON API using NetworkService,
 * caches snapshots, and updates student attendance using SQL JOIN operations
 * inside a database transaction.
 */

const db = require('../config/db');
const leetcode = require('../utils/leetcode');
const { normalizeBatchToShort } = require('../utils/batchHelper');
const NetworkService = require('../utils/networkService');

// Sync lock registry (in-memory)
const activeSyncs = new Set();

class ContestLeaderboardSyncService {
  /**
   * Syncs LeetCode leaderboard data and updates ContestAttendance + AttendanceRecords.
   * 
   * @param {string} contestSlug - LeetCode contest slug
   * @param {object} options - Sync options
   * @param {string} options.batch - Academic batch (e.g., '2024-28')
   * @param {boolean} options.forceSync - Force full re-sync from page 1
   * @param {string} options.jobId - Associated background job ID
   * @param {Function} options.updateProgress - Progress updater callback: (pct, msg) => void
   * @returns {Promise<object>} Sync stats
   */
  static async syncContest(contestSlug, options = {}) {
    const batch = normalizeBatchToShort(options.batch);
    const forceSync = !!options.forceSync;
    const maxPages = options.maxPages || null;
    const jobId = options.jobId || null;
    const updateProgress = options.updateProgress || null;

    if (!batch) {
      throw new Error('Academic batch is required for attendance synchronization.');
    }

    // 1. Sync Locking Check
    if (activeSyncs.has(contestSlug)) {
      const error = new Error('Contest synchronization already in progress.');
      error.statusCode = 409;
      throw error;
    }

    // Check database sync status for locks (prevent concurrent runs across nodes)
    const existingLog = await db.query(
      "SELECT id, sync_status, last_page_synced FROM ContestSyncLog WHERE contest_slug = ? ORDER BY started_at DESC LIMIT 1",
      [contestSlug]
    );

    if (existingLog.length > 0 && existingLog[0].sync_status === 'RUNNING' && !forceSync) {
      const error = new Error('Contest synchronization already in progress (registered in database).');
      error.statusCode = 409;
      throw error;
    }

    // Acquire lock
    activeSyncs.add(contestSlug);
    console.log(`\nSync started for contest: ${contestSlug}, batch: ${batch}...`);
    if (updateProgress) {
      updateProgress(1, 'Initializing sync environment and validating slug...');
    }

    let syncLogId;
    let liveContestId;
    let contestId;
    let contestTitle;
    let contestDate;
    const syncStartTime = Date.now();

    try {
      // 2. Fetch page 1 to estimate start time & get total participants
      const firstPageData = await this.fetchPageRaw(contestSlug, 1);
      if (!firstPageData || !firstPageData.total_rank) {
        throw new Error('Could not retrieve leaderboard data from LeetCode. Validate the contest slug.');
      }

      // Ensure contest exists in both Contests and LiveContests
      const records = await this.ensureContestRecords(contestSlug, firstPageData);
      liveContestId = records.liveContestId;
      contestId = records.contestId;
      contestTitle = records.contestTitle;
      contestDate = records.contestDate;

      const totalParticipants = firstPageData.user_num || 0;
      const totalPages = Math.ceil(totalParticipants / 25);
      console.log(`Contest: ${contestTitle} | Total participants: ${totalParticipants} (~${totalPages} pages)`);
      if (updateProgress) {
        updateProgress(5, `Contest validated. Total participants: ${totalParticipants} (~${totalPages} pages).`);
      }

      // 3. Resolve Resume Support
      let startPage = 1;

      if (forceSync) {
        console.log(`[Sync] Force sync requested. Clearing cached participants for: ${contestSlug}...`);
        if (updateProgress) {
          updateProgress(8, 'Clearing previous cached participant data...');
        }
        await db.query("DELETE FROM ContestParticipants WHERE contest_slug = ?", [contestSlug]);
        await db.query("DELETE FROM ContestLeaderboardSnapshots WHERE contest_slug = ?", [contestSlug]);
        
        // Create new Sync Log
        const insertLog = await db.query(`
          INSERT INTO ContestSyncLog (contestId, contest_slug, sync_status, last_page_synced, syncStarted, started_at)
          VALUES (?, ?, 'RUNNING', 0, NOW(), NOW())
        `, [liveContestId, contestSlug]);
        syncLogId = liveInsertId(insertLog);
      } else {
        // Look for incomplete or existing log
        const unfinished = await db.query(
          "SELECT id, last_page_synced FROM ContestSyncLog WHERE contestId = ? AND sync_status = 'RUNNING' ORDER BY started_at DESC LIMIT 1",
          [liveContestId]
        );

        if (unfinished.length > 0) {
          syncLogId = unfinished[0].id;
          startPage = unfinished[0].last_page_synced + 1;
          console.log(`[Sync] Resuming sync from page ${startPage} using existing sync log ID: ${syncLogId}...`);
          if (updateProgress) {
            updateProgress(10, `Resuming from page ${startPage}...`);
          }
        } else {
          // Create new sync log starting from 1
          const insertLog = await db.query(`
            INSERT INTO ContestSyncLog (contestId, contest_slug, sync_status, last_page_synced, syncStarted, started_at)
            VALUES (?, ?, 'RUNNING', 0, NOW(), NOW())
          `, [liveContestId, contestSlug]);
          syncLogId = liveInsertId(insertLog);
        }
      }

      // 4. Controlled Concurrency Pagination Loop
      let page = startPage;
      let hasMore = true;
      const concurrencyLimit = 4; // Fetch 4 pages concurrently
      let totalParticipantsCollected = 0;
      
      // Load current collected count if resuming
      if (page > 1) {
        const countResult = await db.query(
          "SELECT count(*) as count FROM ContestParticipants WHERE contest_slug = ?",
          [contestSlug]
        );
        totalParticipantsCollected = countResult[0]?.count || 0;
      }

      console.log(`Downloading pages...\n`);

      while (hasMore) {
        // Check if job is cancelled
        if (jobId) {
          const jobQueue = require('./jobQueueService');
          const job = jobQueue.getJob(jobId);
          if (job && job.status === 'CANCELLED') {
            throw new Error('Contest synchronization was cancelled by the user.');
          }
        }

        // Set up the next chunk of pages to download
        const pagesToFetch = [];
        for (let i = 0; i < concurrencyLimit; i++) {
          const nextPage = page + i;
          pagesToFetch.push(nextPage);
        }

        // Fetch pages concurrently with retry mechanism
        const fetchPromises = pagesToFetch.map(p => 
          this.fetchPageWithRetry(contestSlug, p, syncLogId).catch(err => {
            return { error: err, page: p };
          })
        );

        const results = await Promise.all(fetchPromises);

        // Sort by page number to insert/cache sequentially
        const sortedResults = results.map((res, i) => ({
          page: pagesToFetch[i],
          data: res.error ? null : res,
          error: res.error || null
        }));

        for (const item of sortedResults) {
          if (item.error) {
            console.error(`[Sync] Fatal error on page ${item.page}: ${item.error.message}`);
            throw new Error(`Pagination interrupted on page ${item.page} - ${item.error.message}`);
          }

          const ranks = item.data?.total_rank || [];

          if (ranks.length === 0) {
            hasMore = false;
            break;
          }

          // Cache raw JSON in ContestLeaderboardSnapshots for future auditing
          await db.query(`
            INSERT INTO ContestLeaderboardSnapshots (contest_slug, page_number, raw_json)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE raw_json = VALUES(raw_json), downloaded_at = CURRENT_TIMESTAMP
          `, [contestSlug, item.page, JSON.stringify(item.data)]);

          // Store participants
          const participantsBatch = [];
          for (const ranker of ranks) {
            if (!ranker.username) continue; // Skip malformed entries
            
            participantsBatch.push([
              contestSlug,
              ranker.username,
              parseInt(ranker.rank, 10),
              parseFloat(ranker.score) || 0.00,
              parseInt(ranker.finish_time, 10) || 0,
              ranker.avatar_url || null,
              ranker.country_name || null,
              item.page
            ]);
          }

          if (participantsBatch.length > 0) {
            await db.getPool().query(`
              INSERT INTO ContestParticipants (contest_slug, username, \`rank\`, score, finish_time, avatar, country, page_number)
              VALUES ?
              ON DUPLICATE KEY UPDATE
                \`rank\` = VALUES(\`rank\`),
                score = VALUES(score),
                finish_time = VALUES(finish_time),
                avatar = VALUES(avatar),
                country = VALUES(country),
                page_number = VALUES(page_number),
                updated_at = CURRENT_TIMESTAMP
            `, [participantsBatch]);

            totalParticipantsCollected += participantsBatch.length;
          }

          // Update resume state in DB sync log
          await db.query(`
            UPDATE ContestSyncLog
            SET last_page_synced = ?, participants_synced = ?
            WHERE id = ?
          `, [item.page, totalParticipantsCollected, syncLogId]);

          // Progress calculation for display
          const elapsedSec = (Date.now() - syncStartTime) / 1000;
          const speed = totalParticipantsCollected / elapsedSec;
          const pagesRemaining = Math.max(0, totalPages - item.page);
          const etaSec = speed > 0 ? (pagesRemaining * 25) / speed : 0;
          const etaStr = this.formatDuration(etaSec);

          console.log(`Page ${item.page}`);
          console.log(`Participants: ${totalParticipantsCollected}`);
          console.log(`Speed: ${Math.round(speed)} users/sec`);
          console.log(`ETA: ${etaStr}`);
          console.log('-----------------------------');

          const pct = Math.min(95, Math.round((item.page / totalPages) * 100)) || 10;
          if (updateProgress) {
            updateProgress(
              pct,
              `Fetched page ${item.page}/${totalPages} (${totalParticipantsCollected} users collected). Speed: ${Math.round(speed)}/s. ETA: ${etaStr}`
            );
          }

          // If the page has fewer than 25 entries, it means it's the last page
          if (ranks.length < 25) {
            hasMore = false;
            break;
          }

          if (maxPages && item.page >= maxPages) {
            hasMore = false;
            console.log(`[Sync] Reached maximum page limit of ${maxPages}. Ending pagination.`);
            break;
          }
        }

        if (!hasMore) break;

        // Increment the page pointer by our concurrency batch size
        page += concurrencyLimit;

        // Rate Limiting: random delay of 200–500 ms between request batches
        const delay = Math.floor(Math.random() * (500 - 200 + 1)) + 200;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log(`\nParticipants downloaded.`);
      console.log(`Attendance comparison started...`);
      if (updateProgress) {
        updateProgress(96, 'Syncing participants with student database inside transaction...');
      }

      // 5. Attendance Synchronization inside Database Transaction
      const dbPool = db.getPool();
      const connection = await dbPool.getConnection();

      try {
        await connection.beginTransaction();

        // Join ContestParticipants to match active students in batch
        // Updates ContestAttendance
        await connection.query(`
          INSERT INTO ContestAttendance (contestId, studentId, username, attendanceStatus, \`rank\`, score, lastUpdatedAt)
          SELECT
            ? as contestId,
            u.id as studentId,
            u.leetcode_username as username,
            IF(cp.username IS NOT NULL, 'Present', 'Absent') as attendanceStatus,
            cp.rank as \`rank\`,
            IFNULL(cp.score, 0.00) as score,
            CURRENT_TIMESTAMP as lastUpdatedAt
          FROM Users u
          LEFT JOIN ContestParticipants cp ON LOWER(u.leetcode_username) = LOWER(cp.username) AND cp.contest_slug = ?
          WHERE u.academic_batch = ? AND u.status = 'active'
          ON DUPLICATE KEY UPDATE
            attendanceStatus = VALUES(attendanceStatus),
            \`rank\` = VALUES(\`rank\`),
            score = VALUES(score),
            lastUpdatedAt = VALUES(lastUpdatedAt)
        `, [liveContestId, contestSlug, batch]);

        // Updates AttendanceRecords (legacy dashboard table)
        await connection.query(`
          INSERT INTO AttendanceRecords (
            user_id, contest_id, contest_name, contest_slug, contest_date, contest_status,
            attendance_status, attendance_source, remarks, \`rank\`, score
          )
          SELECT
            u.id as user_id,
            ? as contest_id,
            ? as contest_name,
            ? as contest_slug,
            ? as contest_date,
            'RATED' as contest_status,
            IF(cp.username IS NOT NULL, 'PRESENT', 'ABSENT') as attendance_status,
            'AUTO' as attendance_source,
            IF(cp.username IS NOT NULL, 'Synced via LeetCode Leaderboard API', 'Absent from LeetCode contest') as remarks,
            cp.rank as \`rank\`,
            cp.score as score
          FROM Users u
          LEFT JOIN ContestParticipants cp ON LOWER(u.leetcode_username) = LOWER(cp.username) AND cp.contest_slug = ?
          WHERE u.academic_batch = ? AND u.status = 'active'
          ON DUPLICATE KEY UPDATE
            attendance_status = VALUES(attendance_status),
            remarks = VALUES(remarks),
            \`rank\` = VALUES(\`rank\`),
            score = VALUES(score),
            last_updated = CURRENT_TIMESTAMP
        `, [contestId, contestTitle, contestSlug, contestDate, contestSlug, batch]);

        // Mark sync log as completed
        const durationSec = Math.floor((Date.now() - syncStartTime) / 1000);
        await connection.query(`
          UPDATE ContestSyncLog
          SET sync_status = 'COMPLETED', syncCompleted = NOW(), completed_at = NOW(), duration = ?
          WHERE id = ?
        `, [durationSec, syncLogId]);

        await connection.commit();
        console.log(`Attendance updated.`);
        console.log(`Sync completed successfully.\n`);
      } catch (transactionError) {
        console.error('[Sync] Transaction error, rolling back...', transactionError);
        await connection.rollback();
        throw transactionError;
      } finally {
        connection.release();
      }

      // Fetch final stats
      const [statsResult] = await db.query(`
        SELECT 
          SUM(CASE WHEN attendanceStatus = 'Present' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN attendanceStatus = 'Absent' THEN 1 ELSE 0 END) as absent,
          COUNT(*) as totalStudents
        FROM ContestAttendance
        WHERE contestId = ? AND studentId IN (
          SELECT id FROM Users WHERE academic_batch = ? AND status = 'active'
        )
      `, [liveContestId, batch]);

      const durationMs = Date.now() - syncStartTime;
      const durationStr = this.formatDuration(durationMs / 1000);

      // Fetch request metrics
      const [logMetrics] = await db.query(
        "SELECT failed_requests FROM ContestSyncLog WHERE id = ?",
        [syncLogId]
      );

      const stats = {
        success: true,
        contest: contestSlug,
        pagesFetched: parseInt(page - startPage + 1, 10),
        participants: parseInt(totalParticipantsCollected, 10),
        students: parseInt(statsResult?.totalStudents, 10) || 0,
        present: parseInt(statsResult?.present, 10) || 0,
        absent: parseInt(statsResult?.absent, 10) || 0,
        failedRequests: parseInt(logMetrics?.failed_requests, 10) || 0,
        duration: durationStr
      };

      if (updateProgress) {
        updateProgress(100, `Completed successfully. Present: ${stats.present}, Absent: ${stats.absent}.`);
      }

      return stats;

    } catch (err) {
      console.error(`[Sync] Synchronization failed for contest ${contestSlug}:`, err.message);
      
      const isCancelled = err.message.includes('cancelled');
      const targetStatus = isCancelled ? 'CANCELLED' : 'FAILED';

      // Update Sync Log status to FAILED or CANCELLED
      if (syncLogId) {
        await db.query(`
          UPDATE ContestSyncLog
          SET sync_status = ?, errors = ?
          WHERE id = ?
        `, [targetStatus, err.message, syncLogId]).catch(logErr => {
          console.error('[Sync] Failed to write error status to ContestSyncLog:', logErr.message);
        });
      }

      if (updateProgress) {
        updateProgress(100, `Failed: ${err.message}`);
      }

      throw err;
    } finally {
      // Release lock
      activeSyncs.delete(contestSlug);
    }
  }

  /**
   * Fetches a contest ranking page raw JSON response.
   */
  static async fetchPageRaw(contestSlug, page) {
    const baseUrl = process.env.LEETCODE_CONTEST_API || 'https://leetcode.com/contest/api/ranking';
    const url = `${baseUrl}/${contestSlug}/?pagination=${page}&region=global_v2`;

    return await NetworkService.request(url, {
      useCurlTransport: true,
      timeout: 15000
    });
  }

  /**
   * Fetches a contest ranking page with retries and exponential backoff.
   */
  static async fetchPageWithRetry(contestSlug, page, syncLogId, retries = 3) {
    const baseUrl = process.env.LEETCODE_CONTEST_API || 'https://leetcode.com/contest/api/ranking';
    const url = `${baseUrl}/${contestSlug}/?pagination=${page}&region=global_v2`;

    return await NetworkService.request(url, {
      useCurlTransport: true,
      timeout: 15000,
      retries,
      backoffFactor: 1500,
      onRequestAttempt: async (attempt) => {
        // Track request in sync log
        await db.query(
          "UPDATE ContestSyncLog SET total_requests = total_requests + 1 WHERE id = ?",
          [syncLogId]
        );

        if (attempt > 1) {
          // Track failure/retry in sync log
          await db.query(`
            UPDATE ContestSyncLog 
            SET failed_requests = failed_requests + 1, 
                retry_count = retry_count + 1
            WHERE id = ?
          `, [syncLogId]);
        }
      }
    });
  }

  /**
   * Ensures contest exists in both Contests and LiveContests.
   */
  static async ensureContestRecords(contestSlug, firstPageData) {
    // 1. Ensure in Contests table
    let contest = await db.query("SELECT contest_id, title, start_time, contest_status FROM Contests WHERE slug = ?", [contestSlug]);
    let contestId;
    let title;
    let startTime;
    let contestStatus = 'Rated';

    // Fetch details from recent contests if available
    let details;
    try {
      const recentContests = await leetcode.getRecentContests();
      details = recentContests.find(c => c.titleSlug === contestSlug);
    } catch (err) {
      console.warn(`[Sync] Could not fetch recent contests list from GraphQL: ${err.message}`);
    }

    if (contest.length === 0) {
      title = contestSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      startTime = new Date();
      let duration = 5400; // 1.5 hours
      let contestType = contestSlug.includes('biweekly') ? 'Biweekly' : 'Weekly';
      const match = contestSlug.match(/contest-(\d+)/);
      const contestNumber = match ? parseInt(match[1], 10) : 0;

      if (details) {
        title = details.title;
        startTime = new Date(details.startTime * 1000);
        duration = details.duration;
      } else if (firstPageData && firstPageData.total_rank && firstPageData.total_rank.length > 0) {
        const firstRanker = firstPageData.total_rank[0];
        if (firstRanker.finish_time) {
          startTime = new Date((firstRanker.finish_time - duration) * 1000);
        }
      }

      const insertResult = await db.query(`
        INSERT INTO Contests (title, slug, contest_type, contest_number, start_time, duration, contest_status, platform, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'LeetCode', 'SYNC')
      `, [title, contestSlug, contestType, contestNumber, startTime, duration, contestStatus]);

      contestId = insertResult.insertId;
    } else {
      contestId = contest[0].contest_id;
      title = contest[0].title;
      startTime = contest[0].start_time;
      contestStatus = contest[0].contest_status;
    }

    // 2. Ensure in LiveContests table
    let liveContest = await db.query("SELECT id FROM LiveContests WHERE contestSlug = ?", [contestSlug]);
    let liveContestId;

    if (liveContest.length === 0) {
      let duration = 5400;
      let contestType = contestSlug.includes('biweekly') ? 'Biweekly' : 'Weekly';
      if (details) {
        duration = details.duration;
      }
      const endTime = new Date(new Date(startTime).getTime() + duration * 1000);

      const liveInsert = await db.query(`
        INSERT INTO LiveContests (platform, contestSlug, contestName, contestType, startTime, endTime, status, syncProgress)
        VALUES ('LeetCode', ?, ?, ?, ?, ?, 'Completed', 100.00)
      `, [contestSlug, title, contestType, startTime, endTime]);

      liveContestId = liveInsert.insertId;
    } else {
      liveContestId = liveContest[0].id;
    }

    return {
      liveContestId,
      contestId,
      contestTitle: title,
      contestDate: startTime,
      contest_status: contestStatus
    };
  }

  /**
   * Helper to format seconds into readable duration e.g., "3m 12s"
   */
  static formatDuration(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
  }
}

/**
 * Utility helper to extract insertId from mysql2 query result.
 */
function liveInsertId(insertResult) {
  return insertResult.insertId || insertResult[0]?.insertId;
}

module.exports = ContestLeaderboardSyncService;
