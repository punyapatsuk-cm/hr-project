// ============================================================
// authMiddleware.js — ตรวจสอบสิทธิ์ก่อนเข้าถึง Route
// ============================================================

const jwt = require('jsonwebtoken');

// ============================================================
// verifyToken — ตรวจสอบ JWT Token จาก Authorization header
// ใช้งาน: router.get('/path', verifyToken, controller)
// ============================================================
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'ไม่มี Token กรุณาเข้าสู่ระบบก่อน' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET); // { emp_id, role, dept_id }
        next();
    } catch {
        return res.status(403).json({ message: 'Token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
};

// ============================================================
// verifyAdmin — ตรวจสอบว่าเป็น admin เท่านั้น
// ต้องใช้ต่อจาก verifyToken เสมอ
// ใช้งาน: router.get('/path', verifyToken, verifyAdmin, controller)
// ============================================================
const verifyAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง เฉพาะ Admin เท่านั้น' });
    }
    next();
};

module.exports = { verifyToken, verifyAdmin };