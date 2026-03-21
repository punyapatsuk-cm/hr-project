const express        = require('express');
const router         = express.Router();
const leaveController = require('../controllers/leaveController');
const upload          = require('../middlewares/upload');
const { verifyToken } = require('../middlewares/authMiddleware');

router.post('/request',          verifyToken, upload.single('attachment'), leaveController.requestLeave);
router.get('/history/:emp_id',   verifyToken, leaveController.getLeaveHistory);

module.exports = router;