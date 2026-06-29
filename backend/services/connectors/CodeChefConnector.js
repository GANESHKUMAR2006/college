const { verifyCodeChefUsername, getUserCodeChefStats } = require('../../utils/codechef');
const { normalizeCodeChefProfile } = require('../normalizationService');

const CodeChefConnector = {
  /**
   * Verify if a profile exists.
   */
  async verifyProfile(username) {
    try {
      const result = await verifyCodeChefUsername(username);
      return {
        exists: !!result?.exists,
        username: result?.username || username,
        rating: result?.rating || null,
        globalRanking: result?.globalRanking || null,
        stars: result?.stars || null
      };
    } catch (err) {
      return { exists: false, error: err.message };
    }
  },

  /**
   * Fetch full profile.
   */
  async fetchProfile(username) {
    const stats = await getUserCodeChefStats(username);
    if (!stats || !stats.success) {
      throw new Error(stats?.error || 'Failed to fetch CodeChef profile');
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
      date: h.contestDate,
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
    return normalizeCodeChefProfile(rawData, username);
  }
};

module.exports = CodeChefConnector;
