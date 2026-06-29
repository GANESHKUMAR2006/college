const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../config/db');

// Import services and controllers to test
const placementService = require('../services/placementService');
const aiService = require('../services/aiService');
const placementController = require('../controllers/placementController');
const aiController = require('../controllers/aiController');
const cache = require('../services/analyticsCacheService');

test('PlacementService - evaluates coding readiness, company prep, and aggregates correctly', async () => {
  await db.initializeDatabase();

  // Seed the required department to avoid foreign key violations
  await db.query(`
    INSERT IGNORE INTO departments (name, code, status)
    VALUES ('Department of Electronics & Communication', 'DEC', 'active')
  `);

  // 1. Seed a mock student with specific platform details
  const uniqueRoll = `ROLL-${Date.now()}`;
  const username = `user_${Date.now()}`;
  
  await db.query(`
    INSERT INTO Users (name, roll_no, department, section, leetcode_username, academic_batch, academic_start_date, academic_end_date, status)
    VALUES (?, ?, 'DEC', 'A', ?, '2024-2028', '2024-07-01', '2028-06-30', 'active')
  `, [`Test Candidate`, uniqueRoll, username]);

  const [studentRow] = await db.query("SELECT id FROM Users WHERE roll_no = ?", [uniqueRoll]);
  const studentId = studentRow.id;

  // Insert LeetCode Profile with high rating to qualify for Tier 1
  await db.query(`
    INSERT INTO LeetCodeProfiles (user_id, current_rating, highest_rating, global_ranking, problems_solved, easy_solved, medium_solved, hard_solved, topic_stats)
    VALUES (?, 1850.00, 1900.00, 1500, 450, 150, 250, 50, '[]')
  `, [studentId]);

  // 2. Fetch student specific placement data
  const data = await placementService.getStudentPlacementData(studentId);
  assert.equal(data.student.id, studentId);
  assert.equal(data.readinessLevel, 'Elite'); // Score should be >= 75 due to high rating & solved count
  assert.equal(data.companyPrep.tier1, 'Ready'); // Tier 1 FAANG ready (rating >= 1800)
  assert.equal(data.companyPrep.tier2, 'Ready');
  assert.equal(data.companyPrep.tier3, 'Ready');

  // 3. Test placement overview aggregation
  const overview = await placementService.getPlacementOverview({ department: 'DEC' });
  assert.ok(overview.aggregates.totalStudents >= 1);
  assert.ok(overview.aggregates.avgReadinessScore > 0);
  assert.ok(overview.topReadyStudents.length > 0);

  // Clean up seeded student & profile
  await db.query("DELETE FROM LeetCodeProfiles WHERE user_id = ?", [studentId]);
  await db.query("DELETE FROM Users WHERE id = ?", [studentId]);
});

test('AiService - detects weak topics, predicts rating changes, and generates milestones', async () => {
  await db.initializeDatabase();

  // Seed the required department to avoid foreign key violations
  await db.query(`
    INSERT IGNORE INTO departments (name, code, status)
    VALUES ('Department of Electronics & Communication', 'DEC', 'active')
  `);

  const uniqueRoll = `ROLL-AI-${Date.now()}`;
  const username = `user_ai_${Date.now()}`;
  
  await db.query(`
    INSERT INTO Users (name, roll_no, department, section, leetcode_username, academic_batch, academic_start_date, academic_end_date, status)
    VALUES (?, ?, 'DEC', 'A', ?, '2024-2028', '2024-07-01', '2028-06-30', 'active')
  `, [`AI Candidate`, uniqueRoll, username]);

  const [studentRow] = await db.query("SELECT id FROM Users WHERE roll_no = ?", [uniqueRoll]);
  const studentId = studentRow.id;

  // Insert LeetCode Profile with low DP/Graph solving to trigger weak topic alert
  const mockTopicStats = [
    { tagName: 'Array', tagSlug: 'array', problemsSolved: 50 },
    { tagName: 'Dynamic Programming', tagSlug: 'dynamic-programming', problemsSolved: 2 },
    { tagName: 'Graph', tagSlug: 'graph', problemsSolved: 1 }
  ];

  const mockContestHistory = [
    { rating: 1450, ratingChange: 50, ranking: 8000, contest: { title: 'Weekly Contest 1', startTime: 1718000000 } },
    { rating: 1480, ratingChange: 30, ranking: 6000, contest: { title: 'Weekly Contest 2', startTime: 1718600000 } },
    { rating: 1510, ratingChange: 30, ranking: 4500, contest: { title: 'Weekly Contest 3', startTime: 1719200000 } }
  ];

  await db.query(`
    INSERT INTO LeetCodeProfiles (user_id, current_rating, highest_rating, global_ranking, problems_solved, topic_stats, contest_history)
    VALUES (?, 1510.00, 1510.00, 4500, 120, ?, ?)
  `, [studentId, JSON.stringify(mockTopicStats), JSON.stringify(mockContestHistory)]);

  // 1. Fetch AI insights
  const aiData = await aiService.getStudentAiInsights(studentId);
  assert.equal(aiData.student.id, studentId);
  assert.ok(aiData.weakTopics.length > 0);

  // Dynamic Programming solved = 2 < 15 target. It should be flagged as weak.
  const dpWeak = aiData.weakTopics.find(t => t.topicName === 'Dynamic Programming');
  assert.ok(dpWeak);
  assert.equal(dpWeak.priority, 'High'); // solved (2) <= 15 * 0.25 (3.75) -> High Priority

  // Check recommendations and predictions
  assert.ok(aiData.recommendations.text.includes('Trees') || aiData.recommendations.text.includes('intermediate'));
  assert.ok(aiData.contestPredictions.predictedRating > 1510); // Rating trajectory was +30, +30. Predict positive growth.
  assert.equal(aiData.contestPredictions.confidence, 'Medium'); // 3 contests history

  // Clean up
  await db.query("DELETE FROM LeetCodeProfiles WHERE user_id = ?", [studentId]);
  await db.query("DELETE FROM Users WHERE id = ?", [studentId]);
});

test('Controllers - enforce role-based access control and reject unauthorized requests', async () => {
  // Clear any existing cache to keep test isolated
  cache.invalidateAll();

  // Test Student calling another student profile (RBAC violation)
  const reqStudentOther = {
    params: { studentId: 9999 },
    user: { id: 1, role: 'Student', studentId: 1007 } // logged in student is 1007, requesting 9999
  };

  const resMock = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    }
  };

  await placementController.getStudentPlacementData(reqStudentOther, resMock);
  assert.equal(resMock.statusCode, 403);
  assert.equal(resMock.jsonData.success, false);
  assert.ok(resMock.jsonData.message.includes('authorized'));

  // Test Student calling overview (RBAC violation)
  const reqStudentOverview = {
    query: {},
    user: { id: 1, role: 'Student', studentId: 1007 }
  };
  const resMock2 = { ...resMock, statusCode: null, jsonData: null };

  await placementController.getPlacementOverview(reqStudentOverview, resMock2);
  assert.equal(resMock2.statusCode, 403);
  assert.equal(resMock2.jsonData.success, false);
});

after(async () => {
  const pool = db.getPool();
  if (pool) {
    await pool.end();
  }
});
