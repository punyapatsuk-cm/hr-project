// ============================================================
// controllers/leaveController.js
// จัดการการขอลางานและดึงประวัติ
// ============================================================

const db = require('../config/db');

// BUG FIX: กำหนด whitelist ประเภทลาที่รับได้เท่านั้น
// ป้องกันการส่งค่าแปลกๆ ลง DB เช่น leave_type = "DROP TABLE employees"
const VALID_LEAVE_TYPES = ['sick', 'personal', 'annual'];

// ==========================================
// ส่งคำขอลางาน
// ==========================================
exports.requestLeave = async (req, res) => {
    try {
        const { emp_id, leave_type, start_date, end_date, reason } = req.body;
        const attachment = req.file ? req.file.filename : null;

        // ── Validation ─────────────────────────────────────
        if (!emp_id || !leave_type || !start_date || !end_date || !reason) {
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        // BUG FIX: ตรวจสอบว่า leave_type เป็นค่าที่กำหนดไว้เท่านั้น
        if (!VALID_LEAVE_TYPES.includes(leave_type)) {
            return res.status(400).json({ message: `ประเภทการลาไม่ถูกต้อง (รับเฉพาะ: ${VALID_LEAVE_TYPES.join(', ')})` });
        }

        // ตรวจสอบว่า end_date ต้องไม่ก่อน start_date
        if (new Date(end_date) < new Date(start_date)) {
            return res.status(400).json({ message: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น' });
        }

        const sql = `
            INSERT INTO leave_requests (emp_id, leave_type, start_date, end_date, reason, attachment, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
        `;
        await db.query(sql, [emp_id, leave_type, start_date, end_date, reason, attachment]);

        console.log(`📝 Employee ${emp_id} submitted a leave request (${leave_type}).`);
        res.status(200).json({ message: 'ส่งคำขอลางานสำเร็จ! ระบบได้บันทึกและส่งเรื่องให้ HR แล้ว' });
    } catch (error) {
        console.error('Leave Request Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ ไม่สามารถส่งคำขอลางานได้' });
    }
};

// ==========================================
// ดึงประวัติการลางานของพนักงาน
// ==========================================
exports.getLeaveHistory = async (req, res) => {
    try {
        const empId = req.params.emp_id;
        const sql = `
            SELECT leave_id, leave_type, start_date, end_date, reason, status, created_at
            FROM leave_requests
            WHERE emp_id = ?
            ORDER BY created_at DESC
        `;
        const [results] = await db.query(sql, [empId]);
        res.status(200).json(results);
    } catch (error) {
        console.error('Leave History Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงประวัติการลางาน' });
    }
};