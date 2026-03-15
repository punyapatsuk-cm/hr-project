const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==========================================
// 📋 API: GET /api/admin/leaves/pending (ดึงใบลาที่รออนุมัติทั้งหมด)
// ==========================================
router.get('/leaves/pending', async (req, res) => {
    try {
        // ดึงข้อมูลใบลา พร้อมชื่อพนักงาน (JOIN ตาราง employees)
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
// 💰 [READ] รายงานสรุปเงินเดือนรายเดือน (รวมประวัติการลา)
// ==========================================
router.get('/salary-report', async (req, res) => {
    try {
        const month = req.query.month || new Date().getMonth() + 1;
        const year = req.query.year || new Date().getFullYear();

        // 🌟 SQL ตัวนี้จะดึงทั้งชั่วโมงทำงาน และไปนับจำนวนวันที่ลาป่วย/ลากิจ มาให้ด้วย
        const sql = `
            SELECT 
                e.emp_id, 
                e.first_name, 
                e.last_name,
                e.hourly_rate,
                IFNULL(SUM(a.work_hours), 0) AS total_work_hours,
                IFNULL(SUM(a.ot_hours), 0) AS total_ot_hours,
                
                -- นับวันลาป่วย (Sick Leave) ที่อนุมัติแล้วในเดือนนี้
                IFNULL((
                    SELECT SUM(DATEDIFF(end_date, start_date) + 1) 
                    FROM leave_requests 
                    WHERE emp_id = e.emp_id AND leave_type = 'Sick Leave' AND status = 'approved' AND MONTH(start_date) = ? AND YEAR(start_date) = ?
                ), 0) AS sick_leaves,
                
                -- นับวันลากิจ (Personal Leave) ที่อนุมัติแล้วในเดือนนี้
                IFNULL((
                    SELECT SUM(DATEDIFF(end_date, start_date) + 1) 
                    FROM leave_requests 
                    WHERE emp_id = e.emp_id AND leave_type = 'Personal Leave' AND status = 'approved' AND MONTH(start_date) = ? AND YEAR(start_date) = ?
                ), 0) AS personal_leaves
                
            FROM employees e
            LEFT JOIN attendance_logs a 
                ON e.emp_id = a.emp_id AND MONTH(a.work_date) = ? AND YEAR(a.work_date) = ?
            GROUP BY e.emp_id, e.first_name, e.last_name, e.hourly_rate
        `;

        // ใส่ parameters เดือนและปีลงไปแทนเครื่องหมาย ? ทั้งหมด 6 ตัว
        const [rows] = await db.query(sql, [month, year, month, year, month, year]);

        // 🌟 นำข้อมูลมาคำนวณเงิน
        const reportData = rows.map(emp => {
            const rate = parseFloat(emp.hourly_rate) || 0;
            const ot_rate = rate * 1.5; // เรท OT 1.5 เท่า

            const regularPay = emp.total_work_hours * rate;
            const otPay = emp.total_ot_hours * ot_rate;
            const totalPay = regularPay + otPay; // รวมรายได้ทั้งหมด

            return { ...emp, regularPay, otPay, totalPay };
        });

        res.status(200).json(reportData);
    } catch (error) {
        console.error("Salary Report Error:", error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรายงานเงินเดือน' });
    }
});

// ==========================================
// 🏢 [READ] ดึงข้อมูลแผนกทั้งหมด
// ==========================================
// ต้องมี API ตัวนี้เพื่อส่งรายชื่อแผนกให้หน้าเว็บ
router.get('/departments', async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM departments");
        //console.log("Departments found:", results);
        res.status(200).json(results);
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ message: 'Error fetching departments' });
    }
});



// ตัวอย่าง API ใน routes/admin.js
router.get('/dashboard-stats', async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM leave_requests
        `);
        res.json(stats[0]);
    } catch (err) {
        res.status(500).json(err);
    }
});

// ==========================================
// 📊 [READ] ดึงสถิติใบลาสำหรับ Dashboard (เดือนปัจจุบัน)
// ==========================================
router.get('/dashboard-stats', async (req, res) => {
    try {
        // คำสั่ง SQL นี้นับจำนวนใบลาแยกตามสถานะ ของเดือนนี้
        const sql = `
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
            FROM leave_requests
            WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
        `;
        const [results] = await db.query(sql);

        // ส่งตัวเลขกลับไปให้หน้าเว็บ (ถ้าไม่มีข้อมูลให้เป็น 0)
        res.status(200).json({
            total: results[0].total || 0,
            pending: results[0].pending || 0,
            approved: results[0].approved || 0,
            rejected: results[0].rejected || 0
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
});

// [UPDATE] แก้ไขข้อมูลพนักงาน
router.put('/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, role, dept_id, hourly_rate } = req.body;

        // ตรวจสอบค่าก่อนบันทึก: ถ้าค่าเป็นค่าว่าง ให้ส่งเป็น null หรือค่าเริ่มต้นแทน
        const final_dept_id = dept_id === "" ? null : dept_id;
        const final_hourly_rate = hourly_rate === "" ? 0.00 : hourly_rate;

        const sql = `
            UPDATE employees 
            SET first_name = ?, last_name = ?, role = ?, dept_id = ?, hourly_rate = ? 
            WHERE emp_id = ?
        `;

        await db.query(sql, [first_name, last_name, role, final_dept_id, final_hourly_rate, id]);

        res.status(200).json({ message: 'แก้ไขข้อมูลสำเร็จ' });
    } catch (error) {
        // 💡 ถ้าล้มเหลว ให้ดู Error ในหน้า Terminal (จอดำ) ของพี่ได้เลยครับ
        console.error("❌ Update Error:", error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
    }
});

// ==========================================
// ✅❌ API: PUT /api/admin/leaves/update-status (อนุมัติ/ปฏิเสธ ใบลา)
// ==========================================
router.put('/leaves/update-status', async (req, res) => {
    try {
        const { leave_id, emp_id, leave_type, status, days_requested } = req.body;

        if (!leave_id || !status) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        }

        // 1. อัปเดตสถานะในตาราง leave_requests
        const updateLeaveSql = `UPDATE leave_requests SET status = ? WHERE leave_id = ?`;
        await db.query(updateLeaveSql, [status, leave_id]);

        // 2. ระบบตัดโควตาวันลาอัตโนมัติ (ถ้า HR กด Approve)
        console.log("รับข้อมูลมาคือ:", { leave_id, emp_id, leave_type, status, days_requested });
        if (status === 'approved' && days_requested > 0) {
            // เช็คประเภทการลาเพื่อไปตัดคอลัมน์ให้ถูก (เติม _remaining ให้หมด)
            let columnToDeduct = '';

            // 🌟 แก้ตรงนี้ให้ตรงกับค่าในฐานข้อมูลครับ
            if (leave_type === 'sick') columnToDeduct = 'sick_leave_remaining';
            else if (leave_type === 'personal') columnToDeduct = 'personal_leave_remaining';
            else if (leave_type === 'annual') columnToDeduct = 'annual_leave_remaining';

            if (columnToDeduct) {
                const deductSql = `
                    UPDATE leave_balances 
                    SET ${columnToDeduct} = ${columnToDeduct} - ? 
                    WHERE emp_id = ? AND ${columnToDeduct} >= ?
                `;
                // หักลบจำนวนวันที่ลา (ถ้าโควตาพอ)
                const [result] = await db.query(deductSql, [days_requested, emp_id, days_requested]);

                if (result.affectedRows === 0) {
                    console.log(`แจ้งเตือน: พนักงาน ${emp_id} วันลา ${leave_type} ไม่พอให้ตัดโควตา`);
                }
            }
        }

        res.status(200).json({ message: `ดำเนินการ ${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} เรียบร้อยแล้ว` });

    } catch (error) {
        console.error('Update Leave Status Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
    }
});



// ==========================================
// [READ] ดึงรายชื่อพนักงานทั้งหมด (รวมชื่อแผนก และ โควตาวันลา)
// ==========================================
router.get('/employees/all', async (req, res) => {
    try {
        const sql = `
            SELECT e.*, d.dept_name AS dept_name, 
                   lb.sick_leave_remaining, 
                   lb.personal_leave_remaining, 
                   lb.annual_leave_remaining
            FROM employees e 
            LEFT JOIN departments d ON e.dept_id = d.dept_id
            LEFT JOIN leave_balances lb ON e.emp_id = lb.emp_id AND lb.year = YEAR(CURDATE())
        `;
        const [results] = await db.query(sql);
        res.status(200).json(results);
    } catch (error) {
        console.error("Fetch Employees Error:", error);
        res.status(500).json({ message: 'Error' });
    }
});
// ==========================================
// ➕ [CREATE] เพิ่มพนักงานใหม่ + สร้างโควตาอัตโนมัติ
// ==========================================
router.post('/employees/add', async (req, res) => {
    // 🌟 1. รับค่า hourly_rate ที่ส่งมาจากหน้าเว็บเพิ่มด้วย
    const { emp_id, first_name, last_name, password, role, hourly_rate } = req.body;

    try {
        const [check] = await db.query("SELECT emp_id FROM employees WHERE emp_id = ?", [emp_id]);
        if (check.length > 0) return res.status(400).json({ message: 'รหัสพนักงานนี้มีในระบบแล้ว' });

        // 🌟 แปลงค่าจ้างเป็นตัวเลข
        const final_hourly_rate = hourly_rate ? parseFloat(hourly_rate) : 0.00;

        // 🌟 2. เพิ่ม hourly_rate เข้าไปในคำสั่ง INSERT
        const sql = "INSERT INTO employees (emp_id, first_name, last_name, password, role, dept_id, hourly_rate) VALUES (?, ?, ?, ?, ?, ?, ?)";

        // ใส่ 1 เป็นค่า dept_id ตั้งต้นตามโครงสร้างเดิมของพี่
        await db.query(sql, [emp_id, first_name, last_name, password, role, 1, final_hourly_rate]);

        // โค้ดส่วนสร้างโควตาวันลาเหมือนเดิม...
        const currentYear = new Date().getFullYear();
        const balanceSql = `INSERT INTO leave_balances (emp_id, year, sick_leave_remaining, personal_leave_remaining, annual_leave_remaining) VALUES (?, ?, ?, ?, ?)`;
        await db.query(balanceSql, [emp_id, currentYear, 30, 6, 6]);

        res.status(201).json({ message: 'เพิ่มพนักงานและสร้างโควตาวันลาสำเร็จ' });

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
        // ลบทั้งในตารางหลักและตารางโควตา (ถ้าตั้ง Foreign Key แบบ Cascade จะง่ายกว่า)
        await db.query("DELETE FROM leave_balances WHERE emp_id = ?", [emp_id]);
        await db.query("DELETE FROM employees WHERE emp_id = ?", [emp_id]);

        res.status(200).json({ message: 'ลบข้อมูลพนักงานเรียบร้อยแล้ว' });
    } catch (error) {
        res.status(500).json({ message: 'ลบข้อมูลไม่สำเร็จ' });
    }
});

// ==========================================
// 📢 [CREATE] เพิ่มประกาศข่าวสารใหม่
// ==========================================
router.post('/announcements', async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ message: 'กรุณากรอกหัวข้อและเนื้อหาให้ครบถ้วน' });
        }

        const sql = "INSERT INTO announcements (title, content) VALUES (?, ?)";
        await db.query(sql, [title, content]);

        res.status(201).json({ message: 'สร้างประกาศสำเร็จเรียบร้อย' });
    } catch (error) {
        console.error('Create Announcement Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างประกาศ' });
    }
});

// ==========================================
// 📢 [READ] ดึงรายการประกาศข่าวสารทั้งหมด
// ==========================================
router.get('/announcements', async (req, res) => {
    try {
        // ดึงประกาศเรียงจากใหม่สุด (DESC) ไปเก่าสุด
        const sql = "SELECT * FROM announcements ORDER BY created_at DESC";
        const [results] = await db.query(sql);
        res.status(200).json(results);
    } catch (error) {
        console.error('Fetch Announcements Error:', error);
        res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลประกาศได้' });
    }
});

// ==========================================
// 📢 [DELETE] ลบประกาศข่าวสาร
// ==========================================
router.delete('/announcements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const sql = "DELETE FROM announcements WHERE id = ?";
        await db.query(sql, [id]);

        res.status(200).json({ message: 'ลบประกาศสำเร็จ' });
    } catch (error) {
        console.error('Delete Announcement Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบประกาศ' });
    }
});

// ==========================================
// 🕒 [READ] API: GET /api/admin/leave-history (ดึงประวัติการลาทั้งหมด)
// ==========================================
router.get('/leave-history', async (req, res) => {
    try {
        // 🌟 เพิ่มคำสั่ง DATEDIFF เพื่อให้ SQL คำนวณจำนวนวันให้เลย
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