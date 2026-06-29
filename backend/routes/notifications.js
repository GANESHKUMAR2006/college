const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/', notificationController.getNotifications);
router.get('/count', notificationController.getUnreadCount);
router.post('/read/:id', notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);
router.post('/archive/:id', notificationController.archiveNotification);

module.exports = router;
