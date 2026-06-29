import { fetchUnifiedProfile, invalidateProfileCache } from './apiClient';

export const leetcodeService = {
  async getProfile(studentId) {
    const data = await fetchUnifiedProfile(studentId);
    return data?.profiles?.leetcode || null;
  },

  async getContestHistory(studentId) {
    const profile = await this.getProfile(studentId);
    return profile?.contestHistory || [];
  },

  async getSubmissionStats(studentId) {
    const profile = await this.getProfile(studentId);
    // LeetCode recent submissions format
    const recent = profile?.recentSubmissions || [];
    const submissions = {
      daily: recent.filter(s => {
        const diff = Date.now() - (s.timestamp * 1000);
        return diff <= 24 * 60 * 60 * 1000;
      }).length,
      weekly: recent.filter(s => {
        const diff = Date.now() - (s.timestamp * 1000);
        return diff <= 7 * 24 * 60 * 60 * 1000;
      }).length,
      monthly: recent.filter(s => {
        const diff = Date.now() - (s.timestamp * 1000);
        return diff <= 30 * 24 * 60 * 60 * 1000;
      }).length,
      yearly: recent.filter(s => {
        const diff = Date.now() - (s.timestamp * 1000);
        return diff <= 365 * 24 * 60 * 60 * 1000;
      }).length,
    };
    return submissions;
  },

  async getSolvedProblems(studentId) {
    const profile = await this.getProfile(studentId);
    const total = profile?.problemsSolved || 0;
    const acceptance = profile?.acceptanceRate || 0.0;
    
    return {
      totalSolved: total,
      easySolved: profile?.easySolved || 0,
      mediumSolved: profile?.mediumSolved || 0,
      hardSolved: profile?.hardSolved || 0,
      totalAttempted: acceptance > 0 ? Math.round(total / (acceptance / 100)) : Math.round(total * 1.15),
      acceptanceRate: acceptance
    };
  },

  async getHeatmap(studentId) {
    const profile = await this.getProfile(studentId);
    return profile?.submissionCalendar || {};
  },

  async getRatingHistory(studentId) {
    const history = await this.getContestHistory(studentId);
    return history.map(h => ({
      contestName: h.contestName || 'Contest',
      rating: h.newRating || 0,
      date: h.contestDate || null,
      rank: h.rank || 0
    }));
  },

  async refreshData(studentId) {
    invalidateProfileCache(studentId);
    const data = await fetchUnifiedProfile(studentId, true);
    return data?.profiles?.leetcode || null;
  }
};
