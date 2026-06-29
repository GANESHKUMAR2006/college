const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const FeatureFlags = {
  graphql: process.env.FF_GRAPHQL !== 'false',
  leaderboard: process.env.FF_LEADERBOARD !== 'false',
  scraper: process.env.FF_SCRAPER !== 'false',
  cache: process.env.FF_CACHE !== 'false',
  liveTracking: process.env.FF_LIVE_TRACKING !== 'false',
  ratingTracking: process.env.FF_RATING_TRACKING !== 'false',
  analytics: process.env.FF_ANALYTICS !== 'false',

  /**
   * Helper to check if a specific capability/strategy is enabled.
   * @param {string} flag - Flag key.
   * @returns {boolean}
   */
  isEnabled(flag) {
    return !!this[flag];
  }
};

module.exports = FeatureFlags;
