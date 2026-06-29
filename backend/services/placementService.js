/**
 * PlacementService
 * ================
 * Handles all backend business calculations for student placement readiness:
 * - Student-specific coding readiness scores, company tier preparation, and skill matrices.
 * - College-wide/Department-wide placement overview aggregates with optimized database JOIN queries.
 */

const db = require('../config/db');
const platformAnalytics = require('./platformAnalyticsService');
const { computeOverallScore } = require('./dashboardMetricsService');

/**
 * Determine coding readiness level text based on overall score.
 */
function getReadinessLevel(score, companyPrep) {
  if (score >= 75 || companyPrep.tier1 === 'Ready') return 'Elite';
  if (score >= 50 || companyPrep.tier2 === 'Ready') return 'High';
  if (score >= 25 || companyPrep.tier3 === 'Ready') return 'Moderate';
  return 'Needs Practice';
}

/**
 * Map company preparation status for specific tiers.
 */
function evaluateCompanyPrep(score, lcRating, cfRating, totalSolved) {
  // Tier 1: FAANG / Top Product (Google, Microsoft, Amazon, etc.)
  let tier1 = 'Not Ready';
  if (score >= 75 || lcRating >= 1800 || cfRating >= 1600) {
    tier1 = 'Ready';
  } else if (score >= 60 || lcRating >= 1650 || cfRating >= 1450) {
    tier1 = 'Close';
  }

  // Tier 2: Mid-tier Product / Fast startups (Zoho, Freshworks, Razorpay)
  let tier2 = 'Not Ready';
  if (score >= 50 || lcRating >= 1500 || cfRating >= 1300) {
    tier2 = 'Ready';
  } else if (score >= 40 || lcRating >= 1400 || cfRating >= 1200) {
    tier2 = 'Close';
  }

  // Tier 3: Service-based IT giants (TCS, Infosys, Cognizant, Wipro)
  let tier3 = 'Not Ready';
  if (score >= 25 || totalSolved >= 120) {
    tier3 = 'Ready';
  } else if (score >= 15 || totalSolved >= 80) {
    tier3 = 'Close';
  }

  return { tier1, tier2, tier3 };
}

/**
 * Get placement data for a specific student.
 */
async function getStudentPlacementData(studentId) {
  const profileData = await platformAnalytics.getUnifiedStudentProfile(studentId);
  if (!profileData) {
    throw new Error('Student not found');
  }

  const { student, profiles, overallScore, totalProblemsSolved } = profileData;

  const lcRating = Number(profiles.leetcode?.rating) || 0;
  const cfRating = Number(profiles.codeforces?.rating) || 0;

  // Determine readiness level & company prep
  const companyPrep = evaluateCompanyPrep(overallScore, lcRating, cfRating, totalProblemsSolved);
  const readinessLevel = getReadinessLevel(overallScore, companyPrep);

  // Calculate consistency from attendance records
  const attendanceStats = await db.query(
    `SELECT 
       COUNT(*) as registered,
       SUM(CASE WHEN attendance_status = 'PRESENT' THEN 1 ELSE 0 END) as attended
     FROM AttendanceRecords
     WHERE user_id = ?`,
    [studentId]
  );
  
  const registered = Number(attendanceStats[0]?.registered || 0);
  const attended = Number(attendanceStats[0]?.attended || 0);
  const attendanceRate = registered > 0 ? Math.round((attended / registered) * 100) : 0;

  // Recent consistency check (attendance in last 5 contests)
  const recentLogs = await db.query(
    `SELECT ar.attendance_status
     FROM AttendanceRecords ar
     JOIN Contests c ON ar.contest_id = c.contest_id
     WHERE ar.user_id = ? AND c.contest_status = 'Rated'
     ORDER BY c.start_time DESC
     LIMIT 5`,
    [studentId]
  );
  
  const recentAttended = recentLogs.filter(log => log.attendance_status === 'PRESENT').length;
  const recentConsistency = recentLogs.length > 0 ? Math.round((recentAttended / recentLogs.length) * 100) : 0;

  // Compile Skill Matrix
  const skillMatrix = {
    easySolved: Number(profiles.leetcode?.easySolved) || 0,
    mediumSolved: Number(profiles.leetcode?.mediumSolved) || 0,
    hardSolved: Number(profiles.leetcode?.hardSolved) || 0,
    platformSolved: {
      leetcode: Number(profiles.leetcode?.problemsSolved) || 0,
      codechef: Number(profiles.codechef?.problemsSolved) || 0,
      codeforces: Number(profiles.codeforces?.problemsSolved) || 0,
      hackerrank: Number(profiles.hackerrank?.problemsSolved) || 0
    },
    topicStats: profiles.leetcode?.topicStats || []
  };

  return {
    student,
    overallScore,
    readinessLevel,
    companyPrep,
    consistency: {
      attendanceRate,
      recentConsistency,
      contestsRegistered: registered,
      contestsAttended: attended
    },
    skillMatrix
  };
}

/**
 * Get aggregated placement readiness overview for faculty/HOD.
 */
async function getPlacementOverview({ department, academicBatch } = {}) {
  let filterSql = '';
  const params = [];
  if (department) {
    filterSql += ' AND u.department = ?';
    params.push(department);
  }
  if (academicBatch) {
    filterSql += ' AND u.academic_batch = ?';
    params.push(academicBatch);
  }

  // Optimized single JOIN query to fetch all student profiles & their credentials
  const rows = await db.query(
    `SELECT u.id, u.name, u.roll_no as register_number, u.department, u.section, u.academic_batch as academic_year,
            u.leetcode_username, u.codechef_username, u.codeforces_username, u.hackerrank_username,
            ROUND(IFNULL(lp.current_rating, 0)) as lc_rating,
            IFNULL(lp.problems_solved, 0) as lc_solved,
            ROUND(IFNULL(cp.current_rating, 0)) as cc_rating,
            IFNULL(cp.problems_solved, 0) as cc_solved,
            ROUND(IFNULL(cfp.current_rating, 0)) as cf_rating,
            IFNULL(cfp.problems_solved, 0) as cf_solved,
            IFNULL(hrp.problems_solved, 0) as hr_solved,
            (SELECT COUNT(*) FROM ParticipationLogs p WHERE p.user_id = u.id) as contests_attended
     FROM Users u
     LEFT JOIN LeetCodeProfiles lp ON lp.user_id = u.id
     LEFT JOIN CodeChefProfiles cp ON lp.user_id = u.id
     LEFT JOIN CodeforcesProfiles cfp ON lp.user_id = u.id
     LEFT JOIN HackerRankProfiles hrp ON hrp.user_id = u.id
     WHERE u.status = 'active'${filterSql}
     ORDER BY u.name ASC`,
    params
  );

  const students = rows.map(r => {
    const totalSolved = Number(r.lc_solved) + Number(r.cc_solved) + Number(r.cf_solved) + Number(r.hr_solved);
    const overallScore = computeOverallScore(
      Number(r.lc_rating), Number(r.cc_rating), Number(r.cf_rating),
      Number(r.lc_solved), Number(r.cc_solved), Number(r.cf_solved), Number(r.hr_solved)
    );
    const companyPrep = evaluateCompanyPrep(overallScore, Number(r.lc_rating), Number(r.cf_rating), totalSolved);
    const readinessLevel = getReadinessLevel(overallScore, companyPrep);
    
    return {
      id: r.id,
      name: r.name,
      roll_no: r.register_number,
      department: r.department,
      section: r.section,
      academic_batch: r.academic_year,
      overallScore,
      totalSolved,
      readinessLevel,
      companyPrep,
      contestsAttended: r.contests_attended
    };
  });

  // Calculate aggregates
  const totalStudents = students.length;
  const levelsCount = { Elite: 0, High: 0, Moderate: 0, 'Needs Practice': 0 };
  const companyReadyCount = { tier1: 0, tier2: 0, tier3: 0 };
  let scoreSum = 0;
  let solvedSum = 0;

  students.forEach(s => {
    levelsCount[s.readinessLevel]++;
    scoreSum += s.overallScore;
    solvedSum += s.totalSolved;

    if (s.companyPrep.tier1 === 'Ready') companyReadyCount.tier1++;
    if (s.companyPrep.tier2 === 'Ready') companyReadyCount.tier2++;
    if (s.companyPrep.tier3 === 'Ready') companyReadyCount.tier3++;
  });

  const avgReadinessScore = totalStudents > 0 ? Math.round(scoreSum / totalStudents) : 0;
  const avgProblemsSolved = totalStudents > 0 ? Math.round(solvedSum / totalStudents) : 0;

  // Extract Top 10 placement ready students
  const topReadyStudents = [...students]
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 10);

  return {
    students,
    aggregates: {
      totalStudents,
      avgReadinessScore,
      avgProblemsSolved,
      distribution: {
        elite: levelsCount['Elite'],
        high: levelsCount['High'],
        moderate: levelsCount['Moderate'],
        practice: levelsCount['Needs Practice']
      },
      companyReadiness: {
        tier1: companyReadyCount.tier1,
        tier2: companyReadyCount.tier2,
        tier3: companyReadyCount.tier3
      }
    },
    topReadyStudents
  };
}

module.exports = {
  getStudentPlacementData,
  getPlacementOverview
};
