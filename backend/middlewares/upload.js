const multer = require('multer');
const path   = require('path');

const ALLOWED_TYPES = /jpeg|jpg|png|pdf/;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        cb(null, `leave_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits:     { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const isAllowed = ALLOWED_TYPES.test(path.extname(file.originalname).toLowerCase());
        cb(null, isAllowed);
    }
});

module.exports = upload;