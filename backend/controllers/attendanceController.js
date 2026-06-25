const db = require('../config/db');
const xlsx = require('xlsx');
const leetcode = require('../utils/leetcode');

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

function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Find username column in sheets
function findUsernameColumn(headers) {
  const targetKeywords = ['username', 'handle', 'leetcode', 'user', 'usernames', 'user name', 'leetcode handle', 'leetcode username'];
  
  for (let header of headers) {
    const cleanHeader = String(header).toLowerCase().trim().replace(/[\s_-]/g, '');
    if (targetKeywords.includes(cleanHeader)) {
      return header;
    }
  }

  for (let header of headers) {
    const cleanHeader = String(header).toLowerCase().trim();
    const matches = targetKeywords.some(kw => cleanHeader.includes(kw));
    if (matches) {
      return header;
    }
  }

  return headers[0];
}

// 1. Process Uploaded Contest CSV/Excel and mark attendance
async function processContestUpload(req, res) {
  const { contestName, contestId, contestDate } = req.body;
  const cName = contestName || contestId;

  if (!cName) {
    return res.status(400).json({ success: false, message: 'Contest name or ID is required.' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Contest ranking file (Excel/CSV) is required.' });
  }

  try {
    let cDateStr = contestDate;
    const contestSlug = cName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (!cDateStr) {
      const dateResult = await db.query(
        "SELECT DISTINCT start_time FROM Contests WHERE slug = ? LIMIT 1",
        [contestSlug]
      );
      if (dateResult.length > 0) {
        cDateStr = formatDate(dateResult[0].start_time);
      } else {
        cDateStr = new Date().toISOString().split('T')[0];
      }
    }

    // Look up or insert contest in Contests table
    const contestCheck = await db.query("SELECT contest_id FROM Contests WHERE slug = ?", [contestSlug]);
    let targetContestId;

    if (contestCheck.length > 0) {
      targetContestId = contestCheck[0].contest_id;
    } else {
      const contestType = contestSlug.includes('biweekly') ? 'Biweekly' : 'Weekly';
      const match = contestSlug.match(/contest-(\d+)/);
      const contestNumber = match ? parseInt(match[1], 10) : 0;
      const result = await db.query(`
        INSERT INTO Contests (title, slug, contest_type, contest_number, start_time, contest_status)
        VALUES (?, ?, ?, ?, ?, 'Rated')
      `, [cName, contestSlug, contestType, contestNumber, cDateStr]);
      targetContestId = result.insertId;
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const headers = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = xlsx.utils.encode_cell({ r: range.s.r, c: col });
      const cell = sheet[cellAddress];
      headers.push(cell ? cell.v : `col_${col}`);
    }

    const usernameCol = findUsernameColumn(headers);
    
    // Validate that we actually found the username/handle column
    const hasUsernameHeader = headers.some(h => {
      const clean = String(h).toLowerCase().trim().replace(/[\s_-]/g, '');
      return ['username', 'handle', 'leetcode', 'user', 'usernames', 'user name', 'leetcode handle', 'leetcode username'].includes(clean) ||
             ['username', 'handle', 'leetcode', 'user', 'usernames', 'user name', 'leetcode handle', 'leetcode username'].some(kw => clean.includes(kw));
    });

    if (!hasUsernameHeader) {
      console.warn(`[Upload Validation] No LeetCode username/handle column header found in sheet. Headers found: ${JSON.stringify(headers)}`);
      return res.status(400).json({ 
        success: false, 
        message: "Could not identify a LeetCode username or handle column in the uploaded file. Please ensure your sheet has a column header named 'username' or 'handle'." 
      });
    }

    const rows = xlsx.utils.sheet_to_json(sheet);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Uploaded file is empty.' });
    }

    const fileUsernames = new Set();
    rows.forEach(row => {
      const val = row[usernameCol];
      if (val) {
        fileUsernames.add(String(val).trim().toLowerCase());
      }
    });

    // Get active students eligible for this contest
    const activeStudents = await db.query(
      "SELECT id, leetcode_username, academic_start_date, academic_end_date FROM Users WHERE status = 'active'"
    );

    const cDate = new Date(cDateStr);
    cDate.setHours(12, 0, 0, 0);

    const eligibleStudents = activeStudents.filter(s => {
      const start = new Date(s.academic_start_date);
      const end = new Date(s.academic_end_date);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return cDate >= start && cDate <= end;
    });

    let present = 0;
    let absent = 0;

    for (const student of eligibleStudents) {
      const lcUserLower = student.leetcode_username.trim().toLowerCase();
      const attended = fileUsernames.has(lcUserLower);

      if (attended) {
        present++;
        
        // Ensure registered
        await db.query(
          "INSERT IGNORE INTO Registrations (user_id, contest_id) VALUES (?, ?)",
          [student.id, targetContestId]
        );

        // Insert into ParticipationLogs
        await db.query(
          `INSERT INTO ParticipationLogs (user_id, contest_id, join_time, participation_status)
           VALUES (?, ?, CURRENT_TIMESTAMP, 'JOINED')
           ON DUPLICATE KEY UPDATE join_time = CURRENT_TIMESTAMP, participation_status = 'JOINED'`,
          [student.id, targetContestId]
        );

        // Update AttendanceRecords
        await db.query(
          `INSERT INTO AttendanceRecords (user_id, contest_id, attendance_status, attendance_source)
           VALUES (?, ?, 'PRESENT', 'AUTO')
           ON DUPLICATE KEY UPDATE attendance_status = 'PRESENT', attendance_source = 'AUTO'`,
          [student.id, targetContestId]
        );
      } else {
        absent++;

        // Ensure registered
        await db.query(
          "INSERT IGNORE INTO Registrations (user_id, contest_id) VALUES (?, ?)",
          [student.id, targetContestId]
        );

        await db.query(
          `INSERT INTO AttendanceRecords (user_id, contest_id, attendance_status, attendance_source)
           VALUES (?, ?, 'ABSENT', 'AUTO')
           ON DUPLICATE KEY UPDATE attendance_status = 'ABSENT', attendance_source = 'AUTO'`,
          [student.id, targetContestId]
        );
      }
    }

    // Log unmatched handles for manual review
    const unmatchedHandles = [];
    const databaseUsernames = new Set(eligibleStudents.map(s => s.leetcode_username.trim().toLowerCase()));
    
    fileUsernames.forEach(fileUser => {
      if (!databaseUsernames.has(fileUser)) {
        unmatchedHandles.push(fileUser);
      }
    });

    const responsePayload = {
      success: true,
      message: 'Attendance processed and marked successfully.',
      summary: {
        totalEligibleStudents: eligibleStudents.length,
        present,
        absent,
        unmatchedCount: unmatchedHandles.length,
        unmatchedHandles: unmatchedHandles.slice(0, 100)
      }
    };

    console.log(`[Upload API Log] Selected Contest ID: ${targetContestId}`);
    console.log(`[Upload API Log] API Request URL: ${req.originalUrl || '/api/attendance/upload'}`);
    console.log(`[Upload API Log] Student Count: ${eligibleStudents.length} eligible`);
    console.log(`[Upload API Log] Participant Count: ${present}`);
    console.log(`[Upload API Log] Matching Results: present=${present}, absent=${absent}, unmatched=${unmatchedHandles.length}`);
    console.log(`[Upload API Log] Unmatched Handles:`, unmatchedHandles);
    console.log(`[Upload API Log] API Response:`, JSON.stringify(responsePayload.summary));

    return res.json(responsePayload);
  } catch (error) {
    console.error('[Upload API Log] Error processing attendance upload:', error.stack || error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error processing file.', 
      error: process.env.NODE_ENV !== 'production' ? error.stack || error.message : undefined
    });
  }
}

// 2. Get attendance sheets/list for a specific contest
async function getContestAttendance(req, res) {
  const { contestId } = req.params;
  const { batch, department, section } = req.query;
  const cName = contestId;

  if (!cName) {
    return res.status(400).json({ success: false, message: 'Contest name/ID is required.' });
  }

  try {
    let sql = `
      SELECT u.id as student_id, u.roll_no as register_number, u.name, u.department, u.section, u.academic_batch as academic_year, u.leetcode_username,
             u.academic_start_date, u.academic_end_date,
             c.contest_id, c.title as contest_name, c.start_time as contest_date, c.slug as contest_slug, c.contest_status, c.duration,
             ar.attendance_status, ar.attendance_source, ar.last_updated, ar.remarks,
             (SELECT registration_time FROM Registrations r WHERE r.user_id = u.id AND r.contest_id = c.contest_id) as registration_time,
             (SELECT join_time FROM ParticipationLogs p WHERE p.user_id = u.id AND p.contest_id = c.contest_id) as join_time,
             IFNULL(lp.current_rating, 1500) as current_rating,
             (SELECT COUNT(*) FROM ParticipationLogs p WHERE p.user_id = u.id) as contests_attended
      FROM Users u
      CROSS JOIN Contests c
      LEFT JOIN AttendanceRecords ar ON u.id = ar.user_id AND c.contest_id = ar.contest_id
      LEFT JOIN LeetCodeProfiles lp ON u.id = lp.user_id
      WHERE (c.contest_id = ? OR c.slug = ?) AND u.status = 'active'
    `;
    const params = [cName, cName];
    if (batch) {
      sql += ` AND u.academic_batch = ?`;
      params.push(batch);
    }
    if (department) {
      sql += ` AND u.department = ?`;
      params.push(department);
    }
    if (section) {
      sql += ` AND u.section = ?`;
      params.push(section);
    }
    sql += ` ORDER BY u.roll_no ASC`;

    const list = await db.query(sql, params);
    const now = new Date();

    const hasRankingData = list.some(item => 
      (item.attendance_status === 'PRESENT' && item.attendance_source === 'AUTO') || item.join_time
    );

    const eligibleList = list.filter(item => {
      if (!item.academic_start_date || !item.academic_end_date) return false;
      const cDate = parseDateOnly(item.contest_date);
      const start = parseDateOnly(item.academic_start_date);
      const end = parseDateOnly(item.academic_end_date);
      end.setHours(23, 59, 59, 999);
      return cDate >= start && cDate <= end;
    });

    const formatted = eligibleList.map(item => {
      const cDateVal = new Date(item.contest_date);
      const durationMs = (item.duration || 5400) * 1000;
      const endTime = new Date(cDateVal.getTime() + durationMs);
      const isOngoing = cDateVal <= now && endTime > now;
      const isUnrated = item.contest_status && item.contest_status.toLowerCase() === 'unrated';
      const isRegistered = item.registration_time !== null;

      let status = 'absent';
      
      // Determine final status
      if (item.attendance_source === 'MANUAL' && item.attendance_status) {
        status = item.attendance_status.toLowerCase();
      } else {
        if (isUnrated) {
          status = isRegistered ? 'unrated contest' : 'absent';
        } else {
          const isPresent = item.attendance_status === 'PRESENT' || item.join_time !== null;
          if (isPresent) {
            status = 'present';
          } else {
            if (isOngoing || now < cDateVal) {
              status = 'contest in progress';
            } else if (!hasRankingData) {
              status = 'waiting for rankings';
            } else {
              status = 'absent';
            }
          }
        }
      }

      return {
        student_id: item.student_id,
        register_number: item.register_number,
        name: item.name,
        department: item.department,
        section: item.section,
        academic_year: item.academic_year,
        leetcode_username: item.leetcode_username,
        contest_date: item.contest_date,
        contest_slug: item.contest_slug,
        contest_status: item.contest_status,
        registration_time: item.registration_time,
        join_time: item.join_time,
        current_rating: item.current_rating,
        contests_attended: item.contests_attended,
        status: status,
        marked_by: item.attendance_source === 'MANUAL' ? 'faculty' : 'system',
        remarks: item.remarks,
        last_updated: item.last_updated,
        problems_solved: status === 'present' ? 4 : (status === 'unrated contest' ? 4 : 0),
        total_problems: 4
      };
    });

    const presentCount = formatted.filter(s => s.status === 'present' || s.status === 'unrated contest').length;

    console.log(`[Attendance API Log] Selected Contest ID: ${cName}`);
    console.log(`[Attendance API Log] API Request URL: ${req.originalUrl || '/api/attendance/contest'}`);
    console.log(`[Attendance API Log] Student Count: ${formatted.length} eligible`);
    console.log(`[Attendance API Log] Participant Count: ${presentCount}`);
    console.log(`[Attendance API Log] Matching Results: present/unrated=${presentCount}, absent=${formatted.length - presentCount}`);
    console.log(`[Attendance API Log] API Response: success=true, count=${formatted.length}`);

    return res.json({ success: true, count: formatted.length, data: formatted });
  } catch (error) {
    console.error('[Attendance API Log] Error fetching contest attendance:', error.stack || error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve attendance list.', 
      error: process.env.NODE_ENV !== 'production' ? error.stack || error.message : undefined 
    });
  }
}

// 3. Manual Attendance Override
async function overrideAttendance(req, res) {
  const { studentId, contestName, contestId, status, remarks } = req.body;
  const cName = contestName || contestId;

  if (!studentId || !cName || status === undefined) {
    return res.status(400).json({ success: false, message: 'Student ID, Contest Name/ID, and Status are required.' });
  }

  try {
    const studentCheck = await db.query("SELECT academic_start_date, academic_end_date FROM Users WHERE id = ?", [studentId]);
    if (studentCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const contestSlug = cName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dateResult = await db.query(
      "SELECT contest_id, start_time FROM Contests WHERE slug = ? LIMIT 1",
      [contestSlug]
    );
    
    let targetContestId;
    let cDate;

    if (dateResult.length > 0) {
      targetContestId = dateResult[0].contest_id;
      cDate = formatDate(dateResult[0].start_time);
    } else {
      cDate = new Date().toISOString().split('T')[0];
      const contestType = contestSlug.includes('biweekly') ? 'Biweekly' : 'Weekly';
      const match = contestSlug.match(/contest-(\d+)/);
      const contestNumber = match ? parseInt(match[1], 10) : 0;
      
      const insertResult = await db.query(`
        INSERT INTO Contests (title, slug, contest_type, contest_number, start_time, contest_status)
        VALUES (?, ?, ?, ?, ?, 'Rated')
      `, [cName, contestSlug, contestType, contestNumber, cDate]);
      targetContestId = insertResult.insertId;
    }

    const attendanceStatus = (status === 'present' || status === 1 || status === true) ? 'PRESENT' : 'ABSENT';

    // Ensure registered
    await db.query(
      "INSERT IGNORE INTO Registrations (user_id, contest_id) VALUES (?, ?)",
      [studentId, targetContestId]
    );

    if (attendanceStatus === 'PRESENT') {
      // Log participation
      await db.query(
        `INSERT INTO ParticipationLogs (user_id, contest_id, join_time, participation_status)
         VALUES (?, ?, CURRENT_TIMESTAMP, 'JOINED')
         ON DUPLICATE KEY UPDATE join_time = CURRENT_TIMESTAMP, participation_status = 'JOINED'`,
        [studentId, targetContestId]
      );
    } else {
      // Remove participation log
      await db.query(
        "DELETE FROM ParticipationLogs WHERE user_id = ? AND contest_id = ?",
        [studentId, targetContestId]
      );
    }

    // Insert or Update AttendanceRecords
    await db.query(
      `INSERT INTO AttendanceRecords (user_id, contest_id, attendance_status, attendance_source, remarks)
       VALUES (?, ?, ?, 'MANUAL', ?)
       ON DUPLICATE KEY UPDATE attendance_status = VALUES(attendance_status), attendance_source = 'MANUAL', remarks = VALUES(remarks)`,
      [studentId, targetContestId, attendanceStatus, remarks || null]
    );

    // Create notification
    await db.query(
      `INSERT INTO notifications (title, message, type, student_id)
       VALUES (?, ?, 'new_contest', ?)`,
      [
        `Attendance Overridden`,
        `Attendance for ${cName} has been manually marked as ${attendanceStatus.toLowerCase()}.`,
        studentId
      ]
    );

    const responsePayload = {
      success: true,
      message: `Successfully marked student as ${attendanceStatus.toLowerCase()}.`
    };

    console.log(`[Override API Log] Selected Contest ID: ${targetContestId}`);
    console.log(`[Override API Log] API Request URL: ${req.originalUrl || '/api/attendance/override'}`);
    console.log(`[Override API Log] Matching Results: manual override to ${attendanceStatus} for studentId ${studentId}`);
    console.log(`[Override API Log] Remarks: ${remarks}`);
    console.log(`[Override API Log] API Response:`, JSON.stringify(responsePayload));

    return res.json(responsePayload);
  } catch (error) {
    console.error('[Override API Log] Error overriding attendance:', error.stack || error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to save attendance override.',
      error: process.env.NODE_ENV !== 'production' ? error.stack || error.message : undefined
    });
  }
}

// 4. Get student-specific attendance history
async function getStudentAttendanceHistory(req, res) {
  const { studentId } = req.params;
  const { refresh } = req.query;

  try {
    const studentRows = await db.query(
      "SELECT id, name, roll_no, department, leetcode_username, academic_batch, academic_start_date, academic_end_date FROM Users WHERE id = ?",
      [studentId]
    );
    if (studentRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const student = studentRows[0];
    const { leetcode_username } = student;
    const startDate = parseDateOnly(student.academic_start_date);
    const endDate = parseDateOnly(student.academic_end_date);
    endDate.setHours(23, 59, 59, 999);

    // Fetch LeetCode Profile
    let profileRows = await db.query(
      "SELECT current_rating, highest_rating, global_ranking, problems_solved, contest_history FROM LeetCodeProfiles WHERE user_id = ?",
      [studentId]
    );
    let profile = profileRows.length > 0 ? profileRows[0] : null;
    let rawHistory = profile && profile.contest_history ? JSON.parse(profile.contest_history) : [];

    // Live refresh if requested or cache is empty
    if (refresh === 'true' || !profile || !profile.contest_history || rawHistory.length === 0) {
      console.log(`[Attendance API] Refreshing LeetCode history for ${leetcode_username}...`);
      try {
        const leetcodeData = await leetcode.getUserContestRankingAndHistory(leetcode_username);
        if (leetcodeData) {
          const history = leetcodeData.userContestRankingHistory || [];
          const ratings = history.map(h => h.rating).filter(r => r !== null && r !== undefined);
          const highestRating = ratings.length > 0 ? Math.max(...ratings) : 1500.00;
          const currentRating = leetcodeData.userContestRanking ? parseFloat(leetcodeData.userContestRanking.rating || 1500.00) : 1500.00;
          const globalRanking = leetcodeData.userContestRanking ? leetcodeData.userContestRanking.globalRanking : null;
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
          `, [studentId, currentRating, highestRating, globalRanking, problemsSolved, historyJson]);

          // Reload updated profile
          profileRows = await db.query(
            "SELECT current_rating, highest_rating, global_ranking, problems_solved, contest_history FROM LeetCodeProfiles WHERE user_id = ?",
            [studentId]
          );
          profile = profileRows.length > 0 ? profileRows[0] : null;
          rawHistory = history;
        }
      } catch (err) {
        console.error(`[Attendance API] LeetCode sync failed for ${leetcode_username}:`, err.message);
        // Fall back to cache if available
      }
    }

    const leetcodeRanking = profile ? {
      rating: parseFloat(profile.current_rating),
      globalRanking: profile.global_ranking,
      attendedContestsCount: rawHistory.length
    } : null;

    // Build map of attended contests
    const attendedTitles = new Set();
    rawHistory.forEach(h => {
      if (h.attended && h.contest && h.contest.title) {
        attendedTitles.add(h.contest.title.trim().toLowerCase());
      }
    });

    // Fetch contests from DB
    const history = await db.query(
      `SELECT c.contest_id, c.title as contest_name, c.slug as contest_slug, c.start_time as contest_date, c.contest_status, c.contest_type, c.duration,
              ar.attendance_status, ar.attendance_source,
              (SELECT COUNT(*) FROM Registrations r WHERE r.contest_id = c.contest_id AND r.user_id = ?) as is_registered,
              (SELECT COUNT(*) FROM ParticipationLogs p WHERE p.contest_id = c.contest_id AND p.user_id = ?) as is_joined
       FROM Contests c
       LEFT JOIN AttendanceRecords ar ON c.contest_id = ar.contest_id AND ar.user_id = ?
       ORDER BY c.start_time DESC`,
      [studentId, studentId, studentId]
    );

    const now = new Date();

    const formatted = history.map(item => {
      const contestDate = parseDateOnly(item.contest_date);
      const isEligible = contestDate >= startDate && contestDate <= endDate;
      
      const startTime = new Date(item.contest_date);
      const durationMs = (item.duration || 5400) * 1000;
      const endTime = new Date(startTime.getTime() + durationMs);
      
      const isOngoing = startTime <= now && endTime > now;
      const isUnrated = item.contest_status && item.contest_status.toLowerCase() === 'unrated';
      
      let hasAttended = false;
      if (item.attendance_source === 'MANUAL' && item.attendance_status) {
        hasAttended = item.attendance_status === 'PRESENT';
      } else {
        hasAttended = attendedTitles.has(item.contest_name.trim().toLowerCase()) || item.is_joined > 0;
      }
      
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

      // Extract performance data from history if present
      const lcMatch = rawHistory.find(h => h.contest && h.contest.title.trim().toLowerCase() === item.contest_name.trim().toLowerCase());
      const problems_solved = lcMatch ? lcMatch.problemsSolved : (attendanceStatus === 'PRESENT' ? 4 : 0);
      const total_problems = lcMatch ? lcMatch.totalProblems : 4;
      const global_rank = lcMatch ? lcMatch.ranking : null;
      const rating = lcMatch ? Math.round(lcMatch.rating) : null;
      const rating_change = (lcMatch && lcMatch.ratingChange) ? parseFloat(lcMatch.ratingChange) : 0;

      return {
        ...item,
        status: attendanceStatus === 'PRESENT' ? 'attended' : (attendanceStatus === 'ABSENT' ? 'not attended' : attendanceStatus.toLowerCase()),
        attendance_status: attendanceStatus,
        eligibility_status: isEligible ? 'Eligible' : 'Outside Academic Period',
        marked_by: item.attendance_source === 'MANUAL' ? 'faculty' : 'system',
        last_updated: null,
        global_rank,
        rating,
        rating_change,
        problems_solved,
        total_problems,
        is_registered: item.is_registered > 0 || attendanceStatus === 'PRESENT',
        is_joined: item.is_joined > 0 || attendanceStatus === 'PRESENT'
      };
    });

    const eligibleRecords = formatted.filter(item => item.eligibility_status === 'Eligible');
    const totalContests = eligibleRecords.length;
    
    const ratedEligibleRecords = eligibleRecords.filter(item => item.attendance_status === 'PRESENT' || item.attendance_status === 'ABSENT');
    const totalRated = ratedEligibleRecords.length;
    const present = ratedEligibleRecords.filter(item => item.attendance_status === 'PRESENT').length;
    const absent = ratedEligibleRecords.filter(item => item.attendance_status === 'ABSENT').length;
    
    const unrated = eligibleRecords.filter(item => item.attendance_status === 'UNRATED').length;
    const ongoing = eligibleRecords.filter(item => item.attendance_status === 'ONGOING').length;
    
    const attendancePercentage = totalRated > 0 ? parseFloat(((present / totalRated) * 100).toFixed(1)) : 100.0;

    const metrics = {
      totalContests,
      ratedContests: totalRated,
      unratedContests: unrated,
      ongoingContests: ongoing,
      present,
      absent,
      presentRated: present,
      presentUnrated: 0,
      attendancePercentage
    };

    return res.json({
      success: true,
      metrics,
      data: formatted,
      leetcodeHistory: rawHistory,
      leetcodeRanking: leetcodeRanking
    });
  } catch (error) {
    console.error('Error fetching student attendance history:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve attendance history.' });
  }
}

module.exports = {
  processContestUpload,
  getContestAttendance,
  overrideAttendance,
  getStudentAttendanceHistory
};
