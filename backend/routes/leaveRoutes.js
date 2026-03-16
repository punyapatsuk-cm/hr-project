// ============================================================
// routes/leaveRoutes.js
// Routes สำหรับระบบลางาน
// ============================================================

const express        = require('express');
const router         = express.Router();
const leaveController = require('../controllers/leaveController');
const upload          = require('../middlewares/upload');
const { verifyToken } = require('../middlewares/authMiddleware');

// BUG FIX: เพิ่ม verifyToken ทุก route
// เดิมไม่มี middleware ป้องกันเลย
router.post('/request',          verifyToken, upload.single('attachment'), leaveController.requestLeave);
router.get('/history/:emp_id',   verifyToken, leaveController.getLeaveHistory);

module.exports = router;