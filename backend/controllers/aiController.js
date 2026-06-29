/**
 * AiController
 * ============
 * Exposes endpoints to retrieve personalized AI recommendations, predictions, and consistency alerts for students.
 */

const aiService = require('../services/aiService');
const cache = require('../services/analyticsCacheService');

/**
 * Get AI Coaching Insights for a student.
 */
async function getStudentAiInsights(req, res) {
  const studentId = parseInt(req.params.studentId);
  if (isNaN(studentId)) {
    return res.status(400).json({ success: false, message: 'Invalid student ID' });
  }

  // RBAC Check: Students can only view their own AI coaching insights
  if (req.user.role === 'Student' && req.user.studentId !== studentId) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: You are not authorized to view AI insights for this student.'
    });
  }

  try {
    const cacheKey = cache.KEYS.AI_INSIGHTS(studentId);
    const data = await cache.getOrCompute(cacheKey, async () => {
      return await aiService.getStudentAiInsights(studentId);
    }, 15 * 60 * 1000); // 15 minutes cache

    return res.json({ success: true, data });
  } catch (error) {
    console.error(`[AiController] Error fetching AI insights:`, error.message);
    if (error.message === 'Student not found') {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  getStudentAiInsights
};
