const db = require('../config/db');

async function run() {
  await db.initializeDatabase();
  
  const tables = ['Users', 'LeetCodeProfiles', 'CodeChefProfiles', 'CodeforcesProfiles', 'HackerRankProfiles', 'sync_logs'];
  for (const t of tables) {
    try {
      const cols = await db.query(`SHOW COLUMNS FROM ${t}`);
      console.log(`=== COLUMNS FOR ${t} ===`);
      console.log(cols.map(c => `${c.Field}: ${c.Type}`).join('\n'));
    } catch (e) {
      console.log(`Failed to get columns for ${t}: ${e.message}`);
    }
  }

  const pool = db.getPool();
  if (pool) await pool.end();
}

run();
