const { verifyHackerRankUsername, getUserHackerRankStats } = require('../../utils/hackerrank');
const { normalizeHackerRankProfile } = require('../normalizationService');

const HackerRankConnector = {
  /**
   * Verify if a profile exists.
   */
  async verifyProfile(username) {
    try {
      const result = await verifyHackerRankUsername(username);
      return {
        exists: !!result?.exists,
        username: result?.username || username
      };
    } catch (err) {
      return { exists: false, error: err.message };
    }
  },

  /**
   * Fetch full profile.
   */
  async fetchProfile(username) {
    const stats = await getUserHackerRankStats(username);
    if (!stats || !stats.success) {
      throw new Error(stats?.error || 'Failed to fetch HackerRank profile');
    }
    return stats;
  },

  /**
   * Fetch contest history.
   */
  async fetchContestHistory(username) {
    // HackerRank does not expose detailed contest history in the same format
    return [];
  },

  /**
   * Fetch rating history.
   */
  async fetchRatingHistory(username) {
    return [];
  },

  /**
   * Fetch solved problems.
   */
  async fetchSolvedProblems(username) {
    const stats = await this.fetchProfile(username);
    return {
      totalSolved: stats.problemsSolved || 0,
      badges: stats.badges || [],
      stars: stats.stars || 0
    };
  },

  /**
   * Normalize platform details to the database representation.
   */
  normalize(rawData, username) {
    return normalizeHackerRankProfile(rawData, username);
  }
};

module.exports = HackerRankConnector;
