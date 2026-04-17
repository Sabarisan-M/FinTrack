// ════════════════════════════════════════════════════
//  FinTrack – Loan Management System
//  app.js  |  All bugs fixed
// ════════════════════════════════════════════════════

// ── Storage Keys ─────────────────────────────────────
const DB_KEY    = 'fintrack_data';
const COL_KEY   = 'fintrack_collections';
const ADMIN_KEY = 'fintrack_admins';

// ── Load / Save ───────────────────────────────────────
function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    customers: [
      { id:'C001', name:'Ramesh Kumar',  phone:'98765-43210', area:'Anna Nagar', type:'DL', amount:50000, interest:5000, duration:100, paid:62, status:'active',  startDate:'2025-01-01', notes:'' },
      { id:'C002', name:'Priya Devi',    phone:'91234-56789', area:'T. Nagar',   type:'WL', amount:30000, interest:3600, duration:4,   paid:2,  status:'active',  startDate:'2025-02-01', notes:'' },
      { id:'C003', name:'Arjun Selvam',  phone:'94567-12345', area:'Velachery',  type:'DL', amount:20000, interest:2000, duration:60,  paid:60, status:'active',  startDate:'2025-01-15', notes:'' },
      { id:'C004', name:'Meena Rajan',   phone:'87654-32109', area:'Adyar',      type:'ML', amount:80000, interest:6400, duration:12,  paid:8,  status:'active',  startDate:'2025-01-01', notes:'' },
      { id:'C005', name:'Vikram Anand',  phone:'99001-23456', area:'Porur',      type:'DL', amount:25000, interest:2500, duration:80,  paid:30, status:'overdue', startDate:'2025-01-10', notes:'' },
      { id:'C006', name:'Selvi Murugan', phone:'96543-21098', area:'Tambaram',   type:'WL', amount:40000, interest:4800, duration:8,   paid:3,  status:'overdue', startDate:'2025-02-10', notes:'' },
    ]
  };
}

function saveData() {
  localStorage.setItem(DB_KEY, JSON.stringify(appData));
}

function loadCollections() {
  try {
    const raw = localStorage.getItem(COL_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

function saveCollections() {
  localStorage.setItem(COL_KEY, JSON.stringify(allCollections));
}

// ── Admin Management ──────────────────────────────────
function loadAdmins() {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  // Default admin — only used if nothing is stored yet
  const defaults = [
    { username: 'admin', displayName: 'Admin', password: 'admin123', role: 'Super Admin', createdOn: '2025-01-01' }
  ];
  // Save immediately so it persists
  localStorage.setItem(ADMIN_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveAdmins() {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(allAdmins));
}

// ── App State ─────────────────────────────────────────
let appData        = loadData();
let customers      = appData.customers;
let allCollections = loadCollections();
let allAdmins      = loadAdmins();
let currentUser    = null;

let currentCustomer = null;
let colFilter       = 'all';
let reportTab       = 'DL';
let editMode        = false;

// ── Utility Helpers ──────────────────────────────────
function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function fmt(n) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function typeLabel(t) {
  return t === 'DL' ? '<span class="badge badge-dl">DL Daily</span>'
       : t === 'WL' ? '<span class="badge badge-wl">WL Weekly</span>'
       :               '<span class="badge badge-ml">ML Monthly</span>';
}

function statusBadge(s) {
  return s === 'active'  ? '<span class="badge badge-active">Active</span>'
       : s === 'overdue' ? '<span class="badge badge-overdue">Overdue</span>'
       :                   '<span class="badge badge-closed">Closed</span>';
}

// ── Business Logic ────────────────────────────────────
function totalDays(c) {
  if (!c.duration) return 0;
  if (c.type === 'DL') return c.duration;
  if (c.type === 'WL') return c.duration * 7;
  return c.duration * 30;
}

function totalInstallments(c) {
  return c.duration || 0;
}

function dueAmount(c) {
  const inst = totalInstallments(c);
  if (!inst) return 0;
  return Math.round(c.amount / inst);
}

function amountGivenToCustomer(c) {
  return c.amount - (c.interest || 0);
}

function interestRates(c) {
  const td = totalDays(c);
  if (!c.amount || !td) return { daily: '0.0000', monthly: '0.00' };
  const ratio   = (c.interest || 0) / c.amount;
  const daily   = (ratio / td * 100).toFixed(4);
  const monthly = (ratio * 30 / td * 100).toFixed(2);
  return { daily, monthly };
}

function interestRatePct(c) {
  const td = totalDays(c);
  if (!c.amount || !td) return '0.00%';
  const ratio = (c.interest || 0) / c.amount;
  return (ratio * 100).toFixed(2) + '%';
}

function calcEndDate(c) {
  if (!c.startDate) return '—';
  const td = totalDays(c);
  if (!td) return '—';
  const d = new Date(c.startDate + 'T00:00:00');
  d.setDate(d.getDate() + td);
  return d.toISOString().split('T')[0];
}

function remainingBalance(c) {
  const inst = totalInstallments(c);
  if (!inst) return c.amount;
  const paidAmt = (c.amount / inst) * c.paid;
  return Math.max(0, Math.round(c.amount - paidAmt));
}

function durationLabel(c) {
  if (c.type === 'DL') return c.duration + ' days';
  if (c.type === 'WL') return c.duration + ' weeks (' + totalDays(c) + ' days)';
  return c.duration + ' months (' + totalDays(c) + ' days)';
}

function instLabel(c) {
  if (c.type === 'DL') return 'Daily Installment';
  if (c.type === 'WL') return 'Weekly Installment';
  return 'Monthly Installment';
}

function getTodayCollection() {
  return allCollections[todayKey()] || {};
}

// ── LOGIN ────────────────────────────────────────────
function doLogin() {
  const u   = document.getElementById('login-user').value.trim();
  const p   = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');

  if (!u || !p) {
    err.style.display = 'block';
    err.textContent   = '⚠️ Please enter username and password';
    return;
  }

  // Always reload admins fresh from storage
  allAdmins = loadAdmins();

  const admin = allAdmins.find(a => a.username === u && a.password === p);
  if (admin) {
    currentUser = admin;
    err.style.display = 'none';
    document.getElementById('page-login').style.display = 'none';
    document.getElementById('page-app').style.display   = 'flex';

    document.getElementById('sidebar-avatar').textContent   = admin.displayName.charAt(0).toUpperCase();
    document.getElementById('sidebar-username').textContent = admin.displayName;
    document.getElementById('sidebar-role').textContent     = admin.role;

    initApp();
  } else {
    err.style.display = 'block';
    err.textContent   = '❌ Invalid username or password';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-pass').focus();
  }
}

function doLogout() {
  currentUser = null;
  document.getElementById('page-app').style.display   = 'none';
  document.getElementById('page-login').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
}

// ── NAVIGATION ───────────────────────────────────────
function showSection(sec, navEl) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('sec-' + sec);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  if (sec === 'collection')     renderCollection();
  if (sec === 'customers')      renderCustomers(customers.filter(c => c.status !== 'closed'));
  if (sec === 'reports')        { document.getElementById('report-date').valueAsDate = new Date(); loadReport(); }
  if (sec === 'dashboard')      renderDashboard();
  if (sec === 'closed')         renderClosed();
  if (sec === 'admins')         renderAdmins();
}

// ── INIT ─────────────────────────────────────────────
function initApp() {
  const now  = new Date();
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  document.getElementById('dash-date').textContent  = now.toLocaleDateString('en-IN', opts);
  document.getElementById('today-date').textContent = now.toLocaleDateString('en-IN', opts);

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById('nav-dashboard').classList.add('active');
  document.getElementById('sec-dashboard').classList.add('active');

  renderDashboard();
}

// ── DASHBOARD ────────────────────────────────────────
function renderDashboard() {
  const active      = customers.filter(c => c.status !== 'closed');
  const overdue     = customers.filter(c => c.status === 'overdue');
  const outstanding = active.reduce((s, c) => s + remainingBalance(c), 0);

  const todayData  = getTodayCollection();
  const todayTotal = Object.values(todayData).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  document.getElementById('dash-active').textContent =
    active.length;
  document.getElementById('dash-active-sub').textContent =
    active.filter(c => c.type === 'DL').length + ' Daily · ' +
    active.filter(c => c.type === 'WL').length + ' Weekly · ' +
    active.filter(c => c.type === 'ML').length + ' Monthly';
  document.getElementById('dash-outstanding').textContent = fmt(outstanding);
  document.getElementById('dash-today').textContent       = fmt(todayTotal);
  document.getElementById('dash-overdue').textContent     = overdue.length;

  const tbody         = document.getElementById('dash-recent');
  const recentEntries = [];
  const keys = Object.keys(allCollections).sort().reverse().slice(0, 7);

  keys.forEach(date => {
    const dayData = allCollections[date];
    Object.entries(dayData).forEach(([cid, amt]) => {
      const c = customers.find(x => x.id === cid);
      if (c && parseFloat(amt) > 0)
        recentEntries.push({ date, name: c.name, type: c.type, amt: parseFloat(amt) });
    });
  });

  recentEntries.sort((a, b) => b.date.localeCompare(a.date));

  tbody.innerHTML = recentEntries.slice(0, 8).map(e => `
    <tr>
      <td><span class="customer-link">${e.name}</span></td>
      <td>${typeLabel(e.type)}</td>
      <td class="mono" style="color:var(--accent)">${fmt(e.amt)}</td>
      <td style="color:var(--text3)">${new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN')}</td>
    </tr>`).join('')
  || '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:24px">No collections recorded yet.</td></tr>';
}

// ── ALL CUSTOMERS ────────────────────────────────────
function renderCustomers(list) {
  const tbody = document.getElementById('customer-tbody');
  tbody.innerHTML = list.map(c => `
    <tr style="cursor:pointer;" onclick="openCustomer('${c.id}')">
      <td class="mono" style="color:var(--text3)">${c.id}</td>
      <td><span class="customer-link">${c.name}</span></td>
      <td>${typeLabel(c.type)}</td>
      <td class="mono">${fmt(c.amount)}</td>
      <td class="mono" style="color:var(--warn)">${fmt(remainingBalance(c))}</td>
      <td class="mono" style="color:var(--accent)">${fmt(dueAmount(c))}</td>
      <td>${statusBadge(c.status)}</td>
    </tr>`).join('')
  || '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">No customers found.</td></tr>';
}

function filterCustomers(q) {
  const filtered = customers.filter(c =>
    c.status !== 'closed' &&
    (c.name.toLowerCase().includes(q.toLowerCase()) ||
     c.id.toLowerCase().includes(q.toLowerCase()))
  );
  renderCustomers(filtered);
}

// ── CUSTOMER DETAIL ──────────────────────────────────
// FIX: navigates to customer-detail section properly
function openCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  currentCustomer = c;

  document.getElementById('detail-name').textContent = c.name;
  document.getElementById('detail-meta').innerHTML = `
    <span>ID: <b>${c.id}</b></span>
    <span>📞 <b>${c.phone}</b></span>
    <span>📍 <b>${c.area}</b></span>
    <span>${typeLabel(c.type)}</span>
    <span>${statusBadge(c.status)}</span>`;

  const bal        = remainingBalance(c);
  const given      = amountGivenToCustomer(c);
  const instAmt    = dueAmount(c);
  const instCount  = totalInstallments(c);
  const rates      = interestRates(c);
  const endDate    = calcEndDate(c);
  const amtPaid    = c.amount - bal;
  const pct        = instCount ? Math.min(100, Math.round((c.paid / instCount) * 100)) : 0;
  const iLabel     = instLabel(c);
  const durLabel   = durationLabel(c);
  const endDateDisp = endDate !== '—' ? new Date(endDate + 'T00:00:00').toLocaleDateString('en-IN') : '—';

  const history = [];
  Object.entries(allCollections).forEach(([date, dayData]) => {
    if (dayData[c.id] && parseFloat(dayData[c.id]) > 0)
      history.push({ date, amt: parseFloat(dayData[c.id]) });
  });
  history.sort((a, b) => a.date.localeCompare(b.date));

  const totalCollected    = history.reduce((s, h) => s + h.amt, 0);
  const installmentsPaid  = c.paid;
  const interestEarned    = instCount ? Math.round((installmentsPaid / instCount) * (c.interest || 0)) : 0;
  const interestRemaining = Math.max(0, (c.interest || 0) - interestEarned);

  document.getElementById('loan-details').innerHTML = `
    <div class="info-row"><span class="info-key">Loan Amount (Customer Repays)</span><span class="info-val" style="color:var(--accent)">${fmt(c.amount)}</span></div>
    <div class="info-row"><span class="info-key">Interest Deducted Upfront</span><span class="info-val" style="color:var(--warn)">− ${fmt(c.interest || 0)}</span></div>
    <div class="info-row"><span class="info-key">Amount Given to Customer</span><span class="info-val" style="color:#6699ff">${fmt(given)}</span></div>
    <div class="info-row"><span class="info-key">Loan Type</span><span class="info-val">${c.type === 'DL' ? 'Daily Loan' : c.type === 'WL' ? 'Weekly Loan' : 'Monthly Loan'}</span></div>
    <div class="info-row"><span class="info-key">Total Duration</span><span class="info-val">${durLabel}</span></div>
    <div class="info-row"><span class="info-key">${iLabel}</span><span class="info-val">${fmt(instAmt)} × ${instCount}</span></div>
    <div class="info-row"><span class="info-key">Start Date</span><span class="info-val">${c.startDate || '—'}</span></div>
    <div class="info-row"><span class="info-key">End Date</span><span class="info-val" style="color:var(--accent)">${endDateDisp}</span></div>
    <div class="info-row"><span class="info-key">Daily Interest Rate</span><span class="info-val" style="color:var(--text2)">${rates.daily}% / day</span></div>
    <div class="info-row"><span class="info-key">Monthly Interest Rate</span><span class="info-val" style="color:var(--text2)">${rates.monthly}% / month</span></div>`;

  document.getElementById('repayment-details').innerHTML = `
    <div class="info-row"><span class="info-key">Installments Paid</span><span class="info-val" style="color:var(--accent)">${c.paid} / ${instCount}</span></div>
    <div class="info-row"><span class="info-key">Installments Remaining</span><span class="info-val" style="color:var(--warn)">${Math.max(0, instCount - c.paid)}</span></div>
    <div class="info-row"><span class="info-key">Amount Collected So Far</span><span class="info-val" style="color:var(--accent)">${fmt(amtPaid)}</span></div>
    <div class="info-row"><span class="info-key">Balance Remaining</span><span class="info-val" style="color:var(--danger)">${fmt(bal)}</span></div>
    <div class="info-row"><span class="info-key">Interest Earned (Your Profit)</span><span class="info-val" style="color:var(--accent)">${fmt(interestEarned)}</span></div>
    <div class="info-row"><span class="info-key">Interest Not Yet Earned</span><span class="info-val" style="color:var(--text3)">${fmt(interestRemaining)}</span></div>
    <div style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:6px">
        <span>Repayment Progress</span><span>${pct}%</span>
      </div>
      <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>`;

  document.getElementById('payment-history').innerHTML = history.slice().reverse().slice(0, 50).map((h, idx) => {
    const runningPaid = history.length - idx;
    const intEarned   = instCount ? Math.round((runningPaid / instCount) * (c.interest || 0)) : 0;
    return `<tr>
      <td>${new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN')}</td>
      <td class="mono" style="color:var(--accent)">${fmt(h.amt)}</td>
      <td class="mono" style="color:var(--text3)">${runningPaid} / ${instCount}</td>
      <td class="mono" style="color:var(--accent)">${fmt(intEarned)}</td>
      <td class="mono" style="color:var(--warn)">${fmt(Math.max(0, (c.interest || 0) - intEarned))}</td>
    </tr>`;
  }).join('')
  || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">No payment history found.</td></tr>';

  // FIX: Properly navigate to customer-detail by directly manipulating sections
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-customer-detail').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('nav-customers').classList.add('active');
}

// ── CLOSE ACCOUNT ────────────────────────────────────
// FIX: actually sets status, saves, refreshes and navigates correctly
function closeAccount() {
  if (!currentCustomer) return;

  const c = currentCustomer;

  if (!confirm(`Close ${c.name}'s account?`)) return;

  // Update main array directly (important)
  const index = customers.findIndex(x => x.id === c.id);

  if (index !== -1) {
    customers[index].status = 'closed';
    customers[index].closedOn = new Date().toISOString().split('T')[0];
  }

  saveData();

  currentCustomer = null;

  showToast('🔒 ' + c.name + "'s account has been closed.");

  // Refresh UI properly
  showSection('customers', document.getElementById('nav-customers'));
}

// ── EDIT CUSTOMER ─────────────────────────────────────
function editCustomer() {
  if (!currentCustomer) return;
  editMode = true;
  const c  = currentCustomer;

  document.getElementById('modal-title').textContent = '✏️ Edit Customer';
  document.getElementById('edit-id').value      = c.id;
  document.getElementById('f-custid').value     = c.id;
  document.getElementById('f-custid').disabled  = true;
  document.getElementById('f-name').value       = c.name;
  document.getElementById('f-phone').value      = c.phone;
  document.getElementById('f-area').value       = c.area;
  document.getElementById('f-type').value       = c.type;
  document.getElementById('f-amount').value     = c.amount;
  document.getElementById('f-interest').value   = c.interest || 0;
  document.getElementById('f-days').value       = c.duration || 0;
  document.getElementById('f-startdate').value  = c.startDate || '';
  document.getElementById('f-notes').value      = c.notes || '';

  document.getElementById('add-modal').classList.add('open');
  updateModalPreview();
}

// ── COLLECTION ───────────────────────────────────────
function renderCollection() {
  const list = colFilter === 'all'
    ? customers.filter(c => c.status !== 'closed')
    : customers.filter(c => c.type === colFilter && c.status !== 'closed');

  const todayData = getTodayCollection();
  const tbody     = document.getElementById('collection-tbody');

  tbody.innerHTML = list.map((c, i) => `
    <tr>
      <td class="mono" style="color:var(--text3)">${i + 1}</td>
      <td><b>${c.name}</b><br><span style="font-size:11px;color:var(--text3)">${c.id}</span></td>
      <td>${typeLabel(c.type)}</td>
      <td class="mono">${fmt(dueAmount(c))}</td>
      <td>
        <input class="col-input" type="number" placeholder="0"
               id="col-${c.id}" oninput="updateTotals()"
               value="${todayData[c.id] || ''}">
      </td>
      <td id="col-status-${c.id}" style="font-size:12px">—</td>
    </tr>`).join('');

  updateTotals();
}

function filterCollection(type, btn) {
  colFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCollection();
}

function updateTotals() {
  let total = 0, pending = 0;
  customers.filter(c => c.status !== 'closed').forEach(c => {
    const inp = document.getElementById('col-' + c.id);
    if (!inp) return;
    const v   = parseFloat(inp.value) || 0;
    const due = dueAmount(c);
    total  += v;
    if (v === 0) pending += due;
    const s = document.getElementById('col-status-' + c.id);
    if (s) s.innerHTML =
      v >= due ? '<span style="color:var(--accent)">✓ Paid</span>'
      : v > 0  ? '<span style="color:var(--warn)">Partial</span>'
      :           '—';
  });
  document.getElementById('col-total').textContent   = fmt(total);
  document.getElementById('col-pending').textContent = fmt(pending);
}

function clearCollection() {
  customers.filter(c => c.status !== 'closed').forEach(c => {
    const inp = document.getElementById('col-' + c.id);
    if (inp) inp.value = '';
  });
  allCollections[todayKey()] = {};
  saveCollections();
  updateTotals();
  showToast('🔄 Collection cleared for today.');
}

function saveCollection() {
  const key = todayKey();
  if (!allCollections[key]) allCollections[key] = {};
  let saved = 0;

  customers.filter(c => c.status !== 'closed').forEach(c => {
    const inp = document.getElementById('col-' + c.id);
    if (inp && inp.value !== '') {
      allCollections[key][c.id] = parseFloat(inp.value);
      c.paid = Math.min(totalInstallments(c), c.paid + 1);
      saved++;
    }
  });

  saveCollections();
  saveData();
  showToast('✅ Collection saved! ' + saved + ' entries recorded.');
}

// ── REPORTS ──────────────────────────────────────────
function loadReport() {
  const date    = document.getElementById('report-date').value || todayKey();
  const dayData = allCollections[date] || {};
  const list    = customers.filter(c => c.type === reportTab && c.status !== 'closed');
  let totalCol = 0, totalPending = 0;

  document.getElementById('report-tbody').innerHTML = list.map(c => {
    const due = dueAmount(c);
    const col = parseFloat(dayData[c.id]) || 0;
    totalCol     += col;
    if (col < due) totalPending += (due - col);
    return `<tr>
      <td><b>${c.name}</b><br><span style="font-size:11px;color:var(--text3)">${c.id}</span></td>
      <td class="mono">${fmt(c.amount)}</td>
      <td class="mono">${fmt(due)}</td>
      <td class="mono" style="color:var(--accent)">${col ? fmt(col) : '—'}</td>
      <td>${
        col >= due
          ? '<span class="badge badge-active">Paid</span>'
          : col > 0
          ? '<span class="badge badge-overdue">Partial</span>'
          : '<span class="badge" style="background:#f0a50022;color:var(--warn)">Pending</span>'
      }</td>
    </tr>`;
  }).join('')
  || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">No data for this date.</td></tr>';

  const allDay = allCollections[date] || {};
  let grandTotal = 0;
  customers.filter(c => c.status !== 'closed')
           .forEach(c => { grandTotal += parseFloat(allDay[c.id]) || 0; });

  document.getElementById('rpt-total').textContent   = fmt(grandTotal);
  document.getElementById('rpt-pending').textContent = fmt(totalPending);
}

function switchTab(tab, el) {
  reportTab = tab;
  document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadReport();
}

// ── CLOSED ACCOUNTS ──────────────────────────────────
// FIX: now properly renders closed accounts
function renderClosed() {
  const closed = customers.filter(c => c.status === 'closed');
  const tbody = document.getElementById('closed-tbody');
  if (closed.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px">No closed accounts.</td></tr>';
    return;
  }
  tbody.innerHTML = closed.map(c => `
    <tr>
      <td class="mono">${c.id}</td>
      <td>${c.name}</td>
      <td>${typeLabel(c.type)}</td>
      <td class="mono">${fmt(c.amount)}</td>
      <td style="color:var(--text3)">${c.closedOn || '—'}</td>
      <td style="display:flex;gap:8px">
        <button class="btn btn-green" style="padding:6px 14px;font-size:12px" onclick="reopenAccount('${c.id}')">🔄 Reopen</button>
        <button class="btn btn-danger" style="padding:6px 14px;font-size:12px" onclick="deleteClosedAccount('${c.id}')">🗑 Delete</button>
      </td>
    </tr>`).join('');
}

// FIX: Reopen clears ALL loan data but keeps only ID, name, phone, area
// User must manually enter new loan details after reopening
function reopenAccount(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;

  if (!confirm(`Reopen ${c.name}'s account? Old loan data will be cleared.`)) return;

  // Reset loan but keep identity
  c.status = 'active';
  c.amount = 0;
  c.interest = 0;
  c.duration = 0;
  c.paid = 0;
  c.type = 'DL';
  c.startDate = '';
  c.notes = '';
  delete c.closedOn;

  saveData();

  showToast('✅ Reopened: ' + c.name);

  // Refresh UI
  renderClosed();
}

function deleteClosedAccount(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;

  if (!confirm(`Delete ${c.name}'s account permanently?`)) return;

  // Remove from main array
  customers = customers.filter(x => x.id !== id);
  appData.customers = customers;

  saveData();

  showToast('🗑 Deleted: ' + c.name);

  // Refresh UI
  renderClosed();
}

// ── ADD / EDIT CUSTOMER MODAL ─────────────────────────
function showAddCustomerModal() {
  editMode = false;
  document.getElementById('modal-title').textContent = '➕ Add New Customer';
  document.getElementById('edit-id').value = '';
  document.getElementById('f-custid').value    = '';
  document.getElementById('f-custid').disabled = false;
  ['f-name','f-phone','f-area','f-amount','f-interest','f-days','f-notes']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-type').value       = 'DL';
  document.getElementById('f-startdate').valueAsDate = new Date();
  document.getElementById('add-modal').classList.add('open');
  updateModalPreview();
}

function updateModalPreview() {
  const amount   = parseFloat(document.getElementById('f-amount').value) || 0;
  const interest = parseFloat(document.getElementById('f-interest').value) || 0;
  const duration = parseInt(document.getElementById('f-days').value) || 0;
  const type     = document.getElementById('f-type').value;
  const start    = document.getElementById('f-startdate').value;
  const preview  = document.getElementById('modal-preview');

  const durLabelEl = document.getElementById('f-days-label');
  if (durLabelEl) {
    const unitWord = type === 'DL' ? 'Days' : type === 'WL' ? 'Weeks' : 'Months';
    durLabelEl.innerHTML = 'Loan Duration (' + unitWord + ') <span style="color:var(--danger)">*</span>';
  }

  if (!amount || !duration) { preview.style.display = 'none'; return; }
  preview.style.display = 'block';

  const tDays    = type === 'DL' ? duration : type === 'WL' ? duration * 7 : duration * 30;
  const given    = amount - interest;
  const instAmt  = amount ? Math.round(amount / duration) : 0;
  const ratio    = amount ? interest / amount : 0;
  const dailyPct = tDays ? (ratio / tDays * 100).toFixed(4) : '0';
  const monthPct = tDays ? (ratio * 30 / tDays * 100).toFixed(2) : '0';
  const unitLabel = type === 'DL' ? 'day' : type === 'WL' ? 'week' : 'month';

  let endDateStr = '—';
  if (start) {
    const d = new Date(start + 'T00:00:00');
    d.setDate(d.getDate() + tDays);
    endDateStr = d.toLocaleDateString('en-IN');
  }

  document.getElementById('prev-given').textContent   = '₹' + given.toLocaleString('en-IN');
  document.getElementById('prev-rate').textContent    = dailyPct + '% / day  |  ' + monthPct + '% / month';
  document.getElementById('prev-inst').textContent    = '₹' + instAmt.toLocaleString('en-IN') + ' / ' + unitLabel;
  document.getElementById('prev-count').textContent   = duration + (type === 'DL' ? ' days' : type === 'WL' ? ' weeks' : ' months') + '  (' + tDays + ' total days)';
  document.getElementById('prev-enddate').textContent = endDateStr;
}

function closeModal() {
  editMode = false;
  document.getElementById('f-custid').disabled = false;
  document.getElementById('add-modal').classList.remove('open');
  const p = document.getElementById('modal-preview');
  if (p) p.style.display = 'none';
}

// FIX: saveCustomer after edit now properly closes modal then refreshes view
function saveCustomer() {
  const custId   = document.getElementById('f-custid').value.trim();
  const name     = document.getElementById('f-name').value.trim();
  const phone    = document.getElementById('f-phone').value.trim();
  const area     = document.getElementById('f-area').value.trim();
  const type     = document.getElementById('f-type').value;
  const amount   = parseFloat(document.getElementById('f-amount').value) || 0;
  const interest = parseFloat(document.getElementById('f-interest').value) || 0;
  const duration = parseInt(document.getElementById('f-days').value) || 0;
  const startDate = document.getElementById('f-startdate').value;
  const notes    = document.getElementById('f-notes').value.trim();

  if (!name || !amount || !duration) {
    showToast('⚠️ Please fill Name, Loan Amount, and Duration.');
    return;
  }

  if (editMode) {
    const id = document.getElementById('edit-id').value;
    const c  = customers.find(x => x.id === id);
    if (c) {
      Object.assign(c, { name, phone, area, type, amount, interest, duration, startDate, notes });
      saveData();
      closeModal();
      showToast('✅ Customer updated: ' + name);
      // If we came from customer detail, refresh that view
      if (currentCustomer && currentCustomer.id === id) {
        openCustomer(id);
      } else {
        renderCustomers(customers.filter(c => c.status !== 'closed'));
      }
    }
  } else {
    if (!custId) {
      showToast('⚠️ Please enter a Customer ID.');
      return;
    }
    if (customers.find(x => x.id === custId)) {
      showToast('❌ Customer ID "' + custId + '" already exists. Use a unique ID.');
      return;
    }
    customers.push({
      id: custId, name, phone, area, type, amount, interest,
      duration, paid: 0, status: 'active', startDate, notes
    });
    saveData();
    closeModal();
    showToast('✅ Customer added: ' + name + ' (ID: ' + custId + ')');
    renderCustomers(customers.filter(c => c.status !== 'closed'));
  }
}

// ── ADMIN MANAGEMENT ─────────────────────────────────
function renderAdmins() {
  const tbody = document.getElementById('admins-tbody');
  tbody.innerHTML = allAdmins.map(a => {
    const isSelf       = currentUser && a.username === currentUser.username;
    const isSuperAdmin = currentUser && currentUser.role === 'Super Admin';
    const canDelete    = isSuperAdmin && !isSelf;
    return `<tr>
      <td class="mono">${a.username}</td>
      <td>${a.displayName}</td>
      <td><span class="badge ${a.role === 'Super Admin' ? 'badge-active' : 'badge-dl'}">${a.role}</span></td>
      <td style="color:var(--text3)">${a.createdOn || '—'}</td>
      <td style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-outline" style="padding:5px 12px;font-size:12px" onclick="showEditAdminModal('${a.username}')">✏️ Edit</button>
        ${canDelete ? `<button class="btn btn-danger" style="padding:5px 12px;font-size:12px" onclick="deleteAdmin('${a.username}')">🗑 Delete</button>` : ''}
        ${isSelf ? '<span style="font-size:11px;color:var(--text3);align-self:center;">(You)</span>' : ''}
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">No admins found.</td></tr>';
}

function showAddAdminModal() {
  document.getElementById('admin-modal-title').textContent = '🛡️ Add New Admin';
  document.getElementById('admin-edit-username').value = '';
  document.getElementById('a-username').value     = '';
  document.getElementById('a-username').disabled  = false;
  document.getElementById('a-displayname').value  = '';
  document.getElementById('a-role').value         = 'Finance Manager';
  document.getElementById('a-password').value     = '';
  document.getElementById('a-confirm').value      = '';
  document.getElementById('a-password').placeholder = 'Enter password';
  document.getElementById('admin-modal').classList.add('open');
}

function showEditAdminModal(username) {
  const a = allAdmins.find(x => x.username === username);
  if (!a) return;
  document.getElementById('admin-modal-title').textContent = '✏️ Edit Admin: ' + username;
  document.getElementById('admin-edit-username').value  = username;
  document.getElementById('a-username').value    = a.username;
  document.getElementById('a-username').disabled = true;
  document.getElementById('a-displayname').value = a.displayName;
  document.getElementById('a-role').value        = a.role;
  document.getElementById('a-password').value    = '';
  document.getElementById('a-confirm').value     = '';
  document.getElementById('a-password').placeholder = 'Leave blank to keep current password';
  document.getElementById('admin-modal').classList.add('open');
}

function closeAdminModal() {
  document.getElementById('admin-modal').classList.remove('open');
}

function saveAdmin() {
  const editingUsername = document.getElementById('admin-edit-username').value;
  const username        = document.getElementById('a-username').value.trim();
  const displayName     = document.getElementById('a-displayname').value.trim();
  const role            = document.getElementById('a-role').value;
  const password        = document.getElementById('a-password').value;
  const confirm         = document.getElementById('a-confirm').value;

  if (!displayName) {
    showToast('⚠️ Please enter a Display Name.');
    return;
  }

  if (editingUsername) {
    // Edit mode
    const a = allAdmins.find(x => x.username === editingUsername);
    if (!a) return;

    if (password) {
      if (password !== confirm) {
        showToast('❌ Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        showToast('⚠️ Password must be at least 6 characters.');
        return;
      }
      a.password = password;
      if (currentUser && currentUser.username === editingUsername) {
        currentUser.password = password;
      }
    }

    a.displayName = displayName;
    a.role        = role;

    if (currentUser && currentUser.username === editingUsername) {
      currentUser.displayName = displayName;
      currentUser.role        = role;
      document.getElementById('sidebar-avatar').textContent   = displayName.charAt(0).toUpperCase();
      document.getElementById('sidebar-username').textContent = displayName;
      document.getElementById('sidebar-role').textContent     = role;
    }

    saveAdmins();
    closeAdminModal();
    renderAdmins();
    showToast('✅ Admin updated: ' + displayName);
  } else {
    // Add mode
    if (!username) {
      showToast('⚠️ Please enter a Username.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showToast('⚠️ Username can only contain letters, numbers, and underscores.');
      return;
    }
    if (allAdmins.find(x => x.username === username)) {
      showToast('❌ Username "' + username + '" already exists.');
      return;
    }
    if (!password) {
      showToast('⚠️ Please enter a password.');
      return;
    }
    if (password.length < 6) {
      showToast('⚠️ Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      showToast('❌ Passwords do not match.');
      return;
    }

    allAdmins.push({
      username,
      displayName,
      password,
      role,
      createdOn: todayKey()
    });
    saveAdmins();
    closeAdminModal();
    renderAdmins();
    showToast('✅ Admin added: ' + displayName + ' (' + username + ')');
  }
}

function deleteAdmin(username) {
  if (currentUser && username === currentUser.username) {
    showToast('❌ You cannot delete your own account.');
    return;
  }
  const a = allAdmins.find(x => x.username === username);
  if (!a) return;
  showConfirm(
    '🗑 Delete Admin?',
    'This will permanently delete the admin account for "' + a.displayName + '" (' + a.username + '). They will no longer be able to log in.',
    () => {
      allAdmins = allAdmins.filter(x => x.username !== username);
      saveAdmins();
      renderAdmins();
      showToast('🗑 Admin deleted: ' + a.displayName);
    }
  );
}

function changeMyPassword() {
  const current = document.getElementById('cp-current').value;
  const newPass = document.getElementById('cp-new').value;
  const confirm = document.getElementById('cp-confirm').value;

  if (!currentUser) return;
  if (current !== currentUser.password) {
    showToast('❌ Current password is incorrect.');
    return;
  }
  if (!newPass || newPass.length < 6) {
    showToast('⚠️ New password must be at least 6 characters.');
    return;
  }
  if (newPass !== confirm) {
    showToast('❌ New passwords do not match.');
    return;
  }

  const a = allAdmins.find(x => x.username === currentUser.username);
  if (a) {
    a.password = newPass;
    currentUser.password = newPass;
    saveAdmins();
    document.getElementById('cp-current').value = '';
    document.getElementById('cp-new').value     = '';
    document.getElementById('cp-confirm').value = '';
    showToast('✅ Password changed successfully!');
  }
}

// ── CONFIRM DIALOG ───────────────────────────────────
let _confirmCallback = null;

function showConfirm(title, message, onConfirm) {
  _confirmCallback = onConfirm;

  let overlay = document.getElementById('confirm-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id        = 'confirm-overlay';
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <h3 id="confirm-title"></h3>
        <p id="confirm-msg"></p>
        <div class="confirm-actions">
          <button class="btn btn-outline" onclick="closeConfirm()">Cancel</button>
          <button class="btn btn-danger" onclick="doConfirm()">Confirm</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = message;
  overlay.classList.add('open');
}

function closeConfirm() {
  const overlay = document.getElementById('confirm-overlay');
  if (overlay) overlay.classList.remove('open');
  _confirmCallback = null;
}

function doConfirm() {
  closeConfirm();
  if (_confirmCallback) _confirmCallback();
}

// ── EXCEL EXPORT ─────────────────────────────────────
function buildDailySheet(dateStr) {
  const dayData = allCollections[dateStr] || {};
  const rows = [
    ['Customer ID', 'Customer Name', 'Area', 'Loan Type', 'Loan Amount', 'Fixed Interest', 'Balance', 'Due Amount', 'Collected', 'Status']
  ];
  let totalCollected = 0, totalDue = 0;

  customers.filter(c => c.status !== 'closed').forEach(c => {
    const due    = dueAmount(c);
    const col    = parseFloat(dayData[c.id]) || 0;
    const status = col >= due ? 'Paid' : col > 0 ? 'Partial' : 'Pending';
    totalCollected += col;
    totalDue       += due;
    rows.push([
      c.id, c.name, c.area,
      c.type === 'DL' ? 'Daily' : c.type === 'WL' ? 'Weekly' : 'Monthly',
      c.amount, c.interest || 0, remainingBalance(c), due, col || '', status
    ]);
  });

  rows.push([]);
  rows.push(['', '', '', 'TOTAL', '', '', '', totalDue, totalCollected, '']);
  return rows;
}

function buildWeeklySheet() {
  const today = new Date();
  const rows  = [['Date', 'Customer ID', 'Customer Name', 'Loan Type', 'Collected', 'Status']];
  let grandTotal = 0;

  for (let i = 6; i >= 0; i--) {
    const d    = new Date(today);
    d.setDate(today.getDate() - i);
    const key     = d.toISOString().split('T')[0];
    const dayData = allCollections[key] || {};
    let dayTotal  = 0;

    customers.filter(c => c.status !== 'closed').forEach(c => {
      const col = parseFloat(dayData[c.id]) || 0;
      if (col > 0) {
        rows.push([key, c.id, c.name, c.type === 'DL' ? 'Daily' : c.type === 'WL' ? 'Weekly' : 'Monthly', col, col >= dueAmount(c) ? 'Paid' : 'Partial']);
        dayTotal   += col;
        grandTotal += col;
      }
    });
    if (dayTotal > 0) rows.push(['', '', '--- Day Total ---', '', dayTotal, '']);
    rows.push([]);
  }

  rows.push(['', '', 'WEEK TOTAL', '', grandTotal, '']);
  return rows;
}

function buildMonthlySheet() {
  const today  = new Date();
  const year   = today.getFullYear();
  const month  = today.getMonth();
  const rows   = [['Date', 'Customer ID', 'Customer Name', 'Loan Type', 'Collected', 'Status']];
  let grandTotal = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const key     = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const dayData = allCollections[key] || {};
    let dayTotal  = 0;

    customers.filter(c => c.status !== 'closed').forEach(c => {
      const col = parseFloat(dayData[c.id]) || 0;
      if (col > 0) {
        rows.push([key, c.id, c.name, c.type === 'DL' ? 'Daily' : c.type === 'WL' ? 'Weekly' : 'Monthly', col, col >= dueAmount(c) ? 'Paid' : 'Partial']);
        dayTotal   += col;
        grandTotal += col;
      }
    });
    if (dayTotal > 0) rows.push(['', '', '--- Day Total ---', '', dayTotal, '']);
  }

  rows.push([]);
  rows.push(['', '', 'MONTH TOTAL', '', grandTotal, '']);
  return rows;
}

function buildCustomerSheet() {
  const rows = [
    ['Customer ID', 'Customer Name', 'Phone', 'Area', 'Loan Type', 'Loan Amount (Repayable)',
     'Interest Deducted', 'Interest Rate (%)', 'Amount Given to Customer',
     'Installment Amount', 'Duration (Input Unit)', 'Total Days', 'Installments Paid', 'Installments Left',
     'Balance Remaining', 'Start Date', 'End Date', 'Status']
  ];
  customers.forEach(c => {
    const inst = totalInstallments(c);
    rows.push([
      c.id, c.name, c.phone, c.area,
      c.type === 'DL' ? 'Daily' : c.type === 'WL' ? 'Weekly' : 'Monthly',
      c.amount,
      c.interest || 0,
      interestRatePct(c),
      amountGivenToCustomer(c),
      dueAmount(c),
      c.duration,
      totalDays(c),
      c.paid,
      Math.max(0, inst - c.paid),
      remainingBalance(c),
      c.startDate || '',
      calcEndDate(c),
      c.status
    ]);
  });
  return rows;
}

function exportCombined() {
  const wb    = XLSX.utils.book_new();
  const today = todayKey();
  const label = new Date().toLocaleDateString('en-IN');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildDailySheet(today)),  'Daily - ' + label);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildWeeklySheet()),       'Weekly Report');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildMonthlySheet()),      'Monthly Report');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildCustomerSheet()),     'All Customers');

  XLSX.writeFile(wb, 'FinTrack_Report_' + today + '.xlsx');
  showToast('✅ Excel downloaded with all 4 sheets!');
}

function exportDailyExcel() {
  const wb    = XLSX.utils.book_new();
  const today = todayKey();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildDailySheet(today)), 'Daily Report');
  XLSX.writeFile(wb, 'FinTrack_Daily_' + today + '.xlsx');
  showToast('✅ Daily report downloaded!');
}

function exportAllInOne(type) {
  const wb    = XLSX.utils.book_new();
  const today = todayKey();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildDailySheet(today)), 'Daily Report');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildWeeklySheet()),      'Weekly Report');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildMonthlySheet()),     'Monthly Report');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildCustomerSheet()),    'All Customers');

  const label = type === 'daily' ? 'Daily' : type === 'weekly' ? 'Weekly' : 'Monthly';
  XLSX.writeFile(wb, 'FinTrack_' + label + '_' + today + '.xlsx');
  showToast('✅ ' + label + ' Excel report downloaded!');
}

// ── EVENT LISTENERS ──────────────────────────────────
document.getElementById('add-modal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

document.getElementById('admin-modal').addEventListener('click', function (e) {
  if (e.target === this) closeAdminModal();
});

document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

document.getElementById('login-user').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-pass').focus();
});