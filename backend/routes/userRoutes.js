// ============================================================
// userRoutes.js — Routes สำหรับพนักงานทั่วไป
// ============================================================

const express         = require('express');
const router          = express.Router();
const db              = require('../config/db');
const { verifyToken } = require('../middlewares/authMiddleware');

// ============================================================
// GET /api/employee/profile/:emp_id — ข้อมูลโปรไฟล์พนักงาน
// ============================================================
router.get('/profile/:emp_id', verifyToken, async (req, res) => {
    try {
        const { emp_id } = req.params;

        const [results] = await db.query(
            `SELECT
                e.emp_id, e.first_name, e.last_name, e.role, e.dept_id, e.hourly_rate,
                d.dept_name,
                lb.sick_leave_remaining,
                lb.personal_leave_remaining,
                lb.annual_leave_remaining
             FROM employees e
             LEFT JOIN departments    d  ON e.dept_id = d.dept_id
             LEFT JOIN leave_balances lb ON e.emp_id  = lb.emp_id AND lb.year = YEAR(CURDATE())
             WHERE e.emp_id = ?`,
            [emp_id]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลพนักงาน' });
        }

        res.status(200).json(results[0]);
    } catch (error) {
        console.error('Profile Fetch Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลส่วนตัว' });
    }
});

// ============================================================
// GET /api/employee/payslip/:emp_id — สลิปเงินเดือนเดือนปัจจุบัน
// ============================================================
router.get('/payslip/:emp_id', verifyToken, async (req, res) => {
    try {
        const { emp_id } = req.params;
        const month = new Date().getMonth() + 1;
        const year  = new Date().getFullYear();

        const [rows] = await db.query(
            `SELECT
                e.emp_id, e.first_name, e.last_name, e.hourly_rate,
                IFNULL(SUM(a.work_hours), 0) AS total_work_hours,
                IFNULL(SUM(a.ot_hours),   0) AS total_ot_hours
             FROM employees e
             LEFT JOIN attendance_logs a
                ON  e.emp_id          = a.emp_id
                AND MONTH(a.work_date) = ?
                AND YEAR(a.work_date)  = ?
             WHERE e.emp_id = ?
             GROUP BY e.emp_id, e.first_name, e.last_name, e.hourly_rate`,
            [month, year, emp_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลสลิปเดือนนี้' });
        }

        const emp        = rows[0];
        const rate       = parseFloat(emp.hourly_rate) || 0;
        const regularPay = emp.total_work_hours * rate;
        const otPay      = emp.total_ot_hours   * (rate * 1.5);

        res.status(200).json({ ...emp, regularPay, otPay, totalPay: regularPay + otPay });
    } catch (error) {
        console.error('Payslip Fetch Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเงินเดือน' });
    }
});

module.exports = router;