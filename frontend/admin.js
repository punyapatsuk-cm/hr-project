// ============================================================
// admin.js — หน้า HR Admin
// ต้องโหลด utils.js ก่อนไฟล์นี้เสมอ
// ============================================================

// ── ตรวจสอบสิทธิ์ ─────────────────────────────────────────
const adminEmpId = localStorage.getItem('employeeId');
const adminRole  = localStorage.getItem('userRole');
if (!adminEmpId || adminRole !== 'admin') window.location.href = 'login.html';

const API_URL = `${API_BASE}/api/admin`;

// ── State ────────────────────────────────────────────────────
let allAdminLeaveRecords = [];
let currentAdminPage     = 1;
let workHoursChartInstance = null;

// ============================================================
// 🏢 1. แผนก
// ============================================================
async function loadDepartments() {
    try {
        const { data } = await axios.get(`${API_URL}/departments`, getAuthHeaders());
        const opts = ['<option value="">— ไม่ระบุแผนก —</option>',
            ...data.map(d => `<option value="${escapeHtml(d.dept_id||d.id)}">${escapeHtml(d.dept_name||d.name)}</option>`)
        ].join('');
        const addDept  = document.getElementById('add-dept');
        const editDept = document.getElementById('edit-dept');
        if (addDept)  addDept.innerHTML  = opts;
        if (editDept) editDept.innerHTML = opts;
    } catch (err) { console.error('โหลดแผนกไม่ได้', err); }
}

// ============================================================
// 📝 2. ใบลางาน (รอพิจารณา)
// ============================================================
async function loadPendingLeaves() {
    const tbody = document.getElementById('admin-leave-table-body');
    if (!tbody) return;
    try {
        const { data } = await axios.get(`${API_URL}/leaves/pending`, getAuthHeaders());
        if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" style="padding:20px;color:green;text-align:center;">🎉 ไม่มีรายการรอดำเนินการ</td></tr>'; return; }

        tbody.innerHTML = data.map(leave => {
            const start    = new Date(leave.start_date);
            const end      = new Date(leave.end_date);
            const diffDays = calcDiffDays(leave.start_date, leave.end_date);
            const attach   = leave.attachment
                ? `<a href="${API_BASE}/uploads/${encodeURIComponent(leave.attachment)}" target="_blank" style="color:#007bff;text-decoration:none;">📄 ดูเอกสาร</a>`
                : '-';
            return `<tr>
                <td style="text-align:center;font-weight:600;color:var(--text-mid);">${escapeHtml(leave.emp_id)}</td>
                <td><div class="emp-name">${escapeHtml(leave.first_name)} ${escapeHtml(leave.last_name)}</div></td>
                <td style="text-align:center;">
                    <span class="badge badge-pending">${leaveLabel(leave.leave_type)}</span>
                    <div style="font-size:0.72rem;color:var(--text-light);margin-top:3px;">${diffDays} วัน</div>
                </td>
                <td style="font-size:0.82rem;color:var(--text-mid);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(leave.reason||'-')}</td>
                <td style="text-align:center;font-size:0.82rem;color:#2176ae;line-height:1.6;">${start.toLocaleDateString('th-TH')}<br><span style="color:var(--text-light);font-size:0.72rem;">ถึง</span><br>${end.toLocaleDateString('th-TH')}</td>
                <td style="text-align:center;">${attach}</td>
                <td style="text-align:center;">
                    <div class="actions-cell" style="flex-direction:column;gap:6px;">
                        <button class="btn btn-primary" style="font-size:0.78rem;padding:6px 14px;justify-content:center;"
                            onclick="handleLeaveAction(${leave.leave_id},'${escapeHtml(leave.emp_id)}','${leave.leave_type}','approved',${diffDays})">
                            <i class="fas fa-check"></i> อนุมัติ</button>
                        <button class="btn btn-danger" style="font-size:0.78rem;padding:6px 14px;justify-content:center;"
                            onclick="handleLeaveAction(${leave.leave_id},'${escapeHtml(leave.emp_id)}','${leave.leave_type}','rejected',${diffDays})">
                            <i class="fas fa-times"></i> ปฏิเสธ</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (err) { console.error('Load Leaves Error:', err); }
}

async function handleLeaveAction(leaveId, eid, leaveType, status, days) {
    const label = status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ';
    if (!await showConfirm(`ยืนยันการ <b>${label}</b> ใบลานี้?`, { title:`${label}ใบลางาน`, confirmText:label, danger:status==='rejected' })) return;
    try {
        const res = await axios.put(`${API_URL}/leaves/update-status`, { leave_id:leaveId, status }, getAuthHeaders());
        showToast(res.data.message, 'success');
        loadPendingLeaves(); updateDashboardStats(); fetchAndRenderAllLeaveHistory();
    } catch (err) { showToast(err.response?.data?.message||'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'error'); }
}

// ============================================================
// 📊 3. Dashboard Stats
// ============================================================
async function updateDashboardStats() {
    try {
        const { data: s } = await axios.get(`${API_URL}/dashboard-stats`, getAuthHeaders());
        document.getElementById('widget-total').innerText    = s.total    || 0;
        document.getElementById('widget-pending').innerText  = s.pending  || 0;
        document.getElementById('widget-approved').innerText = s.approved || 0;
        document.getElementById('widget-rejected').innerText = s.rejected || 0;
    } catch (err) { console.error('Error updating stats:', err); }
}

function scrollToTable() {
    document.getElementById('admin-leave-table-body')?.scrollIntoView({ behavior:'smooth' });
}

// ============================================================
// 👥 4. จัดการพนักงาน
// ============================================================
async function fetchAllEmployees() {
    const empTb  = document.getElementById('employee-list-body');
    const quotTb = document.getElementById('quota-list-body');
    if (!empTb || !quotTb) return;
    try {
        const { data } = await axios.get(`${API_URL}/employees/all`, getAuthHeaders());
        empTb.innerHTML = quotTb.innerHTML = '';
        data.forEach(emp => {
            const badge = emp.role==='admin'
                ? '<span class="badge badge-admin">🛡️ HR / Admin</span>'
                : '<span class="badge badge-user">👤 พนักงานทั่วไป</span>';
            empTb.innerHTML += `<tr>
                <td style="text-align:center;font-weight:600;color:var(--text-mid);">${escapeHtml(emp.emp_id)}</td>
                <td>
                    <div class="emp-name">${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</div>
                    <div class="emp-sub">${escapeHtml(emp.dept_name||'ไม่ระบุแผนก')} | เรท: ฿${parseFloat(emp.hourly_rate||0).toFixed(2)}/ชม.</div>
                </td>
                <td style="text-align:center;">${badge}</td>
                <td style="text-align:center;">
                    <div class="actions-cell">
                        <button class="btn-icon btn-icon-edit" title="แก้ไข"
                            data-id="${escapeHtml(emp.emp_id)}" data-fname="${escapeHtml(emp.first_name)}"
                            data-lname="${escapeHtml(emp.last_name)}" data-role="${escapeHtml(emp.role)}"
                            data-dept="${escapeHtml(emp.dept_id||'')}" data-rate="${emp.hourly_rate||0}"
                            onclick="openEditModal(this.dataset)"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-icon-delete" title="ลบ"
                            onclick="deleteEmployee('${escapeHtml(emp.emp_id)}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
            quotTb.innerHTML += `<tr>
                <td style="text-align:center;font-weight:600;font-size:0.78rem;color:var(--text-mid);">${escapeHtml(emp.emp_id)}</td>
                <td><div style="font-weight:600;font-size:0.82rem;">${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</div></td>
                <td style="text-align:center;font-weight:700;color:#e74c3c;">${emp.sick_leave_remaining     ?? 0}</td>
                <td style="text-align:center;font-weight:700;color:#e67e22;">${emp.personal_leave_remaining ?? 0}</td>
                <td style="text-align:center;font-weight:700;color:var(--green);">${emp.annual_leave_remaining   ?? 0}</td>
            </tr>`;
        });
    } catch (err) { console.error(err); }
}

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
        showToast(res.data.message, 'success'); e.target.reset(); fetchAllEmployees();
    } catch (err) { showToast(err.response?.data?.message||'ไม่สามารถเพิ่มพนักงานได้', 'error'); }
});

async function deleteEmployee(id) {
    if (!await showConfirm(`ลบพนักงาน <b>${id}</b> ออกจากระบบ?`, { title:'ลบพนักงาน', confirmText:'ลบ', danger:true })) return;
    try {
        await axios.delete(`${API_URL}/employees/${id}`, getAuthHeaders());
        showToast('ลบพนักงานเรียบร้อยแล้ว', 'success'); fetchAllEmployees();
    } catch { showToast('ลบข้อมูลไม่สำเร็จ', 'error'); }
}

function openEditModal(ds) {
    document.getElementById('edit-emp-id').value      = ds.id;
    document.getElementById('edit-first-name').value  = ds.fname;
    document.getElementById('edit-last-name').value   = ds.lname;
    document.getElementById('edit-role').value        = ds.role;
    document.getElementById('edit-dept').value        = ds.dept;
    document.getElementById('edit-hourly-rate').value = ds.rate;
    document.getElementById('editEmployeeModal').style.display = 'flex';
}

function closeEditModal() { document.getElementById('editEmployeeModal').style.display = 'none'; }

document.getElementById('edit-employee-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-emp-id').value;
    const body = {
        first_name:  document.getElementById('edit-first-name').value,
        last_name:   document.getElementById('edit-last-name').value,
        role:        document.getElementById('edit-role').value,
        dept_id:     document.getElementById('edit-dept').value,
        hourly_rate: document.getElementById('edit-hourly-rate').value,
    };
    try {
        await axios.put(`${API_URL}/employees/${id}`, body, getAuthHeaders());
        showToast('แก้ไขข้อมูลสำเร็จ', 'success'); closeEditModal(); fetchAllEmployees();
    } catch { showToast('เกิดข้อผิดพลาดในการแก้ไข', 'error'); }
});

// ============================================================
// 💰 5. รายงานเงินเดือน
// ============================================================
async function loadSalaryReport() {
    try {
        const monthInput = document.getElementById('report-month')?.value;
        let url = `${API_URL}/salary-report`;
        if (monthInput) { const [y,m] = monthInput.split('-'); url += `?year=${y}&month=${m}`; }

        const { data }  = await axios.get(url, getAuthHeaders());
        const tbody     = document.getElementById('salary-report-body');
        const totalPay  = data.reduce((s,e) => s+(e.totalPay||0), 0);
        const totalWork = data.reduce((s,e) => s+(parseFloat(e.total_work_hours)||0), 0);
        const totalOT   = data.reduce((s,e) => s+(parseFloat(e.total_ot_hours)||0), 0);

        const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
        set('rpt-emp-count',  data.length);
        set('rpt-total-pay',  new Intl.NumberFormat('th-TH').format(Math.round(totalPay)));
        set('rpt-total-work', totalWork.toFixed(1));
        set('rpt-total-ot',   totalOT.toFixed(1));

        if (tbody) {
            tbody.innerHTML = data.length ? '' : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-light);">ไม่พบข้อมูล</td></tr>';
            data.forEach(emp => {
                const pay = new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(emp.totalPay||0);
                tbody.innerHTML += `<tr>
                    <td style="text-align:center;font-weight:600;color:var(--text-mid);">${escapeHtml(emp.emp_id)}</td>
                    <td><div class="emp-name">${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</div><div class="emp-sub">฿${parseFloat(emp.hourly_rate||0).toFixed(0)}/ชม.</div></td>
                    <td style="text-align:center;"><span style="background:#eaf4fb;color:#2176ae;padding:3px 10px;border-radius:20px;font-weight:700;font-size:0.82rem;">${parseFloat(emp.total_work_hours||0).toFixed(2)}</span></td>
                    <td style="text-align:center;"><span style="background:#fef3e2;color:#a04000;padding:3px 10px;border-radius:20px;font-weight:700;font-size:0.82rem;">${parseFloat(emp.total_ot_hours||0).toFixed(2)}</span></td>
                    <td style="text-align:center;font-weight:700;color:#e74c3c;">${emp.sick_leaves||0}</td>
                    <td style="text-align:center;font-weight:700;color:#e67e22;">${emp.personal_leaves||0}</td>
                    <td style="text-align:center;"><span style="font-size:0.95rem;font-weight:800;color:${(emp.totalPay||0)>0?'var(--green)':'var(--text-light)'};">${pay}</span></td>
                </tr>`;
            });
        }
        drawWorkHoursChart(data);
    } catch (err) { console.error('โหลดรายงานพลาด:', err); }
}

function drawWorkHoursChart(data) {
    const ctx = document.getElementById('workHoursChart');
    if (!ctx) return;
    if (workHoursChartInstance) workHoursChartInstance.destroy();
    workHoursChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(e => e.first_name),
            datasets: [
                { label:'ชม. ทำงานปกติ', data:data.map(e=>parseFloat(e.total_work_hours)||0), backgroundColor:'rgba(0,184,148,0.75)', borderColor:'#00b894', borderWidth:0, borderRadius:6, borderSkipped:false },
                { label:'ชม. OT',        data:data.map(e=>parseFloat(e.total_ot_hours)||0),   backgroundColor:'rgba(230,126,34,0.75)', borderColor:'#e67e22', borderWidth:0, borderRadius:6, borderSkipped:false }
            ]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins: {
                legend: { position:'top', labels:{ font:{size:12,family:"'Segoe UI',sans-serif"}, usePointStyle:true, pointStyleWidth:10, padding:20 } },
                tooltip: { backgroundColor:'#1e2d3d', titleFont:{size:12}, bodyFont:{size:12}, padding:10, cornerRadius:8, callbacks:{ label:c=>` ${c.dataset.label}: ${c.parsed.y.toFixed(2)} ชม.` } }
            },
            scales: {
                x: { grid:{display:false}, ticks:{font:{size:11},color:'#8e9eae'} },
                y: { beginAtZero:true, grid:{color:'#f0f4f7',lineWidth:1}, border:{dash:[4,4]}, ticks:{font:{size:11},color:'#8e9eae'}, title:{display:true,text:'จำนวนชั่วโมง',color:'#8e9eae',font:{size:11}} }
            }
        }
    });
}

function exportSalaryCSV() {
    const table = document.getElementById('salary-table');
    if (!table) { showToast('ไม่พบข้อมูลสำหรับดาวน์โหลด','warn'); return; }
    const month = document.getElementById('report-month').value || 'All';
    const rows  = Array.from(table.rows).map(r => Array.from(r.cells).map(c=>`"${c.innerText.replace(/,/g,'').replace(/฿/g,'').trim()}"`).join(','));
    const link  = document.createElement('a');
    link.href     = URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\n')], {type:'text/csv;charset=utf-8;'}));
    link.download = `Salary_Report_${month}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ============================================================
// 📢 6. ประกาศข่าวสาร
// ============================================================
async function loadAnnouncementsAdmin() {
    const list = document.getElementById('admin-announcement-list');
    if (!list) return;
    try {
        const { data } = await axios.get(`${API_URL}/announcements`, getAuthHeaders());
        if (!data.length) {
            list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-light);"><i class="fas fa-inbox" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:10px;"></i>ยังไม่มีประกาศในระบบ</div>`;
            return;
        }
        list.innerHTML = data.map(item => {
            const date = new Date(item.created_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
            return `<div style="background:#f8fafc;border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;border-left:4px solid #e67e22;margin-bottom:10px;position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px;">
                    <div style="font-weight:700;font-size:0.9rem;color:var(--text-dark);padding-right:36px;">${escapeHtml(item.title)}</div>
                    <span style="background:#fff3cd;color:#9c6000;font-size:0.7rem;font-weight:600;padding:2px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0;"><i class="far fa-clock"></i> ${date}</span>
                </div>
                <div style="font-size:0.82rem;color:var(--text-mid);line-height:1.6;white-space:pre-line;">${escapeHtml(item.content)}</div>
                <button onclick="deleteAnnouncement(${item.id})" title="ลบประกาศ" class="btn-icon btn-icon-delete" style="position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:7px;"><i class="fas fa-trash-alt" style="font-size:0.72em;"></i></button>
            </div>`;
        }).join('');
    } catch { list.innerHTML = '<p style="color:#e74c3c;text-align:center;padding:16px;">โหลดข้อมูลผิดพลาด</p>'; }
}

async function deleteAnnouncement(id) {
    if (!await showConfirm('ลบประกาศนี้ออกจากระบบ?', {title:'ลบประกาศ', confirmText:'ลบ', danger:true})) return;
    try {
        await axios.delete(`${API_URL}/announcements/${id}`, getAuthHeaders());
        showToast('ลบประกาศเรียบร้อยแล้ว','success'); loadAnnouncementsAdmin();
    } catch { showToast('ลบไม่สำเร็จ','error'); }
}

// ============================================================
// 🏖️ 7. ประวัติการลาทั้งหมด
// ============================================================
async function fetchAndRenderAllLeaveHistory() {
    try {
        const { data } = await axios.get(`${API_URL}/leave-history`, getAuthHeaders());
        allAdminLeaveRecords = data; currentAdminPage = 1; renderAdminLeaveTable();
    } catch (err) { console.error('โหลดประวัติไม่สำเร็จ:', err); }
}

function renderAdminLeaveTable() {
    const tbody = document.getElementById('all-leave-history-body');
    if (!tbody) return;
    const term = (document.getElementById('search-admin-leave')?.value||'').trim().toLowerCase();

    let filtered = term
        ? allAdminLeaveRecords.filter(item => item && (
            String(item.emp_id||'').toLowerCase().includes(term) ||
            `${item.first_name||''} ${item.last_name||''}`.toLowerCase().includes(term) ||
            String(item.leave_type||'').toLowerCase().includes(term)
          ))
        : allAdminLeaveRecords;

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:20px;text-align:center;color:red;">ไม่พบข้อมูลที่ค้นหา</td></tr>';
        renderPaginationButtons('admin-leave-pagination', 0, 1, ()=>{});
        return;
    }

    const itemsPerPage = 10;
    const totalPages   = Math.ceil(filtered.length/itemsPerPage);
    if (currentAdminPage > totalPages || isNaN(currentAdminPage)) currentAdminPage = 1;

    try {
        tbody.innerHTML = filtered.slice((currentAdminPage-1)*itemsPerPage, currentAdminPage*itemsPerPage).map(item => {
            const diff = calcDiffDays(item.start_date, item.end_date);
            const st   = STATUS_MAP[item.status] || STATUS_MAP.pending;
            return `<tr>
                <td style="text-align:center;color:var(--text-mid);">${safeDate(item.created_at)}</td>
                <td style="overflow:hidden;">
                    <div class="emp-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.emp_id||'-')}</div>
                    <div class="emp-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.first_name||'')} ${escapeHtml(item.last_name||'')}</div>
                </td>
                <td style="text-align:center;"><span style="background:#f0f4f7;color:var(--text-mid);padding:3px 9px;border-radius:6px;font-size:0.78rem;font-weight:600;white-space:nowrap;">${leaveLabelShort(item.leave_type)}</span></td>
                <td style="text-align:center;color:#2176ae;font-size:0.82rem;line-height:1.5;">${safeDate(item.start_date)}<br><span style="color:var(--text-light);">ถึง</span> ${safeDate(item.end_date)}</td>
                <td style="text-align:center;font-weight:700;color:var(--text-dark);">${diff} <span style="font-weight:400;color:var(--text-light);">วัน</span></td>
                <td style="text-align:center;"><span class="badge ${st.cls}">${st.label}</span></td>
            </tr>`;
        }).join('');
        renderPaginationButtons('admin-leave-pagination', totalPages, currentAdminPage, p => { currentAdminPage=p; renderAdminLeaveTable(); });
    } catch (err) { console.error('Render Table Error:', err); }
}

document.getElementById('search-admin-leave')?.addEventListener('input', () => {
    currentAdminPage = 1; renderAdminLeaveTable();
});

// ============================================================
// 🧭 8. Navigation
// ============================================================
function switchPage(event, pageId, clickedLink) {
    if (event) event.preventDefault();
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    if (clickedLink) clickedLink.classList.add('active');
    ({ 'page-manage-employees': fetchAllEmployees,
       'page-report':           loadSalaryReport,
       'page-announcements':    loadAnnouncementsAdmin,
       'page-approve-leave':    () => { loadPendingLeaves(); updateDashboardStats(); fetchAndRenderAllLeaveHistory(); }
    })[pageId]?.();
}

// ============================================================
// 🚀 9. Init
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // แสดงชื่อ admin ใน sidebar
    const adminNameVal = localStorage.getItem('employeeName');
    if (adminNameVal) { const el = document.getElementById('admin-name'); if (el) el.textContent = adminNameVal; }

    // ตั้งค่า default เดือนปัจจุบันใน report-month
    const rmEl = document.getElementById('report-month');
    if (rmEl && !rmEl.value) {
        const now = new Date();
        rmEl.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    }

    updateDashboardStats(); loadDepartments(); loadPendingLeaves();
    fetchAllEmployees(); loadSalaryReport(); loadAnnouncementsAdmin();
    fetchAndRenderAllLeaveHistory();

    document.getElementById('announcement-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title   = document.getElementById('announce-title').value;
        const content = document.getElementById('announce-content').value;
        try {
            await axios.post(`${API_URL}/announcements`, { title, content }, getAuthHeaders());
            showToast('เผยแพร่ประกาศสำเร็จ','success'); e.target.reset(); loadAnnouncementsAdmin();
        } catch { showToast('ไม่สามารถเผยแพร่ประกาศได้','error'); }
    });
});