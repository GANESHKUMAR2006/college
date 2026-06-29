const test = require('node:test');
const assert = require('node:assert/strict');

// Import the milestone 1 foundation files
const FeatureFlags = require('../config/featureFlags');
const EventBus = require('../services/EventBus');
const SyncLockManager = require('../services/syncLockManager');
const ContestProvider = require('../services/connectors/ContestProvider');
const ContestDataSource = require('../services/connectors/ContestDataSource');
const CapabilityResolver = require('../services/connectors/CapabilityResolver');

test('FeatureFlags - resolves default boolean settings', () => {
  assert.equal(typeof FeatureFlags.graphql, 'boolean');
  assert.equal(typeof FeatureFlags.cache, 'boolean');
  assert.equal(FeatureFlags.isEnabled('graphql'), FeatureFlags.graphql);
});

test('EventBus - publishes events to listeners successfully', () => {
  let eventReceived = false;
  let receivedPayload = null;

  EventBus.once('TestEvent', (payload) => {
    eventReceived = true;
    receivedPayload = payload;
  });

  EventBus.emit('TestEvent', { foo: 'bar' });

  assert.equal(eventReceived, true);
  assert.deepEqual(receivedPayload, { foo: 'bar' });
});

test('SyncLockManager - handles locking transitions correctly', () => {
  // Release any active locks just in case
  SyncLockManager.release('Idle');

  assert.equal(SyncLockManager.isRunning(), false);
  assert.equal(SyncLockManager.getStatus().state, 'Idle');

  // Attempt lock acquire
  const acquired = SyncLockManager.acquire(42);
  assert.equal(acquired, true);
  assert.equal(SyncLockManager.isRunning(), true);
  assert.equal(SyncLockManager.getStatus().state, 'Running');
  assert.equal(SyncLockManager.getStatus().activeContestId, 42);

  // Attempt duplicate lock acquire
  const duplicateAcquire = SyncLockManager.acquire(99);
  assert.equal(duplicateAcquire, false); // should be denied
  assert.equal(SyncLockManager.getStatus().activeContestId, 42);

  // Release lock
  SyncLockManager.release('Completed');
  assert.equal(SyncLockManager.isRunning(), false);
  assert.equal(SyncLockManager.getStatus().state, 'Completed');
  assert.equal(SyncLockManager.getStatus().activeContestId, null);
});

test('Abstractions - throw errors if methods called directly', async () => {
  const provider = new ContestProvider();
  const dataSource = new ContestDataSource();

  await assert.rejects(() => provider.detectContest(), /detectContest/);
  await assert.rejects(() => provider.getCurrentContest(), /getCurrentContest/);
  await assert.rejects(() => provider.getStudentContestStatus('user', 'slug'), /getStudentContestStatus/);

  await assert.rejects(() => dataSource.fetchContest('slug'), /fetchContest/);
  await assert.rejects(() => dataSource.fetchLeaderboard('slug', 1), /fetchLeaderboard/);
});

test('CapabilityResolver - selects highest-priority source and handles failover', async () => {
  // Mock data sources
  const mockApi = {
    fetchStudentStatus: async (user) => {
      if (user === 'fail') throw new Error('API Rate Limited');
      return { source: 'api', user };
    }
  };

  const mockCache = {
    fetchStudentStatus: async (user) => {
      return { source: 'cache', user };
    }
  };

  // Configure resolver: api has priority 1, cache has priority 2 (fallback)
  const resolver = new CapabilityResolver('MockPlatform', {
    liveParticipation: ['api', 'cache']
  });

  const sourcesMap = {
    api: mockApi,
    cache: mockCache
  };

  // Turn on feature flags explicitly for this test
  FeatureFlags.graphql = true; // api maps to graphql flag
  FeatureFlags.cache = true;

  // 1. Success case: resolves to highest priority 'api'
  const res1 = await resolver.resolve('liveParticipation', sourcesMap, 'fetchStudentStatus', ['john']);
  assert.deepEqual(res1, { source: 'api', user: 'john' });
  assert.equal(resolver.decisionsCache.liveParticipation, 'api');

  // 2. Failover case: 'api' fails, falls back to 'cache'
  // Since 'api' is the cached decision, we clear decisionCache to simulate initial failover test
  delete resolver.decisionsCache.liveParticipation;
  const res2 = await resolver.resolve('liveParticipation', sourcesMap, 'fetchStudentStatus', ['fail']);
  assert.deepEqual(res2, { source: 'cache', user: 'fail' });
  assert.equal(resolver.decisionsCache.liveParticipation, 'cache');
});
