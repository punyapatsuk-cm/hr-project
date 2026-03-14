const express = require('express');
const router = express.Router();
const db = require('../db'); // เรียกใช้ฐานข้อมูล
const jwt = require('jsonwebtoken'); // ตัวสร้างบัตรผ่าน (Token)

// API: POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        // รับค่าที่ส่งมาจากหน้าเว็บ
        const { emp_id, password } = req.body;

        // 1. เช็คว่ากรอกข้อมูลครบไหม (Error Handling)
        if (!emp_id || !password) {
            return res.status(400).json({ message: 'กรุณากรอกรหัสพนักงานและรหัสผ่านให้ครบถ้วน' });
        }

        // 2. ค้นหาพนักงานในฐานข้อมูล
        const [users] = await db.query('SELECT * FROM employees WHERE emp_id = ?', [emp_id]);

        if (users.length === 0) {
            return res.status(401).json({ message: 'ไม่พบรหัสพนักงานนี้ในระบบ' });
        }

        const user = users[0];

        // 3. ตรวจสอบรหัสผ่าน 
        // (หมายเหตุ: ตอนนี้เราใช้รหัสผ่านธรรมดา 123456 ไปก่อน เดี๋ยวสเต็ปหน้าผมจะพาเข้ารหัส bcrypt ครับ)
        if (password !== user.password) {
            return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
        }

        // 4. สร้าง Token (บัตรผ่าน) เพื่อใช้ยืนยันตัวตนใน API อื่นๆ
        const token = jwt.sign(
            { emp_id: user.emp_id, role: user.role, dept_id: user.dept_id },
            process.env.JWT_SECRET || 'secret_key_for_hr_project',
            { expiresIn: '1d' } // บัตรผ่านหมดอายุใน 1 วัน
        );

        // 5. ส่งผลลัพธ์กลับไปให้หน้าเว็บ
        res.status(200).json({
            message: 'เข้าสู่ระบบสำเร็จ!',
            token: token,
            user: {
                emp_id: user.emp_id,
                name: `${user.first_name} ${user.last_name}`,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

module.exports = router;