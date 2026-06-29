/**
 * Centralized configuration registry for competitive programming platforms.
 * Defines theme colors, capabilities, and configurations to prevent hardcoding.
 */
export const platformConfig = {
  leetcode: {
    displayName: 'LeetCode',
    logoText: 'LC',
    logoBgColor: 'bg-orange-50 dark:bg-orange-950/40 text-orange-500',
    themeColor: '#f59e0b',
    cacheTTL: 2 * 60 * 1000, // 2 minutes
    capabilities: {
      hasContestHistory: true,
      hasRatingHistory: true,
      hasSolvedBreakdown: true,
      hasHeatmap: true,
      hasBadges: true,
      hasLanguages: true,
      hasTopics: true,
      hasCertificates: false
    }
  },
  codechef: {
    displayName: 'CodeChef',
    logoText: 'CC',
    logoBgColor: 'bg-teal-50 dark:bg-teal-950/40 text-teal-500',
    themeColor: '#0d9488',
    cacheTTL: 2 * 60 * 1000,
    capabilities: {
      hasContestHistory: true,
      hasRatingHistory: true,
      hasSolvedBreakdown: true,
      hasHeatmap: true,
      hasBadges: false,
      hasLanguages: false,
      hasTopics: false,
      hasCertificates: false
    }
  },
  codeforces: {
    displayName: 'Codeforces',
    logoText: 'CF',
    logoBgColor: 'bg-red-50 dark:bg-red-950/40 text-red-500',
    themeColor: '#ef4444',
    cacheTTL: 2 * 60 * 1000,
    capabilities: {
      hasContestHistory: true,
      hasRatingHistory: true,
      hasSolvedBreakdown: true,
      hasHeatmap: true,
      hasBadges: false,
      hasLanguages: true,
      hasTopics: false,
      hasCertificates: false
    }
  },
  hackerrank: {
    displayName: 'HackerRank',
    logoText: 'HR',
    logoBgColor: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500',
    themeColor: '#10b981',
    cacheTTL: 2 * 60 * 1000,
    capabilities: {
      hasContestHistory: false,
      hasRatingHistory: false,
      hasSolvedBreakdown: true,
      hasHeatmap: false,
      hasBadges: true,
      hasLanguages: false,
      hasTopics: false,
      hasCertificates: true
    }
  }
};
