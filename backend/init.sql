-- ============================================================
-- hr_attendance_db — Complete Setup SQL
-- import ได้เลยทันที ไม่ต้องรัน script อื่นก่อน
-- authController.js จะ auto-upgrade password เป็น bcrypt
-- อัตโนมัติตอน login ครั้งแรก
-- ============================================================

DROP TABLE IF EXISTS attendance_logs;
DROP TABLE IF EXISTS leave_balances;
DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS announcements;

-- ============================================================
-- TABLES
-- ============================================================
CREATE TABLE departments (
    dept_id   INT AUTO_INCREMENT PRIMARY KEY,
    dept_name VARCHAR(100) NOT NULL
);

CREATE TABLE employees (
    emp_id      VARCHAR(10)  PRIMARY KEY,
    dept_id     INT,
    first_name  VARCHAR(50)  NOT NULL,
    last_name   VARCHAR(50)  NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('user','admin') DEFAULT 'user',
    hourly_rate DECIMAL(10,2) DEFAULT 0.00,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE SET NULL
);

CREATE TABLE attendance_logs (
    log_id         INT AUTO_INCREMENT PRIMARY KEY,
    emp_id         VARCHAR(10),
    work_date      DATE     NOT NULL,
    check_in_time  DATETIME NOT NULL,
    check_out_time DATETIME NULL,
    work_hours     DECIMAL(5,2) NULL,
    ot_hours       DECIMAL(5,2) NULL,
    snapshot_image VARCHAR(255) NULL,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

CREATE TABLE leave_requests (
    leave_id   INT AUTO_INCREMENT PRIMARY KEY,
    emp_id     VARCHAR(10),
    leave_type VARCHAR(50)  NOT NULL,
    start_date DATE         NOT NULL,
    end_date   DATE         NOT NULL,
    reason     TEXT         NOT NULL,
    attachment VARCHAR(255) NULL,
    status     ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

CREATE TABLE leave_balances (
    balance_id               INT AUTO_INCREMENT PRIMARY KEY,
    emp_id                   VARCHAR(10),
    year                     YEAR NOT NULL,
    sick_leave_remaining     INT DEFAULT 30,
    personal_leave_remaining INT DEFAULT 6,
    annual_leave_remaining   INT DEFAULT 6,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

CREATE TABLE announcements (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    title      VARCHAR(255) NOT NULL,
    content    TEXT         NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DATA
-- ============================================================

INSERT INTO departments (dept_id, dept_name) VALUES
(1, 'Human Resources'),
(2, 'IT Department'),
(3, 'IT Support'),
(4, 'Developer'),
(5, 'IT Security'),
(6, 'IT Management');

-- รหัสผ่านเป็น plain text — จะถูก auto-upgrade เป็น bcrypt ตอน login ครั้งแรก
INSERT INTO employees (emp_id, dept_id, first_name, last_name, password, role, hourly_rate) VALUES
('ADMIN', 1, 'ADMIN', 'admin', '12345',  'admin', 200.00),

INSERT INTO leave_balances (emp_id, year, sick_leave_remaining, personal_leave_remaining, annual_leave_remaining) VALUES
('ADMIN00', 2026, 30, 6, 6),

INSERT INTO announcements (title, content) VALUES
('ประกาศวันหยุดเทศกาลสงกรานต์ ประจำปี 2569',
 'เรียน พนักงานทุกท่าน\n\nบริษัทฯ ขอแจ้งวันหยุดทำการเนื่องในเทศกาลสงกรานต์ ประจำปี 2569 โดยจะหยุดทำการตั้งแต่วันจันทร์ที่ 13 เมษายน ถึง วันพุธที่ 15 เมษายน 2569\n\nขอให้ทุกท่านมีความสุขในวันหยุดครับ'),

-- leave_type ใช้ตัวเล็ก: sick / personal / annual ตรงกับโค้ด
INSERT INTO leave_requests (emp_id, leave_type, start_date, end_date, reason, status) VALUES


INSERT INTO attendance_logs (emp_id, work_date, check_in_time, check_out_time, work_hours, ot_hours) VALUES
