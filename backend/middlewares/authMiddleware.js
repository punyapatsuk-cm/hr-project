const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'ไม่มี Token กรุณาเข้าสู่ระบบก่อน' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET); 
        next();
    } catch {
        return res.status(403).json({ message: 'Token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
};

const verifyAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง เฉพาะ Admin เท่านั้น' });
    }
    next();
};

module.exports = { verifyToken, verifyAdmin };