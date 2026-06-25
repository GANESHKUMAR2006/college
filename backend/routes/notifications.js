const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/', notificationController.getNotifications);
router.post('/read/:id', notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);

module.exports = router;
