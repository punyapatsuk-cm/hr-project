// ============================================================
// routes/attendanceRoutes.js
// Routes สำหรับระบบลงเวลา
// ============================================================

const express = require('express');
const router  = express.Router();
const attendanceController        = require('../controllers/attendanceController');
const { verifyToken }             = require('../middlewares/authMiddleware');

// BUG FIX: เพิ่ม verifyToken ทุก route
// เดิมไม่มี middleware ป้องกันเลย — ใครก็เรียกได้โดยไม่ต้อง login
router.post('/clock-in',          verifyToken, attendanceController.clockIn);
router.post('/clock-out',         verifyToken, attendanceController.clockOut);
router.get('/history/:emp_id',    verifyToken, attendanceController.getHistory);

module.exports = router;