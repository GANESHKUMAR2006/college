/**
 * Placement Routes
 * ================
 * Defines API routing endpoints for the Placement Dashboard.
 */

const express = require('express');
const router = express.Router();
const placementController = require('../controllers/placementController');
const { authenticate } = require('../middlewares/authMiddleware');

// All placement routes require authentication
router.get('/student/:studentId', authenticate, placementController.getStudentPlacementData);
router.get('/overview', authenticate, placementController.getPlacementOverview);

module.exports = router;
