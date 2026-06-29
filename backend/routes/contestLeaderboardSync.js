/**
 * contestLeaderboardSync.js
 * =========================
 * Route definitions for LeetCode Leaderboard Sync.
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/contestLeaderboardSyncController');

// Start background synchronization
router.post('/sync/:contestSlug', controller.startSync);

// Get synchronization background job status
router.get('/sync/status/:jobId', controller.getSyncStatus);

// Cancel active/pending sync job
router.post('/sync/cancel/:jobId', controller.cancelSync);

// Retry a failed or cancelled sync job
router.post('/sync/retry/:jobId', controller.retrySync);

// View memory active jobs and database sync history logs
router.get('/sync/history', controller.getSyncHistory);

module.exports = router;
