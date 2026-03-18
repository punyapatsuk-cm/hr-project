// ============================================================
// authController.js — จัดการ Login และออก JWT Token
// ============================================================

const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

const SALT_ROUNDS = 10;

// ข้อความ error เดียวกันทั้ง "ไม่พบ ID" และ "รหัสผ่านผิด"
// เพื่อป้องกัน Username Enumeration Attack
const INVALID_MSG = 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง';

// ============================================================
// login — ตรวจสอบ credentials และออก JWT Token
//
// รองรับ password 2 รูปแบบ:
//   1. bcrypt hash ($2b$...) → เปรียบเทียบด้วย bcrypt.compare()
//   2. plain text (account เก่า) → เปรียบตรงๆ แล้ว auto-upgrade เป็น bcrypt
// ============================================================
exports.login = async (req, res) => {
    try {
        const { emp_id, password } = req.body;

        if (!emp_id || !password) {
            return res.status(400).json({ message: 'กรุณากรอกรหัสพนักงานและรหัสผ่านให้ครบถ้วน' });
        }

        // ดึงข้อมูล user จาก DB
        const [users] = await db.query(
            'SELECT emp_id, first_name, last_name, role, dept_id, password FROM employees WHERE emp_id = ?',
            [emp_id]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: INVALID_MSG });
        }

        const user     = users[0];
        const isBcrypt = user.password?.startsWith('$2');
        let   isMatch  = false;

        if (isBcrypt) {
            // password เป็น bcrypt hash แล้ว
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            // password เป็น plain text → ตรวจตรงๆ แล้ว upgrade
            isMatch = (password === user.password);

            if (isMatch) {
                // auto-upgrade เป็น bcrypt ตอน login สำเร็จครั้งแรก
                try {
                    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
                    await db.query(
                        'UPDATE employees SET password = ? WHERE emp_id = ?',
                        [hashed, emp_id]
                    );
                    console.log(`🔒 Auto-upgraded password for ${emp_id} to bcrypt`);
                } catch (upgradeErr) {
                    // ไม่ block login ถ้า upgrade ล้มเหลว
                    console.error(`⚠️ Failed to upgrade password for ${emp_id}:`, upgradeErr.message);
                }
            }
        }

        if (!isMatch) {
            return res.status(401).json({ message: INVALID_MSG });
        }

        // ตรวจสอบ JWT_SECRET ก่อนออก token
        if (!process.env.JWT_SECRET) {
            console.error('❌ JWT_SECRET is not set in .env file!');
            return res.status(500).json({ message: 'การตั้งค่าเซิร์ฟเวอร์ไม่สมบูรณ์ กรุณาติดต่อผู้ดูแลระบบ' });
        }

        // ออก JWT Token อายุ 1 วัน
        const token = jwt.sign(
            { emp_id: user.emp_id, role: user.role, dept_id: user.dept_id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        console.log(`👤 User ${user.emp_id} logged in successfully.`);

        res.status(200).json({
            message: 'เข้าสู่ระบบสำเร็จ!',
            token,
            user: {
                emp_id: user.emp_id,
                name:   `${user.first_name} ${user.last_name}`,
                role:   user.role
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};