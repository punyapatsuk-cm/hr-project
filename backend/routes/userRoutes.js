const express = require('express');
const router = express.Router();
const db = require('../config/db'); 

router.get('/profile/:emp_id', async (req, res) => {
    try {
        const empId = req.params.emp_id;
        
        // 🌟 แก้ชื่อคอลัมน์ตาราง departments ให้ตรงกับฐานข้อมูล
        const sql = `
            SELECT e.*, d.dept_name AS dept_name, 
                   lb.sick_leave_remaining, 
                   lb.personal_leave_remaining, 
                   lb.annual_leave_remaining
            FROM employees e
            LEFT JOIN departments d ON e.dept_id = d.dept_id
            LEFT JOIN leave_balances lb ON e.emp_id = lb.emp_id AND lb.year = YEAR(CURDATE())
            WHERE e.emp_id = ?
        `;
        
        const [results] = await db.query(sql, [empId]);
        
        if (results.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลพนักงาน' });
        }
        
        res.status(200).json(results[0]);
        
    } catch (error) {
        console.error("Profile Fetch Error:", error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลส่วนตัว' });
    }
});

module.exports = router;