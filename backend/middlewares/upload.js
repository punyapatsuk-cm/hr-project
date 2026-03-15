const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // ต้องสร้างโฟลเดอร์ uploads/ ไว้ในโปรเจกต์ด้วยนะครับ
    },
    filename: function (req, file, cb) {
        // ตั้งชื่อไฟล์: leave_เวลาปัจจุบัน.นามสกุลไฟล์
        cb(null, 'leave_' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf/;
        cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
    }
});

module.exports = upload;