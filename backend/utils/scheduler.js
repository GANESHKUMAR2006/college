const cron = require('node-cron');
const db = require('../config/db');
const leetcode = require('./leetcode');
const entranthub = require('./entranthub');

// Sleep helper to prevent LeetCode rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(dateInput.getMonth() + 1).padStart(2, '0');
  const day = String(dateInput.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Perform synchronization of contest data for all active students.
 * Uses EntrantHub as the primary source of contest metadata.
 */
async function syncAllData() {
  const startedAt = new Date();
  console.log(`[Sync] Starting EnthraHub contest synchronization at ${startedAt.toISOString()}...`);

  let logId = null;
  try {
    const logResult = await db.query(
      "INSERT INTO sync_logs (status, message, contests_synced, students_processed, started_at) VALUES (?, ?, ?, ?, ?)",
      ['running', 'Sync started', 0, 0, startedAt]
    );
    logId = logResult.insertId;
  } catch (err) {
    console.error('[Sync] Failed to create sync log in DB:', err.message);
  }

  try {
    // 1. Fetch all active students
    const users = await db.query(
      "SELECT id, name, roll_no, department, section, leetcode_username, academic_start_date, academic_end_date FROM Users WHERE status = 'active'"
    );

    if (users.length === 0) {
      console.log('[Sync] No active students found in database.');
      if (logId) {
        await db.query(
          "UPDATE sync_logs SET status = ?, message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
          ['success', 'No active students to process', logId]
        );
      }
      return { success: true, message: 'No active students to process', contestsSynced: 0, studentsProcessed: 0 };
    }

    console.log(`[Sync] Found ${users.length} active student(s) to process.`);

    // 2. Fetch master contest list from EntrantHub
    console.log('[Sync] Fetching master contests list from EntrantHub...');
    const entranthubContests = await entranthub.fetchEntrantHubContests();
    console.log(`[Sync] Retrieved ${entranthubContests.length} contests from EntrantHub.`);

    const now = new Date();

    // Sync Contests metadata from EntrantHub
    let newlyAdded = 0;
    let updatedContests = 0;

    for (const contest of entranthubContests) {
      const slug = contest.contest_slug;
      const title = contest.contest_name;
      const startTimeDate = new Date(contest.contest_date);
      const duration = 5400; // standard duration
      const contestStatus = contest.contest_status === 'UNRATED' ? 'Unrated' : 'Rated';
      const contestType = slug.includes('biweekly') ? 'Biweekly' : 'Weekly';
      const match = slug.match(/contest-(\d+)/);
      const contestNumber = match ? parseInt(match[1], 10) : 0;

      const existing = await db.query("SELECT contest_id, title, start_time FROM Contests WHERE slug = ?", [slug]);

      if (existing.length === 0) {
        await db.query(`
          INSERT INTO Contests (title, slug, contest_type, contest_number, start_time, duration, contest_status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [title, slug, contestType, contestNumber, startTimeDate, duration, contestStatus]);
        newlyAdded++;
      } else {
        await db.query(`
          UPDATE Contests 
          SET title = ?, start_time = ?, duration = ?, contest_status = ?
          WHERE slug = ?
        `, [title, startTimeDate, duration, contestStatus, slug]);
        updatedContests++;
      }
    }

    console.log(`[Sync] Newly Added Contests: ${newlyAdded}, Updated Contests: ${updatedContests}`);

    // 3. Fetch LeetCode profile analytics and update LeetCodeProfiles
    let studentsProcessed = 0;
    for (const user of users) {
      try {
        console.log(`[Sync] Fetching LeetCode analytics profile for user: ${user.leetcode_username}`);
        const leetcodeData = await leetcode.getUserContestRankingAndHistory(user.leetcode_username);
        
        if (leetcodeData) {
          const history = leetcodeData.userContestRankingHistory || [];
          const ratings = history.map(h => h.rating).filter(r => r !== null && r !== undefined);
          const highestRating = ratings.length > 0 ? Math.max(...ratings) : 1500.00;
          const currentRating = leetcodeData.userContestRanking ? parseFloat(leetcodeData.userContestRanking.rating || 1500.00) : 1500.00;
          const globalRanking = leetcodeData.userContestRanking ? leetcodeData.userContestRanking.globalRanking : null;
          
          // Problems solved (we can query dynamic question stats if available, otherwise default to 0)
          const problemsSolved = 0; 
          const historyJson = JSON.stringify(history);

          await db.query(`
            INSERT INTO LeetCodeProfiles (user_id, current_rating, highest_rating, global_ranking, problems_solved, contest_history)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              current_rating = VALUES(current_rating),
              highest_rating = VALUES(highest_rating),
              global_ranking = VALUES(global_ranking),
              problems_solved = VALUES(problems_solved),
              contest_history = VALUES(contest_history)
          `, [user.id, currentRating, highestRating, globalRanking, problemsSolved, historyJson]);
        }
        studentsProcessed++;
        await sleep(600); // Prevent rate limits
      } catch (err) {
        console.error(`[Sync] Failed to update LeetCodeProfile for user ${user.name}:`, err.message);
      }
    }

    // 4. Finalize attendance for ended contests based on ParticipationLogs
    console.log('[Sync] Finalizing attendance records for ended contests...');
    const endedContests = await db.query(
      "SELECT contest_id, title, start_time FROM Contests WHERE start_time < NOW() AND contest_status != 'Cancelled'"
    );

    let finalizedCount = 0;
    for (const contest of endedContests) {
      const contestStartTime = new Date(contest.start_time);
      
      // Get all active users eligible for this contest date
      const eligibleUsers = users.filter(u => {
        const start = new Date(u.academic_start_date);
        const end = new Date(u.academic_end_date);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return contestStartTime >= start && contestStartTime <= end;
      });

      for (const user of eligibleUsers) {
        const logCheck = await db.query(
          "SELECT id FROM ParticipationLogs WHERE user_id = ? AND contest_id = ?",
          [user.id, contest.contest_id]
        );
        const attended = logCheck.length > 0;
        const status = attended ? 'PRESENT' : 'ABSENT';

        await db.query(`
          INSERT INTO AttendanceRecords (user_id, contest_id, attendance_status, attendance_source)
          VALUES (?, ?, ?, 'AUTO')
          ON DUPLICATE KEY UPDATE attendance_status = VALUES(attendance_status)
        `, [user.id, contest.contest_id, status]);
      }
      finalizedCount++;
    }

    console.log(`[Sync] Finalized attendance for ${finalizedCount} completed contests.`);

    if (logId) {
      await db.query(
        "UPDATE sync_logs SET status = ?, message = ?, contests_synced = ?, students_processed = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        ['success', 'Synchronization completed successfully', endedContests.length, studentsProcessed, logId]
      );
    }

    // Trigger notification
    await db.query(
      `INSERT INTO notifications (title, message, type)
       VALUES (?, ?, 'new_contest')`,
      [
        `Synchronization Completed`,
        `Successfully updated LeetCode analytics and finalized EnthraHub attendance for active students.`
      ]
    );

    return {
      success: true,
      contestsSynced: endedContests.length,
      studentsProcessed,
      message: 'Synchronization completed successfully'
    };

  } catch (error) {
    console.error('[Sync] Fatal error during synchronization:', error.message);
    if (logId) {
      await db.query(
        "UPDATE sync_logs SET status = ?, message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        ['failed', `Error: ${error.message}`, logId]
      );
    }
    throw error;
  }
}

/**
 * Seed all Weekly and Biweekly contests from LeetCode GraphQL API into the local DB.
 */
async function seedMasterContests() {
  console.log('[DB Seed] Starting LeetCode Master Contests seeding...');
  try {
    const leetcodeContests = await leetcode.getRecentContests();
    console.log(`[DB Seed] Retrieved ${leetcodeContests.length} contests from LeetCode GraphQL API.`);

    let insertCount = 0;
    for (const contest of leetcodeContests) {
      const slug = contest.titleSlug;
      const title = contest.title;
      const startTimeDate = new Date(contest.startTime * 1000);
      const duration = contest.duration || 5400;
      const contestStatus = (slug.includes('biweekly-contest-126') || slug.includes('biweekly-contest-127')) ? 'Unrated' : 'Rated';
      const contestType = slug.includes('biweekly') ? 'Biweekly' : 'Weekly';
      const match = slug.match(/contest-(\d+)/);
      const contestNumber = match ? parseInt(match[1], 10) : 0;

      await db.query(`
        INSERT INTO Contests (title, slug, contest_type, contest_number, start_time, duration, contest_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title = VALUES(title), start_time = VALUES(start_time), duration = VALUES(duration), contest_status = VALUES(contest_status)
      `, [title, slug, contestType, contestNumber, startTimeDate, duration, contestStatus]);
      insertCount++;
    }
    console.log(`[DB Seed] Seeding complete. Processed ${insertCount} contests.`);
    return { success: true, count: insertCount };
  } catch (err) {
    console.error('[DB Seed] Error during LeetCode contests seeding:', err.message);
    throw err;
  }
}

/**
 * Initialize background cron job (runs daily at 1:00 AM)
 */
function initScheduler() {
  console.log('[Scheduler] Initializing automated daily EntrantHub sync (1:00 AM)...');
  
  cron.schedule('0 1 * * *', async () => {
    console.log('[Scheduler] Executing scheduled daily sync...');
    try {
      await syncAllData();
      console.log('[Scheduler] Scheduled daily sync executed successfully.');
    } catch (err) {
      console.error('[Scheduler] Scheduled daily sync failed:', err.message);
    }
  });
}

module.exports = {
  syncAllData,
  seedMasterContests,
  initScheduler
};

