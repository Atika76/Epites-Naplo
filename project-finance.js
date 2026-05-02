const financeState = { user:null, project:null, invoices:[], materials:[], editingInvoiceId:null };
function qs(id){ return document.getElementById(id); }
function escapeHtml(v){ return String(v||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function getProjectId(){ return new URLSearchParams(location.search).get('id') || ''; }
function showToast(msg,type='ok'){ const t=qs('toast'); if(!t) return alert(msg); t.textContent=msg; t.className=`toast ${type}`; setTimeout(()=>t.classList.add('hidden'),2600); }
function readFileAsDataUrl(file){ return new Promise(resolve=>{ if(!file) return resolve(''); const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=()=>resolve(''); r.readAsDataURL(file); }); }
async function initFinance(){
  qs('financeLogoutBtn')?.addEventListener('click',()=>location.href='logout.html');
  const id=getProjectId(); qs('backProjectLink').href=`project.html?id=${encodeURIComponent(id)}`;
  financeState.user = await window.EpitesNaploAPI.getCurrentUser();
  if(!financeState.user){ location.href='index.html#login'; return; }
  const projects = await window.EpitesNaploAPI.getProjects();
  financeState.project = projects.find(p=>String(p.id)===String(id));
  qs('financeTitle').textContent = `${financeState.project?.name || 'Projekt'} – számlák és költségek`;
  await reloadFinance();
}
async function reloadFinance(){
  const id=getProjectId();
  financeState.invoices = await window.EpitesNaploAPI.getProjectInvoices(id);
  financeState.materials = await window.EpitesNaploAPI.getProjectMaterials(id);
  renderFinance();
}
function renderFinance(){
  const total = financeState.invoices.reduce((s,i)=>s+Number(i.amount||0),0);
  qs('invoiceCount').textContent = financeState.invoices.length;
  qs('invoiceTotal').textContent = total.toLocaleString('hu-HU');
  qs('materialCount').textContent = financeState.materials.length;
  const totals={};
  financeState.materials.forEach(m=>{ const k=`${m.name}|${m.unit||'db'}`; totals[k]=(totals[k]||0)+Number(m.quantity||0); });
  qs('financeMaterialSummary').innerHTML = Object.entries(totals).map(([k,q])=>{ const [n,u]=k.split('|'); return `<div class="miniInfo"><b>${escapeHtml(n)}</b>: ${Number(q.toFixed(2))} ${escapeHtml(u)}</div>`; }).join('') || '<p class="muted">Még nincs anyagfelhasználás rögzítve.</p>';
  qs('invoiceList').innerHTML = financeState.invoices.map(inv=>`<article class="invoiceCard"><div><b>${escapeHtml(inv.title)}</b><p>${escapeHtml(inv.note||'')}</p><span>${new Date(inv.created_at).toLocaleString('hu-HU')}</span></div><div><strong>${Number(inv.amount||0).toLocaleString('hu-HU')} Ft</strong>${inv.file_data ? `<a class="btn ghost small" href="${inv.file_data}" target="_blank">Megnyitás</a>`:''}<div class="invoiceActions"><button class="btn ghost small" type="button" onclick="editInvoice('${escapeHtml(inv.id)}')">Módosítás</button><button class="btn danger small" type="button" onclick="deleteInvoice('${escapeHtml(inv.id)}')">Törlés</button></div></div></article>`).join('') || '<p class="muted">Még nincs csatolt számla.</p>';
}
async function saveInvoice(){
  const file = qs('invoiceFile').files[0];
  const fileData = await readFileAsDataUrl(file);
  await window.EpitesNaploAPI.saveProjectInvoice(getProjectId(), { id:financeState.editingInvoiceId, title:qs('invoiceTitle').value, amount:qs('invoiceAmount').value, note:qs('invoiceNote').value, fileName:file?.name||'', fileType:file?.type||'', fileData });
  financeState.editingInvoiceId=null;
  qs('invoiceTitle').value=''; qs('invoiceAmount').value=''; qs('invoiceNote').value=''; qs('invoiceFile').value='';
  await reloadFinance(); showToast('✔ Számla mentve / módosítva.');
}

function editInvoice(id){
  const inv = financeState.invoices.find(x=>String(x.id)===String(id));
  if(!inv) return;
  financeState.editingInvoiceId = inv.id;
  qs('invoiceTitle').value = inv.title || '';
  qs('invoiceAmount').value = inv.amount || '';
  qs('invoiceNote').value = inv.note || '';
  showToast('Szerkesztés mód: írd át, majd nyomd meg a Számla mentése gombot.');
  qs('invoiceTitle')?.scrollIntoView({behavior:'smooth', block:'center'});
}
async function deleteInvoice(id){
  if(!confirm('Biztosan törlöd ezt a számlát?')) return;
  await window.EpitesNaploAPI.deleteProjectInvoice(getProjectId(), id);
  if(String(financeState.editingInvoiceId)===String(id)) financeState.editingInvoiceId=null;
  await reloadFinance();
  showToast('✔ Számla törölve.');
}

function copyFinanceSummary(){
  const total = financeState.invoices.reduce((s,i)=>s+Number(i.amount||0),0);
  const text = `${financeState.project?.name||'Projekt'} költségösszesítő\nSzámlák összesen: ${total.toLocaleString('hu-HU')} Ft\nSzámlák: ${financeState.invoices.length} db\nAnyagsorok: ${financeState.materials.length} db`;
  navigator.clipboard?.writeText(text); showToast('Összesítő másolva.');
}
function printFinanceReport(){
  const total = financeState.invoices.reduce((s,i)=>s+Number(i.amount||0),0);
  const html = `<html><head><meta charset="utf-8"><title>Költség riport</title><style>body{font-family:Arial;padding:24px}.row{border-bottom:1px solid #ddd;padding:8px 0}</style></head><body><h1>${escapeHtml(financeState.project?.name||'Projekt')} – költség riport</h1><p>Számlák összesen: <b>${total.toLocaleString('hu-HU')} Ft</b></p>${financeState.invoices.map(i=>`<div class="row"><b>${escapeHtml(i.title)}</b> – ${Number(i.amount||0).toLocaleString('hu-HU')} Ft<br>${escapeHtml(i.note||'')}</div>`).join('')}</body></html>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),400);
}
window.addEventListener('DOMContentLoaded', initFinance);

// ===== v24 FULL PRO: letölthető költségriport =====
function downloadFinanceReportHtml(){
  const total = financeState.invoices.reduce((s,i)=>s+Number(i.amount||0),0);
  const rows = financeState.invoices.map(i=>`<tr><td>${escapeHtml(i.title)}</td><td>${Number(i.amount||0).toLocaleString('hu-HU')} Ft</td><td>${escapeHtml(i.note||'')}</td></tr>`).join('') || '<tr><td colspan="3">Nincs csatolt számla.</td></tr>';
  const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Költség riport</title><style>body{font-family:Arial;padding:28px;color:#111}h1{border-bottom:4px solid #f5a400;padding-bottom:12px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.total{font-size:22px;color:#d97706}</style></head><body><h1>${escapeHtml(financeState.project?.name||'Projekt')} – költség riport</h1><p>Generálva: ${new Date().toLocaleString('hu-HU')}</p><p class="total">Számlák összesen: <b>${total.toLocaleString('hu-HU')} Ft</b></p><table><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr>${rows}</table></body></html>`;
  const blob = new Blob([html], { type:'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'epitesnaplo-koltseg-riport.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),800);
  showToast('✔ Költség riport letöltve. Böngészőből PDF-be menthető.');
}
