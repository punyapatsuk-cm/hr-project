const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const authRoutes       = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes      = require('./routes/leaveRoutes');
const adminRoutes      = require('./routes/admin');
const userRoutes       = require('./routes/userRoutes');

const app  = express();
const PORT = process.env.PORT || 1304;

app.use(express.json());
app.use(cors());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleString('th-TH')}] ${req.method} ${req.originalUrl}`);
    next();
});

app.use('/api/auth',       authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave',      leaveRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/employee',   userRoutes);

app.listen(PORT, () => {
    console.log('=========================================');
    console.log(` Backend Server is running on port ${PORT}`);
    console.log('=========================================');
});