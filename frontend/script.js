// ── ซ่อน Error ──
function showLoginError(msg) {
    const el    = document.getElementById('login-error');
    const msgEl = document.getElementById('login-error-msg');
    if (!el || !msgEl) return;
    msgEl.textContent = msg;
    el.classList.add('show');
}

function hideLoginError() {
    const el = document.getElementById('login-error');
    if (el) el.classList.remove('show');
}

// ── init Login Form ───
function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    // ล้าง error เมื่อผู้ใช้พิมพ์ใหม่
    const empInput  = document.getElementById('emp-id');
    const passInput = document.getElementById('password');
    if (empInput)  empInput.addEventListener('input',  hideLoginError);
    if (passInput) passInput.addEventListener('input', hideLoginError);

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        hideLoginError();

        const emp_id   = document.getElementById('emp-id').value.trim();
        const password = document.getElementById('password').value;
        const btn      = document.getElementById('submit-btn');

        if (btn) {
            btn.disabled  = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...';
        }

        try {
            const res = await axios.post(`${API_BASE}/api/auth/login`, { emp_id, password });

            if (res.status === 200) {
                const user = res.data.user;

                // บันทึกข้อมูลลง localStorage
                localStorage.setItem('employeeId',   user.emp_id);
                localStorage.setItem('employeeName', user.name);
                localStorage.setItem('userRole',     user.role);

                // บันทึก JWT token สำหรับส่งใน Authorization header ทุก API call
                if (res.data.token) localStorage.setItem('token', res.data.token);

                if (btn) btn.innerHTML = '<i class="fas fa-check"></i> เข้าสู่ระบบสำเร็จ';

                // Redirect ตาม role
                setTimeout(() => {
                    window.location.href = user.role === 'admin' ? 'admin.html' : 'home.html';
                }, 400);
            }
        } catch (error) {
            const msg = error.response?.data?.message || 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง';
            showLoginError(msg);
            if (btn) {
                btn.disabled  = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> เข้าสู่ระบบ';
            }
        }
    });
}

// รัน initLogin เมื่อ DOM พร้อม
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogin);
} else {
    initLogin();
}