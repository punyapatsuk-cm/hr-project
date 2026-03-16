// ============================================================
// home.js — หน้าพนักงาน
// ต้องโหลด utils.js ก่อนไฟล์นี้เสมอ
// ============================================================

// ── State (top-level ได้เพราะเป็นแค่ตัวแปร ไม่แตะ DOM) ──────
let allLeaveRecords  = [];
let currentLeavePage = 1;
const leaveItemsPerPage = 10;

// ── ตรวจสอบ login (ต้องทำก่อน DOM ก็ได้) ─────────────────
const employeeName = localStorage.getItem('employeeName');
const empId        = localStorage.getItem('employeeId');
if (!employeeName || !empId) window.location.replace('login.html');

// ============================================================
// 🚀 DOMContentLoaded — ผูก event ทั้งหมดที่นี่ที่เดียว
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

    // ── ตั้งค่า UI ──────────────────────────────────────────
    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.innerText = val; };
    setEl('welcome-msg',  'ยินดีต้อนรับเข้าสู่ระบบ คุณ ' + employeeName);
    setEl('sidebar-name', 'คุณ ' + employeeName);
    setEl('topbar-name',  employeeName);
    const _av = document.getElementById('sidebar-avatar');
    if (_av) _av.textContent = employeeName.charAt(0).toUpperCase();

    // ── นาฬิกา ───────────────────────────────────────────────
    updateClock();
    setInterval(updateClock, 1000);

    // ── โหลด Dashboard เริ่มต้น ──────────────────────────────
    loadEmployeeDashboard();

    // ── ปุ่มเข้างาน ──────────────────────────────────────────
    const btnIn = document.getElementById('btn-clock-in');
    if (btnIn) {
        btnIn.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();
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
    }

    // ── ปุ่มเลิกงาน ──────────────────────────────────────────
    const btnOut = document.getElementById('btn-clock-out');
    if (btnOut) {
        btnOut.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();
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
    }

    // ── ฟอร์มขอลางาน ─────────────────────────────────────────
    const leaveForm = document.getElementById('leave-form');
    if (leaveForm) {
        leaveForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            e.stopPropagation();
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
            fd.append('emp_id', empId);
            fd.append('leave_type', leaveType);
            fd.append('start_date', startDate);
            fd.append('end_date', endDate);
            fd.append('reason', reason);
            if (file) fd.append('attachment', file);

            const btn = e.target.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังส่ง...'; }

            try {
                const token = localStorage.getItem('token');
                const res = await axios.post(`${API_BASE}/api/leave/request`, fd, {
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
    }

    // ── ช่องค้นหาประวัติลา ──────────────────────────────────
    const searchEl = document.getElementById('search-leave');
    if (searchEl) searchEl.addEventListener('input', () => { currentLeavePage = 1; renderLeaveTable(); });

}); // end DOMContentLoaded

// ============================================================
// 🧭 Navigation (global เพราะ HTML เรียก onclick=)
// ============================================================
function closeAlert() {
    const box = document.getElementById('welcomeBox');
    if (!box) return;
    box.style.opacity = '0';
    setTimeout(() => { box.style.display = 'none'; }, 300);
}

async function logout() {
    if (await showConfirm('คุณต้องการออกจากระบบ?', { title: 'ออกจากระบบ' })) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

function switchPage(event, pageId, clickedLink) {
    // preventDefault ต้องมาก่อนสุด — ถ้า crash ทีหลัง href="#" จะไม่ทำงาน
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

// ============================================================
// ⏰ นาฬิกา
// ============================================================
function updateClock() {
    const now = new Date();
    const t = document.getElementById('current-time');
    const d = document.getElementById('current-date');
    if (t) t.innerText = now.toLocaleTimeString('th-TH');
    if (d) d.innerText = now.toLocaleDateString('th-TH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

function updateTimelineStatus(state) {
    const tl = document.getElementById('timeline-status-text');
    const st = document.getElementById('attendance-status');
    if (!tl) return;
    const now = new Date().toLocaleTimeString('th-TH', { hour12: false });
    if (state === 'in') {
        tl.innerHTML = `<span style="color:#00a86b;font-weight:bold;">✅ กำลังทำงานอยู่</span><br><span style="font-size:0.85em;color:#7f8c8d;">เข้างานเมื่อ ${now}</span>`;
        if (st) { st.innerText = 'สถานะ: ✅ บันทึกเข้างานสำเร็จ'; st.style.color = 'green'; }
    } else if (state === 'out') {
        tl.innerHTML = `<span style="color:#e74c3c;font-weight:bold;">🏃 เลิกงานแล้ว</span><br><span style="font-size:0.85em;color:#7f8c8d;">ออกงานเมื่อ ${now}</span>`;
        if (st) { st.innerText = 'สถานะ: ✅ บันทึกเลิกงานสำเร็จ'; st.style.color = '#e74c3c'; }
    } else {
        tl.innerText = 'รอการบันทึกเวลา...';
        if (st) { st.innerText = 'รอการบันทึกเวลา'; st.style.color = '#e67e22'; }
    }
}

// ============================================================
// 📰 ข่าวสาร & โปรไฟล์
// ============================================================
async function loadAnnouncements() {
    const c = document.getElementById('announcement-container');
    if (!c) return;
    try {
        const { data } = await axios.get(`${API_BASE}/api/admin/announcements`, getAuthHeaders());
        if (!data.length) {
            c.innerHTML = '<div class="card"><p style="text-align:center;color:#999;">ขณะนี้ยังไม่มีประกาศใหม่</p></div>';
            return;
        }
        c.innerHTML = data.map(item => {
            const dateStr = new Date(item.created_at).toLocaleString('th-TH', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
            return `<div class="announce-item">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">
                    <div class="announce-item-title">${escapeHtml(item.title)}</div>
                    <span style="background:#fff3cd;color:#9c6000;font-size:0.7rem;font-weight:600;padding:3px 10px;border-radius:20px;white-space:nowrap;flex-shrink:0;">
                        <i class="far fa-calendar-alt"></i> ${dateStr}
                    </span>
                </div>
                <div class="announce-item-body" style="white-space:pre-line;">${escapeHtml(item.content)}</div>
            </div>`;
        }).join('');
    } catch {
        c.innerHTML = '<div class="card"><p style="color:red;">❌ ไม่สามารถโหลดประกาศได้ในขณะนี้</p></div>';
    }
}

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
    } catch (err) { console.error('Profile Load Error', err); }
}

// ============================================================
// 📊 Dashboard
// ============================================================
async function loadEmployeeDashboard() {
    if (!empId) return;
    try {
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

        const { data: leaves } = await axios.get(`${API_BASE}/api/leave/history/${empId}`, getAuthHeaders());
        const tbody = document.getElementById('dash-recent-leave-body');
        if (tbody) {
            tbody.innerHTML = !leaves.length
                ? '<tr><td colspan="3" style="padding:20px;color:#999;">ยังไม่มีประวัติการลางาน</td></tr>'
                : leaves.slice(0, 3).map(l => {
                    const s = new Date(l.start_date).toLocaleDateString('th-TH');
                    const e = new Date(l.end_date).toLocaleDateString('th-TH');
                    return `<tr>
                        <td style="font-weight:700;color:var(--text-dark);">${leaveLabel(l.leave_type)}</td>
                        <td style="text-align:center;color:var(--text-mid);font-size:0.84rem;">${s === e ? s : `${s} – ${e}`}</td>
                        <td style="text-align:center;">${renderStatusBadge(l.status)}</td>
                    </tr>`;
                }).join('');
        }

        const { data: salary } = await axios.get(`${API_BASE}/api/employee/payslip/${empId}`, getAuthHeaders());
        const payDiv = document.getElementById('dash-payslip-info');
        const payBtn = document.getElementById('btn-view-payslip');
        if (!payDiv || !payBtn) return;

        if (!salary || !salary.totalPay) {
            payDiv.innerHTML = `<i class="fas fa-box-open" style="font-size:3em;color:#ecf0f1;margin-bottom:10px;"></i><p style="margin:0;color:#7f8c8d;">ยังไม่มีสลิปเงินเดือนในระบบ</p>`;
        } else {
            const month  = new Date().toLocaleDateString('th-TH', { month:'long', year:'numeric' });
            const netPay = new Intl.NumberFormat('th-TH', { style:'currency', currency:'THB' }).format(salary.totalPay);
            payDiv.innerHTML = `
                <div style="background:#f8f9fa;padding:20px;border-radius:12px;width:100%;box-sizing:border-box;border:1px dashed #ccc;">
                    <p style="margin:0 0 5px;color:#7f8c8d;font-size:0.9em;">รอบการจ่ายเงิน</p>
                    <h4 style="margin:0 0 15px;color:#2c3e50;font-size:1.2em;">${month}</h4>
                    <p style="margin:0;color:#7f8c8d;font-size:0.85em;">ยอดรับสุทธิ</p>
                    <h2 id="secret-salary" style="margin:5px 0 0;color:#27ae60;letter-spacing:2px;">฿ ** *** **</h2>
                </div>`;
            payBtn.disabled = false;
            payBtn.style.background = '#27ae60';
            payBtn.style.color = 'white';
            payBtn.innerHTML = '<i class="fas fa-lock-open"></i> กดเพื่อปลดล็อคดูยอดเงิน';
            let unlocked = false;
            payBtn.onclick = () => {
                const el = document.getElementById('secret-salary');
                if (!unlocked) {
                    el.innerText = netPay; el.style.letterSpacing = '0px';
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
    } catch (err) { console.error('โหลดข้อมูล Dashboard พนักงานพลาด:', err); }
}

// ============================================================
// 🕐 ประวัติการลงเวลา
// ============================================================
async function loadAttendanceHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    try {
        const { data } = await axios.get(`${API_BASE}/api/attendance/history/${empId}`, getAuthHeaders());
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;">ยังไม่มีประวัติการลงเวลา</td></tr>';
            updateTodaySummary(0, 0);
            return;
        }
        const todayStr = new Date().toLocaleDateString('th-TH');
        let wk = 0, ot = 0;
        tbody.innerHTML = data.map(r => {
            const d  = r.work_date      ? new Date(r.work_date).toLocaleDateString('th-TH') : '-';
            const i  = r.check_in_time  ? new Date(r.check_in_time).toLocaleTimeString('th-TH', { hour12: false }) : '-';
            const o  = r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString('th-TH', { hour12: false }) : 'ยังไม่เลิกงาน';
            const wh = r.work_hours != null ? `${r.work_hours} ชม.` : '-';
            const oh = r.ot_hours != null && r.ot_hours > 0 ? `${r.ot_hours} ชม.` : '-';
            if (d === todayStr) { wk += parseFloat(r.work_hours) || 0; ot += parseFloat(r.ot_hours) || 0; }
            return `<tr>
                <td style="text-align:center;font-weight:600;">${d}</td>
                <td style="text-align:center;color:var(--green);font-weight:600;">${i}</td>
                <td style="text-align:center;color:${r.check_out_time ? '#e74c3c' : '#e67e22'};font-weight:600;">${o}</td>
                <td style="text-align:center;color:#3498db;font-weight:600;">${wh}</td>
                <td style="text-align:center;color:#e67e22;font-weight:600;">${oh}</td>
            </tr>`;
        }).join('');
        updateTodaySummary(wk, ot);
    } catch {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;color:red;">ไม่สามารถโหลดประวัติได้</td></tr>';
    }
}

function updateTodaySummary(w, o) {
    const el = document.getElementById('today-work-summary');
    if (!el) return;
    const t = w + o;
    const p = Math.min((w / 8) * 100, 100).toFixed(0);
    const c = w >= 8 ? '#27ae60' : w >= 4 ? '#f39c12' : '#e74c3c';
    el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px 18px 0;">
            <div style="background:var(--green-light);border-radius:var(--radius-sm);padding:14px 16px;text-align:center;border:1px solid #a9dfbf;">
                <div style="font-size:0.72rem;font-weight:700;color:var(--green-dark);text-transform:uppercase;margin-bottom:4px;">ชม. ทำงานปกติ</div>
                <div style="font-size:1.6rem;font-weight:800;color:var(--green);">${w.toFixed(2)}</div>
                <div style="font-size:0.72rem;color:var(--text-light);margin-top:2px;">ชั่วโมง</div>
            </div>
            <div style="background:#fef9e7;border-radius:var(--radius-sm);padding:14px 16px;text-align:center;border:1px solid #f9e79f;">
                <div style="font-size:0.72rem;font-weight:700;color:#a04000;text-transform:uppercase;margin-bottom:4px;">ชม. OT</div>
                <div style="font-size:1.6rem;font-weight:800;color:#e67e22;">${o.toFixed(2)}</div>
                <div style="font-size:0.72rem;color:var(--text-light);margin-top:2px;">ชั่วโมง</div>
            </div>
            <div style="background:#eaf4fb;border-radius:var(--radius-sm);padding:14px 16px;text-align:center;border:1px solid #aed6f1;">
                <div style="font-size:0.72rem;font-weight:700;color:#1a5276;text-transform:uppercase;margin-bottom:4px;">รวมทั้งหมด</div>
                <div style="font-size:1.6rem;font-weight:800;color:#2980b9;">${t.toFixed(2)}</div>
                <div style="font-size:0.72rem;color:var(--text-light);margin-top:2px;">ชั่วโมง</div>
            </div>
        </div>
        <div style="padding:12px 18px 0;">
            <div style="font-size:0.75rem;color:var(--text-mid);font-weight:600;margin-bottom:6px;">ความคืบหน้าวันนี้ (เป้าหมาย 8 ชม.)</div>
            <div style="background:#eef0f3;border-radius:10px;height:8px;overflow:hidden;">
                <div style="width:${p}%;background:${c};height:100%;border-radius:10px;transition:width 0.6s ease;"></div>
            </div>
            <div style="text-align:right;font-size:0.75rem;font-weight:700;color:${c};margin-top:4px;">${p}%</div>
        </div>`;
}

// ============================================================
// 🏖️ ประวัติการลางาน
// ============================================================
async function loadLeaveHistory() {
    if (!empId) return;
    try {
        const { data } = await axios.get(`${API_BASE}/api/leave/history/${empId}`, getAuthHeaders());
        allLeaveRecords = data;
        currentLeavePage = 1;
        renderLeaveTable();
    } catch {
        const tb = document.getElementById('leave-history-body');
        if (tb) tb.innerHTML = '<tr><td colspan="4" style="padding:20px;color:red;text-align:center;">ไม่สามารถโหลดประวัติได้</td></tr>';
    }
}

function renderLeaveTable() {
    const tbody = document.getElementById('leave-history-body');
    if (!tbody) return;
    const term = (document.getElementById('search-leave')?.value || '').toLowerCase();
    const filtered = allLeaveRecords.filter(r => {
        const type   = leaveLabel(r.leave_type);
        const status = r.status === 'pending' ? 'รออนุมัติ' : r.status === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ';
        return type.includes(term) || status.includes(term);
    });
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:20px;text-align:center;">ไม่พบข้อมูล</td></tr>';
        renderPaginationButtons('leave-pagination', 0, 1, () => {});
        return;
    }
    const total = Math.ceil(filtered.length / leaveItemsPerPage);
    if (currentLeavePage > total) currentLeavePage = total;
    tbody.innerHTML = filtered
        .slice((currentLeavePage - 1) * leaveItemsPerPage, currentLeavePage * leaveItemsPerPage)
        .map(r => `<tr>
            <td style="text-align:center;font-weight:600;">${leaveLabel(r.leave_type)}</td>
            <td style="text-align:center;color:var(--text-mid);">${safeDate(r.start_date)}</td>
            <td style="text-align:center;color:var(--text-mid);">${safeDate(r.end_date)}</td>
            <td style="text-align:center;">${renderStatusBadge(r.status)}</td>
        </tr>`).join('');
    renderPaginationButtons('leave-pagination', total, currentLeavePage, p => { currentLeavePage = p; renderLeaveTable(); });
}

// ============================================================
// 🩹 Leave Form Helpers (global เพราะ HTML เรียก onclick=)
// ============================================================
function selectLeavePill(el, val) {
    document.querySelectorAll('.lf-pill').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('leave-type').value = val;
}

function handleLeaveFile(input) {
    const el = document.getElementById('lf-file-text');
    if (el && input.files?.[0]) {
        el.textContent      = '📎 ' + input.files[0].name;
        el.style.color      = '#185FA5';
        el.style.fontWeight = 'bold';
    }
}