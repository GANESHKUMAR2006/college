const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// Public auth routes
router.post('/login', authController.login);

// Protected auth routes
router.get('/me', authenticate, authController.me);
router.post('/register', authenticate, authorize(['Super Admin']), authController.register);

module.exports = router;
