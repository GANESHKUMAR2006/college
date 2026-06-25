const db = require('../config/db');

// Helper to parse dates timezone-independently
function parseDateOnly(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  let dateStr;
  if (dateInput instanceof Date) {
    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const day = String(dateInput.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  } else if (typeof dateInput === 'string') {
    dateStr = dateInput.substring(0, 10);
  } else {
    const year = d.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const day = String(dateInput.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  }
  const parts = dateStr.split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
}

/**
 * Get detailed analytics for a single student's performance progression
 */
async function getStudentAnalytics(req, res) {
  const { studentId } = req.params;

  try {
    // 1. Fetch student info
    const studentResult = await db.query(
      `SELECT id, name, roll_no as register_number, department, section, academic_batch as academic_year, leetcode_username, academic_start_date, academic_end_date 
       FROM Users 
       WHERE id = ?`,
      [studentId]
    );

    if (!studentResult || studentResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const student = studentResult[0];

    // 2. Fetch participation history and LEFT JOIN
    const history = await db.query(
      `SELECT c.contest_id, c.title as contest_name, c.slug as contest_slug, c.start_time as contest_date, c.contest_status, c.duration,
              ar.attendance_status, ar.attendance_source, ar.last_updated,
              (SELECT COUNT(*) FROM Registrations r WHERE r.contest_id = c.contest_id AND r.user_id = ?) as is_registered,
              (SELECT COUNT(*) FROM ParticipationLogs p WHERE p.contest_id = c.contest_id AND p.user_id = ?) as is_joined
       FROM Contests c
       LEFT JOIN AttendanceRecords ar ON c.contest_id = ar.contest_id AND ar.user_id = ?
       ORDER BY c.start_time ASC`,
      [studentId, studentId, studentId]
    );

    const startDate = parseDateOnly(student.academic_start_date);
    const endDate = parseDateOnly(student.academic_end_date);
    endDate.setHours(23, 59, 59, 999);

    const now = new Date();

    // Format history items to fit frontend structure
    const formattedHistory = history.map(h => {
      const contestDate = parseDateOnly(h.contest_date);
      const isEligible = contestDate >= startDate && contestDate <= endDate;
      
      const startTime = new Date(h.contest_date);
      const durationMs = (h.duration || 5400) * 1000;
      const endTime = new Date(startTime.getTime() + durationMs);
      
      const isOngoing = startTime <= now && endTime > now;
      const isUnrated = h.contest_status && h.contest_status.toLowerCase() === 'unrated';
      const hasAttended = h.attendance_status === 'PRESENT' || h.is_joined > 0;
      
      let attendanceStatus = 'ABSENT';
      if (!isEligible) {
        attendanceStatus = 'NOT_APPLICABLE';
      } else if (isOngoing) {
        attendanceStatus = 'ONGOING';
      } else if (isUnrated) {
        attendanceStatus = 'UNRATED';
      } else if (hasAttended) {
        attendanceStatus = 'PRESENT';
      } else {
        attendanceStatus = 'ABSENT';
      }

      const isPresent = attendanceStatus === 'PRESENT';

      return {
        id: h.contest_id,
        contest_name: h.contest_name,
        contest_slug: h.contest_slug,
        contest_date: h.contest_date,
        contest_status: h.contest_status,
        attendance_status: attendanceStatus,
        attendance_source: h.attendance_source,
        contest_type: h.contest_name.toLowerCase().includes('biweekly') ? 'biweekly' : 'weekly',
        global_rank: null,
        rating: null,
        rating_change: 0.00,
        attended: isEligible && isPresent,
        score: isEligible && isPresent ? 4 : 0,
        problems_solved: isEligible && isPresent ? 4 : 0,
        total_problems: 4,
        eligibility_status: isEligible ? 'Eligible' : 'Outside Academic Period',
        confidence_score: isPresent ? 100 : 0,
        verification_source: h.attendance_source === 'MANUAL' ? 'Faculty Manual' : 'Platform Activity'
      };
    });

    // 3. Fetch summary metrics from Registrations, ParticipationLogs and LeetCodeProfiles
    const summaryResult = await db.query(
      `SELECT lp.current_rating, lp.highest_rating, lp.global_ranking, lp.contest_history,
              (SELECT COUNT(*) FROM Registrations r WHERE r.user_id = ?) as total_contests,
              (SELECT COUNT(*) FROM ParticipationLogs p WHERE p.user_id = ?) as attended_contests
       FROM LeetCodeProfiles lp
       WHERE lp.user_id = ?`,
      [studentId, studentId, studentId]
    );

    const eligibleRecords = formattedHistory.filter(h => h.eligibility_status === 'Eligible');
    const ratedEligibleRecords = eligibleRecords.filter(h => h.attendance_status === 'PRESENT' || h.attendance_status === 'ABSENT');
    const present = ratedEligibleRecords.filter(h => h.attendance_status === 'PRESENT').length;
    const absent = ratedEligibleRecords.filter(h => h.attendance_status === 'ABSENT').length;
    const totalRated = ratedEligibleRecords.length;
    const unrated = eligibleRecords.filter(h => h.attendance_status === 'UNRATED').length;
    const ongoing = eligibleRecords.filter(h => h.attendance_status === 'ONGOING').length;

    let metrics = {
      totalContests: eligibleRecords.length,
      ratedContests: totalRated,
      unratedContests: unrated,
      ongoingContests: ongoing,
      present: present,
      absent: absent,
      presentRated: present,
      presentUnrated: 0,
      attendancePercentage: totalRated > 0 ? Math.round((present / totalRated) * 100) : 100,
      currentRating: 1500,
      bestRating: 1500,
      bestRank: null,
      avgProblemsSolved: present > 0 ? 4 : 0,
      ratingGrowth: 0
    };

    if (summaryResult.length > 0) {
      const summary = summaryResult[0];
      const curRating = Math.round(parseFloat(summary.current_rating || 1500));
      metrics = {
        ...metrics,
        currentRating: curRating,
        bestRating: Math.round(parseFloat(summary.highest_rating || 1500)),
        bestRank: summary.global_ranking,
        ratingGrowth: curRating - 1500
      };
    }

    return res.json({
      success: true,
      student,
      metrics,
      history: formattedHistory
    });
  } catch (error) {
    console.error('Error fetching student analytics:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve student analytics' });
  }
}

/**
 * Get rankings, ratings, and top performers leaderboards
 */
async function getLeaderboards(req, res) {
  const { department, academicBatch, section } = req.query;
  
  let filterSql = "";
  const params = [];
  
  if (department) {
    filterSql += " AND u.department = ?";
    params.push(department);
  }
  if (section) {
    filterSql += " AND u.section = ?";
    params.push(section);
  }
  if (academicBatch) {
    filterSql += " AND u.academic_batch = ?";
    params.push(academicBatch);
  }

  try {
    // 1. Top Performers (sorted by current rating)
    const topPerformers = await db.query(
      `SELECT u.id, u.name, u.roll_no as register_number, u.leetcode_username, u.department, u.section, u.academic_batch as academic_year,
              ROUND(IFNULL(lp.current_rating, 1500)) as current_rating,
              ROUND(IFNULL(lp.highest_rating, 1500)) as best_rating,
              lp.global_ranking as best_rank,
              IFNULL((SELECT COUNT(*) FROM ParticipationLogs p WHERE p.user_id = u.id), 0) as contests_attended
       FROM Users u
       LEFT JOIN LeetCodeProfiles lp ON u.id = lp.user_id
       WHERE u.status = 'active'${filterSql}
       ORDER BY current_rating DESC, contests_attended DESC
       LIMIT 100`,
      params
    );

    // 2. Top Improvers (net rating growth starting from 1500 during academic period)
    const topImprovers = await db.query(
      `SELECT u.id, u.name, u.roll_no as register_number, u.leetcode_username, u.department,
              ROUND(IFNULL(lp.current_rating, 1500)) as current_rating,
              1500 as initial_rating,
              ROUND(IFNULL(lp.current_rating, 1500) - 1500) as rating_gain,
              IFNULL((SELECT COUNT(*) FROM ParticipationLogs p WHERE p.user_id = u.id), 0) as contests_attended
       FROM Users u
       JOIN LeetCodeProfiles lp ON u.id = lp.user_id
       WHERE u.status = 'active' AND (lp.current_rating - 1500) > 0${filterSql}
       ORDER BY rating_gain DESC
       LIMIT 20`,
      params
    );

    // 3. Most Consistent (highest attendance rate, min 3 registered contests)
    const consistencyList = await db.query(
      `SELECT u.id, u.name, u.roll_no as register_number, u.leetcode_username, u.department,
              (SELECT COUNT(*) FROM Registrations r JOIN Contests c ON r.contest_id = c.contest_id WHERE r.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()) as total_contests,
              (SELECT COUNT(*) FROM ParticipationLogs p JOIN Contests c ON p.contest_id = c.contest_id WHERE p.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()) as present_count,
              ROUND(IFNULL(
                (SELECT COUNT(*) FROM ParticipationLogs p JOIN Contests c ON p.contest_id = c.contest_id WHERE p.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()) /
                NULLIF((SELECT COUNT(*) FROM Registrations r JOIN Contests c ON r.contest_id = c.contest_id WHERE r.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()), 0) * 100, 0
              )) as attendance_percentage
       FROM Users u
       WHERE u.status = 'active' AND (SELECT COUNT(*) FROM Registrations r JOIN Contests c ON r.contest_id = c.contest_id WHERE r.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()) >= 3${filterSql}
       ORDER BY attendance_percentage DESC, present_count DESC
       LIMIT 20`,
      params
    );

    return res.json({
      success: true,
      topPerformers,
      topImprovers,
      mostConsistent: consistencyList
    });
  } catch (error) {
    console.error('Error generating leaderboards:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate leaderboards' });
  }
}

/**
 * Get department performance and comparison statistics
 */
async function getDepartmentAnalytics(req, res) {
  try {
    const stats = await db.query(
      `SELECT u.department,
              COUNT(DISTINCT u.id) as total_students,
              IFNULL(SUM((SELECT COUNT(*) FROM Registrations r JOIN Contests c ON r.contest_id = c.contest_id WHERE r.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW())), 0) as total_records,
              IFNULL(SUM((SELECT COUNT(*) FROM ParticipationLogs p JOIN Contests c ON p.contest_id = c.contest_id WHERE p.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW())), 0) as present_count,
              IFNULL(ROUND(AVG((SELECT COUNT(*) FROM ParticipationLogs p JOIN Contests c ON p.contest_id = c.contest_id WHERE p.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()) / NULLIF((SELECT COUNT(*) FROM Registrations r JOIN Contests c ON r.contest_id = c.contest_id WHERE r.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()), 0) * 100)), 0) as attendance_percentage,
              IFNULL(ROUND(AVG(lp.current_rating)), 1500) as average_rating,
              IFNULL(ROUND(MAX(lp.highest_rating)), 1500) as peak_rating,
              IFNULL(ROUND(AVG((SELECT COUNT(*) FROM ParticipationLogs p JOIN Contests c ON p.contest_id = c.contest_id WHERE p.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()) / NULLIF((SELECT COUNT(*) FROM Registrations r JOIN Contests c ON r.contest_id = c.contest_id WHERE r.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()), 0) * 4), 1), 0) as average_problems_solved
       FROM Users u
       LEFT JOIN LeetCodeProfiles lp ON u.id = lp.user_id
       WHERE u.status = 'active'
       GROUP BY u.department
       ORDER BY attendance_percentage DESC`
    );

    return res.json({
      success: true,
      departments: stats
    });
  } catch (error) {
    console.error('Error fetching department analytics:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve department comparison' });
  }
}

/**
 * Get portal-wide summary statistics, batch-wise averages, and section-wise averages
 */
async function getPortalSummary(req, res) {
  try {
    // 1. Portal-wide stats
    const globalStatsResult = await db.query(
      `SELECT 
         IFNULL(ROUND(AVG(lp.current_rating)), 1500) as avg_rating,
         IFNULL(ROUND(MAX(lp.highest_rating)), 1500) as max_rating,
         IFNULL(MIN(lp.global_ranking), 0) as best_rank,
         IFNULL(ROUND(AVG((SELECT COUNT(*) FROM ParticipationLogs p JOIN Contests c ON p.contest_id = c.contest_id WHERE p.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()) / NULLIF((SELECT COUNT(*) FROM Registrations r JOIN Contests c ON r.contest_id = c.contest_id WHERE r.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()), 0) * 100)), 0) as avg_attendance
       FROM Users u
       LEFT JOIN LeetCodeProfiles lp ON u.id = lp.user_id
       WHERE u.status = 'active'`
    );
    const globalStats = globalStatsResult[0] || { avg_rating: 1500, max_rating: 1500, best_rank: 0, avg_attendance: 0 };

    // 2. Batch-wise stats
    const batchStats = await db.query(
      `SELECT 
         u.academic_batch as batch,
         COUNT(DISTINCT u.id) as total_students,
         IFNULL(ROUND(AVG(lp.current_rating)), 1500) as avg_rating,
         IFNULL(ROUND(AVG((SELECT COUNT(*) FROM ParticipationLogs p JOIN Contests c ON p.contest_id = c.contest_id WHERE p.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()) / NULLIF((SELECT COUNT(*) FROM Registrations r JOIN Contests c ON r.contest_id = c.contest_id WHERE r.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()), 0) * 100)), 0) as avg_attendance
       FROM Users u
       LEFT JOIN LeetCodeProfiles lp ON u.id = lp.user_id
       WHERE u.status = 'active'
       GROUP BY u.academic_batch
       ORDER BY u.academic_batch DESC`
    );

    // 3. Section-wise stats
    const sectionStats = await db.query(
      `SELECT 
         u.department,
         u.section,
         CONCAT(u.department, ' - ', u.section) as label,
         COUNT(DISTINCT u.id) as total_students,
         IFNULL(ROUND(AVG(lp.current_rating)), 1500) as avg_rating,
         IFNULL(ROUND(AVG((SELECT COUNT(*) FROM ParticipationLogs p JOIN Contests c ON p.contest_id = c.contest_id WHERE p.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()) / NULLIF((SELECT COUNT(*) FROM Registrations r JOIN Contests c ON r.contest_id = c.contest_id WHERE r.user_id = u.id AND c.contest_status = 'Rated' AND c.start_time + INTERVAL IFNULL(c.duration, 5400) SECOND <= NOW()), 0) * 100)), 0) as avg_attendance
       FROM Users u
       LEFT JOIN LeetCodeProfiles lp ON u.id = lp.user_id
       WHERE u.status = 'active'
       GROUP BY u.department, u.section
       ORDER BY u.department ASC, u.section ASC`
    );

    return res.json({
      success: true,
      globalStats,
      batchStats,
      sectionStats
    });
  } catch (error) {
    console.error('Error fetching portal summary analytics:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve portal summary analytics' });
  }
}

module.exports = {
  getStudentAnalytics,
  getLeaderboards,
  getDepartmentAnalytics,
  getPortalSummary
};
