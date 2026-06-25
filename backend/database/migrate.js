const db = require('../config/db');

async function run() {
  try {
    await db.initializeDatabase();
    
    // 1. Create Schema_Migrations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Schema_Migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Create Attendance_Migration_Issues Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Attendance_Migration_Issues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_type VARCHAR(255) NOT NULL,
        table_name VARCHAR(255) NOT NULL,
        record_identifier VARCHAR(255) NOT NULL,
        details TEXT,
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Create Migration_Health Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Migration_Health (
        migration_name VARCHAR(255) PRIMARY KEY,
        status ENUM('HEALTHY','WARNING','FAILED') NOT NULL DEFAULT 'HEALTHY',
        issues_detected INT DEFAULT 0,
        last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 2. Check if already executed and healthy
    const rows = await db.query(
      "SELECT 1 FROM Schema_Migrations WHERE migration_name = 'robust_unrated_contest_support'"
    );
    let isHealthy = false;
    try {
      const healthRow = await db.query(
        "SELECT status FROM Migration_Health WHERE migration_name = 'robust_unrated_contest_support'"
      );
      if (healthRow.length > 0 && healthRow[0].status === 'HEALTHY') {
        isHealthy = true;
      }
    } catch (err) {
      // Might not exist yet on first run
    }

    let runFirstMigration = true;
    if (rows.length > 0) {
      console.log('[Migration] Migration "robust_unrated_contest_support" is already executed. Skipping.');
      runFirstMigration = false;
    }

    if (runFirstMigration) {
      console.log('[Migration] Executing migration "robust_unrated_contest_support"...');

    // 3. Create Contests Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Contests (
        contest_slug VARCHAR(255) PRIMARY KEY,
        contest_name VARCHAR(255),
        contest_date DATETIME,
        contest_status ENUM('RATED','UNRATED','CANCELLED'),
        source VARCHAR(50) DEFAULT 'ENTRANTHUB',
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_contest_date (contest_date),
        INDEX idx_contest_status (contest_status)
      ) ENGINE=InnoDB;
    `);

    // Ensure source and last_synced_at exist in Contests (for upgrades)
    const contestColumns = await db.query("SHOW COLUMNS FROM Contests");
    const contestColNames = contestColumns.map(c => c.Field);
    if (!contestColNames.includes('source')) {
      console.log('[Migration] Adding source to Contests...');
      await db.query("ALTER TABLE Contests ADD COLUMN source VARCHAR(50) DEFAULT 'ENTRANTHUB' AFTER contest_status;");
    }
    if (!contestColNames.includes('last_synced_at')) {
      console.log('[Migration] Adding last_synced_at to Contests...');
      await db.query("ALTER TABLE Contests ADD COLUMN last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER source;");
    }

    // 4. Create Contest_Participants Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Contest_Participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contest_slug VARCHAR(255),
        leetcode_username VARCHAR(255),
        contest_rank INT,
        contest_score DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_participant (contest_slug, leetcode_username),
        INDEX idx_participant_username (leetcode_username),
        INDEX idx_participant_contest (contest_slug)
      ) ENGINE=InnoDB;
    `);

    // 5. Add columns to Contest_Attendance
    const columns = await db.query("SHOW COLUMNS FROM Contest_Attendance");
    const colNames = columns.map(c => c.Field);

    if (!colNames.includes('contest_slug')) {
      console.log('[Migration] Adding contest_slug to Contest_Attendance...');
      await db.query("ALTER TABLE Contest_Attendance ADD COLUMN contest_slug VARCHAR(255) AFTER contest_name;");
    }
    if (!colNames.includes('contest_status')) {
      console.log('[Migration] Adding contest_status to Contest_Attendance...');
      await db.query("ALTER TABLE Contest_Attendance ADD COLUMN contest_status ENUM('RATED','UNRATED','CANCELLED') DEFAULT 'RATED' AFTER contest_date;");
    }
    if (!colNames.includes('attendance_status')) {
      console.log('[Migration] Adding attendance_status to Contest_Attendance...');
      await db.query("ALTER TABLE Contest_Attendance ADD COLUMN attendance_status ENUM('PRESENT','ABSENT','NOT_APPLICABLE') DEFAULT 'ABSENT' AFTER contest_status;");
    }
    if (!colNames.includes('attendance_source')) {
      console.log('[Migration] Adding attendance_source to Contest_Attendance...');
      await db.query("ALTER TABLE Contest_Attendance ADD COLUMN attendance_source ENUM('AUTO','MANUAL') DEFAULT 'AUTO' AFTER attendance_status;");
    }
    if (!colNames.includes('participation_verified')) {
      console.log('[Migration] Adding participation_verified to Contest_Attendance...');
      await db.query("ALTER TABLE Contest_Attendance ADD COLUMN participation_verified BOOLEAN DEFAULT FALSE AFTER attendance_source;");
    }
    if (!colNames.includes('verification_method')) {
      console.log('[Migration] Adding verification_method to Contest_Attendance...');
      await db.query("ALTER TABLE Contest_Attendance ADD COLUMN verification_method ENUM('RATING_HISTORY','PARTICIPANT_CACHE','RANKING_API','MANUAL') AFTER participation_verified;");
    }
    if (!colNames.includes('score')) {
      console.log('[Migration] Adding score to Contest_Attendance...');
      await db.query("ALTER TABLE Contest_Attendance ADD COLUMN score DECIMAL(10,2) DEFAULT NULL AFTER `rank`;");
    }

    // Add indexes to Contest_Attendance
    try {
      await db.query("ALTER TABLE Contest_Attendance ADD INDEX idx_student_contest_slug (student_id, contest_slug);");
    } catch (err) {
      // Index might already exist
    }
    try {
      await db.query("ALTER TABLE Contest_Attendance ADD INDEX idx_attendance_status (attendance_status);");
    } catch (err) {
      // Index might already exist
    }
    try {
      await db.query("ALTER TABLE Contest_Attendance ADD INDEX idx_contest_status (contest_status);");
    } catch (err) {
      // Index might already exist
    }

    // 6. Add columns and indexes to Contest_Summary
    const summaryCols = await db.query("SHOW COLUMNS FROM Contest_Summary");
    const summaryColNames = summaryCols.map(c => c.Field);

    if (!summaryColNames.includes('rated_contests')) {
      console.log('[Migration] Adding rated_contests to Contest_Summary...');
      await db.query("ALTER TABLE Contest_Summary ADD COLUMN rated_contests INT DEFAULT 0 AFTER total_contests;");
    }
    if (!summaryColNames.includes('unrated_contests')) {
      console.log('[Migration] Adding unrated_contests to Contest_Summary...');
      await db.query("ALTER TABLE Contest_Summary ADD COLUMN unrated_contests INT DEFAULT 0 AFTER rated_contests;");
    }

    try {
      await db.query("ALTER TABLE Contest_Summary ADD INDEX idx_student_summary (student_id);");
    } catch (err) {
      // Index might already exist
    }

    // 7. Backfill data
    console.log('[Migration] Backfilling data for historical records...');

    // Update contest_slug based on contest_name (convert spaces to dashes and lowercase, clean non-alphanumeric except dashes)
    await db.query(`
      UPDATE Contest_Attendance 
      SET contest_slug = LOWER(REGEXP_REPLACE(REPLACE(contest_name, ' ', '-'), '[^a-zA-Z0-9-]', ''))
      WHERE contest_slug IS NULL OR contest_slug = '';
    `);

    // Populate Contests table
    await db.query(`
      INSERT IGNORE INTO Contests (contest_slug, contest_name, contest_date, contest_status, source, last_synced_at)
      SELECT DISTINCT contest_slug, contest_name, contest_date, 'RATED', 'ENTRANTHUB', CURRENT_TIMESTAMP
      FROM Contest_Attendance
      WHERE contest_slug IS NOT NULL AND contest_slug != '';
    `);

    // Populate Contest_Participants table from Contest_Attendance where participated = 1
    await db.query(`
      INSERT IGNORE INTO Contest_Participants (contest_slug, leetcode_username, contest_rank)
      SELECT DISTINCT ca.contest_slug, s.leetcode_username, ca.rank
      FROM Contest_Attendance ca
      JOIN students s ON ca.student_id = s.id
      WHERE ca.participated = 1 AND ca.contest_slug IS NOT NULL AND ca.contest_slug != '';
    `);

    // Set attendance_status based on participated
    await db.query(`
      UPDATE Contest_Attendance
      SET 
        attendance_status = CASE WHEN participated = 1 THEN 'PRESENT' ELSE 'ABSENT' END,
        participation_verified = CASE WHEN participated = 1 THEN TRUE ELSE FALSE END,
        verification_method = CASE WHEN participated = 1 THEN 'RATING_HISTORY' ELSE NULL END
      WHERE (attendance_status = 'ABSENT' OR attendance_status IS NULL) AND participated = 1;
    `);

    // Populate rated_contests and unrated_contests in Contest_Summary
    await db.query(`
      UPDATE Contest_Summary cs
      SET 
        rated_contests = total_contests,
        unrated_contests = 0
      WHERE (rated_contests = 0 OR rated_contests IS NULL) AND total_contests > 0;
    `);

    // Drop old unique constraint on Contest_Attendance if it exists
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP INDEX unique_student_contest;");
    } catch (err) {
      // Ignore if doesn't exist
    }

    // Create new unique constraint
    try {
      await db.query("ALTER TABLE Contest_Attendance ADD UNIQUE KEY unique_student_contest_slug (student_id, contest_slug);");
    } catch (err) {
      // Ignore if duplicate index
    }

    // 7.5. Clean up and add foreign key constraints for Database Integrity
    console.log('[Migration] Verifying data integrity before applying foreign keys...');

    // A. Detect orphans
    const orphanParticipants = await db.query(`
      SELECT id, contest_slug, leetcode_username 
      FROM Contest_Participants 
      WHERE contest_slug IS NULL OR contest_slug = '' OR contest_slug NOT IN (SELECT contest_slug FROM Contests)
    `);

    const orphanAttendanceContest = await db.query(`
      SELECT id, student_id, contest_slug, contest_name 
      FROM Contest_Attendance 
      WHERE contest_slug IS NULL OR contest_slug = '' OR contest_slug NOT IN (SELECT contest_slug FROM Contests)
    `);

    const orphanAttendanceStudent = await db.query(`
      SELECT id, student_id, contest_slug, contest_name 
      FROM Contest_Attendance 
      WHERE student_id NOT IN (SELECT id FROM students)
    `);

    let issuesCount = 0;
    const issuesList = [];

    // Quarantine Contest_Participants orphans
    for (const row of orphanParticipants) {
      issuesCount++;
      const identifier = `id=${row.id}, contest_slug=${row.contest_slug}, user=${row.leetcode_username}`;
      const details = `Participant cache entry references missing contest_slug: '${row.contest_slug}'`;
      issuesList.push({
        issue_type: 'ORPHAN_PARTICIPANT_CONTEST',
        table_name: 'Contest_Participants',
        record_identifier: identifier,
        details
      });
    }

    // Quarantine Contest_Attendance contest orphans
    for (const row of orphanAttendanceContest) {
      issuesCount++;
      const identifier = `id=${row.id}, student_id=${row.student_id}, contest_slug=${row.contest_slug}`;
      const details = `Attendance record references missing contest_slug: '${row.contest_slug}' (contest_name: '${row.contest_name}')`;
      issuesList.push({
        issue_type: 'ORPHAN_ATTENDANCE_CONTEST',
        table_name: 'Contest_Attendance',
        record_identifier: identifier,
        details
      });
    }

    // Quarantine Contest_Attendance student orphans
    for (const row of orphanAttendanceStudent) {
      issuesCount++;
      const identifier = `id=${row.id}, student_id=${row.student_id}`;
      const details = `Attendance record references missing student_id: '${row.student_id}' (contest_name: '${row.contest_name}')`;
      issuesList.push({
        issue_type: 'ORPHAN_ATTENDANCE_STUDENT',
        table_name: 'Contest_Attendance',
        record_identifier: identifier,
        details
      });
    }

    // Insert detected issues into Attendance_Migration_Issues (prevent duplicates using record_identifier)
    for (const issue of issuesList) {
      const existing = await db.query(
        "SELECT 1 FROM Attendance_Migration_Issues WHERE record_identifier = ? AND issue_type = ?",
        [issue.record_identifier, issue.issue_type]
      );
      if (existing.length === 0) {
        await db.query(`
          INSERT INTO Attendance_Migration_Issues (issue_type, table_name, record_identifier, details)
          VALUES (?, ?, ?, ?)
        `, [issue.issue_type, issue.table_name, issue.record_identifier, issue.details]);
      }
      console.warn(`[Quarantine] Issue detected: [${issue.table_name}] ${issue.details}`);
    }

    // Initialize or Reset Migration Health Record
    await db.query(`
      INSERT INTO Migration_Health (migration_name, status, issues_detected)
      VALUES ('robust_unrated_contest_support', 'HEALTHY', ?)
      ON DUPLICATE KEY UPDATE status = 'HEALTHY', issues_detected = ?;
    `, [issuesCount, issuesCount]);

    // Let's compute report summary values
    const [totalParticipantsCountResult] = await db.query("SELECT COUNT(*) as count FROM Contest_Participants");
    const [totalAttendanceCountResult] = await db.query("SELECT COUNT(*) as count FROM Contest_Attendance");
    const totalProcessed = (totalParticipantsCountResult ? totalParticipantsCountResult.count : 0) + 
                             (totalAttendanceCountResult ? totalAttendanceCountResult.count : 0);
    const totalIssues = issuesCount;
    const totalSkipped = issuesCount; 
    const totalMigrated = totalProcessed - totalSkipped;

    console.log('[Migration] Attempting to apply foreign key constraints for Database Integrity...');

    // 1. Add fk_participant_contest to Contest_Participants
    try {
      await db.query(`
        ALTER TABLE Contest_Participants
        ADD CONSTRAINT fk_participant_contest
        FOREIGN KEY (contest_slug)
        REFERENCES Contests(contest_slug)
        ON DELETE CASCADE;
      `);
      console.log('[Migration] Successfully created constraint fk_participant_contest.');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate') || err.message.includes('already exists')) {
        console.log('[Migration] Constraint fk_participant_contest already exists.');
      } else {
        console.warn('[Migration] WARNING: Cannot apply fk_participant_contest constraint due to orphan data or other issue:', err.message);
        await db.query(`
          UPDATE Migration_Health 
          SET status = 'WARNING'
          WHERE migration_name = 'robust_unrated_contest_support'
        `);
      }
    }

    // 2. Add fk_attendance_contest to Contest_Attendance
    try {
      await db.query(`
        ALTER TABLE Contest_Attendance
        ADD CONSTRAINT fk_attendance_contest
        FOREIGN KEY (contest_slug)
        REFERENCES Contests(contest_slug)
        ON DELETE CASCADE;
      `);
      console.log('[Migration] Successfully created constraint fk_attendance_contest.');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate') || err.message.includes('already exists')) {
        console.log('[Migration] Constraint fk_attendance_contest already exists.');
      } else {
        console.warn('[Migration] WARNING: Cannot apply fk_attendance_contest constraint due to orphan data or other issue:', err.message);
        await db.query(`
          UPDATE Migration_Health 
          SET status = 'WARNING'
          WHERE migration_name = 'robust_unrated_contest_support'
        `);
      }
    }

    // 3. Replace old anonymous constraint on student_id with fk_attendance_student
    try {
      const constraints = await db.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'Contest_Attendance' 
          AND COLUMN_NAME = 'student_id' 
          AND REFERENCED_TABLE_NAME = 'students';
      `);

      for (const row of constraints) {
        if (row.CONSTRAINT_NAME !== 'fk_attendance_student') {
          console.log(`[Migration] Dropping existing constraint: ${row.CONSTRAINT_NAME}`);
          await db.query(`ALTER TABLE Contest_Attendance DROP FOREIGN KEY ${row.CONSTRAINT_NAME};`);
        }
      }
    } catch (err) {
      console.warn('[Migration] Warning dropping old student constraint:', err.message);
    }

    try {
      await db.query(`
        ALTER TABLE Contest_Attendance
        ADD CONSTRAINT fk_attendance_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE;
      `);
      console.log('[Migration] Successfully created constraint fk_attendance_student.');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate') || err.message.includes('already exists')) {
        console.log('[Migration] Constraint fk_attendance_student already exists.');
      } else {
        console.warn('[Migration] WARNING: Cannot apply fk_attendance_student constraint due to orphan data or other issue:', err.message);
        await db.query(`
          UPDATE Migration_Health 
          SET status = 'WARNING'
          WHERE migration_name = 'robust_unrated_contest_support'
        `);
      }
    }

    // Determine final status
    const [finalHealth] = await db.query(
      "SELECT status, issues_detected FROM Migration_Health WHERE migration_name = 'robust_unrated_contest_support'"
    );
    const finalStatus = finalHealth ? finalHealth.status : 'HEALTHY';
    const finalIssuesDetected = finalHealth ? finalHealth.issues_detected : 0;

    // Report Summary
    console.log('======================================================================');
    console.log('                      MIGRATION REPORT SUMMARY                        ');
    console.log('======================================================================');
    console.log(`Total Records Processed : ${totalProcessed}`);
    console.log(`Total Records Migrated  : ${totalMigrated}`);
    console.log(`Total Records Skipped   : ${totalSkipped}`);
    console.log(`Total Issues Detected   : ${totalIssues}`);
    console.log(`Migration Health Status : ${finalStatus} (${finalIssuesDetected} active issues)`);
    console.log('======================================================================');

    // 8. Record migration success in Schema_Migrations
    await db.query(`
      INSERT INTO Schema_Migrations (migration_name) 
      VALUES ('robust_unrated_contest_support')
      ON DUPLICATE KEY UPDATE executed_at = CURRENT_TIMESTAMP;
    `);

      console.log('[Migration] Migration "robust_unrated_contest_support" completed.');
    }

    // ==========================================
    // MIGRATION 2: attendance_verification_reliability
    // ==========================================
    const rows2 = await db.query(
      "SELECT 1 FROM Schema_Migrations WHERE migration_name = 'attendance_verification_reliability'"
    );
    
    if (rows2.length > 0) {
      console.log('[Migration] Migration "attendance_verification_reliability" is already executed. Skipping.');
    } else {
      console.log('[Migration] Executing migration "attendance_verification_reliability"...');
      
      // Alter ENUM of attendance_status
      console.log('[Migration] Modifying attendance_status ENUM...');
      await db.query(`
        ALTER TABLE Contest_Attendance 
        MODIFY COLUMN attendance_status ENUM('PRESENT', 'PRESENT_HISTORY', 'PRESENT_ENTRAHUB', 'PROBABLY_PRESENT', 'ABSENT', 'UNRATED_CONTEST', 'NOT_APPLICABLE') DEFAULT 'ABSENT'
      `);

      // Add new columns to Contest_Attendance
      const columns = await db.query("SHOW COLUMNS FROM Contest_Attendance");
      const colNames = columns.map(c => c.Field);
      
      if (!colNames.includes('confidence_score')) {
        console.log('[Migration] Adding confidence_score to Contest_Attendance...');
        await db.query("ALTER TABLE Contest_Attendance ADD COLUMN confidence_score INT DEFAULT 0 AFTER verification_source;");
      }
      if (!colNames.includes('evidence_history_found')) {
        console.log('[Migration] Adding evidence_history_found to Contest_Attendance...');
        await db.query("ALTER TABLE Contest_Attendance ADD COLUMN evidence_history_found BOOLEAN DEFAULT FALSE AFTER confidence_score;");
      }
      if (!colNames.includes('evidence_ranking_found')) {
        console.log('[Migration] Adding evidence_ranking_found to Contest_Attendance...');
        await db.query("ALTER TABLE Contest_Attendance ADD COLUMN evidence_ranking_found BOOLEAN DEFAULT FALSE AFTER evidence_history_found;");
      }
      if (!colNames.includes('evidence_submissions_found')) {
        console.log('[Migration] Adding evidence_submissions_found to Contest_Attendance...');
        await db.query("ALTER TABLE Contest_Attendance ADD COLUMN evidence_submissions_found BOOLEAN DEFAULT FALSE AFTER evidence_ranking_found;");
      }
      if (!colNames.includes('evidence_rating_updated')) {
        console.log('[Migration] Adding evidence_rating_updated to Contest_Attendance...');
        await db.query("ALTER TABLE Contest_Attendance ADD COLUMN evidence_rating_updated BOOLEAN DEFAULT FALSE AFTER evidence_submissions_found;");
      }
      if (!colNames.includes('evidence_entrahub_verified')) {
        console.log('[Migration] Adding evidence_entrahub_verified to Contest_Attendance...');
        await db.query("ALTER TABLE Contest_Attendance ADD COLUMN evidence_entrahub_verified BOOLEAN DEFAULT FALSE AFTER evidence_rating_updated;");
      }

      // Record migration execution
      await db.query(`
        INSERT INTO Schema_Migrations (migration_name) 
        VALUES ('attendance_verification_reliability')
        ON DUPLICATE KEY UPDATE executed_at = CURRENT_TIMESTAMP;
      `);
      console.log('[Migration] Migration "attendance_verification_reliability" completed.');
    }

    // ==========================================
    // MIGRATION 3: enthrahub_platform_transition
    // ==========================================
    const rows3 = await db.query(
      "SELECT 1 FROM Schema_Migrations WHERE migration_name = 'enthrahub_platform_transition'"
    );

    if (rows3.length > 0) {
      console.log('[Migration] Migration "enthrahub_platform_transition" is already executed. Skipping.');
    } else {
      console.log('[Migration] Executing migration "enthrahub_platform_transition"...');

      // 1. Get current tables
      const tables = await db.query("SHOW TABLES");
      const tableNames = tables.map(t => Object.values(t)[0].toLowerCase());

      // 2. Rename students to Users
      if (tableNames.includes('students') && !tableNames.includes('users')) {
        console.log('[Migration] Renaming table students to Users...');
        await db.query("RENAME TABLE students TO Users");
      }

      // 3. Create Registrations table
      console.log('[Migration] Creating table Registrations...');
      await db.query(`
        CREATE TABLE IF NOT EXISTS Registrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          contest_id INT NOT NULL,
          registration_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_contest_reg (user_id, contest_id)
        ) ENGINE=InnoDB;
      `);

      // 4. Create ParticipationLogs table
      console.log('[Migration] Creating table ParticipationLogs...');
      await db.query(`
        CREATE TABLE IF NOT EXISTS ParticipationLogs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          contest_id INT NOT NULL,
          join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          participation_status VARCHAR(50) DEFAULT 'JOINED',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_contest_part (user_id, contest_id)
        ) ENGINE=InnoDB;
      `);

      // 5. Rename Contest_Attendance to AttendanceRecords
      if (tableNames.includes('contest_attendance') && !tableNames.includes('attendancerecords')) {
        console.log('[Migration] Renaming Contest_Attendance to AttendanceRecords...');
        await db.query("RENAME TABLE Contest_Attendance TO AttendanceRecords");
      }

      // 6. Rename student_id to user_id in AttendanceRecords
      const attColumns = await db.query("SHOW COLUMNS FROM AttendanceRecords");
      const attColNames = attColumns.map(c => c.Field.toLowerCase());
      if (attColNames.includes('student_id') && !attColNames.includes('user_id')) {
        console.log('[Migration] Renaming student_id to user_id in AttendanceRecords...');
        await db.query("ALTER TABLE AttendanceRecords CHANGE COLUMN student_id user_id INT NOT NULL");
      }

      // 7. Add contest_id to AttendanceRecords
      if (!attColNames.includes('contest_id')) {
        console.log('[Migration] Adding contest_id to AttendanceRecords...');
        await db.query("ALTER TABLE AttendanceRecords ADD COLUMN contest_id INT NULL AFTER user_id");
      }

      // 8. Populate contest_id based on contest_slug
      console.log('[Migration] Mapping contest_slug to contest_id in AttendanceRecords...');
      await db.query(`
        UPDATE AttendanceRecords ar
        JOIN Contests c ON ar.contest_slug = c.slug
        SET ar.contest_id = c.contest_id
        WHERE ar.contest_id IS NULL;
      `);

      // Delete any record that couldn't be matched (to prevent NULL key errors)
      await db.query("DELETE FROM AttendanceRecords WHERE contest_id IS NULL");
      await db.query("ALTER TABLE AttendanceRecords MODIFY COLUMN contest_id INT NOT NULL");

      // 9. Create LeetCodeProfiles table
      console.log('[Migration] Creating table LeetCodeProfiles...');
      await db.query(`
        CREATE TABLE IF NOT EXISTS LeetCodeProfiles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE,
          current_rating DECIMAL(8,2) DEFAULT 1500.00,
          highest_rating DECIMAL(8,2) DEFAULT 1500.00,
          global_ranking INT DEFAULT NULL,
          problems_solved INT DEFAULT 0,
          contest_history LONGTEXT DEFAULT NULL,
          last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
      `);

      // 10. Migrate data to new tables
      console.log('[Migration] Backfilling data to Registrations...');
      await db.query(`
        INSERT IGNORE INTO Registrations (user_id, contest_id, registration_time)
        SELECT user_id, contest_id, CURRENT_TIMESTAMP FROM AttendanceRecords;
      `);

      console.log('[Migration] Backfilling data to ParticipationLogs...');
      await db.query(`
        INSERT IGNORE INTO ParticipationLogs (user_id, contest_id, join_time)
        SELECT user_id, contest_id, CURRENT_TIMESTAMP FROM AttendanceRecords
        WHERE attendance_status IN ('PRESENT', 'PRESENT_HISTORY', 'PRESENT_ENTRAHUB', 'PROBABLY_PRESENT', 'UNRATED_CONTEST');
      `);

      if (tableNames.includes('contest_summary')) {
        console.log('[Migration] Backfilling data to LeetCodeProfiles...');
        await db.query(`
          INSERT IGNORE INTO LeetCodeProfiles (user_id, current_rating, highest_rating, global_ranking, problems_solved)
          SELECT student_id, current_rating, highest_rating, highest_rank, 0 FROM Contest_Summary;
        `);
      }

      // 11. Normalize attendance statuses to PRESENT/ABSENT in AttendanceRecords
      console.log('[Migration] Normalizing attendance_status to PRESENT/ABSENT...');
      await db.query(`
        UPDATE AttendanceRecords
        SET attendance_status = CASE 
          WHEN attendance_status IN ('PRESENT', 'PRESENT_HISTORY', 'PRESENT_ENTRAHUB', 'PROBABLY_PRESENT', 'UNRATED_CONTEST') THEN 'PRESENT'
          ELSE 'ABSENT'
        END;
      `);

      // 12. Modify attendance_status ENUM
      console.log('[Migration] Changing attendance_status column ENUM values to PRESENT/ABSENT...');
      await db.query(`
        ALTER TABLE AttendanceRecords 
        MODIFY COLUMN attendance_status ENUM('PRESENT', 'ABSENT') NOT NULL DEFAULT 'ABSENT'
      `);

      // 13. Drop old unique indexes and foreign keys, and add updated ones
      console.log('[Migration] Rebuilding indexes and constraints...');
      try {
        await db.query("ALTER TABLE AttendanceRecords DROP FOREIGN KEY fk_attendance_student");
      } catch (err) {}
      try {
        await db.query("ALTER TABLE AttendanceRecords DROP FOREIGN KEY fk_attendance_contest");
      } catch (err) {}
      try {
        await db.query("ALTER TABLE AttendanceRecords DROP INDEX unique_student_contest_slug");
      } catch (err) {}

      // Add unique constraint and foreign keys to AttendanceRecords
      await db.query("ALTER TABLE AttendanceRecords ADD UNIQUE KEY unique_user_contest (user_id, contest_id)");
      await db.query("ALTER TABLE AttendanceRecords ADD CONSTRAINT fk_attendance_records_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE");
      await db.query("ALTER TABLE AttendanceRecords ADD CONSTRAINT fk_attendance_records_contest FOREIGN KEY (contest_id) REFERENCES Contests(contest_id) ON DELETE CASCADE");

      // Add foreign keys to Registrations
      await db.query("ALTER TABLE Registrations ADD CONSTRAINT fk_registration_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE");
      await db.query("ALTER TABLE Registrations ADD CONSTRAINT fk_registration_contest FOREIGN KEY (contest_id) REFERENCES Contests(contest_id) ON DELETE CASCADE");

      // Add foreign keys to ParticipationLogs
      await db.query("ALTER TABLE ParticipationLogs ADD CONSTRAINT fk_participation_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE");
      await db.query("ALTER TABLE ParticipationLogs ADD CONSTRAINT fk_participation_contest FOREIGN KEY (contest_id) REFERENCES Contests(contest_id) ON DELETE CASCADE");

      // Add foreign keys to LeetCodeProfiles
      await db.query("ALTER TABLE LeetCodeProfiles ADD CONSTRAINT fk_leetcode_profile_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE");

      // 14. Drop obsolete tables
      console.log('[Migration] Dropping obsolete Contest_Summary and Contest_Participants tables...');
      await db.query("DROP TABLE IF EXISTS Contest_Summary");
      await db.query("DROP TABLE IF EXISTS Contest_Participants");

      // Record migration execution
      await db.query(`
        INSERT INTO Schema_Migrations (migration_name) 
        VALUES ('enthrahub_platform_transition')
        ON DUPLICATE KEY UPDATE executed_at = CURRENT_TIMESTAMP;
      `);
      console.log('[Migration] Migration "enthrahub_platform_transition" completed.');
    }

    // ==========================================
    // MIGRATION 4: attendance_remarks_and_timestamps
    // ==========================================
    const rows4 = await db.query(
      "SELECT 1 FROM Schema_Migrations WHERE migration_name = 'attendance_remarks_and_timestamps'"
    );

    if (rows4.length > 0) {
      console.log('[Migration] Migration "attendance_remarks_and_timestamps" is already executed. Skipping.');
    } else {
      console.log('[Migration] Executing migration "attendance_remarks_and_timestamps"...');
      
      const columns = await db.query("SHOW COLUMNS FROM AttendanceRecords");
      const colNames = columns.map(c => c.Field.toLowerCase());
      
      if (!colNames.includes('remarks')) {
        console.log('[Migration] Adding remarks to AttendanceRecords...');
        await db.query("ALTER TABLE AttendanceRecords ADD COLUMN remarks TEXT DEFAULT NULL AFTER attendance_source;");
      }
      if (!colNames.includes('last_updated')) {
        console.log('[Migration] Adding last_updated to AttendanceRecords...');
        await db.query("ALTER TABLE AttendanceRecords ADD COLUMN last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER remarks;");
      }

      await db.query(`
        INSERT INTO Schema_Migrations (migration_name) 
        VALUES ('attendance_remarks_and_timestamps')
        ON DUPLICATE KEY UPDATE executed_at = CURRENT_TIMESTAMP;
      `);
      console.log('[Migration] Migration "attendance_remarks_and_timestamps" completed.');
    }

    // ==========================================
    // MIGRATION 5: notification_foreign_key_fix
    // ==========================================
    const rows5 = await db.query(
      "SELECT 1 FROM Schema_Migrations WHERE migration_name = 'notification_foreign_key_fix'"
    );

    if (rows5.length > 0) {
      console.log('[Migration] Migration "notification_foreign_key_fix" is already executed. Skipping.');
    } else {
      console.log('[Migration] Executing migration "notification_foreign_key_fix"...');
      
      // Drop old foreign key constraint
      try {
        await db.query("ALTER TABLE notifications DROP FOREIGN KEY notifications_ibfk_1");
        console.log('[Migration] Dropped constraint notifications_ibfk_1.');
      } catch (err) {
        console.log('[Migration] Note: failed to drop notifications_ibfk_1 (it might not exist):', err.message);
      }

      // Add new foreign key constraint referencing Users(id)
      try {
        await db.query("ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (student_id) REFERENCES Users(id) ON DELETE CASCADE");
        console.log('[Migration] Added constraint fk_notifications_user referencing Users(id).');
      } catch (err) {
        console.error('[Migration] Failed to add constraint fk_notifications_user:', err.message);
        throw err;
      }

      await db.query(`
        INSERT INTO Schema_Migrations (migration_name) 
        VALUES ('notification_foreign_key_fix')
        ON DUPLICATE KEY UPDATE executed_at = CURRENT_TIMESTAMP;
      `);
      console.log('[Migration] Migration "notification_foreign_key_fix" completed.');
    }

    // ==========================================
    // MIGRATION 6: dynamic_department_management
    // ==========================================
    const rows6 = await db.query(
      "SELECT 1 FROM Schema_Migrations WHERE migration_name = 'dynamic_department_management'"
    );

    if (rows6.length > 0) {
      console.log('[Migration] Migration "dynamic_department_management" is already executed. Skipping.');
    } else {
      console.log('[Migration] Executing migration "dynamic_department_management"...');

      // 1. Create departments table
      console.log('[Migration] Creating departments table...');
      await db.query(`
        CREATE TABLE IF NOT EXISTS departments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          code VARCHAR(50) NOT NULL UNIQUE,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_dept_code (code)
        ) ENGINE=InnoDB;
      `);

      // 2. Seed initial 12 departments
      console.log('[Migration] Seeding initial departments...');
      await db.query(`
        INSERT IGNORE INTO departments (code, name, status) VALUES
        ('CSE', 'Computer Science Engineering', 'active'),
        ('CSBS', 'Computer Science & Business Systems', 'active'),
        ('AIDS', 'Artificial Intelligence & Data Science', 'active'),
        ('AIML', 'Artificial Intelligence & Machine Learning', 'active'),
        ('CYBER', 'Cyber Security', 'active'),
        ('IT', 'Information Technology', 'active'),
        ('ECE', 'Electronics & Communication Engineering', 'active'),
        ('EEE', 'Electrical & Electronics Engineering', 'active'),
        ('BME', 'Biomedical Engineering', 'active'),
        ('MECH', 'Mechanical Engineering', 'active'),
        ('CIVIL', 'Civil Engineering', 'active'),
        ('BIOTECH', 'Biotechnology', 'active')
      `);

      // 3. Scan Users for any other custom/legacy departments and auto-seed them
      console.log('[Migration] Backfilling unique legacy departments from Users...');
      await db.query(`
        INSERT IGNORE INTO departments (code, name, status)
        SELECT DISTINCT department, department, 'active'
        FROM Users
        WHERE department NOT IN (SELECT code FROM departments)
      `);

      // 4. Add Foreign Key constraint to Users table
      console.log('[Migration] Adding foreign key constraint fk_users_department to Users table...');
      try {
        await db.query("ALTER TABLE Users ADD CONSTRAINT fk_users_department FOREIGN KEY (department) REFERENCES departments(code) ON UPDATE CASCADE ON DELETE RESTRICT");
        console.log('[Migration] Foreign key fk_users_department successfully added.');
      } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate') || err.message.includes('already exists')) {
          console.log('[Migration] Constraint fk_users_department already exists.');
        } else {
          console.error('[Migration] Failed to add foreign key constraint fk_users_department:', err.message);
          throw err;
        }
      }

      await db.query(`
        INSERT INTO Schema_Migrations (migration_name) 
        VALUES ('dynamic_department_management')
        ON DUPLICATE KEY UPDATE executed_at = CURRENT_TIMESTAMP;
      `);
      console.log('[Migration] Migration "dynamic_department_management" completed.');
    }

    process.exit(0);
  } catch (err) {
    console.error('[Migration] Migration failed:', err.message);
    process.exit(1);
  }
}

run();
