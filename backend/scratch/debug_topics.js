const db = require('../config/db');
const aiService = require('../services/aiService');

async function run() {
  await db.initializeDatabase();
  
  // Seed required department
  await db.query(`
    INSERT IGNORE INTO departments (name, code, status)
    VALUES ('Department of Electronics & Communication', 'DEC', 'active')
  `);

  const uniqueRoll = `ROLL-DEBUG-${Date.now()}`;
  const username = `user_debug_${Date.now()}`;
  
  await db.query(`
    INSERT INTO Users (name, roll_no, department, section, leetcode_username, academic_batch, academic_start_date, academic_end_date, status)
    VALUES (?, ?, 'DEC', 'A', ?, '2024-2028', '2024-07-01', '2028-06-30', 'active')
  `, [`Debug Candidate`, uniqueRoll, username]);

  const [studentRow] = await db.query("SELECT id FROM Users WHERE roll_no = ?", [uniqueRoll]);
  const studentId = studentRow.id;

  const mockTopicStats = [
    { tagName: 'Array', tagSlug: 'array', problemsSolved: 50 },
    { tagName: 'Dynamic Programming', tagSlug: 'dynamic-programming', problemsSolved: 2 },
    { tagName: 'Graph', tagSlug: 'graph', problemsSolved: 1 }
  ];

  const mockContestHistory = [
    { rating: 1450, ranking: 8000, contest: { title: 'Weekly Contest 1', startTime: 1718000000 } }
  ];

  await db.query(`
    INSERT INTO LeetCodeProfiles (user_id, current_rating, highest_rating, global_ranking, problems_solved, topic_stats, contest_history)
    VALUES (?, 1510.00, 1510.00, 4500, 120, ?, ?)
  `, [studentId, JSON.stringify(mockTopicStats), JSON.stringify(mockContestHistory)]);

  const aiData = await aiService.getStudentAiInsights(studentId);
  console.log("Returned AI Data Weak Topics:", JSON.stringify(aiData.weakTopics, null, 2));

  // Cleanup
  await db.query("DELETE FROM LeetCodeProfiles WHERE user_id = ?", [studentId]);
  await db.query("DELETE FROM Users WHERE id = ?", [studentId]);

  const pool = db.getPool();
  if (pool) await pool.end();
}

run();
