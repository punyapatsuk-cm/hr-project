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

async function handleLeaveAction(leaveId, empId, leaveType, status, days) {
    if (!confirm(`ยืนยันการทำรายการหรือไม่?`)) return;
    try {
        await axios.put(`${API_URL}/leaves/update-status`, { /* ข้อมูล */ });
        alert('✅ ดำเนินการเรียบร้อย');
        
        // 🌟 เรียกแค่ฟังก์ชันโหลดข้อมูลใหม่พอ หน้าเว็บจะไม่กระโดด
        loadPendingLeaves(); 
        
    } catch (err) { alert('❌ ผิดพลาด'); }
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

// เพิ่มพนักงานใหม่
document.getElementById('edit-employee-form')?.addEventListener('submit', async (e) => {
    e.preventDefault(); // 🌟 บรรทัดนี้สำคัญที่สุด! ห้ามลืมเด็ดขาด มันคือตัวหยุดไม่ให้หน้าเว็บรีโหลด
    
    const id = document.getElementById('edit-emp-id').value;
    const data = { /* ข้อมูลต่างๆ */ };

    try {
        await axios.put(`${API_URL}/employees/${id}`, data);
        alert('✅ แก้ไขสำเร็จ'); 
        
        closeEditModal(); // ปิดหน้าต่าง Modal
        fetchAllEmployees(); // โหลดข้อมูลในตารางใหม่ (โดยไม่ต้องรีโหลดทั้งหน้า)
        
        // ❌ ห้ามใส่ window.location.reload() หรือ window.location.href ตรงนี้
    } catch (err) { 
        alert('❌ ล้มเหลว'); 
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
        let url = `${API_URL}/salary-report`;
        if (monthInput) { const [y, m] = monthInput.split('-'); url += `?year=${y}&month=${m}`; }

        const res = await axios.get(url);
        const tbody = document.getElementById('salary-report-body');
        if (!tbody) return;

        tbody.innerHTML = res.data.length ? '' : '<tr><td colspan="5" style="padding: 20px;">ไม่พบข้อมูล</td></tr>';

        res.data.forEach(emp => {
            const pay = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(emp.totalPay);
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding:12px;">${emp.emp_id}</td>
                    <td>${emp.first_name} ${emp.last_name}</td>
                    <td style="color: #17a2b8; font-weight: bold;">${emp.total_work_hours || 0} ชม.</td>
                    <td style="color: #fd7e14; font-weight: bold;">${emp.total_ot_hours || 0} ชม.</td>
                    <td style="color: #28a745; font-weight: bold;">${pay}</td>
                </tr>`;
        });
    } catch (err) { console.error(err); }
}

function exportSalaryCSV() {
    const table = document.getElementById("salary-table");
    let rows = Array.from(table.rows).map(row => Array.from(row.cells).map(c => c.innerText.replace(/,/g, '').replace(/฿/g, '').trim()).join(","));
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Salary_Report.csv`;
    link.click();
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

// โหลดข้อมูลทั้งหมดทันทีที่เปิดหน้าเว็บ
loadDepartments();
loadPendingLeaves();
fetchAllEmployees();
loadSalaryReport();
loadAnnouncementsAdmin();