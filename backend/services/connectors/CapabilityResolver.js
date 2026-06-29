const FeatureFlags = require('../../config/featureFlags');

/**
 * Enterprise-grade Capability Resolver that dynamically binds requested operations
 * (capabilities) to the highest-priority enabled data source. Supports failovers and caching.
 */
class CapabilityResolver {
  /**
   * @param {string} providerName - Name of the provider (e.g. 'LeetCode')
   * @param {object} capabilitiesConfig - Mapping of capability keys to array of source keys, in priority order.
   */
  constructor(providerName, capabilitiesConfig) {
    this.providerName = providerName;
    this.capabilitiesConfig = capabilitiesConfig || {};
    this.decisionsCache = {}; // Caches the last successful source key for each capability
    
    // Monitoring statistics
    this.healthStats = {
      requests: 0,
      successes: 0,
      failures: 0,
      failovers: 0,
      lastActiveSources: {}
    };
  }

  /**
   * Resolves a capability by attempting data sources in priority order.
   * @param {string} capability - Capability requested (e.g. 'liveParticipation')
   * @param {object} sourcesMap - Object mapping source keys to ContestDataSource instances.
   * @param {string} methodName - Method to invoke on the datasource.
   * @param {Array} args - Arguments to pass to the method.
   * @returns {Promise<any>} - Data returned by the successful data source.
   */
  async resolve(capability, sourcesMap, methodName, args = []) {
    this.healthStats.requests++;
    const sourcesList = this.capabilitiesConfig[capability] || [];

    if (sourcesList.length === 0) {
      throw new Error(`Capability "${capability}" is not configured for provider "${this.providerName}".`);
    }

    const errors = [];
    
    // Check if we have a cached successful source decision. If so, attempt it first.
    const cachedSourceKey = this.decisionsCache[capability];
    const orderedSources = cachedSourceKey
      ? [cachedSourceKey, ...sourcesList.filter(s => s !== cachedSourceKey)]
      : sourcesList;

    for (const sourceKey of orderedSources) {
      // Map source key to feature flag key
      const flagMap = {
        api: 'graphql',
        graphql: 'graphql',
        leaderboard: 'leaderboard',
        scraper: 'scraper',
        cache: 'cache',
        database: 'cache'
      };

      const flagKey = flagMap[sourceKey] || sourceKey;
      
      // Skip if the datasource is disabled via feature flags
      if (!FeatureFlags.isEnabled(flagKey)) {
        continue;
      }

      const dataSource = sourcesMap[sourceKey];
      if (!dataSource) {
        continue; // Datasource strategy not registered
      }

      if (typeof dataSource[methodName] !== 'function') {
        continue; // Method not supported by this datasource
      }

      try {
        const result = await dataSource[methodName](...args);

        // Update decisions cache and emit event on transition
        if (this.decisionsCache[capability] !== sourceKey) {
          const previousSource = this.decisionsCache[capability];
          this.decisionsCache[capability] = sourceKey;
          this.healthStats.lastActiveSources[capability] = sourceKey;

          // Require EventBus dynamically to avoid circular dependencies on startup
          const EventBus = require('../EventBus');
          EventBus.emit('DatasourceChanged', {
            provider: this.providerName,
            capability,
            previous: previousSource || null,
            current: sourceKey
          });
        }

        this.healthStats.successes++;
        return result;
      } catch (err) {
        console.warn(`[CapabilityResolver] Failed to resolve capability "${capability}" using source "${sourceKey}": ${err.message}`);
        errors.push({ sourceKey, error: err.message });
        this.healthStats.failovers++;

        // Clear the decision cache for this capability on failure to force re-evaluation
        if (cachedSourceKey === sourceKey) {
          delete this.decisionsCache[capability];
        }
      }
    }

    this.healthStats.failures++;
    const errorDetails = errors.map(e => `${e.sourceKey}: ${e.error}`).join('; ');
    const errorMsg = `Failed to resolve capability "${capability}" for provider "${this.providerName}". Tried [${orderedSources.join(', ')}]. Details: ${errorDetails}`;
    
    // Emit ProviderFailed event on complete capability failure
    const EventBus = require('../EventBus');
    EventBus.emit('ProviderFailed', {
      provider: this.providerName,
      capability,
      error: errorMsg
    });

    throw new Error(errorMsg);
  }

  /**
   * Returns current health metrics for this capability resolver.
   * @returns {object}
   */
  getHealth() {
    const totalRequests = this.healthStats.requests;
    const successRate = totalRequests > 0 ? (this.healthStats.successes / totalRequests) * 100 : 100;
    return {
      successRate: parseFloat(successRate.toFixed(2)),
      ...this.healthStats,
      decisions: { ...this.decisionsCache }
    };
  }
}

module.exports = CapabilityResolver;
