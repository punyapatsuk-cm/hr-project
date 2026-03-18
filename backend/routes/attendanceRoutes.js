// ============================================================
// attendanceRoutes.js — Routes สำหรับระบบลงเวลา
// ============================================================

const express               = require('express');
const router                = express.Router();
const attendanceController  = require('../controllers/attendanceController');
const { verifyToken }       = require('../middlewares/authMiddleware');

// POST /api/attendance/clock-in  — บันทึกเวลาเข้างาน
router.post('/clock-in',       verifyToken, attendanceController.clockIn);

// POST /api/attendance/clock-out — บันทึกเวลาเลิกงาน
router.post('/clock-out',      verifyToken, attendanceController.clockOut);

// GET  /api/attendance/history/:emp_id — ประวัติลงเวลา 30 วันล่าสุด
router.get('/history/:emp_id', verifyToken, attendanceController.getHistory);

module.exports = router;