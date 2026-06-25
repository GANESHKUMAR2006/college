const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Attendance routes
router.post('/upload', upload.single('file'), attendanceController.processContestUpload);
router.post('/override', attendanceController.overrideAttendance);
router.get('/contest/:contestId', attendanceController.getContestAttendance);
router.get('/student/:studentId', attendanceController.getStudentAttendanceHistory);

module.exports = router;
