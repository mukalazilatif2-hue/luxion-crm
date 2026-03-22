// ============================================================
// Luxion CRM — API-powered JS replacement
// Drop this in place of the existing <script> block.
// All localStorage calls are replaced with fetch() to
// the Netlify serverless functions backed by Neon PostgreSQL.
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
// If you set APP_PASSWORD in Netlify, paste it here once at
// first login. It is stored ONLY in sessionStorage (not sent
// anywhere except your own Netlify function).
// Leave blank to disable the password gate.
const BASE = '/.netlify/functions';

// ── AUTH TOKEN ──────────────────────────────────────────────
let AUTH_TOKEN = sessionStorage.getItem('lux_token') || '';

async function ensureLoggedIn() {
  const pw = process.env?.APP_PASSWORD; // server-side only; on client check differently
  // If no token and a password is required, prompt once
  if (!AUTH_TOKEN) {
    const entered = prompt('Enter CRM password (leave blank if none):') || '';
    if (entered) {
      try {
        const res = await fetch(`${BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: entered }),
        });
        const data = await res.json();
        if (data.token !== undefined) {
          AUTH_TOKEN = data.token;
          sessionStorage.setItem('lux_token', AUTH_TOKEN);
        } else {
          alert('Wrong password.');
        }
      } catch (e) {
        console.error('Login failed', e);
      }
    }
  }
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) h['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  return h;
}

// ── API HELPERS ──────────────────────────────────────────────
async function apiGet(endpoint) {
  const res = await fetch(`${BASE}/${endpoint}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET ${endpoint} failed: ${res.status}`);
  return res.json();
}
async function apiPost(endpoint, body) {
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error(e?.error || `POST ${endpoint} failed: ${res.status}`); }
  return res.json();
}
async function apiPut(endpoint, id, body) {
  const res = await fetch(`${BASE}/${endpoint}?id=${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error(e?.error || `PUT ${endpoint} failed: ${res.status}`); }
  return res.json();
}
async function apiDel(endpoint, id) {
  const res = await fetch(`${BASE}/${endpoint}?id=${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`DELETE ${endpoint} failed: ${res.status}`);
  return res.json();
}

// ── DATA STATE ───────────────────────────────────────────────
let leads = [], payments = [], expenses = [];

async function loadAll() {
  showLoader(true);
  try {
    [leads, payments, expenses] = await Promise.all([
      apiGet('leads'),
      apiGet('payments'),
      apiGet('expenses'),
    ]);
  } catch (e) {
    console.error('Load error:', e);
    showToast('⚠️ Could not connect to database. Check your Netlify config.', 'error');
  } finally {
    showLoader(false);
    refresh();
  }
}

function showLoader(on) {
  let el = document.getElementById('crm-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'crm-loader';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;background:var(--gold);z-index:9999;transition:opacity 0.3s;';
    document.body.appendChild(el);
  }
  el.style.opacity = on ? '1' : '0';
}

function showToast(msg, type = 'ok') {
  let el = document.getElementById('crm-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'crm-toast';
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 20px;font-size:13px;font-weight:600;border-radius:4px;z-index:9999;transition:opacity 0.4s;opacity:0;max-width:340px;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = type === 'error' ? 'var(--red)' : 'var(--green)';
  el.style.color = '#fff';
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

// ── STAGE MAP ────────────────────────────────────────────────
const STAGE_MAP = {
  'Lead':'lead','Demo Scheduled':'demo','Demo Done':'demo',
  'Proposal Sent':'prop','Negotiating':'neg','Won':'won','Lost':'lost'
};

// ── UTILITY ──────────────────────────────────────────────────
function fmt(v) { return Number(v||0).toLocaleString('en-UG'); }
function fmtM(v) {
  v = Number(v||0);
  if (v>=1000000) return (v/1000000).toFixed(1)+'M';
  if (v>=1000) return Math.round(v/1000)+'K';
  return String(v);
}
function today() { return new Date().toISOString().split('T')[0]; }
function daysDiff(d) {
  if (!d) return null;
  return Math.floor((new Date(d) - new Date(today())) / (1000*60*60*24));
}

// ── REFRESH ──────────────────────────────────────────────────
function refresh() {
  const open = leads.filter(l => !['Won','Lost'].includes(l.stage));
  const won  = leads.filter(l => l.stage === 'Won');
  const wonVal = won.reduce((s,l) => s + (l.val||0), 0);
  const totalRev = payments.reduce((s,p) => s + (p.deposit||0) + (p.balPaid||0), 0);
  const totalExp = expenses.reduce((s,e) => s + (e.amount||0), 0);
  const outstanding = payments.reduce((s,p) => {
    const bal = (p.total||0) - (p.deposit||0) - (p.balPaid||0);
    return s + (bal > 0 ? bal : 0);
  }, 0);
  const profit = totalRev - totalExp;

  document.getElementById('sb-profit').textContent = 'UGX ' + fmtM(profit);
  document.getElementById('sb-profit').style.color = profit >= 0 ? '#E8C97A' : '#ff6b6b';
  document.getElementById('sb-outstanding').textContent = 'UGX ' + fmtM(outstanding);
  document.getElementById('sb-open').textContent = open.length;

  document.getElementById('s-total').textContent = leads.length;
  document.getElementById('s-demo').textContent  = leads.filter(l => l.demo==='No' && !['Won','Lost'].includes(l.stage)).length;
  document.getElementById('s-hot').textContent   = leads.filter(l => ['Proposal Sent','Negotiating'].includes(l.stage)).length;
  document.getElementById('s-won').textContent   = won.length;
  document.getElementById('s-wonval').textContent = fmtM(wonVal);

  renderAlerts();
  renderBoard();
  renderLeads();
  renderPayments();
  renderExpenses();
  renderFinance();
}

// ── RENDER FUNCTIONS (unchanged from original) ────────────────
function renderAlerts() {
  const td = today();
  const overdue  = payments.filter(p => { const bal=(p.total||0)-(p.deposit||0)-(p.balPaid||0); return bal>0 && p.balDate && p.balDate<td; });
  const expiring = payments.filter(p => { const d=daysDiff(p.nextDue); return d!==null && d>=0 && d<=14; });
  let html = '';
  if (overdue.length)  html += `<div class="alert-bar">⚠️ ${overdue.length} overdue payment(s): ${overdue.map(p=>p.client).join(', ')} — collect balance immediately.</div>`;
  if (expiring.length) html += `<div class="alert-bar warn">🔔 ${expiring.length} contract(s) expiring/due soon: ${expiring.map(p=>p.client+' ('+p.nextDue+')').join(', ')} — follow up for renewal.</div>`;
  document.getElementById('alert-zone').innerHTML = html;

  let payHtml = '';
  if (overdue.length)  payHtml += `<div class="alert-bar" style="margin-bottom:8px">⚠️ ${overdue.length} overdue balance(s) — action required today.</div>`;
  if (expiring.length) payHtml += `<div class="alert-bar warn" style="margin-bottom:8px">🔔 ${expiring.length} renewal(s) due within 14 days — reach out now.</div>`;
  document.getElementById('pay-alerts').innerHTML = payHtml;
}

function renderBoard() {
  const cols = [
    {key:'Lead',cls:'lead',label:'New Lead'},
    {key:'Demo Scheduled',cls:'demo',label:'Demo Sched.'},
    {key:'Demo Done',cls:'demo',label:'Demo Done'},
    {key:'Proposal Sent',cls:'prop',label:'Proposal Sent'},
    {key:'Negotiating',cls:'neg',label:'Negotiating'},
    {key:'Won',cls:'won',label:'Closed Won ✓'},
  ];
  const td = today();
  document.getElementById('board').innerHTML = cols.map(c => {
    const items = leads.filter(l => l.stage === c.key);
    return `<div>
      <div class="col-hd col-${c.cls}"><span>${c.label}</span><span class="col-cnt">${items.length}</span></div>
      ${items.map(l => {
        const od = l.date && l.date < td;
        return `<div class="deal" onclick="editLeadById(${l.id})">
          <div class="deal-org">${l.org}</div>
          <div class="deal-svc">${l.svc||'—'}</div>
          <div class="deal-val">UGX ${fmt(l.val)}</div>
          <div class="deal-meta">Demo: ${l.demo} · Proposal: ${l.prop}</div>
          ${l.act ? `<div class="deal-action ${od?'overdue':''}">&rarr; ${l.act}${l.date?' ('+l.date+')':''}</div>` : ''}
        </div>`;
      }).join('')}
      <div class="add-col" onclick="openAddStage('${c.key}')">+ Add</div>
    </div>`;
  }).join('');
}

function renderLeads() {
  const td = today();
  document.getElementById('leads-tbody').innerHTML = leads.map(l => {
    const bc = 'b-' + (STAGE_MAP[l.stage] || 'lead');
    const od = l.date && l.date < td;
    return `<tr onclick="editLeadById(${l.id})">
      <td style="font-weight:700;color:var(--navy)">${l.org}</td>
      <td>${l.contact||'—'}</td><td>${l.svc||'—'}</td>
      <td>UGX ${fmt(l.val)}</td>
      <td><span class="badge ${bc}">${l.stage}</span></td>
      <td><span class="dot ${l.demo==='Yes'?'dot-y':'dot-n'}"></span>${l.demo}</td>
      <td style="${od?'color:var(--red);font-weight:700':''}">${l.act||'—'}</td>
      <td style="${od?'color:var(--red)':''}">${l.date||'—'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--muted)">No leads yet.</td></tr>';
}

function renderPayments() {
  const td = today();
  const totalDep    = payments.reduce((s,p) => s + (p.deposit||0), 0);
  const totalBalPaid = payments.reduce((s,p) => s + (p.balPaid||0), 0);
  const totalRec    = totalDep + totalBalPaid;
  const totalOut    = payments.reduce((s,p) => { const b=(p.total||0)-(p.deposit||0)-(p.balPaid||0); return s+(b>0?b:0); }, 0);
  const overdueCnt  = payments.filter(p => { const b=(p.total||0)-(p.deposit||0)-(p.balPaid||0); return b>0&&p.balDate&&p.balDate<td; }).length;
  const expireCnt   = payments.filter(p => { const d=daysDiff(p.nextDue); return d!==null&&d>=0&&d<=30; }).length;
  document.getElementById('p-received').textContent   = fmtM(totalRec);
  document.getElementById('p-outstanding').textContent = fmtM(totalOut);
  document.getElementById('p-overdue').textContent    = overdueCnt;
  document.getElementById('p-expiring').textContent   = expireCnt;

  document.getElementById('pay-tbody').innerHTML = payments.map(p => {
    const bal = (p.total||0) - (p.deposit||0) - (p.balPaid||0);
    const pct = Math.min(100, Math.round(((p.deposit||0)+(p.balPaid||0))/(p.total||1)*100));
    const isOverdue = bal>0 && p.balDate && p.balDate<td;
    const nextDd = daysDiff(p.nextDue);
    let payBadge = '';
    if (bal<=0) payBadge = '<span class="pay-full">Fully Paid ✓</span>';
    else if (isOverdue) payBadge = '<span class="pay-over">OVERDUE ⚠</span>';
    else if (p.deposit>0) payBadge = '<span class="pay-dep">Deposit Only</span>';
    else payBadge = '<span class="pay-none">Not Paid</span>';
    let nextDueTxt = '—';
    if (p.nextDue) {
      if (nextDd === null) nextDueTxt = p.nextDue;
      else if (nextDd < 0) nextDueTxt = `<span class="overdue-text">${p.nextDue} (OVERDUE)</span>`;
      else if (nextDd <= 14) nextDueTxt = `<span class="due-soon">${p.nextDue} (in ${nextDd}d)</span>`;
      else nextDueTxt = p.nextDue;
    }
    return `<tr onclick="editPaymentById(${p.id})">
      <td style="font-weight:700;color:var(--navy)">${p.client}</td>
      <td>${p.svc||'—'}</td>
      <td>UGX ${fmt(p.total)}</td>
      <td style="color:var(--green);font-weight:600">UGX ${fmt(p.deposit)}<br><span style="font-size:10px;color:var(--muted)">${p.depDate||''}</span></td>
      <td style="color:${bal>0?(isOverdue?'var(--red)':'var(--orange)'):'var(--green)'};font-weight:700">
        UGX ${fmt(bal>0?bal:0)}<br>
        <div class="pay-progress"><div class="pp-bar"><div class="pp-fill" style="width:${pct}%"></div></div><div class="pp-label">${pct}% paid</div></div>
      </td>
      <td style="${isOverdue?'color:var(--red);font-weight:700':''}">${p.balDate||'—'}</td>
      <td>${payBadge}</td>
      <td>${p.end||'—'}</td>
      <td>${nextDueTxt}</td>
      <td><button onclick="event.stopPropagation();editPaymentById(${p.id})" style="background:var(--navy);color:var(--gold-lt);border:none;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;">Edit</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="10" style="text-align:center;padding:28px;color:var(--muted)">No payment records yet.</td></tr>';
}

function renderExpenses() {
  const td = today();
  const curMonth  = td.substring(0,7);
  const total      = expenses.reduce((s,e) => s + (e.amount||0), 0);
  const monthTotal = expenses.filter(e => e.date && e.date.startsWith(curMonth)).reduce((s,e) => s + (e.amount||0), 0);
  const cats = {};
  expenses.forEach(e => { if (e.cat) cats[e.cat] = (cats[e.cat]||0) + (e.amount||0); });
  const topCat = Object.entries(cats).sort((a,b) => b[1]-a[1])[0];
  document.getElementById('e-total').textContent   = fmtM(total);
  document.getElementById('e-month').textContent   = fmtM(monthTotal);
  document.getElementById('e-count').textContent   = expenses.length;
  document.getElementById('e-top-cat').textContent = topCat ? topCat[0].split(' ')[0] : '—';
  document.getElementById('e-top-amt').textContent = topCat ? 'UGX '+fmtM(topCat[1]) : '';

  document.getElementById('exp-tbody').innerHTML = expenses.map(e => {
    return `<tr onclick="editExpenseById(${e.id})">
      <td>${e.date||'—'}</td>
      <td style="font-weight:600;color:var(--navy)">${e.desc}</td>
      <td><span class="badge" style="background:var(--bg);color:var(--muted)">${e.cat||'—'}</span></td>
      <td style="font-weight:700;color:var(--red)">UGX ${fmt(e.amount)}</td>
      <td>${e.method||'—'}</td>
      <td>${e.project||'—'}</td>
      <td style="color:var(--muted);font-size:12px">${e.notes||'—'}</td>
      <td><button onclick="event.stopPropagation();editExpenseById(${e.id})" style="background:var(--bg);border:1px solid var(--border);padding:4px 10px;font-size:11px;cursor:pointer;">Edit</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--muted)">No expenses yet.</td></tr>';
}

function renderFinance() {
  const totalDep    = payments.reduce((s,p) => s + (p.deposit||0), 0);
  const totalBalPaid = payments.reduce((s,p) => s + (p.balPaid||0), 0);
  const totalRev    = totalDep + totalBalPaid;
  const totalExp    = expenses.reduce((s,e) => s + (e.amount||0), 0);
  const totalOut    = payments.reduce((s,p) => { const b=(p.total||0)-(p.deposit||0)-(p.balPaid||0); return s+(b>0?b:0); }, 0);
  const profit      = totalRev - totalExp;
  const won         = leads.filter(l => l.stage === 'Won');
  const webD  = leads.filter(l => l.svc && l.svc.toLowerCase().includes('website'));
  const cctvD = leads.filter(l => l.svc && l.svc.toLowerCase().includes('cctv'));
  const bundD = leads.filter(l => l.svc && (l.svc.toLowerCase().includes('bundle') || l.svc.toLowerCase().includes('school')));
  const withVal = leads.filter(l => l.val > 0);
  const avg = withVal.length ? Math.round(withVal.reduce((s,l) => s+(l.val||0), 0) / withVal.length) : 0;

  document.getElementById('fl-rev').textContent    = 'UGX ' + fmtM(totalRev);
  document.getElementById('fl-exp').textContent    = 'UGX ' + fmtM(totalExp);
  document.getElementById('fl-profit').textContent = 'UGX ' + fmtM(profit);
  document.getElementById('fl-out').textContent    = 'UGX ' + fmtM(totalOut);
  document.getElementById('fl-dep').textContent    = 'UGX ' + fmt(totalDep);
  document.getElementById('fl-bal').textContent    = 'UGX ' + fmt(totalBalPaid);
  document.getElementById('fl-web').textContent    = webD.length + ' deal(s)';
  document.getElementById('fl-cctv').textContent   = cctvD.length + ' deal(s)';
  document.getElementById('fl-bundle').textContent = bundD.length + ' deal(s)';
  document.getElementById('fl-avg').textContent    = 'UGX ' + fmt(avg);
  document.getElementById('fl-rev2').textContent   = 'UGX ' + fmt(totalRev);
  document.getElementById('fl-net').textContent    = 'UGX ' + fmt(profit);
  document.getElementById('fl-net').className      = 'fr ' + (profit >= 0 ? 'profit-row' : 'loss-row');
  document.getElementById('fl-exp2').textContent   = 'UGX ' + fmt(totalExp);

  const cats = {};
  expenses.forEach(e => { if (e.cat) cats[e.cat] = (cats[e.cat]||0) + (e.amount||0); });
  document.getElementById('exp-by-cat').innerHTML = Object.entries(cats).sort((a,b) => b[1]-a[1]).map(([k,v]) => `
    <div class="fin-row"><span class="fl">${k}</span><span class="fr" style="color:var(--red)">UGX ${fmt(v)}</span></div>
  `).join('') || '<div class="fin-row"><span class="fl" style="color:var(--muted)">No expenses recorded</span></div>';
}

// ── NAV ──────────────────────────────────────────────────────
let currentAddFn = null;
function nav(id, el, title, btnLabel, addFn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(n => n.classList.remove('active'));
  document.getElementById('v-' + id).classList.add('active');
  el.classList.add('active');
  document.getElementById('tb-title').textContent = title;
  const addBtn = document.getElementById('main-add-btn');
  if (btnLabel && addFn) {
    addBtn.style.display = 'block';
    addBtn.textContent = btnLabel;
    currentAddFn = addFn;
  } else {
    addBtn.style.display = 'none';
  }
}
document.getElementById('main-add-btn').onclick = () => { if (currentAddFn) currentAddFn(); };

// ── LEAD CRUD ────────────────────────────────────────────────
// Track which DB id is being edited (null = new)
let _editLeadId = null;
let _editPayId  = null;
let _editExpId  = null;

function openAdd() {
  _editLeadId = null;
  document.getElementById('lead-modal-title').textContent = 'Add New Lead';
  document.getElementById('ei').value = '';
  document.getElementById('del-btn').style.display = 'none';
  ['org','contact','phone','email','act','notes'].forEach(k => document.getElementById('f-'+k).value = '');
  ['svc','src'].forEach(k => document.getElementById('f-'+k).value = '');
  document.getElementById('f-val').value   = '';
  document.getElementById('f-stage').value = 'Lead';
  document.getElementById('f-demo').value  = 'No';
  document.getElementById('f-prop').value  = 'No';
  document.getElementById('f-date').value  = '';
  document.getElementById('lead-overlay').classList.add('open');
}

function openAddStage(s) { openAdd(); document.getElementById('f-stage').value = s; }

function editLeadById(id) {
  const l = leads.find(x => x.id === id);
  if (!l) return;
  _editLeadId = id;
  document.getElementById('lead-modal-title').textContent = 'Edit Lead';
  document.getElementById('ei').value = id;
  document.getElementById('del-btn').style.display = 'block';
  document.getElementById('f-org').value     = l.org || '';
  document.getElementById('f-contact').value = l.contact || '';
  document.getElementById('f-phone').value   = l.phone || '';
  document.getElementById('f-email').value   = l.email || '';
  document.getElementById('f-svc').value     = l.svc || '';
  document.getElementById('f-val').value     = l.val || '';
  document.getElementById('f-stage').value   = l.stage || 'Lead';
  document.getElementById('f-src').value     = l.src || '';
  document.getElementById('f-demo').value    = l.demo || 'No';
  document.getElementById('f-prop').value    = l.prop || 'No';
  document.getElementById('f-act').value     = l.act || '';
  document.getElementById('f-date').value    = l.date || '';
  document.getElementById('f-notes').value   = l.notes || '';
  document.getElementById('lead-overlay').classList.add('open');
}

// Keep backward compat if any inline onclick="editLead(i)" still exist (they shouldn't after this update)
function editLead(i) { editLeadById(leads[i]?.id); }

async function saveLead() {
  const org = document.getElementById('f-org').value.trim();
  if (!org) { alert('Organisation name is required.'); return; }
  const payload = {
    org, contact: document.getElementById('f-contact').value,
    phone: document.getElementById('f-phone').value,
    email: document.getElementById('f-email').value,
    svc: document.getElementById('f-svc').value,
    val: parseInt(document.getElementById('f-val').value) || 0,
    stage: document.getElementById('f-stage').value,
    src: document.getElementById('f-src').value,
    demo: document.getElementById('f-demo').value,
    prop: document.getElementById('f-prop').value,
    act: document.getElementById('f-act').value,
    date: document.getElementById('f-date').value,
    notes: document.getElementById('f-notes').value,
  };
  document.getElementById('lead-overlay').classList.remove('open');
  showLoader(true);
  try {
    if (_editLeadId) {
      const updated = await apiPut('leads', _editLeadId, payload);
      const idx = leads.findIndex(x => x.id === _editLeadId);
      if (idx !== -1) leads[idx] = updated;
    } else {
      const created = await apiPost('leads', payload);
      leads.unshift(created);
    }
    showToast('Lead saved ✓');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    showLoader(false);
    refresh();
  }
}

async function deleteLead() {
  if (!confirm('Delete this lead?')) return;
  const id = _editLeadId;
  document.getElementById('lead-overlay').classList.remove('open');
  showLoader(true);
  try {
    await apiDel('leads', id);
    leads = leads.filter(x => x.id !== id);
    showToast('Lead deleted.');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    showLoader(false);
    refresh();
  }
}

// ── PAYMENT CRUD ─────────────────────────────────────────────
function openPayModal() {
  _editPayId = null;
  document.getElementById('pay-modal-title').textContent = 'Record Payment';
  document.getElementById('pei').value = '';
  document.getElementById('pay-del-btn').style.display = 'none';
  ['p-client','p-total','p-deposit','p-balance','p-bal-paid','p-dep-date','p-bal-date','p-start','p-end','p-next-due','p-notes']
    .forEach(k => { const el=document.getElementById(k); if(el) el.value=''; });
  document.getElementById('p-svc').value    = '';
  document.getElementById('p-method').value = 'MTN Mobile Money';
  document.getElementById('pay-overlay').classList.add('open');
}

function calcBalance() {
  const total   = parseInt(document.getElementById('p-total').value)   || 0;
  const dep     = parseInt(document.getElementById('p-deposit').value) || 0;
  const balPaid = parseInt(document.getElementById('p-bal-paid').value)|| 0;
  document.getElementById('p-balance').value = Math.max(0, total - dep - balPaid);
}
document.getElementById('p-total').addEventListener('input', calcBalance);

function editPaymentById(id) {
  const p = payments.find(x => x.id === id);
  if (!p) return;
  _editPayId = id;
  document.getElementById('pay-modal-title').textContent = 'Edit Payment Record';
  document.getElementById('pei').value = id;
  document.getElementById('pay-del-btn').style.display = 'block';
  document.getElementById('p-client').value   = p.client || '';
  document.getElementById('p-svc').value      = p.svc || '';
  document.getElementById('p-total').value    = p.total || '';
  document.getElementById('p-deposit').value  = p.deposit || '';
  document.getElementById('p-bal-paid').value = p.balPaid || '';
  document.getElementById('p-dep-date').value = p.depDate || '';
  document.getElementById('p-bal-date').value = p.balDate || '';
  document.getElementById('p-method').value   = p.method || 'MTN Mobile Money';
  document.getElementById('p-start').value    = p.start || '';
  document.getElementById('p-end').value      = p.end || '';
  document.getElementById('p-next-due').value = p.nextDue || '';
  document.getElementById('p-notes').value    = p.notes || '';
  calcBalance();
  document.getElementById('pay-overlay').classList.add('open');
}

function editPayment(i) { editPaymentById(payments[i]?.id); }

async function savePayment() {
  const client = document.getElementById('p-client').value.trim();
  if (!client) { alert('Client name is required.'); return; }
  const payload = {
    client, svc: document.getElementById('p-svc').value,
    total:   parseInt(document.getElementById('p-total').value)    || 0,
    deposit: parseInt(document.getElementById('p-deposit').value)  || 0,
    balPaid: parseInt(document.getElementById('p-bal-paid').value) || 0,
    depDate:  document.getElementById('p-dep-date').value,
    balDate:  document.getElementById('p-bal-date').value,
    method:   document.getElementById('p-method').value,
    start:    document.getElementById('p-start').value,
    end:      document.getElementById('p-end').value,
    nextDue:  document.getElementById('p-next-due').value,
    notes:    document.getElementById('p-notes').value,
  };
  document.getElementById('pay-overlay').classList.remove('open');
  showLoader(true);
  try {
    if (_editPayId) {
      const updated = await apiPut('payments', _editPayId, payload);
      const idx = payments.findIndex(x => x.id === _editPayId);
      if (idx !== -1) payments[idx] = updated;
    } else {
      const created = await apiPost('payments', payload);
      payments.unshift(created);
    }
    showToast('Payment saved ✓');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    showLoader(false);
    refresh();
  }
}

async function deletePayment() {
  if (!confirm('Delete this payment record?')) return;
  const id = _editPayId;
  document.getElementById('pay-overlay').classList.remove('open');
  showLoader(true);
  try {
    await apiDel('payments', id);
    payments = payments.filter(x => x.id !== id);
    showToast('Payment deleted.');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    showLoader(false);
    refresh();
  }
}

// ── EXPENSE CRUD ─────────────────────────────────────────────
function openExpModal() {
  _editExpId = null;
  document.getElementById('exp-modal-title').textContent = 'Add Expense';
  document.getElementById('eei').value = '';
  document.getElementById('exp-del-btn').style.display = 'none';
  ['ex-desc','ex-amount','ex-project','ex-notes'].forEach(k => document.getElementById(k).value = '');
  document.getElementById('ex-cat').value    = '';
  document.getElementById('ex-method').value = 'MTN Mobile Money';
  document.getElementById('ex-date').value   = today();
  document.getElementById('exp-overlay').classList.add('open');
}

function editExpenseById(id) {
  const e = expenses.find(x => x.id === id);
  if (!e) return;
  _editExpId = id;
  document.getElementById('exp-modal-title').textContent = 'Edit Expense';
  document.getElementById('eei').value = id;
  document.getElementById('exp-del-btn').style.display = 'block';
  document.getElementById('ex-desc').value    = e.desc || '';
  document.getElementById('ex-amount').value  = e.amount || '';
  document.getElementById('ex-date').value    = e.date || '';
  document.getElementById('ex-cat').value     = e.cat || '';
  document.getElementById('ex-method').value  = e.method || 'MTN Mobile Money';
  document.getElementById('ex-project').value = e.project || '';
  document.getElementById('ex-notes').value   = e.notes || '';
  document.getElementById('exp-overlay').classList.add('open');
}

function editExpense(i) { editExpenseById(expenses[i]?.id); }

async function saveExpense() {
  const desc   = document.getElementById('ex-desc').value.trim();
  const amount = parseInt(document.getElementById('ex-amount').value) || 0;
  if (!desc || !amount) { alert('Description and amount are required.'); return; }
  const payload = {
    desc, amount,
    date:    document.getElementById('ex-date').value,
    cat:     document.getElementById('ex-cat').value,
    method:  document.getElementById('ex-method').value,
    project: document.getElementById('ex-project').value,
    notes:   document.getElementById('ex-notes').value,
  };
  document.getElementById('exp-overlay').classList.remove('open');
  showLoader(true);
  try {
    if (_editExpId) {
      const updated = await apiPut('expenses', _editExpId, payload);
      const idx = expenses.findIndex(x => x.id === _editExpId);
      if (idx !== -1) expenses[idx] = updated;
    } else {
      const created = await apiPost('expenses', payload);
      expenses.unshift(created);
    }
    showToast('Expense saved ✓');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    showLoader(false);
    refresh();
  }
}

async function deleteExpense() {
  if (!confirm('Delete this expense?')) return;
  const id = _editExpId;
  document.getElementById('exp-overlay').classList.remove('open');
  showLoader(true);
  try {
    await apiDel('expenses', id);
    expenses = expenses.filter(x => x.id !== id);
    showToast('Expense deleted.');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    showLoader(false);
    refresh();
  }
}

// ── INIT ─────────────────────────────────────────────────────
const now = new Date();
document.getElementById('tb-date').textContent = now.toLocaleDateString('en-UG', {
  weekday:'long', year:'numeric', month:'long', day:'numeric'
});

// Boot: check auth then load real data
(async () => {
  await ensureLoggedIn();
  await loadAll();
})();
