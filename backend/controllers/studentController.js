const db = require('../config/db');
const { verifyLeetCodeUsername, getUserLeetCodeStats } = require('../utils/leetcode');
const xlsx = require('xlsx');
const { recalculateStudentSummary } = require('./attendanceController');

// 1. Get all students with search and filtering
async function getStudents(req, res) {
  const { search, department, section, academicBatch, status } = req.query;
  
  let sql = `
    SELECT u.id, u.name, u.roll_no, u.department, u.section, u.leetcode_username, 
           u.academic_batch, u.academic_start_date, u.academic_end_date, u.status, u.created_at,
           (SELECT COUNT(*) FROM Registrations r WHERE r.user_id = u.id) AS total_contests,
           (SELECT COUNT(*) FROM ParticipationLogs p WHERE p.user_id = u.id) AS attended_contests,
           (SELECT COUNT(*) FROM Registrations r WHERE r.user_id = u.id) - (SELECT COUNT(*) FROM ParticipationLogs p WHERE p.user_id = u.id) AS missed_contests,
           lp.highest_rating, lp.current_rating, lp.global_ranking AS highest_rank
    FROM Users u
    LEFT JOIN LeetCodeProfiles lp ON u.id = lp.user_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += ' AND u.status = ?';
    params.push(status);
  } else {
    sql += " AND u.status = 'active'"; // default to active
  }

  if (search) {
    sql += ' AND (u.name LIKE ? OR u.roll_no LIKE ? OR u.leetcode_username LIKE ?)';
    const searchParam = `%${search.trim()}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  if (department) {
    sql += ' AND u.department = ?';
    params.push(department);
  }

  if (section) {
    sql += ' AND u.section = ?';
    params.push(section);
  }

  if (academicBatch) {
    sql += ' AND u.academic_batch = ?';
    params.push(academicBatch);
  }

  sql += ' ORDER BY u.roll_no ASC';

  try {
    const students = await db.query(sql, params);
    const enriched = students.map(s => {
      const total = s.total_contests || 0;
      const attended = s.attended_contests || 0;
      return {
        ...s,
        attendance_percentage: total > 0 ? parseFloat(((attended / total) * 100).toFixed(2)) : 100.00
      };
    });
    return res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve students' });
  }
}

// Helper to format date for SQL
function formatDateForSql(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

// 2. Add single student
async function addStudent(req, res) {
  const { name, rollNo, department, section, leetcodeUsername, academicBatch, academicStartDate, academicEndDate } = req.body;

  if (!name || !rollNo || !department || !section || !leetcodeUsername || !academicBatch || !academicStartDate || !academicEndDate) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  if (section.trim() === '') {
    return res.status(400).json({ success: false, message: 'Section cannot be empty.' });
  }

  try {
    // Validate department exists and is active
    const deptCheck = await db.query(
      "SELECT id FROM departments WHERE code = ? AND status = 'active'",
      [department.trim().toUpperCase()]
    );
    if (!deptCheck || deptCheck.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Department '${department}' is either invalid or inactive. Please configure it in Department Management first.` 
      });
    }
    const trimmedRoll = rollNo.trim().toUpperCase();
    const trimmedLC = leetcodeUsername.trim();

    // Check duplicates in DB
    const checkRoll = await db.query('SELECT id FROM Users WHERE roll_no = ?', [trimmedRoll]);
    if (checkRoll && checkRoll.length > 0) {
      return res.status(400).json({ success: false, message: 'Roll number already exists.' });
    }

    const checkLC = await db.query('SELECT id FROM Users WHERE leetcode_username = ?', [trimmedLC]);
    if (checkLC && checkLC.length > 0) {
      return res.status(400).json({ success: false, message: 'LeetCode username already registered.' });
    }

    // LeetCode Handle Verification
    console.log(`Verifying LeetCode username: ${trimmedLC}`);
    const verifyResult = await verifyLeetCodeUsername(trimmedLC);
    if (!verifyResult.exists) {
      return res.status(400).json({ 
        success: false, 
        message: `LeetCode handle '${trimmedLC}' does not exist. Please check spelling.` 
      });
    }

    const sqlStartDate = formatDateForSql(academicStartDate);
    const sqlEndDate = formatDateForSql(academicEndDate);

    // Insert student
    const result = await db.query(
      `INSERT INTO Users (name, roll_no, department, section, leetcode_username, academic_batch, academic_start_date, academic_end_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [name.trim(), trimmedRoll, department.trim(), section.trim().toUpperCase(), verifyResult.username, academicBatch.trim(), sqlStartDate, sqlEndDate]
    );

    const newStudentId = result.insertId;

    // Seed empty LeetCodeProfiles record for the new student
    await db.query(
      `INSERT INTO LeetCodeProfiles (user_id, current_rating, highest_rating, global_ranking, problems_solved)
       VALUES (?, 1500.00, 1500.00, NULL, 0)`,
      [newStudentId]
    );

    return res.status(201).json({
      success: true,
      message: 'Student added successfully.',
      data: {
        id: newStudentId,
        name,
        rollNo: trimmedRoll,
        department,
        section,
        leetcodeUsername: verifyResult.username,
        academicBatch,
        academicStartDate: sqlStartDate,
        academicEndDate: sqlEndDate,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('Error adding student:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 3. Edit student
async function editStudent(req, res) {
  const { id } = req.params;
  const { name, rollNo, department, section, leetcodeUsername, academicBatch, academicStartDate, academicEndDate, status } = req.body;

  if (!name || !rollNo || !department || !section || !leetcodeUsername || !academicBatch || !academicStartDate || !academicEndDate) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  if (section.trim() === '') {
    return res.status(400).json({ success: false, message: 'Section cannot be empty.' });
  }

  try {
    // Validate department exists and is active
    const deptCheck = await db.query(
      "SELECT id FROM departments WHERE code = ? AND status = 'active'",
      [department.trim().toUpperCase()]
    );
    if (!deptCheck || deptCheck.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Department '${department}' is either invalid or inactive. Please configure it in Department Management first.` 
      });
    }
    // Check if student exists
    const currentStudent = await db.query('SELECT * FROM Users WHERE id = ?', [id]);
    if (!currentStudent || currentStudent.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const trimmedRoll = rollNo.trim().toUpperCase();
    const trimmedLC = leetcodeUsername.trim();

    // Check duplicate roll number
    const checkRoll = await db.query('SELECT id FROM Users WHERE roll_no = ? AND id != ?', [trimmedRoll, id]);
    if (checkRoll && checkRoll.length > 0) {
      return res.status(400).json({ success: false, message: 'Roll number already in use by another student.' });
    }

    // Check duplicate leetcode username
    const checkLC = await db.query('SELECT id FROM Users WHERE leetcode_username = ? AND id != ?', [trimmedLC, id]);
    if (checkLC && checkLC.length > 0) {
      return res.status(400).json({ success: false, message: 'LeetCode username already in use by another student.' });
    }

    let finalLCUsername = trimmedLC;

    // Re-verify LeetCode handle only if it changed
    if (currentStudent[0].leetcode_username.toLowerCase() !== trimmedLC.toLowerCase()) {
      console.log(`Re-verifying LeetCode username: ${trimmedLC}`);
      const verifyResult = await verifyLeetCodeUsername(trimmedLC);
      if (!verifyResult.exists) {
        return res.status(400).json({ 
          success: false, 
          message: `LeetCode handle '${trimmedLC}' does not exist.` 
        });
      }
      finalLCUsername = verifyResult.username;
    }

    const sqlStartDate = formatDateForSql(academicStartDate);
    const sqlEndDate = formatDateForSql(academicEndDate);

    // Update DB
    await db.query(
      `UPDATE Users 
       SET name = ?, roll_no = ?, department = ?, section = ?, leetcode_username = ?, 
           academic_batch = ?, academic_start_date = ?, academic_end_date = ?, status = ? 
       WHERE id = ?`,
      [name.trim(), trimmedRoll, department.trim(), section.trim().toUpperCase(), finalLCUsername, academicBatch.trim(), sqlStartDate, sqlEndDate, status || 'active', id]
    );

    return res.json({
      success: true,
      message: 'Student updated successfully.'
    });
  } catch (error) {
    console.error('Error updating student:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 4. Delete student
async function deleteStudent(req, res) {
  const { id } = req.params;

  try {
    const check = await db.query('SELECT id FROM Users WHERE id = ?', [id]);
    if (!check || check.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    await db.query('DELETE FROM Users WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (error) {
    console.error('Error deleting student:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 5. Bulk Import Students from Excel
async function bulkImportStudents(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload an Excel file.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty.' });
    }

    const imported = [];
    const duplicates = [];
    const invalidHandles = [];
    const errors = [];

    // Columns mapping helper: case-insensitive match
    const getVal = (row, fields) => {
      const key = Object.keys(row).find(k => fields.includes(k.toLowerCase().trim().replace(/[\s_-]/g, '')));
      return key ? String(row[key]).trim() : '';
    };

    // Parallel processing with chunks to avoid rate limits
    const chunkSize = 5;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      const promises = chunk.map(async (row, rowIndex) => {
        const globalRowIndex = i + rowIndex + 2; // 1-based, +1 for header
        const rollNo = getVal(row, ['rollno', 'rollnumber', 'regno', 'registernumber', 'register_number']);
        const name = getVal(row, ['studentname', 'name', 'fullname', 'username']);
        const dept = getVal(row, ['department', 'dept', 'branch']);
        const sec = getVal(row, ['section', 'sec', 'class']);
        const academicBatch = getVal(row, ['academicbatch', 'batch', 'academicyear', 'year']);
        const lcUsername = getVal(row, ['leetcodeusername', 'leetcode', 'leetcodehandle', 'handle']);
        
        let academicStartDate = getVal(row, ['academicstartdate', 'startdate', 'admissiondate']);
        let academicEndDate = getVal(row, ['academicenddate', 'enddate', 'graduationdate']);

        if (!rollNo || !name || !dept || !sec || !sec.trim() || !academicBatch || !lcUsername) {
          errors.push(`Row ${globalRowIndex}: Missing required fields (Roll No, Name, Dept, Section, Batch, LeetCode Username).`);
          return;
        }

        // Validate department is active
        const deptCheck = await db.query(
          "SELECT id FROM departments WHERE code = ? AND status = 'active'",
          [dept.trim().toUpperCase()]
        );
        if (!deptCheck || deptCheck.length === 0) {
          errors.push(`Row ${globalRowIndex}: Department '${dept}' is either invalid or inactive. Please configure it in Department Management first.`);
          return;
        }

        // Default date calculations if not provided in Excel
        if (!academicStartDate && academicBatch) {
          const years = academicBatch.split('-');
          if (years.length >= 1) {
            academicStartDate = `${years[0].trim()}-07-01`;
          }
        }
        if (!academicEndDate && academicBatch) {
          const years = academicBatch.split('-');
          if (years.length >= 2) {
            academicEndDate = `${years[1].trim()}-06-30`;
          }
        }

        if (!academicStartDate || !academicEndDate) {
          errors.push(`Row ${globalRowIndex}: Academic start/end dates could not be resolved.`);
          return;
        }

        const trimmedRoll = rollNo.toUpperCase();
        const trimmedLC = lcUsername.trim();

        // DB uniqueness checks
        const checkRoll = await db.query('SELECT id FROM Users WHERE roll_no = ?', [trimmedRoll]);
        if (checkRoll && checkRoll.length > 0) {
          duplicates.push(`Row ${globalRowIndex} (Roll No: ${trimmedRoll}): Roll number already exists.`);
          return;
        }

        const checkLC = await db.query('SELECT id FROM Users WHERE leetcode_username = ?', [trimmedLC]);
        if (checkLC && checkLC.length > 0) {
          duplicates.push(`Row ${globalRowIndex} (LeetCode: ${trimmedLC}): LeetCode username already registered.`);
          return;
        }

        // LeetCode verification
        const verifyResult = await verifyLeetCodeUsername(trimmedLC);
        if (!verifyResult.exists) {
          invalidHandles.push(`Row ${globalRowIndex} (LeetCode: ${trimmedLC}): Account does not exist on LeetCode.`);
          return;
        }

        const sqlStartDate = formatDateForSql(academicStartDate);
        const sqlEndDate = formatDateForSql(academicEndDate);

        try {
          // Insert Student
          const result = await db.query(
            `INSERT INTO Users (name, roll_no, department, section, leetcode_username, academic_batch, academic_start_date, academic_end_date, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [name, trimmedRoll, dept, sec.toUpperCase(), verifyResult.username, academicBatch, sqlStartDate, sqlEndDate]
          );

          const newStudentId = result.insertId;

          // Seed empty LeetCodeProfiles record
          await db.query(
            `INSERT INTO LeetCodeProfiles (user_id, current_rating, highest_rating, global_ranking, problems_solved)
             VALUES (?, 1500.00, 1500.00, NULL, 0)`,
            [newStudentId]
          );

          imported.push({ rollNo: trimmedRoll, name, leetcodeUsername: verifyResult.username });
        } catch (dbErr) {
          errors.push(`Row ${globalRowIndex}: DB insertion failed - ${dbErr.message}`);
        }
      });

      await Promise.all(promises);
      // Wait to avoid rate limits
      await sleep(1000);
    }

    return res.json({
      success: true,
      message: `Processed ${data.length} rows. Imported: ${imported.length}, Duplicates: ${duplicates.length}, Invalid Handles: ${invalidHandles.length}, Errors: ${errors.length}`,
      details: {
        importedCount: imported.length,
        duplicates,
        invalidHandles,
        errors
      }
    });
  } catch (error) {
    console.error('Error processing bulk upload:', error);
    return res.status(500).json({ success: false, message: 'Internal server error processing file.' });
  }
}

// 6. Batch Graduated Archive Students
async function archiveStudents(req, res) {
  const { department, academicBatch, academicYear, section } = req.body;
  const batch = academicBatch || academicYear;

  if (!department || !batch) {
    return res.status(400).json({ success: false, message: 'Department and Academic Batch are required.' });
  }

  try {
    // Find matching active students
    let sql = "SELECT id FROM Users WHERE department = ? AND academic_batch = ? AND status = 'active'";
    const params = [department, batch];
    if (section) {
      sql += " AND section = ?";
      params.push(section);
    }
    const studentsToArchive = await db.query(sql, params);

    if (studentsToArchive.length === 0) {
      return res.status(404).json({ success: false, message: 'No active students found matching the filters.' });
    }

    const studentIds = studentsToArchive.map(s => s.id);
    
    // Batch Update Status to graduated
    await db.query(
      "UPDATE Users SET status = 'graduated' WHERE id IN (" + studentIds.join(',') + ")"
    );

    return res.json({
      success: true,
      message: `Successfully marked ${studentIds.length} students as graduated.`
    });
  } catch (error) {
    console.error('Error archiving students:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 7. Restore Graduated Student Records to Active (Supports Batch or Individual)
async function restoreStudents(req, res) {
  const { studentId, department, academicBatch, academicYear } = req.body;

  try {
    if (studentId) {
      await db.query(
        "UPDATE Users SET status = 'active' WHERE id = ? AND status = 'graduated'",
        [studentId]
      );
      return res.json({
        success: true,
        message: 'Successfully restored student to active state.'
      });
    }

    const batch = academicBatch || academicYear;
    if (!department || !batch) {
      return res.status(400).json({ success: false, message: 'Department and Academic Batch (or Student ID) are required.' });
    }

    let sql = "SELECT id FROM Users WHERE department = ? AND academic_batch = ? AND status = 'graduated'";
    const params = [department, batch];
    if (section) {
      sql += " AND section = ?";
      params.push(section);
    }
    const studentsToRestore = await db.query(sql, params);

    if (studentsToRestore.length === 0) {
      return res.status(404).json({ success: false, message: 'No graduated students found matching the filters.' });
    }

    const studentIds = studentsToRestore.map(s => s.id);

    // Batch Update Status to active
    await db.query(
      "UPDATE Users SET status = 'active' WHERE id IN (" + studentIds.join(',') + ")"
    );

    return res.json({
      success: true,
      message: `Successfully restored ${studentIds.length} students to active state.`
    });
  } catch (error) {
    console.error('Error restoring students:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 8. Get archived summary (list of graduated batches)
async function getArchivedSummary(req, res) {
  try {
    const summary = await db.query(
      `SELECT department, academic_batch, section, COUNT(id) as student_count
       FROM Users 
       WHERE status = 'graduated'
       GROUP BY department, academic_batch, section`
    );
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching archived summary:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve graduation history.' });
  }
}

// Check Username Helper
async function checkUsername(req, res) {
  const { username } = req.params;
  try {
    const result = await verifyLeetCodeUsername(username);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ exists: false, error: err.message });
  }
}

// Get LeetCode Stats By Student ID
async function getLeetCodeStatsById(req, res) {
  const { id } = req.params;
  try {
    // 1. Fetch student info to get username
    const student = await db.query(
      "SELECT leetcode_username FROM Users WHERE id = ?",
      [id]
    );

    if (!student || student.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const { leetcode_username } = student[0];
    
    // 2. Query LeetCode stats GraphQL
    const stats = await getUserLeetCodeStats(leetcode_username);
    if (!stats.success) {
      return res.status(404).json({ success: false, message: stats.error || 'Failed to fetch LeetCode statistics.' });
    }

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching LeetCode stats:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// Get all unique academic batches from Users table
async function getUniqueBatches(req, res) {
  try {
    const list = await db.query(
      "SELECT DISTINCT academic_batch FROM Users WHERE academic_batch IS NOT NULL AND academic_batch != '' ORDER BY academic_batch DESC"
    );
    const batches = list.map(item => item.academic_batch);
    return res.json({ success: true, data: batches });
  } catch (error) {
    console.error('Error fetching unique batches:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve academic batches.' });
  }
}

// Get all unique sections from Users table with optional filters
async function getUniqueSections(req, res) {
  const { department, academicBatch, status } = req.query;
  let sql = "SELECT DISTINCT section FROM Users WHERE section IS NOT NULL AND section != ''";
  const params = [];
  
  if (department) {
    sql += " AND department = ?";
    params.push(department);
  }
  if (academicBatch) {
    sql += " AND academic_batch = ?";
    params.push(academicBatch);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  
  sql += " ORDER BY section ASC";
  
  try {
    const list = await db.query(sql, params);
    const sections = list.map(item => item.section);
    return res.json({ success: true, data: sections });
  } catch (error) {
    console.error('Error fetching unique sections:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve sections.' });
  }
}

module.exports = {
  getStudents,
  addStudent,
  editStudent,
  deleteStudent,
  bulkImportStudents,
  archiveStudents,
  restoreStudents,
  getArchivedSummary,
  checkUsername,
  getLeetCodeStatsById,
  getUniqueBatches,
  getUniqueSections
};

