const { verifyCodeforcesUsername, getUserCodeforcesStats } = require('../utils/codeforces');
const { normalizeCodeforcesProfile } = require('./normalizationService');

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

async function verifyCodeforces(username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return normalizeCodeforcesProfile({ verified: false, message: 'Invalid username' }, username);
  }

  try {
    const result = await withRetry(() => verifyCodeforcesUsername(username));
    if (result && result.exists) {
      return normalizeCodeforcesProfile({ verified: true, rating: result.rating, maxRating: result.maxRating, rank: result.rank, maxRank: result.maxRank }, result.username || username);
    }
    return normalizeCodeforcesProfile({ verified: false, message: result?.error || 'Codeforces account could not be verified' }, username);
  } catch (error) {
    return normalizeCodeforcesProfile({ verified: false, message: error.message || 'Codeforces verification failed' }, username);
  }
}

async function getCodeforcesStats(username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return normalizeCodeforcesProfile({ verified: false, message: 'Invalid username' }, username);
  }

  try {
    const stats = await withRetry(() => getUserCodeforcesStats(username));
    if (stats && stats.success) {
      return normalizeCodeforcesProfile({
        verified: true,
        rating: stats.rating,
        maxRating: stats.maxRating,
        problemsSolved: stats.problemsSolved,
        contestParticipationCount: stats.contestParticipationCount,
        rank: stats.rank,
        maxRank: stats.maxRank,
        contestHistory: stats.contestHistory || []
      }, stats.username || username);
    }

    return normalizeCodeforcesProfile({ verified: false, message: stats?.error || 'Codeforces profile unavailable' }, username);
  } catch (error) {
    return normalizeCodeforcesProfile({ verified: false, message: error.message || 'Codeforces stats unavailable' }, username);
  }
}

module.exports = {
  verifyCodeforces,
  getCodeforcesStats
};
