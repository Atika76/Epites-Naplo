

// ===== beolvasztva V153-ba: project-v77-final-fix.js =====
// ===== V77 FINAL KOMBINÁCIÓ: gyors riport, képmegnyitás, PDF/HTML mentés, törlés, GPS-cím megtartás =====
(function(){
  if(window.__epitesNaploV77FinalFix) return;
  window.__epitesNaploV77FinalFix = true;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = (v) => String(v || 'epitesi-naplo-riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo-riport';
  const projectId = () => window.detailState?.project?.id || new URLSearchParams(location.search).get('id') || 'local';
  const projectTitle = () => window.detailState?.project?.name || 'Építési napló';
  const fmt = (d) => { try { return d ? new Date(d).toLocaleString('hu-HU') : ''; } catch(_) { return d || ''; } };

  function toast(msg, type='ok'){
    if(typeof showToast === 'function') showToast(msg, type); else console.log(msg);
  }
  function setBusy(button, text){
    if(!button) return () => {};
    const old = button.innerHTML;
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = text || 'Dolgozom…';
    return () => { button.disabled = false; button.classList.remove('is-loading'); button.innerHTML = old; };
  }
  async function withBusy(fn, text){
    const btn = document.activeElement?.tagName === 'BUTTON' ? document.activeElement : null;
    const done = setBusy(btn, text);
    try { return await fn(); } finally { done(); }
  }

  function imagesOf(entry){
    const out = [];
    try { if(typeof getEntryImages === 'function') out.push(...(getEntryImages(entry) || [])); } catch(_) {}
    const ai = entry?.ai_json || entry?.analysis || {};
    [entry?.images, entry?.image_urls, entry?.beforeImages, entry?.afterImages, entry?.generalImages, entry?.before_images_json, entry?.after_images_json, entry?.general_images_json, ai.beforeImages, ai.afterImages, ai.generalImages].forEach(a => { if(Array.isArray(a)) out.push(...a); });
    if(entry?.image_url) out.push(entry.image_url);
    if(entry?.image) out.push(entry.image);
    return [...new Set(out.filter(Boolean))];
  }
  function videosOf(entry){
    const out = [];
    try { if(typeof getEntryVideos === 'function') out.push(...(getEntryVideos(entry) || [])); } catch(_) {}
    const ai = entry?.ai_json || entry?.analysis || {};
    [entry?.videos, entry?.videoUrls, entry?.video_urls, ai.videos, ai.videoUrls].forEach(a => { if(Array.isArray(a)) out.push(...a); });
    if(entry?.video_url) out.push(entry.video_url);
    return [...new Set(out.filter(Boolean))];
  }
  function materialsFrom(entries, extra=[]){
    const map = new Map();
    const add = (m) => {
      if(!m) return;
      const name = String(m.name || m.megnevezes || 'Anyag').trim();
      const unit = String(m.unit || m.mertekegyseg || 'db').trim();
      const qty = Number(m.quantity ?? m.mennyiseg ?? 0) || 0;
      const key = `${name}|${unit}`;
      map.set(key, (map.get(key) || 0) + qty);
    };
    (extra || []).forEach(add);
    (entries || []).forEach(e => (Array.isArray(e.materials_json) ? e.materials_json : []).forEach(add));
    return [...map.entries()].map(([k, quantity]) => { const [name, unit] = k.split('|'); return { name, unit, quantity: Number(quantity.toFixed(2)) }; });
  }
  async function closeData(){
    try { if(window.EpitesNaploAPI?.getProjectCloseData && projectId()) return await window.EpitesNaploAPI.getProjectCloseData(projectId()); } catch(e) { console.warn('V77 adatlekérés hiba:', e); }
    return { entries: window.detailState?.entries || [], materials: [], invoices: [] };
  }
  function lightboxScript(){
    return `<script>document.addEventListener('click',function(e){var a=e.target.closest('[data-v77-img]');if(!a)return;e.preventDefault();var src=a.getAttribute('data-v77-img');var box=document.getElementById('v77Lightbox');if(!box){box=document.createElement('div');box.id='v77Lightbox';box.innerHTML='<button type="button" aria-label="Bezárás">×</button><img alt="Napló fotó nagyítva">';document.body.appendChild(box);box.onclick=function(ev){if(ev.target===box||ev.target.tagName==='BUTTON')box.classList.remove('show')}}box.querySelector('img').src=src;box.classList.add('show')});<\/script>`;
  }
  function buildReportHtml(entries, title, data={}){
    entries = Array.isArray(entries) ? entries : [];
    const mats = materialsFrom(entries, data.materials || []);
    const invoices = Array.isArray(data.invoices) ? data.invoices : [];
    const imageCount = entries.reduce((s,e) => s + imagesOf(e).length, 0);
    const videoCount = entries.reduce((s,e) => s + videosOf(e).length, 0);
    const invoiceSum = invoices.reduce((s,i) => s + Number(i.amount || 0), 0);
    const matsHtml = mats.length ? mats.map(m => `<li><b>${esc(m.name)}</b>: ${esc(m.quantity)} ${esc(m.unit)}</li>`).join('') : '<li>Nincs rögzített anyag.</li>';
    const invoicesHtml = invoices.length ? `<table><thead><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr></thead><tbody>${invoices.map(i => `<tr><td>${esc(i.title || 'Számla')}</td><td>${Number(i.amount || 0).toLocaleString('hu-HU')} Ft</td><td>${esc(i.note || '')}</td></tr>`).join('')}</tbody></table>` : '<p>Nincs csatolt számla.</p>';
    const rows = entries.map((e, idx) => {
      const imgs = imagesOf(e), vids = videosOf(e), mats = Array.isArray(e.materials_json) ? e.materials_json : [];
      const weather = e.weather_json ? `${esc(e.weather_json.temperature ?? '')} °C, ${esc(e.weather_json.text || '')}, szél: ${esc(e.weather_json.wind || 0)} km/h, csapadék: ${esc(e.weather_json.rain || 0)} mm` : esc(e.weather || 'nincs adat');
      const gps = e.gps_json?.address || e.location_address || e.locationAddress || e.gps_json?.text || (e.gps_json?.lat ? `${e.gps_json.lat}, ${e.gps_json.lon}` : '');
      const note = esc(e.note || '').replace(/\n/g,'<br>');
      return `<section class="entry"><h2>${esc(fmt(e.created_at))} – ${esc(e.phase || 'Napi bejegyzés')}</h2><div class="note">${note}</div><p><b>Dokumentáció:</b> ${imgs.length} fotó, ${vids.length} videó</p><p><b>Időjárás:</b> ${weather}</p>${gps ? `<p><b>GPS/hely:</b> ${esc(gps)}</p>` : ''}${mats.length ? `<p><b>Napi anyag:</b> ${mats.map(x => `${esc(x.name)} ${esc(x.quantity)} ${esc(x.unit)}`).join(', ')}</p>` : ''}${e.ai_json?.photoTextCheck ? `<p class="ai"><b>AI szakmai kontroll:</b> ${esc(e.ai_json.photoTextCheck)}</p>` : ''}${imgs.length ? `<h3>Fotódokumentáció</h3><div class="photos">${imgs.map((src,i) => `<a class="photo" href="${esc(src)}" data-v77-img="${esc(src)}"><img src="${esc(src)}" alt="Napló fotó ${idx+1}/${i+1}" loading="eager"></a>`).join('')}</div><p class="hint">Képre kattintva nagyítható. PDF mentésnél a képek a riportban maradnak.</p>` : '<p class="muted">Ehhez a bejegyzéshez nincs csatolt fotó.</p>'}</section>`;
    }).join('') || '<p>Nincs bejegyzés.</p>';
    return `<!doctype html><html lang="hu"><head><link rel="icon" type="image/png" sizes="192x192" href="https://epitesi-naplo.eu/favicon.png"><link rel="shortcut icon" href="https://epitesi-naplo.eu/favicon.ico"><link rel="apple-touch-icon" href="https://epitesi-naplo.eu/favicon.png"><meta name="theme-color" content="#0f172a"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:24px;line-height:1.48}.doc{max-width:1080px;margin:auto}.cover{background:linear-gradient(135deg,#fff7ed,#ffffff);border:1px solid #fed7aa;border-left:7px solid #f59e0b;border-radius:18px;padding:24px;margin-bottom:22px}.badge{display:inline-block;background:#111827;color:#fff;border-radius:999px;padding:7px 13px;font-weight:700}h1{font-size:34px;line-height:1.08;margin:18px 0 8px}h2{font-size:23px}.muted,.hint{color:#4b5563}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:18px}.stat{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px;box-shadow:0 8px 22px rgba(17,24,39,.05)}.stat b{display:block;color:#d97706;font-size:24px}.section,.invoice,.aiBox,.entry{break-inside:avoid;page-break-inside:avoid}.aiBox{border:1px solid #bbf7d0;border-left:6px solid #22c55e;background:#ecfdf5;border-radius:16px;padding:18px 22px;margin:24px 0}.entry{border:1px solid #e5e7eb;border-left:5px solid #f59e0b;background:#fafafa;border-radius:16px;margin:22px 0;padding:18px 22px}.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,132px));gap:14px;margin-top:12px}.photo{display:block;width:132px;height:132px;border:1px solid #d1d5db;border-radius:14px;padding:5px;background:#fff;overflow:hidden;cursor:zoom-in}.photo img{display:block;width:100%;height:100%;object-fit:cover;border-radius:10px}.ai{background:#e6fffb;border-radius:10px;padding:10px}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #e5e7eb;text-align:left}#v77Lightbox{position:fixed;inset:0;background:rgba(0,0,0,.84);display:none;align-items:center;justify-content:center;z-index:999999;padding:20px}#v77Lightbox.show{display:flex}#v77Lightbox img{max-width:96vw;max-height:90vh;border-radius:12px;background:white}#v77Lightbox button{position:fixed;right:18px;top:12px;font-size:42px;color:white;background:transparent;border:0;cursor:pointer}@media print{@page{size:A4;margin:12mm}body{padding:0}.doc{max-width:none}.cover{border-radius:0}.stats{grid-template-columns:repeat(5,1fr);gap:5mm}.stat{padding:4mm;box-shadow:none}.photos{grid-template-columns:repeat(4,32mm)!important;gap:5mm!important}.photo{width:32mm!important;height:32mm!important;padding:1mm!important}.hint,#v77Lightbox{display:none!important}h1,h2,h3{break-after:avoid;page-break-after:avoid}.entry,.section,.invoice,.aiBox,table,tr,td,th{break-inside:avoid;page-break-inside:avoid}}@media(max-width:720px){body{padding:14px}.stats{grid-template-columns:repeat(2,1fr)}h1{font-size:28px}.photos{grid-template-columns:repeat(auto-fill,minmax(108px,108px))}.photo{width:108px;height:108px}}
    </style></head><body><main class="doc"><div class="cover"><span class="badge">ÉpítésNapló AI PRO</span><h1>${esc(title)}</h1><p class="muted">Generálva: ${new Date().toLocaleString('hu-HU')} • ügyfélnek átadható, rendezett dokumentáció</p><div class="stats"><div class="stat"><b>${entries.length}</b>bejegyzés</div><div class="stat"><b>${imageCount}</b>fotó</div><div class="stat"><b>${videoCount}</b>videó</div><div class="stat"><b>${mats.length}</b>anyag sor</div><div class="stat"><b>${invoiceSum.toLocaleString('hu-HU')} Ft</b>számla</div></div></div><section class="aiBox"><h2>Vezetői AI összefoglaló</h2><p>A riport a napi bejegyzésekből, fotókból, anyagokból, időjárási adatokból és GPS/hely adatokból készült. A dokumentáció célja, hogy az elvégzett munka áttekinthetően, ügyfélbarát formában és később is visszakereshetően legyen mentve.</p><ul><li>Fotók száma: ${imageCount} db.</li><li>Bejegyzések száma: ${entries.length} db.</li><li>Átadás előtt érdemes ellenőrizni, hogy minden fontos munkafázishoz van-e kép.</li></ul></section><section class="section"><h2>Anyagösszesítő</h2><ul>${matsHtml}</ul></section><section class="invoice"><h2>Számlák</h2>${invoicesHtml}</section><h2>Napi bejegyzések</h2>${rows}</main>${lightboxScript()}</body></html>`;
  }
  async function makeReport(label, weekly){
    const data = await closeData();
    let entries = data.entries || window.detailState?.entries || [];
    if(weekly){ const d = new Date(); d.setDate(d.getDate() - 7); entries = entries.filter(e => new Date(e.created_at) >= d); }
    const title = `${projectTitle()} – ${label}`;
    return { title, html: buildReportHtml(entries, title, data) };
  }
  function downloadHtml(name, html){
    const blob = new Blob([html || ''], { type:'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  async function persist(doc){
    const key = `v77_report_docs_${projectId()}`;
    const row = { id:'local-'+Date.now(), created_at:new Date().toISOString(), ...doc };
    try { if(window.EpitesNaploAPI?.saveReportDocument && projectId() !== 'local') return await window.EpitesNaploAPI.saveReportDocument({ projectId: projectId(), ...doc }); } catch(e) { console.warn('V77 Supabase riport mentés helyi mentésre vált:', e); }
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.unshift(row); localStorage.setItem(key, JSON.stringify(arr.slice(0,50)));
    return row;
  }
  async function listDocs(){
    let rows = [];
    try { if(window.EpitesNaploAPI?.listReportDocuments && projectId() !== 'local') rows = await window.EpitesNaploAPI.listReportDocuments(projectId()); } catch(e) { console.warn('V77 riport lista hiba:', e); }
    const local = JSON.parse(localStorage.getItem(`v77_report_docs_${projectId()}`) || '[]')
      .concat(JSON.parse(localStorage.getItem(`v75_report_docs_${projectId()}`) || '[]'))
      .concat(JSON.parse(localStorage.getItem(`v74_report_docs_${projectId()}`) || '[]'));
    return [...(rows || []), ...local];
  }
  async function findDoc(id){ return (await listDocs()).find(d => String(d.id) === String(id)); }
  function openReport(html, printNow=false){
    const w = window.open('', '_blank');
    if(!w) return alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakokat.');
    w.document.open(); w.document.write(html || '<p>Nincs riport tartalom.</p>'); w.document.close();
    if(printNow){
      const waitImages = () => Promise.all([...w.document.images].map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; setTimeout(res, 2500); })));
      setTimeout(() => waitImages().then(() => { try { w.focus(); w.print(); } catch(_){} }), 350);
    }
  }
  async function renderBox(){
    const host = $('v75SavedReportsBox') || $('v74DocumentsBox') || $('v71ApprovalsBox');
    if(!host) return;
    let box = $('v77SavedReportsBox');
    if(!box){ box = document.createElement('div'); box.id='v77SavedReportsBox'; box.className='notice v74SavedReportsBox'; host.insertAdjacentElement('afterend', box); }
    const docs = await listDocs();
    if(!docs.length){ box.innerHTML = '<b>Mentett riport példányok</b><p class="muted">Még nincs mentett riport. A heti vagy lezáró riport gombbal automatikusan létrejön.</p>'; return; }
    box.innerHTML = '<b>Mentett riport példányok</b>' + docs.slice(0,12).map(d => `<div class="v71ApprovalRow"><div><span class="tag info">${esc(d.document_type || d.type || 'riport')}</span><br><small>${esc(fmt(d.created_at))}</small><p>${esc(d.title || 'Építési napló riport')}</p></div><div class="v71ApprovalActions"><button class="btn small primary" type="button" data-v77-open="${esc(d.id)}">Megnyitás</button><button class="btn small ghost" type="button" data-v77-pdf="${esc(d.id)}">PDF / nyomtatás</button><button class="btn small ghost" type="button" data-v77-down="${esc(d.id)}">HTML mentés</button><button class="btn small danger" type="button" data-v77-del="${esc(d.id)}">Törlés</button></div></div>`).join('');
  }

  window.printWeeklyReport = () => withBusy(async () => { const r = await makeReport('heti PRO építési napló', true); await persist({ title:r.title, type:'weekly_report', html:r.html, text:'Heti riport', meta:{ range:'last_7_days', v:77 } }); openReport(r.html, true); await renderBox(); toast('✔ Heti riport mentve és PDF/nyomtatás megnyitva.'); }, 'Riport készül…');
  window.printClosingDocument = () => withBusy(async () => { const r = await makeReport('lezáró PRO építési napló', false); await persist({ title:r.title, type:'closing_report', html:r.html, text:'Lezáró riport', meta:{ all:true, v:77 } }); openReport(r.html, true); await renderBox(); toast('✔ Lezáró riport mentve és PDF/nyomtatás megnyitva.'); }, 'Riport készül…');
  window.downloadWeeklyReportHtml = () => withBusy(async () => { const r = await makeReport('heti építési napló', true); await persist({ title:r.title, type:'weekly_html', html:r.html, text:'Heti HTML', meta:{ range:'last_7_days', v:77 } }); downloadHtml(`${safe(projectTitle())}-heti-riport.html`, r.html); await renderBox(); toast('✔ Heti HTML riport mentve és letöltve.'); }, 'HTML készül…');
  window.downloadClosingReportHtml = () => withBusy(async () => { const r = await makeReport('lezáró dokumentum', false); await persist({ title:r.title, type:'closing_html', html:r.html, text:'Lezáró HTML', meta:{ all:true, v:77 } }); downloadHtml(`${safe(projectTitle())}-lezaro-riport.html`, r.html); await renderBox(); toast('✔ Lezáró HTML riport mentve és letöltve.'); }, 'HTML készül…');
  window.v77RenderSavedReports = renderBox;

  document.addEventListener('click', async function(e){
    const b = e.target.closest('[data-v77-open],[data-v77-pdf],[data-v77-down],[data-v77-del]');
    if(!b) return;
    e.preventDefault(); e.stopPropagation();
    const done = setBusy(b, b.dataset.v77Del ? 'Törlés…' : 'Megnyitás…');
    try{
      const id = b.dataset.v77Open || b.dataset.v77Pdf || b.dataset.v77Down || b.dataset.v77Del;
      const d = await findDoc(id);
      if(!d) return alert('Nem találom a mentett riportot.');
      const html = d.html_content || d.html || '';
      if(b.dataset.v77Del){
        if(!confirm('Biztosan törlöd ezt a mentett riportot? A projekt nem törlődik.')) return;
        try { if(!String(id).startsWith('local-') && window.EpitesNaploAPI?.deleteReportDocument) await window.EpitesNaploAPI.deleteReportDocument(id); } catch(err) { console.warn(err); }
        ['v77_report_docs_','v75_report_docs_','v74_report_docs_'].forEach(pref => { const key = pref + projectId(); const arr = JSON.parse(localStorage.getItem(key) || '[]').filter(x => String(x.id) !== String(id)); localStorage.setItem(key, JSON.stringify(arr)); });
        toast('✔ Mentett riport törölve.'); await renderBox(); return;
      }
      if(b.dataset.v77Down) downloadHtml(`${safe(d.title || projectTitle())}.html`, html);
      else openReport(html, !!b.dataset.v77Pdf);
    } finally { done(); }
  }, true);

  // Gyorsabb érzés: a régi v75 gombokat nem töröljük, de az új V77 lista legyen felül elérhető.
  document.addEventListener('DOMContentLoaded', () => setTimeout(renderBox, 900));
  setTimeout(renderBox, 1500);
})();

// ===== V78 HOTFIX: csak egy mentett riport blokk + jóváhagyott riport gombok stabilizálása =====
(function(){
  if(window.__epitesNaploV78Hotfix) return;
  window.__epitesNaploV78Hotfix = true;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = (v) => String(v || 'epitesi-naplo-riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo-riport';
  const projectId = () => window.detailState?.project?.id || new URLSearchParams(location.search).get('id') || 'local';
  const projectTitle = () => window.detailState?.project?.name || 'Építési napló';
  const toast = (msg,type='ok') => { if(typeof showToast === 'function') showToast(msg,type); else console.log(msg); };

  function downloadHtml(name, html){
    const blob = new Blob([html || ''], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1200);
  }
  function openReport(html, printNow=false){
    const w = window.open('', '_blank');
    if(!w) return alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakokat.');
    w.document.open();
    w.document.write(html || '<!doctype html><html><body><p>Nincs riport tartalom.</p></body></html>');
    w.document.close();
    if(printNow){
      const waitImages = () => Promise.all([...w.document.images].map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; setTimeout(res, 2500); })));
      setTimeout(()=>waitImages().then(()=>{ try{ w.focus(); w.print(); }catch(_){} }), 400);
    }
  }
  function normalizeApprovedHtml(row){
    let body = row?.approved_report_html || row?.report_html_snapshot || row?.report_html || row?.html_content || row?.html || '';
    if(!body){
      body = `<h1>Jóváhagyott építési napló riport</h1><p>A jóváhagyott riport tartalma nem található, de a jóváhagyás rekordja elérhető.</p><p><b>Ügyfél:</b> ${esc(row?.client_name || '')}</p><p><b>Dátum:</b> ${esc(String(row?.approved_at || row?.created_at || '').replace('T',' ').slice(0,19))}</p>`;
    }
    const stamp = `<div class="approvedStamp"><b>Jóváhagyott példány</b><br>Elfogadás dátuma: ${esc(String(row?.approved_at || row?.created_at || '').replace('T',' ').slice(0,19))}<br>Ügyfél: ${esc(row?.client_name || '')}</div>`;
    if(!/<!doctype|<html/i.test(body)){
      return `<!doctype html><html lang="hu"><head><link rel="icon" type="image/png" sizes="192x192" href="https://epitesi-naplo.eu/favicon.png"><link rel="shortcut icon" href="https://epitesi-naplo.eu/favicon.ico"><link rel="apple-touch-icon" href="https://epitesi-naplo.eu/favicon.png"><meta name="theme-color" content="#0f172a"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jóváhagyott építési napló riport</title><style>body{background:#f8fafc;color:#111827;font-family:Arial,sans-serif;padding:24px;line-height:1.45}.approvedStamp{border:2px solid #22c55e;background:#ecfdf5;border-radius:14px;padding:14px;margin:0 0 18px}.publicReportCard{max-width:1050px;margin:auto;background:white;padding:24px;border-radius:18px}.reportMediaTile img,.photos img{max-width:100%;height:auto}@media print{body{padding:0;background:#fff}.publicReportCard{box-shadow:none;border-radius:0}.approvedStamp{break-inside:avoid}}</style></head><body><div class="publicReportCard">${stamp}${body}</div></body></html>`;
    }
    if(/approvedStamp/i.test(body)) return body;
    return body.replace(/<body[^>]*>/i, m => `${m}<div class="publicReportCard">${stamp}`).replace(/<\/body>/i, '</div></body>');
  }
  async function approvedRow(id){
    let row = null;
    try{ if(window.EpitesNaploAPI?.getApprovedReportHtml) row = await window.EpitesNaploAPI.getApprovedReportHtml(id); }catch(e){ console.warn('V78 approved fetch hiba:', e); }
    if(row) return row;
    try{
      const docs = await (window.EpitesNaploAPI?.listReportDocuments ? window.EpitesNaploAPI.listReportDocuments(projectId()) : []);
      row = (docs || []).find(d => String(d.approval_id || d.id) === String(id));
      if(row) return row;
    }catch(_){}
    throw new Error('Nem találom a jóváhagyott riportot. Lehet, hogy hiányzik a Supabase jogosultság vagy a riport nincs mentve.');
  }
  async function persistApproved(id, html, row, mode){
    try{
      if(window.EpitesNaploAPI?.saveReportDocument && projectId() !== 'local'){
        await window.EpitesNaploAPI.saveReportDocument({
          projectId: projectId(),
          approvalId: id,
          title: `${projectTitle()} – jóváhagyott riport`,
          type: mode === 'pdf' ? 'approved_pdf_print' : 'approved_report',
          html,
          text: 'Jóváhagyott riport',
          meta: { decision: row?.decision || '', v:78 }
        });
      }
    }catch(e){ console.warn('V78 approved mentés nem sikerült, csak megnyitás/letöltés megy:', e); }
  }
  window.v71DownloadApprovedHtml = async function(id){
    try{
      const row = await approvedRow(id);
      const html = normalizeApprovedHtml(row);
      await persistApproved(id, html, row, 'html');
      downloadHtml(`${safe(projectTitle())}-jovahagyott-riport.html`, html);
      if(window.v77RenderSavedReports) setTimeout(window.v77RenderSavedReports, 300);
      toast('✔ Jóváhagyott HTML riport letöltve.');
    }catch(e){ alert('HTML letöltési hiba: ' + (e.message || e)); }
  };
  window.v71PrintApprovedReport = async function(id){
    try{
      const row = await approvedRow(id);
      const html = normalizeApprovedHtml(row);
      await persistApproved(id, html, row, 'pdf');
      openReport(html, true);
      if(window.v77RenderSavedReports) setTimeout(window.v77RenderSavedReports, 300);
      toast('✔ Jóváhagyott PDF/nyomtatás megnyitva.');
    }catch(e){ alert('PDF/nyomtatási hiba: ' + (e.message || e)); }
  };

  function cleanupDuplicateReportBoxes(){
    // A régi V74/V75 mentett riport dobozok duplikáltan jelentek meg. Meghagyjuk az adatot, csak a régi dobozokat rejtjük el.
    ['v74DocumentsBox','v75SavedReportsBox'].forEach(id => {
      const el = document.getElementById(id);
      if(el){ el.style.display = 'none'; el.setAttribute('aria-hidden','true'); }
    });
    // Ha valami régi kód újra létrehozott plusz „Mentett riport példányok” blokkot, csak a V77 maradjon látható.
    const boxes = [...document.querySelectorAll('.v74SavedReportsBox, .notice')].filter(el => /Mentett riport példányok/i.test(el.textContent || ''));
    boxes.forEach(el => { if(el.id !== 'v77SavedReportsBox'){ el.style.display='none'; el.setAttribute('aria-hidden','true'); } });
  }
  document.addEventListener('click', function(e){
    const btn = e.target.closest('[data-v71-download],[data-v71-print]');
    if(!btn) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const id = btn.getAttribute('data-v71-download') || btn.getAttribute('data-v71-print');
    if(btn.hasAttribute('data-v71-download')) window.v71DownloadApprovedHtml(id); else window.v71PrintApprovedReport(id);
  }, true);
  const obs = new MutationObserver(()=>cleanupDuplicateReportBoxes());
  document.addEventListener('DOMContentLoaded', ()=>{
    cleanupDuplicateReportBoxes();
    if(window.v77RenderSavedReports) setTimeout(window.v77RenderSavedReports, 300);
    try{ obs.observe(document.body, {childList:true, subtree:true}); }catch(_){}
  });
  setTimeout(cleanupDuplicateReportBoxes, 900);
  setTimeout(cleanupDuplicateReportBoxes, 1800);
})();



// ===== beolvasztva V153-ba: project-v87-client-question-ai-report-fix.js =====
// V87 - ügyfél kérdés/észrevétel + AI szakmai kiegészítés a saját jóváhagyott riportba
// Csak a riport tartalmát egészíti ki. Más működést nem változtat.
(function(){
  if (window.__v87ClientQuestionAiReportFix) return;
  window.__v87ClientQuestionAiReportFix = true;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const msgOf = row => row?.client_comment || row?.message || row?.client_message || row?.approval_message || row?.question || row?.question_text || row?.note || row?.comment || '';
  const normalizeAi = (entry = {}) => entry.ai_json || entry.analysis || entry.ai || {};
  const clean = v => String(v || '').trim();

  function buildAiProfessionalBlock(entries){
    entries = Array.isArray(entries) ? entries : [];
    const items = [];
    entries.forEach((e, idx) => {
      const ai = normalizeAi(e);
      const title = clean(ai.title || e.ai_title || e.phase || ('Bejegyzés ' + (idx + 1)));
      const professional = clean(ai.professionalSummary || ai.photoTextCheck || ai.customerSummary || ai.nextStep || '');
      const advice = Array.isArray(ai.advice) ? ai.advice.filter(Boolean) : [];
      const checklist = Array.isArray(ai.checklist) ? ai.checklist.filter(Boolean) : [];
      const risks = Array.isArray(ai.risks) ? ai.risks.filter(Boolean) : [];
      const lines = [];
      if (professional) lines.push(`<p>${esc(professional)}</p>`);
      const list = [...advice, ...checklist, ...risks].slice(0, 6);
      if (list.length) lines.push(`<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
      if (clean(ai.nextStep)) lines.push(`<p><b>Következő szakmai lépés:</b> ${esc(ai.nextStep)}</p>`);
      if (lines.length) items.push(`<article class="v87AiItem"><h3>${esc(title)}</h3>${lines.join('')}</article>`);
    });
    const fallback = `<p>A riportban szereplő AI szakmai kontroll a kivitelezési folyamat fő ellenőrzési pontjait rögzíti. Különösen fontos: rétegrend, tömörítés, szint, lejtés, vízelvezetés, fotódokumentáció és a következő munkafázis előtti ellenőrzés.</p>`;
    return `<section class="v87AiProfessional"><h2>AI szakmai elemzés / kivitelezői megjegyzés</h2>${items.length ? items.join('') : fallback}</section>`;
  }

  function buildClientBlock(row){
    const msg = msgOf(row);
    if(!msg) return '';
    return `<section class="v87ClientQuestion"><h2>Ügyfél kérdése / észrevétele</h2><p>${esc(msg).replace(/\n/g,'<br>')}</p></section>`;
  }

  function css(){ return `<style>
    .v87ClientQuestion{margin:22px 0;padding:16px 18px;border-left:5px solid #f59e0b;background:#fff7ed;border-radius:12px;color:#111827;break-inside:avoid;page-break-inside:avoid}.v87ClientQuestion h2{margin:0 0 8px;color:#111827}.v87ClientQuestion p{white-space:pre-wrap;margin:0;color:#111827}
    .v87AiProfessional{margin:22px 0;padding:16px 18px;border-left:5px solid #22c55e;background:#ecfdf5;border-radius:12px;color:#111827;break-inside:avoid;page-break-inside:avoid}.v87AiProfessional h2{margin:0 0 10px;color:#111827}.v87AiProfessional h3{margin:10px 0 6px;color:#111827}.v87AiProfessional p,.v87AiProfessional li{color:#111827}.v87AiItem{margin:10px 0;padding:10px 12px;background:#ffffff;border:1px solid #bbf7d0;border-radius:10px}
  </style>`; }

  function insertBeforeDaily(html, block){
    let out = String(html || '');
    if(!block || out.includes('v87ClientQuestion') && out.includes('v87AiProfessional')) return out;
    if(out.includes('</head>')) out = out.replace('</head>', css() + '</head>');
    const marker = /<h2[^>]*>\s*Napi bejegyzések\s*<\/h2>/i;
    if(marker.test(out)) return out.replace(marker, block + '$&');
    return out.replace('</body>', block + '</body>');
  }

  // A teljes jóváhagyott saját példánynál is garantáltan bekerül a kérdés + AI elemzés.
  const oldDownload = window.v71DownloadApprovedHtml;
  const oldPrint = window.v71PrintApprovedReport;

  async function getApprovalRow(id){
    try { const r = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(r) return r; } catch(_) {}
    try {
      const st = (typeof detailState !== 'undefined' ? detailState : window.detailState || {});
      const pid = st?.project?.id || new URLSearchParams(location.search).get('id');
      const rows = await window.EpitesNaploAPI?.getReportApprovals?.(pid);
      return (rows || []).find(x => String(x.id) === String(id)) || null;
    } catch(_) { return null; }
  }

  function currentEntries(){
    try { return (typeof detailState !== 'undefined' && Array.isArray(detailState.entries)) ? detailState.entries : (Array.isArray(window.detailState?.entries) ? window.detailState.entries : []); } catch(_) { return []; }
  }

  async function enhancedHtml(id){
    const row = await getApprovalRow(id);
    let html = row?.approved_report_html || row?.report_html_snapshot || row?.report_html || '';
    if(!html || html.length < 500 || /tartalma nem található/i.test(html)) {
      // Ha a mentett snapshot üres, a v86 saját építőjére hagyatkozunk, de utána még kiegészítjük.
      if(typeof oldDownload === 'function') return null;
    }
    const extra = buildClientBlock(row || {}) + buildAiProfessionalBlock(currentEntries());
    return insertBeforeDaily(html, extra);
  }

  window.v71DownloadApprovedHtml = async function(id){
    try {
      const row = await getApprovalRow(id);
      let html = await enhancedHtml(id);
      if(!html && typeof oldDownload === 'function') return oldDownload(id);
      const name = ((document.querySelector('h1')?.textContent || 'epitesi-naplo') + '-jovahagyott-riport.html').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
      const blob = new Blob([html], {type:'text/html;charset=utf-8'});
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();}, 1500);
      try { await window.EpitesNaploAPI?.saveReportDocument?.({ projectId: (typeof detailState !== 'undefined' ? detailState?.project?.id : window.detailState?.project?.id), approvalId:id, title:'Jóváhagyott riport ügyfélkérdéssel és AI elemzéssel', type:'approved_full_copy_v87', html, text:document.body.innerText || '', meta:{ v87:true, client_comment:msgOf(row||{}) } }); } catch(_) {}
    } catch(e) { if(typeof oldDownload === 'function') return oldDownload(id); alert(e.message || e); }
  };

  window.v71PrintApprovedReport = async function(id){
    try {
      let html = await enhancedHtml(id);
      if(!html && typeof oldPrint === 'function') return oldPrint(id);
      const w = window.open('', '_blank'); if(!w) return alert('A böngésző blokkolta az új ablakot.');
      w.document.open(); w.document.write(html); w.document.close(); setTimeout(()=>{try{w.focus();w.print()}catch(_){}}, 800);
    } catch(e) { if(typeof oldPrint === 'function') return oldPrint(id); alert(e.message || e); }
  };

  // Ha új ügyfélriport link készül, a friss riport HTML-be is bekerül az AI szakmai blokk.
  const oldBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(typeof oldBuild === 'function'){
    const wrapped = function(entries, title, options){
      const html = oldBuild(entries, title, options);
      return insertBeforeDaily(html, buildAiProfessionalBlock(entries));
    };
    window.buildProReportHtml = wrapped;
    try { buildProReportHtml = wrapped; } catch(_) {}
  }
})();



// ===== beolvasztva V153-ba: project-v88-client-question-mobile-report-fix.js =====
// V88 - csak két javítás: ügyfél kérdés/észrevétel bekerül a teljes saját riportba + mobilos riportnézet javítása
(function(){
  if(window.__v88ClientQuestionMobileReportFix) return;
  window.__v88ClientQuestionMobileReportFix = true;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const pid = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const ptitle = () => state()?.project?.name || document.querySelector('h1')?.textContent || 'Építési napló';
  const msgOf = row => row?.client_comment || row?.message || row?.client_message || row?.approval_message || row?.question || row?.question_text || row?.note || row?.comment || '';
  const decisionOf = row => String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase();
  const labelOf = d => (d === 'accepted' || d === 'approved') ? 'Elfogadva / jóváhagyva' : d === 'question' ? 'Kérdése van' : 'Megtekintve';
  const rowDate = row => (typeof formatDate === 'function' ? formatDate(row?.approved_at || row?.created_at || '') : String(row?.approved_at || row?.created_at || '').replace('T',' ').slice(0,19));
  const safeName = v => String(v || 'riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'riport';
  const isBad = html => !html || String(html).length < 700 || /tartalma nem található|snapshot nem|adatok nem tolthetok|nem található/i.test(String(html));

  function mobileCss(){ return `<style id="v88MobileReportCss">
    html,body{max-width:100%;overflow-x:hidden}.publicReportCard,.report-card,.reportShell{max-width:min(1050px,calc(100vw - 20px))!important;box-sizing:border-box!important;overflow:hidden!important;margin-left:auto!important;margin-right:auto!important}
    #publicReportContent,#publicReportContent *{box-sizing:border-box;max-width:100%}#publicReportContent{overflow-wrap:anywhere;word-break:normal}
    #publicReportContent h1,h1{font-size:clamp(30px,9vw,62px)!important;line-height:1.06!important;word-break:break-word}#publicReportContent h2,h2{font-size:clamp(22px,6.5vw,34px)!important;line-height:1.15!important}#publicReportContent h3,h3{font-size:clamp(18px,5vw,26px)!important;line-height:1.2!important}
    #publicReportContent p,#publicReportContent li,#publicReportContent td,#publicReportContent th{font-size:clamp(14px,3.8vw,17px)!important;line-height:1.42!important}#publicReportContent img{height:auto!important;object-fit:cover}
    #publicReportContent table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important;display:table!important;overflow:visible!important}#publicReportContent th,#publicReportContent td{white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;padding:8px 6px!important;vertical-align:top!important}
    @media(max-width:640px){body{padding:0!important}.publicHero{padding:22px 14px!important}.publicHero h1{font-size:clamp(30px,10vw,48px)!important}.publicActions{display:flex!important;gap:8px!important;flex-wrap:wrap!important}.publicReportView{padding:12px!important}.publicReportCard{padding:14px!important;border-radius:16px!important}#publicReportContent table{font-size:14px!important}#publicReportContent th:nth-child(3),#publicReportContent td:nth-child(3){display:none!important}.v86ApprovalStamp,.v87ClientQuestion,.v87AiProfessional,.v88ClientQuestion,.v88AiProfessional{padding:12px!important;margin:14px 0!important}}
    @media print{html,body{overflow:visible!important}.publicReportCard{max-width:100%!important;overflow:visible!important}#publicReportContent th:nth-child(3),#publicReportContent td:nth-child(3){display:table-cell!important}}
  </style>`; }

  function aiFromEntry(e = {}){ return e.ai_json || e.analysis || e.ai || {}; }
  function clean(v){ return String(v || '').trim(); }
  function buildAiBlock(entries){
    entries = Array.isArray(entries) ? entries : [];
    const items = [];
    entries.forEach((e, idx) => {
      const ai = aiFromEntry(e);
      const title = clean(ai.title || e.ai_title || e.phase || e.title || ('Bejegyzés ' + (idx + 1)));
      const textParts = [ai.professionalSummary, ai.customerSummary, ai.photoTextCheck, ai.nextStep, e.ai_summary, e.ai_text].map(clean).filter(Boolean);
      const list = [];
      ['advice','checklist','risks','warnings','tasks'].forEach(k => { if(Array.isArray(ai[k])) ai[k].filter(Boolean).slice(0,4).forEach(x => list.push(x)); });
      const body = [];
      if(textParts[0]) body.push(`<p>${esc(textParts[0])}</p>`);
      if(list.length) body.push(`<ul>${list.slice(0,7).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`);
      if(body.length) items.push(`<article class="v88AiItem"><h3>${esc(title)}</h3>${body.join('')}</article>`);
    });
    const fallback = `<p>A riportban szereplő AI szakmai kontroll a kivitelezési folyamat fő ellenőrzési pontjait rögzíti. Különösen fontos: rétegrend, tömörítés, szint, lejtés, vízelvezetés, fotódokumentáció és a következő munkafázis előtti ellenőrzés.</p>`;
    return `<section class="v88AiProfessional"><h2>AI szakmai elemzés / kivitelezői megjegyzés</h2>${items.length ? items.join('') : fallback}</section>`;
  }
  function clientBlock(row){
    const msg = msgOf(row);
    if(!msg) return '';
    return `<section class="v88ClientQuestion"><h2>Ügyfél kérdése / észrevétele</h2><p>${esc(msg).replace(/\n/g,'<br>')}</p></section>`;
  }
  function extraCss(){ return `${mobileCss()}<style id="v88QuestionAiCss">
    .v88ClientQuestion{margin:22px 0;padding:16px 18px;border-left:5px solid #f59e0b;background:#fff7ed;border-radius:12px;color:#111827;break-inside:avoid;page-break-inside:avoid}.v88ClientQuestion h2{margin:0 0 8px;color:#111827}.v88ClientQuestion p{white-space:pre-wrap;margin:0;color:#111827}
    .v88AiProfessional{margin:22px 0;padding:16px 18px;border-left:5px solid #22c55e;background:#ecfdf5;border-radius:12px;color:#111827;break-inside:avoid;page-break-inside:avoid}.v88AiProfessional h2{margin:0 0 10px;color:#111827}.v88AiProfessional h3{margin:10px 0 6px;color:#111827}.v88AiProfessional p,.v88AiProfessional li{color:#111827}.v88AiItem{margin:10px 0;padding:10px 12px;background:#ffffff;border:1px solid #bbf7d0;border-radius:10px}
  </style>`; }
  function ensureHtml(html){
    let out = String(html || '');
    if(!/<!doctype|<html/i.test(out)) out = `<!doctype html><html lang="hu"><head><link rel="icon" type="image/png" sizes="192x192" href="https://epitesi-naplo.eu/favicon.png"><link rel="shortcut icon" href="https://epitesi-naplo.eu/favicon.ico"><link rel="apple-touch-icon" href="https://epitesi-naplo.eu/favicon.png"><meta name="theme-color" content="#0f172a"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ptitle())}</title></head><body>${out}</body></html>`;
    if(!/<meta name="viewport"/i.test(out)) out = out.replace('<head>', '<head><link rel="icon" type="image/png" sizes="192x192" href="https://epitesi-naplo.eu/favicon.png"><link rel="shortcut icon" href="https://epitesi-naplo.eu/favicon.ico"><link rel="apple-touch-icon" href="https://epitesi-naplo.eu/favicon.png"><meta name="theme-color" content="#0f172a"><meta name="viewport" content="width=device-width,initial-scale=1">');
    if(!out.includes('v88MobileReportCss')) out = out.includes('</head>') ? out.replace('</head>', extraCss() + '</head>') : out.replace('<body', `<head>${extraCss()}</head><body`);
    return out;
  }
  function insertBlocks(html, row, entries){
    let out = ensureHtml(html);
    const blocks = `${clientBlock(row)}${buildAiBlock(entries)}`;
    if(clientBlock(row) && !out.includes('v88ClientQuestion')){
      const marker = /<h2[^>]*>\s*(Napi bejegyzések|Munka közben|Vezetői AI összefoglaló)\s*<\/h2>/i;
      out = marker.test(out) ? out.replace(marker, clientBlock(row) + '$&') : out.replace('</body>', clientBlock(row) + '</body>');
    }
    if(!out.includes('v88AiProfessional')){
      const marker = /<h2[^>]*>\s*Napi bejegyzések\s*<\/h2>/i;
      out = marker.test(out) ? out.replace(marker, buildAiBlock(entries) + '$&') : out.replace('</body>', buildAiBlock(entries) + '</body>');
    }
    return out;
  }
  async function approvalRow(id){
    try{ const r = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(r) return r; }catch(_){}
    try{ const rows = await window.EpitesNaploAPI?.getReportApprovals?.(pid()); return (rows || []).find(r => String(r.id) === String(id)) || null; }catch(_){ return null; }
  }
  async function reportDoc(id){ try{ return await window.EpitesNaploAPI?.getReportDocumentByApproval?.(id); }catch(_){ return null; } }
  async function freshReportHtml(){
    const closeData = await window.EpitesNaploAPI?.getProjectCloseData?.(pid());
    const entries = closeData?.entries || state()?.entries || [];
    const builder = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
    if(typeof builder === 'function') return { html: builder(entries, `${ptitle()} – jóváhagyott riport`, closeData || {}), entries };
    return { html:`<!doctype html><html lang="hu"><head><link rel="icon" type="image/png" sizes="192x192" href="https://epitesi-naplo.eu/favicon.png"><link rel="shortcut icon" href="https://epitesi-naplo.eu/favicon.ico"><link rel="apple-touch-icon" href="https://epitesi-naplo.eu/favicon.png"><meta name="theme-color" content="#0f172a"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ptitle())}</title></head><body><h1>${esc(ptitle())}</h1><p>A riport pillanatnyilag nem építhető újra.</p></body></html>`, entries };
  }
  async function fullApprovedHtml(id){
    const row = await approvalRow(id);
    if(!row) throw new Error('Nem találom az ügyfél jóváhagyást. Frissítsd az oldalt.');
    let html = row.approved_report_html || row.report_html_snapshot || row.report_html || '';
    const doc = isBad(html) ? await reportDoc(id) : null;
    if(doc?.html_content && !isBad(doc.html_content)) html = doc.html_content;
    let entries = state()?.entries || [];
    if(isBad(html)){
      const fresh = await freshReportHtml();
      html = fresh.html;
      entries = fresh.entries || entries;
    }
    return { row, html: insertBlocks(html, row, entries) };
  }
  function downloadHtml(name, html){ const blob = new Blob([html || ''], {type:'text/html;charset=utf-8'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1500); }

  window.v71DownloadApprovedHtml = async function(id){
    try{
      const r = await fullApprovedHtml(id);
      downloadHtml(`${safeName(ptitle())}-${safeName(labelOf(decisionOf(r.row)))}-teljes-jovahagyott-riport.html`, r.html);
      try{ await window.EpitesNaploAPI?.saveReportDocument?.({ projectId:pid(), approvalId:id, title:`${ptitle()} – teljes jóváhagyott saját példány`, type:'approved_full_copy_v88', html:r.html, text:(new DOMParser().parseFromString(r.html,'text/html').body?.innerText || ''), meta:{ v88:true, decision:decisionOf(r.row), client_comment:msgOf(r.row) } }); }catch(e){ console.warn(e); }
      try{ if(typeof showToast === 'function') showToast('Teljes jóváhagyott riport letöltve és mentve.', 'ok'); }catch(_){}
    }catch(e){ alert(e.message || e); }
  };
  window.v71PrintApprovedReport = async function(id){
    try{
      const r = await fullApprovedHtml(id);
      const w = window.open('', '_blank'); if(!w) return alert('A böngésző blokkolta az új ablakot.');
      w.document.open(); w.document.write(r.html); w.document.close(); setTimeout(()=>{try{w.focus();w.print()}catch(_){}},800);
      try{ await window.EpitesNaploAPI?.saveReportDocument?.({ projectId:pid(), approvalId:id, title:`${ptitle()} – teljes jóváhagyott PDF példány`, type:'approved_full_pdf_v88', html:r.html, text:(new DOMParser().parseFromString(r.html,'text/html').body?.innerText || ''), meta:{ v88:true, decision:decisionOf(r.row), client_comment:msgOf(r.row) } }); }catch(_){}
    }catch(e){ alert(e.message || e); }
  };

  // Az újonnan készülő ügyfélriport HTML-je is mobilbarát legyen.
  const oldBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(typeof oldBuild === 'function' && !oldBuild.__v88Wrapped){
    const wrapped = function(entries, title, options){
      const html = oldBuild(entries, title, options);
      return ensureHtml(html);
    };
    wrapped.__v88Wrapped = true;
    window.buildProReportHtml = wrapped;
    try{ buildProReportHtml = wrapped; }catch(_){}
  }
})();



// ===== beolvasztva V153-ba: project-v103-final-report-pdf-speed-lightbox-fix.js =====
// ===== V103 FINAL: PDF üres oldal + dupla X + gyorsítás javítás =====
(function(){
  if(window.__epitesNaploV103FinalPdfSpeedLightboxFix) return;
  window.__epitesNaploV103FinalPdfSpeedLightboxFix = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeName = v => String(v || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  const state = () => window.detailState || {};
  const pid = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || 'local';
  const ptitle = () => state()?.project?.name || 'Építési napló';
  const toast = (msg,type='ok') => { try{ if(typeof window.showToast === 'function') window.showToast(msg,type); else console.log(msg); }catch(_){} };

  let lastButton = null;
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button,[role="button"],a.btn,[data-v71-download],[data-v71-print],[data-v79-approval-download],[data-v79-approval-print],[data-v80-approval-download],[data-v80-approval-print]');
    if(b){ lastButton = b; lastButton.__v103ClickTime = Date.now(); }
  }, true);

  function setBusy(btn, text){
    if(!btn) return () => {};
    const oldHtml = btn.innerHTML;
    const oldDisabled = btn.disabled;
    btn.disabled = true;
    btn.classList.add('is-loading','v103-loading');
    btn.setAttribute('aria-busy','true');
    btn.innerHTML = `<span class="v103-spinner" aria-hidden="true"></span>${esc(text || 'Dolgozom…')}`;
    return () => { btn.disabled = oldDisabled; btn.classList.remove('is-loading','v103-loading'); btn.removeAttribute('aria-busy'); btn.innerHTML = oldHtml; };
  }
  function currentBtn(){ return (document.activeElement && document.activeElement.tagName === 'BUTTON') ? document.activeElement : lastButton; }

  const pageCss = document.createElement('style');
  pageCss.textContent = `.v103-loading{opacity:.85!important;cursor:wait!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important}.v103-spinner{width:15px;height:15px;border:2px solid currentColor;border-right-color:transparent;border-radius:999px;display:inline-block;animation:v103spin .75s linear infinite}@keyframes v103spin{to{transform:rotate(360deg)}}`;
  document.head.appendChild(pageCss);

  // Az élő oldalon is csak egy képnéző maradhat: régi V100/V102 dobozokat egy kattintással bezárjuk.
  document.addEventListener('click', function(e){
    const close = e.target.closest && e.target.closest('.v77Lightbox button,.v100Lightbox button,.v102Lightbox button,.v103Lightbox button');
    if(close){ e.preventDefault(); e.stopPropagation(); document.querySelectorAll('.v77Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox').forEach(x=>x.remove()); }
  }, true);


  function reportCss(){ return `<style id="v103-report-css">
*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{font-family:Arial,Helvetica,sans-serif!important;color:#111827!important;background:#fff!important;margin:0!important;padding:24px!important;line-height:1.48!important}.doc,.reportDoc,.publicReportCard,.report-card,.reportShell{max-width:1050px!important;margin:0 auto!important;background:#fff!important;color:#111827!important;overflow:visible!important}.cover{border-bottom:4px solid #f59e0b!important;margin-bottom:18px!important;padding-bottom:14px!important}.stats{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:10px!important;margin:14px 0!important}.stat{background:#f8fafc!important;border:1px solid #e5e7eb!important;border-radius:12px!important;padding:12px!important}.stat b{display:block!important;color:#d97706!important;font-size:22px!important}.entry{break-inside:avoid!important;page-break-inside:avoid!important;border:1px solid #e5e7eb!important;border-left:5px solid #f59e0b!important;background:#fafafa!important;border-radius:14px!important;margin:16px 0!important;padding:14px 16px!important}.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhotos,.v68ReportPhotos,.v74Photos,.v77Photos{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(118px,118px))!important;gap:12px!important;align-items:start!important;justify-content:start!important}.reportMediaTile,.v67ReportPhoto,.v74Photo,.v77Photo,.photos figure,figure,.photo{width:118px!important;max-width:118px!important;background:#fff!important;border:1px solid #d1d5db!important;border-radius:12px!important;padding:5px!important;margin:0!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}.reportMediaTile img,.v67ReportPhoto img,.v74Photo img,.v77Photo img,.photos img,.entryImageGrid img,.reportImageGrid img,figure img,img.reportPhoto{display:block!important;width:106px!important;max-width:106px!important;height:106px!important;max-height:106px!important;object-fit:cover!important;border-radius:8px!important;cursor:zoom-in!important;background:#f8fafc!important}.entryVideoGrid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;gap:12px!important}.entryVideoGrid video,.reportMediaTile video{width:100%!important;max-height:300px!important;border-radius:10px!important;background:#111!important}table{width:100%!important;border-collapse:collapse!important}td,th{border-bottom:1px solid #e5e7eb!important;text-align:left!important;padding:8px!important;white-space:normal!important;overflow-wrap:anywhere!important}.v103ApprovalStamp{border:2px solid #22c55e!important;background:#ecfdf5!important;border-radius:14px!important;padding:14px 16px!important;margin:0 0 18px!important;break-inside:avoid!important;page-break-inside:avoid!important}.v103Lightbox{position:fixed!important;inset:0!important;background:rgba(2,6,23,.92)!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:999999!important;padding:18px!important}.v103Lightbox img{max-width:94vw!important;max-height:88vh!important;width:auto!important;height:auto!important;object-fit:contain!important;border-radius:12px!important;background:#111!important}.v103Lightbox button{position:fixed!important;right:16px!important;top:14px!important;border:0!important;border-radius:999px!important;background:#fbbf24!important;color:#111827!important;font-size:22px!important;font-weight:900!important;padding:8px 13px!important;cursor:pointer!important}@media(max-width:720px){body{padding:12px!important}.stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhotos,.v68ReportPhotos,.v74Photos,.v77Photos{grid-template-columns:repeat(2,118px)!important}h1{font-size:30px!important;line-height:1.08!important}h2{font-size:23px!important;line-height:1.15!important}}@media print{@page{size:A4;margin:12mm}body{padding:0!important;background:#fff!important}.v103Lightbox{display:none!important}.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhotos,.v68ReportPhotos,.v74Photos,.v77Photos{grid-template-columns:repeat(4,32mm)!important;gap:5mm!important}.reportMediaTile,.v67ReportPhoto,.v74Photo,.v77Photo,.photos figure,figure,.photo{width:32mm!important;max-width:32mm!important;padding:1mm!important}.reportMediaTile img,.v67ReportPhoto img,.v74Photo img,.v77Photo img,.photos img,.entryImageGrid img,.reportImageGrid img,figure img,img.reportPhoto{width:30mm!important;max-width:30mm!important;height:30mm!important;max-height:30mm!important}.entry{page-break-inside:avoid!important;break-inside:avoid!important}.reportMediaOpen,.reportMediaPending{display:none!important}}
</style>`; }
  function lightboxScript(){ return `<script id="v103-report-lightbox-script">(function(){if(window.__epitesNaploReportLightboxV103)return;window.__epitesNaploReportLightboxV103=true;function closeAll(){document.querySelectorAll('.v77Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox').forEach(function(x){x.remove();});}document.addEventListener('click',function(e){var close=e.target&&e.target.closest&&e.target.closest('.v103Lightbox button,.v102Lightbox button,.v100Lightbox button,.v77Lightbox button');if(close){e.preventDefault();e.stopPropagation();closeAll();return;}var oldBox=e.target&&e.target.closest&&e.target.closest('.v77Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox');if(oldBox&&e.target===oldBox){e.preventDefault();e.stopPropagation();closeAll();return;}var img=e.target&&e.target.closest&&e.target.closest('img');if(!img||img.closest('.v77Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox'))return;var src=img.getAttribute('data-full-src')||img.currentSrc||img.src;if(!src)return;e.preventDefault();e.stopPropagation();closeAll();var box=document.createElement('div');box.className='v103Lightbox';box.innerHTML='<button type="button" aria-label="Bezárás">×</button><img alt="Nagyított napló kép">';box.querySelector('img').src=src;document.body.appendChild(box);},true);document.addEventListener('keydown',function(e){if(e.key==='Escape')closeAll();});})();<\/script>`; }
  function ensureFullHtml(html){
    let out = String(html || '');
    // Régi V77/V100/V102 lightbox scriptek kiszedése, különben két bezáró X és dupla kattintás lesz.
    out = out.replace(/<script[^>]*>[\s\S]*?(?:v77Lightbox|v100Lightbox|v102Lightbox|v103Lightbox|v100-report-lightbox|v102-report-lightbox)[\s\S]*?<\/script>/gi, '');
    out = out.replace(/<style[^>]*>[\s\S]*?(?:v100Lightbox|v102Lightbox)[\s\S]*?<\/style>/gi, '');
    if(!/<!doctype|<html/i.test(out)) out = `<!doctype html><html lang="hu"><head><link rel="icon" type="image/png" sizes="192x192" href="https://epitesi-naplo.eu/favicon.png"><link rel="shortcut icon" href="https://epitesi-naplo.eu/favicon.ico"><link rel="apple-touch-icon" href="https://epitesi-naplo.eu/favicon.png"><meta name="theme-color" content="#0f172a"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${out}</body></html>`;
    if(!/<meta name="viewport"/i.test(out)) out = out.replace(/<head[^>]*>/i, m => m + '<meta name="viewport" content="width=device-width,initial-scale=1">');
    if(!out.includes('v103-report-css')) out = out.includes('</head>') ? out.replace('</head>', reportCss() + '</head>') : out.replace(/<body/i, '<head>' + reportCss() + '</head><body');
    if(!out.includes('v103-report-lightbox-script')) out = out.includes('</body>') ? out.replace('</body>', lightboxScript() + '</body>') : out + lightboxScript();
    out = out.replace(/<img\b([^>]*?)>/gi, function(match, attrs){
      if(/data-v103-fixed/i.test(attrs)) return match;
      const srcMatch = attrs.match(/\s(?:src|data-full-src)=["']([^"']+)["']/i);
      const src = srcMatch ? srcMatch[1] : '';
      let fixed = attrs + ' data-v103-fixed="1"';
      if(src && !/data-full-src=/i.test(attrs)) fixed += ` data-full-src="${esc(src)}"`;
      if(!/loading=/i.test(attrs)) fixed += ' loading="eager"';
      return `<img${fixed}>`;
    });
    return out;
  }
  function downloadHtml(name, html){ const blob = new Blob([ensureFullHtml(html)], {type:'text/html;charset=utf-8'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1500); }
  async function waitImages(root){ await Promise.all([...root.querySelectorAll('img')].filter(i=>i.src).map(img => (img.complete && img.naturalWidth>0) ? Promise.resolve() : new Promise(res=>{img.onload=img.onerror=res; setTimeout(res,6000);}))); }
  async function exportPdfFromHtml(html, filename){
    const full = ensureFullHtml(html);
    // Nyomtatás/PDF: új ablakban stabilabb, nem ad üres oldalt, és a felhasználó Mentés PDF-be opcióval menti.
    // Az előző html2pdf mód sok képnél és offscreen rendernél néha teljesen üres PDF-et készített.
    const w = window.open('', '_blank');
    if(!w){
      // Ha popup-blokk van, akkor próbálunk közvetlen HTML letöltést adni, ne vesszen el a riport.
      downloadHtml(filename.replace(/\.pdf$/i,'.html'), full);
      alert('A böngésző blokkolta a PDF/nyomtatás ablakot. HTML riportot letöltöttem, azt Edge/Chrome alatt meg tudod nyitni és Ctrl+P → Mentés PDF-ként.');
      return;
    }
    w.document.open();
    w.document.write(full.replace('</body>', `<script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},700);});<\/script></body>`));
    w.document.close();
  }

  const oldBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(typeof oldBuild === 'function' && !oldBuild.__v103Wrapped){ const wrapped = function(entries,title,options){ return ensureFullHtml(oldBuild(entries,title,options)); }; wrapped.__v103Wrapped=true; window.buildProReportHtml=wrapped; try{ buildProReportHtml=wrapped; }catch(_){} }

  async function getCloseData(){ try{ return await window.EpitesNaploAPI?.getProjectCloseData?.(pid()); }catch(e){ console.warn('V103 adatlekérés hiba:', e); } return {entries:state()?.entries||[],materials:[],invoices:[]}; }
  async function buildCurrentReport(titleSuffix, weekly){ const data=await getCloseData(); let entries=data?.entries || state()?.entries || []; if(weekly){ const from=new Date(); from.setDate(from.getDate()-7); entries=entries.filter(e=>new Date(e.created_at||0)>=from); } const title=`${ptitle()} – ${titleSuffix}`; const builder=window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null); const html=builder ? builder(entries,title,data||{}) : `<h1>${esc(title)}</h1><p>Nincs elérhető riportépítő.</p>`; return {title,html:ensureFullHtml(html)}; }
  async function saveDoc(title,type,html,meta){ try{ await window.EpitesNaploAPI?.saveReportDocument?.({projectId:pid(),title,type,html:ensureFullHtml(html),text:(new DOMParser().parseFromString(html,'text/html').body?.innerText||'').slice(0,200000),meta:meta||{v103:true}}); }catch(e){ console.warn('V103 riport mentés hiba:', e); } try{ if(typeof window.v77RenderSavedReports==='function') await window.v77RenderSavedReports(); }catch(_){} }
  function wrap(name,label,fn){ window[name]=async function(...args){ const done=setBusy(currentBtn(),label); try{return await fn.apply(this,args);} finally{done();} }; try{ eval(name + ' = window[name]'); }catch(_){} }

  wrap('downloadWeeklyReportHtml','Heti HTML készül…',async()=>{ const r=await buildCurrentReport('heti építési napló',true); await saveDoc(r.title,'weekly_html_v103',r.html,{v103:true,range:'last_7_days'}); downloadHtml(`${safeName(r.title)}.html`,r.html); toast('Heti HTML riport elkészült.'); });
  wrap('downloadClosingReportHtml','Lezáró HTML készül…',async()=>{ const r=await buildCurrentReport('lezáró építési napló',false); await saveDoc(r.title,'closing_html_v103',r.html,{v103:true,all:true}); downloadHtml(`${safeName(r.title)}.html`,r.html); toast('Lezáró HTML riport elkészült.'); });
  wrap('printWeeklyReport','Heti PDF készül…',async()=>{ const r=await buildCurrentReport('heti PRO építési napló',true); await saveDoc(r.title,'weekly_pdf_v103',r.html,{v103:true,range:'last_7_days'}); await exportPdfFromHtml(r.html,`${safeName(r.title)}.pdf`); toast('Heti PDF riport elkészült.'); });
  wrap('exportWeeklyPdfV25','Heti PDF készül…',window.printWeeklyReport);
  wrap('exportClosingPdfV25','Lezáró PDF készül…',async()=>{ const r=await buildCurrentReport('lezáró PRO építési napló',false); await saveDoc(r.title,'closing_pdf_v103',r.html,{v103:true,all:true}); await exportPdfFromHtml(r.html,`${safeName(r.title)}.pdf`); toast('Lezáró PDF riport elkészült.'); });
  wrap('printClosingDocument','Lezáró PDF készül…',window.exportClosingPdfV25);

  function isBad(html){ const t=String(html||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); return !t.trim() || t.length<350 || t.includes('riport tartalma nem talalhato') || t.includes('adatok nem tolthetok') || t.includes('hianyzo riport'); }
  async function approvalRow(id){ try{ const r=await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(r) return r; }catch(_){} try{ const rows=await window.EpitesNaploAPI?.getReportApprovals?.(pid()); return (rows||[]).find(r=>String(r.id)===String(id))||null; }catch(_){} return null; }
  async function approvedHtml(id){ const row=await approvalRow(id); if(!row) throw new Error('Nem találom a jóváhagyott riportot. Frissítsd az oldalt.'); let html=row.approved_report_html||row.report_html_snapshot||row.report_html||row.html_content||row.html||''; if(isBad(html)){ try{ const doc=await window.EpitesNaploAPI?.getReportDocumentByApproval?.(id); if(doc?.html_content&&!isBad(doc.html_content)) html=doc.html_content; }catch(_){} } if(isBad(html)){ const fresh=await buildCurrentReport('jóváhagyott riport',false); html=fresh.html; } const decision=String(row.decision||row.status||(row.approved?'approved':'viewed')).toLowerCase(); const label=decision==='question'?'Kérdése van':(decision==='accepted'||decision==='approved')?'Elfogadva / jóváhagyva':'Megtekintve'; const msg=String(row.client_comment||row.message||row.client_message||row.question||row.note||'').trim(); const stamp=`<section class="v103ApprovalStamp"><h2>Ügyfél visszajelzés</h2><p><b>Állapot:</b> ${esc(label)}</p>${msg?`<p><b>Ügyfél megjegyzése:</b><br>${esc(msg).replace(/\n/g,'<br>')}</p>`:''}</section>`; html=ensureFullHtml(html); if(!html.includes('v103ApprovalStamp')) html=html.replace(/<body[^>]*>/i,m=>m+stamp); return {row,html:ensureFullHtml(html),label}; }
  wrap('v71DownloadApprovedHtml','Jóváhagyott HTML készül…',async(id)=>{ const r=await approvedHtml(id); await saveDoc(`${ptitle()} – jóváhagyott saját példány`,'approved_html_v103',r.html,{v103:true,approvalId:id,label:r.label}); downloadHtml(`${safeName(ptitle())}-${safeName(r.label)}-jovahagyott-riport.html`,r.html); toast('Jóváhagyott HTML riport letöltve.'); });
  wrap('v71PrintApprovedReport','Jóváhagyott PDF készül…',async(id)=>{ const r=await approvedHtml(id); await saveDoc(`${ptitle()} – jóváhagyott PDF példány`,'approved_pdf_v103',r.html,{v103:true,approvalId:id,label:r.label}); await exportPdfFromHtml(r.html,`${safeName(ptitle())}-${safeName(r.label)}-jovahagyott-riport.pdf`); toast('Jóváhagyott PDF riport elkészült.'); });
  document.addEventListener('click',function(e){ const btn=e.target.closest&&e.target.closest('[data-v80-approval-download],[data-v79-approval-download],[data-v71-download],[data-v80-approval-print],[data-v79-approval-print],[data-v71-print]'); if(!btn)return; e.preventDefault(); e.stopImmediatePropagation(); const id=btn.getAttribute('data-v80-approval-download')||btn.getAttribute('data-v79-approval-download')||btn.getAttribute('data-v71-download')||btn.getAttribute('data-v80-approval-print')||btn.getAttribute('data-v79-approval-print')||btn.getAttribute('data-v71-print'); lastButton=btn; lastButton.__v103ClickTime=Date.now(); if(btn.hasAttribute('data-v80-approval-download')||btn.hasAttribute('data-v79-approval-download')||btn.hasAttribute('data-v71-download')) window.v71DownloadApprovedHtml(id); else window.v71PrintApprovedReport(id); },true);
  console.log('ÉpítésNapló V103 PDF/dupla-X/gyorsítás javítás aktív.');
})();



// ===== beolvasztva V153-ba: project-v105-login-safe-weekly-lightbox-fix.js =====
// ===== V105 LOGIN-SAFE: heti PDF képek + lapozós képnéző, belépés érintése nélkül =====
(function(){
  if(window.__epitesNaploV105LoginSafeFix) return;
  window.__epitesNaploV105LoginSafeFix = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeName = v => String(v || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  const state = () => window.detailState || {};
  const pid = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || 'local';
  const ptitle = () => state()?.project?.name || 'Építési napló';
  const toast = (msg,type='ok') => { try{ if(typeof window.showToast === 'function') window.showToast(msg,type); else console.log(msg); }catch(_){} };

  const css = document.createElement('style');
  css.textContent = `
    .v105-loading{opacity:.86!important;cursor:wait!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important}
    .v105-spinner{width:15px;height:15px;border:2px solid currentColor;border-right-color:transparent;border-radius:999px;display:inline-block;animation:v105spin .75s linear infinite}@keyframes v105spin{to{transform:rotate(360deg)}}
    .v105Lightbox{position:fixed;inset:0;z-index:2147483647;background:rgba(2,6,23,.93);display:flex;align-items:center;justify-content:center;padding:58px 18px 34px}
    .v105Lightbox img{max-width:min(94vw,1100px);max-height:82vh;object-fit:contain;border-radius:14px;background:#111;box-shadow:0 20px 80px rgba(0,0,0,.55)}
    .v105Close,.v105Prev,.v105Next{position:fixed;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:900;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.33)}
    .v105Close{right:18px;top:16px;padding:10px 14px;font-size:20px}.v105Prev,.v105Next{top:50%;transform:translateY(-50%);width:46px;height:46px;font-size:28px;display:flex;align-items:center;justify-content:center}.v105Prev{left:18px}.v105Next{right:18px}
    .v105Counter{position:fixed;left:50%;top:18px;transform:translateX(-50%);background:rgba(15,23,42,.86);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:999px;padding:7px 12px;font-weight:800;font-size:13px}
    @media(max-width:720px){.v105Prev,.v105Next{width:40px;height:40px;font-size:24px}.v105Prev{left:8px}.v105Next{right:8px}.v105Lightbox{padding-left:8px;padding-right:8px}.v105Lightbox img{max-width:88vw;max-height:78vh}}
  `;
  document.head.appendChild(css);

  function srcOf(img){ return img?.getAttribute?.('data-full-src') || img?.getAttribute?.('data-src') || img?.currentSrc || img?.src || ''; }
  function visiblePhoto(img){ return img && srcOf(img) && img.offsetWidth > 34 && img.offsetHeight > 34 && !img.closest('.v105Lightbox,.v103Lightbox,.v102Lightbox,.v100Lightbox,.v77Lightbox,header,nav'); }
  function collectImages(start){
    const entry = start?.closest?.('.timelineEntry,.daily-entry,.naplo-card,.entry,.v74Entry,article,section,.card');
    let imgs = entry ? Array.from(entry.querySelectorAll('img')).filter(visiblePhoto) : [];
    if(imgs.length < 2) imgs = Array.from(document.querySelectorAll('img')).filter(visiblePhoto);
    const seen = new Set();
    return imgs.map(srcOf).filter(src => { if(!src || seen.has(src)) return false; seen.add(src); return true; });
  }
  function closeAll(){ document.querySelectorAll('.v105Lightbox,.v103Lightbox,.v102Lightbox,.v100Lightbox,.v77Lightbox').forEach(x=>x.remove()); }
  function openBox(list, index){
    if(!list || !list.length) return;
    let idx = Math.max(0, Math.min(index || 0, list.length - 1));
    closeAll();
    const box = document.createElement('div'); box.className='v105Lightbox';
    function render(){
      box.innerHTML = `<button class="v105Close" type="button" aria-label="Bezárás">×</button><div class="v105Counter">${idx+1} / ${list.length}</div>${list.length>1?'<button class="v105Prev" type="button" aria-label="Előző kép">‹</button><button class="v105Next" type="button" aria-label="Következő kép">›</button>':''}<img alt="Nagyított napló fotó">`;
      box.querySelector('img').src = list[idx];
      box.querySelector('.v105Close').onclick = ev => { ev.preventDefault(); ev.stopPropagation(); closeAll(); };
      const p = box.querySelector('.v105Prev'), n = box.querySelector('.v105Next');
      if(p) p.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); idx=(idx-1+list.length)%list.length; render(); };
      if(n) n.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); idx=(idx+1)%list.length; render(); };
    }
    box.addEventListener('click', e => { if(e.target === box) closeAll(); });
    document.addEventListener('keydown', function key(e){
      if(!document.body.contains(box)){ document.removeEventListener('keydown', key); return; }
      if(e.key === 'Escape') closeAll();
      if(e.key === 'ArrowLeft'){ idx=(idx-1+list.length)%list.length; render(); }
      if(e.key === 'ArrowRight'){ idx=(idx+1)%list.length; render(); }
    });
    render(); document.body.appendChild(box);
  }

  // Csak képre és „Nagy nézet” gombra figyel. Belépés / mentés / admin gombokat nem érint.
  document.addEventListener('click', function(e){
    const close = e.target.closest && e.target.closest('.v105Close,.v103Lightbox button,.v102Lightbox button,.v100Lightbox button,.v77Lightbox button');
    if(close){ e.preventDefault(); e.stopPropagation(); closeAll(); return; }
    const img = e.target.closest && e.target.closest('img');
    if(img && visiblePhoto(img)){
      const list = collectImages(img), src = srcOf(img), idx = Math.max(0, list.indexOf(src));
      if(list.length){ e.preventDefault(); e.stopPropagation(); openBox(list, idx); }
      return;
    }
    const btn = e.target.closest && e.target.closest('button');
    const txt = (btn?.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(btn && (txt.includes('nagy nezet') || txt.includes('nagyit'))){
      const list = collectImages(btn);
      if(list.length){ e.preventDefault(); e.stopPropagation(); openBox(list, 0); }
    }
  }, true);

  function getEntryMedia(e){
    let images = [];
    try{ if(typeof window.getEntryImages === 'function') images = window.getEntryImages(e) || []; }catch(_){}
    images = images.concat(
      Array.isArray(e?.images) ? e.images : [],
      Array.isArray(e?.image_urls) ? e.image_urls : [],
      Array.isArray(e?.photo_urls) ? e.photo_urls : [],
      Array.isArray(e?.photos) ? e.photos : [],
      Array.isArray(e?.beforeImages) ? e.beforeImages : [],
      Array.isArray(e?.afterImages) ? e.afterImages : [],
      Array.isArray(e?.generalImages) ? e.generalImages : [],
      e?.image_url ? [e.image_url] : [], e?.photo_url ? [e.photo_url] : [], e?.image ? [e.image] : []
    );
    images = images.map(x => typeof x === 'string' ? x : (x?.url || x?.src || x?.publicUrl || x?.signedUrl || x?.path || '')).filter(Boolean);
    return [...new Set(images)];
  }
  function keyOf(e){ return String(e?.id || e?.entry_id || ((e?.created_at||e?.date||'')+'|'+(e?.phase||'')+'|'+(e?.note||e?.description||'').slice(0,60))); }
  function mergeEntries(a,b){
    const map = new Map();
    [...(a||[]), ...(b||[])].forEach(e => {
      if(!e) return; const k=keyOf(e); const old=map.get(k)||{};
      const imgs = [...new Set([...getEntryMedia(old), ...getEntryMedia(e)])];
      const merged = {...old, ...e}; if(imgs.length) merged.images = imgs; map.set(k, merged);
    });
    return Array.from(map.values()).sort((x,y)=>new Date(y.created_at||y.date||0)-new Date(x.created_at||x.date||0));
  }
  function ensureImagesVisible(html){
    let out = String(html || '');
    out = out.replace(/<img\b([^>]*?)>/gi, (m, attrs) => {
      let a = attrs;
      if(!/loading=/i.test(a)) a += ' loading="eager"'; else a = a.replace(/loading=["']lazy["']/i,'loading="eager"');
      if(!/decoding=/i.test(a)) a += ' decoding="async"';
      return `<img${a}>`;
    });
    return out;
  }
  async function getCloseDataSafe(){
    try{ return await window.EpitesNaploAPI?.getProjectCloseData?.(pid()); }catch(e){ console.warn('V105 adatlekérés hiba:', e); }
    return {entries:state()?.entries || [], materials:[], invoices:[]};
  }
  async function saveDoc(title,type,html,meta){
    try{ await window.EpitesNaploAPI?.saveReportDocument?.({projectId:pid(), title, type, html, text:(new DOMParser().parseFromString(html,'text/html').body?.innerText||'').slice(0,200000), meta:meta||{v105:true}}); }catch(e){ console.warn('V105 riport mentés hiba:', e); }
    try{ if(typeof window.v77RenderSavedReports === 'function') await window.v77RenderSavedReports(); }catch(_){}
  }
  function setBusy(btn, label){
    if(!btn) return () => {};
    const old=btn.innerHTML, dis=btn.disabled; btn.disabled=true; btn.classList.add('v105-loading'); btn.setAttribute('aria-busy','true'); btn.innerHTML=`<span class="v105-spinner"></span>${esc(label)}`;
    return () => { btn.disabled=dis; btn.classList.remove('v105-loading'); btn.removeAttribute('aria-busy'); btn.innerHTML=old; };
  }
  async function buildWeekly(){
    const data = await getCloseDataSafe();
    const entries = mergeEntries(Array.isArray(data?.entries)?data.entries:[], Array.isArray(state()?.entries)?state().entries:[]);
    const from = new Date(); from.setDate(from.getDate()-7);
    const weekly = entries.filter(e => new Date(e.created_at || e.date || 0) >= from);
    const title = `${ptitle()} – heti PRO építési napló`;
    const builder = window.buildProReportHtml || window.v74BuildReportHtml;
    let html = typeof builder === 'function' ? builder(weekly, title, {...(data||{}), entries:weekly}) : `<h1>${esc(title)}</h1><p>Nincs elérhető riportépítő.</p>`;
    html = ensureImagesVisible(html);
    return {title, html, countImages: weekly.reduce((sum,e)=>sum+getEntryMedia(e).length,0)};
  }
  async function printHtml(html){
    if(typeof window.__v103ExportPdfFromHtml === 'function') return window.__v103ExportPdfFromHtml(html);
    const w = window.open('', '_blank');
    if(!w){ alert('A böngésző blokkolta a PDF ablakot. Engedélyezd a felugró ablakot.'); return; }
    const script = `<script>(function(){function p(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},700)}function wimg(){var imgs=Array.from(document.images||[]);if(!imgs.length)return p();var left=imgs.length,done=false;function one(){if(done)return;left--;if(left<=0){done=true;p();}}imgs.forEach(function(i){if(i.complete)one();else{i.onload=one;i.onerror=one;}});setTimeout(function(){if(!done){done=true;p();}},9000)}window.addEventListener('load',wimg);})();<\/script>`;
    w.document.open(); w.document.write(String(html).replace('</body>', script + '</body>')); w.document.close();
  }

  window.printWeeklyReport = async function(){
    const btn = document.activeElement && document.activeElement.tagName === 'BUTTON' ? document.activeElement : null;
    const done = setBusy(btn, 'Heti PDF készül…');
    try{ const r = await buildWeekly(); await saveDoc(r.title,'weekly_pdf_v105',r.html,{v105:true,images:r.countImages}); await printHtml(r.html); toast('Heti PDF riport elkészült.'); }
    finally{ done(); }
  };
  window.exportWeeklyPdfV25 = window.printWeeklyReport;

  console.log('ÉpítésNapló V105 login-safe heti PDF/képlapozó javítás aktív.');
})();



// ===== beolvasztva V153-ba: project-v109-client-feedback-reply-fix.js =====
/* V109 - ügyfél visszajelzés + saját példány + válasz fix
   Fontos: login/Supabase alapbeállításokhoz nem nyúl.
   Megtartja a V108 galéria/ikon/OG javításait, és külön rétegként kezeli a riport visszajelzéseket.
*/
(function(){
  'use strict';
  if(window.__epitesNaploV109FeedbackReplyFix) return;
  window.__epitesNaploV109FeedbackReplyFix = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Építési napló projekt';
  const fmt = v => {
    if(!v) return '';
    try { return new Date(v).toLocaleString('hu-HU'); } catch(_) { return String(v).replace('T',' ').slice(0,19); }
  };
  const decisionOf = row => String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase();
  const labelOf = d => (d === 'accepted' || d === 'approved') ? 'Jóváhagyva / elfogadva' : (d === 'question' ? 'Kérdése van' : 'Megtekintve');
  const badgeClass = d => (d === 'question' ? 'warn' : ((d === 'accepted' || d === 'approved') ? 'ok' : 'info'));
  const messageOf = row => String(row?.client_comment || row?.message || row?.client_message || row?.approval_message || row?.question || row?.question_text || row?.note || row?.comment || '').trim();

  function toast(msg, type){
    if(typeof showToast === 'function') return showToast(msg, type || 'ok');
    const box = document.getElementById('toast');
    if(box){ box.textContent = msg; box.className = 'toast'; setTimeout(()=>box.classList.add('hidden'), 2800); }
    else alert(msg);
  }

  function ensureCss(){
    if(document.getElementById('v109-feedback-css')) return;
    const s = document.createElement('style');
    s.id = 'v109-feedback-css';
    s.textContent = `
      .v109FeedbackBox{margin:18px 0;padding:18px;border-radius:18px;background:linear-gradient(135deg,#071827,#0f2f46);border:1px solid rgba(251,191,36,.28);box-shadow:0 16px 36px rgba(0,0,0,.22);color:#e5eef8}
      .v109FeedbackBox h3{margin:0 0 6px;color:#fff}.v109FeedbackBox .muted{color:#b6c7d8!important}
      .v109FeedbackRow{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:flex-start;margin:12px 0;padding:13px;border-radius:14px;background:rgba(15,38,56,.88);border:1px solid rgba(148,163,184,.24)}
      .v109FeedbackMeta{font-size:13px;color:#b6c7d8;margin-top:4px}.v109FeedbackMsg{margin:9px 0 0;padding:10px;border-radius:12px;background:#17344a;border:1px solid rgba(251,191,36,.25);color:#f8fafc;white-space:pre-wrap}
      .v109FeedbackActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.v109FeedbackActions .btn{white-space:nowrap}.v109ReplySaved{margin-top:8px;color:#86efac;font-weight:700}
      .tag.warn{background:#f59e0b!important;color:#111827!important}.tag.ok{background:#22c55e!important;color:#052e16!important}.tag.info{background:#38bdf8!important;color:#082f49!important}
      @media(max-width:760px){.v109FeedbackRow{grid-template-columns:1fr}.v109FeedbackActions{justify-content:flex-start}.v109FeedbackActions .btn{width:100%}}
    `;
    document.head.appendChild(s);
  }

  function ensureBox(){
    ensureCss();
    let box = document.getElementById('v109FeedbackBox');
    if(box) return box;
    box = document.createElement('div');
    box.id = 'v109FeedbackBox';
    box.className = 'v109FeedbackBox';
    const host = document.getElementById('v79ApprovalsBox') || document.getElementById('v75SavedReportsBox') || document.getElementById('v74DocumentsBox') || document.getElementById('projectSummaryBox') || document.querySelector('.projectSummaryCard') || document.querySelector('main .card');
    if(host) host.insertAdjacentElement('afterend', box);
    else document.querySelector('main')?.prepend(box);
    return box;
  }

  async function loadRows(){
    const pid = projectId();
    if(!pid || !window.EpitesNaploAPI?.getReportApprovals) return [];
    const rows = await window.EpitesNaploAPI.getReportApprovals(pid);
    return Array.isArray(rows) ? rows : [];
  }

  function rowHtml(row){
    const d = decisionOf(row);
    const msg = messageOf(row);
    const id = esc(row.id || '');
    const who = row.client_name || row.client_email || 'Ügyfél';
    const email = row.client_email || '';
    return `<div class="v109FeedbackRow" data-v109-row="${id}">
      <div>
        <span class="tag ${badgeClass(d)}">${esc(labelOf(d))}</span>
        <div class="v109FeedbackMeta">${esc(fmt(row.approved_at || row.created_at))} · ${esc(who)}${email ? ' · ' + esc(email) : ''}</div>
        ${msg ? `<div class="v109FeedbackMsg"><b>Kérdés / megjegyzés:</b><br>${esc(msg)}</div>` : '<p class="muted">Nincs megjegyzés.</p>'}
        <div id="v109ReplySaved-${id}" class="v109ReplySaved" hidden></div>
      </div>
      <div class="v109FeedbackActions">
        <button class="btn small primary" type="button" data-v109-copy="${id}">Saját példány HTML</button>
        <button class="btn small ghost" type="button" data-v109-pdf="${id}">PDF / nyomtatás</button>
        ${msg ? `<button class="btn small ghost" type="button" data-v109-reply="${id}">Válasz rögzítése</button>` : ''}
      </div>
    </div>`;
  }

  async function render(){
    const box = ensureBox();
    if(!box) return;
    const pid = projectId();
    if(!pid){ box.innerHTML = '<h3>Ügyfél visszajelzések</h3><p class="muted">Nincs kiválasztott projekt.</p>'; return; }
    box.innerHTML = '<h3>Ügyfél visszajelzések és kérdések</h3><p class="muted">Betöltés...</p>';
    try{
      const rows = await loadRows();
      if(!rows.length){
        box.innerHTML = '<h3>Ügyfél visszajelzések és kérdések</h3><p class="muted">Még nincs ügyfél visszajelzés ehhez a projekthez. Ha az ügyfél a riportban a Megnéztem / Elfogadom / Kérdésem van gombot megnyomja, itt jelenik meg.</p>';
        return;
      }
      box.innerHTML = `<h3>Ügyfél visszajelzések és kérdések</h3><p class="muted">Itt látod, ha az ügyfél megnyitotta, jóváhagyta vagy kérdést írt. A saját példányt innen tudod menteni.</p>${rows.slice(0,20).map(rowHtml).join('')}`;
    }catch(err){
      box.innerHTML = '<h3>Ügyfél visszajelzések és kérdések</h3><p class="muted">Nem sikerült betölteni: '+esc(err?.message || err)+'</p>';
    }
  }

  async function rowById(id){
    try{ const r = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(r) return r; }catch(_){}
    const rows = await loadRows();
    return rows.find(r => String(r.id) === String(id)) || null;
  }

  window.v109ReplyToClientQuestion = async function(id){
    const row = await rowById(id);
    if(!row) return alert('Nem találom ezt az ügyfél visszajelzést.');
    const question = messageOf(row);
    const answer = prompt('Írd be a választ, amit rögzíteni szeretnél ehhez az ügyfél kérdéshez:', '');
    if(!answer || !answer.trim()) return;
    const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Válasz ügyfél kérdésére</title><link rel="icon" href="https://epitesi-naplo.eu/favicon.png"><style>body{font-family:Arial,sans-serif;padding:28px;color:#111827}section{border:1px solid #d1d5db;border-radius:14px;padding:16px;margin:14px 0}.q{background:#fff7ed}.a{background:#ecfdf5}</style></head><body><h1>Válasz ügyfél kérdésére</h1><p><b>Projekt:</b> ${esc(projectTitle())}</p><p><b>Ügyfél:</b> ${esc(row.client_name || row.client_email || '')}</p><p><b>Dátum:</b> ${esc(fmt(new Date()))}</p><section class="q"><h2>Ügyfél kérdése / megjegyzése</h2><p>${esc(question).replace(/\n/g,'<br>')}</p></section><section class="a"><h2>Kivitelező válasza</h2><p>${esc(answer).replace(/\n/g,'<br>')}</p></section></body></html>`;
    try{
      await window.EpitesNaploAPI?.saveReportDocument?.({
        projectId: projectId(),
        approvalId: id,
        title: `${projectTitle()} – válasz ügyfél kérdésére`,
        type: 'client_question_reply_v109',
        html,
        text: `Ügyfél kérdése:\n${question}\n\nKivitelező válasza:\n${answer}`,
        meta: { v109:true, client_email: row.client_email || '', decision: decisionOf(row) }
      });
      const ok = document.getElementById('v109ReplySaved-'+CSS.escape(String(id)));
      if(ok){ ok.hidden = false; ok.textContent = 'Válasz rögzítve a mentett riportok közé.'; }
      toast('Válasz rögzítve a saját példányok közé.', 'ok');
      if(row.client_email){
        const subject = encodeURIComponent('Válasz az ÉpítésNapló riport kérdésére');
        const body = encodeURIComponent(`Szia!\n\nA riporttal kapcsolatos kérdésedre válaszolok:\n\n${answer}\n\nÜdvözlettel`);
        window.location.href = `mailto:${row.client_email}?subject=${subject}&body=${body}`;
      }
    }catch(err){
      alert('Válasz mentési hiba: ' + (err?.message || err));
    }
  };

  document.addEventListener('click', function(e){
    const copy = e.target.closest('[data-v109-copy]');
    const pdf = e.target.closest('[data-v109-pdf]');
    const reply = e.target.closest('[data-v109-reply]');
    if(!copy && !pdf && !reply) return;
    e.preventDefault(); e.stopPropagation();
    const id = copy?.dataset.v109Copy || pdf?.dataset.v109Pdf || reply?.dataset.v109Reply;
    if(copy) return window.v71DownloadApprovedHtml ? window.v71DownloadApprovedHtml(id) : alert('A saját példány funkció még nem töltött be.');
    if(pdf) return window.v71PrintApprovedReport ? window.v71PrintApprovedReport(id) : alert('A PDF funkció még nem töltött be.');
    if(reply) return window.v109ReplyToClientQuestion(id);
  }, true);

  document.addEventListener('DOMContentLoaded', () => { setTimeout(render, 900); setTimeout(render, 2500); });
  setTimeout(render, 1600);
  window.v109RenderClientFeedback = render;
})();



// ===== V118 STABIL RIPORT: tiszta riportépítés, kisképek mindenhol, nincs széteső szöveg =====
(function(){
  'use strict';
  if(window.__epitesNaploV118StableReports) return;
  window.__epitesNaploV118StableReports = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uniq = arr => [...new Set((arr||[]).map(x=>String(x||'').trim()).filter(Boolean))];
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Építési napló';
  const safeName = v => String(v || 'epitesi-naplo-riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo-riport';
  const money = n => (Number(n||0)||0).toLocaleString('hu-HU') + ' Ft';
  const fmt = d => { try{return d ? new Date(d).toLocaleString('hu-HU') : '';}catch(_){return String(d||'');} };

  function validImg(s){
    s=String(s||'').trim();
    if(!s || /^(javascript:|function\s*\(|\(function|window\.|document\.|const\s+|let\s+|var\s+)/i.test(s)) return false;
    if(/\.(mp4|mov|webm|m4v|3gp)(\?|#|$)/i.test(s)) return false;
    return /^data:image\//i.test(s) || /^https?:\/\//i.test(s) || /^blob:/i.test(s) || /^\.\//.test(s) || /^\//.test(s) || /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(s);
  }
  function collect(value,out){
    if(!value) return;
    if(Array.isArray(value)){ value.forEach(v=>collect(v,out)); return; }
    if(typeof value === 'object'){
      const o=value;
      ['url','src','href','path','image','image_url','storage_path','file_path','publicUrl','public_url','signedUrl','signed_url','dataUrl'].forEach(k=>collect(o[k],out));
      ['images','imageUrls','image_urls','photos','beforeImages','afterImages','generalImages','before_images_json','after_images_json','general_images_json','media','ai_json','analysis'].forEach(k=>collect(o[k],out));
      return;
    }
    const s=String(value||'').trim(); if(validImg(s)) out.push(s);
  }
  function entryImages(e){ const out=[]; collect(e,out); return uniq(out); }
  function domImages(){
    const out=[];
    document.querySelectorAll('img').forEach(img=>{
      const alt=(img.alt||'').toLowerCase(); const cls=(img.className||'').toString().toLowerCase();
      if(alt.includes('ikon') || alt.includes('logo') || cls.includes('logo') || cls.includes('brand')) return;
      const src=img.getAttribute('data-full-src') || img.getAttribute('data-src') || img.currentSrc || img.src || '';
      if(validImg(src)) out.push(src);
    });
    return uniq(out);
  }
  async function dataUrlMaybe(url){
    // A Supabase privát signed URL-ek később lejárhatnak, ezért ahol lehet, HTML-be beágyazott képet készítünk.
    if(!/^https?:\/\//i.test(url) || /^data:image\//i.test(url)) return url;
    try{
      const r=await fetch(url, { mode:'cors', cache:'force-cache' });
      if(!r.ok) return url;
      const b=await r.blob();
      if(!String(b.type||'').startsWith('image/')) return url;
      if(b.size > 6*1024*1024) return url; // túl nagy képet ne ágyazzunk be
      return await new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>res(url); fr.readAsDataURL(b); });
    }catch(_){ return url; }
  }
  async function embedImages(imgs){
    const out=[];
    for(const img of imgs){ out.push(await dataUrlMaybe(img)); }
    return uniq(out);
  }
  async function getCloseData(){
    let data={};
    try{ data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId()) || {}; }catch(e){ console.warn('Projekt záróadat lekérés hiba:', e); }
    let entries = Array.isArray(data.entries) ? data.entries : (Array.isArray(state()?.entries) ? state().entries : []);
    entries = entries.map(e=>({...e}));
    let media=[];
    try{ media = await window.EpitesNaploAPI?.getProjectMediaForReport?.(projectId()) || []; }catch(e){ console.warn('Projekt média lekérés hiba:', e); }
    const all = uniq([...(entries||[]).flatMap(entryImages), ...media, ...domImages()]);
    if(all.length){
      const embedded = await embedImages(all);
      if(!entries.length) entries.push({ phase:'Fotódokumentáció', note:'A projekthez rögzített fotódokumentáció.', created_at:new Date().toISOString(), images: embedded, image_urls: embedded });
      else entries[0] = {...entries[0], images: uniq([...entryImages(entries[0]), ...embedded]), image_urls: uniq([...entryImages(entries[0]), ...embedded])};
    }
    data.entries = entries;
    return data;
  }
  function matLine(m){ return `${esc(m?.name||m?.material||m?.title||m?.megnevezes||'Anyag')} ${esc(m?.quantity||m?.mennyiseg||'')} ${esc(m?.unit||m?.egyseg||'')}`.trim(); }
  function imageGrid(imgs){
    imgs=uniq(imgs).filter(validImg);
    if(!imgs.length) return '<p class="muted">Ehhez a bejegyzéshez nincs csatolt fotó.</p>';
    return `<div class="photos v118Photos">${imgs.map((src,i)=>`<figure class="v118Photo"><img src="${esc(src)}" data-full-src="${esc(src)}" alt="Napló fotó ${i+1}" loading="lazy" decoding="async"><figcaption>Nagyítás</figcaption></figure>`).join('')}</div>`;
  }
  function reportStyleAndScript(){ return `<style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:24px;line-height:1.45}.doc{max-width:1050px;margin:auto}.pill{display:inline-block;background:#fff2bf;color:#8a5a00;border-radius:999px;padding:7px 13px;font-weight:700}.cover{border-bottom:4px solid #f5a400;margin-bottom:20px;padding-bottom:16px}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0}.stat{background:#f3f4f6;border-radius:10px;padding:12px}.stat b{display:block;color:#d97706;font-size:22px}.entry{border-left:4px solid #f5a400;background:#fafafa;margin:18px 0;padding:16px 18px;border-radius:12px;break-inside:avoid}.aiBox{background:#ecfdf5;border-left:5px solid #22c55e;border-radius:12px;padding:14px 16px;margin:12px 0}.photos,.v118Photos{display:grid!important;grid-template-columns:repeat(auto-fill,112px)!important;gap:10px!important;align-items:start!important;justify-content:start!important;margin:12px 0!important}.v118Photo{width:112px!important;max-width:112px!important;min-height:132px!important;border:1px solid #d1d5db!important;border-radius:12px!important;background:#fff!important;padding:5px!important;margin:0!important;box-sizing:border-box!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}.v118Photo img{display:block!important;width:100px!important;height:100px!important;max-width:100px!important;max-height:100px!important;object-fit:cover!important;border-radius:9px!important;cursor:zoom-in!important;background:#f8fafc!important}.v118Photo figcaption{font-size:11px;color:#64748b;margin-top:4px}.v118Lightbox{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.94);display:flex;align-items:center;justify-content:center;padding:70px 60px 30px}.v118Lightbox img{max-width:96vw!important;max-height:86vh!important;width:auto!important;height:auto!important;object-fit:contain!important;border-radius:14px!important;background:#000}.v118Lightbox button{position:fixed;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:900;cursor:pointer}.v118Close{top:14px;right:14px;padding:10px 14px}.v118Prev,.v118Next{top:50%;transform:translateY(-50%);width:46px;height:70px;font-size:34px}.v118Prev{left:12px}.v118Next{right:12px}@media(max-width:760px){body{padding:14px}.stats{grid-template-columns:repeat(2,1fr)}.photos,.v118Photos{grid-template-columns:repeat(3,92px)!important}.v118Photo{width:92px!important;min-height:112px!important}.v118Photo img{width:80px!important;height:80px!important}.v118Lightbox{padding:62px 8px 20px}.v118Prev,.v118Next{width:38px;height:56px;font-size:28px}}@media print{.v118Lightbox{display:none!important}.photos,.v118Photos{grid-template-columns:repeat(4,30mm)!important}.v118Photo{width:30mm!important;min-height:34mm!important}.v118Photo img{width:28mm!important;height:28mm!important}}
    </style><script>(function(){var idx=0;function imgs(){return Array.from(document.querySelectorAll('.v118Photos img,.photos img')).filter(function(i){return i.src&&!i.closest('.v118Lightbox')})}function close(){document.querySelectorAll('.v118Lightbox').forEach(function(x){x.remove()})}function openAt(i){var list=imgs();if(!list.length)return;idx=(i+list.length)%list.length;close();var box=document.createElement('div');box.className='v118Lightbox';function draw(){box.innerHTML='<button class="v118Close" type="button">Bezárás ×</button>'+(list.length>1?'<button class="v118Prev" type="button">‹</button><button class="v118Next" type="button">›</button>':'')+'<img alt="Nagyított napló kép">';box.querySelector('img').src=list[idx].src;box.querySelector('.v118Close').onclick=function(e){e.preventDefault();e.stopPropagation();close()};var p=box.querySelector('.v118Prev'),n=box.querySelector('.v118Next');if(p)p.onclick=function(e){e.preventDefault();e.stopPropagation();idx=(idx-1+list.length)%list.length;draw()};if(n)n.onclick=function(e){e.preventDefault();e.stopPropagation();idx=(idx+1)%list.length;draw()};}draw();box.onclick=function(e){if(e.target===box)close()};document.body.appendChild(box)}document.addEventListener('click',function(e){var img=e.target.closest&&e.target.closest('.v118Photos img,.photos img');if(!img||img.closest('.v118Lightbox'))return;e.preventDefault();e.stopPropagation();openAt(imgs().indexOf(img))},true);document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});})();<\/script>`; }
  function buildReportHtml(data, title){
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    const materials = Array.isArray(data?.materials) ? data.materials : [];
    const invoices = Array.isArray(data?.invoices) ? data.invoices : [];
    const invoiceSum = invoices.reduce((s,x)=>s+(Number(x.amount||x.gross_amount||x.total||0)||0),0);
    const photoCount = entries.reduce((s,e)=>s+entryImages(e).length,0);
    const materialHtml = materials.length ? materials.map(m=>`<li><b>${matLine(m)}</b></li>`).join('') : '<li>Nincs rögzített anyag.</li>';
    const invoiceHtml = invoices.length ? invoices.map(i=>`<tr><td>${esc(i.title||i.name||i.description||'Számla')}</td><td>${money(i.amount||i.gross_amount||i.total)}</td><td>${esc(i.note||'')}</td></tr>`).join('') : '<tr><td colspan="3">Nincs csatolt számla.</td></tr>';
    const rows = entries.map(e=>{
      const imgs = entryImages(e);
      const mats = Array.isArray(e.materials_json) ? e.materials_json : (Array.isArray(e.materials)?e.materials:[]);
      const weather = e.weather || e.weather_text || e.weather_json?.summary || e.weather_json?.text || '';
      const gps = e.location_address || e.locationAddress || e.gps_json?.address || e.gps || '';
      const ai = e.ai_report || e.ai_summary || e.ai_json?.summary || e.analysis?.summary || '';
      return `<section class="entry"><h2>${esc(fmt(e.created_at))} – ${esc(e.phase||'Napi bejegyzés')}</h2><p>${esc(e.note||e.description||'').replace(/\n/g,'<br>')}</p><p><b>Dokumentáció:</b> ${imgs.length} fotó, 0 videó.</p>${mats.length?`<p><b>Napi anyag:</b> ${mats.map(matLine).join(', ')}</p>`:''}${weather?`<p><b>Időjárás:</b> ${esc(weather)}</p>`:''}${gps?`<p><b>GPS/helyadat:</b> ${esc(gps)}</p>`:''}${ai?`<div class="aiBox"><b>AI szakmai kontroll:</b><br>${esc(ai).replace(/\n/g,'<br>')}</div>`:''}<h3>Munka közben / dokumentáció</h3><p>Kattints bármelyik fotóra a nagyításhoz.</p>${imageGrid(imgs)}</section>`;
    }).join('') || '<p>Nincs napi bejegyzés ehhez a projekthez.</p>';
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="icon" href="https://epitesi-naplo.eu/favicon.png">${reportStyleAndScript()}</head><body><div class="doc"><div class="cover"><span class="pill">Átadásra kész dokumentáció</span><h1>${esc(title)}</h1><p class="muted">Generálva: ${new Date().toLocaleString('hu-HU')} • ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>${entries.length}</b>bejegyzés</div><div class="stat"><b>${photoCount}</b>fotó</div><div class="stat"><b>0</b>videó</div><div class="stat"><b>0</b>magas kockázat</div><div class="stat"><b>${money(invoiceSum)}</b>számlák</div></div></div><h2>Rövid összegzés</h2><p>A dokumentum az ügyfélnek átadható, rendezett építési napló: napi munka, fotódokumentáció, anyagok, időjárás/GPS és nyitott ellenőrzések egy helyen.</p><h2>Anyagösszesítő</h2><ul>${materialHtml}</ul><h2>Számlák</h2><table><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr>${invoiceHtml}</table><h2>Vezetői AI összefoglaló</h2><div class="aiBox">Állapot: rendezett dokumentáció. Bejegyzések: ${entries.length}, fotók: ${photoCount}, videók: 0. A napi bejegyzések és fotók alapján az ügyfél számára átadható dokumentáció készült.</div><h2>Napi bejegyzések</h2>${rows}</div></body></html>`;
  }
  window.buildProReportHtml = function(entries,title,options){ return buildReportHtml({entries:entries||[], materials:options?.materials||[], invoices:options?.invoices||[]}, title || (projectTitle()+' – ügyfélriport')); };
  try{ buildProReportHtml = window.buildProReportHtml; }catch(_){ }
  function download(name, html){ const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000); }
  async function openPrint(html){ const w=window.open('', '_blank'); if(!w) return alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakokat.'); w.document.open(); w.document.write(html); w.document.close(); setTimeout(()=>{try{w.focus();w.print();}catch(_){ }},900); }
  async function currentHtml(kind){ const data=await getCloseData(); return buildReportHtml(data, `${projectTitle()} – ${kind||'ügyfélriport'}`); }

  window.createProjectClientLinkV25 = async function(){
    if(!projectId()) return alert('Nincs projekt.');
    const btn=document.activeElement; const old=btn&&btn.tagName==='BUTTON'?btn.innerText:'';
    try{
      if(btn&&old){btn.disabled=true;btn.innerText='Ügyfél link készül...';}
      const html=await currentHtml('ügyfélriport');
      const saved=await window.EpitesNaploAPI.createPublicReport({ projectId: projectId(), projectName: projectTitle(), reportHtml: html, reportText: (new DOMParser().parseFromString(html,'text/html').body.innerText || projectTitle()) });
      const link=window.EpitesNaploAPI.createClientShareUrl(saved.token);
      try{await navigator.clipboard.writeText(link);}catch(_){ }
      if(typeof showProjectHelp==='function') showProjectHelp('Ügyfél link elkészült', `<div class="featureHelpBox"><b>Biztonságos ügyfél link</b><p>A link kimásolva. A riportban a fotók kisképként benne vannak, kattintásra nagyíthatók.</p><p><a class="btn primary" target="_blank" href="${esc(link)}">Ügyfélriport megnyitása</a></p><p class="muted">${esc(link)}</p></div>`); else alert('Ügyfél link elkészült: '+link);
    }catch(e){ console.error(e); alert('Ügyfél link létrehozási hiba: '+(e.message||e)); }
    finally{ if(btn&&old){btn.disabled=false;btn.innerText=old;} }
  };
  window.v71DownloadApprovedHtml = async function(){ try{ download(`${safeName(projectTitle())}-sajat-ugyfelpeldany.html`, await currentHtml('saját ügyfélpéldány')); }catch(e){ alert('HTML riport hiba: '+(e.message||e)); } };
  window.v71PrintApprovedReport = async function(){ try{ await openPrint(await currentHtml('saját ügyfélpéldány')); }catch(e){ alert('PDF/nyomtatási hiba: '+(e.message||e)); } };
  window.downloadWeeklyReportHtml = async function(){ try{ download(`${safeName(projectTitle())}-heti-riport.html`, await currentHtml('heti riport')); }catch(e){ alert('Heti HTML hiba: '+(e.message||e)); } };
  window.printWeeklyReport = async function(){ try{ await openPrint(await currentHtml('heti riport')); }catch(e){ alert('Heti PDF/nyomtatási hiba: '+(e.message||e)); } };
})();



// ===== beolvasztva V153-ba: project-v121-unified-report-engine-fix.js =====
// ===== V121: EGYETLEN TISZTA RIPORTMOTOR - 7/összes fotó ügyfélriport + HTML + PDF =====
(function(){
  'use strict';
  if(window.__epitesNaploV121UnifiedReportEngine) return;
  window.__epitesNaploV121UnifiedReportEngine = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uniq = arr => [...new Set((arr||[]).map(x=>String(x||'').trim()).filter(Boolean))];
  const st = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => st()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => st()?.project?.name || st()?.project?.title || 'Építési napló';
  const safeName = v => String(v || 'epitesi-naplo-riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo-riport';
  const toast = (m,t='ok') => { try{ window.showToast ? window.showToast(m,t) : console.log(m); }catch(_){} };
  const money = n => (Number(n||0)||0).toLocaleString('hu-HU') + ' Ft';
  const fmt = d => { try{return d ? new Date(d).toLocaleString('hu-HU') : '';}catch(_){return String(d||'');} };

  function validImg(s){
    s=String(s||'').trim();
    if(!s || /^(javascript:|function\s*\(|\(function|window\.|document\.|const\s+|let\s+|var\s+)/i.test(s)) return false;
    if(/\.(mp4|mov|webm|m4v|3gp|pdf|html)(\?|#|$)/i.test(s)) return false;
    return /^data:image\//i.test(s) || /^https?:\/\//i.test(s) || /^blob:/i.test(s) || /^\//.test(s) || /^\.\//.test(s) || /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(s);
  }
  function collect(v,out){
    if(!v) return;
    if(Array.isArray(v)){ v.forEach(x=>collect(x,out)); return; }
    if(typeof v === 'object'){
      ['url','src','href','path','full_path','image','photo','image_url','photo_url','file_url','publicUrl','public_url','signedUrl','signed_url','dataUrl','data_url','storage_path','file_path'].forEach(k=>collect(v[k],out));
      ['images','imageUrls','image_urls','photos','photo_urls','media','files','attachments','beforeImages','afterImages','generalImages','before_images_json','after_images_json','general_images_json','ai_json','analysis'].forEach(k=>collect(v[k],out));
      return;
    }
    const s=String(v||'').trim(); if(validImg(s)) out.push(s);
  }
  function entryImages(e){ const out=[]; collect(e,out); return uniq(out); }
  function domImages(){
    const out=[];
    document.querySelectorAll('img').forEach(img=>{
      const alt=(img.alt||'').toLowerCase(); const cls=(img.className||'').toString().toLowerCase(); const src=(img.getAttribute('data-full-src')||img.getAttribute('data-src')||img.currentSrc||img.src||'').trim();
      if(!src || alt.includes('logo') || alt.includes('ikon') || cls.includes('logo') || cls.includes('brand') || cls.includes('avatar')) return;
      if(validImg(src)) out.push(src);
    });
    return uniq(out);
  }
  async function toDataUrlMaybe(url){
    url=String(url||'').trim();
    if(!url || /^data:image\//i.test(url)) return url;
    try{
      const r=await fetch(url,{cache:'force-cache'}); if(!r.ok) return url;
      const b=await r.blob(); if(!String(b.type||'').startsWith('image/')) return url;
      if(b.size > 7*1024*1024) return url;
      return await new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>res(url); fr.readAsDataURL(b); });
    }catch(_){ return url; }
  }
  async function embedAll(imgs){ const out=[]; for(const x of uniq(imgs).filter(validImg)) out.push(await toDataUrlMaybe(x)); return uniq(out).filter(validImg); }

  async function getUnifiedReportData(){
    let data={};
    try{ data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId()) || {}; }catch(e){ console.warn('V121 záróadat hiba:', e); }
    let entries = Array.isArray(data.entries) ? data.entries : (Array.isArray(st()?.entries) ? st().entries : []);
    entries = entries.map(e=>({...e}));
    let media=[];
    try{ media = await window.EpitesNaploAPI?.getProjectMediaForReport?.(projectId()) || []; }catch(e){ console.warn('V121 média hiba:', e); }
    const allImages = await embedAll([...(entries||[]).flatMap(entryImages), ...media, ...domImages()]);
    if(allImages.length){
      if(!entries.length) entries.push({created_at:new Date().toISOString(), phase:'Fotódokumentáció', note:'A projekthez rögzített teljes fotódokumentáció.', images:allImages, image_urls:allImages});
      else entries[0] = {...entries[0], images:allImages, image_urls:allImages, photos:allImages};
    }
    return {...data, entries, __allImages:allImages};
  }

  function matLine(m){ return `${esc(m?.name||m?.material||m?.title||m?.megnevezes||'Anyag')} ${esc(m?.quantity||m?.mennyiseg||'')} ${esc(m?.unit||m?.egyseg||'')}`.trim(); }
  function imgGrid(imgs){
    imgs=uniq(imgs).filter(validImg);
    if(!imgs.length) return '<p class="muted">Ehhez a bejegyzéshez nincs csatolt fotó.</p>';
    return `<div class="photos v121Photos">${imgs.map((src,i)=>`<figure class="v121Photo"><img src="${esc(src)}" data-full-src="${esc(src)}" alt="Napló fotó ${i+1}" loading="lazy" decoding="async"><figcaption>${i+1}. kép – nagyítás</figcaption></figure>`).join('')}</div>`;
  }
  function cssScript(){ return `<style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:24px;line-height:1.45}.doc{max-width:1050px;margin:auto}.pill{display:inline-block;background:#fff2bf;color:#8a5a00;border-radius:999px;padding:7px 13px;font-weight:700}.cover{border-bottom:4px solid #f5a400;margin-bottom:20px;padding-bottom:16px}.muted{color:#64748b}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0}.stat{background:#f3f4f6;border-radius:10px;padding:12px}.stat b{display:block;color:#d97706;font-size:22px}.entry{border-left:4px solid #f5a400;background:#fafafa;margin:18px 0;padding:16px 18px;border-radius:12px;break-inside:avoid}.aiBox{background:#ecfdf5;border-left:5px solid #22c55e;border-radius:12px;padding:14px 16px;margin:12px 0}.photos,.v121Photos{display:grid!important;grid-template-columns:repeat(auto-fill,112px)!important;gap:10px!important;align-items:start!important;margin:12px 0!important}.v121Photo,figure{width:112px!important;min-height:132px!important;border:1px solid #d1d5db!important;border-radius:12px!important;background:#fff!important;padding:5px!important;margin:0!important;box-sizing:border-box!important;overflow:hidden!important;break-inside:avoid!important}.v121Photo img,figure img,.photos img,.entryImageGrid img,.reportImageGrid img{display:block!important;width:100px!important;height:100px!important;object-fit:cover!important;border-radius:9px!important;cursor:zoom-in!important;background:#f8fafc!important}.v121Photo figcaption,figcaption{font-size:11px;color:#64748b;margin-top:4px}.v148ReportViewer{position:fixed!important;inset:0!important;z-index:2147483647!important;background:rgba(2,6,23,.96)!important;display:none!important;color:#fff!important;font-family:Arial,Helvetica,sans-serif!important;touch-action:none!important}.v148ReportViewer.open{display:block!important}.v148Top{position:absolute!important;left:0!important;right:0!important;top:0!important;min-height:58px!important;background:#081225!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:9px 12px!important;box-shadow:0 8px 22px rgba(0,0,0,.3)!important;z-index:2!important}.v148Title{font-weight:900!important;font-size:14px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:36vw!important}.v148Btns{display:flex!important;gap:7px!important;align-items:center!important;flex-wrap:wrap!important;justify-content:flex-end!important}.v148Btns button,.v148Nav{border:1px solid rgba(255,255,255,.18)!important;border-radius:12px!important;background:#122038!important;color:#fff!important;font-weight:900!important;cursor:pointer!important;padding:9px 12px!important;line-height:1!important}.v148Btns button:hover,.v148Nav:hover{background:#fbbf24!important;color:#111827!important}.v148Btns .primary{background:#fbbf24!important;color:#111827!important;border-color:#fbbf24!important}.v148Stage{position:absolute!important;inset:58px 0 0 0!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;padding:22px 66px!important;touch-action:none!important}.v148Stage img{max-width:100%!important;max-height:100%!important;object-fit:contain!important;border-radius:14px!important;background:#000!important;box-shadow:0 22px 70px rgba(0,0,0,.42)!important;transform-origin:center center!important;will-change:transform!important;user-select:none!important;-webkit-user-select:none!important;-webkit-touch-callout:none!important}.v148Stage.full img{max-width:none!important;max-height:none!important;width:auto!important;height:auto!important}.v148Nav{position:absolute!important;top:50%!important;transform:translateY(-50%)!important;width:46px!important;height:72px!important;font-size:36px!important;padding:0!important;background:rgba(15,23,42,.86)!important;z-index:3!important}.v148Nav.prev{left:9px!important}.v148Nav.next{right:9px!important}body.v148Open{overflow:hidden!important}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e5e7eb;text-align:left;padding:8px}@media(max-width:760px){body{padding:14px}.stats{grid-template-columns:repeat(2,1fr)}.photos,.v121Photos{grid-template-columns:repeat(3,92px)!important}.v121Photo,figure{width:92px!important;min-height:112px!important}.v121Photo img,figure img,.photos img,.entryImageGrid img,.reportImageGrid img{width:80px!important;height:80px!important}.v148Top{align-items:flex-start!important}.v148Title{font-size:12px!important;max-width:28vw!important}.v148Btns{gap:5px!important}.v148Btns button{padding:8px 9px!important;font-size:12px!important}.v148Stage{padding:18px 8px!important}.v148Nav{width:38px!important;height:58px!important;font-size:31px!important;opacity:.92}.v148Nav.prev{left:4px!important}.v148Nav.next{right:4px!important}}@media print{.v148ReportViewer{display:none!important}.photos,.v121Photos{grid-template-columns:repeat(4,30mm)!important}.v121Photo,figure{width:30mm!important;min-height:34mm!important}.v121Photo img,figure img,.photos img,.entryImageGrid img,.reportImageGrid img{width:28mm!important;height:28mm!important}}
    </style><script>(function(){'use strict';if(window.__v148ReportViewer)return;window.__v148ReportViewer=true;var SEL='.v121Photos img,.photos img,.entryImageGrid img,.reportImageGrid img,.v67ReportPhotos img,.v68ReportPhotos img,.v74Photos img,.v77Photos img,figure img';var idx=0,list=[],scale=1,tx=0,ty=0,startDist=0,startScale=1,startX=0,startY=0,panX=0,panY=0,oneX=0,oneY=0,oneMoved=false;function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c})}function srcOf(el){return el.getAttribute('data-full-src')||el.currentSrc||el.src||''}function visible(el){var r=el.getBoundingClientRect();return r.width>6&&r.height>6}function collect(ctx){var root=(ctx&&ctx.closest&&ctx.closest('.entry'))||document;var nodes=Array.prototype.slice.call(root.querySelectorAll(SEL));if(nodes.length<2)nodes=Array.prototype.slice.call(document.querySelectorAll(SEL));var seen={};return nodes.filter(function(img){var s=srcOf(img);if(!s||!visible(img)||img.closest('.v148ReportViewer'))return false;if(seen[s])return false;seen[s]=1;return true}).map(function(img,i){return{el:img,src:srcOf(img),title:img.alt||(img.closest('figure')&&img.closest('figure').querySelector('figcaption')&&img.closest('figure').querySelector('figcaption').textContent)||('Napló fotó '+(i+1))}})}function viewer(){var v=document.getElementById('v148ReportViewer');if(v)return v;v=document.createElement('div');v.id='v148ReportViewer';v.className='v148ReportViewer';v.innerHTML='<div class="v148Top"><div id="v148Title" class="v148Title">Napló fotó</div><div class="v148Btns"><button type="button" data-act="minus">−</button><button type="button" data-act="plus">+</button><button type="button" data-act="reset">100%</button><button class="primary" type="button" data-act="full">Teljes kép</button><button type="button" data-act="close">Bezárás</button></div></div><button type="button" class="v148Nav prev">‹</button><div id="v148Stage" class="v148Stage"></div><button type="button" class="v148Nav next">›</button>';document.body.appendChild(v);v.querySelector('.prev').onclick=function(e){e.stopPropagation();show(idx-1)};v.querySelector('.next').onclick=function(e){e.stopPropagation();show(idx+1)};v.querySelector('[data-act="close"]').onclick=close;v.querySelector('[data-act="minus"]').onclick=function(){setScale(scale-.35)};v.querySelector('[data-act="plus"]').onclick=function(){setScale(scale+.35)};v.querySelector('[data-act="reset"]').onclick=function(){scale=1;tx=0;ty=0;stage().classList.remove('full');apply()};v.querySelector('[data-act="full"]').onclick=function(){stage().classList.toggle('full');if(stage().classList.contains('full'))setScale(Math.max(1.35,scale));else{scale=1;tx=0;ty=0;apply()}};v.addEventListener('wheel',function(e){if(!v.classList.contains('open'))return;e.preventDefault();setScale(scale+(e.deltaY<0?.25:-.25))},{passive:false});v.addEventListener('touchstart',touchStart,{passive:false});v.addEventListener('touchmove',touchMove,{passive:false});v.addEventListener('touchend',touchEnd,{passive:false});return v}function stage(){return document.getElementById('v148Stage')}function apply(){var img=stage()&&stage().querySelector('img');if(img)img.style.transform='translate3d('+tx+'px,'+ty+'px,0) scale('+scale+')'}function setScale(s){scale=Math.max(1,Math.min(6,s));if(scale===1){tx=0;ty=0}apply()}function show(i,ctx){if(ctx)list=collect(ctx);if(!list.length)list=collect(document);if(!list.length)return;idx=(i+list.length)%list.length;scale=1;tx=0;ty=0;var it=list[idx],v=viewer();document.getElementById('v148Title').textContent=(it.title||'Napló fotó')+' ('+(idx+1)+'/'+list.length+')';stage().classList.remove('full');stage().innerHTML='<img src="'+esc(it.src)+'" alt="'+esc(it.title||'Napló fotó')+'">';v.classList.add('open');document.body.classList.add('v148Open')}function close(){var v=document.getElementById('v148ReportViewer');if(v){v.classList.remove('open');stage().innerHTML=''}document.body.classList.remove('v148Open')}function dist(a,b){var dx=a.clientX-b.clientX,dy=a.clientY-b.clientY;return Math.sqrt(dx*dx+dy*dy)}function mid(a,b){return{x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2}}function touchStart(e){if(!e.currentTarget.classList.contains('open'))return;if(e.touches.length===2){e.preventDefault();startDist=dist(e.touches[0],e.touches[1]);startScale=scale;var m=mid(e.touches[0],e.touches[1]);startX=m.x;startY=m.y;panX=tx;panY=ty}else if(e.touches.length===1){oneX=e.touches[0].clientX;oneY=e.touches[0].clientY;panX=tx;panY=ty;oneMoved=false}}function touchMove(e){if(!e.currentTarget.classList.contains('open'))return;if(e.touches.length===2){e.preventDefault();var d=dist(e.touches[0],e.touches[1]),m=mid(e.touches[0],e.touches[1]);scale=Math.max(1,Math.min(6,startScale*(d/Math.max(1,startDist))));tx=panX+(m.x-startX);ty=panY+(m.y-startY);if(scale===1){tx=0;ty=0}apply()}else if(e.touches.length===1){var dx=e.touches[0].clientX-oneX,dy=e.touches[0].clientY-oneY;if(Math.abs(dx)>8||Math.abs(dy)>8)oneMoved=true;if(scale>1){e.preventDefault();tx=panX+dx;ty=panY+dy;apply()}}}function touchEnd(e){if(!e.currentTarget.classList.contains('open'))return;if(scale<=1&&oneMoved){var dx=(e.changedTouches[0]?e.changedTouches[0].clientX:oneX)-oneX;if(Math.abs(dx)>70)show(idx+(dx<0?1:-1))}}document.addEventListener('click',function(e){var img=e.target&&e.target.closest&&e.target.closest(SEL);if(!img||img.closest('.v148ReportViewer'))return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();list=collect(img);var s=srcOf(img);var i=list.findIndex(function(x){return x.src===s});show(Math.max(0,i),img)},true);document.addEventListener('keydown',function(e){var v=document.getElementById('v148ReportViewer');if(!v||!v.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')show(idx-1);if(e.key==='ArrowRight')show(idx+1);if(e.key==='+'||e.key==='=')setScale(scale+.35);if(e.key==='-')setScale(scale-.35)});})();<\/script>`; }

  function buildReportHtml(data,title){
    const entries=Array.isArray(data?.entries)?data.entries:[];
    const materials=Array.isArray(data?.materials)?data.materials:[];
    const invoices=Array.isArray(data?.invoices)?data.invoices:[];
    const invoiceSum=invoices.reduce((s,x)=>s+(Number(x.amount||x.gross_amount||x.total||0)||0),0);
    const photoCount=(data.__allImages?.length)||entries.reduce((s,e)=>s+entryImages(e).length,0);
    const materialHtml=materials.length?materials.map(m=>`<li><b>${matLine(m)}</b></li>`).join(''):'<li>Nincs rögzített anyag.</li>';
    const invoiceHtml=invoices.length?invoices.map(i=>`<tr><td>${esc(i.title||i.name||i.description||'Számla')}</td><td>${money(i.amount||i.gross_amount||i.total)}</td><td>${esc(i.note||'')}</td></tr>`).join(''):'<tr><td colspan="3">Nincs csatolt számla.</td></tr>';
    const rows=entries.map(e=>{ const imgs=entryImages(e); const mats=Array.isArray(e.materials_json)?e.materials_json:(Array.isArray(e.materials)?e.materials:[]); const weather=e.weather||e.weather_text||e.weather_json?.summary||e.weather_json?.text||''; const gps=e.location_address||e.locationAddress||e.gps_json?.address||e.gps||''; const ai=e.ai_report||e.ai_summary||e.ai_json?.summary||e.analysis?.summary||''; return `<section class="entry"><h2>${esc(fmt(e.created_at))} – ${esc(e.phase||'Napi bejegyzés')}</h2><p>${esc(e.note||e.description||'').replace(/\n/g,'<br>')}</p><p><b>Dokumentáció:</b> ${imgs.length} fotó.</p>${mats.length?`<p><b>Napi anyag:</b> ${mats.map(matLine).join(', ')}</p>`:''}${weather?`<p><b>Időjárás:</b> ${esc(weather)}</p>`:''}${gps?`<p><b>GPS/helyadat:</b> ${esc(gps)}</p>`:''}${ai?`<div class="aiBox"><b>AI szakmai kontroll:</b><br>${esc(ai).replace(/\n/g,'<br>')}</div>`:''}<h3>Munka közben / dokumentáció</h3>${imgGrid(imgs)}</section>`; }).join('') || '<p>Nincs napi bejegyzés ehhez a projekthez.</p>';
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="icon" href="https://epitesi-naplo.eu/favicon.png">${cssScript()}</head><body><div class="doc"><div class="cover"><span class="pill">Átadásra kész dokumentáció</span><h1>${esc(title)}</h1><p class="muted">Generálva: ${new Date().toLocaleString('hu-HU')} • ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>${entries.length}</b>bejegyzés</div><div class="stat"><b>${photoCount}</b>fotó</div><div class="stat"><b>0</b>videó</div><div class="stat"><b>0</b>magas kockázat</div><div class="stat"><b>${money(invoiceSum)}</b>számlák</div></div></div><h2>Rövid összegzés</h2><p>A dokumentum az ügyfélnek átadható, rendezett építési napló: napi munka, fotódokumentáció, anyagok, időjárás/GPS és nyitott ellenőrzések egy helyen.</p><h2>Anyagösszesítő</h2><ul>${materialHtml}</ul><h2>Számlák</h2><table><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr>${invoiceHtml}</table><h2>Vezetői AI összefoglaló</h2><div class="aiBox">Állapot: rendezett dokumentáció. Bejegyzések: ${entries.length}, fotók: ${photoCount}. A napi bejegyzések és fotók alapján az ügyfél számára átadható dokumentáció készült.</div><h2>Napi bejegyzések</h2>${rows}</div></body></html>`;
  }
  async function makeHtml(kind,weekly=false){
    const data=await getUnifiedReportData();
    if(weekly){ const from=new Date(); from.setDate(from.getDate()-7); data.entries=(data.entries||[]).filter(e=>new Date(e.created_at||0)>=from); }
    return buildReportHtml(data, `${projectTitle()} – ${kind}`);
  }
  function downloadHtml(name, html){ const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1200); }
  async function printHtml(html){ const w=window.open('', '_blank'); if(!w){ downloadHtml(`${safeName(projectTitle())}-riport.html`,html); return alert('A böngésző blokkolta az új ablakot. HTML riportot letöltöttem; nyisd meg, majd Ctrl+P → Mentés PDF-ként.'); } w.document.open(); w.document.write(html); w.document.close(); setTimeout(()=>{try{w.focus();w.print();}catch(_){}},900); }
  async function saveDoc(title,type,html){ try{ await window.EpitesNaploAPI?.saveReportDocument?.({projectId:projectId(),title,type,html,text:(new DOMParser().parseFromString(html,'text/html').body?.innerText||'').slice(0,200000),meta:{v121:true,unified:true}}); }catch(e){ console.warn('V121 riport mentés hiba:', e); } try{ window.v77RenderSavedReports && await window.v77RenderSavedReports(); }catch(_){} }
  async function busy(fn,label){ const btn=document.activeElement; const ok=btn&&btn.tagName==='BUTTON'; const old=ok?btn.innerText:''; try{ if(ok){btn.disabled=true;btn.innerText=label;} return await fn(); } finally{ if(ok){btn.disabled=false;btn.innerText=old;} } }

  window.buildProReportHtml = function(entries,title,options){ return buildReportHtml({entries:entries||[],materials:options?.materials||[],invoices:options?.invoices||[],__allImages:(entries||[]).flatMap(entryImages)}, title || `${projectTitle()} – riport`); };
  try{ buildProReportHtml = window.buildProReportHtml; }catch(_){ }

  window.downloadClosingReportHtml = () => busy(async()=>{ const html=await makeHtml('lezáró építési napló',false); await saveDoc(`${projectTitle()} – lezáró HTML`,'closing_html_v121',html); downloadHtml(`${safeName(projectTitle())}-lezaro-riport.html`,html); toast('Lezáró HTML elkészült: a leírás és az összes fotó benne van.'); },'Lezáró HTML készül...');
  window.printClosingDocument = () => busy(async()=>{ const html=await makeHtml('lezáró PRO építési napló',false); await saveDoc(`${projectTitle()} – lezáró PDF`,'closing_pdf_v121',html); await printHtml(html); toast('Lezáró PDF/nyomtatás megnyitva: az összes fotó benne van.'); },'Lezáró PDF készül...');
  window.exportClosingPdfV25 = window.printClosingDocument;
  window.downloadWeeklyReportHtml = () => busy(async()=>{ const html=await makeHtml('heti építési napló',true); await saveDoc(`${projectTitle()} – heti HTML`,'weekly_html_v121',html); downloadHtml(`${safeName(projectTitle())}-heti-riport.html`,html); toast('Heti HTML elkészült.'); },'Heti HTML készül...');
  window.printWeeklyReport = () => busy(async()=>{ const html=await makeHtml('heti PRO építési napló',true); await saveDoc(`${projectTitle()} – heti PDF`,'weekly_pdf_v121',html); await printHtml(html); toast('Heti PDF/nyomtatás megnyitva.'); },'Heti PDF készül...');
  window.exportWeeklyPdfV25 = window.printWeeklyReport;
  window.createProjectClientLinkV25 = () => busy(async()=>{
    if(!projectId()) return alert('Nincs projekt.');
    const html = await makeHtml('ügyfélriport', false);
    const payload = {
      projectId: projectId(),
      projectName: projectTitle(),
      reportHtml: html,
      reportText: (new DOMParser().parseFromString(html,'text/html').body?.innerText || projectTitle()).slice(0,200000)
    };
    const createPromise = window.EpitesNaploAPI.createPublicReport(payload);
    const timeoutPromise = new Promise((_, rej)=>setTimeout(()=>rej(new Error('A riport mentése túl sokáig tartott. Ellenőrizd az internetet / Supabase kapcsolatot, majd próbáld újra.')), 30000));
    const saved = await Promise.race([createPromise, timeoutPromise]);
    await saveDoc(`${projectTitle()} – ügyfélriport link`, 'client_report_v124', html);
    const link = window.EpitesNaploAPI.createClientShareUrl(saved.token);
    const safeLink = esc(link);
    const box = `<div class="featureHelpBox v124ClientLinkBox">
      <b>✅ Ügyfél link elkészült</b>
      <p>A PRO ügyfélriport elkészült: kártyás Messenger/Facebook előnézet + leírás + összes fotó + nagyítható képek.</p>
      <p><a class="btn primary" target="_blank" rel="noopener" href="${safeLink}">Ügyfélriport megnyitása</a></p>
      <p class="muted" style="word-break:break-all;user-select:all;">${safeLink}</p>
      <div class="v124ClientLinkActions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button class="btn ghost" type="button" onclick="navigator.clipboard.writeText('${safeLink}').then(()=>alert('Link kimásolva'))">Link másolása</button>
        <button class="btn ghost" type="button" onclick="if(navigator.share){navigator.share({title:'Ügyfélriport – ÉpítésNapló AI PRO',url:'${safeLink}'})}else{navigator.clipboard.writeText('${safeLink}');alert('Link kimásolva')}}">Megosztás</button>
      </div>
    </div>`;
    try { await navigator.clipboard.writeText(link); } catch(_) {}
    if(typeof showProjectHelp === 'function') showProjectHelp('Ügyfél link elkészült', box);
    else alert('Ügyfél link elkészült: ' + link);
  }, 'Ügyfél link készül...');
  window.v71DownloadApprovedHtml = async function(){ const html=await makeHtml('saját ügyfélpéldány',false); downloadHtml(`${safeName(projectTitle())}-sajat-ugyfelpeldany.html`,html); };
  window.v71PrintApprovedReport = async function(){ const html=await makeHtml('saját ügyfélpéldány',false); await printHtml(html); };

  console.log('ÉpítésNapló V121 egységes riportmotor aktív.');
})();



// ===== beolvasztva V153-ba: project-v128-button-status-fix.js =====
// V128 - projekt összefoglaló gomb-visszajelzés fix
// Cél: a Projekt összefoglalóban lévő Saját példány HTML / PDF / ügyfél link gombok is
// láthatóan írják ki, hogy dolgoznak, ne csak csendben induljon el a folyamat.
(function(){
  'use strict';
  if(window.__epitesNaploV128ButtonStatusFix) return;
  window.__epitesNaploV128ButtonStatusFix = true;

  function isButton(el){ return el && el.tagName === 'BUTTON'; }
  function escCss(v){ try { return CSS.escape(String(v)); } catch(_) { return String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); } }

  function setBusy(btn, text){
    if(!isButton(btn)) return function(){};
    if(!btn.dataset.v128OriginalHtml) btn.dataset.v128OriginalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy','true');
    btn.innerHTML = text || 'Dolgozom…';
    return function(){
      if(!isButton(btn)) return;
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
      if(btn.dataset.v128OriginalHtml){
        btn.innerHTML = btn.dataset.v128OriginalHtml;
        delete btn.dataset.v128OriginalHtml;
      }
    };
  }

  function activeButton(){
    const a = document.activeElement;
    return isButton(a) ? a : null;
  }

  function findButtonFor(action, id){
    const a = activeButton();
    if(action === 'html'){
      if(a && (a.matches('[data-v109-copy]') || a.matches('[data-v71-download]') || a.matches('[data-v79-approval-download]'))) return a;
      if(id) return document.querySelector(`[data-v109-copy="${escCss(id)}"], [data-v71-download="${escCss(id)}"], [data-v79-approval-download="${escCss(id)}"]`);
    }
    if(action === 'pdf'){
      if(a && (a.matches('[data-v109-pdf]') || a.matches('[data-v71-print]') || a.matches('[data-v79-approval-print]'))) return a;
      if(id) return document.querySelector(`[data-v109-pdf="${escCss(id)}"], [data-v71-print="${escCss(id)}"], [data-v79-approval-print="${escCss(id)}"]`);
    }
    if(action === 'reply'){
      if(a && a.matches('[data-v109-reply]')) return a;
      if(id) return document.querySelector(`[data-v109-reply="${escCss(id)}"]`);
    }
    if(action === 'clientLink'){
      if(a && /ügyfél|link|jóváhagyás/i.test(a.textContent || '')) return a;
    }
    return null;
  }

  function wrapAsync(fnName, action, label){
    const original = window[fnName];
    if(typeof original !== 'function' || original.__v128Wrapped) return;
    const wrapped = async function(){
      const id = arguments[0];
      const btn = findButtonFor(action, id);
      const done = setBusy(btn, typeof label === 'function' ? label(btn, id) : label);
      try{
        return await original.apply(this, arguments);
      }finally{
        setTimeout(done, 350);
      }
    };
    wrapped.__v128Wrapped = true;
    wrapped.__v128Original = original;
    window[fnName] = wrapped;
  }

  function installWrappers(){
    wrapAsync('v71DownloadApprovedHtml', 'html', 'Saját példány készül…');
    wrapAsync('v71PrintApprovedReport', 'pdf', 'PDF készül…');
    wrapAsync('v109ReplyToClientQuestion', 'reply', 'Válasz ablak nyílik…');
    wrapAsync('createProjectClientLinkV25', 'clientLink', 'Ügyfél link készül…');
  }

  // A V77 mentett riport gombok saját belső kezelőt használnak, ezért itt csak a feliratot pontosítjuk.
  document.addEventListener('click', function(e){
    const btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if(!btn) return;

    if(btn.matches('[data-v77-down]')){
      setTimeout(function(){ if(btn.disabled) btn.innerHTML = 'HTML mentés készül…'; }, 0);
    }
    if(btn.matches('[data-v77-pdf]')){
      setTimeout(function(){ if(btn.disabled) btn.innerHTML = 'PDF készül…'; }, 0);
    }
    if(btn.matches('[data-v77-open]')){
      setTimeout(function(){ if(btn.disabled) btn.innerHTML = 'Riport megnyitása…'; }, 0);
    }
    if(btn.matches('[data-v77-del]')){
      setTimeout(function(){ if(btn.disabled) btn.innerHTML = 'Törlés…'; }, 0);
    }
  }, true);

  installWrappers();
  document.addEventListener('DOMContentLoaded', installWrappers);
  setTimeout(installWrappers, 400);
  setTimeout(installWrappers, 1400);
})();



// ===== beolvasztva V153-ba: project-v129-current-upload-basket-fix.js =====
// V129 - Aktuális napi fotók javítása
// Cél: új napi bejegyzés után a feltöltési kosár biztosan ürüljön,
// hogy a következő bejegyzés ne vigye magával az előző nap fotóit.
(function(){
  const UPLOAD_IDS = ['beforeFiles','afterFiles','detailFiles','detailVideos'];

  function byId(id){ return document.getElementById(id); }

  function safeEsc(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function setUploadStatus(message, type){
    try{
      let box = byId('v32UploadStatus');
      if(!box){
        const anchor = document.querySelector('.videoUploadBox') || byId('detailFiles') || byId('dailyFormCard');
        if(anchor && anchor.parentNode){
          box = document.createElement('div');
          box.id = 'v32UploadStatus';
          box.className = 'v32UploadStatus';
          anchor.parentNode.insertBefore(box, anchor.nextSibling);
        }
      }
      if(box){
        box.className = 'v32UploadStatus ' + (type || 'info');
        box.innerHTML = message;
      }
    }catch(_){}
  }

  function setEmptyFiles(input){
    if(!input) return;
    try { input.value = ''; } catch(_){}
    try {
      const dt = new DataTransfer();
      input.files = dt.files;
    } catch(_){}
  }

  function syncBasketToInput(id){
    try{
      const input = byId(id);
      const basket = (window.v37FileBaskets && Array.isArray(window.v37FileBaskets[id])) ? window.v37FileBaskets[id] : null;
      if(!input || !basket) return;
      const dt = new DataTransfer();
      basket.forEach(file => {
        try { dt.items.add(file); } catch(_){}
      });
      input.files = dt.files;
    }catch(_){}
  }

  function countSelectedUploads(){
    return UPLOAD_IDS.reduce((sum, id) => sum + (byId(id)?.files?.length || 0), 0);
  }

  function clearOneUpload(id){
    try{
      if(window.v37FileBaskets) window.v37FileBaskets[id] = [];
      setEmptyFiles(byId(id));
      const preview = byId(id + 'BasketPreview');
      if(preview) preview.innerHTML = '';
    }catch(_){}
  }

  window.v129ClearCurrentEntryUploads = function(){
    UPLOAD_IDS.forEach(clearOneUpload);
    try { if(typeof window.v37InitProjectBaskets === 'function') window.v37InitProjectBaskets(); } catch(_){}
  };

  // A régi v37 tisztítót is megerősítjük, mert csak value='' nem minden böngészőn üríti a FileList-et.
  const oldClear = window.v37ClearBasket;
  window.v37ClearBasket = function(id){
    try { if(typeof oldClear === 'function') oldClear(id); } catch(_){}
    clearOneUpload(id);
  };

  function installWrapper(){
    const original = window.saveDailyEntry || (typeof saveDailyEntry === 'function' ? saveDailyEntry : null);
    if(!original || original.__v129CurrentUploadFix) return false;

    const wrapped = async function(){
      try { if(typeof window.v37InitProjectBaskets === 'function') window.v37InitProjectBaskets(); } catch(_){}
      UPLOAD_IDS.forEach(syncBasketToInput);

      const beforeCount = byId('beforeFiles')?.files?.length || 0;
      const afterCount = byId('afterFiles')?.files?.length || 0;
      const generalCount = byId('detailFiles')?.files?.length || 0;
      const videoCount = byId('detailVideos')?.files?.length || 0;
      const photoCount = beforeCount + afterCount + generalCount;

      if(photoCount || videoCount){
        setUploadStatus(
          `<b>Aktuális napi mentés folyamatban...</b><br>Ehhez a bejegyzéshez ${photoCount} fotó és ${videoCount} videó kerül mentésre. A régi képek nem kerülnek hozzá újra.`,
          'info'
        );
      }

      let result;
      try{
        result = await original.apply(this, arguments);
      } finally {
        // Szándékosan minden lefutás után ürítjük a kosarat, mert a beragadt FileList okozta,
        // hogy az új napi riport az előző 7 képet is hozzáadta.
        window.v129ClearCurrentEntryUploads();
      }

      if(photoCount || videoCount){
        setUploadStatus(
          `<b>Mentés után a feltöltési kosár kiürítve.</b><br>A következő napi bejegyzés már csak az akkor kiválasztott új képeket fogja tartalmazni.`,
          'ok'
        );
      }
      return result;
    };

    wrapped.__v129CurrentUploadFix = true;
    window.saveDailyEntry = wrapped;
    try { saveDailyEntry = wrapped; } catch(_){}
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(installWrapper, 300);
    setTimeout(installWrapper, 1200);
  });

  // Ha minden script már betöltődött, azonnal is telepítjük.
  setTimeout(installWrapper, 0);
  setTimeout(installWrapper, 1800);
})();



// ===== beolvasztva V153-ba: project-v134-report-entry-photo-fix.js =====
// V134 - Riport fotók és mobil gyorsmentés szétválasztása
// Cél:
// 1) A riportba minden MÁR MENTETT bejegyzés saját fotója bekerüljön.
// 2) A Gyors mobilos mentés csak az aktuálisan kiválasztott képeket mentse, ne húzza be a régi feltöltési kosarat.
(function(){
  'use strict';
  if(window.__v134ReportEntryPhotoFix) return;
  window.__v134ReportEntryPhotoFix = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uniq = arr => [...new Set((arr || []).map(x => String(x || '').trim()).filter(Boolean))];
  const st = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const qs = id => document.getElementById(id);
  const projectId = () => st()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => st()?.project?.name || st()?.project?.title || 'Építési napló';
  const money = n => (Number(n || 0) || 0).toLocaleString('hu-HU') + ' Ft';
  const fmt = d => { try { return d ? new Date(d).toLocaleString('hu-HU') : ''; } catch(_) { return String(d || ''); } };
  const safeName = v => String(v || 'epitesi-naplo-riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo-riport';
  const toast = (m,t='ok') => { try { window.showToast ? window.showToast(m,t) : console.log(m); } catch(_){} };

  function validImg(s){
    s = String(s || '').trim();
    if(!s) return false;
    if(/^(javascript:|function\s*\(|\(function|window\.|document\.|const\s+|let\s+|var\s+)/i.test(s)) return false;
    if(/\.(mp4|mov|webm|m4v|3gp|pdf|html)(\?|#|$)/i.test(s)) return false;
    return /^data:image\//i.test(s) || /^https?:\/\//i.test(s) || /^blob:/i.test(s) || /^\//.test(s) || /^\.\//.test(s) || /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(s);
  }
  function validVideo(v){
    const s = String(v || '').trim();
    return !!s && (/^data:video\//i.test(s) || /^https?:\/\//i.test(s) || /^blob:/i.test(s) || /\.(mp4|mov|webm|m4v|3gp)(\?|#|$)/i.test(s));
  }
  function arr(v){ return Array.isArray(v) ? v.filter(Boolean) : []; }
  function mediaValue(item){
    if(!item) return '';
    if(typeof item === 'string') return item;
    return item.url || item.src || item.href || item.publicUrl || item.public_url || item.signedUrl || item.signed_url || item.dataUrl || item.data_url || item.image_url || item.photo_url || item.file_url || item.path || item.storage_path || item.file_path || item.image_path || '';
  }
  function collectImagesFromKnownFields(e){
    if(!e) return [];
    const ai = e.ai_json || e.analysis || {};
    const list = [];
    [
      e.images, e.image_urls, e.image_url, e.image, e.photos, e.photo_urls,
      e.beforeImages, e.afterImages, e.generalImages,
      e.before_images_json, e.after_images_json, e.general_images_json,
      ai.images, ai.image_urls, ai.beforeImages, ai.afterImages, ai.generalImages
    ].forEach(v => {
      if(Array.isArray(v)) v.forEach(x => list.push(mediaValue(x)));
      else if(v) list.push(mediaValue(v));
    });
    return uniq(list).filter(validImg);
  }
  function collectVideosFromKnownFields(e){
    if(!e) return [];
    const ai = e.ai_json || e.analysis || {};
    const list = [];
    [e.videos, e.videoUrls, e.video_urls, e.video_url, ai.videos, ai.videoUrls, ai.video_urls].forEach(v => {
      if(Array.isArray(v)) v.forEach(x => list.push(mediaValue(x)));
      else if(v) list.push(mediaValue(v));
    });
    return uniq(list).filter(validVideo);
  }
  function mergeEntry(serverEntry, stateEntry){
    const s = serverEntry || {};
    const l = stateEntry || {};
    const imgs = collectImagesFromKnownFields(s);
    const localImgs = collectImagesFromKnownFields(l);
    const vids = collectVideosFromKnownFields(s);
    const localVids = collectVideosFromKnownFields(l);
    const merged = { ...l, ...s };
    merged.images = imgs.length ? imgs : localImgs;
    merged.image_urls = merged.images;
    merged.image_url = merged.images[0] || s.image_url || l.image_url || '';
    merged.beforeImages = arr(s.beforeImages).length ? arr(s.beforeImages) : (arr(s.before_images_json).length ? arr(s.before_images_json) : (arr(l.beforeImages).length ? arr(l.beforeImages) : arr(l.before_images_json)));
    merged.afterImages = arr(s.afterImages).length ? arr(s.afterImages) : (arr(s.after_images_json).length ? arr(s.after_images_json) : (arr(l.afterImages).length ? arr(l.afterImages) : arr(l.after_images_json)));
    merged.generalImages = arr(s.generalImages).length ? arr(s.generalImages) : (arr(s.general_images_json).length ? arr(s.general_images_json) : (arr(l.generalImages).length ? arr(l.generalImages) : arr(l.general_images_json)));
    if(!merged.generalImages.length && merged.images.length) merged.generalImages = merged.images.filter(x => !merged.beforeImages.includes(x) && !merged.afterImages.includes(x));
    merged.videos = vids.length ? vids : localVids;
    merged.videoUrls = merged.videos;
    return merged;
  }
  function findLocalFor(serverEntry, localEntries, index){
    if(!serverEntry) return localEntries[index] || null;
    const sid = String(serverEntry.id || serverEntry.entry_id || '').trim();
    if(sid){
      const byId = localEntries.find(e => String(e.id || e.entry_id || '').trim() === sid);
      if(byId) return byId;
    }
    const created = String(serverEntry.created_at || '').slice(0,19);
    const phase = String(serverEntry.phase || '').trim();
    if(created || phase){
      const byMeta = localEntries.find(e => String(e.created_at || '').slice(0,19) === created && String(e.phase || '').trim() === phase);
      if(byMeta) return byMeta;
    }
    return localEntries[index] || null;
  }
  async function getReportDataV134(){
    let data = {};
    try { data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId()) || {}; } catch(e) { console.warn('V134 záróadat hiba:', e); }
    const localEntries = Array.isArray(st()?.entries) ? st().entries : [];
    const serverEntries = Array.isArray(data.entries) ? data.entries : [];
    let entries = serverEntries.length ? serverEntries.map((e,i) => mergeEntry(e, findLocalFor(e, localEntries, i))) : localEntries.map(e => mergeEntry(e,e));

    // Ha a Supabase csak szöveget adott vissza, de a képek a projekt oldalon már látszanak, akkor a lokális entry-listát használjuk.
    const serverPhotoCount = entries.reduce((s,e) => s + collectImagesFromKnownFields(e).length, 0);
    const localPhotoCount = localEntries.reduce((s,e) => s + collectImagesFromKnownFields(e).length, 0);
    if(localPhotoCount > serverPhotoCount){
      entries = localEntries.map(e => mergeEntry(e,e));
    }

    return {
      ...data,
      entries,
      materials: Array.isArray(data.materials) ? data.materials : [],
      invoices: Array.isArray(data.invoices) ? data.invoices : []
    };
  }

  function matLine(m){ return `${esc(m?.name || m?.material || m?.title || m?.megnevezes || 'Anyag')} ${esc(m?.quantity || m?.mennyiseg || '')} ${esc(m?.unit || m?.egyseg || '')}`.trim(); }
  function imageGrid(imgs){
    imgs = uniq(imgs).filter(validImg);
    if(!imgs.length) return '<p class="muted">Ehhez a bejegyzéshez nincs csatolt fotó.</p>';
    return '<div class="photos v134Photos">' + imgs.map((src,i) => '<figure class="v121Photo v134Photo"><img src="'+esc(src)+'" data-full-src="'+esc(src)+'" alt="Napló fotó '+(i+1)+'" loading="lazy" decoding="async"><figcaption>'+(i+1)+'. kép – nagyítás</figcaption></figure>').join('') + '</div>';
  }
  function videoGrid(vids){
    vids = uniq(vids).filter(validVideo);
    if(!vids.length) return '';
    return '<h3>Munkavideók</h3><div class="photos v134Videos">' + vids.map((src,i) => '<figure class="v121Photo v134Video"><video controls playsinline preload="metadata" src="'+esc(src)+'"></video><figcaption>'+(i+1)+'. videó</figcaption></figure>').join('') + '</div>';
  }
  function cssScript(){
    return `<style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:24px;line-height:1.45}.doc{max-width:1050px;margin:auto}.pill{display:inline-block;background:#fff2bf;color:#8a5a00;border-radius:999px;padding:7px 13px;font-weight:700}.cover{border-bottom:4px solid #f5a400;margin-bottom:20px;padding-bottom:16px}.muted{color:#64748b}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0}.stat{background:#f3f4f6;border-radius:10px;padding:12px}.stat b{display:block;color:#d97706;font-size:22px}.entry{border-left:4px solid #f5a400;background:#fafafa;margin:18px 0;padding:16px 18px;border-radius:12px;break-inside:avoid}.aiBox{background:#ecfdf5;border-left:5px solid #22c55e;border-radius:12px;padding:14px 16px;margin:12px 0}.photos,.v134Photos{display:grid!important;grid-template-columns:repeat(auto-fill,112px)!important;gap:10px!important;align-items:start!important;margin:12px 0!important}.v121Photo,.v134Photo{width:112px!important;min-height:132px!important;border:1px solid #d1d5db!important;border-radius:12px!important;background:#fff!important;padding:5px!important;margin:0!important;box-sizing:border-box!important;overflow:hidden!important;break-inside:avoid!important}.v121Photo img,.v134Photo img{display:block!important;width:100px!important;height:100px!important;object-fit:cover!important;border-radius:9px!important;cursor:zoom-in!important;background:#f8fafc!important}.v121Photo video,.v134Video video{display:block!important;width:100px!important;height:100px!important;object-fit:cover!important;border-radius:9px!important;background:#111}.v121Photo figcaption,.v134Photo figcaption{font-size:11px;color:#64748b;margin-top:4px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e5e7eb;text-align:left;padding:8px}
      .v150ReportViewer{position:fixed!important;inset:0!important;z-index:2147483647!important;background:rgba(2,6,23,.96)!important;display:none!important;color:#fff!important;font-family:Arial,Helvetica,sans-serif!important;touch-action:none!important}.v150ReportViewer.open{display:block!important}.v150Top{position:absolute!important;left:0!important;right:0!important;top:0!important;min-height:58px!important;background:#081225!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:9px 12px!important;box-shadow:0 8px 22px rgba(0,0,0,.3)!important;z-index:2!important}.v150Title{font-weight:900!important;font-size:14px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:36vw!important}.v150Btns{display:flex!important;gap:7px!important;align-items:center!important;flex-wrap:wrap!important;justify-content:flex-end!important}.v150Btns button,.v150Nav{border:1px solid rgba(255,255,255,.18)!important;border-radius:12px!important;background:#122038!important;color:#fff!important;font-weight:900!important;cursor:pointer!important;padding:9px 12px!important;line-height:1!important}.v150Btns button:hover,.v150Nav:hover{background:#fbbf24!important;color:#111827!important}.v150Btns .primary{background:#fbbf24!important;color:#111827!important;border-color:#fbbf24!important}.v150Stage{position:absolute!important;inset:58px 0 0 0!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;padding:22px 66px!important;touch-action:none!important}.v150Stage img{max-width:100%!important;max-height:100%!important;object-fit:contain!important;border-radius:14px!important;background:#000!important;box-shadow:0 22px 70px rgba(0,0,0,.42)!important;transform-origin:center center!important;will-change:transform!important;user-select:none!important;-webkit-user-select:none!important;-webkit-touch-callout:none!important}.v150Stage.full img{max-width:none!important;max-height:none!important;width:auto!important;height:auto!important}.v150Nav{position:absolute!important;top:50%!important;transform:translateY(-50%)!important;width:46px!important;height:72px!important;font-size:36px!important;padding:0!important;background:rgba(15,23,42,.86)!important;z-index:3!important}.v150Nav.prev{left:9px!important}.v150Nav.next{right:9px!important}body.v150Open{overflow:hidden!important}
      @media(max-width:760px){body{padding:14px}.stats{grid-template-columns:repeat(2,1fr)}.photos,.v134Photos{grid-template-columns:repeat(3,92px)!important}.v121Photo,.v134Photo{width:92px!important;min-height:112px!important}.v121Photo img,.v134Photo img,.v134Video video{width:80px!important;height:80px!important}.v150Top{align-items:flex-start!important}.v150Title{font-size:12px!important;max-width:28vw!important}.v150Btns{gap:5px!important}.v150Btns button{padding:8px 9px!important;font-size:12px!important}.v150Stage{padding:18px 8px!important}.v150Nav{width:38px!important;height:58px!important;font-size:31px!important;opacity:.92}.v150Nav.prev{left:4px!important}.v150Nav.next{right:4px!important}}
      @media print{.v150ReportViewer{display:none!important}.photos,.v134Photos{grid-template-columns:repeat(4,30mm)!important}.v121Photo,.v134Photo{width:30mm!important;min-height:34mm!important}.v121Photo img,.v134Photo img{width:28mm!important;height:28mm!important}}
    </style><script>(function(){'use strict';if(window.__v150ReportViewer)return;window.__v150ReportViewer=true;var SEL='.v134Photos img,.v121Photos img,.photos img,.entryImageGrid img,.reportImageGrid img,figure img';var idx=0,list=[],scale=1,tx=0,ty=0,startDist=0,startScale=1,startX=0,startY=0,panX=0,panY=0,oneX=0,oneY=0,oneMoved=false;function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c})}function srcOf(el){return el.getAttribute('data-full-src')||el.currentSrc||el.src||''}function visible(el){var r=el.getBoundingClientRect();return r.width>6&&r.height>6}function collect(ctx){var root=(ctx&&ctx.closest&&ctx.closest('.entry'))||document;var nodes=Array.prototype.slice.call(root.querySelectorAll(SEL));if(nodes.length<2)nodes=Array.prototype.slice.call(document.querySelectorAll(SEL));var seen={};return nodes.filter(function(img){var s=srcOf(img);if(!s||!visible(img)||img.closest('.v150ReportViewer'))return false;if(seen[s])return false;seen[s]=1;return true}).map(function(img,i){return{el:img,src:srcOf(img),title:img.alt||(img.closest('figure')&&img.closest('figure').querySelector('figcaption')&&img.closest('figure').querySelector('figcaption').textContent)||('Napló fotó '+(i+1))}})}function viewer(){var v=document.getElementById('v150ReportViewer');if(v)return v;v=document.createElement('div');v.id='v150ReportViewer';v.className='v150ReportViewer';v.innerHTML='<div class="v150Top"><div id="v150Title" class="v150Title">Napló fotó</div><div class="v150Btns"><button type="button" data-act="minus">−</button><button type="button" data-act="plus">+</button><button type="button" data-act="reset">100%</button><button class="primary" type="button" data-act="full">Teljes kép</button><button type="button" data-act="close">Bezárás</button></div></div><button type="button" class="v150Nav prev">‹</button><div id="v150Stage" class="v150Stage"></div><button type="button" class="v150Nav next">›</button>';document.body.appendChild(v);v.querySelector('.prev').onclick=function(e){e.stopPropagation();show(idx-1)};v.querySelector('.next').onclick=function(e){e.stopPropagation();show(idx+1)};v.querySelector('[data-act="close"]').onclick=close;v.querySelector('[data-act="minus"]').onclick=function(){setScale(scale-.35)};v.querySelector('[data-act="plus"]').onclick=function(){setScale(scale+.35)};v.querySelector('[data-act="reset"]').onclick=function(){scale=1;tx=0;ty=0;stage().classList.remove('full');apply()};v.querySelector('[data-act="full"]').onclick=function(){stage().classList.toggle('full');if(stage().classList.contains('full'))setScale(Math.max(1.35,scale));else{scale=1;tx=0;ty=0;apply()}};v.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('img')){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}},true);v.addEventListener('wheel',function(e){if(!v.classList.contains('open'))return;e.preventDefault();setScale(scale+(e.deltaY<0?.25:-.25))},{passive:false});v.addEventListener('touchstart',touchStart,{passive:false});v.addEventListener('touchmove',touchMove,{passive:false});v.addEventListener('touchend',touchEnd,{passive:false});return v}function stage(){return document.getElementById('v150Stage')}function apply(){var img=stage()&&stage().querySelector('img');if(img)img.style.transform='translate3d('+tx+'px,'+ty+'px,0) scale('+scale+')'}function setScale(s){scale=Math.max(1,Math.min(6,s));if(scale===1){tx=0;ty=0}apply()}function show(i,ctx){if(ctx)list=collect(ctx);if(!list.length)list=collect(document);if(!list.length)return;idx=(i+list.length)%list.length;scale=1;tx=0;ty=0;var it=list[idx],v=viewer();document.getElementById('v150Title').textContent=(it.title||'Napló fotó')+' ('+(idx+1)+'/'+list.length+')';stage().classList.remove('full');stage().innerHTML='<img src="'+esc(it.src)+'" alt="'+esc(it.title||'Napló fotó')+'">';v.classList.add('open');document.body.classList.add('v150Open')}function close(){var v=document.getElementById('v150ReportViewer');if(v){v.classList.remove('open');stage().innerHTML=''}document.body.classList.remove('v150Open')}function dist(a,b){var dx=a.clientX-b.clientX,dy=a.clientY-b.clientY;return Math.sqrt(dx*dx+dy*dy)}function mid(a,b){return{x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2}}function touchStart(e){if(!e.currentTarget.classList.contains('open'))return;if(e.touches.length===2){e.preventDefault();startDist=dist(e.touches[0],e.touches[1]);startScale=scale;var m=mid(e.touches[0],e.touches[1]);startX=m.x;startY=m.y;panX=tx;panY=ty}else if(e.touches.length===1){oneX=e.touches[0].clientX;oneY=e.touches[0].clientY;panX=tx;panY=ty;oneMoved=false}}function touchMove(e){if(!e.currentTarget.classList.contains('open'))return;if(e.touches.length===2){e.preventDefault();var d=dist(e.touches[0],e.touches[1]),m=mid(e.touches[0],e.touches[1]);scale=Math.max(1,Math.min(6,startScale*(d/Math.max(1,startDist))));tx=panX+(m.x-startX);ty=panY+(m.y-startY);if(scale===1){tx=0;ty=0}apply()}else if(e.touches.length===1){var dx=e.touches[0].clientX-oneX,dy=e.touches[0].clientY-oneY;if(Math.abs(dx)>8||Math.abs(dy)>8)oneMoved=true;if(scale>1){e.preventDefault();tx=panX+dx;ty=panY+dy;apply()}}}function touchEnd(e){if(!e.currentTarget.classList.contains('open'))return;if(scale<=1&&oneMoved){var dx=(e.changedTouches[0]?e.changedTouches[0].clientX:oneX)-oneX;if(Math.abs(dx)>70)show(idx+(dx<0?1:-1))}}document.addEventListener('click',function(e){var img=e.target&&e.target.closest&&e.target.closest(SEL);if(!img||img.closest('.v150ReportViewer'))return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();list=collect(img);var s=srcOf(img);var i=list.findIndex(function(x){return x.src===s});show(Math.max(0,i),img)},true);document.addEventListener('keydown',function(e){var v=document.getElementById('v150ReportViewer');if(!v||!v.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')show(idx-1);if(e.key==='ArrowRight')show(idx+1);if(e.key==='+'||e.key==='=')setScale(scale+.35);if(e.key==='-')setScale(scale-.35)});})();<\/script>`;
  }

  function buildReportHtmlV134(data, title){
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    const materials = Array.isArray(data?.materials) ? data.materials : [];
    const invoices = Array.isArray(data?.invoices) ? data.invoices : [];
    const photoCount = entries.reduce((s,e) => s + collectImagesFromKnownFields(e).length, 0);
    const videoCount = entries.reduce((s,e) => s + collectVideosFromKnownFields(e).length, 0);
    const invoiceSum = invoices.reduce((s,x) => s + (Number(x.amount || x.gross_amount || x.total || 0) || 0), 0);
    const materialHtml = materials.length ? materials.map(m => '<li><b>'+matLine(m)+'</b></li>').join('') : '<li>Nincs rögzített anyag.</li>';
    const invoiceHtml = invoices.length ? invoices.map(i => '<tr><td>'+esc(i.title || i.name || i.description || 'Számla')+'</td><td>'+money(i.amount || i.gross_amount || i.total)+'</td><td>'+esc(i.note || '')+'</td></tr>').join('') : '<tr><td colspan="3">Nincs csatolt számla.</td></tr>';
    const rows = entries.map(e => {
      const imgs = collectImagesFromKnownFields(e);
      const vids = collectVideosFromKnownFields(e);
      const mats = Array.isArray(e.materials_json) ? e.materials_json : (Array.isArray(e.materials) ? e.materials : []);
      const weather = e.weather || e.weather_text || e.weather_json?.summary || e.weather_json?.text || '';
      const gps = e.location_address || e.locationAddress || e.gps_json?.address || e.gps_json?.text || e.gps || '';
      const ai = e.ai_report || e.ai_summary || e.ai_json?.summary || e.ai_json?.photoTextCheck || e.analysis?.summary || e.analysis?.photoTextCheck || '';
      return '<section class="entry"><h2>'+esc(fmt(e.created_at))+' – '+esc(e.phase || 'Napi bejegyzés')+'</h2><p>'+esc(e.note || e.description || '').replace(/\n/g,'<br>')+'</p><p><b>Dokumentáció:</b> '+imgs.length+' fotó, '+vids.length+' videó.</p>'+(mats.length?'<p><b>Napi anyag:</b> '+mats.map(matLine).join(', ')+'</p>':'')+(weather?'<p><b>Időjárás:</b> '+esc(weather)+'</p>':'')+(gps?'<p><b>GPS/helyadat:</b> '+esc(gps)+'</p>':'')+(ai?'<div class="aiBox"><b>AI szakmai kontroll:</b><br>'+esc(ai).replace(/\n/g,'<br>')+'</div>':'')+'<h3>Munka közben / dokumentáció</h3>'+imageGrid(imgs)+videoGrid(vids)+'</section>';
    }).join('') || '<p>Nincs napi bejegyzés ehhez a projekthez.</p>';
    return '<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><link rel="icon" href="https://epitesi-naplo.eu/favicon.png">'+cssScript()+'</head><body><div class="doc"><div class="cover"><span class="pill">Átadásra kész dokumentáció</span><h1>'+esc(title)+'</h1><p class="muted">Generálva: '+new Date().toLocaleString('hu-HU')+' • ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>'+entries.length+'</b>bejegyzés</div><div class="stat"><b>'+photoCount+'</b>fotó</div><div class="stat"><b>'+videoCount+'</b>videó</div><div class="stat"><b>0</b>magas kockázat</div><div class="stat"><b>'+money(invoiceSum)+'</b>számlák</div></div></div><h2>Rövid összegzés</h2><p>A dokumentum az ügyfélnek átadható, rendezett építési napló: napi munka, fotódokumentáció, anyagok, időjárás/GPS és nyitott ellenőrzések egy helyen.</p><h2>Anyagösszesítő</h2><ul>'+materialHtml+'</ul><h2>Számlák</h2><table><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr>'+invoiceHtml+'</table><h2>Vezetői AI összefoglaló</h2><div class="aiBox">Állapot: rendezett dokumentáció. Bejegyzések: '+entries.length+', fotók: '+photoCount+', videók: '+videoCount+'. A napi bejegyzések és fotók alapján az ügyfél számára átadható dokumentáció készült.</div><h2>Napi bejegyzések</h2>'+rows+'</div></body></html>';
  }
  async function makeHtml(kind){
    const data = await getReportDataV134();
    return buildReportHtmlV134(data, projectTitle() + ' – ' + kind);
  }
  function downloadHtml(name, html){
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1200);
  }
  async function printHtml(html){
    const w = window.open('', '_blank');
    if(!w){ downloadHtml(safeName(projectTitle())+'-riport.html', html); alert('A böngésző blokkolta az új ablakot. Letöltöttem HTML-ben, abból tudsz PDF-et menteni.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch(_){} }, 900);
  }
  async function saveDoc(title,type,html){
    try { await window.EpitesNaploAPI?.saveReportDocument?.({ projectId:projectId(), title, type, html, text:(new DOMParser().parseFromString(html,'text/html').body?.innerText || '').slice(0,200000), meta:{v134:true,entryPhotoFix:true} }); } catch(e) { console.warn('V134 riport dokumentum mentés hiba:', e); }
    try { window.v77RenderSavedReports && await window.v77RenderSavedReports(); } catch(_){}
  }
  async function busy(btn, label, fn){
    btn = btn || (document.activeElement && document.activeElement.tagName === 'BUTTON' ? document.activeElement : null);
    const old = btn ? btn.innerText : '';
    try { if(btn){ btn.disabled = true; btn.classList.add('is-loading'); btn.innerText = label; } return await fn(); }
    finally { if(btn){ btn.disabled = false; btn.classList.remove('is-loading'); btn.innerText = old; } }
  }

  window.buildProReportHtml = function(entries, title, options){
    const data = { entries:(entries || []).map(e => mergeEntry(e,e)), materials:options?.materials || [], invoices:options?.invoices || [] };
    return buildReportHtmlV134(data, title || (projectTitle() + ' – riport'));
  };
  try { buildProReportHtml = window.buildProReportHtml; } catch(_){}

  window.downloadClosingReportHtml = function(btn){ return busy(btn, 'Lezáró HTML készül...', async () => { const html = await makeHtml('lezáró építési napló'); await saveDoc(projectTitle()+' – lezáró HTML','closing_html_v134',html); downloadHtml(safeName(projectTitle())+'-lezaro-riport.html',html); toast('Lezáró HTML elkészült: a mentett bejegyzések saját fotói vannak benne.'); }); };
  window.printClosingDocument = function(btn){ return busy(btn, 'Lezáró PDF készül...', async () => { const html = await makeHtml('lezáró PRO építési napló'); await saveDoc(projectTitle()+' – lezáró PDF','closing_pdf_v134',html); await printHtml(html); toast('Lezáró PDF/nyomtatás megnyitva.'); }); };
  window.exportClosingPdfV25 = window.printClosingDocument;
  window.downloadWeeklyReportHtml = function(btn){ return busy(btn, 'Heti HTML készül...', async () => { const data = await getReportDataV134(); const from = new Date(); from.setDate(from.getDate()-7); data.entries = (data.entries || []).filter(e => new Date(e.created_at || 0) >= from); const html = buildReportHtmlV134(data, projectTitle()+' – heti építési napló'); await saveDoc(projectTitle()+' – heti HTML','weekly_html_v134',html); downloadHtml(safeName(projectTitle())+'-heti-riport.html',html); toast('Heti HTML elkészült.'); }); };
  window.printWeeklyReport = function(btn){ return busy(btn, 'Heti PDF készül...', async () => { const data = await getReportDataV134(); const from = new Date(); from.setDate(from.getDate()-7); data.entries = (data.entries || []).filter(e => new Date(e.created_at || 0) >= from); const html = buildReportHtmlV134(data, projectTitle()+' – heti PRO építési napló'); await saveDoc(projectTitle()+' – heti PDF','weekly_pdf_v134',html); await printHtml(html); toast('Heti PDF/nyomtatás megnyitva.'); }); };
  window.exportWeeklyPdfV25 = window.printWeeklyReport;

  window.createProjectClientLinkV25 = function(btn){
    return busy(btn, 'Ügyfél link készül...', async () => {
      if(!projectId()) return alert('Nincs projekt.');
      if(typeof requirePaidPlanV27 === 'function'){
        const ok = await requirePaidPlanV27('Ügyfél link + jóváhagyás');
        if(!ok) return;
      }
      const html = await makeHtml('ügyfélriport');
      const text = (new DOMParser().parseFromString(html,'text/html').body?.innerText || projectTitle()).slice(0,200000);
      const saved = await Promise.race([
        window.EpitesNaploAPI.createPublicReport({ projectId:projectId(), projectName:projectTitle(), reportHtml:html, reportText:text }),
        new Promise((_,rej) => setTimeout(() => rej(new Error('A riport mentése túl sokáig tartott. Ellenőrizd az internetet / Supabase kapcsolatot, majd próbáld újra.')), 30000))
      ]);
      await saveDoc(projectTitle()+' – ügyfélriport link','client_report_v134',html);
      const link = window.EpitesNaploAPI.createClientShareUrl(saved.token);
      try { localStorage.setItem('epitesnaplo_last_project_id', projectId()); localStorage.setItem('epitesnaplo_current_project_id', projectId()); localStorage.setItem('epitesnaplo:lastReportLink:'+projectId(), link); } catch(_){}
      try { await navigator.clipboard.writeText(link); } catch(_){}
      const safeLink = esc(link);
      const box = '<div class="featureHelpBox v124ClientLinkBox"><b>✅ Ügyfél link elkészült</b><p>A PRO ügyfélriport elkészült: minden mentett napi bejegyzés a saját fotóit mutatja. A gyors mobilos képek csak ahhoz a bejegyzéshez kerülnek, ahol feltöltötted őket.</p><p><a class="btn primary" target="_blank" rel="noopener" href="'+safeLink+'">Ügyfélriport megnyitása</a></p><p class="muted" style="word-break:break-all;user-select:all;">'+safeLink+'</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn ghost" type="button" onclick="navigator.clipboard.writeText(\''+safeLink+'\').then(()=>alert(\'Link kimásolva\'))">Link másolása</button><button class="btn ghost" type="button" onclick="if(navigator.share){navigator.share({title:\'Ügyfélriport – ÉpítésNapló AI PRO\',text:\'Fotókkal igazolt, csak olvasható építési riport.\',url:\''+safeLink+'\'})}else{navigator.clipboard.writeText(\''+safeLink+'\');alert(\'Link kimásolva\')}">Megosztás</button></div></div>';
      if(typeof showProjectHelp === 'function') showProjectHelp('Ügyfél link elkészült', box);
      else alert('Ügyfél link elkészült: ' + link);
    });
  };

  // Gyors mobilos mentés: csak az aktuális gyors-panel fájljai kerülnek az új bejegyzéshez.
  const oldQuickPhase = window.v36GetQuickWorkPhase || (typeof v36GetQuickWorkPhase === 'function' ? v36GetQuickWorkPhase : null);
  window.v33SaveQuickEntry = async function(btn){
    if(!st()?.project) return alert('Nincs kiválasztott projekt.');
    const noteBase = qs('v33QuickNote')?.value.trim() || '';
    if(!noteBase) return alert('Írj legalább egy rövid jegyzetet.');
    const input = qs('v33QuickFiles');
    const files = Array.from(input?.files || []);
    try { if(typeof window.v37ClearBasket === 'function'){ ['beforeFiles','afterFiles','detailFiles','detailVideos'].forEach(id => window.v37ClearBasket(id)); } } catch(_){}
    if(typeof v33SetQuickStatus === 'function') v33SetQuickStatus('<b>Gyors mentés folyamatban...</b><br>Csak az itt kiválasztott aktuális fájlok kerülnek ehhez a bejegyzéshez.', 'info');
    const imageFiles = files.filter(file => String(file.type || '').startsWith('image/'));
    const videoFiles = files.filter(file => String(file.type || '').startsWith('video/'));
    const images = await readFilesAsDataUrls(imageFiles, 8);
    const videos = await uploadVideoFilesToStorage(videoFiles, 2);
    const phase = oldQuickPhase ? oldQuickPhase() : (qs('v33QuickPhase')?.value || 'Munka közben');
    const status = qs('v33QuickStatus')?.value || 'Folyamatban';
    const note = 'Dátum: '+new Date().toISOString().slice(0,10)+'\n'+noteBase+'\nDokumentáció: '+images.length+' fotó, '+videos.length+' videó.';
    const analysis = analyzeEntry({ note, phase, status, priority:'Közepes', images, general:images, videos, imageCount:images.length, videoCount:videos.length });
    analysis.generalImages = images;
    analysis.videos = videos;
    await window.EpitesNaploAPI.saveEntry({
      projectId: st().project.id,
      phase, status, priority:'Közepes', responsible:'Gyors mobilos mentés', weather: qs('detailWeather')?.value || 'Nincs megadva',
      note, images, image_urls: images, generalImages: images, beforeImages: [], afterImages: [], image: images[0] || '', videos, videoUrls: videos, analysis
    });
    if(qs('v33QuickNote')) qs('v33QuickNote').value = '';
    if(input){ try{ input.value = ''; }catch(_){} try{ const dt = new DataTransfer(); input.files = dt.files; }catch(_){} }
    if(qs('v33QuickCustomPhase')) qs('v33QuickCustomPhase').value = '';
    try { await reloadProjectEntries(); } catch(_){}
    if(typeof v33SetQuickStatus === 'function') v33SetQuickStatus('<b>Gyors mentés kész.</b><br>'+images.length+' aktuális fotó és '+videos.length+' videó került ehhez az új bejegyzéshez. A régi képek nem kerültek hozzá.', 'ok');
  };
  try { v33SaveQuickEntry = window.v33SaveQuickEntry; } catch(_){}

  console.log('ÉpítésNapló V134 riport fotó / gyorsmentés javítás aktív.');
})();



// ===== beolvasztva V153-ba: project-v149-performance-upload-optimizer.js =====
// V149 - Supabase gyorsítás + kép/videó feltöltés optimalizálás
// Csak ráépülő javítás: nem írja felül a riport/képnéző logikát.
(function(){
  'use strict';
  if (window.__EPITESNAPLO_V149_OPTIMIZER__) return;
  window.__EPITESNAPLO_V149_OPTIMIZER__ = true;

  const MB = 1024 * 1024;
  const IMAGE_MAX_SIDE = 1000;
  const IMAGE_QUALITY = 0.58;
  const IMAGE_STRONG_QUALITY = 0.48;
  const VIDEO_DIRECT_MB = 18;     // ez alatt közvetlen feltöltés
  const VIDEO_MAX_UPLOAD_MB = 45;  // efölött csak sikeres böngészős tömörítés után mehet
  const VIDEO_MAX_SECONDS = 60;
  const VIDEO_TARGET_WIDTH = 960;
  const VIDEO_TARGET_HEIGHT = 540;
  const VIDEO_FPS = 24;

  const cache = window.__EPITESNAPLO_FAST_CACHE__ || (window.__EPITESNAPLO_FAST_CACHE__ = new Map());
  function cacheGet(key, ttlMs){
    try{
      const item = cache.get(key);
      if(!item || (Date.now() - item.t) > ttlMs) return null;
      return item.v;
    }catch(_){ return null; }
  }
  function cacheSet(key, value){ try{ cache.set(key, { t: Date.now(), v: value }); }catch(_){} return value; }
  function cacheDelPrefix(prefix){
    try{ [...cache.keys()].forEach(k => { if(String(k).startsWith(prefix)) cache.delete(k); }); }catch(_){}
  }
  window.epitesNaploClearFastCache = function(){ try{ cache.clear(); }catch(_){} };

  function toDataUrl(file){
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
  function dataUrlBytes(dataUrl){
    const s = String(dataUrl || '');
    const comma = s.indexOf(',');
    const b64 = comma >= 0 ? s.slice(comma + 1) : s;
    return Math.round((b64.length * 3) / 4);
  }
  async function imageFromDataUrl(src){
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    try{ await img.decode(); }catch(_){ await new Promise((res, rej)=>{ img.onload=res; img.onerror=rej; }); }
    return img;
  }

  async function compressImageFileV149(file, maxSide = IMAGE_MAX_SIDE, quality = IMAGE_QUALITY){
    if(!String(file?.type || '').startsWith('image/')) return '';
    const original = await toDataUrl(file);
    if(!original) return '';
    try{
      const img = await imageFromDataUrl(original);
      let q = file.size > 3 * MB ? IMAGE_STRONG_QUALITY : quality;
      let side = file.size > 3 * MB ? 850 : maxSide;
      const scale = Math.min(1, side / Math.max(img.width || 1, img.height || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
      canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      if(!ctx) return original;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let compressed = canvas.toDataURL('image/jpeg', q);
      // Extra védelem: ha még mindig nagy, menjünk lejjebb.
      if(dataUrlBytes(compressed) > 850 * 1024 && Math.max(canvas.width, canvas.height) > 720){
        const ratio = 720 / Math.max(canvas.width, canvas.height);
        const c2 = document.createElement('canvas');
        c2.width = Math.max(1, Math.round(canvas.width * ratio));
        c2.height = Math.max(1, Math.round(canvas.height * ratio));
        const x2 = c2.getContext('2d', { alpha:false });
        x2.fillStyle = '#ffffff';
        x2.fillRect(0,0,c2.width,c2.height);
        x2.drawImage(canvas,0,0,c2.width,c2.height);
        compressed = c2.toDataURL('image/jpeg', 0.48);
      }
      return compressed && compressed.length < original.length ? compressed : original;
    }catch(err){
      console.warn('V149 képtömörítés hiba, eredeti kép használata:', err);
      return original;
    }
  }

  window.compressImageFile = compressImageFileV149;
  window.readFilesAsDataUrls = function(fileList, max = 10){
    const files = Array.from(fileList || []).filter(file => String(file.type || '').startsWith('image/')).slice(0, max);
    return Promise.all(files.map(file => compressImageFileV149(file))).then(items => items.filter(Boolean));
  };

  function canRecordVideo(){
    return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
  }
  function preferredRecorderType(){
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }

  async function compressVideoFileV149(file){
    if(!file || !String(file.type || '').startsWith('video/')) return file;
    if(file.size <= VIDEO_DIRECT_MB * MB) return file;
    if(!canRecordVideo()){
      // iPhone Safari alatt ez előfordulhat. Ilyenkor nem hazudunk tömörítést.
      if(file.size > VIDEO_MAX_UPLOAD_MB * MB){
        alert(`Ez a videó túl nagy és ezen a böngészőn nem tömöríthető automatikusan: ${file.name}\nKérlek vágd 10–60 mp-re vagy küldd kisebb méretben.`);
        return null;
      }
      return file;
    }
    const recType = preferredRecorderType();
    if(!recType) return file.size <= VIDEO_MAX_UPLOAD_MB * MB ? file : null;

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;

    try{
      await new Promise((resolve, reject)=>{ video.onloadedmetadata = resolve; video.onerror = reject; });
      const duration = Math.min(Number(video.duration || VIDEO_MAX_SECONDS), VIDEO_MAX_SECONDS);
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const scale = Math.min(1, VIDEO_TARGET_WIDTH / w, VIDEO_TARGET_HEIGHT / h);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, Math.round(w * scale));
      canvas.height = Math.max(2, Math.round(h * scale));
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(VIDEO_FPS);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: recType, videoBitsPerSecond: 900000 });
      recorder.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
      const done = new Promise(resolve => { recorder.onstop = resolve; });

      function draw(){
        if(video.paused || video.ended) return;
        try{ ctx.drawImage(video, 0, 0, canvas.width, canvas.height); }catch(_){ }
        requestAnimationFrame(draw);
      }
      recorder.start(750);
      video.currentTime = 0;
      await video.play();
      draw();
      await new Promise(resolve => setTimeout(resolve, Math.max(1200, duration * 1000)));
      video.pause();
      if(recorder.state !== 'inactive') recorder.stop();
      await done;
      const blob = new Blob(chunks, { type: 'video/webm' });
      URL.revokeObjectURL(url);
      if(blob.size && blob.size < file.size){
        const name = file.name.replace(/\.[^.]+$/, '') + '-tomoritett.webm';
        return new File([blob], name, { type: 'video/webm', lastModified: Date.now() });
      }
      return file.size <= VIDEO_MAX_UPLOAD_MB * MB ? file : null;
    }catch(err){
      URL.revokeObjectURL(url);
      console.warn('V149 videó tömörítés hiba:', err);
      return file.size <= VIDEO_MAX_UPLOAD_MB * MB ? file : null;
    }
  }

  window.uploadVideoFilesToStorage = async function(fileList, max = 2){
    const files = Array.from(fileList || []).slice(0, max);
    if(!files.length) return [];
    const client = window.supabaseDirect;
    if(!client){ alert('Videó feltöltés nem érhető el: Supabase kapcsolat nem található.'); return []; }
    const uploaded = [];
    for(let i = 0; i < files.length; i++){
      const original = files[i];
      if(!original || !String(original.type || '').startsWith('video/')){ alert(`Ez nem videófájl, kihagyva: ${original?.name || ''}`); continue; }
      const optimized = await compressVideoFileV149(original);
      if(!optimized){ alert(`A videó kimaradt, mert túl nagy volt vagy nem sikerült tömöríteni: ${original.name}`); continue; }
      if(optimized.size > VIDEO_MAX_UPLOAD_MB * MB){ alert(`Túl nagy videó kimarad: ${optimized.name}\nMaximum kb. ${VIDEO_MAX_UPLOAD_MB} MB / videó.`); continue; }
      const ext = (optimized.name.split('.').pop() || 'webm').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webm';
      const safeName = optimized.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(-80) || `video.${ext}`;
      const userId = (window.detailState?.user?.id) || 'user';
      const projectId = (window.detailState?.project?.id) || 'project';
      const storagePath = `${userId}/${projectId}/${Date.now()}-${i}-${safeName}`;
      const contentType = optimized.type || (ext === 'webm' ? 'video/webm' : 'video/mp4');
      const { error } = await client.storage.from('project-videos').upload(storagePath, optimized, {
        cacheControl: '604800',
        upsert: false,
        contentType
      });
      if(error){
        console.warn('Videó feltöltési probléma:', error);
        alert('Videó feltöltési probléma: ' + (error.message || error));
        continue;
      }
      const signed = await getSignedVideoUrl(storagePath, 3600);
      uploaded.push({
        path: storagePath,
        src: signed || '',
        name: original.name,
        type: contentType,
        size: optimized.size,
        originalSize: original.size,
        compressed: optimized.size < original.size,
        private: true
      });
    }
    return uploaded;
  };

  async function getSignedVideoUrl(path, seconds = 3600){
    const client = window.supabaseDirect;
    if(!client || !path) return '';
    const key = `v149_signed_video_${path}`;
    try{
      const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
      if(cached?.url && cached?.exp > Date.now() + 60000) return cached.url;
    }catch(_){}
    const { data, error } = await client.storage.from('project-videos').createSignedUrl(path, seconds);
    if(!error && data?.signedUrl){
      try{ sessionStorage.setItem(key, JSON.stringify({ url: data.signedUrl, exp: Date.now() + (seconds - 120) * 1000 })); }catch(_){}
      return data.signedUrl;
    }
    return '';
  }

  window.hydratePrivateVideoUrls = async function(entries){
    if(!Array.isArray(entries)) return entries || [];
    await Promise.all(entries.map(async entry => {
      const videos = (typeof window.getEntryVideos === 'function') ? window.getEntryVideos(entry) : (entry?.videos || entry?.videoUrls || entry?.video_urls || []);
      await Promise.all((videos || []).map(async video => {
        if(!video || typeof video !== 'object' || !video.path) return;
        const url = await getSignedVideoUrl(video.path, 3600);
        if(url) video.src = url;
      }));
    }));
    return entries;
  };

  function normalizeEntry(entry){
    return {
      ...entry,
      projectId: entry.project_id,
      image: entry.image_url,
      images: Array.isArray(entry.image_urls) ? entry.image_urls : (entry.image_url ? [entry.image_url] : []),
      beforeImages: Array.isArray(entry.before_images_json) ? entry.before_images_json : (Array.isArray(entry.ai_json?.beforeImages) ? entry.ai_json.beforeImages : []),
      afterImages: Array.isArray(entry.after_images_json) ? entry.after_images_json : (Array.isArray(entry.ai_json?.afterImages) ? entry.ai_json.afterImages : []),
      generalImages: Array.isArray(entry.general_images_json) ? entry.general_images_json : (Array.isArray(entry.ai_json?.generalImages) ? entry.ai_json.generalImages : []),
      videos: Array.isArray(entry.video_urls) ? entry.video_urls : (Array.isArray(entry.ai_json?.videos) ? entry.ai_json.videos : []),
      videoUrls: Array.isArray(entry.video_urls) ? entry.video_urls : (Array.isArray(entry.ai_json?.videoUrls) ? entry.ai_json.videoUrls : []),
      analysis: entry.ai_json || {
        level: entry.ai_level || 'Alacsony',
        score: entry.ai_score || 0,
        title: entry.ai_title || 'Elemzés',
        advice: Array.isArray(entry.ai_advice) ? entry.ai_advice : [],
        repairs: [],
        materials: []
      }
    };
  }

  const api = window.EpitesNaploAPI;
  if(api && !api.__v149PerformancePatched){
    api.__v149PerformancePatched = true;
    const oldGetProjects = api.getProjects?.bind(api);
    const oldGetEntries = api.getEntries?.bind(api);
    const oldSaveEntry = api.saveEntry?.bind(api);
    const oldSaveProject = api.saveProject?.bind(api);
    const oldUpdateProject = api.updateProject?.bind(api);
    const oldDeleteProject = api.deleteProject?.bind(api);
    const oldGetProjectCloseData = api.getProjectCloseData?.bind(api);

    api.getProjects = async function(){
      const user = await this.getCurrentUser();
      if(!user) return [];
      const key = `projects_${user.id}`;
      const c = cacheGet(key, 20000);
      if(c) return c;
      const data = oldGetProjects ? await oldGetProjects() : [];
      return cacheSet(key, data || []);
    };

    api.getProjectEntries = async function(projectId){
      const user = await this.getCurrentUser();
      if(!user || !projectId) return [];
      const key = `entries_${user.id}_${projectId}`;
      const c = cacheGet(key, 12000);
      if(c) return c;
      const db = window.supabaseDirect;
      let result = null;
      try{
        result = await db.from('entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('project_id', projectId)
          .order('created_at', { ascending:false });
      }catch(e){ console.warn('V149 projekt bejegyzések lekérés hiba:', e); }
      if(result?.error){ console.warn('V149 projekt bejegyzések hiba:', result.error); return []; }
      const rows = (result?.data || []).map(normalizeEntry);
      return cacheSet(key, rows);
    };

    api.getEntries = async function(){
      const user = await this.getCurrentUser();
      if(!user) return [];
      const key = `entries_all_${user.id}`;
      const c = cacheGet(key, 10000);
      if(c) return c;
      const data = oldGetEntries ? await oldGetEntries() : [];
      return cacheSet(key, data || []);
    };

    if(oldGetProjectCloseData){
      api.getProjectCloseData = async function(projectId){
        const user = await this.getCurrentUser();
        const key = user && projectId ? `close_${user.id}_${projectId}` : '';
        const c = key ? cacheGet(key, 8000) : null;
        if(c) return c;
        let entries = [];
        try{ entries = await this.getProjectEntries(projectId); }catch(_){ entries = []; }
        const [materials, invoices] = await Promise.all([
          this.getProjectMaterials ? this.getProjectMaterials(projectId) : [],
          this.getProjectInvoices ? this.getProjectInvoices(projectId) : []
        ]);
        const data = { entries, materials, invoices };
        return key ? cacheSet(key, data) : data;
      };
    }

    api.saveEntry = async function(entry){
      const result = await oldSaveEntry(entry);
      const pid = entry?.projectId || entry?.project_id || result?.project_id || result?.projectId;
      cacheDelPrefix('entries_'); cacheDelPrefix('close_');
      if(pid) cacheDelPrefix(`entries_`);
      return result;
    };
    api.saveProject = async function(project){ const r = await oldSaveProject(project); cacheDelPrefix('projects_'); return r; };
    api.updateProject = async function(projectId, name){ const r = await oldUpdateProject(projectId, name); cacheDelPrefix('projects_'); return r; };
    api.deleteProject = async function(projectId){ const r = await oldDeleteProject(projectId); cacheDelPrefix('projects_'); cacheDelPrefix('entries_'); cacheDelPrefix('close_'); return r; };
  }

  // Projektoldali gyorsítás: ne töltse le minden projekt összes bejegyzését, ha csak egy projektet nézünk.
  window.epitesNaploReloadProjectEntriesFastV149 = async function(){
    if(!window.EpitesNaploAPI?.getProjectEntries || !window.detailState) return false;
    const id = (typeof window.getProjectId === 'function') ? window.getProjectId() : new URLSearchParams(location.search).get('id');
    if(!id) return false;
    const entries = await window.EpitesNaploAPI.getProjectEntries(id);
    window.detailState.entries = entries || [];
    if(typeof window.hydratePrivateVideoUrls === 'function') await window.hydratePrivateVideoUrls(window.detailState.entries);
    if(typeof window.renderProjectSummary === 'function') window.renderProjectSummary();
    if(typeof window.renderProjectTimeline === 'function') window.renderProjectTimeline();
    return true;
  };

  console.info('V149 optimalizáló betöltve: kép/videó tömörítés + Supabase gyorsítás.');
})();



// ===== V153 CLEAN: stabilizálás, régi képnéző tiltás, riport-profisítás, admin takarítás API =====
(function(){
  'use strict';
  if(window.__EPITESNAPLO_V153_CLEAN_STABILIZER__) return;
  window.__EPITESNAPLO_V153_CLEAN_STABILIZER__ = true;

  const OLD_VIEWERS = '#mediaViewerModal,.mediaViewerModal,#v67Lightbox,.v67Lightbox,.v79ReportLightbox,#v77Lightbox,.v77Lightbox,.v86Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox,.v110Gallery,#v110Gallery,#v118Lightbox,.v118Lightbox,#v121Lightbox,.v121Lightbox,#v134Lightbox,.v134Lightbox,#v137ZoomViewer,.v137ZoomViewer,#v150ReportViewer,.v150ReportViewer,.v152Viewer,#v152Viewer';
  function killOldViewers(){
    try{
      document.querySelectorAll(OLD_VIEWERS).forEach(el => {
        if(el && el.id !== 'v153UnifiedViewer') el.remove();
      });
      document.documentElement.classList.remove('mediaViewerOpen');
      document.body.classList.remove('mediaViewerOpen');
    }catch(_){ }
  }
  setInterval(killOldViewers, 900);
  try{ new MutationObserver(killOldViewers).observe(document.documentElement,{childList:true,subtree:true}); }catch(_){ }

  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtDate(v){ try{ return v ? new Date(v).toLocaleString('hu-HU') : ''; }catch(_){ return String(v||''); } }
  function state(){ try{ return (typeof detailState !== 'undefined') ? detailState : (window.detailState || {}); }catch(_){ return window.detailState || {}; } }
  function projectId(){ return state()?.project?.id || new URLSearchParams(location.search).get('id') || ''; }
  function projectTitle(){ return state()?.project?.name || 'Építési napló'; }
  function safeName(v){ return String(v || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo'; }
  function countMedia(entries, type){
    let n=0;
    (Array.isArray(entries)?entries:[]).forEach(e=>{
      const imgs=[...(Array.isArray(e.images)?e.images:[]),...(Array.isArray(e.image_urls)?e.image_urls:[]),...(Array.isArray(e.beforeImages)?e.beforeImages:[]),...(Array.isArray(e.afterImages)?e.afterImages:[]),...(Array.isArray(e.generalImages)?e.generalImages:[])].filter(Boolean);
      const vids=[...(Array.isArray(e.videos)?e.videos:[]),...(Array.isArray(e.videoUrls)?e.videoUrls:[]),...(Array.isArray(e.video_urls)?e.video_urls:[])].filter(Boolean);
      n += type==='video' ? vids.length : imgs.length;
    });
    return n;
  }

  const REPORT_CSS = `<style id="v153-report-clean-css">
    .v153ClientHero{border:2px solid #fbbf24;background:linear-gradient(135deg,#fff7ed,#ffffff);border-radius:18px;padding:20px;margin:0 0 20px;box-shadow:0 12px 36px rgba(15,23,42,.08)}
    .v153ClientHero h1{margin:.1rem 0 .4rem!important}.v153ClientHero p{margin:.25rem 0!important;color:#475569}.v153ClientGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.v153ClientGrid div{background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:12px}.v153ClientGrid b{display:block;font-size:22px;color:#b45309}.v153ReportBlocks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}.v153ReportBlock{border:1px solid #e2e8f0;background:#f8fafc;border-radius:15px;padding:14px;break-inside:avoid}.v153ReportBlock b{display:block;color:#0f172a;margin-bottom:5px}.v153ReportBlock span{color:#475569}.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhoto,.v74Photos{gap:12px!important}.v67ReportPhoto,figure,.photo{break-inside:avoid;page-break-inside:avoid}.v67ReportPhoto img,figure img,.photos img,.entryImageGrid img,.reportImageGrid img{cursor:zoom-in!important}#v67Lightbox,.v67Lightbox,.v79ReportLightbox,.v100Lightbox,.v110Gallery,#v137ZoomViewer,.v150ReportViewer{display:none!important;visibility:hidden!important;pointer-events:none!important}@media(max-width:760px){.v153ClientGrid,.v153ReportBlocks{grid-template-columns:1fr}.v153ClientHero{padding:15px}.v153ClientGrid b{font-size:19px}}@media print{.v153ClientHero,.v153ReportBlock{break-inside:avoid;page-break-inside:avoid}.v153ReportBlocks{grid-template-columns:repeat(2,1fr)}}
  </style>`;

  const STANDALONE_VIEWER = `<style id="v153StandaloneViewerCss">#v153StandaloneViewer{position:fixed;inset:0;background:rgba(2,6,23,.93);z-index:2147483647;display:none;color:#fff;font-family:Arial,Helvetica,sans-serif;touch-action:none;overscroll-behavior:contain}#v153StandaloneViewer.open{display:block}.v153STop{position:absolute;left:0;right:0;top:0;min-height:58px;background:#0f172a;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;box-sizing:border-box}.v153STitle{font-weight:900;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v153SBtns{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.v153SBtns button,.v153SNav{border:1px solid rgba(255,255,255,.24);background:#172033;color:#fff;border-radius:10px;padding:8px 10px;font-weight:900;cursor:pointer}.v153SBtns .primary{background:#fbbf24;color:#111827;border-color:#fbbf24}.v153SStage{position:absolute;inset:58px 0 0 0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:16px;box-sizing:border-box}.v153SStage img{max-width:90vw;max-height:calc(100vh - 112px);object-fit:contain;border-radius:12px;box-shadow:0 20px 70px rgba(0,0,0,.55);transition:transform .08s ease;user-select:none;-webkit-user-drag:none}.v153SStage.full img{max-width:none;max-height:none}.v153SNav{position:absolute;top:50%;transform:translateY(-50%);z-index:3;font-size:32px;border-radius:14px;padding:10px 14px;background:#111827dd}.v153SNav.prev{left:10px}.v153SNav.next{right:10px}@media(max-width:720px){.v153STop{align-items:flex-start;min-height:74px}.v153SStage{inset:74px 0 0 0}.v153SStage img{max-width:92vw;max-height:calc(100vh - 136px)}.v153SNav{font-size:24px;padding:8px 12px}.v153STitle{max-width:38vw}}@media print{#v153StandaloneViewer{display:none!important}}</style><script>(function(){if(window.__v153StandaloneViewer)return;window.__v153StandaloneViewer=true;var SEL='.photos img,.entryImageGrid img,.reportImageGrid img,.v74Photos img,.v68ReportPhotos img,.v67ReportPhoto img,figure img,img.reportPhoto,[data-full-src]';var list=[],idx=0,scale=1,tx=0,ty=0,drag=false,sx=0,sy=0;function esc(s){return String(s||'').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c})}function srcOf(i){return i.getAttribute('data-full-src')||i.currentSrc||i.src||''}function good(i){var s=srcOf(i);return !!(s&&i&&!i.closest('#v153StandaloneViewer')&&!/favicon|logo/i.test(s));}function collect(ctx){var root=(ctx&&ctx.closest&&ctx.closest('.entry,.v133Entry,section,.doc,.reportDoc'))||document;var a=Array.from(root.querySelectorAll(SEL)).filter(good);if(a.length<2)a=Array.from(document.querySelectorAll(SEL)).filter(good);var seen={};return a.filter(function(i){var s=srcOf(i);if(seen[s])return false;seen[s]=1;return true}).map(function(i,n){return{src:srcOf(i),title:i.alt||'Napló fotó '+(n+1)}})}function stage(){return document.getElementById('v153SStage')}function apply(){var img=stage().querySelector('img');if(img)img.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')'}function close(){var v=document.getElementById('v153StandaloneViewer');if(v)v.classList.remove('open');document.body.style.overflow=''}function show(n,ctx){list=ctx?collect(ctx):list;if(!list.length)list=collect(document);if(!list.length)return;idx=(n+list.length)%list.length;scale=1;tx=0;ty=0;var v=document.getElementById('v153StandaloneViewer');if(!v){v=document.createElement('div');v.id='v153StandaloneViewer';v.innerHTML='<div class="v153STop"><div id="v153STitle" class="v153STitle">Napló fotó</div><div class="v153SBtns"><button data-a="minus">−</button><button data-a="plus">+</button><button data-a="reset">100%</button><button class="primary" data-a="full">Teljes kép</button><button data-a="close">Bezárás</button></div></div><button class="v153SNav prev">‹</button><div id="v153SStage" class="v153SStage"></div><button class="v153SNav next">›</button>';document.body.appendChild(v);v.querySelector('.prev').onclick=function(e){e.stopPropagation();show(idx-1)};v.querySelector('.next').onclick=function(e){e.stopPropagation();show(idx+1)};v.querySelector('[data-a=close]').onclick=close;v.querySelector('[data-a=minus]').onclick=function(){scale=Math.max(.5,scale-.25);apply()};v.querySelector('[data-a=plus]').onclick=function(){scale=Math.min(5,scale+.25);apply()};v.querySelector('[data-a=reset]').onclick=function(){scale=1;tx=0;ty=0;stage().classList.remove('full');apply()};v.querySelector('[data-a=full]').onclick=function(){stage().classList.toggle('full');scale=stage().classList.contains('full')?Math.max(1.35,scale):1;tx=0;ty=0;apply()};stage().addEventListener('pointerdown',function(e){drag=true;sx=e.clientX-tx;sy=e.clientY-ty;stage().setPointerCapture&&stage().setPointerCapture(e.pointerId)});stage().addEventListener('pointermove',function(e){if(!drag)return;tx=e.clientX-sx;ty=e.clientY-sy;apply()});stage().addEventListener('pointerup',function(){drag=false});v.addEventListener('wheel',function(e){e.preventDefault();scale=Math.max(.5,Math.min(5,scale+(e.deltaY<0?.2:-.2)));apply()},{passive:false});}document.getElementById('v153STitle').textContent=(list[idx].title||'Napló fotó')+' ('+(idx+1)+'/'+list.length+')';stage().classList.remove('full');stage().innerHTML='<img src="'+esc(list[idx].src)+'" alt="'+esc(list[idx].title)+'">';v.classList.add('open');document.body.style.overflow='hidden'}document.addEventListener('click',function(e){var img=e.target.closest&&e.target.closest(SEL);if(!img||img.closest('#v153StandaloneViewer'))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation();var l=collect(img);var s=srcOf(img);var n=l.findIndex(function(x){return x.src===s});list=l;show(n<0?0:n,img)},true);document.addEventListener('keydown',function(e){var v=document.getElementById('v153StandaloneViewer');if(!v||!v.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='ArrowRight')show(idx+1);if(e.key==='ArrowLeft')show(idx-1)});})();<\/script>`;

  function stripOldReportViewers(html){
    let out = String(html || '');
    out = out.replace(/<script\b[^>]*>[\s\S]*?(?:v67Lightbox|v74OpenReportPhoto|v77Lightbox|v79ReportLightbox|v86Lightbox|v100Lightbox|v103Lightbox|v110Gallery|v137ZoomViewer|v150ReportViewer|v152StandaloneViewer|mediaViewerModal)[\s\S]*?<\/script>/gi,'');
    out = out.replace(/<style\b[^>]*>[\s\S]*?(?:v67Lightbox|v79ReportLightbox|v100Lightbox|v137ZoomViewer|v150ReportViewer)[\s\S]*?<\/style>/gi, function(m){ return m.includes('v153-report-clean-css') ? m : ''; });
    out = out.replace(/\sonclick="[^"]*(?:openMediaViewer|openMediaViewerFromTile|openReportMediaLink|v74OpenReportPhoto|v77|v86|v100|Lightbox)[^"]*"/gi,'');
    out = out.replace(/\sonclick='[^']*(?:openMediaViewer|openMediaViewerFromTile|openReportMediaLink|v74OpenReportPhoto|v77|v86|v100|Lightbox)[^']*'/gi,'');
    return out;
  }

  function polishReportHtml(html, entries, options){
    let out = stripOldReportViewers(html);
    if(!/<!doctype|<html/i.test(out)) out = '<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(projectTitle())+'</title></head><body>'+out+'</body></html>';
    const imageCount = countMedia(entries, 'image');
    const videoCount = countMedia(entries, 'video');
    const latest = (Array.isArray(entries) ? entries : [])[0] || {};
    const status = latest.status || latest.phase || options?.status || 'Dokumentált munkafolyamat';
    const next = latest.analysis?.nextStep || latest.nextStep || 'A következő munkafázis rögzítése és fotózása.';
    const today = latest.note || latest.description || 'A napi bejegyzések alapján összesített munkadokumentáció.';
    const materials = Array.isArray(options?.materials) ? options.materials.length : 0;
    const hero = '<section class="v153ClientHero"><span class="badge">Ügyfélnek átadható riport</span><h1>'+esc(projectTitle())+'</h1><p>Átlátható munkaállapot, napi összefoglaló, következő lépés és fotódokumentáció egy helyen.</p><div class="v153ClientGrid"><div><b>'+((entries||[]).length)+'</b><span>naplóbejegyzés</span></div><div><b>'+imageCount+'</b><span>fotó</span></div><div><b>'+videoCount+'</b><span>videó</span></div><div><b>'+materials+'</b><span>anyag tétel</span></div></div></section>';
    const blocks = '<section class="v153ReportBlocks"><div class="v153ReportBlock"><b>Munka állapota</b><span>'+esc(status)+'</span></div><div class="v153ReportBlock"><b>Mai elvégzett munka</b><span>'+esc(today).slice(0,420)+'</span></div><div class="v153ReportBlock"><b>Következő lépés</b><span>'+esc(next)+'</span></div><div class="v153ReportBlock"><b>Fotódokumentáció</b><span>'+imageCount+' fotó és '+videoCount+' videó kapcsolódik a riporthoz.</span></div></section>';
    if(!out.includes('v153-report-clean-css')) out = out.includes('</head>') ? out.replace('</head>', REPORT_CSS + '</head>') : REPORT_CSS + out;
    if(!out.includes('v153ClientHero')) out = out.replace(/<body[^>]*>/i, m => m + hero + blocks);
    if(!out.includes('v153StandaloneViewerCss')) out = out.includes('</body>') ? out.replace('</body>', STANDALONE_VIEWER + '</body>') : out + STANDALONE_VIEWER;
    return out;
  }

  function wrapBuild(){
    const base = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
    if(!base || base.__v153CleanWrapped) return;
    const wrapped = function(entries, title, options){
      return polishReportHtml(base.apply(this, arguments), entries || [], options || {});
    };
    wrapped.__v153CleanWrapped = true;
    window.buildProReportHtml = wrapped;
    try{ buildProReportHtml = wrapped; }catch(_){ }
  }
  wrapBuild(); setTimeout(wrapBuild, 400); setTimeout(wrapBuild, 1500);

  if(window.EpitesNaploAPI && !window.EpitesNaploAPI.__v153CleanApi){
    const api = window.EpitesNaploAPI;
    const db = window.supabaseDirect;
    api.__v153CleanApi = true;
    ['createPublicReport','saveReportDocument','createReportDocument'].forEach(fn => {
      if(typeof api[fn] !== 'function') return;
      const old = api[fn].bind(api);
      api[fn] = function(payload){
        try{
          if(payload?.reportHtml) payload.reportHtml = polishReportHtml(payload.reportHtml, state()?.entries || [], {});
          if(payload?.html_content) payload.html_content = polishReportHtml(payload.html_content, state()?.entries || [], {});
          if(payload?.html) payload.html = polishReportHtml(payload.html, state()?.entries || [], {});
        }catch(_){ }
        return old(payload);
      };
    });

    api.getAdminSystemStatusV153 = async function(){
      if(!db) return null;
      const tables = ['projects','entries','public_reports','report_approvals','report_documents','report_events','ai_photo_analyses','project_materials','project_invoices','media_files'];
      const out = { tables:{}, updatedAt:new Date().toISOString() };
      await Promise.all(tables.map(async t => {
        try{
          const { count, error } = await db.from(t).select('id', { count:'exact', head:true });
          out.tables[t] = error ? null : (count || 0);
        }catch(_){ out.tables[t] = null; }
      }));
      try{
        const cutoff = new Date(Date.now() - 30*86400000).toISOString();
        const { count } = await db.from('report_events').select('id', {count:'exact', head:true}).lt('created_at', cutoff);
        out.oldReportEvents = count || 0;
      }catch(_){ out.oldReportEvents = null; }
      try{ out.orphanCleanupAvailable = typeof api.cleanupMyOrphanReportsV139 === 'function'; }catch(_){ out.orphanCleanupAvailable = false; }
      return out;
    };

    api.cleanupProjectRemaindersV153 = async function(){
      const before = await api.getAdminSystemStatusV153().catch(()=>null);
      const rpc = { ok:false, result:null };
      try{
        if(db){ const { data, error } = await db.rpc('admin_cleanup_project_remainders_v153'); if(!error){ rpc.ok=true; rpc.result=data; } }
      }catch(_){ }
      try{ if(typeof api.cleanupMyOrphanReportsV139 === 'function') await api.cleanupMyOrphanReportsV139(); }catch(e){ console.warn('V153 árva riport takarítás:', e?.message || e); }
      try{ if(typeof api.cleanupReportEvents === 'function') await api.cleanupReportEvents(30); }catch(e){ console.warn('V153 report_events takarítás:', e?.message || e); }
      const after = await api.getAdminSystemStatusV153().catch(()=>null);
      const deleted = {};
      if(before?.tables && after?.tables){ Object.keys(before.tables).forEach(k => { if(typeof before.tables[k]==='number' && typeof after.tables[k]==='number') deleted[k] = Math.max(0, before.tables[k] - after.tables[k]); }); }
      return { ok:true, rpc, before, after, deleted, updatedAt:new Date().toISOString() };
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    killOldViewers();
    const root = document.getElementById('publicReportContent');
    if(root && !root.dataset.v153Polished){ root.dataset.v153Polished='1'; root.classList.add('v153PublicReport'); }
  });
})();
