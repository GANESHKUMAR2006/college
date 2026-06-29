const fs = require('fs');
const path = require('path');
const ContestProvider = require('./ContestProvider');
const CapabilityResolver = require('./CapabilityResolver');
const leetcodeUtils = require('../../utils/leetcode');

/**
 * LeetCode Platform Provider supporting GraphQL queries, Leaderboard scraping, and local file fallbacks.
 */
class LeetCodeProvider extends ContestProvider {
  constructor() {
    super();
    this.name = 'LeetCode';
    this.cacheDir = path.resolve(__dirname, '../../cache/leetcode');
    fs.mkdirSync(this.cacheDir, { recursive: true });

    // Capability Resolver configuration
    this.resolver = new CapabilityResolver('LeetCode', {
      contestDetection: ['graphql', 'cache'],
      liveParticipation: ['cache', 'leaderboard'],
      ratingHistory: ['graphql', 'cache'],
      contestHistory: ['graphql', 'cache']
    });

    // In-memory indexing cache
    this.leaderboardIndices = {}; // contestSlug -> { username: stats }
    this.lastCacheRefresh = {}; // contestSlug -> timestamp
    this.isRefreshingCache = {}; // contestSlug -> boolean
  }

  /**
   * Helper to return datasource strategies for the capability resolver.
   */
  _getSources(contestSlug) {
    return {
      graphql: {
        fetchContests: async () => {
          const list = await leetcodeUtils.getRecentContests();
          return list.map(c => {
            const startTimeMs = c.startTime * 1000;
            const durationMs = c.duration * 1000;
            const startTime = new Date(startTimeMs);
            const endTime = new Date(startTimeMs + durationMs);

            let status = 'Upcoming';
            const now = Date.now();
            if (now >= startTimeMs && now <= startTimeMs + durationMs) {
              status = 'Live';
            } else if (now > startTimeMs + durationMs) {
              status = 'Completed';
            }

            return {
              contestSlug: c.titleSlug,
              contestName: c.title,
              contestType: c.title.toLowerCase().includes('biweekly') ? 'Biweekly' : 'Weekly',
              startTime,
              endTime,
              platform: 'LeetCode',
              status
            };
          });
        },
        fetchRatings: async (username) => {
          return await leetcodeUtils.getUserContestRankingAndHistory(username);
        },
        fetchContestHistory: async (username) => {
          return await leetcodeUtils.getUserContestHistory(username);
        }
      },
      leaderboard: {
        fetchStudentStatus: async (username, slug) => {
          // If a refresh is not currently running and the cache is older than 4 minutes, trigger background download
          const lastRefresh = this.lastCacheRefresh[slug] || 0;
          const now = Date.now();
          
          if (!this.isRefreshingCache[slug] && (now - lastRefresh > 4 * 60 * 1000)) {
            console.log(`[LeetCodeProvider] Cache is stale for contest "${slug}". Re-fetching leaderboard pages...`);
            // Run cache refresh asynchronously in the background to prevent blocking current requests
            this.refreshLeaderboardCache(slug).catch(err => {
              console.error(`[LeetCodeProvider] Leaderboard background caching failed:`, err.message);
            });
          }

          // Read from memory index
          const index = this.leaderboardIndices[slug] || {};
          const stats = index[username];
          if (stats) {
            return {
              participating: true,
              rank: stats.rank,
              solved: stats.solved,
              score: stats.score,
              penalty: stats.penalty,
              ratingBefore: stats.ratingBefore
            };
          }
          return { participating: false };
        }
      },
      cache: {
        fetchContests: async () => {
          const cacheFile = path.join(this.cacheDir, 'contests_cache.json');
          if (fs.existsSync(cacheFile)) {
            const raw = fs.readFileSync(cacheFile, 'utf8');
            const data = JSON.parse(raw);
            return data.map(c => ({
              ...c,
              startTime: new Date(c.startTime),
              endTime: new Date(c.endTime)
            }));
          }
          throw new Error('Contest cache file not found');
        },
        fetchStudentStatus: async (username, slug) => {
          // Load index from disk if not already loaded in memory
          if (!this.leaderboardIndices[slug]) {
            this._loadLeaderboardFromDisk(slug);
          }
          const index = this.leaderboardIndices[slug] || {};
          const stats = index[username];
          if (stats) {
            return {
              participating: true,
              rank: stats.rank,
              solved: stats.solved,
              score: stats.score,
              penalty: stats.penalty,
              ratingBefore: stats.ratingBefore
            };
          }
          return { participating: false };
        },
        fetchRatings: async (username) => {
          const file = path.join(this.cacheDir, `rating_${username}.json`);
          if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
          }
          throw new Error(`Rating cache not found for ${username}`);
        },
        fetchContestHistory: async (username) => {
          const file = path.join(this.cacheDir, `history_${username}.json`);
          if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
          }
          throw new Error(`Contest history cache not found for ${username}`);
        }
      }
    };
  }

  /**
   * Scrapes leaderboard pages page-by-page from LeetCode and stores them locally.
   * @param {string} contestSlug - LeetCode contest slug.
   * @param {number} maxPages - Page scrape ceiling.
   */
  async refreshLeaderboardCache(contestSlug, maxPages = 40) {
    if (this.isRefreshingCache[contestSlug]) return;
    this.isRefreshingCache[contestSlug] = true;
    
    console.log(`[LeetCodeProvider] Rebuilding leaderboard cache for "${contestSlug}"...`);
    const contestDir = path.join(this.cacheDir, contestSlug);
    fs.mkdirSync(contestDir, { recursive: true });

    const newIndex = {};

    try {
      let page = 1;
      let emptyPagesCount = 0;
      
      while (page <= maxPages && emptyPagesCount < 3) {
        try {
          const data = await leetcodeUtils.getContestRankingPage(contestSlug, page);
          
          if (data && data.total_rank && data.total_rank.length > 0) {
            // Write page to disk cache
            fs.writeFileSync(
              path.join(contestDir, `page_${page}.json`),
              JSON.stringify(data, null, 2),
              'utf8'
            );

            // Index users
            for (const item of data.total_rank) {
              newIndex[item.username] = {
                rank: item.rank,
                solved: item.score ? Math.floor(item.score / 3) : 0, // simple estimate or parse problems
                score: item.score ? parseFloat(item.score) : 0.00,
                penalty: item.finish_time ? parseInt(item.finish_time, 10) : 0,
                ratingBefore: null // calculated during rating adjustments
              };
            }
            emptyPagesCount = 0;
          } else {
            emptyPagesCount++;
          }
        } catch (pageErr) {
          console.warn(`[LeetCodeProvider] Failed to fetch page ${page} of "${contestSlug}": ${pageErr.message}`);
        }
        page++;
        // Add a slight delay to respect LeetCode rate limits
        await new Promise(res => setTimeout(res, 200));
      }

      this.leaderboardIndices[contestSlug] = newIndex;
      this.lastCacheRefresh[contestSlug] = Date.now();
      
      // Also write merged index JSON for standalone cache recovery
      fs.writeFileSync(
        path.join(this.cacheDir, `${contestSlug}_index.json`),
        JSON.stringify(newIndex, null, 2),
        'utf8'
      );

      console.log(`[LeetCodeProvider] Completed cache rebuild for "${contestSlug}". Indexed ${Object.keys(newIndex).length} participants.`);
    } finally {
      this.isRefreshingCache[contestSlug] = false;
    }
  }

  /**
   * Internal helper to load indexes from disk files.
   */
  _loadLeaderboardFromDisk(contestSlug) {
    const file = path.join(this.cacheDir, `${contestSlug}_index.json`);
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, 'utf8');
        this.leaderboardIndices[contestSlug] = JSON.parse(raw);
        console.log(`[LeetCodeProvider] Loaded "${contestSlug}" leaderboard index from disk cache.`);
      } catch (err) {
        console.error(`[LeetCodeProvider] Disk cache reading error:`, err.message);
      }
    }
  }

  // --- Provider interfaces implementations ---

  async detectContest() {
    return await this.resolver.resolve('contestDetection', this._getSources(), 'fetchContests');
  }

  async getCurrentContest() {
    const list = await this.detectContest();
    const live = list.find(c => c.status === 'Live');
    if (live) return live;
    const upcoming = list.find(c => c.status === 'Upcoming');
    if (upcoming) return upcoming;
    return list[0] || null;
  }

  async getStudentContestStatus(username, contestSlug) {
    return await this.resolver.resolve(
      'liveParticipation', 
      this._getSources(contestSlug), 
      'fetchStudentStatus', 
      [username, contestSlug]
    );
  }

  async getStudentRating(username) {
    const res = await this.resolver.resolve('ratingHistory', this._getSources(), 'fetchRatings', [username]);
    return res.userContestRankingHistory || [];
  }

  async getStudentContestHistory(username) {
    return await this.resolver.resolve('contestHistory', this._getSources(), 'fetchContestHistory', [username]);
  }

  async finalizeContest(contestId) {
    console.log(`[LeetCodeProvider] Finalizing contest ID: ${contestId}`);
    return true;
  }
}

module.exports = LeetCodeProvider;
