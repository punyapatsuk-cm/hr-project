const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

router.post('/clock-in', attendanceController.clockIn);
router.post('/clock-out', attendanceController.clockOut);

// 🌟 เพิ่มบรรทัดนี้ เพื่อให้หน้าเว็บดึงประวัติได้
router.get('/history/:emp_id', attendanceController.getHistory); 

module.exports = router;