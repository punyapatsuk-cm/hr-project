// ==========================================
// ⚙️ 1. ตั้งค่าเริ่มต้น & ตรวจสอบการล็อกอิน
// ==========================================
const name = localStorage.getItem('employeeName');
const empId = localStorage.getItem('employeeId');

// ถ้าไม่มีข้อมูลใน LocalStorage ให้เด้งกลับไปหน้า Login
if (!name || !empId) {
    window.location.href = 'login.html';
} else {
    // แสดงชื่อผู้ใช้บน UI
    document.getElementById('welcome-msg').innerText = "ยินดีต้อนรับเข้าสู่ระบบ คุณ " + name;
    document.getElementById('sidebar-name').innerText = "คุณ " + name;
    document.getElementById('topbar-name').innerText = name;

    // โหลดข้อมูลเริ่มต้น
    updateClock();
    setInterval(updateClock, 1000); // ให้นาฬิกาเดินทุก 1 วินาที (เรียกแค่ครั้งเดียวพอ)

    // โหลดข้อมูลหน้าแรก (ข่าวสาร) ทันทีที่เข้าเว็บ
    loadAnnouncements();
    // โหลดประวัติรอไว้เลย
    loadAttendanceHistory();
    loadLeaveHistory();
}

// ==========================================
// 🧭 2. ระบบนำทาง (Navigation) & UI
// ==========================================
function closeAlert() {
    const box = document.getElementById('welcomeBox');
    box.style.opacity = '0';
    setTimeout(() => { box.style.display = 'none'; }, 300);
}

function logout() {
    if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// 🌟 รวมฟังก์ชันเปลี่ยนหน้าไว้ที่เดียว (ลบการ Override ทิ้งเพื่อป้องกันบั๊ก)
function switchPage(event, pageId, clickedLink) {
    if (event) event.preventDefault();

    // 1. ซ่อนทุกหน้า
    document.querySelectorAll('.page-section').forEach(p => p.style.display = 'none');

    // 2. โชว์หน้าเป้าหมาย
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.style.display = 'block';

    // 3. จัดการ Class Active ของเมนูสีไฮไลท์
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    if (clickedLink) clickedLink.classList.add('active');

    // 4. โหลดข้อมูลใหม่ตามหน้าที่คลิก (Refresh Data)
    if (pageId === 'page-news') loadAnnouncements();
    if (pageId === 'page-profile') loadUserProfile();
    if (pageId === 'page-schedule') loadAttendanceHistory(); // แก้ ID ให้ตรงกับ HTML ของคุณ
    if (pageId === 'page-leave') loadLeaveHistory();
}

// ==========================================
// ⏰ 3. ระบบเวลาเข้า-ออกงาน (Attendance)
// ==========================================
function updateClock() {
    const now = new Date();
    const timeDisplay = document.getElementById('current-time');
    const dateDisplay = document.getElementById('current-date');

    if (timeDisplay) timeDisplay.innerText = now.toLocaleTimeString('th-TH');
    if (dateDisplay) {
        dateDisplay.innerText = now.toLocaleDateString('th-TH', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
}

// [เข้างาน]
document.getElementById('btn-clock-in').addEventListener('click', async function (event) {
    event.preventDefault();

    const statusEl = document.getElementById('attendance-status');
    statusEl.innerText = 'สถานะ: ⏳ กำลังบันทึกข้อมูล...';
    statusEl.style.color = '#007bff';

    try {
        const response = await axios.post('http://localhost:1304/api/attendance/clock-in', { emp_id: empId });
        statusEl.innerText = 'สถานะ: ✅ ' + response.data.message;
        statusEl.style.color = 'green';
        alert('✅ ' + response.data.message);

        loadAttendanceHistory(); // โหลดตารางใหม่ทันที

    } catch (error) {
        const errorMsg = error.response?.data?.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
        statusEl.innerText = 'สถานะ: ❌ ' + errorMsg;
        statusEl.style.color = 'red';
        alert('❌ ' + errorMsg);
    }
});

// [เลิกงาน]
document.getElementById('btn-clock-out').addEventListener('click', async function (event) {
    event.preventDefault();

    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการบันทึกเวลา 'เลิกงาน' ?")) return;

    try {
        const response = await axios.post('http://localhost:1304/api/attendance/clock-out', { emp_id: empId });
        alert('✅ ' + response.data.message);
        loadAttendanceHistory(); // โหลดตารางใหม่ทันที
    } catch (error) {
        alert('❌ ' + (error.response?.data?.message || "ผิดพลาด"));
    }
});

async function loadAttendanceHistory() {
    try {
        const response = await axios.get(`http://localhost:1304/api/attendance/history/${empId}`);
        const tbody = document.getElementById('history-table-body');
        tbody.innerHTML = '';

        if (response.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px;">ยังไม่มีประวัติการลงเวลา</td></tr>';
            return;
        }

        response.data.forEach(record => {
            const dateStr = record.work_date ? new Date(record.work_date).toLocaleDateString('th-TH') : '-';
            const inTime = record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('th-TH', { hour12: false }) : '-';
            const outTime = record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('th-TH', { hour12: false }) : 'ยังไม่เลิกงาน';

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 12px; font-weight: bold;">${dateStr}</td>
                    <td style="padding: 12px; color: #28a745;">${inTime}</td>
                    <td style="padding: 12px; color: #dc3545;">${outTime}</td>
                </tr>
            `;
        });
    } catch (error) {
        document.getElementById('history-table-body').innerHTML = '<tr><td colspan="3" style="padding: 20px; color: red;">ไม่สามารถโหลดประวัติได้</td></tr>';
    }
}

// ==========================================
// 🏖️ 4. ระบบลางาน (Leave Management)
// ==========================================
document.getElementById('leave-form').addEventListener('submit', async function (event) {
    event.preventDefault();

    const leaveType = document.getElementById('leave-type').value;
    const startDate = document.getElementById('leave-start').value;
    const endDate = document.getElementById('leave-end').value;
    const reason = document.getElementById('leave-reason').value;
    const attachmentFile = document.getElementById('leave-attachment').files[0];

    if (new Date(endDate) < new Date(startDate)) {
        return alert('❌ วันที่สิ้นสุดการลา ต้องไม่ก่อนวันที่เริ่มต้นครับ');
    }

    const formData = new FormData();
    formData.append('emp_id', empId);
    formData.append('leave_type', leaveType);
    formData.append('start_date', startDate);
    formData.append('end_date', endDate);
    formData.append('reason', reason);
    if (attachmentFile) formData.append('attachment', attachmentFile);

    try {
        const response = await axios.post('http://localhost:1304/api/leave/request', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        alert('✅ ' + response.data.message);
        document.getElementById('leave-form').reset();
        loadLeaveHistory(); // โหลดประวัติใหม่หลังส่งสำเร็จ

    } catch (error) {
        alert('❌ ' + (error.response?.data?.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"));
    }
});



// ==========================================
// 🏖️ ระบบลางาน + ค้นหา + แบ่งหน้า (Pagination)
// ==========================================

let allLeaveRecords = []; // เก็บข้อมูลการลาทั้งหมดที่ดึงมาจาก API
let currentLeavePage = 1; // หน้าปัจจุบัน
const leaveItemsPerPage = 5; // กำหนดว่าอยากให้แสดงกี่แถวต่อ 1 หน้า (เปลี่ยนเป็น 10 ได้ครับ)

// 1. ฟังก์ชันดึงข้อมูลจาก API (ดึงครั้งเดียว)
async function loadLeaveHistory() {
    const empId = localStorage.getItem('employeeId');
    if (!empId) return;

    try {
        const response = await axios.get(`http://localhost:1304/api/leave/history/${empId}`);
        allLeaveRecords = response.data; // เก็บข้อมูลทั้งหมดไว้ในตัวแปร
        currentLeavePage = 1; // รีเซ็ตกลับไปหน้า 1 เสมอเวลาโหลดใหม่

        renderLeaveTable(); // เรียกฟังก์ชันวาดตาราง
    } catch (error) {
        document.getElementById('leave-history-body').innerHTML =
            '<tr><td colspan="4" style="padding: 20px; color: red; text-align: center;">ไม่สามารถโหลดประวัติได้</td></tr>';
    }
}

// 2. ฟังก์ชันวาดตาราง (จัดการเรื่องค้นหาและแบ่งหน้า)
function renderLeaveTable() {
    const tbody = document.getElementById('leave-history-body');
    const searchInput = document.getElementById('search-leave');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    tbody.innerHTML = ''; // ล้างข้อมูลเก่าก่อน

    // 🌟 กรองข้อมูลตามคำค้นหา (ค้นหาจาก ประเภทการลา หรือ สถานะ)
    let filteredRecords = allLeaveRecords.filter(record => {
        const typeName = record.leave_type === 'Sick Leave' ? 'ลาป่วย' : record.leave_type === 'Personal Leave' ? 'ลากิจ' : 'ลาพักร้อน';
        const statusName = record.status === 'pending' ? 'รออนุมัติ' : record.status === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ';

        // ถ้ารวมคำค้นหาแล้วตรงกับประเภท หรือ สถานะ ให้แสดง (เปลี่ยนไปดึงฟิลด์อื่นมาค้นหาเพิ่มได้)
        return typeName.includes(searchTerm) || statusName.includes(searchTerm);
    });

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center;">ไม่พบข้อมูล</td></tr>';
        renderPagination(0); // ล้างปุ่ม
        return;
    }

    // 🌟 คำนวณการแบ่งหน้า (Pagination Math)
    const totalPages = Math.ceil(filteredRecords.length / leaveItemsPerPage);
    if (currentLeavePage > totalPages) currentLeavePage = totalPages; // ดักจับถ้าหน้าปัจจุบันเกินหน้าทั้งหมด

    const startIndex = (currentLeavePage - 1) * leaveItemsPerPage;
    const endIndex = startIndex + leaveItemsPerPage;
    const recordsToShow = filteredRecords.slice(startIndex, endIndex); // ตัดเอาเฉพาะข้อมูลหน้าที่จะแสดง

    // 🌟 วาดตารางข้อมูลที่ตัดมาแล้ว
    recordsToShow.forEach(record => {
        const startStr = record.start_date ? new Date(record.start_date).toLocaleDateString('th-TH') : '-';
        const endStr = record.end_date ? new Date(record.end_date).toLocaleDateString('th-TH') : '-';

        let typeName = record.leave_type === 'Sick Leave' ? 'ลาป่วย' : record.leave_type === 'Personal Leave' ? 'ลากิจ' : 'ลาพักร้อน';

        let statusBadge = '';
        if (record.status === 'pending') statusBadge = '<span style="background-color: #ffc107; color: #000; padding: 5px 10px; border-radius: 20px; font-size: 0.85em;">รออนุมัติ</span>';
        else if (record.status === 'approved') statusBadge = '<span style="background-color: #28a745; color: #fff; padding: 5px 10px; border-radius: 20px; font-size: 0.85em;">อนุมัติแล้ว</span>';
        else statusBadge = '<span style="background-color: #dc3545; color: #fff; padding: 5px 10px; border-radius: 20px; font-size: 0.85em;">ไม่อนุมัติ</span>';

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: bold;">${typeName}</td>
                <td style="padding: 12px;">${startStr}</td>
                <td style="padding: 12px;">${endStr}</td>
                <td style="padding: 12px;">${statusBadge}</td>
            </tr>
        `;
    });

    // 🌟 วาดปุ่มกดหน้า
    renderPagination(totalPages);
}

// 3. ฟังก์ชันสร้างปุ่มกดหน้า
function renderPagination(totalPages) {
    const paginationDiv = document.getElementById('leave-pagination');
    if (!paginationDiv) return;

    paginationDiv.innerHTML = '';

    if (totalPages <= 1) return; // ถ้ามีหน้าเดียวไม่ต้องโชว์ปุ่ม

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.style.padding = '5px 10px';
        btn.style.margin = '0 2px';
        btn.style.border = '1px solid #007bff';
        btn.style.backgroundColor = (i === currentLeavePage) ? '#007bff' : '#fff';
        btn.style.color = (i === currentLeavePage) ? '#fff' : '#007bff';
        btn.style.borderRadius = '3px';
        btn.style.cursor = 'pointer';

        // เมื่อกดปุ่ม ให้เปลี่ยนหน้าและวาดตารางใหม่
        btn.addEventListener('click', () => {
            currentLeavePage = i;
            renderLeaveTable();
        });

        paginationDiv.appendChild(btn);
    }
}

// 4. ผูก Event ให้ช่องค้นหาทำงานเวลามีการพิมพ์ (Real-time search)
const leaveSearchInput = document.getElementById('search-leave');
if (leaveSearchInput) {
    leaveSearchInput.addEventListener('input', () => {
        currentLeavePage = 1; // เมื่อพิมพ์ค้นหา ให้เด้งกลับมาหน้า 1 เสมอ
        renderLeaveTable();
    });
}

// ==========================================
// 📰 5. ระบบข่าวสาร & โปรไฟล์ (News & Profile)
// ==========================================
async function loadAnnouncements() {
    const container = document.getElementById('announcement-container');
    if (!container) return;

    try {
        const response = await axios.get('http://localhost:1304/api/admin/announcements');
        container.innerHTML = '';

        if (response.data.length === 0) {
            container.innerHTML = '<div class="card"><p style="text-align: center; color: #999;">ขณะนี้ยังไม่มีประกาศใหม่</p></div>';
            return;
        }

        response.data.forEach(item => {
            const dateStr = new Date(item.created_at).toLocaleString('th-TH', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            container.innerHTML += `
                <div class="card" style="border-left: 5px solid #e67e22; margin-bottom: 15px; animation: fadeIn 0.5s ease;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h3 style="color: #d35400; margin-top: 0;">${item.title}</h3>
                        <span class="badge" style="background: #fff3e0; color: #e67e22; border: 1px solid #e67e22;">
                            <i class="far fa-calendar-alt"></i> ${dateStr}
                        </span>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
                    <p style="line-height: 1.6; color: #444; white-space: pre-line;">${item.content}</p>
                </div>
            `;
        });
    } catch (error) {
        container.innerHTML = '<div class="card"><p style="color: red;">❌ ไม่สามารถโหลดประกาศได้ในขณะนี้</p></div>';
    }
}

async function loadUserProfile() {
    try {
        const res = await axios.get(`http://localhost:1304/api/employee/profile/${empId}`);
        const user = res.data;

        document.getElementById('profile-emp-id').innerText = user.emp_id;
        document.getElementById('profile-full-name').innerText = `${user.first_name} ${user.last_name}`;
        document.getElementById('profile-dept').innerText = user.dept_name || 'ไม่ได้ระบุแผนก';
        document.getElementById('profile-role').innerText = (user.role === 'admin') ? 'HR / ผู้ดูแลระบบ' : 'พนักงานทั่วไป';

        document.getElementById('profile-hourly-rate').innerText = `฿${user.hourly_rate || 0} / ชั่วโมง`;
        document.getElementById('profile-sick').innerText = user.sick_leave_remaining ?? 0;
        document.getElementById('profile-personal').innerText = user.personal_leave_remaining ?? 0;
        document.getElementById('profile-annual').innerText = user.annual_leave_remaining ?? 0;

    } catch (err) {
        console.error("Profile Load Error", err);
    }
}