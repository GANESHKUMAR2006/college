/**
 * AI Insights Routes
 * ==================
 * Defines API routing endpoints for the AI Coaching Insights.
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middlewares/authMiddleware');

// Get AI Insights for a student profile
router.get('/insights/:studentId', authenticate, aiController.getStudentAiInsights);

module.exports = router;
