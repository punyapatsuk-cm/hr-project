// 🌟 1. แก้ไข URL ให้ตรงกับหลังบ้าน (เพิ่ม /admin)
const API_URL = 'http://localhost:1304/api/admin';

// ==========================================
// 🏢 โหลดข้อมูลแผนก (Departments)
// ==========================================
async function loadDepartments() {
    try {
        const res = await axios.get(`${API_URL}/departments`);
        const newDept = document.getElementById('new-dept');
        const editDept = document.getElementById('edit-dept');

        let options = '<option value="">-- เลือกแผนก --</option>';
        res.data.forEach(d => {
            const deptId = d.dept_id || d.id;
            const deptName = d.dept_name || d.name;
            options += `<option value="${deptId}">${deptName}</option>`;
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
            tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; color: green; text-align: center;">🎉 ไม่มีรายการรอดำเนินการ</td></tr>';
            return;
        }

        response.data.forEach(leave => {
            const start = new Date(leave.start_date);
            const end = new Date(leave.end_date);
            const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;

            const attachment = leave.attachment
                ? `<a href="http://localhost:1304/uploads/${leave.attachment}" target="_blank" style="color: #007bff; text-decoration: none;">📄 ดูเอกสาร</a>`
                : '-';

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee; text-align: center;">
                    <td style="padding: 12px; font-weight: bold;">${leave.emp_id}</td>
                    <td>${leave.first_name} ${leave.last_name}</td>
                    <td>
                        <span style="background: #e9ecef; padding: 2px 8px; border-radius: 5px; font-size: 0.9em;">
                            ${leave.leave_type}
                        </span>
                        <br><small style="color: #666;">(${diffDays} วัน)</small>
                    </td>
                    <td style="max-width: 150px; word-wrap: break-word; font-size: 0.9em;">${leave.reason || '-'}</td>
                    <td>
                        <div style="font-size: 0.85em;">
                            ${start.toLocaleDateString('th-TH')} <br>ถึง<br> ${end.toLocaleDateString('th-TH')}
                        </div>
                    </td>
                    <td>${attachment}</td>
                    <td>
                        <button onclick="handleLeaveAction(${leave.leave_id}, '${leave.emp_id}', '${leave.leave_type}', 'approved', ${diffDays})" 
                                style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-bottom: 5px; width: 80px;">
                            อนุมัติ
                        </button>
                        
                        <button onclick="handleLeaveAction(${leave.leave_id}, '${leave.emp_id}', '${leave.leave_type}', 'rejected', ${diffDays})" 
                                style="background:#dc3545; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; width: 80px;">
                            ปฏิเสธ
                        </button>
                    </td>
                </tr>`;
        });
    } catch (err) {
        console.error("Load Leaves Error:", err);
    }
}

async function handleLeaveAction(leaveId, empId, leaveType, status, days) {
    if (!confirm(`ยืนยันการทำรายการหรือไม่?`)) return;

    try {
        const payload = {
            leave_id: leaveId,
            emp_id: empId,
            leave_type: leaveType,
            status: status,
            days_requested: days
        };

        const res = await axios.put(`${API_URL}/leaves/update-status`, payload);
        alert(`✅ ${res.data.message}`);

        loadPendingLeaves();
        updateDashboardStats();
        fetchAndRenderAllLeaveHistory();

    } catch (err) {
        console.error("Leave Action Error:", err);
        alert('❌ ผิดพลาด: ' + (err.response?.data?.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
    }
}

// ==========================================
// 📊 3. โหลดตัวเลขสถิติ Dashboard 4 กล่อง
// ==========================================
async function updateDashboardStats() {
    try {
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

function scrollToTable() {
    const table = document.querySelector('.card');
    if (table) {
        table.scrollIntoView({ behavior: 'smooth' });
    }
}

// ==========================================
// 👥 4. ระบบจัดการพนักงาน
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

document.getElementById('add-employee-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emp_id = document.getElementById('add-emp-id').value;
    const password = document.getElementById('add-password').value;
    const first_name = document.getElementById('add-first-name').value;
    const last_name = document.getElementById('add-last-name').value;
    const role = document.getElementById('add-role').value;
    const hourly_rate = document.getElementById('add-hourly-rate').value || 0;

    try {
        const res = await axios.post(`${API_URL}/employees/add`, {
            emp_id, password, first_name, last_name, role, hourly_rate
        });
        alert(`✅ ${res.data.message}`);
        e.target.reset();
        fetchAllEmployees();
    } catch (err) {
        alert(`❌ ผิดพลาด: ${err.response?.data?.message || 'ไม่สามารถเพิ่มพนักงานได้'}`);
    }
});

async function deleteEmployee(id) {
    if (!confirm('ยืนยันลบพนักงานคนนี้?')) return;
    try { await axios.delete(`${API_URL}/employees/${id}`); fetchAllEmployees(); } catch (err) { alert('ลบไม่สำเร็จ'); }
}

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
// 💰 5. ระบบรายงานเงินเดือน และวาดกราฟ (รวมกันแล้ว)
// ==========================================
let workHoursChartInstance = null; // ตัวแปรเก็บกราฟ

async function loadSalaryReport() {
    try {
        const monthInput = document.getElementById('report-month')?.value;
        let url = `${API_URL}/salary-report`;
        if (monthInput) {
            const [y, m] = monthInput.split('-');
            url += `?year=${y}&month=${m}`;
        }

        const res = await axios.get(url);
        const data = res.data;
        const tbody = document.getElementById('salary-report-body');

        if (tbody) {
            tbody.innerHTML = data.length ? '' : '<tr><td colspan="7" style="padding: 20px; color: #999;">ไม่พบข้อมูล</td></tr>';
            data.forEach(emp => {
                const pay = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(emp.totalPay || 0);
                tbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding:15px 10px;">${emp.emp_id}</td>
                        <td class="col-name">${emp.first_name} ${emp.last_name}</td>
                        <td style="color: #3498db; font-weight: bold;">${emp.total_work_hours || 0}</td>
                        <td style="color: #e67e22; font-weight: bold;">${emp.total_ot_hours || 0}</td>
                        <td style="color: #dc3545; font-weight: bold;">${emp.sick_leaves || 0}</td>
                        <td style="color: #f39c12; font-weight: bold;">${emp.personal_leaves || 0}</td>
                        <td style="color: #28a745; font-weight: bold; font-size: 1.1em;">${pay}</td>
                    </tr>`;
            });
        }

        drawWorkHoursChart(data);

    } catch (err) { console.error("โหลดรายงานพลาด:", err); }
}

function drawWorkHoursChart(data) {
    const ctx = document.getElementById('workHoursChart');
    if (!ctx) return;

    const labels = data.map(emp => `${emp.first_name}`);
    const workHoursData = data.map(emp => emp.total_work_hours || 0);
    const otHoursData = data.map(emp => emp.total_ot_hours || 0);

    if (workHoursChartInstance) {
        workHoursChartInstance.destroy();
    }

    workHoursChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'ชั่วโมงทำงานปกติ',
                    data: workHoursData,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'ชั่วโมง OT',
                    data: otHoursData,
                    backgroundColor: 'rgba(255, 159, 64, 0.7)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'จำนวนชั่วโมง' } }
            },
            plugins: { legend: { position: 'top' } }
        }
    });
}

function exportSalaryCSV() {
    const table = document.getElementById("salary-table");
    if (!table) return alert("ไม่พบข้อมูลสำหรับดาวน์โหลด");

    const monthInput = document.getElementById('report-month').value || 'All';
    const fileName = `Salary_Report_${monthInput}.csv`;

    let rows = Array.from(table.rows).map(row => {
        return Array.from(row.cells).map(c => {
            let text = c.innerText.replace(/,/g, '').replace(/฿/g, '').trim();
            return `"${text}"`;
        }).join(",");
    });

    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// 📢 6. ระบบประกาศข่าวสาร
// ==========================================
async function loadAnnouncementsAdmin() {
    const listDiv = document.getElementById('admin-announcement-list');
    if (!listDiv) return;

    try {
        const res = await axios.get(`${API_URL}/announcements`);
        
        if (res.data.length === 0) {
            listDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;"><i class="fas fa-inbox fa-3x" style="opacity: 0.2; display: block; margin-bottom: 10px;"></i>ยังไม่มีประกาศในระบบ</p>';
            return;
        }

        listDiv.innerHTML = ''; 
        res.data.forEach(item => {
            const date = new Date(item.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
            
            listDiv.innerHTML += `
                <div style="border: 1px solid #eaeaea; padding: 20px; border-radius: 8px; background: #fff; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.02); border-left: 5px solid #e67e22; margin-bottom: 15px;">
                    <h4 style="color: #2c3e50; font-size: 1.15em; margin: 0 0 8px 0; padding-right: 50px;">${item.title}</h4>
                    <p style="margin: 0 0 12px 0; font-size: 0.85em; color: #7f8c8d;">
                        <i class="far fa-clock"></i> เผยแพร่เมื่อ: ${date}
                    </p>
                    <p style="margin: 0; white-space: pre-line; color: #444; line-height: 1.6; font-size: 0.95em;">${item.content}</p>
                    
                    <button onclick="deleteAnnouncement(${item.id})" title="ลบประกาศ" 
                        style="position: absolute; top: 20px; right: 20px; background: #ff4757; color: white; border: none; width: 35px; height: 35px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(255,71,87,0.3);">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
        });
    } catch (error) { 
        listDiv.innerHTML = '<p style="color: red; text-align: center;">โหลดข้อมูลผิดพลาด</p>'; 
    }
}

async function deleteAnnouncement(id) {
    if (!confirm('ยืนยันที่จะลบประกาศนี้ใช่หรือไม่?')) return;
    try { 
        await axios.delete(`${API_URL}/announcements/${id}`); 
        loadAnnouncementsAdmin(); 
    } catch (error) { 
        alert('❌ ลบไม่สำเร็จ'); 
    }
}

// ==========================================
// 🏖️ 7. ประวัติการลาทั้งหมด (มีระบบค้นหา)
// ==========================================
let allAdminLeaveRecords = [];
let currentAdminPage = 1;

async function fetchAndRenderAllLeaveHistory() {
    try {
        const res = await axios.get(`${API_URL}/leave-history`);
        allAdminLeaveRecords = res.data;
        currentAdminPage = 1;
        renderAdminLeaveTable();
    } catch (err) {
        console.error("โหลดประวัติไม่สำเร็จ:", err);
    }
}

function renderAdminLeaveTable() {
    const tbody = document.getElementById('all-leave-history-body');
    const searchInput = document.getElementById('search-admin-leave');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (!tbody) return;
    tbody.innerHTML = '';

    let filteredRecords = allAdminLeaveRecords;

    if (searchTerm !== '') {
        filteredRecords = allAdminLeaveRecords.filter(item => {
            if (!item) return false;
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

    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    if (currentAdminPage > totalPages || isNaN(currentAdminPage)) currentAdminPage = 1;

    const startIndex = (currentAdminPage - 1) * itemsPerPage;
    const recordsToShow = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

    const safeDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH');
    };

    try {
        tbody.innerHTML = recordsToShow.map(item => {
            let diffDays = '-';
            if (item.start_date && item.end_date) {
                const s = new Date(item.start_date);
                const e = new Date(item.end_date);
                diffDays = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1;
            }

            return `
                <tr style="border-bottom: 1px solid #eee; text-align: center;">
                    <td style="color: #7f8c8d; padding: 12px;">${safeDate(item.created_at)}</td>
                    <td class="col-name" style="text-align: left;">
                        <strong style="color: #2c3e50;">${item.emp_id || '-'}</strong><br>
                        ${item.first_name || ''} ${item.last_name || ''}
                    </td>
                    <td><span class="badge-type" style="background: #f8f9fa; padding: 2px 8px; border-radius: 4px; font-size: 0.9em;">${item.leave_type || '-'}</span></td>
                    <td style="color: #2980b9;">${safeDate(item.start_date)} <br>ถึง ${safeDate(item.end_date)}</td>
                    
                    <td style="font-weight: bold;">${diffDays} วัน</td>
                    
                    <td>
                        <span class="status-badge" style="background:${item.status === 'approved' ? '#28a745' : item.status === 'rejected' ? '#dc3545' : '#f39c12'}; padding: 5px 12px; border-radius: 20px; color: white; font-size: 0.85em;">
                            ${item.status === 'approved' ? 'อนุมัติแล้ว' : item.status === 'rejected' ? 'ไม่อนุมัติ' : 'รอพิจารณา'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        renderAdminPagination(totalPages);
    } catch (error) {
        console.error("Render Table Error:", error);
    }
}

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

const adminSearchInput = document.getElementById('search-admin-leave');
if (adminSearchInput) {
    adminSearchInput.addEventListener('input', () => {
        currentAdminPage = 1;
        renderAdminLeaveTable();
    });
}

// ==========================================
// 🧭 8. ระบบสลับหน้าต่าง (Navigation)
// ==========================================
function switchPage(event, pageId, clickedLink) {
    if (event) event.preventDefault();
    document.querySelectorAll('.page-section').forEach(p => p.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    if (clickedLink) clickedLink.classList.add('active');

    if (pageId === 'page-manage-employees') fetchAllEmployees();
    if (pageId === 'page-approve-leave') { loadPendingLeaves(); updateDashboardStats(); fetchAndRenderAllLeaveHistory(); }
    if (pageId === 'page-report') loadSalaryReport();
    if (pageId === 'page-announcements') loadAnnouncementsAdmin();
}

// ==========================================
// 🚀 9. โหลดข้อมูลตอนเปิดเว็บไซต์ & ผูกปุ่มกด
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Admin Dashboard is Ready!");
    updateDashboardStats();
    loadDepartments();
    loadPendingLeaves();
    fetchAllEmployees();
    loadSalaryReport(); 
    loadAnnouncementsAdmin();
    fetchAndRenderAllLeaveHistory();

    // 🌟 ย้ายการผูกปุ่มสร้างประกาศเข้ามาไว้ในนี้ เพื่อให้ชัวร์ 100% ว่ามันจะหาฟอร์มเจอ!
    const announceForm = document.getElementById('announcement-form');
    if(announceForm) {
        announceForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // ป้องกันเว็บกระตุก/รีโหลด

            const title = document.getElementById('announce-title').value;
            const content = document.getElementById('announce-content').value;

            try {
                await axios.post(`${API_URL}/announcements`, { title, content });
                alert('✅ เผยแพร่ประกาศสำเร็จ!');
                e.target.reset(); // ล้างช่องกรอก
                loadAnnouncementsAdmin(); // รีเฟรชตารางฝั่งขวา
            } catch (error) {
                console.error('Error adding announcement:', error);
                alert('❌ ไม่สามารถเผยแพร่ประกาศได้ กรุณาตรวจสอบ Backend');
            }
        });
    }
});