const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'enthra_hub_secret_key_2026';

/**
 * Authentication check middleware.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, studentId }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authorization token' });
  }
}

/**
 * Role authorization middleware.
 * @param {Array<string>} roles - List of allowed roles
 */
function authorize(roles = []) {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not allowed to perform this action`
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  authorize,
  JWT_SECRET
};
