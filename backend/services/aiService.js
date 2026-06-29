/**
 * AiService
 * =========
 * Heuristic-based AI Engine providing student-specific predictions and coaching insights.
 * Analyzes multi-platform stats dynamically.
 */

const platformAnalytics = require('./platformAnalyticsService');
const db = require('../config/db');

// List of critical DSA topics needed for placement interviews
const CRITICAL_TOPICS = [
  { name: 'Dynamic Programming', slug: 'dynamic-programming', minTarget: 15, tier: 'Advanced' },
  { name: 'Graphs', slug: 'graph', minTarget: 12, tier: 'Advanced' },
  { name: 'Trees & Binary Search Trees', slug: 'tree', minTarget: 20, tier: 'Intermediate' },
  { name: 'Binary Search', slug: 'binary-search', minTarget: 15, tier: 'Intermediate' },
  { name: 'Recursion & Backtracking', slug: 'recursion', minTarget: 10, tier: 'Intermediate' },
  { name: 'Greedy', slug: 'greedy', minTarget: 15, tier: 'Intermediate' },
  { name: 'Hash Table', slug: 'hash-table', minTarget: 25, tier: 'Beginner' },
  { name: 'String', slug: 'string', minTarget: 30, tier: 'Beginner' },
  { name: 'Array', slug: 'array', minTarget: 40, tier: 'Beginner' }
];

/**
 * Get AI Coach insights for a specific student.
 */
async function getStudentAiInsights(studentId) {
  const profileData = await platformAnalytics.getUnifiedStudentProfile(studentId);
  if (!profileData) {
    throw new Error('Student not found');
  }

  const { student, profiles, overallScore, totalProblemsSolved } = profileData;
  const lcTopicStats = profiles.leetcode?.topicStats || [];
  const lcRating = Number(profiles.leetcode?.rating) || 0;
  const lcHistory = profiles.leetcode?.contestHistory || [];

  // 1. Weak Topic Detection
  // Normalize topic tags by mapping their names/slugs
  const topicMap = new Map();
  lcTopicStats.forEach(topic => {
    const slug = (topic.tagSlug || topic.tagName || topic.tag || '').toLowerCase();
    const count = Number(topic.problemsSolved || topic.count || 0);
    topicMap.set(slug, count);
  });

  const weakTopics = [];
  CRITICAL_TOPICS.forEach(topic => {
    const solved = topicMap.get(topic.slug) || 0;
    if (solved < topic.minTarget) {
      const deficiency = topic.minTarget - solved;
      const priority = solved <= Math.round(topic.minTarget * 0.25) ? 'High' : 'Medium';
      weakTopics.push({
        topicName: topic.name,
        solvedCount: solved,
        targetCount: topic.minTarget,
        deficiency,
        priority,
        tier: topic.tier
      });
    }
  });

  // Sort weak topics: High priority first, then by deficiency (largest gap first)
  weakTopics.sort((a, b) => {
    if (a.priority === 'High' && b.priority !== 'High') return -1;
    if (a.priority !== 'High' && b.priority === 'High') return 1;
    return b.deficiency - a.deficiency;
  });

  // 2. Personalized Recommendations & Roadmap Milestones
  let recommendationText = '';
  let milestones = [];

  if (totalProblemsSolved < 100) {
    recommendationText = 'Focus on building robust coding foundations. Practice Easy and foundational Medium problems in Arrays, Strings, and Hash Tables. Consistent daily solving is key to coding placement readiness.';
    milestones = [
      { goal: 'Solve 20 more Easy problems in Arrays & Strings', targetDate: 'Next 14 Days' },
      { goal: 'Verify and sync your CodeChef profile to track participation metrics', targetDate: 'Next 3 Days' },
      { goal: 'Attend at least 1 mock contest on LeetCode', targetDate: 'Next Week' }
    ];
  } else if (totalProblemsSolved < 300) {
    recommendationText = 'Your coding foundation is solid. Focus on intermediate topics like Trees, Binary Search, and Recursion. Prioritize Medium difficulty problems to boost your analytical thinking and rating.';
    milestones = [
      { goal: 'Solve 15 Tree and 10 Binary Search Medium problems', targetDate: 'Next 21 Days' },
      { goal: 'Compete in 2 consecutive LeetCode Weekly Contests', targetDate: 'Next 14 Days' },
      { goal: 'Maintain a contest attendance consistency above 75%', targetDate: 'Ongoing' }
    ];
  } else {
    recommendationText = 'Excellent problem-solving portfolio. Focus on advanced topics like Dynamic Programming, Graph algorithms, and Greedy heuristics. Optimize your time complexity and aim to solve 3 out of 4 problems in live contests.';
    milestones = [
      { goal: 'Solve 15 Dynamic Programming and 10 Graph Hard problems', targetDate: 'Next 30 Days' },
      { goal: 'Boost your contest rating to 1650+ (LeetCode) or 1400+ (Codeforces)', targetDate: 'Next 60 Days' },
      { goal: 'Achieve Tier 1 (FAANG-ready) status on the Placement Dashboard', targetDate: 'Ongoing' }
    ];
  }

  // 3. Contest Predictions
  let predictedRating = 1500;
  let predictedChange = '+0 to +15';
  let expectedRank = 'Top 50%';
  let confidence = 'Low (Insufficient history)';
  let predictionLogs = [];

  if (lcHistory.length > 0) {
    // Extract recent rating trajectory (up to last 5 contests)
    const ratingChanges = lcHistory
      .slice(-5)
      .map(e => Number(e.ratingChange) || 0);

    const positiveChanges = ratingChanges.filter(c => c > 0);
    const avgChange = ratingChanges.reduce((s, c) => s + c, 0) / ratingChanges.length;

    predictedRating = Math.round(lcRating + avgChange);
    
    if (avgChange > 10) {
      predictedChange = '+10 to +25';
    } else if (avgChange > 0) {
      predictedChange = '+2 to +12';
    } else if (avgChange > -10) {
      predictedChange = '-5 to +5';
    } else {
      predictedChange = '-15 to -2';
    }

    if (lcRating >= 1800) expectedRank = 'Top 5%';
    else if (lcRating >= 1650) expectedRank = 'Top 12%';
    else if (lcRating >= 1500) expectedRank = 'Top 30%';
    else expectedRank = 'Top 55%';

    confidence = lcHistory.length >= 6 ? 'High' : 'Medium';
    predictionLogs = lcHistory.slice(-5).map(e => ({
      contestName: e.contestName || 'Contest',
      rating: Math.round(e.newRating),
      change: Math.round(e.ratingChange)
    }));
  }

  // 4. Performance Insights
  const insights = [];

  // Check recent contest activity
  if (lcHistory.length > 0) {
    const lastContest = lcHistory[lcHistory.length - 1];
    if (lastContest.ratingChange > 0) {
      insights.push(`Your rating increased by +${Math.round(lastContest.ratingChange)} in the last contest (${lastContest.contestName}). Excellent job!`);
    } else if (lastContest.ratingChange < 0) {
      insights.push(`You experienced a minor rating dip in ${lastContest.contestName}. Focus on reviewing the problems you missed post-contest.`);
    }
  }

  // Check overall problem stats
  const totalSolved = totalProblemsSolved;
  if (totalSolved >= 400) {
    insights.push(`Superb solving milestone! With ${totalSolved} total solved problems, you possess a top-tier placement preparation portfolio.`);
  } else if (totalSolved >= 150) {
    insights.push(`Good progress. With ${totalSolved} solved problems, you are well-positioned for product placement. Keep climbing.`);
  } else {
    insights.push(`DSA practice is critical. Try to solve at least 2 problems daily to cross the 150-problem placement gateway.`);
  }

  // Platform connections
  const connectedPlatforms = [
    profiles.leetcode?.username && 'LeetCode',
    profiles.codechef?.username && 'CodeChef',
    profiles.codeforces?.username && 'Codeforces',
    profiles.hackerrank?.username && 'HackerRank'
  ].filter(Boolean);

  if (connectedPlatforms.length >= 3) {
    insights.push(`Great platform diversity! Being active on ${connectedPlatforms.join(', ')} shows versatile problem-solving adaptability.`);
  } else if (connectedPlatforms.length === 1) {
    insights.push('Expand your competitive edge! Consider syncing your Codeforces or CodeChef accounts to expose your profile to more placement opportunities.');
  }

  return {
    student,
    overallScore,
    recommendations: {
      text: recommendationText,
      milestones
    },
    weakTopics: weakTopics, // Return all weak areas
    contestPredictions: {
      predictedRating,
      predictedChange,
      expectedRank,
      confidence,
      history: predictionLogs
    },
    insights
  };
}

module.exports = {
  getStudentAiInsights
};
