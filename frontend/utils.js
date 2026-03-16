// ============================================================
// utils.js — Shared utilities สำหรับทุกหน้า
// โหลดไฟล์นี้ก่อน home.js และ admin.js เสมอ
// ============================================================

// ── Config ───────────────────────────────────────────────────
const API_BASE = 'http://localhost:1304'; // แก้ที่นี่ที่เดียวถ้าเปลี่ยน host/port

// ── Constants ────────────────────────────────────────────────
const LEAVE_TYPE_LABELS = {
    sick:           'ลาป่วย',
    personal:       'ลากิจ',
    annual:         'ลาพักร้อน',
    'Sick Leave':   'ลาป่วย',
    'Personal Leave':'ลากิจ',
    'Annual Leave': 'ลาพักร้อน',
};

const LEAVE_TYPE_SHORT = {
    sick:           'ป่วย',
    personal:       'ลากิจ',
    annual:         'พักร้อน',
    'Sick Leave':   'ป่วย',
    'Personal Leave':'ลากิจ',
    'Annual Leave': 'พักร้อน',
};

const STATUS_MAP = {
    approved: { cls: 'badge-approved', label: 'อนุมัติแล้ว' },
    rejected: { cls: 'badge-rejected', label: 'ไม่อนุมัติ'  },
    pending:  { cls: 'badge-pending',  label: 'รอพิจารณา'   },
};

// ============================================================
// 🔑 AUTH
// ============================================================

/** คืน axios config object พร้อม Authorization header */
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

// ============================================================
// 🛡️ XSS PROTECTION
// ============================================================

/** Escape HTML entities ก่อน inject ลง innerHTML ทุกครั้ง */
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================
// 📅 DATE HELPERS
// ============================================================

/** แปลง dateStr เป็น วัน/เดือน/ปี ไทย — คืน '-' ถ้าข้อมูลไม่ถูกต้อง */
function safeDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH');
}

/** คำนวณจำนวนวันระหว่าง 2 วันที่ (รวมวันแรกและวันสุดท้าย) */
function calcDiffDays(startDate, endDate) {
    if (!startDate || !endDate) return '-';
    const s = new Date(startDate);
    const e = new Date(endDate);
    return Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1;
}

// ============================================================
// 🏷️ BADGE / LABEL HELPERS
// ============================================================

/** คืน HTML ของ badge สถานะใบลา */
function renderStatusBadge(status) {
    const s = STATUS_MAP[status] || STATUS_MAP.pending;
    return `<span class="badge ${s.cls}">${s.label}</span>`;
}

/** คืน label ชื่อประเภทการลา (เต็ม เช่น ลาป่วย) */
function leaveLabel(type) {
    return LEAVE_TYPE_LABELS[type] || type || '-';
}

/** คืน label ชื่อประเภทการลา (ย่อ เช่น ป่วย) */
function leaveLabelShort(type) {
    return LEAVE_TYPE_SHORT[type] || type || '-';
}

// ============================================================
// 📄 PAGINATION
// ============================================================

/**
 * วาดปุ่ม pagination ลงใน element ที่กำหนด
 * @param {string} containerId  — id ของ div ที่จะวางปุ่ม
 * @param {number} totalPages   — จำนวนหน้าทั้งหมด
 * @param {number} currentPage  — หน้าปัจจุบัน
 * @param {Function} onPageClick — callback รับ pageNumber เมื่อกด
 */
function renderPaginationButtons(containerId, totalPages, currentPage, onPageClick) {
    const div = document.getElementById(containerId);
    if (!div) return;
    div.innerHTML = '';
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent   = i;
        btn.style.cssText = `
            padding:5px 12px; border-radius:6px; font-size:0.8rem; font-weight:600;
            font-family:inherit; cursor:pointer; border:1px solid var(--border);
            background:${i === currentPage ? 'var(--green)' : 'var(--white)'};
            color:${i === currentPage ? '#fff' : 'var(--text-mid)'};
            transition:all 0.15s;
        `;
        btn.addEventListener('click', () => onPageClick(i));
        div.appendChild(btn);
    }
}

// ============================================================
// 🔔 TOAST NOTIFICATION
// ============================================================
(function initToast() {
    const style = document.createElement('style');
    style.textContent = `
        #toast-container{position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none}
        .toast{display:flex;align-items:center;gap:12px;padding:13px 18px;border-radius:12px;font-size:.86rem;font-weight:600;font-family:'Segoe UI','Noto Sans Thai',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.14);min-width:260px;max-width:380px;pointer-events:all;animation:toastIn .3s ease;transition:opacity .3s,transform .3s}
        .toast.hide{opacity:0;transform:translateX(20px)}
        .toast-success{background:#e8f8f4;color:#00744e;border:1px solid #a3e4d7}
        .toast-error  {background:#fdecea;color:#c0392b;border:1px solid #f5c6cb}
        .toast-info   {background:#eaf4fb;color:#1a5276;border:1px solid #aed6f1}
        .toast-warn   {background:#fef9e7;color:#7d6608;border:1px solid #f9e79f}
        .toast i{font-size:1.1em;flex-shrink:0}
        .toast-close{margin-left:auto;background:none;border:none;cursor:pointer;opacity:.5;font-size:1rem;color:inherit;padding:0;line-height:1}
        .toast-close:hover{opacity:1}
        @keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    `;
    document.head.appendChild(style);
    const c  = document.createElement('div');
    c.id     = 'toast-container';
    document.body.appendChild(c);
})();

/**
 * แสดง toast notification
 * @param {string} msg       — ข้อความ
 * @param {'success'|'error'|'info'|'warn'} type
 * @param {number} duration  — มิลลิวินาที (default 3500)
 */
function showToast(msg, type = 'success', duration = 3500) {
    const icons = {
        success: 'fas fa-check-circle',
        error:   'fas fa-times-circle',
        info:    'fas fa-info-circle',
        warn:    'fas fa-exclamation-triangle',
    };
    const t       = document.createElement('div');
    t.className   = `toast toast-${type}`;
    t.innerHTML   = `<i class="${icons[type] || icons.info}"></i><span style="flex:1">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 320); }, duration);
}

// ============================================================
// ❓ CONFIRM DIALOG
// ============================================================
(function initConfirmStyle() {
    const style = document.createElement('style');
    style.textContent = `
        .confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99998;display:flex;align-items:center;justify-content:center}
        .confirm-box{background:#fff;border-radius:14px;padding:28px;width:340px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.18);font-family:'Segoe UI','Noto Sans Thai',sans-serif;text-align:center}
        .confirm-box .cb-icon{font-size:2rem;margin-bottom:12px}
        .confirm-box h4{font-size:1rem;font-weight:700;color:#1e2d3d;margin-bottom:8px}
        .confirm-box p{font-size:.84rem;color:#5a6a7a;margin-bottom:22px}
        .confirm-box .cb-btns{display:flex;gap:10px;justify-content:center}
        .cb-btn{padding:10px 24px;border:none;border-radius:8px;font-size:.86rem;font-weight:700;font-family:inherit;cursor:pointer;transition:all .15s}
        .cb-btn-confirm{background:#00b894;color:#fff;box-shadow:0 3px 10px rgba(0,184,148,.3)}
        .cb-btn-confirm:hover{background:#00916e}
        .cb-btn-cancel{background:#f0f2f5;color:#5a6a7a}
        .cb-btn-cancel:hover{background:#e0e4e8}
        .cb-btn-danger{background:#e74c3c;color:#fff;box-shadow:0 3px 10px rgba(231,76,60,.3)}
        .cb-btn-danger:hover{background:#c0392b}
    `;
    document.head.appendChild(style);
})();

/**
 * แสดง confirm dialog — คืน Promise<boolean>
 * @param {string} msg
 * @param {object} opts — { title, confirmText, cancelText, danger }
 */
function showConfirm(msg, { title = 'ยืนยันการดำเนินการ', confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', danger = false } = {}) {
    return new Promise(resolve => {
        const ov      = document.createElement('div');
        ov.className  = 'confirm-overlay';
        ov.innerHTML  = `
            <div class="confirm-box">
                <div class="cb-icon">${danger ? '🗑️' : '❓'}</div>
                <h4>${title}</h4>
                <p>${msg}</p>
                <div class="cb-btns">
                    <button class="cb-btn cb-btn-cancel">${cancelText}</button>
                    <button class="cb-btn ${danger ? 'cb-btn-danger' : 'cb-btn-confirm'}">${confirmText}</button>
                </div>
            </div>`;
        document.body.appendChild(ov);

        // stopPropagation + stopImmediatePropagation ป้องกัน event bubble กลับไปที่ปุ่มเดิม
        ov.querySelector('.cb-btn-cancel').addEventListener('click', (e) => {
            e.stopPropagation(); e.stopImmediatePropagation();
            ov.remove(); resolve(false);
        });
        ov.querySelector(`.${danger ? 'cb-btn-danger' : 'cb-btn-confirm'}`).addEventListener('click', (e) => {
            e.stopPropagation(); e.stopImmediatePropagation();
            ov.remove(); resolve(true);
        });

        // กัน click ที่ overlay background ด้วย
        ov.addEventListener('click', (e) => {
            if (e.target === ov) { e.stopPropagation(); ov.remove(); resolve(false); }
        });
    });
}