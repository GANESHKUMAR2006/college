const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Student CRUD
router.get('/', studentController.getStudents);
router.post('/', studentController.addStudent);
router.put('/:id', studentController.editStudent);
router.delete('/:id', studentController.deleteStudent);

// Bulk operations
router.post('/import', upload.single('file'), studentController.bulkImportStudents);
router.post('/archive', studentController.archiveStudents);
router.post('/restore', studentController.restoreStudents);
router.get('/archive-summary', studentController.getArchivedSummary);
router.get('/batches', studentController.getUniqueBatches);
router.get('/sections', studentController.getUniqueSections);

// Handle verification helper
router.get('/verify-leetcode/:username', studentController.checkUsername);

// LeetCode Stats route
router.get('/:id/leetcode-stats', studentController.getLeetCodeStatsById);

module.exports = router;
