/**
 * PlacementController
 * ===================
 * Controller layer exposing endpoints for student placement data and placement reports.
 * Implements RBAC and cache-aside fetching.
 */

const placementService = require('../services/placementService');
const cache = require('../services/analyticsCacheService');

/**
 * Get placement readiness details for a specific student.
 */
async function getStudentPlacementData(req, res) {
  const studentId = parseInt(req.params.studentId);
  if (isNaN(studentId)) {
    return res.status(400).json({ success: false, message: 'Invalid student ID' });
  }

  // RBAC: Students can only view their own placement data
  if (req.user.role === 'Student' && req.user.studentId !== studentId) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Students are not authorized to view other profiles.'
    });
  }

  try {
    const cacheKey = cache.KEYS.PLACEMENT_STUDENT(studentId);
    const data = await cache.getOrCompute(cacheKey, async () => {
      return await placementService.getStudentPlacementData(studentId);
    }, 10 * 60 * 1000); // 10 minutes cache

    return res.json({ success: true, data });
  } catch (error) {
    console.error(`[PlacementController] Error fetching student placement data:`, error.message);
    if (error.message === 'Student not found') {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Get placement aggregate stats (Admin/Faculty only).
 */
async function getPlacementOverview(req, res) {
  // RBAC: Students are not authorized to view the aggregate placement statistics
  if (req.user.role === 'Student') {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Only staff and placement coordinators can view placement overview aggregates.'
    });
  }

  const { department, academicBatch } = req.query;

  try {
    const filterKey = `${department || 'all'}:${academicBatch || 'all'}`;
    const cacheKey = cache.KEYS.PLACEMENT_OVERVIEW(filterKey);

    const data = await cache.getOrCompute(cacheKey, async () => {
      return await placementService.getPlacementOverview({ department, academicBatch });
    }, 5 * 60 * 1000); // 5 minutes cache

    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[PlacementController] Error fetching placement overview:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  getStudentPlacementData,
  getPlacementOverview
};
