// ============================================================
// controllers/attendanceController.js
// จัดการ Clock-in / Clock-out และดึงประวัติการลงเวลา
// ============================================================

const db = require('../config/db');

// กำหนดเวลามาตรฐาน (ปรับได้ตามบริษัท)
const WORK_START_HOUR = 8;   // เริ่มงาน 08:00
const WORK_END_HOUR   = 17;  // เลิกงานปกติ 17:00
const OT_END_HOUR     = 21;  // OT ได้ถึงแค่ 21:00 (5 ทุ่ม)
const BREAK_HOURS     = 1;   // พักเที่ยง 1 ชม.
const BREAK_THRESHOLD = 6;   // หักพักเมื่อทำงานเกิน 6 ชม.
// ── Helper: คำนวณชั่วโมงจาก milliseconds ──
const msToHours = (ms) => parseFloat((ms / (1000 * 60 * 60)).toFixed(2));

// ==========================================
// บันทึกเข้างาน (Clock-In)
// ==========================================
exports.clockIn = async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });

        // ตรวจสอบว่าอยู่ในช่วงเวลาที่ลงงานได้ (08:00 - 21:00)
        const nowHour = new Date().getHours();
        if (nowHour >= OT_END_HOUR || nowHour < WORK_START_HOUR) {
            return res.status(400).json({
                message: `ไม่สามารถลงเวลาได้ในช่วงนี้ (${OT_END_HOUR}:00 – ${WORK_START_HOUR}:00) กรุณาลงเวลาระหว่าง ${WORK_START_HOUR}:00 – ${OT_END_HOUR}:00`
            });
        }

        // ตรวจสอบว่ายังมีรอบที่ยังไม่ clock-out อยู่ไหม
        const [existing] = await db.query(
            `SELECT * FROM attendance_logs
             WHERE emp_id = ? AND work_date = CURDATE()
             ORDER BY check_in_time DESC LIMIT 1`,
            [emp_id]
        );

        if (existing.length > 0 && existing[0].check_out_time === null) {
            return res.status(400).json({ message: 'คุณยังไม่ได้บันทึกเลิกงานของรอบที่แล้ว กรุณากดเลิกงานก่อน' });
        }

        await db.query(
            'INSERT INTO attendance_logs (emp_id, work_date, check_in_time) VALUES (?, CURDATE(), NOW())',
            [emp_id]
        );

        console.log(`⏰ Employee ${emp_id} clocked IN.`);
        res.status(200).json({ message: 'บันทึกเวลาเข้างานสำเร็จ!' });
    } catch (error) {
        console.error('Clock-In Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเวลาเข้างาน' });
    }
};

// ==========================================
// บันทึกเลิกงาน (Clock-Out)
// ==========================================
exports.clockOut = async (req, res) => {
    try {
        const { emp_id } = req.body;
        if (!emp_id) return res.status(400).json({ message: 'ไม่พบรหัสพนักงาน' });

        const [existing] = await db.query(
            `SELECT * FROM attendance_logs
             WHERE emp_id = ? AND work_date = CURDATE()
             ORDER BY check_in_time DESC LIMIT 1`,
            [emp_id]
        );

        if (existing.length === 0) {
            return res.status(400).json({ message: 'ไม่พบข้อมูลการเข้างานของวันนี้ กรุณากดเข้างานก่อน' });
        }

        if (existing[0].check_out_time !== null) {
            return res.status(400).json({ message: 'คุณได้บันทึกเวลาเลิกงานของรอบล่าสุดไปแล้ว' });
        }

        const checkInTime  = new Date(existing[0].check_in_time);
        const checkOutTime = new Date();

        const normalEnd = new Date(checkInTime);
        normalEnd.setHours(WORK_END_HOUR, 0, 0, 0); // 17:00

        const otEnd = new Date(checkInTime);
        otEnd.setHours(OT_END_HOUR, 0, 0, 0);       // 21:00

        // Cap checkout ที่ 21:00 — ถ้าออกหลัง 21:00 นับแค่ถึง 21:00
        const effectiveOut = checkOutTime > otEnd ? otEnd : checkOutTime;

        let rawWork = 0, rawOt = 0;

        if (checkInTime >= normalEnd) {
            // เข้า 17:00-21:00 → นับเป็น OT ทั้งหมด
            rawOt = Math.max(0, msToHours(effectiveOut - checkInTime));
        } else if (effectiveOut <= normalEnd) {
            // ออกก่อนหรือตรง 17:00 → ไม่มี OT
            rawWork = Math.max(0, msToHours(effectiveOut - checkInTime));
        } else {
            // เข้าก่อน 17:00 ออกหลัง 17:00 → แบ่ง work/OT ที่ 17:00
            rawWork = Math.max(0, msToHours(normalEnd - checkInTime));
            rawOt   = Math.max(0, msToHours(effectiveOut - normalEnd));
        }

        // หักพักเที่ยง 1 ชม. อัตโนมัติถ้าทำงานรวมเกิน 6 ชม.
        const totalRaw    = rawWork + rawOt;
        const breakDeduct = totalRaw > BREAK_THRESHOLD ? BREAK_HOURS : 0;

        // หักพักจาก work_hours ก่อน ถ้าไม่พอค่อยหักจาก ot_hours
        let work_hours, ot_hours;
        if (breakDeduct <= rawWork) {
            work_hours = rawWork - breakDeduct;
            ot_hours   = rawOt;
        } else {
            work_hours = 0;
            ot_hours   = Math.max(0, rawOt - (breakDeduct - rawWork));
        }

        await db.query(
            `UPDATE attendance_logs
             SET check_out_time = NOW(), work_hours = ?, ot_hours = ?
             WHERE emp_id = ? AND work_date = CURDATE() AND check_out_time IS NULL`,
            [work_hours, ot_hours, emp_id]
        );

        console.log(`🏃 Employee ${emp_id} clocked OUT. work=${work_hours}h OT=${ot_hours}h`);
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

// ==========================================
// ดึงประวัติการลงเวลา (30 วันล่าสุด)
// ==========================================
exports.getHistory = async (req, res) => {
    try {
        const emp_id = req.params.emp_id;

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