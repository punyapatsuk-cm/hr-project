document.getElementById('login-form').addEventListener('submit', async function(event) {
    event.preventDefault(); // ป้องกันหน้าเว็บรีโหลด

    // ดึงค่าจาก Input ให้ตรงกับ id ใน HTML
    const emp_id = document.getElementById('emp-id').value;
    const password = document.getElementById('password').value;

    try {
        const res = await axios.post('http://localhost:1304/api/auth/login', {
            emp_id: emp_id,
            password: password
        });

        if (res.status === 200) {
            const user = res.data.user;

            // เก็บข้อมูลลง LocalStorage
            localStorage.setItem('employeeId', user.emp_id);
            localStorage.setItem('employeeName', user.name);
            localStorage.setItem('userRole', user.role);
            
            // เก็บ Token ถ้ามี (ดึงมาจากโค้ดเดิมของคุณ)
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
            }

            // แยกเส้นทางตาม Role
            if (user.role === 'admin') {
                alert("เข้าสู่ระบบในฐานะ: ผู้ดูแลระบบ (Admin)");
                window.location.href = 'admin.html';
            } else {
                alert("เข้าสู่ระบบในฐานะ: พนักงาน");
                window.location.href = 'home.html';
            }
        }
    } catch (error) {
        console.error("Login Error:", error);
        // แสดงข้อความ Error จาก Backend หรือข้อความเริ่มต้น
        const errorMsg = error.response?.data?.message || 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง';
        alert('❌ ล็อกอินไม่สำเร็จ: ' + errorMsg);
    }
});