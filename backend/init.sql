-- สร้างตารางแผนก
CREATE TABLE departments (
    dept_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_name VARCHAR(100) NOT NULL
);

-- สร้างตารางพนักงาน
CREATE TABLE employees (
    emp_id VARCHAR(10) PRIMARY KEY,
    dept_id INT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE SET NULL
);

-- สร้างตารางบันทึกเวลา
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

-- สร้างตารางการลา
CREATE TABLE leave_requests (
    leave_id INT AUTO_INCREMENT PRIMARY KEY,
    emp_id VARCHAR(10),
    leave_type ENUM('sick', 'personal', 'annual') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    attachment VARCHAR(255) NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

-- สร้างตารางโควตาวันลา
CREATE TABLE leave_balances (
    balance_id INT AUTO_INCREMENT PRIMARY KEY,
    emp_id VARCHAR(10),
    year YEAR NOT NULL,
    sick_leave_remaining INT DEFAULT 30,
    personal_leave_remaining INT DEFAULT 6,
    annual_leave_remaining INT DEFAULT 10,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

-- ใส่ข้อมูล Admin ทดสอบ
INSERT INTO departments (dept_name) VALUES ('Human Resources'), ('IT Department');
INSERT INTO employees (emp_id, dept_id, first_name, last_name, password, role) VALUES ('ADMIN01', 1, 'Somchai', 'Jai-dee', '123456', 'admin');
