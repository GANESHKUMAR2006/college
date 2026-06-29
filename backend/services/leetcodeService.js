const { verifyLeetCodeUsername, getUserLeetCodeStats } = require('../utils/leetcode');
const { normalizeLeetCodeProfile } = require('./normalizationService');

async function withRetry(fn, retries = 2, delayMs = 250) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

async function verifyLeetCode(username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return normalizeLeetCodeProfile({ verified: false, message: 'Invalid username' }, username);
  }

  try {
    const result = await withRetry(() => verifyLeetCodeUsername(username));
    if (result && result.exists) {
      return normalizeLeetCodeProfile({ verified: true, rating: result.rating, maxRating: result.rating, globalRanking: result.globalRanking }, result.username || username);
    }
    return normalizeLeetCodeProfile({ verified: false, message: result?.error || 'LeetCode account could not be verified' }, username);
  } catch (error) {
    return normalizeLeetCodeProfile({ verified: false, message: error.message || 'LeetCode verification failed' }, username);
  }
}

async function getLeetCodeStats(username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return normalizeLeetCodeProfile({ verified: false, message: 'Invalid username' }, username);
  }

  try {
    const stats = await withRetry(() => getUserLeetCodeStats(username));
    if (stats && stats.success) {
      return normalizeLeetCodeProfile({
        verified: true,
        rating: stats.contestRating,
        maxRating: stats.contestRating,
        problemsSolved: stats.totalSolved,
        contestParticipationCount: stats.contestParticipationCount,
        globalRanking: stats.globalRanking,
        activeDays: stats.activeDays,
        easySolved: stats.easySolved,
        mediumSolved: stats.mediumSolved,
        hardSolved: stats.hardSolved,
        submissions: []
      }, stats.username || username);
    }

    return normalizeLeetCodeProfile({ verified: false, message: stats?.error || 'LeetCode profile unavailable' }, username);
  } catch (error) {
    return normalizeLeetCodeProfile({ verified: false, message: error.message || 'LeetCode stats unavailable' }, username);
  }
}

module.exports = {
  verifyLeetCode,
  getLeetCodeStats
};
