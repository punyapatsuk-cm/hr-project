const express = require('express');
const router = express.Router();
const db = require('../db'); // ชี้ไปที่ไฟล์เชื่อมต่อ Database ของคุณ
const multer = require('multer');
const path = require('path');

// 🌟 ตั้งค่า Multer สำหรับอัปโหลดไฟล์ (เช่น ใบรับรองแพทย์)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // บันทึกไฟล์ไปที่โฟลเดอร์ uploads/ ที่เราสร้างไว้
    },
    filename: function (req, file, cb) {
        // เปลี่ยนชื่อไฟล์ใหม่ไม่ให้ซ้ำกัน โดยใช้คำว่า leave_ ตามด้วยเวลา(Timestamp) และนามสกุลไฟล์เดิม
        cb(null, 'leave_' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// 📩 API: POST /api/leave/request (ส่งคำขอลางาน)
// ==========================================
// ใช้ upload.single('attachment') เพื่อรับไฟล์ 1 ไฟล์ที่แนบมากับชื่อช่อง 'attachment'
router.post('/request', upload.single('attachment'), async (req, res) => {
    try {
        const { emp_id, leave_type, start_date, end_date, reason } = req.body;

        // เช็คว่ามีการแนบไฟล์มาไหม ถ้ามีให้เก็บชื่อไฟล์ที่ถูกสร้างใหม่ ถ้าไม่มีให้เป็น null
        const attachment = req.file ? req.file.filename : null;

        if (!emp_id || !leave_type || !start_date || !end_date) {
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        // บันทึกข้อมูลลงตาราง leave_requests (สถานะเริ่มต้นจะเป็น 'Pending' รอ HR อนุมัติ)
        const sql = `
            INSERT INTO leave_requests (emp_id, leave_type, start_date, end_date, reason, attachment, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
        `;

        await db.query(sql, [emp_id, leave_type, start_date, end_date, reason, attachment]);

        res.status(200).json({ message: 'ส่งคำขอลางานสำเร็จ! ระบบได้บันทึกและส่งเรื่องให้ HR แล้ว' });

    } catch (error) {
        console.error('Leave Request Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ ไม่สามารถส่งคำขอลางานได้' });
    }
});
// ==========================================
// 📋 API: GET /api/leave/history/:emp_id (ดึงประวัติการลางาน)
// ==========================================
router.get('/history/:emp_id', async (req, res) => {
    try {
        const empId = req.params.emp_id;

        // ดึงข้อมูลการลาเรียงจากใหม่ไปเก่า
        const sql = `
            SELECT leave_id, leave_type, start_date, end_date, reason, status, created_at 
            FROM leave_requests 
            WHERE emp_id = ? 
            ORDER BY created_at DESC
        `;
        const [results] = await db.query(sql, [empId]);
        res.status(200).json(results);

    } catch (error) {
        console.error('Leave History Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงประวัติการลางาน' });
    }
});

module.exports = router;