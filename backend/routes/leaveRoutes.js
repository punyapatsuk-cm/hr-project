// ============================================================
// leaveRoutes.js — Routes สำหรับระบบลางาน
// ============================================================

const express         = require('express');
const router          = express.Router();
const leaveController = require('../controllers/leaveController');
const upload          = require('../middlewares/upload');
const { verifyToken } = require('../middlewares/authMiddleware');

// POST /api/leave/request          — ส่งคำขอลางาน (รับไฟล์แนบได้)
router.post('/request',        verifyToken, upload.single('attachment'), leaveController.requestLeave);

// GET  /api/leave/history/:emp_id  — ประวัติการลางานของพนักงาน
router.get('/history/:emp_id', verifyToken, leaveController.getLeaveHistory);

module.exports = router;