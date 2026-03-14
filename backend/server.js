const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();

// ==========================================
// ⚙️ 1. Middleware (ตั้งค่าพื้นฐาน)
// ==========================================
app.use(cors());
app.use(express.json()); // ให้ API รับข้อมูลแบบ JSON ได้
app.use(express.urlencoded({ extended: true })); // รับข้อมูลแบบ Form-Data (สำหรับการอัปโหลดไฟล์)
app.use('/uploads', express.static('uploads')); // เปิดให้เข้าถึงไฟล์ในโฟลเดอร์ uploads ได้

// ==========================================
// 🔗 2. Routes (เชื่อมต่อ API จากไฟล์อื่น)
// ==========================================
app.use('/api/auth', require('./routes/auth'));   // หมวดล็อกอิน
app.use('/api/leave', require('./routes/leave')); // หมวดลางาน
app.use('/api/admin', require('./routes/admin')); // หมวดจัดการแอดมิน/HR

// ==========================================
// 🧑‍💼 3. API ข้อมูลพนักงาน (Employee)
// ==========================================
// [READ] ดึงข้อมูลส่วนตัวและแผนกของพนักงาน
// ใน server.js หาช่อง API Profile แล้วแก้ SQL เป็นแบบนี้ครับ
app.get('/api/employee/profile/:emp_id', async (req, res) => {
    try {
        const { emp_id } = req.params;
        // 🌟 แก้ SQL ให้ไปดึงชื่อแผนก (dept_name) มาด้วย
        const sql = `
            SELECT e.*, d.name AS dept_name 
            FROM employees e 
            LEFT JOIN departments d ON e.dept_id = d.id 
            WHERE e.emp_id = ?
        `;
        const [results] = await db.query(sql, [emp_id]);
        if (results.length === 0) return res.status(404).json({ message: 'ไม่พบข้อมูล' });
        res.status(200).json(results[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error' });
    }
});

// ==========================================
// ⏰ 4. API ระบบลงเวลา (Attendance)
// ==========================================
// [CREATE] บันทึกเวลาเข้างาน (Clock In)
app.post('/api/attendance/clock-in', async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });

        const insertSql = "INSERT INTO attendance_logs (emp_id, work_date, check_in_time) VALUES (?, CURDATE(), NOW())";
        await db.query(insertSql, [emp_id]);
        res.status(200).json({ message: 'บันทึกเวลาเข้างานสำเร็จ!' });
    } catch (error) {
        console.error("Database Error (Clock In):", error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ฐานข้อมูล' });
    }
});

// [UPDATE] บันทึกเวลาเลิกงาน (Clock Out) + คำนวณชั่วโมงและค่าแรง
app.post('/api/attendance/clock-out', async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });

        // 1. ตรวจสอบการเข้างาน
        const checkSql = `SELECT check_in_time FROM attendance_logs WHERE emp_id = ? AND work_date = CURDATE() ORDER BY log_id DESC LIMIT 1`;
        const [existing] = await db.query(checkSql, [emp_id]);
        if (existing.length === 0) return res.status(400).json({ message: 'ไม่พบข้อมูลการเข้างาน กรุณากดเข้างานก่อน' });

        const checkInTime = new Date(existing[0].check_in_time);
        const checkOutTime = new Date();

        // 2. ดึงค่าจ้างรายชั่วโมงจากตาราง employees
        const empSql = `SELECT hourly_rate FROM employees WHERE emp_id = ?`;
        const [empData] = await db.query(empSql, [emp_id]);
        const HOURLY_WAGE = parseFloat(empData[0]?.hourly_rate) || 0;
        const OT_WAGE = HOURLY_WAGE * 1.5;

        // 3. คำนวณเวลาและแยก OT (หักพักเที่ยง 1 ชม. ถ้าทำเกิน 5 ชม.)
        const diffMs = checkOutTime - checkInTime;
        let totalHours = diffMs / (1000 * 60 * 60);
        if (totalHours > 5) totalHours -= 1;

        let workHours = parseFloat((totalHours > 8 ? 8 : totalHours).toFixed(2));
        let otHours = parseFloat((totalHours > 8 ? totalHours - 8 : 0).toFixed(2));

        // 4. บันทึกลงฐานข้อมูล
        const updateSql = `
            UPDATE attendance_logs 
            SET check_out_time = ?, work_hours = ?, ot_hours = ? 
            WHERE emp_id = ? AND work_date = CURDATE() 
            ORDER BY log_id DESC LIMIT 1
        `;
        await db.query(updateSql, [checkOutTime, workHours, otHours, emp_id]);

        // 5. สรุปยอดเงิน
        const earnedToday = (workHours * HOURLY_WAGE) + (otHours * OT_WAGE);
        res.status(200).json({
            message: `บันทึกเวลาเลิกงานสำเร็จ! ทำงาน ${workHours} ชม. | OT ${otHours} ชม. \n(ยอดรายได้วันนี้: ${earnedToday.toFixed(2)} บาท) 💸`
        });

    } catch (error) {
        console.error("Clock Out Error:", error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเวลาเลิกงาน' });
    }
});

// [READ] ดึงประวัติการลงเวลาย้อนหลัง 30 วัน
app.get('/api/attendance/history/:emp_id', async (req, res) => {
    try {
        const empId = req.params.emp_id;
        const sql = `
            SELECT work_date, check_in_time, check_out_time 
            FROM attendance_logs 
            WHERE emp_id = ? 
            ORDER BY work_date DESC, check_in_time DESC
            LIMIT 30
        `;
        const [results] = await db.query(sql, [empId]);
        res.status(200).json(results);
    } catch (error) {
        console.error("Database error (History):", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงประวัติการลงเวลา" });
    }
});

// ==========================================
// 💰 5. API รายงาน (Reports สำหรับ HR)
// ==========================================
// [READ] รายงานสรุปเงินเดือนรายเดือน
app.get('/api/admin/salary-report', async (req, res) => {
    try {
        const targetMonth = req.query.month || new Date().getMonth() + 1;
        const targetYear = req.query.year || new Date().getFullYear();

        const sql = `
            SELECT 
                a.emp_id, 
                e.first_name, 
                e.last_name,
                e.hourly_rate,
                SUM(a.work_hours) as total_work_hours,
                SUM(a.ot_hours) as total_ot_hours
            FROM attendance_logs a
            JOIN employees e ON a.emp_id = e.emp_id
            WHERE MONTH(a.work_date) = ? AND YEAR(a.work_date) = ?
            GROUP BY a.emp_id
        `;
        const [rows] = await db.query(sql, [targetMonth, targetYear]);

        const reportData = rows.map(emp => {
            const HOURLY_WAGE = parseFloat(emp.hourly_rate) || 0;
            const OT_WAGE = HOURLY_WAGE * 1.5;
            const workHours = parseFloat(emp.total_work_hours) || 0;
            const otHours = parseFloat(emp.total_ot_hours) || 0;

            const regularPay = workHours * HOURLY_WAGE;
            const otPay = otHours * OT_WAGE;
            const totalPay = regularPay + otPay;

            return { ...emp, regularPay, otPay, totalPay };
        });

        res.status(200).json(reportData);
    } catch (error) {
        console.error("Salary Report Error:", error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรายงานเงินเดือน' });
    }
});

// ==========================================
// 🚀 6. Server Initialization
// ==========================================
// หน้าแรกสำหรับทดสอบว่า Server รันติดหรือไม่
app.get('/', (req, res) => {
    res.send('🚀 HR Attendance Backend is running smoothly!');
});

const PORT = process.env.PORT || 1304;
app.listen(PORT, () => {
    console.log(`Server is running beautifully on http://localhost:${PORT}`);
});