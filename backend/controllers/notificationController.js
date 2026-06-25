const db = require('../config/db');

async function getNotifications(req, res) {
  try {
    const alerts = await db.query(
      `SELECT n.*, u.name as student_name, u.roll_no as student_roll, c.title as contest_name
       FROM notifications n
       LEFT JOIN Users u ON n.student_id = u.id
       LEFT JOIN Contests c ON n.contest_id = c.contest_id
       ORDER BY n.is_read ASC, n.created_at DESC
       LIMIT 50`
    );
    return res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve notifications' });
  }
}

async function markAsRead(req, res) {
  const { id } = req.params;
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
}

async function markAllAsRead(req, res) {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE');
    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead
};
