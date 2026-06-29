/**
 * Abstract base class representing a data source for fetching contest metrics.
 */
class ContestDataSource {
  /**
   * Fetch details of a contest.
   * @param {string} contestSlug - The unique identifier of the contest.
   * @returns {Promise<object>}
   */
  async fetchContest(contestSlug) {
    throw new Error('Method "fetchContest()" must be implemented by subclasses.');
  }

  /**
   * Fetch leaderboard rankings for a contest.
   * @param {string} contestSlug - Contest slug.
   * @param {number} page - Page number.
   * @returns {Promise<object>}
   */
  async fetchLeaderboard(contestSlug, page) {
    throw new Error('Method "fetchLeaderboard()" must be implemented by subclasses.');
  }

  /**
   * Fetch contest participation history for a user.
   * @param {string} username - Competitive programming username.
   * @returns {Promise<Array<object>>}
   */
  async fetchContestHistory(username) {
    throw new Error('Method "fetchContestHistory()" must be implemented by subclasses.');
  }

  /**
   * Fetch rating details/history for a user.
   * @param {string} username - Username.
   * @returns {Promise<Array<object>>}
   */
  async fetchRatings(username) {
    throw new Error('Method "fetchRatings()" must be implemented by subclasses.');
  }

  /**
   * Fetch general profile stats for a user.
   * @param {string} username - Username.
   * @returns {Promise<object>}
   */
  async fetchProfile(username) {
    throw new Error('Method "fetchProfile()" must be implemented by subclasses.');
  }

  /**
   * Fetch recent submissions for a user.
   * @param {string} username - Username.
   * @returns {Promise<Array<object>>}
   */
  async fetchSubmissions(username) {
    throw new Error('Method "fetchSubmissions()" must be implemented by subclasses.');
  }
}

module.exports = ContestDataSource;
