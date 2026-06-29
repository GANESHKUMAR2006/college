const { verifyCodeChefUsername, getUserCodeChefStats } = require('../utils/codechef');
const { normalizeCodeChefProfile } = require('./normalizationService');

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

async function verifyCodeChef(username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return normalizeCodeChefProfile({ verified: false, message: 'Invalid username' }, username);
  }

  try {
    const result = await withRetry(() => verifyCodeChefUsername(username));
    if (result && result.exists) {
      return normalizeCodeChefProfile({ verified: true, rating: result.rating, maxRating: result.rating, globalRanking: result.globalRanking, stars: result.stars }, result.username || username);
    }
    return normalizeCodeChefProfile({ verified: false, message: result?.error || 'CodeChef account could not be verified' }, username);
  } catch (error) {
    return normalizeCodeChefProfile({ verified: false, message: error.message || 'CodeChef verification failed' }, username);
  }
}

async function getCodeChefStats(username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return normalizeCodeChefProfile({ verified: false, message: 'Invalid username' }, username);
  }

  try {
    const stats = await withRetry(() => getUserCodeChefStats(username));
    if (stats && stats.success) {
      return normalizeCodeChefProfile({
        verified: true,
        rating: stats.rating,
        maxRating: stats.maxRating,
        problemsSolved: stats.problemsSolved,
        contestParticipationCount: stats.contestParticipationCount,
        globalRanking: stats.globalRanking,
        stars: stats.stars,
        contestHistory: stats.contestHistory || []
      }, stats.username || username);
    }

    return normalizeCodeChefProfile({ verified: false, message: stats?.error || 'CodeChef profile unavailable' }, username);
  } catch (error) {
    return normalizeCodeChefProfile({ verified: false, message: error.message || 'CodeChef stats unavailable' }, username);
  }
}

module.exports = {
  verifyCodeChef,
  getCodeChefStats
};
