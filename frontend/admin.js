// ดึงใบลาที่รออนุมัติมาโชว์ในตาราง
// ฟังก์ชันโหลดใบลาที่รออนุมัติ
async function loadPendingLeaves() {
    try {
        const response = await axios.get('http://localhost:1304/api/admin/leaves/pending');
        const leaves = response.data;
        const tbody = document.getElementById('admin-leave-table-body');
        tbody.innerHTML = '';

        if (leaves.length === 0) {
            // 🌟 แก้ colspan เป็น 7 ตรงนี้ด้วยครับ
            tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; color: green;">🎉 ไม่มีรายการรอดำเนินการ</td></tr>';
            return;
        }

        leaves.forEach(leave => {
            const start = new Date(leave.start_date);
            const end = new Date(leave.end_date);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            let attachmentLink = '-';
            if (leave.attachment) {
                attachmentLink = `<a href="http://localhost:1304/uploads/${leave.attachment}" target="_blank" style="color: blue; text-decoration: underline;">ดูเอกสาร</a>`;
            }

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #dee2e6';

            // 🌟 เพิ่ม <td> อันใหม่สำหรับใส่เหตุผลการลา เข้าไปตรงนี้ครับ
            // (ใส่ max-width ไว้หน่อย เผื่อพนักงานพิมพ์เหตุผลมายาวมาก ตารางจะได้ไม่เละครับ)
            tr.innerHTML = `
                <td style="padding: 12px;">${leave.emp_id}</td>
                <td style="padding: 12px;">${leave.first_name || ''} ${leave.last_name || ''}</td>
                <td style="padding: 12px;">${leave.leave_type} <br><small>(${diffDays} วัน)</small></td>
                
                <td style="padding: 12px; max-width: 200px; word-wrap: break-word;">${leave.reason || '-'}</td>
                
                <td style="padding: 12px;">${start.toLocaleDateString('th-TH')} - ${end.toLocaleDateString('th-TH')}</td>
                <td style="padding: 12px;">${attachmentLink}</td>
                <td style="padding: 12px;">
                    <button onclick="handleLeaveAction(${leave.leave_id}, '${leave.emp_id}', '${leave.leave_type}', 'approved', ${diffDays})" style="background-color: #28a745; color: white; padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;"><i class="fas fa-check"></i> อนุมัติ</button>
                    <button onclick="handleLeaveAction(${leave.leave_id}, '${leave.emp_id}', '${leave.leave_type}', 'rejected', ${diffDays})" style="background-color: #dc3545; color: white; padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer;"><i class="fas fa-times"></i> ปฏิเสธ</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error fetching pending leaves:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; color: red;">ไม่สามารถโหลดข้อมูลได้</td></tr>';
    }
}

// ฟังก์ชันสำหรับกดปุ่ม อนุมัติ / ปฏิเสธ
async function handleLeaveAction(leaveId, empId, leaveType, status, daysRequested) {
    const actionText = status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ';
    if (!confirm(`ยืนยันการ "${actionText}" ใบลาของ ${empId} หรือไม่?`)) return;

    try {
        const response = await axios.put('http://localhost:1304/api/admin/leaves/update-status', {
            leave_id: leaveId,
            emp_id: empId,
            leave_type: leaveType,
            status: status,
            days_requested: daysRequested
        });

        alert(`✅ ${response.data.message}`);
        loadPendingLeaves(); // รีเฟรชตารางให้รายการนั้นหายไป
    } catch (error) {
        console.error('Error updating status:', error);
        alert('❌ เกิดข้อผิดพลาด ไม่สามารถอัปเดตสถานะได้');
    }
}

// ฟังก์ชันดึงพนักงานและวาดลง 2 ตารางพร้อมกัน
async function fetchAllEmployees() {
    const empTbody = document.getElementById('employee-list-body'); // ตารางจัดการพนักงาน
    const quotaTbody = document.getElementById('quota-list-body'); // ตารางโควตา

    // โชว์ข้อความกำลังโหลด
    if (empTbody) empTbody.innerHTML = '<tr><td colspan="4" style="padding: 20px;">กำลังโหลดข้อมูล...</td></tr>';
    if (quotaTbody) quotaTbody.innerHTML = '<tr><td colspan="5" style="padding: 20px;">กำลังโหลดข้อมูล...</td></tr>';

    try {
        const res = await axios.get('http://localhost:1304/api/admin/employees/all');

        // ล้างข้อมูลก่อนวาดใหม่
        if (empTbody) empTbody.innerHTML = '';
        if (quotaTbody) quotaTbody.innerHTML = '';

        if (!res.data || res.data.length === 0) {
            if (empTbody) empTbody.innerHTML = '<tr><td colspan="4" style="padding: 20px; color: #888;">ยังไม่มีข้อมูลพนักงานในระบบ</td></tr>';
            if (quotaTbody) quotaTbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; color: #888;">ยังไม่มีข้อมูลโควตาวันลา</td></tr>';
            return;
        }

        res.data.forEach(emp => {
            const sick = emp.sick_leave_remaining ?? 0;
            const personal = emp.personal_leave_remaining ?? 0;
            const annual = emp.annual_leave_remaining ?? 0;

            // ทำให้สิทธิ์การใช้งานดูง่ายขึ้น (ใส่สีให้หน่อย)
            const roleBadge = emp.role === 'admin'
                ? '<span style="background-color: #ffeaa7; color: #d35400; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.9em;">HR / Admin</span>'
                : '<span style="background-color: #81ecec; color: #008080; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">พนักงานทั่วไป</span>';

            // 1. วาดลงตาราง "รายชื่อพนักงาน" (ลบได้, ไม่มีโควตา)
            if (empTbody) {
                empTbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px;">${emp.emp_id}</td>
                        <td>${emp.first_name || '-'} ${emp.last_name || '-'}</td>
                        <td>${roleBadge}</td>
                        <td>
                            <button onclick="deleteEmployee('${emp.emp_id}')" style="background-color: #ff4757; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-trash"></i> ลบ
                            </button>
                        </td>
                    </tr>
                `;
            }

            // 2. วาดลงตาราง "โควตาวันลาคงเหลือ" (ลบไม่ได้, เอาไว้ดูอย่างเดียวตอนอนุมัติลา)
            if (quotaTbody) {
                quotaTbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px;">${emp.emp_id}</td>
                        <td>${emp.first_name || '-'} ${emp.last_name || '-'}</td>
                        <td><b style="color:#e74c3c">${sick}</b> / 30</td>
                        <td><b style="color:#f39c12">${personal}</b> / 6</td>
                        <td><b style="color:#2ecc71">${annual}</b> / 6</td>
                    </tr>
                `;
            }
        });
    } catch (err) {
        console.error("Fetch Error:", err);
        if (empTbody) empTbody.innerHTML = `<tr><td colspan="4" style="padding: 20px; color: red;">❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้</td></tr>`;
        if (quotaTbody) quotaTbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; color: red;">❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้</td></tr>`;
    }
}
// ฟังก์ชันบันทึกพนักงานใหม่
document.getElementById('add-employee-form').addEventListener('submit', async (e) => {
    e.preventDefault(); // ป้องกันเว็บรีเฟรช

    // 1. ดึงข้อมูลจากฟอร์ม
    const empData = {
        emp_id: document.getElementById('new-emp-id').value,
        first_name: document.getElementById('new-first-name').value,
        last_name: document.getElementById('new-last-name').value,
        password: document.getElementById('new-password').value,
        role: document.getElementById('new-role').value
    };

    console.log("กำลังส่งข้อมูล:", empData); // เช็คว่าดึงข้อมูลมาครบไหม

    try {
        // 2. ส่งข้อมูลไปที่ Backend
        const response = await axios.post('http://localhost:1304/api/admin/employees/add', empData);

        // ถ้าสำเร็จ
        alert(`✅ ${response.data.message}`);
        document.getElementById('add-employee-form').reset(); // ล้างช่องกรอกข้อมูล
        fetchAllEmployees(); // โหลดตารางใหม่

    } catch (error) {
        console.error("Error Detail:", error);
        // แจ้งเตือนสาเหตุที่ Error
        const errorMsg = error.response?.data?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
        alert(`❌ ผิดพลาด: ${errorMsg}`);
    }
});

// ฟังก์ชันลบพนักงาน (ที่เรียกใช้จากปุ่มในตาราง)
async function deleteEmployee(empId) {
    if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบพนักงานรหัส ${empId}?`)) return;

    try {
        const response = await axios.delete(`http://localhost:1304/api/admin/employees/${empId}`);
        alert(`🗑️ ${response.data.message}`);
        fetchAllEmployees(); // โหลดตารางใหม่
    } catch (error) {
        alert('❌ ลบไม่สำเร็จ');
    }
}

// ฟังก์ชันสำหรับสลับหน้าจอทางขวา
function switchPage(event, pageId, clickedLink) {
    event.preventDefault();

    // 1. ซ่อนทุกหน้าก่อน
    const allPages = document.querySelectorAll('.page-section');
    allPages.forEach(page => page.style.display = 'none');

    // 2. แสดงเฉพาะหน้าที่เลือก
    document.getElementById(pageId).style.display = 'block';

    // 3. เปลี่ยนสีเมนูที่ถูกคลิก
    const allLinks = document.querySelectorAll('.sidebar-menu a');
    allLinks.forEach(link => link.classList.remove('active'));
    clickedLink.classList.add('active');

    // 4. โหลดข้อมูลใหม่ทันทีตามหน้าที่เปิด 🌟 (แก้ตรงนี้)
    if (pageId === 'page-manage-employees') {
        fetchAllEmployees();
    } else if (pageId === 'page-report') {
        loadSalaryReport(); // โหลดข้อมูลเงินเดือนใหม่ทุกครั้งที่กดเปิดหน้านี้
    } else if (pageId === 'page-approve-leave') {
        loadPendingLeaves(); // โหลดใบลาใหม่ด้วย เผื่อมีคนเพิ่งส่งมา
    }
}

// ==========================================
// 📊 ฟังก์ชันโหลดข้อมูลรายงานสรุปเงินเดือน (พร้อมระบบเลือกเดือน)
// ==========================================
async function loadSalaryReport() {
    try {
        // 1. ดึงค่าจากช่องเลือกเดือน (ถ้ามีการเลือกไว้)
        const monthInput = document.getElementById('report-month').value;
        let apiUrl = 'http://localhost:1304/api/admin/salary-report';

        // ถ้า HR เลือกเดือน ให้เติม ?year=...&month=... ต่อท้าย URL
        if (monthInput) {
            const [year, month] = monthInput.split('-');
            apiUrl += `?year=${year}&month=${month}`;
        }

        // 2. ยิง API ไปดึงข้อมูลจาก Backend
        const response = await axios.get(apiUrl);
        const records = response.data;
        const tbody = document.getElementById('salary-report-body');

        // ล้างข้อมูลเก่าในตารางก่อน
        tbody.innerHTML = '';

        // 3. ตรวจสอบว่ามีข้อมูลไหม
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; color: red;">ไม่พบข้อมูลการทำงานในเดือนที่เลือก</td></tr>';
            return;
        }

        // 4. วนลูปสร้างแถวในตาราง
        records.forEach(emp => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #eee';

            // แปลงตัวเลขยอดเงินให้มีคอมม่า (เช่น 1,500.00 ฿)
            const totalPayFormatted = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(emp.totalPay);

            tr.innerHTML = `
                <td style="padding: 12px;">${emp.emp_id}</td>
                <td style="padding: 12px; text-align: left;">${emp.first_name} ${emp.last_name}</td>
                <td style="padding: 12px; color: #17a2b8; font-weight: bold;">${emp.total_work_hours || 0} ชม.</td>
                <td style="padding: 12px; color: #fd7e14; font-weight: bold;">${emp.total_ot_hours || 0} ชม.</td>
                <td style="padding: 12px; color: #28a745; font-weight: bold;">${totalPayFormatted}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error loading salary report:', error);
        document.getElementById('salary-report-body').innerHTML =
            '<tr><td colspan="5" style="padding: 20px; color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
    }
}

// ==========================================
// 📥 ฟังก์ชันดาวน์โหลด Excel (CSV)
// ==========================================
function exportSalaryCSV() {
    const table = document.getElementById("salary-table");
    let csv = [];

    // ดึงค่าเดือนที่เลือกมาตั้งเป็นชื่อไฟล์ (ถ้าไม่ได้เลือก ให้ใช้คำว่า Current)
    const monthInput = document.getElementById('report-month').value || 'Current';

    for (let i = 0; i < table.rows.length; i++) {
        let row = [], cols = table.rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) {
            // ลบเครื่องหมายลูกน้ำออกก่อน เพื่อไม่ให้ไฟล์ CSV รวน
            let data = cols[j].innerText.replace(/,/g, '');
            // ลบสัญลักษณ์ ฿ ออกด้วย
            data = data.replace(/฿/g, '').trim();
            row.push(data);
        }
        csv.push(row.join(","));
    }

    // สร้างไฟล์และสั่งดาวน์โหลด
    const csvFile = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const downloadLink = document.createElement("a");
    downloadLink.download = `Salary_Report_${monthInput}.csv`;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// เรียกให้โหลดข้อมูลเงินเดือนตอนเปิดหน้า Admin
loadSalaryReport();

// เรียกทำงานทันทีเมื่อโหลดหน้า
fetchAllEmployees();

// โหลดข้อมูลทันทีเมื่อเปิดหน้า Admin
loadPendingLeaves();