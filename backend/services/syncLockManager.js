/**
 * Global synchronization lock broker (Singleton) to prevent overlapping sync executions.
 */
class SyncLockManager {
  constructor() {
    this.lockState = 'Idle'; // 'Idle', 'Running', 'Failed', 'Completed'
    this.activeContestId = null;
    this.lockTime = null;
  }

  /**
   * Attempts to acquire the lock for a contest.
   * @param {number|string} contestId - The contest identifier.
   * @returns {boolean} - Returns true if lock was acquired successfully, false otherwise.
   */
  acquire(contestId) {
    if (this.lockState === 'Running') {
      console.warn(`[SyncLockManager] Lock request DENIED. Another sync is running for Contest ID: ${this.activeContestId}`);
      return false;
    }
    this.lockState = 'Running';
    this.activeContestId = contestId;
    this.lockTime = new Date();
    console.log(`[SyncLockManager] Lock ACQUIRED for Contest ID: ${contestId}`);
    return true;
  }

  /**
   * Releases the lock and sets the final synchronization state.
   * @param {string} finalState - State to set ('Completed', 'Failed', or 'Idle')
   */
  release(finalState = 'Completed') {
    if (!['Completed', 'Failed', 'Idle'].includes(finalState)) {
      throw new Error(`Invalid sync final lock state: ${finalState}`);
    }
    console.log(`[SyncLockManager] Lock RELEASED for Contest ID: ${this.activeContestId}. State transitions to: ${finalState}`);
    this.lockState = finalState;
    this.activeContestId = null;
    this.lockTime = null;
  }

  /**
   * Checks if a synchronization task is currently executing.
   * @returns {boolean}
   */
  isRunning() {
    return this.lockState === 'Running';
  }

  /**
   * Returns current lock state details.
   * @returns {object}
   */
  getStatus() {
    return {
      state: this.lockState,
      activeContestId: this.activeContestId,
      lockTime: this.lockTime
    };
  }
}

// Export a singleton instance
module.exports = new SyncLockManager();
