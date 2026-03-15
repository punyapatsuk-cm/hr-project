// ==========================================
// ⚙️ 1. ตั้งค่าเริ่มต้น & ตรวจสอบการล็อกอิน
// ==========================================
const name = localStorage.getItem('employeeName');
const empId = localStorage.getItem('employeeId');

// ถ้าไม่มีข้อมูลใน LocalStorage ให้เด้งกลับไปหน้า Login
if (!name || !empId) {
    alert('กรุณาเข้าสู่ระบบก่อน');
    window.location.href = 'login.html';
} else {
    // แสดงชื่อผู้ใช้บน UI
    document.getElementById('welcome-msg').innerText = "ยินดีต้อนรับเข้าสู่ระบบ คุณ " + name;
    document.getElementById('sidebar-name').innerText = "คุณ " + name;
    document.getElementById('topbar-name').innerText = name;

    // โหลดข้อมูลเริ่มต้น
    updateClock();
    setInterval(updateClock, 1000); // ให้นาฬิกาเดินทุก 1 วินาที

    // โหลดข้อมูลหน้า Dashboard ทันทีที่เข้าเว็บ
    loadEmployeeDashboard(); 
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
    if (pageId === 'page-dashboard') loadEmployeeDashboard();
    if (pageId === 'page-news') loadAnnouncements();
    if (pageId === 'page-profile') loadUserProfile();
    if (pageId === 'page-schedule') loadAttendanceHistory(); 
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

// อัปเดต timeline สถานะปัจจุบัน
function updateTimelineStatus(state) {
    const timelineText = document.getElementById('timeline-status-text');
    const statusEl     = document.getElementById('attendance-status');
    if (!timelineText) return;

    const now = new Date().toLocaleTimeString('th-TH', { hour12: false });

    if (state === 'in') {
        timelineText.innerHTML = `<span style="color:#00a86b; font-weight:bold;">✅ กำลังทำงานอยู่</span><br>
            <span style="font-size:0.85em; color:#7f8c8d;">เข้างานเมื่อ ${now}</span>`;
        if (statusEl) { statusEl.innerText = 'สถานะ: ✅ บันทึกเข้างานสำเร็จ'; statusEl.style.color = 'green'; }
    } else if (state === 'out') {
        timelineText.innerHTML = `<span style="color:#e74c3c; font-weight:bold;">🏃 เลิกงานแล้ว</span><br>
            <span style="font-size:0.85em; color:#7f8c8d;">ออกงานเมื่อ ${now}</span>`;
        if (statusEl) { statusEl.innerText = 'สถานะ: ✅ บันทึกเลิกงานสำเร็จ'; statusEl.style.color = '#e74c3c'; }
    } else {
        timelineText.innerText = 'รอการบันทึกเวลา...';
        if (statusEl) { statusEl.innerText = 'รอการบันทึกเวลา'; statusEl.style.color = '#e67e22'; }
    }
}

document.getElementById('btn-clock-in')?.addEventListener('click', async function (event) {
    event.preventDefault();
    const statusEl = document.getElementById('attendance-status');
    statusEl.innerText = 'สถานะ: ⏳ กำลังบันทึกข้อมูล...';
    statusEl.style.color = '#007bff';

    try {
        const response = await axios.post('http://localhost:1304/api/attendance/clock-in', { emp_id: empId });
        updateTimelineStatus('in');
        alert('✅ ' + response.data.message);
        loadAttendanceHistory();
    } catch (error) {
        const errorMsg = error.response?.data?.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
        statusEl.innerText = 'สถานะ: ❌ ' + errorMsg;
        statusEl.style.color = 'red';
        alert('❌ ' + errorMsg);
    }
});

document.getElementById('btn-clock-out')?.addEventListener('click', async function (event) {
    event.preventDefault();
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการบันทึกเวลา 'เลิกงาน' ?")) return;

    try {
        const response = await axios.post('http://localhost:1304/api/attendance/clock-out', { emp_id: empId });
        updateTimelineStatus('out');
        alert('✅ ' + response.data.message);
        loadAttendanceHistory();
    } catch (error) {
        alert('❌ ' + (error.response?.data?.message || "ผิดพลาด"));
    }
});

async function loadAttendanceHistory() {
    try {
        const response = await axios.get(`http://localhost:1304/api/attendance/history/${empId}`);
        const tbody = document.getElementById('history-table-body');
        if(!tbody) return;
        tbody.innerHTML = '';

        if (response.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px;">ยังไม่มีประวัติการลงเวลา</td></tr>';
            updateTodaySummary(0, 0);
            return;
        }

        // คำนวณชั่วโมงรวมของวันนี้
        const todayStr = new Date().toLocaleDateString('th-TH');
        let todayWork = 0, todayOT = 0;

        response.data.forEach(record => {
            const dateStr  = record.work_date      ? new Date(record.work_date).toLocaleDateString('th-TH') : '-';
            const inTime   = record.check_in_time  ? new Date(record.check_in_time).toLocaleTimeString('th-TH', { hour12: false }) : '-';
            const outTime  = record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('th-TH', { hour12: false }) : 'ยังไม่เลิกงาน';
            const workHrs  = record.work_hours != null ? `${record.work_hours} ชม.` : '-';
            const otHrs    = record.ot_hours != null && record.ot_hours > 0 ? `${record.ot_hours} ชม.` : '-';

            if (dateStr === todayStr) {
                todayWork += parseFloat(record.work_hours) || 0;
                todayOT   += parseFloat(record.ot_hours)   || 0;
            }

            tbody.innerHTML += `
                <tr>
                    <td style="text-align:center; font-weight:600;">${dateStr}</td>
                    <td style="text-align:center; color:var(--green); font-weight:600;">${inTime}</td>
                    <td style="text-align:center; color:${record.check_out_time ? '#e74c3c' : '#e67e22'}; font-weight:600;">${outTime}</td>
                    <td style="text-align:center; color:#3498db; font-weight:600;">${workHrs}</td>
                    <td style="text-align:center; color:#e67e22; font-weight:600;">${otHrs}</td>
                </tr>
            `;
        });

        updateTodaySummary(todayWork, todayOT);
    } catch (error) {
        const tbody = document.getElementById('history-table-body');
        if(tbody) tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; color: red;">ไม่สามารถโหลดประวัติได้</td></tr>';
    }
}

function updateTodaySummary(workHours, otHours) {
    const summaryEl = document.getElementById('today-work-summary');
    if (!summaryEl) return;

    const totalHours = workHours + otHours;
    const percent    = Math.min((workHours / 8) * 100, 100).toFixed(0);
    const barColor   = workHours >= 8 ? '#27ae60' : workHours >= 4 ? '#f39c12' : '#e74c3c';

    summaryEl.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; padding:16px 18px 0;">
            <div style="background:var(--green-light); border-radius:var(--radius-sm); padding:14px 16px; text-align:center; border:1px solid #a9dfbf;">
                <div style="font-size:0.72rem; font-weight:700; color:var(--green-dark); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">ชม. ทำงานปกติ</div>
                <div style="font-size:1.6rem; font-weight:800; color:var(--green);">${workHours.toFixed(2)}</div>
                <div style="font-size:0.72rem; color:var(--text-light); margin-top:2px;">ชั่วโมง</div>
            </div>
            <div style="background:#fef9e7; border-radius:var(--radius-sm); padding:14px 16px; text-align:center; border:1px solid #f9e79f;">
                <div style="font-size:0.72rem; font-weight:700; color:#a04000; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">ชม. OT</div>
                <div style="font-size:1.6rem; font-weight:800; color:#e67e22;">${otHours.toFixed(2)}</div>
                <div style="font-size:0.72rem; color:var(--text-light); margin-top:2px;">ชั่วโมง</div>
            </div>
            <div style="background:#eaf4fb; border-radius:var(--radius-sm); padding:14px 16px; text-align:center; border:1px solid #aed6f1;">
                <div style="font-size:0.72rem; font-weight:700; color:#1a5276; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">รวมทั้งหมด</div>
                <div style="font-size:1.6rem; font-weight:800; color:#2980b9;">${totalHours.toFixed(2)}</div>
                <div style="font-size:0.72rem; color:var(--text-light); margin-top:2px;">ชั่วโมง</div>
            </div>
        </div>
        <div style="padding:12px 18px 0;">
            <div style="font-size:0.75rem; color:var(--text-mid); font-weight:600; margin-bottom:6px;">ความคืบหน้าวันนี้ (เป้าหมาย 8 ชม.)</div>
            <div style="background:#eef0f3; border-radius:10px; height:8px; overflow:hidden;">
                <div style="width:${percent}%; background:${barColor}; height:100%; border-radius:10px; transition:width 0.6s ease;"></div>
            </div>
            <div style="text-align:right; font-size:0.75rem; font-weight:700; color:${barColor}; margin-top:4px;">${percent}%</div>
        </div>
    `;
}

// ==========================================
// 🏖️ 4. ระบบลางาน (Leave Management)
// ==========================================
document.getElementById('leave-form')?.addEventListener('submit', async function (event) {
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
        loadLeaveHistory(); 
    } catch (error) {
        alert('❌ ' + (error.response?.data?.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"));
    }
});

let allLeaveRecords = []; 
let currentLeavePage = 1; 
const leaveItemsPerPage = 5; 

async function loadLeaveHistory() {
    if (!empId) return;
    try {
        const response = await axios.get(`http://localhost:1304/api/leave/history/${empId}`);
        allLeaveRecords = response.data; 
        currentLeavePage = 1; 
        renderLeaveTable(); 
    } catch (error) {
        const tbody = document.getElementById('leave-history-body');
        if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="padding: 20px; color: red; text-align: center;">ไม่สามารถโหลดประวัติได้</td></tr>';
    }
}

function renderLeaveTable() {
    const tbody = document.getElementById('leave-history-body');
    if(!tbody) return;
    const searchInput = document.getElementById('search-leave');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    tbody.innerHTML = ''; 

    let filteredRecords = allLeaveRecords.filter(record => {
        const typeName = record.leave_type === 'Sick Leave' ? 'ลาป่วย' : record.leave_type === 'Personal Leave' ? 'ลากิจ' : 'ลาพักร้อน';
        const statusName = record.status === 'pending' ? 'รออนุมัติ' : record.status === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ';
        return typeName.includes(searchTerm) || statusName.includes(searchTerm);
    });

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center;">ไม่พบข้อมูล</td></tr>';
        renderPagination(0); 
        return;
    }

    const totalPages = Math.ceil(filteredRecords.length / leaveItemsPerPage);
    if (currentLeavePage > totalPages) currentLeavePage = totalPages; 

    const startIndex = (currentLeavePage - 1) * leaveItemsPerPage;
    const endIndex = startIndex + leaveItemsPerPage;
    const recordsToShow = filteredRecords.slice(startIndex, endIndex); 

    recordsToShow.forEach(record => {
        const startStr = record.start_date ? new Date(record.start_date).toLocaleDateString('th-TH') : '-';
        const endStr = record.end_date ? new Date(record.end_date).toLocaleDateString('th-TH') : '-';
        let typeName = record.leave_type === 'Sick Leave' ? 'ลาป่วย' : record.leave_type === 'Personal Leave' ? 'ลากิจ' : 'ลาพักร้อน';

        let statusBadge = '';
        if (record.status === 'pending') statusBadge = '<span class="badge badge-pending">รอพิจารณา</span>';
        else if (record.status === 'approved') statusBadge = '<span class="badge badge-approved">อนุมัติแล้ว</span>';
        else statusBadge = '<span class="badge badge-rejected">ไม่อนุมัติ</span>';

        tbody.innerHTML += `
            <tr>
                <td style="text-align:center; font-weight:600;">${typeName}</td>
                <td style="text-align:center; color:var(--text-mid);">${startStr}</td>
                <td style="text-align:center; color:var(--text-mid);">${endStr}</td>
                <td style="text-align:center;">${statusBadge}</td>
            </tr>
        `;
    });
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const paginationDiv = document.getElementById('leave-pagination');
    if (!paginationDiv) return;
    paginationDiv.innerHTML = '';
    if (totalPages <= 1) return; 

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

        btn.addEventListener('click', () => {
            currentLeavePage = i;
            renderLeaveTable();
        });
        paginationDiv.appendChild(btn);
    }
}

const leaveSearchInput = document.getElementById('search-leave');
if (leaveSearchInput) {
    leaveSearchInput.addEventListener('input', () => {
        currentLeavePage = 1; 
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
                <div class="announce-item">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px;">
                        <div class="announce-item-title">${item.title}</div>
                        <span style="background:#fff3cd; color:#9c6000; font-size:0.7rem; font-weight:600; padding:3px 10px; border-radius:20px; white-space:nowrap; flex-shrink:0;">
                            <i class="far fa-calendar-alt"></i> ${dateStr}
                        </span>
                    </div>
                    <div class="announce-item-body" style="white-space:pre-line;">${item.content}</div>
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

// ==========================================
// 📊 6. โหลดข้อมูลหน้า Dashboard พนักงาน
// ==========================================
async function loadEmployeeDashboard() {
    if (!empId) return;

    try {
        // 1. ดึงโควตาวันลา
        const resProfile = await axios.get(`http://localhost:1304/api/employee/profile/${empId}`);
        if (resProfile.data) {
            const emp = resProfile.data;
            const sickRemain = emp.sick_leave_remaining ?? 30;
            const personalRemain = emp.personal_leave_remaining ?? 6;
            const annualRemain = emp.annual_leave_remaining ?? 6;

            const sickUsed = 30 - sickRemain;
            const personalUsed = 6 - personalRemain;
            const annualUsed = 6 - annualRemain;

            document.getElementById('dash-sick-used').innerText = sickUsed;
            document.getElementById('dash-sick-remain').innerText = sickRemain;
            document.getElementById('dash-sick-progress').style.width = `${(sickUsed / 30) * 100}%`;

            document.getElementById('dash-personal-used').innerText = personalUsed;
            document.getElementById('dash-personal-remain').innerText = personalRemain;
            document.getElementById('dash-personal-progress').style.width = `${(personalUsed / 6) * 100}%`;

            document.getElementById('dash-annual-used').innerText = annualUsed;
            document.getElementById('dash-annual-remain').innerText = annualRemain;
            document.getElementById('dash-annual-progress').style.width = `${(annualUsed / 6) * 100}%`;
        }

        // 2. ดึงประวัติการลา 3 อันดับล่าสุด
        const resHistory = await axios.get(`http://localhost:1304/api/leave/history/${empId}`);
        const tbody = document.getElementById('dash-recent-leave-body');
        const myLeaves = resHistory.data;

        if (!tbody) return;

        if (myLeaves.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; color: #999;">ยังไม่มีประวัติการลางาน</td></tr>';
        } else {
            const recentLeaves = myLeaves.slice(0, 3);
            tbody.innerHTML = recentLeaves.map(leave => {
                let typeName = leave.leave_type === 'Sick Leave' ? 'ลาป่วย' : leave.leave_type === 'Personal Leave' ? 'ลากิจ' : 'ลาพักร้อน';
                const startDate = new Date(leave.start_date).toLocaleDateString('th-TH');
                const endDate = new Date(leave.end_date).toLocaleDateString('th-TH');
                const dateShow = startDate === endDate ? startDate : `${startDate} – ${endDate}`;

                let statusBadge = leave.status === 'approved'
                    ? '<span class="badge badge-approved">อนุมัติแล้ว</span>'
                    : leave.status === 'rejected'
                    ? '<span class="badge badge-rejected">ไม่อนุมัติ</span>'
                    : '<span class="badge badge-pending">รอพิจารณา</span>';

                return `
                    <tr>
                        <td style="font-weight:700; color:var(--text-dark);">${typeName}</td>
                        <td style="text-align:center; color:var(--text-mid); font-size:0.84rem;">${dateShow}</td>
                        <td style="text-align:center;">${statusBadge}</td>
                    </tr>
                `;
            }).join('');
        }

        // 3. ดึงข้อมูลสลิปเงินเดือนล่าสุด (โชว์แบบเข้ารหัส)
        const resSalary = await axios.get(`http://localhost:1304/api/admin/salary-report`);
        const mySalary = resSalary.data.find(emp => emp.emp_id === empId);
        
        const payslipDiv = document.getElementById('dash-payslip-info');
        const btnPayslip = document.getElementById('btn-view-payslip');

        if (!payslipDiv || !btnPayslip) return;

        if (!mySalary) {
            payslipDiv.innerHTML = `
                <i class="fas fa-box-open" style="font-size: 3em; color: #ecf0f1; margin-bottom: 10px;"></i>
                <p style="margin: 0; color: #7f8c8d;">ยังไม่มีสลิปเงินเดือนในระบบ</p>
            `;
        } else {
            const today = new Date();
            const monthName = today.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
            const netPay = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(mySalary.totalPay || 0);

            payslipDiv.innerHTML = `
                <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; display: inline-block; width: 100%; box-sizing: border-box; border: 1px dashed #ccc;">
                    <p style="margin: 0 0 5px 0; color: #7f8c8d; font-size: 0.9em;">รอบการจ่ายเงิน</p>
                    <h4 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 1.2em;">${monthName}</h4>
                    <p style="margin: 0; color: #7f8c8d; font-size: 0.85em;">ยอดรับสุทธิ</p>
                    <h2 id="secret-salary" style="margin: 5px 0 0 0; color: #27ae60; letter-spacing: 2px;">฿ ** *** **</h2>
                </div>
            `;
            
            btnPayslip.disabled = false;
            btnPayslip.style.background = '#27ae60';
            btnPayslip.style.color = 'white';
            btnPayslip.style.cursor = 'pointer';
            btnPayslip.innerHTML = '<i class="fas fa-lock-open"></i> กดเพื่อปลดล็อคดูยอดเงิน';
            
            let isUnlocked = false;
            btnPayslip.onclick = () => {
                const secretText = document.getElementById('secret-salary');
                if (!isUnlocked) {
                    secretText.innerText = netPay; 
                    secretText.style.letterSpacing = "0px";
                    btnPayslip.innerHTML = '<i class="fas fa-eye-slash"></i> ซ่อนยอดเงิน';
                    btnPayslip.style.background = '#e74c3c'; 
                    isUnlocked = true;
                } else {
                    secretText.innerText = "฿ ** *** **"; 
                    secretText.style.letterSpacing = "2px";
                    btnPayslip.innerHTML = '<i class="fas fa-lock-open"></i> กดเพื่อปลดล็อคดูยอดเงิน';
                    btnPayslip.style.background = '#27ae60'; 
                    isUnlocked = false;
                }
            };
        }
    } catch (error) {
        console.error('โหลดข้อมูล Dashboard พนักงานพลาด:', error);
    }
}
// ฟังก์ชันสำหรับ Leave Form ใหม่
function selectLeavePill(el, val) {
    document.querySelectorAll('.lf-pill').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('leave-type').value = val;
}

function handleLeaveFile(input) {
    const textEl = document.getElementById('lf-file-text');
    if (input.files && input.files[0]) {
        textEl.textContent = '📎 ' + input.files[0].name;
        textEl.style.color = '#185FA5';
        textEl.style.fontWeight = 'bold';
    }
}