const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.get('/student/:studentId', analyticsController.getStudentAnalytics);
router.get('/leaderboards', analyticsController.getLeaderboards);
router.get('/departments', analyticsController.getDepartmentAnalytics);
router.get('/portal-summary', analyticsController.getPortalSummary);

module.exports = router;
