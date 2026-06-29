const { getLeetCodeStats } = require('./leetcodeService');
const { getCodeChefStats } = require('./codechefService');
const { getCodeforcesStats } = require('./codeforcesService');
const { getHackerRankStats } = require('./hackerrankService');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeOverallScore(platforms) {
  const weights = { leetcode: 0.35, codechef: 0.2, codeforces: 0.25, hackerrank: 0.2 };
  let score = 0;
  Object.entries(platforms).forEach(([platform, profile]) => {
    if (!profile || !profile.verified) return;
    const ratingScore = profile.rating ? Math.min(profile.rating / 2500, 1) * 60 : 0;
    const solvedScore = Math.min((profile.problemsSolved || 0) / 400, 1) * 25;
    const contestScore = Math.min((profile.contests || 0) / 20, 1) * 15;
    score += (ratingScore + solvedScore + contestScore) * (weights[platform] || 0.2);
  });
  return Math.round(score);
}

async function getUnifiedStudentProfile(student) {
  const usernames = {
    leetcode: student.leetcode_username,
    codechef: student.codechef_username,
    codeforces: student.codeforces_username,
    hackerrank: student.hackerrank_username
  };

  const tasks = [
    ['leetcode', getLeetCodeStats(usernames.leetcode)],
    ['codechef', getCodeChefStats(usernames.codechef)],
    ['codeforces', getCodeforcesStats(usernames.codeforces)],
    ['hackerrank', getHackerRankStats(usernames.hackerrank)]
  ];

  const results = await Promise.allSettled(tasks.map(([, task]) => task));
  const profiles = {};
  tasks.forEach(([platform], index) => {
    const result = results[index];
    profiles[platform] = result.status === 'fulfilled' ? result.value : { platform, verified: false, status: 'unavailable', message: result.reason?.message || 'Request failed' };
  });

  const overallScore = computeOverallScore(profiles);
  const totalProblemsSolved = Object.values(profiles).reduce((sum, profile) => sum + toNumber(profile.problemsSolved, 0), 0);

  return {
    student,
    profiles,
    overallScore,
    totalProblemsSolved,
    summary: {
      mostActivePlatform: Object.entries(profiles)
        .filter(([, profile]) => profile.verified)
        .sort((a, b) => (b[1].problemsSolved || 0) - (a[1].problemsSolved || 0))[0]?.[0] || 'leetcode',
      platformDistribution: Object.entries(profiles)
        .filter(([, profile]) => profile.verified)
        .map(([platform, profile]) => ({ platform, value: profile.problemsSolved || 0 }))
    }
  };
}

module.exports = {
  getUnifiedStudentProfile
};
