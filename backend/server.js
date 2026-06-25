const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { initializeDatabase, query, getConnectionStatus } = require('./config/db');
const { initScheduler, seedMasterContests } = require('./utils/scheduler');

// Import routes
const studentRoutes = require('./routes/students');
const contestRoutes = require('./routes/contests');
const attendanceRoutes = require('./routes/attendance');
const reportRoutes = require('./routes/reports');
const analyticsRoutes = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');
const departmentRoutes = require('./routes/departments');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes mapping
app.use('/api/students', studentRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/departments', departmentRoutes);

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = getConnectionStatus();
  let dbHealthy = false;
  let dbError = null;

  if (dbStatus.isConnected) {
    try {
      await query('SELECT 1');
      dbHealthy = true;
    } catch (err) {
      dbError = err.message;
    }
  } else {
    dbError = dbStatus.lastError ? dbStatus.lastError.message : 'Database pool is offline';
  }

  const payload = {
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date(),
    database: {
      connected: dbStatus.isConnected,
      connecting: dbStatus.isConnecting,
      retryCount: dbStatus.retryCount,
      healthy: dbHealthy,
      error: dbError
    }
  };

  if (dbHealthy) {
    return res.status(200).json(payload);
  } else {
    return res.status(503).json(payload);
  }
});

// Migration health check endpoint
app.get('/api/health/migrations', async (req, res) => {
  try {
    const db = require('./config/db');
    const health = await db.query("SELECT * FROM Migration_Health");
    const issues = await db.query("SELECT * FROM Attendance_Migration_Issues LIMIT 100");
    
    return res.status(200).json({
      success: true,
      migrations: health,
      issues: issues
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve migration health status. Verify if migration has been run.',
      error: err.message
    });
  }
});

// Root API hello
app.get('/', (req, res) => {
  res.send('LeetCode Contest Attendance System API is running.');
});

// Validate schema on startup
async function validateDatabaseSchema() {
  console.log('[Server] Validating database schema compatibility...');
  try {
    const db = require('./config/db');
    
    // Check if Schema_Migrations table exists and migration is recorded
    let migrationExecuted = false;
    try {
      const rows = await db.query(
        "SELECT 1 FROM Schema_Migrations WHERE migration_name = 'enthrahub_platform_transition'"
      );
      if (rows.length > 0) {
        migrationExecuted = true;
      }
    } catch (err) {
      // Schema_Migrations table might not exist
    }
 
    if (!migrationExecuted) {
      console.warn('======================================================================');
      console.warn('[WARNING] Pending database migrations detected!');
      console.warn('[WARNING] Please run: npm run migrate');
      console.warn('======================================================================');
      return;
    }
 
    // Check tables
    try {
      await db.query("SELECT 1 FROM Users LIMIT 1");
      await db.query("SELECT 1 FROM Contests LIMIT 1");
      await db.query("SELECT 1 FROM Registrations LIMIT 1");
      await db.query("SELECT 1 FROM ParticipationLogs LIMIT 1");
      await db.query("SELECT 1 FROM AttendanceRecords LIMIT 1");
      await db.query("SELECT 1 FROM LeetCodeProfiles LIMIT 1");
    } catch (err) {
      console.warn('======================================================================');
      console.warn('[WARNING] Schema mismatch: One or more EnthraHub tables are missing.');
      console.warn('[WARNING] Please run: npm run migrate');
      console.warn('======================================================================');
      return;
    }
 
    // Check AttendanceRecords columns
    try {
      const columns = await db.query("SHOW COLUMNS FROM AttendanceRecords");
      const colNames = columns.map(c => c.Field);
      const requiredCols = ['user_id', 'contest_id', 'attendance_status', 'attendance_source'];
      const missing = requiredCols.filter(col => !colNames.includes(col));
      
      if (missing.length > 0) {
        console.warn('======================================================================');
        console.warn(`[WARNING] Schema mismatch: AttendanceRecords is missing columns: ${missing.join(', ')}`);
        console.warn('[WARNING] Please run: npm run migrate');
        console.warn('======================================================================');
        return;
      }

      // Check if contest_name or contest_date are nullable. If not, make them nullable.
      const nameCol = columns.find(c => c.Field === 'contest_name');
      const dateCol = columns.find(c => c.Field === 'contest_date');
      
      if (nameCol && nameCol.Null === 'NO') {
        console.log('[Server] Modifying AttendanceRecords.contest_name to be NULL...');
        await db.query("ALTER TABLE AttendanceRecords MODIFY COLUMN contest_name VARCHAR(150) NULL");
      }
      if (dateCol && dateCol.Null === 'NO') {
        console.log('[Server] Modifying AttendanceRecords.contest_date to be NULL...');
        await db.query("ALTER TABLE AttendanceRecords MODIFY COLUMN contest_date DATE NULL");
      }

    } catch (err) {
      console.error('[Server] Failed to query/modify columns of AttendanceRecords:', err.message);
    }
 
    console.log('[Server] Database schema is compatible and up to date.');
  } catch (err) {
    console.error('[Server] Database validation error:', err.message);
  }
}

// Database initialization & server start
async function startServer() {
  // Start db connection in the background (non-blocking)
  try {
    await initializeDatabase();
    await validateDatabaseSchema();
    
    // Seed master contests from LeetCode in the background
    seedMasterContests().then(res => {
      console.log(`[Server] Background master contest seeding completed: ${res.count} contests processed.`);
    }).catch(err => {
      console.error('[Server] Background master contest seeding failed:', err.message);
    });
    
  } catch (err) {
    console.error('[Server] Critical error starting database:', err.message);
  }
  
  // Start the automated cron job scheduler
  initScheduler();

  app.listen(PORT, () => {
    console.log(`[Server] Express server running on port ${PORT}`);
  });
}

startServer();

