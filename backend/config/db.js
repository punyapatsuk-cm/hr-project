const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'hr_attendance_db',

    waitForConnections: true, 
    connectionLimit:    10,   
    queueLimit:         0,    
    timezone:    '+07:00', 
    dateStrings: true,  
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err.message);
    } else {
        console.log('Connected to MySQL Database successfully!');
        connection.release();
    }
});

module.exports = pool.promise();