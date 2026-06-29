const ContestProvider = require('./ContestProvider');

/**
 * Mock Contest Provider for verifying the synchronization engine.
 */
class MockProvider extends ContestProvider {
  constructor() {
    super();
    this.name = 'MockPlatform';
    this.healthScore = 100;
    this.currentDatasource = 'MockGraphQL';
    this.failoverCount = 0;
    
    // Mock user statistics database
    this.mockDatabase = {
      'user_present_1': { rank: 5, solved: 4, score: 18.0, penalty: 1200 },
      'user_present_2': { rank: 22, solved: 3, score: 12.0, penalty: 2400 },
      'user_present_3': { rank: 110, solved: 2, score: 7.0, penalty: 3600 }
    };
  }

  async detectContest() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 30 * 60 * 1000); // started 30 mins ago
    const endTime = new Date(now.getTime() + 60 * 60 * 1000); // ends in 1 hour
    
    return [{
      contestSlug: 'mock-weekly-contest-1',
      contestName: 'Mock Weekly Contest 1',
      contestType: 'Weekly',
      startTime,
      endTime,
      platform: 'LeetCode',
      status: 'Live'
    }];
  }

  async getCurrentContest() {
    const list = await this.detectContest();
    return list[0] || null;
  }

  async getStudentContestStatus(username, contestSlug) {
    // Simulate slight network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const stats = this.mockDatabase[username];
    if (stats) {
      return {
        participating: true,
        rank: stats.rank,
        solved: stats.solved,
        score: stats.score,
        penalty: stats.penalty,
        ratingBefore: 1550.0
      };
    }
    return { participating: false };
  }

  async getStudentRating(username) {
    return [
      { contestName: 'Mock Weekly Contest 0', rating: 1550.0, rank: 300, date: new Date().toISOString() }
    ];
  }

  async getStudentContestHistory(username) {
    return [
      { contest: { title: 'Mock Weekly Contest 0' }, ranking: 300, problemsSolved: 2, rating: 1550.0 }
    ];
  }

  async finalizeContest(contestId) {
    console.log(`[MockProvider] Finalized contest ID: ${contestId}`);
    return true;
  }
}

module.exports = MockProvider;
