const db = require('../config/db');

async function run() {
  await db.initializeDatabase();

  // 1. Fetch departments
  const deptRows = await db.query("SELECT code FROM departments WHERE status = 'active'");
  const activeDepts = new Set(deptRows.map(d => d.code.toUpperCase()));

  // 2. Fetch all active students
  const users = await db.query(`
    SELECT id, name, roll_no, department, section, academic_batch, leetcode_username, codechef_username, codeforces_username, hackerrank_username
    FROM Users
    WHERE status = 'active'
  `);

  // 3. Fetch profiles from all platforms
  const lcRows = await db.query("SELECT user_id, last_synced FROM LeetCodeProfiles");
  const ccRows = await db.query("SELECT user_id, last_synced FROM CodeChefProfiles");
  const cfRows = await db.query("SELECT user_id, last_synced FROM CodeforcesProfiles");
  const hrRows = await db.query("SELECT user_id, last_synced FROM HackerRankProfiles");

  const lcMap = new Map(lcRows.map(r => [r.user_id, r]));
  const ccMap = new Map(ccRows.map(r => [r.user_id, r]));
  const cfMap = new Map(cfRows.map(r => [r.user_id, r]));
  const hrMap = new Map(hrRows.map(r => [r.user_id, r]));

  // Duplicate checks counts
  const rollNoCounts = new Map();
  const lcCounts = new Map();
  const cfCounts = new Map();

  users.forEach(u => {
    const roll = (u.roll_no || '').trim().toLowerCase();
    const lc = (u.leetcode_username || '').trim().toLowerCase();
    const cf = (u.codeforces_username || '').trim().toLowerCase();
    if (roll) rollNoCounts.set(roll, (rollNoCounts.get(roll) || 0) + 1);
    if (lc) lcCounts.set(lc, (lcCounts.get(lc) || 0) + 1);
    if (cf) cfCounts.set(cf, (cfCounts.get(cf) || 0) + 1);
  });

  let duplicateCount = 0;
  let invalidCount = 0;
  let missingConnectionsCount = 0;
  let syncedConnections = 0;
  let totalConnections = 0;

  const results = users.map(user => {
    let hasConnection = false;
    let hasSynced = false;
    let missingCore = false;

    // Validate core fields
    if (!user.name || !user.name.trim() || !user.roll_no || !user.roll_no.trim() || !user.department || !user.department.trim()) {
      missingCore = true;
    }
    if (user.department && !activeDepts.has(user.department.toUpperCase())) {
      missingCore = true;
    }

    // Check duplicates
    if (rollNoCounts.get((user.roll_no || '').trim().toLowerCase()) > 1) duplicateCount++;
    if (lcCounts.get((user.leetcode_username || '').trim().toLowerCase()) > 1) duplicateCount++;
    if (cfCounts.get((user.codeforces_username || '').trim().toLowerCase()) > 1) duplicateCount++;

    const checkPlatform = (username, profileMap) => {
      if (username && username.trim()) {
        hasConnection = true;
        totalConnections++;
        const profile = profileMap.get(user.id);
        if (profile && profile.last_synced) {
          hasSynced = true;
          syncedConnections++;
        }
      }
    };

    checkPlatform(user.leetcode_username, lcMap);
    checkPlatform(user.codechef_username, ccMap);
    checkPlatform(user.codeforces_username, cfMap);
    checkPlatform(user.hackerrank_username, hrMap);

    if (!hasConnection) missingConnectionsCount++;
    if (missingCore) invalidCount++;

    return { id: user.id, hasConnection, hasSynced, missingCore };
  });

  const totalStudents = users.length;
  const completeProfiles = results.filter(r => r.hasConnection && r.hasSynced && !r.missingCore).length;

  console.log('=== DIAGNOSTICS REPORT ===');
  console.log(`Total Students: ${totalStudents}`);
  console.log(`Complete Profiles: ${completeProfiles}`);
  console.log(`Missing Platform Connections: ${missingConnectionsCount}`);
  console.log(`Duplicate Records detected: ${duplicateCount}`);
  console.log(`Invalid Records (Missing fields/mismatch depts): ${invalidCount}`);
  console.log(`Total Platform Connections: ${totalConnections}`);
  console.log(`Successfully Synced Connections: ${syncedConnections}`);
  console.log(`Platform Sync Rate: ${totalConnections > 0 ? Math.round((syncedConnections / totalConnections) * 100) : 100}%`);

  const pool = db.getPool();
  if (pool) await pool.end();
}

run();
