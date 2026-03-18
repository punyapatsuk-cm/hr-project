// ============================================================
// upload.js — Multer config สำหรับอัปโหลดไฟล์แนบใบลา
// ============================================================

const multer = require('multer');
const path   = require('path');

// ประเภทไฟล์ที่อนุญาต
const ALLOWED_TYPES = /jpeg|jpg|png|pdf/;

// กำหนดที่เก็บและชื่อไฟล์
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // ต้องมีโฟลเดอร์ uploads/ ในโปรเจกต์
    },
    filename: (req, file, cb) => {
        // รูปแบบชื่อ: leave_<timestamp>.<นามสกุล>
        cb(null, `leave_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits:     { fileSize: 5 * 1024 * 1024 }, // จำกัด 5MB
    fileFilter: (req, file, cb) => {
        const isAllowed = ALLOWED_TYPES.test(path.extname(file.originalname).toLowerCase());
        cb(null, isAllowed);
    }
});

module.exports = upload;