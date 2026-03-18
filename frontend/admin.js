// ============================================================
// admin.js — Frontend สำหรับหน้า HR Admin Dashboard
// ต้องโหลด utils.js ก่อนไฟล์นี้เสมอ (API_BASE, helpers อยู่ใน utils.js)
// ============================================================

// ── ตรวจสอบสิทธิ์ ──────────────────────────────────────────
const adminEmpId = localStorage.getItem('employeeId');
const adminRole  = localStorage.getItem('userRole');
if (!adminEmpId || adminRole !== 'admin') window.location.href = 'login.html';

const API_URL = `${API_BASE}/api/admin`;

// ── State ───────────────────────────────────────────────────
let allAdminLeaveRecords = [];
let currentAdminPage     = 1;
let workHoursChartInstance = null;

// ============================================================
// SECTION 1 — แผนก
// ============================================================

// โหลดรายชื่อแผนกลงใน <select> ทั้งฟอร์มเพิ่มและฟอร์มแก้ไข
async function loadDepartments() {
    try {
        const { data } = await axios.get(`${API_URL}/departments`, getAuthHeaders());
        const opts = [
            '<option value="">— ไม่ระบุแผนก —</option>',
            ...data.map(d => `<option value="${escapeHtml(d.dept_id)}">${escapeHtml(d.dept_name)}</option>`)
        ].join('');
        const addDept  = document.getElementById('add-dept');
        const editDept = document.getElementById('edit-dept');
        if (addDept)  addDept.innerHTML  = opts;
        if (editDept) editDept.innerHTML = opts;
    } catch (err) {
        console.error('โหลดแผนกไม่ได้:', err);
    }
}

// ============================================================
// SECTION 2 — ใบลางาน (รอพิจารณา)
// ============================================================

// โหลดใบลาที่รอพิจารณาและแสดงในตาราง
async function loadPendingLeaves() {
    const tbody = document.getElementById('admin-leave-table-body');
    if (!tbody) return;
    try {
        const { data } = await axios.get(`${API_URL}/leaves/pending`, getAuthHeaders());
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-row">🎉 ไม่มีรายการรอดำเนินการ</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(renderPendingLeaveRow).join('');
    } catch (err) {
        console.error('Load Leaves Error:', err);
    }
}

// สร้าง HTML row สำหรับใบลาที่รอพิจารณา
function renderPendingLeaveRow(leave) {
    const diffDays = calcDiffDays(leave.start_date, leave.end_date);
    const attach   = leave.attachment
        ? `<a href="${API_BASE}/uploads/${encodeURIComponent(leave.attachment)}" target="_blank" class="doc-link">📄 ดูเอกสาร</a>`
        : '-';
    return `<tr>
        <td class="text-center text-mid fw-600">${escapeHtml(leave.emp_id)}</td>
        <td><div class="emp-name">${escapeHtml(leave.first_name)} ${escapeHtml(leave.last_name)}</div></td>
        <td class="text-center">
            <span class="badge badge-pending">${leaveLabel(leave.leave_type)}</span>
            <div class="text-light text-xs mt-3">${diffDays} วัน</div>
        </td>
        <td class="reason-cell">${escapeHtml(leave.reason || '-')}</td>
        <td class="text-center text-sm text-blue lh-16">
            ${safeDate(leave.start_date)}<br>
            <span class="text-light text-xs">ถึง</span><br>
            ${safeDate(leave.end_date)}
        </td>
        <td class="text-center">${attach}</td>
        <td class="text-center">
            <div class="actions-cell" style="flex-direction:column;gap:6px;">
                <button class="btn btn-primary btn-sm"
                    onclick="handleLeaveAction(${leave.leave_id},'${escapeHtml(leave.emp_id)}','${leave.leave_type}','approved',${diffDays})">
                    <i class="fas fa-check"></i> อนุมัติ
                </button>
                <button class="btn btn-danger btn-sm"
                    onclick="handleLeaveAction(${leave.leave_id},'${escapeHtml(leave.emp_id)}','${leave.leave_type}','rejected',${diffDays})">
                    <i class="fas fa-times"></i> ปฏิเสธ
                </button>
            </div>
        </td>
    </tr>`;
}

// อนุมัติหรือปฏิเสธใบลา
async function handleLeaveAction(leaveId, eid, leaveType, status, days) {
    const label = status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ';
    const confirmed = await showConfirm(
        `ยืนยันการ <b>${label}</b> ใบลานี้?`,
        { title: `${label}ใบลางาน`, confirmText: label, danger: status === 'rejected' }
    );
    if (!confirmed) return;
    try {
        const res = await axios.put(`${API_URL}/leaves/update-status`, { leave_id: leaveId, status }, getAuthHeaders());
        showToast(res.data.message, 'success');
        loadPendingLeaves();
        updateDashboardStats();
        fetchAndRenderAllLeaveHistory();
    } catch (err) {
        showToast(err.response?.data?.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'error');
    }
}

// ============================================================
// SECTION 3 — Dashboard Stats
// ============================================================

// อัปเดตตัวเลขสถิติ 4 กล่องบน Dashboard
async function updateDashboardStats() {
    try {
        const { data: s } = await axios.get(`${API_URL}/dashboard-stats`, getAuthHeaders());
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val || 0; };
        setText('widget-total',    s.total);
        setText('widget-pending',  s.pending);
        setText('widget-approved', s.approved);
        setText('widget-rejected', s.rejected);
    } catch (err) {
        console.error('Error updating stats:', err);
    }
}

// ============================================================
// SECTION 4 — จัดการพนักงาน
// ============================================================

// โหลดรายชื่อพนักงานลงตารางและตารางโควตา
async function fetchAllEmployees() {
    const empTb  = document.getElementById('employee-list-body');
    const quotTb = document.getElementById('quota-list-body');
    if (!empTb || !quotTb) return;
    try {
        const { data } = await axios.get(`${API_URL}/employees/all`, getAuthHeaders());
        empTb.innerHTML  = data.map(renderEmployeeRow).join('');
        quotTb.innerHTML = data.map(renderQuotaRow).join('');
    } catch (err) {
        console.error('Fetch Employees Error:', err);
    }
}

// สร้าง HTML row สำหรับตารางพนักงาน
function renderEmployeeRow(emp) {
    const badge = emp.role === 'admin'
        ? '<span class="badge badge-admin">🛡️ HR / Admin</span>'
        : '<span class="badge badge-user">👤 พนักงานทั่วไป</span>';
    return `<tr>
        <td class="text-center fw-600 text-mid">${escapeHtml(emp.emp_id)}</td>
        <td>
            <div class="emp-name">${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</div>
            <div class="emp-sub">${escapeHtml(emp.dept_name || 'ไม่ระบุแผนก')} | เรท: ฿${parseFloat(emp.hourly_rate || 0).toFixed(2)}/ชม.</div>
        </td>
        <td class="text-center">${badge}</td>
        <td class="text-center">
            <div class="actions-cell">
                <button class="btn-icon btn-icon-edit" title="แก้ไข"
                    data-id="${escapeHtml(emp.emp_id)}"
                    data-fname="${escapeHtml(emp.first_name)}"
                    data-lname="${escapeHtml(emp.last_name)}"
                    data-role="${escapeHtml(emp.role)}"
                    data-dept="${escapeHtml(emp.dept_id || '')}"
                    data-rate="${emp.hourly_rate || 0}"
                    onclick="openEditModal(this.dataset)">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-icon-delete" title="ลบ"
                    onclick="deleteEmployee('${escapeHtml(emp.emp_id)}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    </tr>`;
}

// สร้าง HTML row สำหรับตารางโควตาวันลา
function renderQuotaRow(emp) {
    return `<tr>
        <td class="text-center fw-600 text-mid text-sm">${escapeHtml(emp.emp_id)}</td>
        <td><div class="emp-name">${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</div></td>
        <td class="text-center fw-700 text-red">${emp.sick_leave_remaining     ?? 0}</td>
        <td class="text-center fw-700 text-orange">${emp.personal_leave_remaining ?? 0}</td>
        <td class="text-center fw-700 text-green">${emp.annual_leave_remaining   ?? 0}</td>
    </tr>`;
}

// ลบพนักงาน
async function deleteEmployee(id) {
    const confirmed = await showConfirm(
        `ลบพนักงาน <b>${id}</b> ออกจากระบบ?`,
        { title: 'ลบพนักงาน', confirmText: 'ลบ', danger: true }
    );
    if (!confirmed) return;
    try {
        await axios.delete(`${API_URL}/employees/${id}`, getAuthHeaders());
        showToast('ลบพนักงานเรียบร้อยแล้ว', 'success');
        fetchAllEmployees();
    } catch {
        showToast('ลบข้อมูลไม่สำเร็จ', 'error');
    }
}

// เปิด modal แก้ไขพนักงาน
function openEditModal(ds) {
    document.getElementById('edit-emp-id').value      = ds.id;
    document.getElementById('edit-first-name').value  = ds.fname;
    document.getElementById('edit-last-name').value   = ds.lname;
    document.getElementById('edit-role').value        = ds.role;
    document.getElementById('edit-dept').value        = ds.dept;
    document.getElementById('edit-hourly-rate').value = ds.rate;
    document.getElementById('editEmployeeModal').style.display = 'flex';
}

// ปิด modal แก้ไขพนักงาน
function closeEditModal() {
    document.getElementById('editEmployeeModal').style.display = 'none';
}

// ============================================================
// SECTION 5 — รายงานเงินเดือน
// ============================================================

// โหลดรายงานเงินเดือนตามเดือนที่เลือก
async function loadSalaryReport() {
    try {
        const monthInput = document.getElementById('report-month')?.value;
        let url = `${API_URL}/salary-report`;
        if (monthInput) {
            const [y, m] = monthInput.split('-');
            url += `?year=${y}&month=${m}`;
        }

        const { data } = await axios.get(url, getAuthHeaders());
        const tbody     = document.getElementById('salary-report-body');

        // คำนวณ summary
        const totalPay  = data.reduce((s, e) => s + (e.totalPay || 0), 0);
        const totalWork = data.reduce((s, e) => s + (parseFloat(e.total_work_hours) || 0), 0);
        const totalOT   = data.reduce((s, e) => s + (parseFloat(e.total_ot_hours)   || 0), 0);

        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText('rpt-emp-count',  data.length);
        setText('rpt-total-pay',  new Intl.NumberFormat('th-TH').format(Math.round(totalPay)));
        setText('rpt-total-work', totalWork.toFixed(1));
        setText('rpt-total-ot',   totalOT.toFixed(1));

        if (tbody) {
            tbody.innerHTML = data.length
                ? data.map(renderSalaryRow).join('')
                : '<tr><td colspan="7" class="empty-row">ไม่พบข้อมูล</td></tr>';
        }

        drawWorkHoursChart(data);
    } catch (err) {
        console.error('โหลดรายงานพลาด:', err);
    }
}

// สร้าง HTML row สำหรับตารางรายงานเงินเดือน
function renderSalaryRow(emp) {
    const pay        = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(emp.totalPay || 0);
    const payColor   = (emp.totalPay || 0) > 0 ? 'var(--green)' : 'var(--text-light)';
    return `<tr>
        <td class="text-center fw-600 text-mid">${escapeHtml(emp.emp_id)}</td>
        <td>
            <div class="emp-name">${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</div>
            <div class="emp-sub">฿${parseFloat(emp.hourly_rate || 0).toFixed(0)}/ชม.</div>
        </td>
        <td class="text-center"><span class="badge-work">${parseFloat(emp.total_work_hours || 0).toFixed(2)}</span></td>
        <td class="text-center"><span class="badge-ot">${parseFloat(emp.total_ot_hours || 0).toFixed(2)}</span></td>
        <td class="text-center fw-700 text-red">${emp.sick_leaves || 0}</td>
        <td class="text-center fw-700 text-orange">${emp.personal_leaves || 0}</td>
        <td class="text-center"><span style="font-size:0.95rem;font-weight:800;color:${payColor};">${pay}</span></td>
    </tr>`;
}

// วาดกราฟชั่วโมงทำงาน
function drawWorkHoursChart(data) {
    const ctx = document.getElementById('workHoursChart');
    if (!ctx) return;
    if (workHoursChartInstance) workHoursChartInstance.destroy();

    workHoursChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels:   data.map(e => e.first_name),
            datasets: [
                {
                    label: 'ชม. ทำงานปกติ',
                    data:  data.map(e => parseFloat(e.total_work_hours) || 0),
                    backgroundColor: 'rgba(0,184,148,0.75)',
                    borderRadius: 6, borderSkipped: false,
                },
                {
                    label: 'ชม. OT',
                    data:  data.map(e => parseFloat(e.total_ot_hours) || 0),
                    backgroundColor: 'rgba(230,126,34,0.75)',
                    borderRadius: 6, borderSkipped: false,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend:  { position: 'top', labels: { usePointStyle: true, padding: 20 } },
                tooltip: {
                    backgroundColor: '#1e2d3d',
                    callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(2)} ชม.` }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#8e9eae' } },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#8e9eae' },
                    title: { display: true, text: 'จำนวนชั่วโมง', color: '#8e9eae' }
                }
            }
        }
    });
}

// Export ตารางเป็น CSV
function exportSalaryCSV() {
    const table = document.getElementById('salary-table');
    if (!table) { showToast('ไม่พบข้อมูลสำหรับดาวน์โหลด', 'warn'); return; }
    const month = document.getElementById('report-month').value || 'All';
    const rows  = Array.from(table.rows).map(r =>
        Array.from(r.cells).map(c => `"${c.innerText.replace(/,|฿/g, '').trim()}"`).join(',')
    );
    const link    = document.createElement('a');
    link.href     = URL.createObjectURL(new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Salary_Report_${month}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================
// SECTION 6 — ประกาศข่าวสาร
// ============================================================

// โหลดรายการประกาศทั้งหมด
async function loadAnnouncementsAdmin() {
    const list = document.getElementById('admin-announcement-list');
    if (!list) return;
    try {
        const { data } = await axios.get(`${API_URL}/announcements`, getAuthHeaders());
        if (!data.length) {
            list.innerHTML = '<div class="empty-row"><i class="fas fa-inbox"></i> ยังไม่มีประกาศในระบบ</div>';
            return;
        }
        list.innerHTML = data.map(renderAnnouncementItem).join('');
    } catch {
        list.innerHTML = '<p class="text-danger text-center p-16">โหลดข้อมูลผิดพลาด</p>';
    }
}

// สร้าง HTML สำหรับ item ประกาศ
function renderAnnouncementItem(item) {
    const date = new Date(item.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    return `<div class="announce-card">
        <div class="announce-card-header">
            <div class="announce-card-title">${escapeHtml(item.title)}</div>
            <span class="announce-card-date"><i class="far fa-clock"></i> ${date}</span>
        </div>
        <div class="announce-card-body">${escapeHtml(item.content)}</div>
        <button onclick="deleteAnnouncement(${item.id})" title="ลบประกาศ" class="btn-icon btn-icon-delete announce-delete-btn">
            <i class="fas fa-trash-alt"></i>
        </button>
    </div>`;
}

// ลบประกาศ
async function deleteAnnouncement(id) {
    if (!await showConfirm('ลบประกาศนี้ออกจากระบบ?', { title: 'ลบประกาศ', confirmText: 'ลบ', danger: true })) return;
    try {
        await axios.delete(`${API_URL}/announcements/${id}`, getAuthHeaders());
        showToast('ลบประกาศเรียบร้อยแล้ว', 'success');
        loadAnnouncementsAdmin();
    } catch {
        showToast('ลบไม่สำเร็จ', 'error');
    }
}

// ============================================================
// SECTION 7 — ประวัติการลาทั้งหมด
// ============================================================

// โหลดและแสดงประวัติการลาทั้งหมด
async function fetchAndRenderAllLeaveHistory() {
    try {
        const { data } = await axios.get(`${API_URL}/leave-history`, getAuthHeaders());
        allAdminLeaveRecords = data;
        currentAdminPage = 1;
        renderAdminLeaveTable();
    } catch (err) {
        console.error('โหลดประวัติไม่สำเร็จ:', err);
    }
}

// Render ตารางประวัติลา (รองรับ search และ pagination)
function renderAdminLeaveTable() {
    const tbody = document.getElementById('all-leave-history-body');
    if (!tbody) return;

    const term     = (document.getElementById('search-admin-leave')?.value || '').trim().toLowerCase();
    const filtered = term
        ? allAdminLeaveRecords.filter(item =>
            String(item.emp_id    || '').toLowerCase().includes(term) ||
            `${item.first_name || ''} ${item.last_name || ''}`.toLowerCase().includes(term) ||
            String(item.leave_type || '').toLowerCase().includes(term)
          )
        : allAdminLeaveRecords;

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">ไม่พบข้อมูลที่ค้นหา</td></tr>';
        renderPaginationButtons('admin-leave-pagination', 0, 1, () => {});
        return;
    }

    const ITEMS_PER_PAGE = 10;
    const totalPages     = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (currentAdminPage > totalPages || isNaN(currentAdminPage)) currentAdminPage = 1;

    const pageData = filtered.slice((currentAdminPage - 1) * ITEMS_PER_PAGE, currentAdminPage * ITEMS_PER_PAGE);
    tbody.innerHTML = pageData.map(renderLeaveHistoryRow).join('');
    renderPaginationButtons('admin-leave-pagination', totalPages, currentAdminPage, p => {
        currentAdminPage = p;
        renderAdminLeaveTable();
    });
}

// สร้าง HTML row สำหรับตารางประวัติลา
function renderLeaveHistoryRow(item) {
    const diff = calcDiffDays(item.start_date, item.end_date);
    const st   = STATUS_MAP[item.status] || STATUS_MAP.pending;
    return `<tr>
        <td class="text-center text-mid">${safeDate(item.created_at)}</td>
        <td>
            <div class="emp-name">${escapeHtml(item.emp_id || '-')}</div>
            <div class="emp-sub">${escapeHtml(item.first_name || '')} ${escapeHtml(item.last_name || '')}</div>
        </td>
        <td class="text-center"><span class="badge-type">${leaveLabelShort(item.leave_type)}</span></td>
        <td class="text-center text-sm text-blue lh-15">
            ${safeDate(item.start_date)}<br>
            <span class="text-light">ถึง</span> ${safeDate(item.end_date)}
        </td>
        <td class="text-center fw-700 text-dark">${diff} <span class="fw-400 text-light">วัน</span></td>
        <td class="text-center"><span class="badge ${st.cls}">${st.label}</span></td>
    </tr>`;
}

// ============================================================
// SECTION 8 — Navigation
// ============================================================

// สลับหน้าใน Dashboard
function switchPage(event, pageId, clickedLink) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    const page = document.getElementById(pageId);
    if (!page) return;

    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    page.classList.add('active');
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    if (clickedLink) clickedLink.classList.add('active');

    const pageActions = {
        'page-manage-employees': fetchAllEmployees,
        'page-report':           loadSalaryReport,
        'page-announcements':    loadAnnouncementsAdmin,
        'page-approve-leave':    () => {
            loadPendingLeaves();
            updateDashboardStats();
            fetchAndRenderAllLeaveHistory();
            fetchAllEmployees();
        },
    };
    pageActions[pageId]?.();
}

// ============================================================
// SECTION 9 — Init (DOMContentLoaded)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

    // แสดงชื่อ admin ใน sidebar
    const adminNameVal = localStorage.getItem('employeeName');
    if (adminNameVal) {
        const el = document.getElementById('admin-name');
        if (el) el.textContent = adminNameVal;
    }

    // ตั้งค่า default เดือนปัจจุบันใน report-month
    const rmEl = document.getElementById('report-month');
    if (rmEl && !rmEl.value) {
        const now = new Date();
        rmEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // โหลดข้อมูลทั้งหมดตอน init
    updateDashboardStats();
    loadDepartments();
    loadPendingLeaves();
    fetchAllEmployees();
    loadSalaryReport();
    loadAnnouncementsAdmin();
    fetchAndRenderAllLeaveHistory();

    // Form: เพิ่มพนักงาน
    document.getElementById('add-employee-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            emp_id:      document.getElementById('add-emp-id').value,
            password:    document.getElementById('add-password').value,
            first_name:  document.getElementById('add-first-name').value,
            last_name:   document.getElementById('add-last-name').value,
            role:        document.getElementById('add-role').value,
            dept_id:     document.getElementById('add-dept')?.value || null,
            hourly_rate: document.getElementById('add-hourly-rate').value || 0,
        };
        try {
            const res = await axios.post(`${API_URL}/employees/add`, body, getAuthHeaders());
            showToast(res.data.message, 'success');
            e.target.reset();
            fetchAllEmployees();
        } catch (err) {
            showToast(err.response?.data?.message || 'ไม่สามารถเพิ่มพนักงานได้', 'error');
        }
    });

    // Form: แก้ไขพนักงาน
    document.getElementById('edit-employee-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id   = document.getElementById('edit-emp-id').value;
        const body = {
            first_name:  document.getElementById('edit-first-name').value,
            last_name:   document.getElementById('edit-last-name').value,
            role:        document.getElementById('edit-role').value,
            dept_id:     document.getElementById('edit-dept').value,
            hourly_rate: document.getElementById('edit-hourly-rate').value,
        };
        try {
            await axios.put(`${API_URL}/employees/${id}`, body, getAuthHeaders());
            showToast('แก้ไขข้อมูลสำเร็จ', 'success');
            closeEditModal();
            fetchAllEmployees();
        } catch {
            showToast('เกิดข้อผิดพลาดในการแก้ไข', 'error');
        }
    });

    // Form: สร้างประกาศ
    document.getElementById('announcement-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title   = document.getElementById('announce-title').value;
        const content = document.getElementById('announce-content').value;
        try {
            await axios.post(`${API_URL}/announcements`, { title, content }, getAuthHeaders());
            showToast('เผยแพร่ประกาศสำเร็จ', 'success');
            e.target.reset();
            loadAnnouncementsAdmin();
        } catch {
            showToast('ไม่สามารถเผยแพร่ประกาศได้', 'error');
        }
    });

    // Search: ประวัติการลา
    document.getElementById('search-admin-leave')?.addEventListener('input', () => {
        currentAdminPage = 1;
        renderAdminLeaveTable();
    });

});