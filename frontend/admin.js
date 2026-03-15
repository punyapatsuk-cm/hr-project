const API_URL = 'http://localhost:1304/api/admin';

// ==========================================
// 🏢 1. โหลดข้อมูลแผนก (Departments)
// ==========================================
async function loadDepartments() {
    try {
        const res = await axios.get(`${API_URL}/departments`);
        const newDept = document.getElementById('new-dept');
        const editDept = document.getElementById('edit-dept');

        let options = '<option value="">-- เลือกแผนก --</option>';
        res.data.forEach(d => {
            options += `<option value="${d.id}">${d.name}</option>`;
        });

        if (newDept) newDept.innerHTML = options;
        if (editDept) editDept.innerHTML = options;
    } catch (err) {
        console.error("ไม่สามารถโหลดแผนกได้", err);
    }
}

// ==========================================
// 📝 2. ระบบจัดการใบลางาน
// ==========================================
async function loadPendingLeaves() {
    try {
        const response = await axios.get(`${API_URL}/leaves/pending`);
        const tbody = document.getElementById('admin-leave-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (response.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; color: green;">🎉 ไม่มีรายการรอดำเนินการ</td></tr>';
            return;
        }

        response.data.forEach(leave => {
            const start = new Date(leave.start_date);
            const end = new Date(leave.end_date);
            const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
            const attachment = leave.attachment ? `<a href="http://localhost:1304/uploads/${leave.attachment}" target="_blank">ดูเอกสาร</a>` : '-';

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px;">${leave.emp_id}</td>
                    <td>${leave.first_name} ${leave.last_name}</td>
                    <td>${leave.leave_type} <br><small>(${diffDays} วัน)</small></td>
                    <td style="max-width: 200px; word-wrap: break-word;">${leave.reason || '-'}</td>
                    <td>${start.toLocaleDateString('th-TH')} - ${end.toLocaleDateString('th-TH')}</td>
                    <td>${attachment}</td>
                    <td>
                        <button onclick="handleLeaveAction(${leave.leave_id}, '${leave.emp_id}', '${leave.leave_type}', 'approved', ${diffDays})" style="background:#28a745; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; margin-right: 5px;">อนุมัติ</button>
                        <button onclick="handleLeaveAction(${leave.leave_id}, '${leave.emp_id}', '${leave.leave_type}', 'rejected', ${diffDays})" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">ปฏิเสธ</button>
                    </td>
                </tr>`;
        });
    } catch (err) { console.error(err); }
}

// ==========================================
// 📊 โหลดตัวเลขสถิติ Dashboard 4 กล่อง
// ==========================================
async function loadDashboardStats() {
    try {
        const res = await axios.get(`${API_URL}/dashboard-stats`);
        const stats = res.data;

        // เอาตัวเลขไปยัดใส่กล่องต่างๆ
        document.getElementById('widget-total').innerText = stats.total;
        document.getElementById('widget-pending').innerText = stats.pending;
        document.getElementById('widget-approved').innerText = stats.approved;
        document.getElementById('widget-rejected').innerText = stats.rejected;
    } catch (err) {
        console.error("โหลดสถิติไม่สำเร็จ", err);
    }
}



// 🌟 สำคัญ: สั่งให้โหลดตอนเปิดหน้าเว็บ
document.addEventListener('DOMContentLoaded', loadDashboardStats);

// 1. ฟังก์ชันดึงตัวเลขจริงจากหลังบ้านมาอัปเดต Widget
async function updateDashboardStats() {
    try {
        // ใช้ API_URL ที่เราตั้งไว้ตอนต้นไฟล์ (บรรทัดแรกสุด)
        const res = await axios.get(`${API_URL}/dashboard-stats`);
        const stats = res.data;

        document.getElementById('widget-total').innerText = stats.total || 0;
        document.getElementById('widget-pending').innerText = stats.pending || 0;
        document.getElementById('widget-approved').innerText = stats.approved || 0;
        document.getElementById('widget-rejected').innerText = stats.rejected || 0;
    } catch (err) {
        console.error("Error updating stats:", err);
    }
}

// 2. ฟังก์ชันเลื่อนหน้าจอ (Smooth Scroll)
function scrollToTable() {
    const table = document.querySelector('.card'); // เลื่อนไปที่ Card ตารางแรก
    if (table) {
        table.scrollIntoView({ behavior: 'smooth' });
    }
}

// อย่าลืม! เรียกใช้ฟังก์ชันตอนโหลดหน้าเว็บด้วย
window.addEventListener('DOMContentLoaded', () => {
    updateDashboardStats();
});


// สั่งให้ทำงานเมื่อโหลดหน้าเว็บ
document.addEventListener('DOMContentLoaded', () => {
    updateDashboardStats();
});

async function handleLeaveAction(leaveId, empId, leaveType, status, days) {
    if (!confirm(`ยืนยันการทำรายการหรือไม่?`)) return;

    try {
        // 🌟 สร้างก้อนข้อมูลเพื่อเตรียมส่งไปหา Backend
        const payload = {
            leave_id: leaveId,
            emp_id: empId,
            leave_type: leaveType,
            status: status,
            days_requested: days
        };

        // 🌟 ส่งก้อน payload ไปพร้อมกับ URL
        const res = await axios.put(`${API_URL}/leaves/update-status`, payload);

        alert(`✅ ${res.data.message}`);

        // รีโหลดตารางใหม่เพื่อดูผลลัพธ์
        loadPendingLeaves();

    } catch (err) {
        console.error("Leave Action Error:", err);
        alert('❌ ผิดพลาด: ' + (err.response?.data?.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
    }
}

// ==========================================
// 👥 3. ระบบจัดการพนักงาน
// ==========================================
async function fetchAllEmployees() {
    const empTbody = document.getElementById('employee-list-body');
    const quotaTbody = document.getElementById('quota-list-body');
    if (!empTbody || !quotaTbody) return;

    try {
        const res = await axios.get(`${API_URL}/employees/all`);
        empTbody.innerHTML = ''; quotaTbody.innerHTML = '';

        res.data.forEach(emp => {
            const roleBadge = emp.role === 'admin' ? '<span style="background:#ffeaa7; color:#d35400; padding:4px 8px; border-radius:4px;">HR / Admin</span>' : '<span style="background-color: #81ecec; color: #008080; padding: 4px 8px; border-radius: 4px;">พนักงานทั่วไป</span>';

            empTbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding:12px;">${emp.emp_id}</td>
                    <td>
                        ${emp.first_name} ${emp.last_name}<br>
                        <small style="color: #888;">${emp.dept_name || 'ไม่ระบุแผนก'} | เรท: ฿${emp.hourly_rate || 0}/ชม.</small>
                    </td>
                    <td>${roleBadge}</td>
                    <td>
                        <button onclick="openEditModal('${emp.emp_id}', '${emp.first_name}', '${emp.last_name}', '${emp.role}', '${emp.dept_id || ''}', '${emp.hourly_rate || 0}')" style="background:#f39c12; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; margin-right: 5px;"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteEmployee('${emp.emp_id}')" style="background:#ff4757; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;

            quotaTbody.innerHTML += `
    <tr style="border-bottom: 1px solid #eee;"> 
        <td style="padding:12px;">${emp.emp_id}</td>
        <td style="padding:12px;">${emp.first_name} ${emp.last_name}</td>
        <td style="padding:12px;"><b style="color:red">${emp.sick_leave_remaining ?? 0}</b>/30</td>
        <td style="padding:12px;"><b style="color:orange">${emp.personal_leave_remaining ?? 0}</b>/6</td>
        <td style="padding:12px;"><b style="color:green">${emp.annual_leave_remaining ?? 0}</b>/6</td>
    </tr>`;
        });
    } catch (err) { console.error(err); }
}

// ==========================================
// ➕ เพิ่มพนักงานใหม่ (Add Employee)
// ==========================================
document.getElementById('add-employee-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emp_id = document.getElementById('add-emp-id').value;
    const password = document.getElementById('add-password').value;
    const first_name = document.getElementById('add-first-name').value;
    const last_name = document.getElementById('add-last-name').value;
    const role = document.getElementById('add-role').value;

    // 🌟 ดึงค่าจากช่องค่าจ้าง (ถ้าไม่ได้กรอกให้เป็น 0)
    const hourly_rate = document.getElementById('add-hourly-rate').value || 0;

    try {
        const res = await axios.post(`${API_URL}/employees/add`, {
            emp_id: emp_id,
            password: password,
            first_name: first_name,
            last_name: last_name,
            role: role,
            hourly_rate: hourly_rate // 🌟 ส่งค่าจ้างพ่วงไปด้วย
        });

        alert(`✅ ${res.data.message}`);
        e.target.reset();
        fetchAllEmployees();

    } catch (err) {
        alert(`❌ ผิดพลาด: ${err.response?.data?.message || 'ไม่สามารถเพิ่มพนักงานได้'}`);
    }
});

// ลบพนักงาน
async function deleteEmployee(id) {
    if (!confirm('ยืนยันลบพนักงานคนนี้?')) return;
    try { await axios.delete(`${API_URL}/employees/${id}`); fetchAllEmployees(); } catch (err) { alert('ลบไม่สำเร็จ'); }
}

// Modal แก้ไขพนักงาน
function openEditModal(id, fname, lname, role, dept_id, hourly_rate) {
    document.getElementById('edit-emp-id').value = id;
    document.getElementById('edit-first-name').value = fname;
    document.getElementById('edit-last-name').value = lname;
    document.getElementById('edit-role').value = role;
    document.getElementById('edit-dept').value = dept_id;
    document.getElementById('edit-hourly-rate').value = hourly_rate;
    document.getElementById('editEmployeeModal').style.display = 'flex';
}
function closeEditModal() { document.getElementById('editEmployeeModal').style.display = 'none'; }

document.getElementById('edit-employee-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-emp-id').value;
    const data = {
        first_name: document.getElementById('edit-first-name').value,
        last_name: document.getElementById('edit-last-name').value,
        role: document.getElementById('edit-role').value,
        dept_id: document.getElementById('edit-dept').value,
        hourly_rate: document.getElementById('edit-hourly-rate').value
    };
    try {
        await axios.put(`${API_URL}/employees/${id}`, data);
        alert('✅ แก้ไขสำเร็จ'); closeEditModal(); fetchAllEmployees();
    } catch (err) { alert('❌ ล้มเหลว'); }
});

// ==========================================
// 💰 4. ระบบรายงานเงินเดือน
// ==========================================
async function loadSalaryReport() {
    try {
        const monthInput = document.getElementById('report-month').value;
        let url = `${API_URL}/salary-report`; // หรือเป็น http://localhost:1304/api/admin/salary-report
        if (monthInput) {
            const [y, m] = monthInput.split('-');
            url += `?year=${y}&month=${m}`;
        }

        const res = await axios.get(url);
        const tbody = document.getElementById('salary-report-body');
        if (!tbody) return;

        tbody.innerHTML = res.data.length ? '' : '<tr><td colspan="7" style="padding: 20px;">ไม่พบข้อมูล</td></tr>';

        res.data.forEach(emp => {
            // ฟอร์แมตจำนวนเงินให้ดูสวยงาม (มีลูกน้ำ และจุดทศนิยม)
            const pay = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(emp.totalPay);

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding:12px;">${emp.emp_id}</td>
                    <td>${emp.first_name} ${emp.last_name}</td>
                    <td style="color: #17a2b8; font-weight: bold;">${emp.total_work_hours || 0}</td>
                    <td style="color: #fd7e14; font-weight: bold;">${emp.total_ot_hours || 0}</td>
                    <td style="color: #dc3545; font-weight: bold;">${emp.sick_leaves || 0}</td>
                    <td style="color: #f39c12; font-weight: bold;">${emp.personal_leaves || 0}</td>
                    <td style="color: #28a745; font-weight: bold; font-size: 1.1em;">${pay}</td>
                </tr>`;
        });
    } catch (err) { console.error(err); }
}

// ==========================================
// 📥 ฟังก์ชันดาวน์โหลดตารางเป็นไฟล์ CSV (Excel)
// ==========================================
function exportSalaryCSV() {
    const table = document.getElementById("salary-table");
    if (!table) return alert("ไม่พบข้อมูลสำหรับดาวน์โหลด");

    // ดึงค่าเดือนที่เลือกมาตั้งเป็นชื่อไฟล์ (ถ้าไม่ได้เลือกจะใช้คำว่า All)
    const monthInput = document.getElementById('report-month').value || 'All';
    const fileName = `Salary_Report_${monthInput}.csv`;

    // กวาดข้อมูลจากตารางมาจัดเรียง
    let rows = Array.from(table.rows).map(row => {
        return Array.from(row.cells).map(c => {
            // ลบเครื่องหมายลูกน้ำ และสัญลักษณ์เงินบาท (฿) ออก เพื่อให้ Excel เอาไปคำนวณต่อได้
            let text = c.innerText.replace(/,/g, '').replace(/฿/g, '').trim();
            // ใส่ฟันหนู ("") ครอบไว้ เผื่อในข้อความมีการเว้นวรรค ตารางจะได้ไม่เบี้ยว
            return `"${text}"`;
        }).join(",");
    });

    // ใส่ \uFEFF นำหน้าเพื่อให้ Excel อ่านภาษาไทยได้ไม่เป็นภาษาต่างดาว
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// 📢 5. ระบบประกาศข่าวสาร (Announcements)
// ==========================================
document.getElementById('announcement-form')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const title = document.getElementById('announce-title').value;
    const content = document.getElementById('announce-content').value;

    try {
        await axios.post(`${API_URL}/announcements`, { title, content });
        alert('✅ แจ้งประกาศสำเร็จ');
        this.reset();
        loadAnnouncementsAdmin();
    } catch (error) { alert('❌ ไม่สามารถลงประกาศได้'); }
});

async function loadAnnouncementsAdmin() {
    const listDiv = document.getElementById('admin-announcement-list');
    if (!listDiv) return;

    try {
        const res = await axios.get(`${API_URL}/announcements`);
        listDiv.innerHTML = res.data.length === 0 ? '<p style="text-align: center; color: #999;">ยังไม่มีประกาศในระบบ</p>' : '';

        res.data.forEach(item => {
            const date = new Date(item.created_at).toLocaleString('th-TH');
            listDiv.innerHTML += `
                <div style="border: 1px solid #eee; padding: 15px; border-radius: 8px; margin-bottom: 10px; background: #fafafa; position: relative;">
                    <strong style="color: #e67e22; font-size: 1.1em;">${item.title}</strong>
                    <p style="margin: 5px 0; font-size: 0.9em; color: #666;">เมื่อ: ${date}</p>
                    <p style="margin-top: 8px; white-space: pre-line;">${item.content}</p>
                    <button onclick="deleteAnnouncement(${item.id})" style="position: absolute; top: 15px; right: 15px; background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i> ลบ</button>
                </div>
            `;
        });
    } catch (error) { listDiv.innerHTML = '<p style="color: red;">โหลดข้อมูลผิดพลาด</p>'; }
}

async function deleteAnnouncement(id) {
    if (!confirm('ลบประกาศนี้?')) return;
    try { await axios.delete(`${API_URL}/announcements/${id}`); loadAnnouncementsAdmin(); }
    catch (error) { alert('❌ ลบไม่สำเร็จ'); }
}



// ==========================================
// 🧭 6. ระบบนำทาง (Navigation)
// ==========================================
function switchPage(event, pageId, clickedLink) {
    event.preventDefault();
    document.querySelectorAll('.page-section').forEach(p => p.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    clickedLink.classList.add('active');

    if (pageId === 'page-manage-employees') fetchAllEmployees();
    if (pageId === 'page-approve-leave') loadPendingLeaves();
    if (pageId === 'page-report') loadSalaryReport();
    if (pageId === 'page-announcements') loadAnnouncementsAdmin();
}

// ==========================================
// 🏖️ 7. ระบบค้นหาและแบ่งหน้า (หน้า Admin: ประวัติการลาทั้งหมด)
// ==========================================

let allAdminLeaveRecords = []; // เก็บข้อมูลการลาทั้งหมด
let currentAdminPage = 1;
const adminItemsPerPage = 10; // แสดง 10 รายการต่อหน้า

// 1. ดึงข้อมูลประวัติการลาทั้งหมดมาเก็บไว้ (ดัดแปลงจากฟังก์ชันเดิมของคุณ)
async function fetchAndRenderAllLeaveHistory() {
    try {
        // เปลี่ยนจาก URL เต็มๆ มาใช้ตัวแปร API_URL
        const res = await await axios.get(`${API_URL}/leave-history`);
        allAdminLeaveRecords = res.data;
        currentAdminPage = 1;
        renderAdminLeaveTable();
    } catch (err) {
        console.error("โหลดประวัติไม่สำเร็จ:", err);
    }
}

// ==========================================
// 🛡️ 2. ฟังก์ชันวาดตารางและค้นหา (อัปเดตป้องกัน Error 100%)
// ==========================================
function renderAdminLeaveTable() {
    console.log("หน้าตาข้อมูลจาก Database:", allAdminLeaveRecords);
    const tbody = document.getElementById('all-leave-history-body');
    const searchInput = document.getElementById('search-admin-leave');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (!tbody) return;
    tbody.innerHTML = '';

    // 🔍 ตัวกรองค้นหา (Safe Search - ป้องกันข้อมูล null)
    let filteredRecords = allAdminLeaveRecords; // 👈 เริ่มต้นให้ดึงข้อมูลทั้งหมดมาเตรียมไว้ก่อน

    // 👈 ถ้ามีการพิมพ์ค้นหา ค่อยเอาไปกรอง
    if (searchTerm !== '') {
        filteredRecords = allAdminLeaveRecords.filter(item => {
            if (!item) return false;
            // บังคับแปลงเป็น String ก่อนค้นหา จะได้ไม่พัง
            const empId = String(item.emp_id || '').toLowerCase();
            const fullName = String(`${item.first_name || ''} ${item.last_name || ''}`).toLowerCase();
            const typeName = String(item.leave_type || '').toLowerCase();

            return empId.includes(searchTerm) || fullName.includes(searchTerm) || typeName.includes(searchTerm);
        });
    }

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: red;">ไม่พบข้อมูลที่ค้นหา</td></tr>';
        renderAdminPagination(0);
        return;
    }
    // ... โค้ดส่วนที่เหลือ (Pagination และการวาดตาราง) เหมือนเดิมครับ

    // 🌟 คำนวณหน้า Pagination (ฮาร์ดโค้ด 10 ไว้เลย กันตัวแปรหาย)
    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    if (currentAdminPage > totalPages || isNaN(currentAdminPage)) currentAdminPage = 1;

    const startIndex = (currentAdminPage - 1) * itemsPerPage;
    const recordsToShow = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

    // 🛡️ ฟังก์ชันเช็ควันที่แบบปลอดภัย
    const safeDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH');
    };

    try {
        // 🌟 พยายามวาดตาราง
        tbody.innerHTML = recordsToShow.map(item => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="color: #7f8c8d;">${safeDate(item.created_at)}</td>
                <td class="col-name">
                    <strong style="color: #2c3e50;">${item.emp_id || '-'}</strong><br>
                    ${item.first_name || ''} ${item.last_name || ''}
                </td>
                <td><span class="badge-type">${item.leave_type || '-'}</span></td>
                <td style="color: #2980b9;">${safeDate(item.start_date)} <br>ถึง ${safeDate(item.end_date)}</td>
                <td style="font-weight: bold;">${item.days_requested || '-'} วัน</td>
                <td>
                    <span class="status-badge" style="background:${item.status === 'approved' ? '#28a745' : item.status === 'rejected' ? '#dc3545' : '#f39c12'}">
                        ${item.status === 'approved' ? 'อนุมัติแล้ว' : item.status === 'rejected' ? 'ไม่อนุมัติ' : 'รออนุมัติ'}
                    </span>
                </td>
            </tr>
        `).join('');

        renderAdminPagination(totalPages);
    } catch (error) {
        // ถ้าข้อมูลมีปัญหาจริงๆ จะไม่ขาวโพลน แต่จะฟ้องบอก
        console.error("Render Table Error:", error);
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: red;">เกิดข้อผิดพลาดในการแสดงผลข้อมูล (เช็ค Console)</td></tr>';
    }
}

// 3. ฟังก์ชันสร้างปุ่มหน้า (Pagination)
function renderAdminPagination(totalPages) {
    const paginationDiv = document.getElementById('admin-leave-pagination');
    if (!paginationDiv) return;

    paginationDiv.innerHTML = '';
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.style.margin = '0 3px';
        btn.style.padding = '5px 10px';
        btn.style.border = '1px solid #3498db';
        btn.style.borderRadius = '3px';
        btn.style.cursor = 'pointer';

        // สลับสีปุ่มหน้าปัจจุบัน
        if (i === currentAdminPage) {
            btn.style.backgroundColor = '#3498db';
            btn.style.color = 'white';
        } else {
            btn.style.backgroundColor = 'white';
            btn.style.color = '#3498db';
        }

        btn.addEventListener('click', () => {
            currentAdminPage = i;
            renderAdminLeaveTable();
        });

        paginationDiv.appendChild(btn);
    }
}

// 4. ผูก Event ค้นหาให้ทำงานเมื่อพิมพ์
const adminSearchInput = document.getElementById('search-admin-leave');
if (adminSearchInput) {
    adminSearchInput.addEventListener('input', () => {
        currentAdminPage = 1;
        renderAdminLeaveTable();
    });
}
// ==========================================
// 📈 8. ระบบวาดกราฟสถิติ (Chart.js)
// ==========================================
let workHoursChartInstance = null; // สร้างตัวแปรเก็บสถานะกราฟ ป้องกันบั๊กกราฟซ้อนกัน

async function loadWorkHoursChart() {
    try {
        // 🌟 ดึงข้อมูลจาก API รายงานเงินเดือน (เพราะมีข้อมูลชั่วโมงทำงานอยู่แล้ว)
        const res = await axios.get(`${API_URL}/salary-report`);
        const data = res.data;

        // ถ้าไม่มีข้อมูล ให้หยุดการทำงาน
        if (!data || data.length === 0) return;

        // 🌟 1. เตรียมข้อมูลแกน X (ชื่อพนักงาน) และแกน Y (ชั่วโมงทำงาน, OT)
        const labels = [];
        const workHoursData = [];
        const otHoursData = [];

        data.forEach(emp => {
            labels.push(`${emp.first_name} ${emp.last_name}`);
            workHoursData.push(emp.total_work_hours || 0);
            otHoursData.push(emp.total_ot_hours || 0);
        });

        // 🌟 2. วาดกราฟลงบน Canvas
        const ctx = document.getElementById('workHoursChart');
        if (!ctx) return; // ถ้าไม่เจอ Canvas (อาจจะอยู่คนละหน้า) ให้ข้ามไป

        // สำคัญ: ต้องเคลียร์กราฟเก่าทิ้งก่อนวาดใหม่ ไม่งั้นเวลาเอาเมาส์ชี้มันจะกระพริบ
        if (workHoursChartInstance) {
            workHoursChartInstance.destroy();
        }

        workHoursChartInstance = new Chart(ctx, {
            type: 'bar', // กำหนดประเภทเป็นกราฟแท่ง
            data: {
                labels: labels, // แกน X: ชื่อพนักงาน
                datasets: [
                    {
                        label: 'ชั่วโมงทำงานปกติ',
                        data: workHoursData, // แกน Y: จำนวนชั่วโมง
                        backgroundColor: 'rgba(54, 162, 235, 0.7)', // สีฟ้า
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        borderRadius: 4 // ขอบมนๆ ให้ดูทันสมัย
                    },
                    {
                        label: 'ชั่วโมง OT',
                        data: otHoursData, // แกน Y: จำนวน OT
                        backgroundColor: 'rgba(255, 159, 64, 0.7)', // สีส้ม
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'จำนวนชั่วโมง'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top', // เอาป้ายบอกสีไว้ด้านบน
                    }
                }
            }
        });

    } catch (err) {
        console.error("โหลดข้อมูลกราฟไม่สำเร็จ:", err);
    }
}


// รวมไว้ที่เดียวล่างสุดของไฟล์ admin.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin Dashboard Initializing...");
    updateDashboardStats();
    loadDepartments();
    loadPendingLeaves();
    fetchAllEmployees();
    loadSalaryReport();
    loadAnnouncementsAdmin();
    fetchAndRenderAllLeaveHistory();
    loadWorkHoursChart(); 
});