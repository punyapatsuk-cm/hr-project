let allLeaveRecords  = [];
let currentLeavePage = 1;
const LEAVE_ITEMS_PER_PAGE = 10;

// ── ตรวจสอบ login ──
const employeeName = localStorage.getItem('employeeName');
const empId        = localStorage.getItem('employeeId');
if (!employeeName || !empId) window.location.replace('login.html');

document.addEventListener('DOMContentLoaded', () => {

    // ตั้งค่า UI แสดงชื่อพนักงาน
    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.innerText = val; };
    setEl('welcome-msg',  'ยินดีต้อนรับเข้าสู่ระบบ คุณ ' + employeeName);
    setEl('sidebar-name', 'คุณ ' + employeeName);
    setEl('topbar-name',  employeeName);
    const avatar = document.getElementById('sidebar-avatar');
    if (avatar) avatar.textContent = employeeName.charAt(0).toUpperCase();

    updateClock();
    setInterval(updateClock, 1000);

    loadEmployeeDashboard();

    // ── ปุ่มเข้างาน ──
    document.getElementById('btn-clock-in')?.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        const statusEl = document.getElementById('attendance-status');
        if (statusEl) { statusEl.innerText = 'กำลังบันทึก...'; statusEl.style.color = '#007bff'; }
        try {
            const res = await axios.post(`${API_BASE}/api/attendance/clock-in`, { emp_id: empId }, getAuthHeaders());
            updateTimelineStatus('in');
            showToast(res.data.message, 'success');
            loadAttendanceHistory();
        } catch (err) {
            const msg = err.response?.data?.message || 'ไม่สามารถเชื่อมต่อได้';
            if (statusEl) { statusEl.innerText = 'เกิดข้อผิดพลาด: ' + msg; statusEl.style.color = 'red'; }
            showToast(msg, 'error');
        }
    });

    // ── ปุ่มเลิกงาน ──
    document.getElementById('btn-clock-out')?.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!await showConfirm('บันทึกเวลาเลิกงาน?', { title: 'ยืนยันเลิกงาน' })) return;
        try {
            const res = await axios.post(`${API_BASE}/api/attendance/clock-out`, { emp_id: empId }, getAuthHeaders());
            updateTimelineStatus('out');
            showToast(res.data.message, 'success');
            loadAttendanceHistory();
        } catch (err) {
            showToast(err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error');
        }
    });

    // ── ฟอร์มขอลางาน ──
    document.getElementById('leave-form')?.addEventListener('submit', async (e) => {
        e.preventDefault(); e.stopPropagation();

        const leaveType = { sick:'sick', personal:'personal', annual:'annual' }[document.getElementById('leave-type').value];
        const startDate = document.getElementById('leave-start').value;
        const endDate   = document.getElementById('leave-end').value;
        const reason    = document.getElementById('leave-reason').value;
        const file      = document.getElementById('leave-attachment')?.files[0];

        if (!leaveType)                              return showToast('กรุณาเลือกประเภทการลา', 'warn');
        if (!startDate || !endDate)                  return showToast('กรุณาเลือกวันที่', 'warn');
        if (!reason.trim())                          return showToast('กรุณาระบุเหตุผล', 'warn');
        if (new Date(endDate) < new Date(startDate)) return showToast('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น', 'warn');

        const fd = new FormData();
        fd.append('emp_id', empId); fd.append('leave_type', leaveType);
        fd.append('start_date', startDate); fd.append('end_date', endDate);
        fd.append('reason', reason);
        if (file) fd.append('attachment', file);

        const btn = e.target.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังส่ง...'; }

        try {
            const token = localStorage.getItem('token');
            const res   = await axios.post(`${API_BASE}/api/leave/request`, fd, {
                headers: { 'Content-Type': 'multipart/form-data', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
            });
            showToast(res.data.message, 'success');
            e.target.reset();
            document.querySelectorAll('.lf-pill').forEach(p => p.classList.remove('selected'));
            document.getElementById('leave-type').value = '';
            const ft = document.getElementById('lf-file-text');
            if (ft) { ft.textContent = 'คลิกหรือลากไฟล์มาวางที่นี่'; ft.style.color = ''; }
            loadLeaveHistory();
        } catch (err) {
            showToast(err.response?.data?.message || 'ไม่สามารถเชื่อมต่อได้', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> ยืนยันการขอลางาน'; }
        }
    });

    // ── ช่องค้นหาประวัติลา ──
    document.getElementById('search-leave')?.addEventListener('input', () => {
        currentLeavePage = 1;
        renderLeaveTable();
    });

});

// ปิด welcome banner
function closeAlert() {
    const box = document.getElementById('welcomeBox');
    if (!box) return;
    box.style.opacity = '0';
    setTimeout(() => { box.style.display = 'none'; }, 300);
}

// ออกจากระบบ
async function logout() {
    if (await showConfirm('คุณต้องการออกจากระบบ?', { title: 'ออกจากระบบ' })) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// สลับหน้าใน Dashboard
function switchPage(event, pageId, clickedLink) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const page = document.getElementById(pageId);
    if (!page) return;
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    page.classList.add('active');
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    if (clickedLink) clickedLink.classList.add('active');
    ({
        'page-dashboard': loadEmployeeDashboard,
        'page-news':      loadAnnouncements,
        'page-profile':   loadUserProfile,
        'page-schedule':  loadAttendanceHistory,
        'page-leave':     loadLeaveHistory,
    })[pageId]?.();
}

// อัปเดตเวลาและวันที่แบบ real-time
function updateClock() {
    const now = new Date();
    const t = document.getElementById('current-time');
    const d = document.getElementById('current-date');
    if (t) t.innerText = now.toLocaleTimeString('th-TH');
    if (d) d.innerText = now.toLocaleDateString('th-TH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// อัปเดตสถานะ timeline หลัง clock-in/out
function updateTimelineStatus(state) {
    const tl  = document.getElementById('timeline-status-text');
    const st  = document.getElementById('attendance-status');
    if (!tl) return;
    const now = new Date().toLocaleTimeString('th-TH', { hour12: false });
    if (state === 'in') {
        tl.innerHTML = `<span class="tl-status-in">✅ กำลังทำงานอยู่</span><br><span class="tl-status-sub">เข้างานเมื่อ ${now}</span>`;
        if (st) { st.innerText = 'สถานะ: ✅ บันทึกเข้างานสำเร็จ'; st.style.color = 'green'; }
    } else if (state === 'out') {
        tl.innerHTML = `<span class="tl-status-out">🏃 เลิกงานแล้ว</span><br><span class="tl-status-sub">ออกงานเมื่อ ${now}</span>`;
        if (st) { st.innerText = 'สถานะ: ✅ บันทึกเลิกงานสำเร็จ'; st.style.color = '#e74c3c'; }
    } else {
        tl.innerText = 'รอการบันทึกเวลา...';
        if (st) { st.innerText = 'รอการบันทึกเวลา'; st.style.color = '#e67e22'; }
    }
}

// ข่าวสาร & โปรไฟล์

// โหลดและแสดงประกาศข่าวสารจาก Admin
async function loadAnnouncements() {
    const c = document.getElementById('announcement-container');
    if (!c) return;
    try {
        const { data } = await axios.get(`${API_BASE}/api/admin/announcements`, getAuthHeaders());
        if (!data.length) {
            c.innerHTML = '<div class="card"><p class="text-center text-muted">ขณะนี้ยังไม่มีประกาศใหม่</p></div>';
            return;
        }
        c.innerHTML = data.map(item => {
            const dateStr = new Date(item.created_at).toLocaleString('th-TH', {
                year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'
            });
            return `<div class="announce-item">
                <div class="announce-item-header">
                    <div class="announce-item-title">${escapeHtml(item.title)}</div>
                    <span class="announce-item-date"><i class="far fa-calendar-alt"></i> ${dateStr}</span>
                </div>
                <div class="announce-item-body">${escapeHtml(item.content)}</div>
            </div>`;
        }).join('');
    } catch {
        c.innerHTML = '<div class="card"><p class="text-danger">❌ ไม่สามารถโหลดประกาศได้ในขณะนี้</p></div>';
    }
}

// โหลดข้อมูลโปรไฟล์พนักงาน
async function loadUserProfile() {
    try {
        const { data: u } = await axios.get(`${API_BASE}/api/employee/profile/${empId}`, getAuthHeaders());
        const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.innerText = val; };
        setEl('profile-emp-id',      u.emp_id);
        setEl('profile-full-name',   `${u.first_name} ${u.last_name}`);
        setEl('profile-dept',        u.dept_name || 'ไม่ได้ระบุแผนก');
        setEl('profile-role',        u.role === 'admin' ? 'HR / ผู้ดูแลระบบ' : 'พนักงานทั่วไป');
        setEl('profile-hourly-rate', `฿${u.hourly_rate || 0} / ชั่วโมง`);
        setEl('profile-sick',        u.sick_leave_remaining     ?? 0);
        setEl('profile-personal',    u.personal_leave_remaining ?? 0);
        setEl('profile-annual',      u.annual_leave_remaining   ?? 0);
    } catch (err) {
        console.error('Profile Load Error:', err);
    }
}

// โหลดข้อมูล Dashboard: โควตาลา, ประวัติลาล่าสุด, สลิปเงินเดือน
async function loadEmployeeDashboard() {
    if (!empId) return;
    try {
        // โควตาวันลา
        const { data: emp } = await axios.get(`${API_BASE}/api/employee/profile/${empId}`, getAuthHeaders());
        if (emp) {
            const sR = emp.sick_leave_remaining     ?? 30;
            const pR = emp.personal_leave_remaining ?? 6;
            const aR = emp.annual_leave_remaining   ?? 6;
            const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.innerText = val; };
            const setW  = (id, val) => { const e = document.getElementById(id); if (e) e.style.width = val; };
            setEl('dash-sick-used',     30 - sR); setEl('dash-sick-remain',     sR); setW('dash-sick-progress',     `${((30-sR)/30)*100}%`);
            setEl('dash-personal-used', 6  - pR); setEl('dash-personal-remain', pR); setW('dash-personal-progress', `${((6-pR)/6)*100}%`);
            setEl('dash-annual-used',   6  - aR); setEl('dash-annual-remain',   aR); setW('dash-annual-progress',   `${((6-aR)/6)*100}%`);
        }

        // ประวัติลาล่าสุด 3 รายการ
        const { data: leaves } = await axios.get(`${API_BASE}/api/leave/history/${empId}`, getAuthHeaders());
        const tbody = document.getElementById('dash-recent-leave-body');
        if (tbody) {
            tbody.innerHTML = !leaves.length
                ? '<tr><td colspan="3" class="empty-row">ยังไม่มีประวัติการลางาน</td></tr>'
                : leaves.slice(0, 3).map(l => {
                    const s = safeDate(l.start_date);
                    const e = safeDate(l.end_date);
                    return `<tr>
                        <td class="fw-700 text-dark">${leaveLabel(l.leave_type)}</td>
                        <td class="text-center text-mid text-sm">${s === e ? s : `${s} – ${e}`}</td>
                        <td class="text-center">${renderStatusBadge(l.status)}</td>
                    </tr>`;
                }).join('');
        }

        // สลิปเงินเดือน
        const { data: salary } = await axios.get(`${API_BASE}/api/employee/payslip/${empId}`, getAuthHeaders());
        const payDiv = document.getElementById('dash-payslip-info');
        const payBtn = document.getElementById('btn-view-payslip');
        if (!payDiv || !payBtn) return;

        if (!salary || !salary.totalPay) {
            payDiv.innerHTML = `<i class="fas fa-box-open payslip-empty-icon"></i><p class="payslip-empty-text">ยังไม่มีสลิปเงินเดือนในระบบ</p>`;
        } else {
            const month  = new Date().toLocaleDateString('th-TH', { month:'long', year:'numeric' });
            const netPay = new Intl.NumberFormat('th-TH', { style:'currency', currency:'THB' }).format(salary.totalPay);
            payDiv.innerHTML = `
                <div class="payslip-preview">
                    <p class="payslip-period-label">รอบการจ่ายเงิน</p>
                    <h4 class="payslip-period">${month}</h4>
                    <p class="payslip-net-label">ยอดรับสุทธิ</p>
                    <h2 id="secret-salary" class="payslip-amount">฿ ** *** **</h2>
                </div>`;
            payBtn.disabled = false;
            payBtn.style.cssText = 'background:#27ae60;color:white;';
            payBtn.innerHTML = '<i class="fas fa-lock-open"></i> กดเพื่อปลดล็อคดูยอดเงิน';
            let unlocked = false;
            payBtn.onclick = () => {
                const el = document.getElementById('secret-salary');
                if (!unlocked) {
                    el.innerText = netPay; el.style.letterSpacing = '0';
                    payBtn.innerHTML = '<i class="fas fa-eye-slash"></i> ซ่อนยอดเงิน';
                    payBtn.style.background = '#e74c3c';
                } else {
                    el.innerText = '฿ ** *** **'; el.style.letterSpacing = '2px';
                    payBtn.innerHTML = '<i class="fas fa-lock-open"></i> กดเพื่อปลดล็อคดูยอดเงิน';
                    payBtn.style.background = '#27ae60';
                }
                unlocked = !unlocked;
            };
        }
    } catch (err) {
        console.error('โหลดข้อมูล Dashboard พนักงานพลาด:', err);
    }
}

// โหลดประวัติลงเวลา 30 วันล่าสุด
async function loadAttendanceHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    try {
        const { data } = await axios.get(`${API_BASE}/api/attendance/history/${empId}`, getAuthHeaders());
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-row">ยังไม่มีประวัติการลงเวลา</td></tr>';
            updateTodaySummary(0, 0);
            return;
        }
        const todayStr = new Date().toLocaleDateString('th-TH');
        let wk = 0, ot = 0;
        tbody.innerHTML = data.map(r => {
            const d  = r.work_date      ? new Date(r.work_date).toLocaleDateString('th-TH')                        : '-';
            const ci = r.check_in_time  ? new Date(r.check_in_time).toLocaleTimeString('th-TH',  { hour12: false }) : '-';
            const co = r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString('th-TH', { hour12: false }) : 'ยังไม่เลิกงาน';
            const wh = r.work_hours != null ? `${r.work_hours} ชม.` : '-';
            const oh = r.ot_hours != null && r.ot_hours > 0 ? `${r.ot_hours} ชม.` : '-';
            if (d === todayStr) { wk += parseFloat(r.work_hours) || 0; ot += parseFloat(r.ot_hours) || 0; }
            const coColor = r.check_out_time ? '#e74c3c' : '#e67e22';
            return `<tr>
                <td class="text-center fw-600">${d}</td>
                <td class="text-center fw-600 text-green">${ci}</td>
                <td class="text-center fw-600" style="color:${coColor}">${co}</td>
                <td class="text-center fw-600 text-blue">${wh}</td>
                <td class="text-center fw-600 text-orange">${oh}</td>
            </tr>`;
        }).join('');
        updateTodaySummary(wk, ot);
    } catch {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row text-danger">ไม่สามารถโหลดประวัติได้</td></tr>';
    }
}

// แสดง summary ชั่วโมงทำงานวันนี้
function updateTodaySummary(w, o) {
    const el = document.getElementById('today-work-summary');
    if (!el) return;
    const t = w + o;
    const p = Math.min((w / 8) * 100, 100).toFixed(0);
    const c = w >= 8 ? '#27ae60' : w >= 4 ? '#f39c12' : '#e74c3c';
    el.innerHTML = `
        <div class="today-summary-grid">
            <div class="today-summary-card summary-work">
                <div class="summary-label">ชม. ทำงานปกติ</div>
                <div class="summary-value">${w.toFixed(2)}</div>
                <div class="summary-unit">ชั่วโมง</div>
            </div>
            <div class="today-summary-card summary-ot">
                <div class="summary-label">ชม. OT</div>
                <div class="summary-value">${o.toFixed(2)}</div>
                <div class="summary-unit">ชั่วโมง</div>
            </div>
            <div class="today-summary-card summary-total">
                <div class="summary-label">รวมทั้งหมด</div>
                <div class="summary-value">${t.toFixed(2)}</div>
                <div class="summary-unit">ชั่วโมง</div>
            </div>
        </div>
        <div class="today-progress-wrap">
            <div class="today-progress-label">ความคืบหน้าวันนี้ (เป้าหมาย 8 ชม.)</div>
            <div class="today-progress-bar">
                <div style="width:${p}%;background:${c};height:100%;border-radius:10px;transition:width 0.6s ease;"></div>
            </div>
            <div class="today-progress-pct" style="color:${c}">${p}%</div>
        </div>`;
}

// โหลดประวัติการลางานทั้งหมดของพนักงาน
async function loadLeaveHistory() {
    if (!empId) return;
    try {
        const { data } = await axios.get(`${API_BASE}/api/leave/history/${empId}`, getAuthHeaders());
        allLeaveRecords  = data;
        currentLeavePage = 1;
        renderLeaveTable();
    } catch {
        const tb = document.getElementById('leave-history-body');
        if (tb) tb.innerHTML = '<tr><td colspan="4" class="empty-row text-danger">ไม่สามารถโหลดประวัติได้</td></tr>';
    }
}

// Render ตารางประวัติลา
function renderLeaveTable() {
    const tbody = document.getElementById('leave-history-body');
    if (!tbody) return;
    const term = (document.getElementById('search-leave')?.value || '').toLowerCase();
    const filtered = allLeaveRecords.filter(r => {
        const type   = leaveLabel(r.leave_type);
        const status = { pending:'รออนุมัติ', approved:'อนุมัติแล้ว', rejected:'ไม่อนุมัติ' }[r.status] || '';
        return type.includes(term) || status.includes(term);
    });
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row">ไม่พบข้อมูล</td></tr>';
        renderPaginationButtons('leave-pagination', 0, 1, () => {});
        return;
    }
    const total = Math.ceil(filtered.length / LEAVE_ITEMS_PER_PAGE);
    if (currentLeavePage > total) currentLeavePage = total;
    tbody.innerHTML = filtered
        .slice((currentLeavePage - 1) * LEAVE_ITEMS_PER_PAGE, currentLeavePage * LEAVE_ITEMS_PER_PAGE)
        .map(r => `<tr>
            <td class="text-center fw-600">${leaveLabel(r.leave_type)}</td>
            <td class="text-center text-mid">${safeDate(r.start_date)}</td>
            <td class="text-center text-mid">${safeDate(r.end_date)}</td>
            <td class="text-center">${renderStatusBadge(r.status)}</td>
        </tr>`).join('');
    renderPaginationButtons('leave-pagination', total, currentLeavePage, p => {
        currentLeavePage = p;
        renderLeaveTable();
    });
}

// เลือกประเภทการลาผ่าน pill button
function selectLeavePill(el, val) {
    document.querySelectorAll('.lf-pill').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('leave-type').value = val;
}

// แสดงชื่อไฟล์ที่เลือกแนบ
function handleLeaveFile(input) {
    const el = document.getElementById('lf-file-text');
    if (el && input.files?.[0]) {
        el.textContent      = '📎 ' + input.files[0].name;
        el.style.color      = '#185FA5';
        el.style.fontWeight = 'bold';
    }
}