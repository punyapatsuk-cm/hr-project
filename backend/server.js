const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();

// ==========================================
// ⚙️ Middleware
// ==========================================
app.use(cors());
app.use(express.json()); // ให้ API รับข้อมูลแบบ JSON ได้
app.use(express.urlencoded({ extended: true })); // อนุญาตให้รับข้อมูลแบบ Form-Data (สำคัญสำหรับอัปโหลดไฟล์)

// เปิดให้เข้าถึงโฟลเดอร์ uploads ผ่าน URL ได้ (เช่น ให้ HR ดูรูปใบรับรองแพทย์)
app.use('/uploads', express.static('uploads'));

// ==========================================
// 🔗 การเชื่อมต่อ Routes แยกไฟล์
// ==========================================

// 1. หมวด Auth (ระบบล็อกอิน)
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// 2. หมวด Leave (ระบบลางาน) 🌟 เพิ่มเข้ามาใหม่
const leaveRoutes = require('./routes/leave');
app.use('/api/leave', leaveRoutes);
// 🌟 3. หมวด Admin/HR (เพิ่มใหม่ตรงนี้!)
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// ==========================================
// 🟢 API สำหรับบันทึกเวลาเข้างาน (Clock In)
// ==========================================
app.post('/api/attendance/clock-in', async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) {
            return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });
        }
        const insertSql = "INSERT INTO attendance_logs (emp_id, work_date, check_in_time) VALUES (?, CURDATE(), NOW())";
        await db.query(insertSql, [emp_id]);
        res.status(200).json({ message: 'บันทึกเวลาเข้างานสำเร็จ!' });
    } catch (error) {
        console.error("Database Error (Clock In):", error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ฐานข้อมูล' });
    }
});

// ==========================================
// 🔴 API สำหรับบันทึกเวลาเลิกงาน (Clock Out)
// ==========================================
app.post('/api/attendance/clock-out', async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) {
            return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });
        }
        const sql = `
            UPDATE attendance_logs 
            SET check_out_time = NOW() 
            WHERE emp_id = ? AND work_date = CURDATE() 
            ORDER BY log_id DESC LIMIT 1
        `;
        await db.query(sql, [emp_id]);
        res.status(200).json({ message: 'บันทึกเวลาเลิกงานสำเร็จ เดินทางปลอดภัยครับ!' });
    } catch (error) {
        console.error("Database Error (Clock Out):", error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ฐานข้อมูล' });
    }
});

// ==========================================
// 🕒 API ดึงประวัติการลงเวลาของพนักงาน (30 วันล่าสุด)
// ==========================================
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
// หน้าแรกทดสอบ Server
// ==========================================
app.get('/', (req, res) => {
    res.send('🚀 HR Attendance Backend is running!');
});

// ==========================================
// 🔴 API สำหรับบันทึกเวลาเลิกงาน + คำนวณชั่วโมงทำงาน/OT และยอดเงินรายวัน
// ==========================================
app.post('/api/attendance/clock-out', async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });

        // 1. ดึงเวลาเข้างานของวันนี้มาดูก่อน
        const checkSql = `SELECT check_in_time FROM attendance_logs WHERE emp_id = ? AND work_date = CURDATE() ORDER BY log_id DESC LIMIT 1`;
        const [existing] = await db.query(checkSql, [emp_id]);

        if (existing.length === 0) {
            return res.status(400).json({ message: 'ไม่พบข้อมูลการเข้างาน กรุณากดเข้างานก่อน' });
        }

        const checkInTime = new Date(existing[0].check_in_time);
        const checkOutTime = new Date(); // เวลาปัจจุบันตอนกดเลิกงาน

        // 2. คำนวณเวลา (แปลงมิลลิวินาที เป็น ชั่วโมง)
        const diffMs = checkOutTime - checkInTime;
        let totalHours = diffMs / (1000 * 60 * 60);

        // 3. หักพักเที่ยง 1 ชั่วโมง (ถ้าทำงานเกิน 5 ชั่วโมง)
        if (totalHours > 5) {
            totalHours -= 1;
        }

        // 4. แยกชั่วโมงปกติ (work_hours) และ ชั่วโมง OT (ot_hours)
        let workHours = totalHours > 8 ? 8 : totalHours; // ทำงานปกติสูงสุด 8 ชม.
        let otHours = totalHours > 8 ? totalHours - 8 : 0;  // ส่วนที่เกินคือ OT

        // ปัดเศษทศนิยม 2 ตำแหน่ง
        workHours = parseFloat(workHours.toFixed(2));
        otHours = parseFloat(otHours.toFixed(2));

        // 5. อัปเดตข้อมูลลงฐานข้อมูล
        const updateSql = `
            UPDATE attendance_logs 
            SET check_out_time = ?, work_hours = ?, ot_hours = ? 
            WHERE emp_id = ? AND work_date = CURDATE() 
            ORDER BY log_id DESC LIMIT 1
        `;
        await db.query(updateSql, [checkOutTime, workHours, otHours, emp_id]);

        // 6. 💰 คำนวณยอดเงินของวันนี้ส่งกลับไปให้หน้าเว็บแจ้งเตือน
        const HOURLY_WAGE = 50; // เรทปกติ
        const OT_WAGE = 75;     // เรท OT
        const earnedToday = (workHours * HOURLY_WAGE) + (otHours * OT_WAGE);

        res.status(200).json({
            message: `บันทึกเวลาเลิกงานสำเร็จ! ทำงาน ${workHours} ชม. | OT ${otHours} ชม. \n(ยอดรายได้วันนี้: ${earnedToday} บาท) 💸`
        });

    } catch (error) {
        console.error("Clock Out Error:", error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเวลาเลิกงาน' });
    }
});

// ==========================================
// 💰 API ดึงรายงานสรุปเวลาทำงานและคำนวณเงินเดือน (สำหรับ HR)
// ==========================================
app.get('/api/admin/salary-report', async (req, res) => {
    try {
        // รับค่าเดือนและปี (ถ้าไม่ส่งมา ให้ใช้เดือนปัจจุบัน)
        const targetMonth = req.query.month || new Date().getMonth() + 1;
        const targetYear = req.query.year || new Date().getFullYear();

        // แก้ไข SQL นิดหน่อย ให้ใช้ targetMonth และ targetYear
        const sql = `
            SELECT 
                a.emp_id, 
                e.first_name, 
                e.last_name,
                SUM(a.work_hours) as total_work_hours,
                SUM(a.ot_hours) as total_ot_hours
            FROM attendance_logs a
            JOIN employees e ON a.emp_id = e.emp_id
            WHERE MONTH(a.work_date) = ? AND YEAR(a.work_date) = ?
            GROUP BY a.emp_id
        `;

        // ใส่พารามิเตอร์เข้าไปในคำสั่ง Query
        const [rows] = await db.query(sql, [targetMonth, targetYear]);

        const reportData = rows.map(emp => {
            const HOURLY_WAGE = 50;
            const OT_WAGE = 75;

            const workHours = emp.total_work_hours || 0;
            const otHours = emp.total_ot_hours || 0;

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
// 🚀 เริ่มต้นเซิร์ฟเวอร์
// ==========================================
const PORT = process.env.PORT || 1304;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});