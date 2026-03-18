const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const bcrypt  = require('bcrypt');

const SALT_ROUNDS = 10;

// map leave_type → column ใน leave_balances
const LEAVE_BALANCE_COLUMN = {
    sick:     'sick_leave_remaining',
    personal: 'personal_leave_remaining',
    annual:   'annual_leave_remaining',
};

// ============================================================
// GET /leaves/pending — ใบลาที่รอพิจารณา (เฉพาะ user)
// ============================================================
router.get('/leaves/pending', async (req, res) => {
    try {
        const [results] = await db.query(
            `SELECT l.*, e.first_name, e.last_name
             FROM leave_requests l
             JOIN employees e ON l.emp_id = e.emp_id
             WHERE l.status = 'pending' AND e.role = 'user'
             ORDER BY l.created_at ASC`
        );
        res.status(200).json(results);
    } catch (error) {
        console.error('Admin Fetch Leaves Error:', error);
        res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลการลางานได้' });
    }
});

// ============================================================
// GET /salary-report — รายงานสรุปเงินเดือนรายเดือน
// ============================================================
router.get('/salary-report', async (req, res) => {
    try {
        const month = req.query.month || new Date().getMonth() + 1;
        const year  = req.query.year  || new Date().getFullYear();

        const [rows] = await db.query(
            `SELECT
                e.emp_id, e.first_name, e.last_name, e.hourly_rate,
                IFNULL(SUM(a.work_hours), 0) AS total_work_hours,
                IFNULL(SUM(a.ot_hours),   0) AS total_ot_hours,
                IFNULL((
                    SELECT SUM(DATEDIFF(end_date, start_date) + 1)
                    FROM leave_requests
                    WHERE emp_id = e.emp_id AND leave_type = 'sick'
                      AND status = 'approved' AND MONTH(start_date) = ? AND YEAR(start_date) = ?
                ), 0) AS sick_leaves,
                IFNULL((
                    SELECT SUM(DATEDIFF(end_date, start_date) + 1)
                    FROM leave_requests
                    WHERE emp_id = e.emp_id AND leave_type = 'personal'
                      AND status = 'approved' AND MONTH(start_date) = ? AND YEAR(start_date) = ?
                ), 0) AS personal_leaves
             FROM employees e
             LEFT JOIN attendance_logs a
                ON e.emp_id = a.emp_id AND MONTH(a.work_date) = ? AND YEAR(a.work_date) = ?
             WHERE e.role = 'user'
             GROUP BY e.emp_id, e.first_name, e.last_name, e.hourly_rate`,
            [month, year, month, year, month, year]
        );

        const reportData = rows.map(emp => {
            const rate       = parseFloat(emp.hourly_rate) || 0;
            const regularPay = emp.total_work_hours * rate;
            const otPay      = emp.total_ot_hours   * (rate * 1.5);
            return { ...emp, regularPay, otPay, totalPay: regularPay + otPay };
        });

        res.status(200).json(reportData);
    } catch (error) {
        console.error('Salary Report Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรายงานเงินเดือน' });
    }
});

// ============================================================
// GET /departments — ดึงรายชื่อแผนกทั้งหมด
// ============================================================
router.get('/departments', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM departments');
        res.status(200).json(results);
    } catch (error) {
        console.error('Fetch Departments Error:', error);
        res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลแผนกได้' });
    }
});

// ============================================================
// GET /dashboard-stats — สถิติภาพรวมใบลาเดือนปัจจุบัน
// ============================================================
router.get('/dashboard-stats', async (req, res) => {
    try {
        const [results] = await db.query(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
             FROM leave_requests
             WHERE MONTH(created_at) = MONTH(CURDATE())
               AND YEAR(created_at)  = YEAR(CURDATE())`
        );
        const s = results[0];
        res.status(200).json({
            total:    s.total    || 0,
            pending:  s.pending  || 0,
            approved: s.approved || 0,
            rejected: s.rejected || 0,
        });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ message: 'ไม่สามารถดึงสถิติได้' });
    }
});

// ============================================================
// PUT /employees/:id — แก้ไขข้อมูลพนักงาน
// ============================================================
router.put('/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, role, dept_id, hourly_rate } = req.body;

        await db.query(
            `UPDATE employees
             SET first_name = ?, last_name = ?, role = ?, dept_id = ?, hourly_rate = ?
             WHERE emp_id = ?`,
            [
                first_name,
                last_name,
                role,
                dept_id      || null,
                hourly_rate  || 0.00,
                id,
            ]
        );
        res.status(200).json({ message: 'แก้ไขข้อมูลสำเร็จ' });
    } catch (error) {
        console.error('Update Employee Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
    }
});

// ============================================================
// PUT /leaves/update-status — อนุมัติ / ปฏิเสธ ใบลา
// ถ้าอนุมัติ → หักโควตาวันลาใน leave_balances อัตโนมัติ
// ============================================================
router.put('/leaves/update-status', async (req, res) => {
    try {
        const { leave_id, status } = req.body;

        if (!leave_id || !status) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        }

        const [leaveRows] = await db.query(
            'SELECT emp_id, leave_type, start_date, end_date FROM leave_requests WHERE leave_id = ?',
            [leave_id]
        );

        if (leaveRows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบใบลานี้ในระบบ' });
        }

        const { emp_id, leave_type, start_date, end_date } = leaveRows[0];
        const days = Math.ceil((new Date(end_date) - new Date(start_date)) / 86400000) + 1;

        // อัปเดตสถานะใบลา
        await db.query(
            'UPDATE leave_requests SET status = ? WHERE leave_id = ?',
            [status, leave_id]
        );

        // หักโควตาเมื่ออนุมัติ
        if (status === 'approved' && days > 0) {
            const column = LEAVE_BALANCE_COLUMN[leave_type];
            if (column) {
                const [result] = await db.query(
                    `UPDATE leave_balances
                     SET ${column} = ${column} - ?
                     WHERE emp_id = ? AND year = YEAR(CURDATE()) AND ${column} >= ?`,
                    [days, emp_id, days]
                );
                if (result.affectedRows === 0) {
                    console.log(`⚠️ พนักงาน ${emp_id} วันลา ${leave_type} ไม่พอให้ตัดโควตา`);
                }
            }
        }

        console.log(`📋 Leave ${leave_id} → ${status} (${days} วัน)`);
        res.status(200).json({
            message: `${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}ใบลาเรียบร้อยแล้ว`
        });
    } catch (error) {
        console.error('Update Leave Status Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
    }
});

// ============================================================
// GET /employees/all — รายชื่อพนักงานทั้งหมด (เฉพาะ user)
// ============================================================
router.get('/employees/all', async (req, res) => {
    try {
        const [results] = await db.query(
            `SELECT e.emp_id, e.first_name, e.last_name, e.role, e.dept_id, e.hourly_rate,
                    d.dept_name,
                    lb.sick_leave_remaining,
                    lb.personal_leave_remaining,
                    lb.annual_leave_remaining
             FROM employees e
             LEFT JOIN departments    d  ON e.dept_id = d.dept_id
             LEFT JOIN leave_balances lb ON e.emp_id  = lb.emp_id AND lb.year = YEAR(CURDATE())
             WHERE e.role = 'user'`
        );
        res.status(200).json(results);
    } catch (error) {
        console.error('Fetch Employees Error:', error);
        res.status(500).json({ message: 'ไม่สามารถดึงรายชื่อพนักงานได้' });
    }
});

// ============================================================
// POST /employees/add — เพิ่มพนักงานใหม่ (hash password ก่อน save)
// ============================================================
router.post('/employees/add', async (req, res) => {
    try {
        const { emp_id, first_name, last_name, password, role, dept_id, hourly_rate } = req.body;

        const [check] = await db.query(
            'SELECT emp_id FROM employees WHERE emp_id = ?',
            [emp_id]
        );
        if (check.length > 0) {
            return res.status(400).json({ message: 'รหัสพนักงานนี้มีในระบบแล้ว' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        await db.query(
            `INSERT INTO employees (emp_id, first_name, last_name, password, role, dept_id, hourly_rate)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [emp_id, first_name, last_name, hashedPassword, role, dept_id || null, parseFloat(hourly_rate) || 0]
        );

        // สร้างโควตาวันลาให้พนักงานใหม่
        await db.query(
            `INSERT INTO leave_balances (emp_id, year, sick_leave_remaining, personal_leave_remaining, annual_leave_remaining)
             VALUES (?, ?, 30, 6, 6)`,
            [emp_id, new Date().getFullYear()]
        );

        res.status(201).json({ message: 'เพิ่มข้อมูลพนักงานสำเร็จ' });
    } catch (error) {
        console.error('Add Employee Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด: ' + (error.sqlMessage || error.message) });
    }
});

// ============================================================
// DELETE /employees/:emp_id — ลบพนักงานและข้อมูลที่เกี่ยวข้อง
// ============================================================
router.delete('/employees/:emp_id', async (req, res) => {
    try {
        const { emp_id } = req.params;
        await db.query('DELETE FROM leave_balances WHERE emp_id = ?', [emp_id]);
        await db.query('DELETE FROM employees      WHERE emp_id = ?', [emp_id]);
        res.status(200).json({ message: 'ลบข้อมูลพนักงานเรียบร้อยแล้ว' });
    } catch (error) {
        console.error('Delete Employee Error:', error);
        res.status(500).json({ message: 'ลบข้อมูลไม่สำเร็จ' });
    }
});

// ============================================================
// POST /announcements — สร้างประกาศใหม่
// ============================================================
router.post('/announcements', async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ message: 'กรุณากรอกหัวข้อและเนื้อหาให้ครบถ้วน' });
        }
        await db.query(
            'INSERT INTO announcements (title, content) VALUES (?, ?)',
            [title, content]
        );
        res.status(201).json({ message: 'สร้างประกาศสำเร็จ' });
    } catch (error) {
        console.error('Create Announcement Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างประกาศ' });
    }
});

// ============================================================
// GET /announcements — ดึงประกาศทั้งหมด
// ============================================================
router.get('/announcements', async (req, res) => {
    try {
        const [results] = await db.query(
            'SELECT * FROM announcements ORDER BY created_at DESC'
        );
        res.status(200).json(results);
    } catch (error) {
        console.error('Fetch Announcements Error:', error);
        res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลประกาศได้' });
    }
});

// ============================================================
// DELETE /announcements/:id — ลบประกาศ
// ============================================================
router.delete('/announcements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM announcements WHERE id = ?', [id]);
        res.status(200).json({ message: 'ลบประกาศสำเร็จ' });
    } catch (error) {
        console.error('Delete Announcement Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบประกาศ' });
    }
});

// ============================================================
// GET /leave-history — ประวัติการลาทั้งหมด (เฉพาะ user)
// ============================================================
router.get('/leave-history', async (req, res) => {
    try {
        const [results] = await db.query(
            `SELECT l.*, e.first_name, e.last_name,
                    (DATEDIFF(l.end_date, l.start_date) + 1) AS days_requested
             FROM leave_requests l
             JOIN employees e ON l.emp_id = e.emp_id
             WHERE e.role = 'user'
             ORDER BY l.created_at DESC`
        );
        res.status(200).json(results);
    } catch (error) {
        console.error('Admin Fetch Leave History Error:', error);
        res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลประวัติการลางานได้' });
    }
});

module.exports = router;