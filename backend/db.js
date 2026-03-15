const mysql = require('mysql2');
require('dotenv').config();

// สร้าง Connection Pool (ช่วยจัดการให้ระบบรับคนใช้งานพร้อมกันได้เยอะๆ)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+07:00',
    dateStrings: true
});

// ทดสอบการเชื่อมต่อ
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL Database successfully!');
        connection.release();
    }
});


// ส่งออกเป็นแบบ Promise เพื่อให้ใช้ async/await ได้ง่ายๆ ในอนาคต
module.exports = pool.promise();