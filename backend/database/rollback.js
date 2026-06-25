const db = require('../config/db');

async function run() {
  try {
    await db.initializeDatabase();
    
    // Check if the Schema_Migrations table exists and has the migration
    let migrationExists = false;
    try {
      const rows = await db.query(
        "SELECT 1 FROM Schema_Migrations WHERE migration_name = 'robust_unrated_contest_support'"
      );
      if (rows.length > 0) {
        migrationExists = true;
      }
    } catch (err) {
      console.log('[Rollback] Schema_Migrations table not found or query failed. Reverting raw schema changes anyway.');
    }

    if (!migrationExists) {
      console.log('[Rollback] Migration "robust_unrated_contest_support" was not executed. Nothing to rollback.');
      process.exit(0);
    }

    console.log('[Rollback] Rolling back migration "robust_unrated_contest_support"...');

    // 1. Drop foreign key constraints first
    console.log('[Rollback] Dropping database integrity constraints...');
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP FOREIGN KEY fk_attendance_contest;");
    } catch (err) { }
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP FOREIGN KEY fk_attendance_student;");
    } catch (err) { }
    try {
      await db.query("ALTER TABLE Contest_Participants DROP FOREIGN KEY fk_participant_contest;");
    } catch (err) { }

    // 2. Drop constraints on Contest_Attendance
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP INDEX unique_student_contest_slug;");
    } catch (err) {
      // Ignore if doesn't exist
    }

    // 3. Re-create old unique constraint on Contest_Attendance
    try {
      await db.query("ALTER TABLE Contest_Attendance ADD UNIQUE KEY unique_student_contest (student_id, contest_name);");
    } catch (err) {
      // Ignore if duplicate index
    }

    // 4. Drop tables Contests and Contest_Participants
    await db.query("DROP TABLE IF EXISTS Contest_Participants;");
    await db.query("DROP TABLE IF EXISTS Contests;");
    await db.query("DROP TABLE IF EXISTS Attendance_Migration_Issues;");
    await db.query("DROP TABLE IF EXISTS Migration_Health;");

    // 5. Re-create old anonymous constraint on student_id for Contest_Attendance
    try {
      await db.query("ALTER TABLE Contest_Attendance ADD FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;");
    } catch (err) { }

    // 4. Drop columns and indexes from Contest_Attendance
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP INDEX idx_student_contest_slug;");
    } catch (err) { }
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP INDEX idx_attendance_status;");
    } catch (err) { }
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP INDEX idx_contest_status;");
    } catch (err) { }

    try {
      await db.query("ALTER TABLE Contest_Attendance DROP COLUMN contest_slug;");
    } catch (err) { }
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP COLUMN contest_status;");
    } catch (err) { }
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP COLUMN attendance_status;");
    } catch (err) { }
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP COLUMN attendance_source;");
    } catch (err) { }
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP COLUMN participation_verified;");
    } catch (err) { }
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP COLUMN verification_method;");
    } catch (err) { }
    try {
      await db.query("ALTER TABLE Contest_Attendance DROP COLUMN score;");
    } catch (err) { }

    // 5. Drop columns and indexes from Contest_Summary
    try {
      await db.query("ALTER TABLE Contest_Summary DROP INDEX idx_student_summary;");
    } catch (err) { }

    try {
      await db.query("ALTER TABLE Contest_Summary DROP COLUMN rated_contests;");
    } catch (err) { }
    try {
      await db.query("ALTER TABLE Contest_Summary DROP COLUMN unrated_contests;");
    } catch (err) { }

    // 6. Delete migration record
    try {
      await db.query(
        "DELETE FROM Schema_Migrations WHERE migration_name = 'robust_unrated_contest_support'"
      );
    } catch (err) { }

    console.log('[Rollback] Rollback of "robust_unrated_contest_support" completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[Rollback] Rollback failed:', err.message);
    process.exit(1);
  }
}

run();
