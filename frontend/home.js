// 1. ดึงข้อมูลพนักงานตอนโหลดหน้า
const name = localStorage.getItem('employeeName');
const empId = localStorage.getItem('employeeId');

if (name) {
    document.getElementById('welcome-msg').innerText = "ยินดีต้อนรับเข้าสู่ระบบ คุณ " + name;
    document.getElementById('sidebar-name').innerText = "คุณ " + name;
    document.getElementById('topbar-name').innerText = name;
    document.getElementById('profile-emp-id').innerText = empId || "ไม่ระบุ";
} else {
    window.location.href = 'login.html';
}

function closeAlert() {
    const box = document.getElementById('welcomeBox');
    box.style.opacity = '0';
    setTimeout(() => { box.style.display = 'none'; }, 300);
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// 2. ฟังก์ชันสลับหน้า
function switchPage(event, pageId, clickedLink) {
    if (event) event.preventDefault(); // หยุดการรีโหลดหน้าจากการกดลิงก์

    // 1. ซ่อนทุกหน้า
    const allPages = document.querySelectorAll('.page-section');
    allPages.forEach(page => page.style.display = 'none');

    // 2. แสดงหน้า ที่เลือก
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.style.display = 'block';

    // 3. เปลี่ยนสถานะเมนู Sidebar
    const allLinks = document.querySelectorAll('.sidebar-menu a');
    allLinks.forEach(link => link.classList.remove('active'));
    if (clickedLink) clickedLink.classList.add('active');

    // 4. โหลดข้อมูลเฉพาะหน้า (ไม่ต้องรีโหลดทั้งหน้า)
    if (pageId === 'page-news') loadAnnouncements();
    if (pageId === 'page-profile') loadUserProfile();
}

// 3. ฟังก์ชันนาฬิกา
function updateClock() {
    const timeDisplay = document.getElementById('current-time');
    if (timeDisplay) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('th-TH', { hour12: false });
        timeDisplay.innerText = timeString;
    }
}
setInterval(updateClock, 1000);
updateClock();

// 4. ผูกปุ่มเข้างานด้วย Event Listener
document.getElementById('btn-clock-in').addEventListener('click', async function (event) {
    event.preventDefault();

    const empId = localStorage.getItem('employeeId');
    if (!empId) return alert('ไม่พบรหัสพนักงาน กรุณาล็อกอินใหม่');

    const statusEl = document.getElementById('attendance-status');
    statusEl.innerText = 'สถานะ: ⏳ กำลังบันทึกข้อมูล...';
    statusEl.style.color = '#007bff'; // สีฟ้าแสดงสถานะรอ

    try {
        const response = await axios.post('http://localhost:1304/api/attendance/clock-in', { emp_id: empId });

        const msg = response.data.message || "บันทึกเวลาเข้างานสำเร็จ!";
        statusEl.innerText = 'สถานะ: ✅ ' + msg;
        statusEl.style.color = 'green';
        alert(msg);

        localStorage.setItem('lastClockInDate', new Date().toDateString());
        loadAttendanceHistory();

    } catch (error) {
        const errorMsg = error.response?.data?.message || error.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
        statusEl.innerText = 'สถานะ: ❌ ' + errorMsg; // อัปเดต UI แจ้งเตือนข้อผิดพลาด
        statusEl.style.color = 'red';
        alert('❌ ' + errorMsg);
    }
});

// ปุ่มเลิกงาน (Clock Out)
document.getElementById('btn-clock-out').addEventListener('click', async function (event) {
    event.preventDefault(); // 🌟 บรรทัดนี้สำคัญที่สุด: หยุดไม่ให้หน้าเว็บรีเฟรช

    const empId = localStorage.getItem('employeeId');
    const isSure = confirm("คุณแน่ใจหรือไม่ว่าต้องการบันทึกเวลา 'เลิกงาน' ?");
    if (!isSure) return;

    try {
        const response = await axios.post('http://localhost:1304/api/attendance/clock-out', { emp_id: empId });
        alert('✅ ' + response.data.message);

        // 🌟 แทนที่จะสั่งเด้งหน้า ให้เรียกแค่ฟังก์ชันโหลดข้อมูลตารางใหม่พอ
        loadAttendanceHistory(); 
        
        // ห้ามใส่ window.location.reload() หรือ window.location.href เด็ดขาด!
    } catch (error) {
        alert('❌ ' + (error.response?.data?.message || "ผิดพลาด"));
    }
});

// 6. ฟังก์ชันดึงประวัติการเข้า-ออกงาน
async function loadAttendanceHistory() {
    const empId = localStorage.getItem('employeeId');
    if (!empId) return;

    try {
        const response = await axios.get(`http://localhost:1304/api/attendance/history/${empId}`);
        const records = response.data;
        const tbody = document.getElementById('history-table-body');

        tbody.innerHTML = '';

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px;">ยังไม่มีประวัติการลงเวลา</td></tr>';
            return;
        }

        records.forEach(record => {
            const formatDate = (dateStr) => {
                if (!dateStr) return '-';
                const d = new Date(dateStr);
                return d.toLocaleDateString('th-TH');
            };

            const formatTime = (timeStr) => {
                if (!timeStr) return '-';
                const d = new Date(timeStr);
                return d.toLocaleTimeString('th-TH', { hour12: false });
            };

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #dee2e6';
            tr.innerHTML = `
                <td style="padding: 12px; font-weight: bold;">${formatDate(record.work_date)}</td>
                <td style="padding: 12px; color: #28a745;">${formatTime(record.check_in_time)}</td>
                <td style="padding: 12px; color: #dc3545;">${record.check_out_time ? formatTime(record.check_out_time) : 'ยังไม่เลิกงาน'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error fetching history:", error);
        document.getElementById('history-table-body').innerHTML =
            '<tr><td colspan="3" style="padding: 20px; color: red;">ไม่สามารถโหลดประวัติได้</td></tr>';
    }
}
// 7. ฟังก์ชันจัดการการส่งฟอร์มลางาน
document.getElementById('leave-form').addEventListener('submit', async function (event) {
    event.preventDefault(); // ป้องกันการรีเฟรชหน้าเว็บ

    const empId = localStorage.getItem('employeeId');
    if (!empId) return alert('ไม่พบรหัสพนักงาน กรุณาล็อกอินใหม่');

    // ดึงข้อมูลจากฟอร์ม
    const leaveType = document.getElementById('leave-type').value;
    const startDate = document.getElementById('leave-start').value;
    const endDate = document.getElementById('leave-end').value;
    const reason = document.getElementById('leave-reason').value;
    const attachmentFile = document.getElementById('leave-attachment').files[0];

    // ตรวจสอบวันที่ (วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น)
    if (new Date(endDate) < new Date(startDate)) {
        return alert('❌ วันที่สิ้นสุดการลา ต้องไม่ก่อนวันที่เริ่มต้นครับ');
    }

    // สร้าง FormData (เพราะมีการอัปโหลดไฟล์ ต้องใช้แบบฟอร์มชนิดพิเศษ)
    const formData = new FormData();
    formData.append('emp_id', empId);
    formData.append('leave_type', leaveType);
    formData.append('start_date', startDate);
    formData.append('end_date', endDate);
    formData.append('reason', reason);

    if (attachmentFile) {
        formData.append('attachment', attachmentFile); // แนบไฟล์ไปด้วยถ้ามี
    }

    try {
        // ส่ง Request ไปยัง API ของเรา
        const response = await axios.post('http://localhost:1304/api/leave/request', formData, {
            headers: {
                'Content-Type': 'multipart/form-data' // จำเป็นมากสำหรับการส่งไฟล์
            }
        });

        alert('✅ ' + response.data.message);
        document.getElementById('leave-form').reset(); // ล้างข้อมูลในฟอร์มเมื่อส่งเสร็จ
        loadLeaveHistory();

    } catch (error) {
        const errorMsg = error.response?.data?.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
        alert('❌ ' + errorMsg);
    }
});
// 8. ฟังก์ชันดึงประวัติการลางาน
async function loadLeaveHistory() {
    const empId = localStorage.getItem('employeeId');
    if (!empId) return;

    try {
        const response = await axios.get(`http://localhost:1304/api/leave/history/${empId}`);
        const records = response.data;
        const tbody = document.getElementById('leave-history-body');

        tbody.innerHTML = '';

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 20px;">ยังไม่มีประวัติการลางาน</td></tr>';
            return;
        }

        records.forEach(record => {
            // ฟังก์ชันแปลงรูปแบบวันที่ให้เป็นของไทย
            const formatDate = (dateStr) => {
                if (!dateStr) return '-';
                const d = new Date(dateStr);
                return d.toLocaleDateString('th-TH');
            };

            // ตกแต่งป้ายสถานะ (Badge) ให้มีสีสัน
            let statusBadge = '';
            if (record.status === 'pending') {
                statusBadge = '<span style="background-color: #ffc107; color: #000; padding: 5px 10px; border-radius: 20px; font-size: 0.85em;">รออนุมัติ</span>';
            } else if (record.status === 'approved') {
                statusBadge = '<span style="background-color: #28a745; color: #fff; padding: 5px 10px; border-radius: 20px; font-size: 0.85em;">อนุมัติแล้ว</span>';
            } else {
                statusBadge = '<span style="background-color: #dc3545; color: #fff; padding: 5px 10px; border-radius: 20px; font-size: 0.85em;">ไม่อนุมัติ</span>';
            }

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #dee2e6';
            tr.innerHTML = `
                <td style="padding: 12px; font-weight: bold;">${record.leave_type === 'Sick Leave' ? 'ลาป่วย' : record.leave_type === 'Personal Leave' ? 'ลากิจ' : 'ลาพักร้อน'}</td>
                <td style="padding: 12px;">${formatDate(record.start_date)}</td>
                <td style="padding: 12px;">${formatDate(record.end_date)}</td>
                <td style="padding: 12px;">${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error fetching leave history:", error);
        document.getElementById('leave-history-body').innerHTML =
            '<tr><td colspan="4" style="padding: 20px; color: red;">ไม่สามารถโหลดประวัติได้</td></tr>';
    }
}

// --- 9. ฟังก์ชันดึงประกาศข่าวสารมาแสดง (ฝั่งพนักงาน) ---
async function loadAnnouncements() {
    const container = document.getElementById('announcement-container');
    if (!container) return;

    try {
        // เรียก API ดึงประกาศ (URL ต้องตรงกับที่ตั้งไว้ใน Backend)
        const response = await axios.get('http://localhost:1304/api/admin/announcements');
        const news = response.data;

        container.innerHTML = ''; // ล้าง Loading ออก

        if (news.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <p style="text-align: center; color: #999;">ขณะนี้ยังไม่มีประกาศใหม่</p>
                </div>`;
            return;
        }

        // วนลูปสร้าง Card ประกาศ
        news.forEach(item => {
            const date = new Date(item.created_at).toLocaleString('th-TH', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            container.innerHTML += `
                <div class="card" style="border-left: 5px solid #e67e22; margin-bottom: 15px; animation: fadeIn 0.5s ease;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h3 style="color: #d35400; margin-top: 0;">${item.title}</h3>
                        <span class="badge" style="background: #fff3e0; color: #e67e22; border: 1px solid #e67e22;">
                            <i class="far fa-calendar-alt"></i> ${date}
                        </span>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
                    <p style="line-height: 1.6; color: #444; white-space: pre-line;">${item.content}</p>
                </div>
            `;
        });
    } catch (error) {
        console.error("Error loading announcements:", error);
        container.innerHTML = '<div class="card"><p style="color: red;">❌ ไม่สามารถโหลดประกาศได้ในขณะนี้</p></div>';
    }
}

// แก้ไขฟังก์ชัน switchPage เพื่อให้รีเฟรชประกาศทุกครั้งที่คลิกหน้า "ข่าวสาร"
const originalSwitchPage = switchPage;
switchPage = function (event, pageId, clickedLink) {
    originalSwitchPage(event, pageId, clickedLink);
    if (pageId === 'page-news') {
        loadAnnouncements();
    }
};

// ==========================================
// 🧑‍💼 ฟังก์ชันดึงข้อมูลโปรไฟล์พนักงาน
// ==========================================
async function loadUserProfile() {
    const empId = localStorage.getItem('employeeId');
    if (!empId) return;

    try {
        // ยิง API ไปขอดึงข้อมูลของพนักงานคนนี้
        const response = await axios.get(`http://localhost:1304/api/employee/profile/${empId}`);
        const userData = response.data;

        // นำข้อมูลที่ได้มาแปะในหน้าเว็บ
        document.getElementById('profile-emp-id').innerText = userData.emp_id;
        document.getElementById('profile-full-name').innerText = `${userData.first_name} ${userData.last_name}`;

        // แปลงค่า Role ให้แสดงผลเป็นภาษาไทยสวยๆ
        const roleText = (userData.role === 'admin') ? 'HR / ผู้ดูแลระบบ' : 'พนักงานทั่วไป';
        document.getElementById('profile-role').innerText = roleText;

        // แปลงค่า dept_id เป็นชื่อแผนก (สมมติว่า 1=ไอที, 2=HR, 3=บัญชี)
        let deptText = 'ไม่ได้ระบุแผนก';
        if (userData.dept_id === 1) deptText = '💻 แผนกไอที (IT)';
        else if (userData.dept_id === 2) deptText = '👥 แผนกทรัพยากรบุคคล (HR)';
        else if (userData.dept_id === 3) deptText = '📊 แผนกบัญชี (Accounting)';

        document.getElementById('profile-dept').innerText = userData.dept_name || 'ไม่ได้ระบุแผนก';
    } catch (error) {
        console.error("Error loading profile:", error);
        document.getElementById('profile-dept').innerText = "ไม่สามารถดึงข้อมูลได้";
        document.getElementById('profile-role').innerText = "ไม่สามารถดึงข้อมูลได้";
    }
}

// 🌟 ให้ฟังก์ชันนี้โหลดข้อมูลทุกครั้งที่มีการเปลี่ยนหน้ามาที่ "ข้อมูลส่วนตัว"
// ให้คุณหาฟังก์ชัน switchPage เดิมใน home.js แล้วเพิ่มเงื่อนไขนี้เข้าไปครับ:
const originalHomeSwitchPage = switchPage;
switchPage = function (event, pageId, clickedLink) {
    originalHomeSwitchPage(event, pageId, clickedLink);

    if (pageId === 'page-news') loadAnnouncements();
    if (pageId === 'page-profile') loadUserProfile(); // <--- โหลดโปรไฟล์ตอนกดเข้ามาหน้านี้
};


// เรียกใช้งานครั้งแรกตอนโหลดหน้า
loadAnnouncements();

// เรียกใช้ฟังก์ชันนี้ทันทีตอนเปิดหน้าเว็บ
loadLeaveHistory();

// 🌟 เรียกโหลดประวัติตั้งแต่ตอนเปิดหน้าเว็บครั้งแรก
loadAttendanceHistory();