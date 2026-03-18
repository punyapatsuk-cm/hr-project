const mysql = require('mysql2');
require('dotenv').config();

// สร้าง Connection Pool สำหรับเชื่อมต่อ MySQL
const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'hr_attendance_db',

    waitForConnections: true, // รอคิวถ้า connection เต็ม
    connectionLimit:    10,   // เปิด connection พร้อมกันได้สูงสุด 10 อัน
    queueLimit:         0,    // ไม่จำกัดคิว
    timezone:    '+07:00', // timezone ไทย
    dateStrings: true,     // ส่ง date/datetime กลับมาเป็น string
});

// ทดสอบการเชื่อมต่อตอน server เริ่มทำงาน
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL Database successfully!');
        connection.release();
    }
});

// Export เป็น Promise เพื่อใช้ async/await ใน controller ได้
module.exports = pool.promise();