const bcrypt = require('bcrypt');
const db = require('../config/db');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    try {
        const { emp_id, password } = req.body;

        if (!emp_id || !password) {
            return res.status(400).json({ message: 'กรุณากรอกรหัสพนักงานและรหัสผ่านให้ครบถ้วน' });
        }

        const [users] = await db.query('SELECT * FROM employees WHERE emp_id = ?', [emp_id]);

        if (users.length === 0) {
            return res.status(401).json({ message: 'ไม่พบรหัสพนักงานนี้ในระบบ' });
        }
        const user = users[0];

        const isMatch = await bcrypt.compare(password, user.password);
        if (password !== user.password) {
            return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
        }

        const token = jwt.sign(
            { emp_id: user.emp_id, role: user.role, dept_id: user.dept_id },
            process.env.JWT_SECRET || 'secret_key_for_hr_project',
            { expiresIn: '1d' } 
        );

        console.log(`👤 User ${user.emp_id} logged in successfully.`);

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
};