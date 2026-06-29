/**
 * Abstract base class defining the contract for platform-specific contest providers.
 */
class ContestProvider {
  /**
   * Detect upcoming or live contests on the platform.
   * @returns {Promise<Array<object>>} - List of detected contests metadata.
   */
  async detectContest() {
    throw new Error('Method "detectContest()" must be implemented by subclasses.');
  }

  /**
   * Get active/live contest details.
   * @returns {Promise<object|null>} - Active contest details.
   */
  async getCurrentContest() {
    throw new Error('Method "getCurrentContest()" must be implemented by subclasses.');
  }

  /**
   * Get participation details of a student.
   * @param {string} username - Student's CP username.
   * @param {string} contestSlug - Contest slug/id.
   * @returns {Promise<object>} - Participation details (rank, solved, score, penalty, etc.)
   */
  async getStudentContestStatus(username, contestSlug) {
    throw new Error('Method "getStudentContestStatus()" must be implemented by subclasses.');
  }

  /**
   * Get student rating history.
   * @param {string} username - Student's CP username.
   * @returns {Promise<Array<object>>} - Rating history records.
   */
  async getStudentRating(username) {
    throw new Error('Method "getStudentRating()" must be implemented by subclasses.');
  }

  /**
   * Get student contest participation history.
   * @param {string} username - Student's CP username.
   * @returns {Promise<Array<object>>} - History of contests.
   */
  async getStudentContestHistory(username) {
    throw new Error('Method "getStudentContestHistory()" must be implemented by subclasses.');
  }

  /**
   * Run final synchronization.
   * @param {number} contestId - Database ID of the contest.
   */
  async finalizeContest(contestId) {
    throw new Error('Method "finalizeContest()" must be implemented by subclasses.');
  }
}

module.exports = ContestProvider;
