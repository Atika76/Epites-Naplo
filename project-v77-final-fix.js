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
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
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
      return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jóváhagyott építési napló riport</title><style>body{background:#f8fafc;color:#111827;font-family:Arial,sans-serif;padding:24px;line-height:1.45}.approvedStamp{border:2px solid #22c55e;background:#ecfdf5;border-radius:14px;padding:14px;margin:0 0 18px}.publicReportCard{max-width:1050px;margin:auto;background:white;padding:24px;border-radius:18px}.reportMediaTile img,.photos img{max-width:100%;height:auto}@media print{body{padding:0;background:#fff}.publicReportCard{box-shadow:none;border-radius:0}.approvedStamp{break-inside:avoid}}</style></head><body><div class="publicReportCard">${stamp}${body}</div></body></html>`;
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
