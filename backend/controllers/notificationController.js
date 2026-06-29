/**
 * notificationController.js (UPDATED)
 * =====================================
 * Delegates to NotificationService. Supports severity filter, search, archive.
 */

const notificationService = require('../services/notificationService');

async function getNotifications(req, res) {
  const { severity, type, search, limit, unreadOnly, archived } = req.query;
  try {
    const alerts = await notificationService.getNotifications({
      severity,
      type,
      search,
      limit: limit ? Number(limit) : 50,
      unreadOnly: unreadOnly === 'true',
      archived: archived === 'true'
    });
    const unreadCount = await notificationService.getUnreadCount();
    return res.json({ success: true, data: alerts, unreadCount });
  } catch (error) {
    console.error('[NotificationController] Error fetching notifications:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve notifications' });
  }
}

async function markAsRead(req, res) {
  const { id } = req.params;
  try {
    await notificationService.markRead(Number(id));
    return res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('[NotificationController] Error marking notification as read:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
}

async function markAllAsRead(req, res) {
  try {
    await notificationService.markAllRead();
    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('[NotificationController] Error marking all as read:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
}

async function archiveNotification(req, res) {
  const { id } = req.params;
  try {
    await notificationService.archive(Number(id));
    return res.json({ success: true, message: 'Notification archived' });
  } catch (error) {
    console.error('[NotificationController] Error archiving notification:', error);
    return res.status(500).json({ success: false, message: 'Failed to archive notification' });
  }
}

async function getUnreadCount(req, res) {
  try {
    const count = await notificationService.getUnreadCount();
    return res.json({ success: true, unreadCount: count });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to get unread count' });
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  getUnreadCount
};
