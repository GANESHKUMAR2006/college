const { verifyHackerRankUsername, getUserHackerRankStats } = require('../utils/hackerrank');
const { normalizeHackerRankProfile } = require('./normalizationService');

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

async function verifyHackerRank(username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return normalizeHackerRankProfile({ verified: false, message: 'Invalid username' }, username);
  }

  try {
    const result = await withRetry(() => verifyHackerRankUsername(username));
    if (result && result.exists) {
      return normalizeHackerRankProfile({ verified: true }, result.username || username);
    }
    return normalizeHackerRankProfile({ verified: false, message: result?.error || 'HackerRank account could not be verified' }, username);
  } catch (error) {
    return normalizeHackerRankProfile({ verified: false, message: error.message || 'HackerRank verification failed' }, username);
  }
}

async function getHackerRankStats(username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return normalizeHackerRankProfile({ verified: false, message: 'Invalid username' }, username);
  }

  try {
    const stats = await withRetry(() => getUserHackerRankStats(username));
    if (stats && stats.success) {
      return normalizeHackerRankProfile({
        verified: true,
        problemsSolved: stats.problemsSolved,
        contestParticipationCount: 0,
        badges: stats.badges || [],
        stars: stats.stars || 0,
        certificates: stats.certificates || []
      }, stats.username || username);
    }

    return normalizeHackerRankProfile({ verified: false, message: stats?.error || 'HackerRank profile unavailable' }, username);
  } catch (error) {
    return normalizeHackerRankProfile({ verified: false, message: error.message || 'HackerRank stats unavailable' }, username);
  }
}

module.exports = {
  verifyHackerRank,
  getHackerRankStats
};
