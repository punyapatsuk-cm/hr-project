// ============================================================
// authRoutes.js — Routes สำหรับ Authentication
// ============================================================

const express        = require('express');
const router         = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/login — เข้าสู่ระบบ
router.post('/login', authController.login);

module.exports = router;