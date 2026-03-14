const handleLogin = async (event) => {
    event.preventDefault(); // ป้องกันหน้าเว็บรีโหลด

    // 1. ดึงค่าจาก Input (เช็ค ID ใน login.html ให้ตรงกันนะครับ)
    const emp_id = document.getElementById('username').value; 
    const password = document.getElementById('password').value;

    try {
        // 2. ส่งข้อมูลไปที่ Backend
        const res = await axios.post('http://localhost:1304/api/auth/login', { 
            emp_id: emp_id, 
            password: password 
        });

        if (res.status === 200) {
            const userData = res.data.user; // { emp_id, name, role }

            // 3. เก็บข้อมูลลง LocalStorage ไว้ใช้หน้าอื่น
            localStorage.setItem('employeeId', userData.emp_id);
            localStorage.setItem('employeeName', userData.name);
            localStorage.setItem('userRole', userData.role);
            localStorage.setItem('token', res.data.token);

            // 4. ✨ แยกเส้นทางตาม Role ✨
            if (userData.role === 'admin') {
                alert('เข้าสู่ระบบสำเร็จ: ยินดีต้อนรับ HR/Admin');
                window.location.href = 'admin.html'; // ไปหน้าจัดการ
            } else {
                alert('เข้าสู่ระบบสำเร็จ: ยินดีต้อนรับพนักงาน');
                window.location.href = 'home.html';  // ไปหน้าปกติ
            }
        }
    } catch (error) {
        console.error(error);
        const errorMsg = error.response?.data?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        alert('❌ ล็อกอินไม่สำเร็จ: ' + errorMsg);
    }
};

// เชื่อมต่อฟังก์ชันกับปุ่ม Login (สมมติปุ่มมี id="login-btn")
// หรือถ้าใช้ <form onsubmit="handleLogin(event)"> ก็ไม่ต้องใช้บรรทัดล่างนี้ครับ
document.getElementById('login-form').addEventListener('submit', handleLogin);