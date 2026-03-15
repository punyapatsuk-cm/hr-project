-- ลบตารางเก่าทิ้งถ้ามี (เรียงลำดับตาม Foreign Key เพื่อไม่ให้ติด Error)
DROP TABLE IF EXISTS attendance_logs;
DROP TABLE IF EXISTS leave_balances;
DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS announcements;

-- 1. สร้างตารางแผนก
CREATE TABLE departments (
    dept_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_name VARCHAR(100) NOT NULL
);

-- 2. สร้างตารางพนักงาน (เพิ่ม hourly_rate แล้ว)
CREATE TABLE employees (
    emp_id VARCHAR(10) PRIMARY KEY,
    dept_id INT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    hourly_rate DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE SET NULL
);

-- 3. สร้างตารางบันทึกเวลา
CREATE TABLE attendance_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    emp_id VARCHAR(10),
    work_date DATE NOT NULL,
    check_in_time DATETIME NOT NULL,
    check_out_time DATETIME NULL,
    work_hours DECIMAL(5,2) NULL,
    ot_hours DECIMAL(5,2) NULL,
    snapshot_image VARCHAR(255) NULL,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

-- 4. สร้างตารางการลา
CREATE TABLE leave_requests (
    leave_id INT AUTO_INCREMENT PRIMARY KEY,
    emp_id VARCHAR(10),
    leave_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    attachment VARCHAR(255) NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

-- 5. สร้างตารางโควตาวันลา
CREATE TABLE leave_balances (
    balance_id INT AUTO_INCREMENT PRIMARY KEY,
    emp_id VARCHAR(10),
    year YEAR NOT NULL,
    sick_leave_remaining INT DEFAULT 30,
    personal_leave_remaining INT DEFAULT 6,
    annual_leave_remaining INT DEFAULT 6,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

-- 6. สร้างตารางประกาศข่าวสาร (ตารางใหม่)
CREATE TABLE announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ====================================================
-- 📦 ส่วนเพิ่มข้อมูลจำลอง (Mock Data) สำหรับทดสอบระบบ
-- ====================================================

-- เพิ่มข้อมูลแผนก
INSERT INTO departments (dept_id, dept_name) VALUES 
(1, 'Human Resources'), 
(2, 'IT Department'),
(3, 'IT Support'),
(4, 'Developer'),
(5, 'IT Security'),
(6, 'IT Management');

-- เพิ่มข้อมูลพนักงาน (อิงตามฐานข้อมูลของพี่)
INSERT INTO employees (emp_id, dept_id, first_name, last_name, password, role, hourly_rate) VALUES 
('ADMIN00', 1, 'Punyapat', 'Sukcharoen', '12345', 'admin', 200.00),
('ADMIN01', 3, 'Somchai', 'Jai-dee', '123456', 'admin', 0.00),
('ADMIN02', 6, 'test1', '1', '12345', 'user', 120.00),
('test2', 1, 'test2', 'user', '12345', 'user', 130.00);

-- เพิ่มโควตาวันลา
INSERT INTO leave_balances (emp_id, year, sick_leave_remaining, personal_leave_remaining, annual_leave_remaining) VALUES 
('ADMIN01', 2026, 30, 6, 6),
('ADMIN00', 2026, 30, 6, 6),
('ADMIN02', 2026, 0, 3, 2),
('test2', 2026, 30, 6, 6);

-- เพิ่มประกาศจำลอง
INSERT INTO announcements (title, content) VALUES 
('ประกาศวันหยุดเทศกาลสงกรานต์ ประจำปี 2569', 'เรียน พนักงานทุกท่าน\n\nบริษัทฯ ขอแจ้งวันหยุดทำการเนื่องในเทศกาลสงกรานต์ ประจำปี 2569 โดยจะหยุดทำการตั้งแต่วันจันทร์ที่ 13 เมษายน ถึง วันพุธที่ 15 เมษายน 2569\n\nขอให้ทุกท่านมีความสุขในวันหยุดครับ'),
('ประกาศวันหยุดทำการ เนื่องในวันจักรี (6 เมษายน 2569)', 'เรียน พนักงานทุกท่าน\n\nบริษัทฯ ขอแจ้งวันหยุดทำการเนื่องในวันพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช และวันที่ระลึกมหาจักรีบรมราชวงศ์ (วันจักรี) ในวันจันทร์ที่ 6 เมษายน 2569\n\nประกาศโดย: ฝ่ายทรัพยากรบุคคล (HR)');

-- เพิ่มประวัติการลาจำลองนิดหน่อยให้หน้าเว็บไม่ว่างเปล่า
INSERT INTO leave_requests (emp_id, leave_type, start_date, end_date, reason, status) VALUES 
('ADMIN02', 'Sick Leave', '2026-03-15', '2026-03-19', 'ไม่สบาย เป็นไข้หวัด', 'approved'),
('ADMIN02', 'Annual Leave', '2026-03-25', '2026-03-27', 'ไปเที่ยวพักผ่อนกับครอบครัว', 'pending');

-- เพิ่มประวัติลงเวลาจำลอง
INSERT INTO attendance_logs (emp_id, work_date, check_in_time, check_out_time, work_hours, ot_hours) VALUES 
('ADMIN02', '2026-03-15', '2026-03-15 08:50:00', '2026-03-15 18:30:00', 8.00, 0.50),
('ADMIN00', '2026-03-15', '2026-03-15 09:10:00', '2026-03-15 20:00:00', 8.00, 2.00);