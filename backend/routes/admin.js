const express = require('express');
const router = express.Router();
const db = require('../db');

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
// 🏢 [READ] ดึงข้อมูลแผนกทั้งหมด
// ==========================================
// ต้องมี API ตัวนี้เพื่อส่งรายชื่อแผนกให้หน้าเว็บ
router.get('/departments', async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM departments");
        console.log("Departments found:", results); // บรรทัดนี้จะช่วยให้คุณเห็นใน Terminal ว่าข้อมูลมาไหม
        res.status(200).json(results);
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ message: 'Error fetching departments' });
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
        if (status === 'approved' && days_requested > 0) {
            // เช็คประเภทการลาเพื่อไปตัดคอลัมน์ให้ถูก (เติม _remaining ให้หมด)
            let columnToDeduct = '';
            if (leave_type === 'Sick Leave') columnToDeduct = 'sick_leave_remaining';
            else if (leave_type === 'Personal Leave') columnToDeduct = 'personal_leave_remaining';
            else if (leave_type === 'Annual Leave') columnToDeduct = 'annual_leave_remaining';

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
// [READ] ดึงรายชื่อพนักงานทั้งหมด (รวมชื่อแผนก)
// ==========================================
// ใน routes/admin.js หา API employees/all แล้วแก้ SQL ครับ
router.get('/employees/all', async (req, res) => {
    try {
        const sql = `
            SELECT e.*, d.name AS dept_name 
            FROM employees e 
            LEFT JOIN departments d ON e.dept_id = d.id
        `;
        const [results] = await db.query(sql);
        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ message: 'Error' });
    }
});

// ==========================================
// ➕ [CREATE] เพิ่มพนักงานใหม่ + สร้างโควตาอัตโนมัติ
// ==========================================
router.post('/employees/add', async (req, res) => {
    // 1. รับค่าที่ส่งมา (ไม่มี username แล้ว)
    const { emp_id, first_name, last_name, password, role } = req.body;

    try {
        // 2. เช็คว่า ID ซ้ำไหม
        const [check] = await db.query("SELECT emp_id FROM employees WHERE emp_id = ?", [emp_id]);
        if (check.length > 0) return res.status(400).json({ message: 'รหัสพนักงานนี้มีในระบบแล้ว' });

        // 3. บันทึกลงตาราง employees (ใส่ dept_id=1 ไปก่อนตามโครงสร้างเดิมของคุณ)
        // สังเกตว่าเราไม่ใส่คอลัมน์ username แล้วครับ
        const sql = "INSERT INTO employees (emp_id, first_name, last_name, password, role, dept_id) VALUES (?, ?, ?, ?, ?, ?)";
        await db.query(sql, [emp_id, first_name, last_name, password, role, 1]);

        // 4. สร้างโควตาวันลา (ใช้ชื่อคอลัมน์ตามรูป image_05fc1d.png)
        // ดึงค่าปีปัจจุบัน (เช่น 2026)
        const currentYear = new Date().getFullYear();

        // สร้างโควตาของ "ปีนั้น" ให้พนักงาน
        const balanceSql = `
    INSERT INTO leave_balances (emp_id, year, sick_leave_remaining, personal_leave_remaining, annual_leave_remaining) 
    VALUES (?, ?, ?, ?, ?)
`;
        await db.query(balanceSql, [emp_id, currentYear, 30, 6, 6]);

        res.status(201).json({ message: 'เพิ่มพนักงานและสร้างโควตาวันลาสำเร็จ' });

    } catch (error) {
        console.error('SQL ERROR:', error);
        // ถ้ายังพัง มันจะบอกสาเหตุที่แท้จริงกลับมาให้เราเห็นเลยครับ
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

module.exports = router;