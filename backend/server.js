const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// 1. ดึงไฟล์ Routes เข้ามาทั้งหมด
const authRoutes = require('./routes/authRoutes'); 
const attendanceRoutes = require('./routes/attendanceRoutes'); 
const leaveRoutes = require('./routes/leaveRoutes'); 
const adminRoutes = require('./routes/admin'); 
const userRoutes = require('./routes/userRoutes');

const app = express();
const port = process.env.PORT || 1304;

app.use(bodyParser.json());
app.use(cors());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleString('th-TH')}] 🚀 ${req.method} API: ${req.originalUrl}`);
    next();
});

// 2. กำหนดเส้นทางให้ API (เพิ่ม Auth และ Attendance กลับเข้ามา)
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);

// 3. กำหนดเส้นทางให้ Leave และ Admin 
// (ใส่ไว้ทั้ง 2 แบบเลย เพื่อกันเหนียว เผื่อหน้าเว็บเรียกแบบไหนก็จะเจอข้อมูลแน่นอน)
app.use('/api/leave', leaveRoutes); 
app.use('/api/admin', adminRoutes); 
app.use('/api', leaveRoutes); 
app.use('/api', adminRoutes);

// 4. นำ userRoutes มาใช้งาน สำหรับหน้า Profile พนักงาน
app.use('/api/employee', userRoutes); 

// รัน Server
app.listen(port, () => {
    console.log(`=========================================`);
    console.log(`🌟 Backend Server is running on port ${port}`);
    console.log(`=========================================`);
});