const express = require('express');
const router = express.Router();

// ดึง Controller และ Middleware ของคุณมาใช้งาน
const leaveController = require('../controllers/leaveController');
const upload = require('../middlewares/upload'); // สำหรับอัปโหลดไฟล์ (ถ้ามี)

// เชื่อมเส้นทาง API ไปยังฟังก์ชันใน Controller ที่คุณเขียนไว้
router.post('/request', upload.single('attachment'), leaveController.requestLeave);
router.get('/history/:emp_id', leaveController.getLeaveHistory);

module.exports = router;