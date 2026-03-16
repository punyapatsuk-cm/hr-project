const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const bcrypt  = require('bcrypt'); // ✅ เพิ่ม bcrypt

// ==========================================
// 📋 [READ] GET /api/admin/leaves/pending
// ==========================================
router.get('/leaves/pending', async (req, res) => {
    try {
        const sql = `
            SELECT l.*, e.first_name, e.last_name 
            FROM leave_requests l
            JOIN employees e ON l.emp_id = e.emp_id
            WHERE l.status = 'pending'
            ORDER BY l.created_at ASC
        `;
        const [results] = await db.query(sql);
        res.status(200).json(results);
    } catch (error) {
        console.error('Admin Fetch Leaves Error:', error);
        res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลการลางานได้' });
    }
});

// ==========================================
// 💰 [READ] รายงานสรุปเงินเดือนรายเดือน
// ==========================================
router.get('/salary-report', async (req, res) => {
    try {
        const month = req.query.month || new Date().getMonth() + 1;
        const year  = req.query.year  || new Date().getFullYear();

        const sql = `
            SELECT 
                e.emp_id, 
                e.first_name, 
                e.last_name,
                e.hourly_rate,
                IFNULL(SUM(a.work_hours), 0) AS total_work_hours,
                IFNULL(SUM(a.ot_hours), 0)   AS total_ot_hours,
                IFNULL((
                    SELECT SUM(DATEDIFF(end_date, start_date) + 1) 
                    FROM leave_requests 
                    WHERE emp_id = e.emp_id 
                      AND leave_type = 'sick' 
                      AND status = 'approved' 
                      AND MONTH(start_date) = ? AND YEAR(start_date) = ?
                ), 0) AS sick_leaves,
                IFNULL((
                    SELECT SUM(DATEDIFF(end_date, start_date) + 1) 
                    FROM leave_requests 
                    WHERE emp_id = e.emp_id 
                      AND leave_type = 'personal' 
                      AND status = 'approved' 
                      AND MONTH(start_date) = ? AND YEAR(start_date) = ?
                ), 0) AS personal_leaves
            FROM employees e
            LEFT JOIN attendance_logs a 
                ON e.emp_id = a.emp_id 
               AND MONTH(a.work_date) = ? AND YEAR(a.work_date) = ?
            GROUP BY e.emp_id, e.first_name, e.last_name, e.hourly_rate
        `;

        const [rows] = await db.query(sql, [month, year, month, year, month, year]);

        const reportData = rows.map(emp => {
            const rate       = parseFloat(emp.hourly_rate) || 0;
            const ot_rate    = rate * 1.5;
            const regularPay = emp.total_work_hours * rate;
            const otPay      = emp.total_ot_hours * ot_rate;
            const totalPay   = regularPay + otPay;
            return { ...emp, regularPay, otPay, totalPay };
        });

        res.status(200).json(reportData);
    } catch (error) {
        console.error('Salary Report Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรายงานเงินเดือน' });
    }
});

// ==========================================
// 🏢 [READ] ดึงข้อมูลแผนกทั้งหมด
// ==========================================
router.get('/departments', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM departments');
        res.status(200).json(results);
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ message: 'Error fetching departments' });
    }
});

// ==========================================
// 📊 [READ] สถิติ Dashboard (เดือนปัจจุบัน)
// ==========================================
router.get('/dashboard-stats', async (req, res) => {
    try {
        const sql = `
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
            FROM leave_requests
            WHERE MONTH(created_at) = MONTH(CURDATE()) 
              AND YEAR(created_at)  = YEAR(CURDATE())
        `;
        const [results] = await db.query(sql);
        res.status(200).json({
            total:    results[0].total    || 0,
            pending:  results[0].pending  || 0,
            approved: results[0].approved || 0,
            rejected: results[0].rejected || 0
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
});

// ==========================================
// ✏️ [UPDATE] แก้ไขข้อมูลพนักงาน
// ==========================================
router.put('/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, role, dept_id, hourly_rate } = req.body;

        const final_dept_id     = dept_id      === '' ? null : dept_id;
        const final_hourly_rate = hourly_rate  === '' ? 0.00 : hourly_rate;

        const sql = `
            UPDATE employees 
            SET first_name = ?, last_name = ?, role = ?, dept_id = ?, hourly_rate = ? 
            WHERE emp_id = ?
        `;
        await db.query(sql, [first_name, last_name, role, final_dept_id, final_hourly_rate, id]);
        res.status(200).json({ message: 'แก้ไขข้อมูลสำเร็จ' });
    } catch (error) {
        console.error('Update Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
    }
});

// ==========================================
// ✅❌ [UPDATE] อนุมัติ/ปฏิเสธ ใบลา
// ==========================================
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

        const days_requested = Math.ceil(
            (new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)
        ) + 1;

        await db.query(
            'UPDATE leave_requests SET status = ? WHERE leave_id = ?',
            [status, leave_id]
        );

        if (status === 'approved' && days_requested > 0) {
            let columnToDeduct = '';
            if (leave_type === 'sick')          columnToDeduct = 'sick_leave_remaining';
            else if (leave_type === 'personal') columnToDeduct = 'personal_leave_remaining';
            else if (leave_type === 'annual')   columnToDeduct = 'annual_leave_remaining';

            if (columnToDeduct) {
                const deductSql = `
                    UPDATE leave_balances 
                    SET ${columnToDeduct} = ${columnToDeduct} - ? 
                    WHERE emp_id = ? AND year = YEAR(CURDATE()) AND ${columnToDeduct} >= ?
                `;
                const [result] = await db.query(deductSql, [days_requested, emp_id, days_requested]);
                if (result.affectedRows === 0) {
                    console.log(`⚠️ พนักงาน ${emp_id} วันลา ${leave_type} ไม่พอให้ตัดโควตา`);
                }
            }
        }

        console.log(`📋 Leave ${leave_id} → ${status} (${days_requested} วัน)`);
        res.status(200).json({
            message: `ดำเนินการ ${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} เรียบร้อยแล้ว`
        });

    } catch (error) {
        console.error('Update Leave Status Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
    }
});

// ==========================================
// 👥 [READ] ดึงรายชื่อพนักงานทั้งหมด
// ==========================================
router.get('/employees/all', async (req, res) => {
    try {
        const sql = `
            SELECT e.*, d.dept_name,
                   lb.sick_leave_remaining,
                   lb.personal_leave_remaining,
                   lb.annual_leave_remaining
            FROM employees e 
            LEFT JOIN departments d  ON e.dept_id  = d.dept_id
            LEFT JOIN leave_balances lb ON e.emp_id = lb.emp_id AND lb.year = YEAR(CURDATE())
        `;
        const [results] = await db.query(sql);
        res.status(200).json(results);
    } catch (error) {
        console.error('Fetch Employees Error:', error);
        res.status(500).json({ message: 'Error' });
    }
});

// ==========================================
// ➕ [CREATE] เพิ่มพนักงานใหม่
// ✅ Hash password ด้วย bcrypt ก่อน save
// ==========================================
router.post('/employees/add', async (req, res) => {
    const { emp_id, first_name, last_name, password, role, dept_id, hourly_rate } = req.body;

    try {
        const [check] = await db.query('SELECT emp_id FROM employees WHERE emp_id = ?', [emp_id]);
        if (check.length > 0) {
            return res.status(400).json({ message: 'รหัสพนักงานนี้มีในระบบแล้ว' });
        }

        const final_hourly_rate = hourly_rate ? parseFloat(hourly_rate) : 0.00;
        const final_dept_id     = dept_id     ? dept_id                 : null;

        // ✅ Hash password ก่อน save ทุกครั้ง
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO employees (emp_id, first_name, last_name, password, role, dept_id, hourly_rate) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await db.query(sql, [emp_id, first_name, last_name, hashedPassword, role, final_dept_id, final_hourly_rate]);

        const currentYear = new Date().getFullYear();
        await db.query(
            `INSERT INTO leave_balances (emp_id, year, sick_leave_remaining, personal_leave_remaining, annual_leave_remaining) 
             VALUES (?, ?, 30, 6, 6)`,
            [emp_id, currentYear]
        );

        res.status(201).json({ message: 'เพิ่มข้อมูลพนักงานสำเร็จ' });
    } catch (error) {
        console.error('SQL ERROR:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด: ' + error.sqlMessage });
    }
});

// ==========================================
// 🗑️ [DELETE] ลบพนักงาน
// ==========================================
router.delete('/employees/:emp_id', async (req, res) => {
    try {
        const { emp_id } = req.params;
        await db.query('DELETE FROM leave_balances WHERE emp_id = ?', [emp_id]);
        await db.query('DELETE FROM employees WHERE emp_id = ?',      [emp_id]);
        res.status(200).json({ message: 'ลบข้อมูลพนักงานเรียบร้อยแล้ว' });
    } catch (error) {
        console.error('Delete Employee Error:', error);
        res.status(500).json({ message: 'ลบข้อมูลไม่สำเร็จ' });
    }
});

// ==========================================
// 📢 [CREATE] เพิ่มประกาศ
// ==========================================
router.post('/announcements', async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ message: 'กรุณากรอกหัวข้อและเนื้อหาให้ครบถ้วน' });
        }
        await db.query('INSERT INTO announcements (title, content) VALUES (?, ?)', [title, content]);
        res.status(201).json({ message: 'สร้างประกาศสำเร็จเรียบร้อย' });
    } catch (error) {
        console.error('Create Announcement Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างประกาศ' });
    }
});

// ==========================================
// 📢 [READ] ดึงประกาศทั้งหมด
// ==========================================
router.get('/announcements', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM announcements ORDER BY created_at DESC');
        res.status(200).json(results);
    } catch (error) {
        console.error('Fetch Announcements Error:', error);
        res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลประกาศได้' });
    }
});

// ==========================================
// 📢 [DELETE] ลบประกาศ
// ==========================================
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

// ==========================================
// 🕒 [READ] ประวัติการลาทั้งหมด
// ==========================================
router.get('/leave-history', async (req, res) => {
    try {
        const sql = `
            SELECT l.*, e.first_name, e.last_name,
                   (DATEDIFF(l.end_date, l.start_date) + 1) AS days_requested
            FROM leave_requests l
            JOIN employees e ON l.emp_id = e.emp_id
            ORDER BY l.created_at DESC
        `;
        const [results] = await db.query(sql);
        res.status(200).json(results);
    } catch (error) {
        console.error('Admin Fetch Leave History Error:', error);
        res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลประวัติการลางานได้' });
    }
});

module.exports = router;