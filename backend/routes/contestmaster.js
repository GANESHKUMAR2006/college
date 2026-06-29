const express = require('express');
const router = express.Router();
const contestmasterController = require('../controllers/contestmasterController');

// Get available batches dynamically
router.get('/batches', contestmasterController.getContestMasterBatches);

// Live tracker endpoints (placed before platform route param to avoid route parameter collision)
router.get('/live/current', contestmasterController.getLiveCurrent);
router.get('/live/students', contestmasterController.getLiveStudents);
router.get('/live/analytics', contestmasterController.getLiveAnalytics);
router.get('/live/health', contestmasterController.getLiveHealth);
router.get('/live/stream', contestmasterController.getLiveStream);
router.post('/live/control', contestmasterController.triggerLiveControl);

// Get platform-specific analytics and contests
router.get('/:platform', contestmasterController.getPlatformAnalytics);

module.exports = router;
