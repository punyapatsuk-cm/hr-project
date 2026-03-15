const db = require('../config/db');

exports.clockIn = async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });

        /* ====================================================
        🔒 โค้ดเก่า
        const [existing] = await db.query(
            SELECT * FROM attendance_logs WHERE emp_id = ? AND work_date = CURDATE()',
            [emp_id]
        );
            if (existing.length === 0) { ... }
            if (existing[0].check_out_time !== null) { ... }
            await db.query('UPDATE attendance_logs SET check_out_time = NOW() WHERE emp_id = ? AND work_date = CURDATE()', [emp_id]);
        ==================================================== */

        // 🔓 โค้ดใหม่: ดึงข้อมูลการลงเวลา "ล่าสุด" ของวันนี้มาเช็ค (ORDER BY DESC LIMIT 1)
        const [existing] = await db.query(
            'SELECT * FROM attendance_logs WHERE emp_id = ? AND work_date = CURDATE() ORDER BY check_in_time DESC LIMIT 1',
            [emp_id]
        );

        // ถ้ามีประวัติล่าสุด และประวัตินั้นยังไม่มีเวลาออกงาน (แปลว่ายังอยู่ในเวลางาน)
        if (existing.length > 0 && existing[0].check_out_time === null) {
            return res.status(400).json({ message: 'คุณยังไม่ได้บันทึกเลิกงานของรอบที่แล้ว กรุณากดเลิกงานก่อน' });
        }

        // ถ้าไม่มีประวัติของวันนี้ หรือ ประวัติล่าสุดกดเลิกงานไปแล้ว -> สร้างบันทึกเข้างานรอบใหม่
        await db.query(
            'INSERT INTO attendance_logs (emp_id, work_date, check_in_time) VALUES (?, CURDATE(), NOW())',
            [emp_id]
        );

        console.log(`⏰ Employee ${emp_id} clocked IN (New Shift).`);
        res.status(200).json({ message: 'บันทึกเวลาเข้างานสำเร็จ!' });
    } catch (error) {
        console.error('Clock-In Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเวลาเข้างาน' });
    }
};

exports.clockOut = async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });

        // 🔓 โค้ดใหม่: ดึงข้อมูลการลงเวลา "ล่าสุด" ของวันนี้มาเช็ค
        const [existing] = await db.query(
            'SELECT * FROM attendance_logs WHERE emp_id = ? AND work_date = CURDATE() ORDER BY check_in_time DESC LIMIT 1',
            [emp_id]
        );

        if (existing.length === 0) {
            return res.status(400).json({ message: 'ไม่พบข้อมูลการเข้างานของวันนี้ กรุณากดเข้างานก่อน' });
        }

        // ถ้าประวัติล่าสุดมีเวลาเลิกงานถูกบันทึกไปแล้ว
        if (existing[0].check_out_time !== null) {
            return res.status(400).json({ message: 'คุณได้บันทึกเวลาเลิกงานของรอบล่าสุดไปแล้ว' });
        }

        // อัปเดตเวลาเลิกงาน เฉพาะบรรทัดที่ยังไม่ได้ลงเวลาออกงาน
        await db.query(
            'UPDATE attendance_logs SET check_out_time = NOW() WHERE emp_id = ? AND work_date = CURDATE() AND check_out_time IS NULL',
            [emp_id]
        );

        console.log(`🏃‍♂️ Employee ${emp_id} clocked OUT.`);
        res.status(200).json({ message: 'บันทึกเวลาเลิกงานสำเร็จ เดินทางกลับปลอดภัยครับ!' });
    } catch (error) {
        console.error('Clock-Out Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเวลาเลิกงาน' });
    }
};

// ฟังก์ชันสำหรับดึงประวัติการลงเวลา
exports.getHistory = async (req, res) => {
    try {
        const emp_id = req.params.emp_id;

        // ดึงข้อมูล 30 วันล่าสุดของพนักงานคนนี้ (เพิ่ม ORDER BY check_in_time เพื่อให้เรียงเวลาให้สวยงามเวลาเข้าหลายรอบ)
        const sql = `
            SELECT work_date, check_in_time, check_out_time 
            FROM attendance_logs 
            WHERE emp_id = ? 
            ORDER BY work_date DESC, check_in_time DESC
            LIMIT 30
        `;

        const [results] = await db.query(sql, [emp_id]);
        res.status(200).json(results);
    } catch (error) {
        console.error('Fetch Attendance History Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงประวัติลงเวลา' });
    }
};