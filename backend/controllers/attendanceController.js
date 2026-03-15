const db = require('../config/db');

// กำหนดเวลามาตรฐาน (ปรับได้ตามบริษัท)
const WORK_START_HOUR = 8;   // เริ่มงาน 08:00
const WORK_END_HOUR   = 17;  // เลิกงานปกติ 17:00 (8 ชั่วโมง)

exports.clockIn = async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });

        const [existing] = await db.query(
            'SELECT * FROM attendance_logs WHERE emp_id = ? AND work_date = CURDATE() ORDER BY check_in_time DESC LIMIT 1',
            [emp_id]
        );

        if (existing.length > 0 && existing[0].check_out_time === null) {
            return res.status(400).json({ message: 'คุณยังไม่ได้บันทึกเลิกงานของรอบที่แล้ว กรุณากดเลิกงานก่อน' });
        }

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

        const [existing] = await db.query(
            'SELECT * FROM attendance_logs WHERE emp_id = ? AND work_date = CURDATE() ORDER BY check_in_time DESC LIMIT 1',
            [emp_id]
        );

        if (existing.length === 0) {
            return res.status(400).json({ message: 'ไม่พบข้อมูลการเข้างานของวันนี้ กรุณากดเข้างานก่อน' });
        }

        if (existing[0].check_out_time !== null) {
            return res.status(400).json({ message: 'คุณได้บันทึกเวลาเลิกงานของรอบล่าสุดไปแล้ว' });
        }

        // ✅ คำนวณ work_hours และ ot_hours
        const checkInTime  = new Date(existing[0].check_in_time);
        const checkOutTime = new Date(); // เวลา clock out ตอนนี้

        // ชั่วโมงทำงานทั้งหมด (ทศนิยม 2 ตำแหน่ง)
        const totalHours = parseFloat(
            ((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(2)
        );

        // เวลาเลิกงานปกติของวันนี้ (17:00)
        const normalEnd = new Date(checkInTime);
        normalEnd.setHours(WORK_END_HOUR, 0, 0, 0);

        let work_hours = 0;
        let ot_hours   = 0;

        if (checkOutTime <= normalEnd) {
            // ออกก่อนหรือตรงเวลา → ไม่มี OT
            work_hours = totalHours;
            ot_hours   = 0;
        } else {
            // ออกหลัง 17:00 → คำนวณ OT
            work_hours = parseFloat(
                ((normalEnd - checkInTime) / (1000 * 60 * 60)).toFixed(2)
            );
            ot_hours = parseFloat(
                ((checkOutTime - normalEnd) / (1000 * 60 * 60)).toFixed(2)
            );
        }

        // ✅ UPDATE พร้อมเก็บ work_hours และ ot_hours ไปด้วยในครั้งเดียว
        await db.query(
            `UPDATE attendance_logs 
             SET check_out_time = NOW(), work_hours = ?, ot_hours = ?
             WHERE emp_id = ? AND work_date = CURDATE() AND check_out_time IS NULL`,
            [work_hours, ot_hours, emp_id]
        );

        console.log(`🏃 Employee ${emp_id} clocked OUT. work=${work_hours}h ot=${ot_hours}h`);
        res.status(200).json({
            message: 'บันทึกเวลาเลิกงานสำเร็จ เดินทางกลับปลอดภัยครับ!',
            work_hours,
            ot_hours
        });
    } catch (error) {
        console.error('Clock-Out Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเวลาเลิกงาน' });
    }
};

// ดึงประวัติการลงเวลา
exports.getHistory = async (req, res) => {
    try {
        const emp_id = req.params.emp_id;

        // ✅ เพิ่ม work_hours และ ot_hours ใน SELECT ด้วย
        const sql = `
            SELECT work_date, check_in_time, check_out_time, work_hours, ot_hours
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