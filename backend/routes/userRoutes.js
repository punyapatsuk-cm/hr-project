// ============================================================
// routes/userRoutes.js
// Routes สำหรับพนักงานทั่วไป (profile, payslip)
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verifyToken } = require('../middlewares/authMiddleware');

// ==========================================
// 👤 [READ] ดึงข้อมูลโปรไฟล์พนักงาน
// ==========================================
router.get('/profile/:emp_id', verifyToken, async (req, res) => {
    try {
        const empId = req.params.emp_id;

        // BUG FIX: เปลี่ยนจาก SELECT e.* → ระบุ column ที่ต้องการเท่านั้น
        // SELECT e.* คืน password hash กลับมาด้วย ซึ่งไม่ควรส่งให้ frontend
        const sql = `
            SELECT
                e.emp_id,
                e.first_name,
                e.last_name,
                e.role,
                e.dept_id,
                e.hourly_rate,
                d.dept_name,
                lb.sick_leave_remaining,
                lb.personal_leave_remaining,
                lb.annual_leave_remaining
            FROM employees e
            LEFT JOIN departments    d  ON e.dept_id = d.dept_id
            LEFT JOIN leave_balances lb ON e.emp_id  = lb.emp_id AND lb.year = YEAR(CURDATE())
            WHERE e.emp_id = ?
        `;

        const [results] = await db.query(sql, [empId]);

        if (results.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลพนักงาน' });
        }

        res.status(200).json(results[0]);
    } catch (error) {
        console.error('Profile Fetch Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลส่วนตัว' });
    }
});

// ==========================================
// 💰 [READ] ดึงสลิปเงินเดือนของพนักงานคนนั้นเท่านั้น
// ==========================================
router.get('/payslip/:emp_id', verifyToken, async (req, res) => {
    try {
        const empId = req.params.emp_id;
        const month = new Date().getMonth() + 1;
        const year  = new Date().getFullYear();

        const sql = `
            SELECT
                e.emp_id,
                e.first_name,
                e.last_name,
                e.hourly_rate,
                IFNULL(SUM(a.work_hours), 0) AS total_work_hours,
                IFNULL(SUM(a.ot_hours),   0) AS total_ot_hours
            FROM employees e
            LEFT JOIN attendance_logs a
                ON  e.emp_id     = a.emp_id
                AND MONTH(a.work_date) = ?
                AND YEAR(a.work_date)  = ?
            WHERE e.emp_id = ?
            GROUP BY e.emp_id, e.first_name, e.last_name, e.hourly_rate
        `;

        const [rows] = await db.query(sql, [month, year, empId]);

        if (rows.length === 0) {
            // BUG FIX: เปลี่ยนจาก res.status(404).json(null) → คืน object ที่มี message
            return res.status(404).json({ message: 'ไม่พบข้อมูลสลิปเดือนนี้' });
        }

        const emp        = rows[0];
        const rate       = parseFloat(emp.hourly_rate) || 0;
        const regularPay = emp.total_work_hours * rate;
        const otPay      = emp.total_ot_hours   * (rate * 1.5);
        const totalPay   = regularPay + otPay;

        res.status(200).json({ ...emp, regularPay, otPay, totalPay });
    } catch (error) {
        console.error('Payslip Fetch Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเงินเดือน' });
    }
});

module.exports = router;