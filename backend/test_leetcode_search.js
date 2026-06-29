const { getContestRankingPage } = require('./utils/leetcode');
const { exec } = require('child_process');

function queryLeetCodeRanking(contestSlug, extraParams = '') {
  const url = `https://leetcode.com/contest/api/ranking/${contestSlug}/?${extraParams}`;
  const cmd = `curl.exe -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${url}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve({ error: err.message });
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ error: e.message, raw: stdout.slice(0, 200) });
      }
    });
  });
}

async function test() {
  const slug = 'weekly-contest-380';
  
  // 1. Get a user from page 5 (should be rank ~100-125)
  console.log('Fetching page 5 of contest...');
  const page5Data = await queryLeetCodeRanking(slug, 'pagination=5');
  if (!page5Data.total_rank || page5Data.total_rank.length === 0) {
    console.log('Could not fetch page 5');
    process.exit(1);
  }
  
  const targetUser = page5Data.total_rank[0];
  const targetUsername = targetUser.username;
  console.log(`Target username: ${targetUsername} (Rank: ${targetUser.rank})`);
  
  // 2. Query page 1 with targetUsername as a parameter
  console.log(`Querying page 1 with: ?username=${targetUsername}`);
  const data1 = await queryLeetCodeRanking(slug, `pagination=1&username=${targetUsername}`);
  console.log('Result 1 total_rank length:', data1.total_rank?.length);
  const found1 = data1.total_rank?.find(x => x.username === targetUsername);
  console.log(`Found target user?`, found1 ? `Yes (Rank: ${found1.rank})` : 'No');
  
  // 3. Query without pagination parameter
  console.log(`Querying without pagination: ?username=${targetUsername}`);
  const data2 = await queryLeetCodeRanking(slug, `username=${targetUsername}`);
  console.log('Result 2 total_rank length:', data2.total_rank?.length);
  const found2 = data2.total_rank?.find(x => x.username === targetUsername);
  console.log(`Found target user?`, found2 ? `Yes (Rank: ${found2.rank})` : 'No');
  
  // 4. Query with search parameter
  console.log(`Querying with search parameter: ?pagination=1&search=${targetUsername}`);
  const data3 = await queryLeetCodeRanking(slug, `pagination=1&search=${targetUsername}`);
  console.log('Result 3 total_rank length:', data3.total_rank?.length);
  const found3 = data3.total_rank?.find(x => x.username === targetUsername);
  console.log(`Found target user?`, found3 ? `Yes (Rank: ${found3.rank})` : 'No');

  process.exit(0);
}

test();
