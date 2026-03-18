// ============================================================
// server.js — Entry Point ของ Backend
// ============================================================

const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

// ── Routes ──────────────────────────────────────────────────
const authRoutes       = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes      = require('./routes/leaveRoutes');
const adminRoutes      = require('./routes/admin');
const userRoutes       = require('./routes/userRoutes');

const app  = express();
const PORT = process.env.PORT || 1304;

// ── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(cors());

// เปิดให้เข้าถึงไฟล์ที่อัปโหลด (เอกสารแนบใบลา)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Logger — แสดง method และ path ของทุก request
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleString('th-TH')}] ${req.method} ${req.originalUrl}`);
    next();
});

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave',      leaveRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/employee',   userRoutes);

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('=========================================');
    console.log(`🌟 Backend Server is running on port ${PORT}`);
    console.log('=========================================');
});