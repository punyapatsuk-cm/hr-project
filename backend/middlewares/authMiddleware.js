// ============================================================
// middlewares/authMiddleware.js
// ใช้ครอบทุก Route ที่ต้องการ login ก่อนเข้าถึง
// ============================================================

const jwt = require('jsonwebtoken');

/**
 * verifyToken — ตรวจสอบ JWT token จาก Authorization header
 *
 * ใช้งาน: router.get('/path', verifyToken, controller)
 *
 * Frontend ต้องส่ง header:
 *   Authorization: Bearer <token>
 */
const verifyToken = (req, res, next) => {
    // ดึง token จาก header "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;
    const token      = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'ไม่มี Token กรุณาเข้าสู่ระบบก่อน' });
    }

    try {
        // ตรวจสอบและถอดรหัส token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { emp_id, role, dept_id }
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
};

/**
 * verifyAdmin — ตรวจสอบว่าเป็น admin เท่านั้น
 * ต้องใช้ต่อจาก verifyToken เสมอ
 *
 * ใช้งาน: router.get('/admin-path', verifyToken, verifyAdmin, controller)
 */
const verifyAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง เฉพาะ Admin เท่านั้น' });
    }
    next();
};

module.exports = { verifyToken, verifyAdmin };