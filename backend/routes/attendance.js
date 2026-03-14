const express = require('express');
const router = express.Router();
const db = require('../db'); // อย่าลืมเช็ค path ของ db ให้ตรงกับโปรเจกต์คุณ

// API: POST /api/attendance/clock-in (เข้างาน)
router.post('/clock-in', async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });

        // 1. เช็คว่าวันนี้กดเข้างานไปหรือยัง (ป้องกันการกดเบิ้ล)
        const [existing] = await db.query(
            'SELECT * FROM attendance_logs WHERE emp_id = ? AND work_date = CURDATE()',
            [emp_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'คุณได้บันทึกเวลาเข้างานของวันนี้ไปแล้ว' });
        }

        // 2. บันทึกเวลาเข้างาน (ใช้ CURDATE() และ NOW() ของ MySQL)
        await db.query(
            'INSERT INTO attendance_logs (emp_id, work_date, check_in_time) VALUES (?, CURDATE(), NOW())',
            [emp_id]
        );

        res.status(200).json({ message: 'บันทึกเวลาเข้างานสำเร็จ!' });

    } catch (error) {
        console.error('Clock-In Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเวลาเข้างาน' });
    }
});

// API: POST /api/attendance/clock-out (เลิกงาน)
router.post('/clock-out', async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });

        // 1. เช็คว่าวันนี้ได้กดเข้างานหรือยัง
        const [existing] = await db.query(
            'SELECT * FROM attendance_logs WHERE emp_id = ? AND work_date = CURDATE()',
            [emp_id]
        );

        if (existing.length === 0) {
            return res.status(400).json({ message: 'ไม่พบข้อมูลการเข้างานของวันนี้ กรุณากดเข้างานก่อน' });
        }

        if (existing[0].check_out_time !== null) {
            return res.status(400).json({ message: 'คุณได้บันทึกเวลาเลิกงานไปแล้ว' });
        }

        // 2. อัปเดตเวลาเลิกงาน
        await db.query(
            'UPDATE attendance_logs SET check_out_time = NOW() WHERE emp_id = ? AND work_date = CURDATE()',
            [emp_id]
        );

        res.status(200).json({ message: 'บันทึกเวลาเลิกงานสำเร็จ เดินทางกลับปลอดภัยครับ!' });

    } catch (error) {
        console.error('Clock-Out Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเวลาเลิกงาน' });
    }
});

module.exports = router;