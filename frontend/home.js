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
    event.preventDefault();
    const allPages = document.querySelectorAll('.page-section');
    allPages.forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById(pageId).style.display = 'block';

    const allLinks = document.querySelectorAll('.sidebar-menu a');
    allLinks.forEach(link => {
        link.classList.remove('active');
    });
    clickedLink.classList.add('active');
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

// 5. ผูกปุ่มเลิกงานด้วย Event Listener
document.getElementById('btn-clock-out').addEventListener('click', async function (event) {
    event.preventDefault();

    const empId = localStorage.getItem('employeeId');
    if (!empId) return alert('ไม่พบรหัสพนักงาน กรุณาล็อกอินใหม่');

    const isSure = confirm("คุณแน่ใจหรือไม่ว่าต้องการบันทึกเวลา 'เลิกงาน' ?");
    if (!isSure) return;

    const statusEl = document.getElementById('attendance-status');
    statusEl.innerText = 'สถานะ: ⏳ กำลังบันทึกข้อมูล...';
    statusEl.style.color = '#007bff';

    try {
        const response = await axios.post('http://localhost:1304/api/attendance/clock-out', { emp_id: empId });
        
        const msg = response.data.message || "บันทึกเวลาเลิกงานสำเร็จ!";
        statusEl.innerText = 'สถานะ: 🔴 ' + msg;
        statusEl.style.color = 'red';
        alert(msg);

        localStorage.removeItem('lastClockInDate');
        loadAttendanceHistory();

    } catch (error) {
        const errorMsg = error.response?.data?.message || error.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
        statusEl.innerText = 'สถานะ: ❌ ' + errorMsg; // อัปเดต UI แจ้งเตือนข้อผิดพลาด
        statusEl.style.color = 'red';
        alert('❌ ' + errorMsg);
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

// เรียกใช้ฟังก์ชันนี้ทันทีตอนเปิดหน้าเว็บ
loadLeaveHistory();

// 🌟 เรียกโหลดประวัติตั้งแต่ตอนเปิดหน้าเว็บครั้งแรก
loadAttendanceHistory();