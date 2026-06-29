const { verifyCodeforcesUsername, getUserCodeforcesStats } = require('../../utils/codeforces');
const { normalizeCodeforcesProfile } = require('../normalizationService');

const CodeforcesConnector = {
  /**
   * Verify if a profile exists.
   */
  async verifyProfile(username) {
    try {
      const result = await verifyCodeforcesUsername(username);
      return {
        exists: !!result?.exists,
        username: result?.username || username,
        rating: result?.rating || null,
        maxRating: result?.maxRating || null,
        rank: result?.rank || null,
        maxRank: result?.maxRank || null
      };
    } catch (err) {
      return { exists: false, error: err.message };
    }
  },

  /**
   * Fetch full profile.
   */
  async fetchProfile(username) {
    const stats = await getUserCodeforcesStats(username);
    if (!stats || !stats.success) {
      throw new Error(stats?.error || 'Failed to fetch Codeforces profile');
    }
    return stats;
  },

  /**
   * Fetch contest history.
   */
  async fetchContestHistory(username) {
    const stats = await this.fetchProfile(username);
    return stats.contestHistory || [];
  },

  /**
   * Fetch rating history.
   */
  async fetchRatingHistory(username) {
    const history = await this.fetchContestHistory(username);
    return history.map(h => ({
      contestName: h.contestName || 'Unknown Contest',
      rating: h.newRating,
      date: h.ratingUpdateTimeSeconds ? new Date(h.ratingUpdateTimeSeconds * 1000).toISOString() : null,
      rank: h.rank
    }));
  },

  /**
   * Fetch solved problems.
   */
  async fetchSolvedProblems(username) {
    const stats = await this.fetchProfile(username);
    return {
      totalSolved: stats.problemsSolved || 0
    };
  },

  /**
   * Normalize platform details to the database representation.
   */
  normalize(rawData, username) {
    return normalizeCodeforcesProfile(rawData, username);
  }
};

module.exports = CodeforcesConnector;
