const db = require('../config/db');
exports.requestLeave = async (req, res) => {
    try {
        const { emp_id, leave_type, start_date, end_date, reason } = req.body;
        
        // รับชื่อไฟล์จาก Multer (ถ้ามี)
        const attachment = req.file ? req.file.filename : null;

        if (!emp_id || !leave_type || !start_date || !end_date) {
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        const sql = `
            INSERT INTO leave_requests (emp_id, leave_type, start_date, end_date, reason, attachment, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
        `;

        await db.query(sql, [emp_id, leave_type, start_date, end_date, reason, attachment]);
        
        console.log(`📝 Employee ${emp_id} submitted a leave request.`);
        res.status(200).json({ message: 'ส่งคำขอลางานสำเร็จ! ระบบได้บันทึกและส่งเรื่องให้ HR แล้ว' });
    } catch (error) {
        console.error('Leave Request Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ ไม่สามารถส่งคำขอลางานได้' });
    }
};

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