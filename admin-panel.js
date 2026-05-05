let adminUsers = [];
let adminPayments = [];
let currentUser = null;
let currentProfile = null;

function $(id) { return document.getElementById(id); }
function esc(v) { return String(v ?? '').replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
function toast(msg) {
  const el = $('toast');
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2800);
}
function formatDate(value) {
  if (!value) return '';
  try { return new Date(value).toLocaleDateString('hu-HU'); } catch { return ''; }
}
function isAdminUser(user, profile = null) {
  return !!user && (profile?.is_admin || user.email === window.EPITESNAPLO_CONFIG.adminEmail);
}

async function initAdminPanel() {
  currentUser = await window.EpitesNaploAPI.getCurrentUser();
  currentProfile = currentUser ? await window.EpitesNaploAPI.getProfile() : null;
  if (!isAdminUser(currentUser, currentProfile)) {
    $('adminAccessBox').innerHTML = `
      <h2>Nincs admin hozzáférés</h2>
      <p class="muted">Ez az oldal csak a Cégweb26 admin fiókkal érhető el.</p>
      <a class="btn primary" href="index.html">Vissza a főoldalra</a>
    `;
    return;
  }
  $('adminAccessBox').classList.add('hidden');
  $('adminPanelContent').classList.remove('hidden');
  await refreshAdminPanel();
}

async function refreshAdminPanel() {
  try {
    adminUsers = await window.EpitesNaploAPI.getAdminUsers();
    adminPayments = await window.EpitesNaploAPI.getAdminPayments();
    renderKpis();
    renderUsers();
    await loadSystemStatusV153();
    toast('Admin adatok frissítve.');
  } catch (err) {
    $('adminAccessBox').classList.remove('hidden');
    $('adminAccessBox').innerHTML = `<h2>Admin betöltési hiba</h2><p class="muted">${esc(err.message || err)}</p>`;
  }
}

function renderKpis() {
  $('kpiUsers').textContent = adminUsers.length;
  $('kpiBusiness').textContent = adminUsers.filter(u => ['business','pro'].includes(u.plan)).length;
  $('kpiCredits').textContent = adminUsers.reduce((sum, u) => sum + Number(u.ai_credits || 0), 0);
  $('kpiPayments').textContent = adminPayments.length;
}

function renderUsers() {
  const q = ($('userSearch').value || '').toLowerCase().trim();
  const filter = $('planFilter').value || 'all';
  let list = adminUsers.filter(u => {
    const hay = `${u.full_name || ''} ${u.company_name || ''} ${u.email || ''}`.toLowerCase();
    const plan = ['trial','starter','pro','business'].includes(u.plan) ? u.plan : 'trial';
    return (!q || hay.includes(q)) && (filter === 'all' || plan === filter);
  });

  $('userList').innerHTML = list.map(u => userCard(u)).join('') || '<p class="muted">Nincs találat.</p>';
}

function userCard(u) {
  const id = esc(u.id);
  const plan = esc(u.plan || 'trial');
  const status = esc(u.status || 'active');
  const adminTag = u.is_admin ? '<span class="tag ok">admin</span>' : '<span class="tag">user</span>';
  return `
    <article class="adminUserCard">
      <div class="adminUserTop">
        <div>
          <h3>${esc(u.company_name || u.full_name || u.email || 'Felhasználó')}</h3>
          <p class="muted">${esc(u.email || '')}</p>
          <div class="tagRow">
            ${adminTag}
            <span class="tag ${plan === 'business' || plan === 'pro' ? 'ok' : 'warn'}">${plan}</span>
            <span class="tag">${status}</span>
            <span class="tag">AI kredit: ${Number(u.ai_credits || 0)}</span>
            <span class="tag">Projekt: ${Number(u.project_count || 0)}</span>
          </div>
        </div>
        <button class="btn small ghost" onclick="openUserOnMain('${id}')">Tesztnézet</button>
      </div>

      <div class="adminControlGrid">
        <label>Csomag
          <select id="plan_${id}">
            ${['trial','starter','pro','business'].map(p => `<option value="${p}" ${p === plan ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </label>
        <label>Státusz
          <select id="status_${id}">
            ${['active','expired','cancelled'].map(s => `<option value="${s}" ${s === (u.status || 'active') ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        <label>Napok
          <input id="days_${id}" type="number" min="1" value="30" />
        </label>
        <button class="btn primary" onclick="savePlan('${id}')">Csomag mentése</button>
      </div>

      <div class="adminControlGrid">
        <label>AI kredit hozzáadás
          <input id="credits_${id}" type="number" min="1" value="1" />
        </label>
        <button class="btn primary" onclick="grantCredits('${id}')">Kredit jóváírás</button>
        <button class="btn ghost" onclick="toggleAdmin('${id}', ${u.is_admin ? 'false' : 'true'})">${u.is_admin ? 'Admin jog elvétele' : 'Adminná tesz'}</button>
        <a class="btn ghost" href="mailto:${esc(u.email || '')}">Email küldése</a>
      </div>
      <small class="muted">Regisztrált: ${formatDate(u.created_at)} ${u.current_period_end ? ' • Lejár: ' + formatDate(u.current_period_end) : ''}</small>
    </article>
  `;
}

async function savePlan(userId) {
  const plan = $("plan_" + userId).value;
  const status = $("status_" + userId).value;
  const days = Number($("days_" + userId).value || 30);

  if (!["trial","starter","pro","business"].includes(plan)) {
    return alert("A csomag csak trial, starter, pro vagy business lehet. A lejárás külön a státusznál állítható.");
  }
  if (!["active","expired","cancelled"].includes(status)) {
    return alert("Érvénytelen státusz.");
  }

  await window.EpitesNaploAPI.adminSetUserPlan(userId, plan, status, days);
  toast(status === "expired" ? "Csomag lejártra állítva." : "Csomag frissítve.");
  await refreshAdminPanel();
}

async function grantCredits(userId) {
  const credits = Number($(`credits_${userId}`).value || 0);
  if (!credits || credits < 1) return alert('Adj meg legalább 1 kreditet.');
  await window.EpitesNaploAPI.adminGrantAiCredits(userId, credits, 'admin_manual_grant');
  toast(`${credits} AI kredit jóváírva.`);
  await refreshAdminPanel();
}

async function toggleAdmin(userId, makeAdmin) {
  if (!confirm(makeAdmin ? 'Biztos adminná teszed ezt a felhasználót?' : 'Biztos elveszed az admin jogot?')) return;
  await window.EpitesNaploAPI.adminSetUserAdmin(userId, makeAdmin);
  toast('Admin jogosultság frissítve.');
  await refreshAdminPanel();
}

function openUserOnMain(userId) {
  localStorage.setItem('epitesnaplo_admin_view_user', userId);
  window.location.href = 'index.html#admin';
}

async function logoutAdmin() {
  const btn = $("logoutBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Kilépés..."; }
  try {
    await window.EpitesNaploAPI.signOut({ silent: true });
    toast("Sikeresen kijelentkeztél.");
  } catch (err) {
    console.warn(err);
  }
  window.location.assign("index.html?logout=" + Date.now() + "#home");
}

document.addEventListener('DOMContentLoaded', initAdminPanel);


// ===== V153 admin rendszerállapot + projekt-maradványok takarítása =====
function setTextV153(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value == null ? '–' : String(value);
}
function formatCleanupTableV153(deleted = {}) {
  const labels = {
    public_reports: 'publikus riport',
    report_events: 'riport esemény',
    report_approvals: 'jóváhagyás',
    report_documents: 'riport dokumentum',
    media_files: 'média hivatkozás',
    ai_photo_analyses: 'AI elemzés',
    project_materials: 'anyag tétel',
    project_invoices: 'számla tétel',
    entries: 'naplóbejegyzés'
  };
  const rows = Object.entries(deleted || {}).filter(([,v]) => Number(v) > 0);
  if (!rows.length) return 'Nem találtam törölhető maradványt. A rendszer jelenleg tiszta vagy az SQL RPC még nincs lefuttatva.';
  return 'Törölve: ' + rows.map(([k,v]) => `${v} ${labels[k] || k}`).join(' • ');
}
async function loadSystemStatusV153() {
  const box = document.getElementById('cleanupResultV153');
  try {
    if (!window.EpitesNaploAPI?.getAdminSystemStatusV153) {
      if (box) box.textContent = 'A V153 rendszerállapot API nem érhető el. Frissítsd az oldalt.';
      return;
    }
    const status = await window.EpitesNaploAPI.getAdminSystemStatusV153();
    const t = status?.tables || {};
    setTextV153('sysProjects', t.projects);
    setTextV153('sysEntries', t.entries);
    setTextV153('sysReports', t.public_reports);
    setTextV153('sysDocs', t.report_documents);
    setTextV153('sysEvents', t.report_events);
    setTextV153('sysMedia', t.media_files);
    if (box) box.innerHTML = `Utolsó ellenőrzés: ${formatDate(status?.updatedAt)}${status?.oldReportEvents ? `<br>30 napnál régebbi riport esemény: <b>${status.oldReportEvents}</b>` : ''}`;
  } catch (err) {
    if (box) box.textContent = 'Rendszerállapot hiba: ' + (err.message || err);
  }
}
async function cleanupRemaindersV153(btn) {
  const box = document.getElementById('cleanupResultV153');
  const old = btn?.textContent || '';
  if (btn) { btn.disabled = true; btn.textContent = 'Takarítás folyamatban...'; }
  if (box) box.textContent = 'Takarítás indul...';
  try {
    const result = await window.EpitesNaploAPI.cleanupProjectRemaindersV153();
    if (box) box.innerHTML = `<b>Projekt-maradványok takarítása kész.</b><br>${formatCleanupTableV153(result.deleted)}<br><small>Utolsó takarítás: ${formatDate(result.updatedAt)}</small>`;
    await loadSystemStatusV153();
    toast('Takarítás kész.');
  } catch (err) {
    if (box) box.textContent = 'Takarítási hiba: ' + (err.message || err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = old || 'Projekt-maradványok takarítása'; }
  }
}
