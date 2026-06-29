const { verifyLeetCodeUsername, getUserLeetCodeStats, getUserContestRankingAndHistory } = require('../../utils/leetcode');
const { normalizeLeetCodeProfile } = require('../normalizationService');

const LeetCodeConnector = {
  /**
   * Verify if a profile exists.
   */
  async verifyProfile(username) {
    try {
      const result = await verifyLeetCodeUsername(username);
      return {
        exists: !!result?.exists,
        username: result?.username || username,
        rating: result?.rating || null,
        globalRanking: result?.globalRanking || null
      };
    } catch (err) {
      return { exists: false, error: err.message };
    }
  },

  /**
   * Fetch full profile.
   */
  async fetchProfile(username) {
    const stats = await getUserLeetCodeStats(username);
    if (!stats || !stats.success) {
      throw new Error(stats?.error || 'Failed to fetch LeetCode profile');
    }
    
    // Fetch and merge LeetCode contest history
    try {
      const historyData = await getUserContestRankingAndHistory(username);
      if (historyData && historyData.userContestRankingHistory) {
        stats.contestHistory = historyData.userContestRankingHistory;
      } else {
        stats.contestHistory = [];
      }
    } catch (err) {
      console.warn(`[LeetCodeConnector] Failed to fetch contest history for ${username}:`, err.message);
      stats.contestHistory = [];
    }

    return stats;
  },

  /**
   * Fetch contest participation history.
   */
  async fetchContestHistory(username) {
    const stats = await this.fetchProfile(username);
    // LeetCode stats contains contestHistory already.
    return stats.contestHistory || [];
  },

  /**
   * Fetch rating history.
   */
  async fetchRatingHistory(username) {
    const history = await this.fetchContestHistory(username);
    return history.map(h => ({
      contestName: h.contest?.title || 'Unknown Contest',
      rating: h.rating,
      date: h.contest?.startTime ? new Date(h.contest.startTime * 1000).toISOString() : null,
      rank: h.ranking
    }));
  },

  /**
   * Fetch solved problems count.
   */
  async fetchSolvedProblems(username) {
    const stats = await this.fetchProfile(username);
    return {
      totalSolved: stats.totalSolved || 0,
      easySolved: stats.easySolved || 0,
      mediumSolved: stats.mediumSolved || 0,
      hardSolved: stats.hardSolved || 0
    };
  },

  /**
   * Normalize platform details to the database representation.
   */
  normalize(rawData, username) {
    return normalizeLeetCodeProfile(rawData, username);
  }
};

module.exports = LeetCodeConnector;
