/* ÉpítésNapló STABIL RIPORT MOTOR
   Egyetlen közös riportépítő: ügyfélriport, saját HTML, PDF/nyomtatás, heti/lezáró riport.
   Nem nyúl loginhoz és Supabase beállításokhoz. */
(function(){
  'use strict';
  if(window.__EpitesNaploStableReportEngine) return;
  window.__EpitesNaploStableReportEngine = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeName = v => String(v || 'epitesi-naplo-riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo-riport';
  const uniq = arr => [...new Set((arr || []).map(x => String(x || '').trim()).filter(Boolean))];
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Építési napló';
  const api = () => window.EpitesNaploAPI || {};
  const money = n => `${(Number(n || 0) || 0).toLocaleString('hu-HU')} Ft`;
  const fmt = v => { try{ return v ? new Date(v).toLocaleString('hu-HU') : ''; }catch(_){ return String(v||''); } };

  function isImg(v){
    const s = String(v || '').trim();
    if(!s) return false;
    if(/^(javascript:|blob:|function\s*\(|\(function|window\.|document\.|const\s+|let\s+|var\s+)/i.test(s)) return false;
    return /^data:image\//i.test(s) || /^https?:\/\//i.test(s) || /^\//.test(s) || /^\.\//.test(s) || /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(s);
  }
  function collectImages(value, out){
    if(!value) return;
    if(Array.isArray(value)){ value.forEach(v => collectImages(v, out)); return; }
    if(typeof value === 'object'){
      const o = value;
      ['url','src','href','path','image','image_url','storage_path','file_path','publicUrl','public_url','signedUrl','signed_url','dataUrl','full_path'].forEach(k => collectImages(o[k], out));
      ['images','imageUrls','image_urls','photos','beforeImages','afterImages','generalImages','before_images_json','after_images_json','general_images_json','media','ai_json','analysis'].forEach(k => collectImages(o[k], out));
      return;
    }
    const s = String(value || '').trim();
    if(isImg(s)) out.push(s);
  }
  function entryImages(entry){
    const out = [];
    collectImages(entry, out);
    return uniq(out).filter(x => !/favicon|logo|icon/i.test(x));
  }
  function domImages(){
    const roots = [document.getElementById('entriesTimeline'), document.getElementById('timelineList'), document.querySelector('.timeline'), document.querySelector('main')].filter(Boolean);
    const out = [];
    roots.forEach(root => root.querySelectorAll('img').forEach(img => {
      const alt = (img.alt || '').toLowerCase();
      const cls = String(img.className || '').toLowerCase();
      if(alt.includes('ikon') || alt.includes('logo') || cls.includes('logo') || cls.includes('brand')) return;
      const src = img.getAttribute('data-full-src') || img.getAttribute('data-src') || img.currentSrc || img.src || '';
      if(isImg(src)) out.push(src);
    }));
    return uniq(out);
  }
  function normalizeEntries(entries){
    const arr = Array.isArray(entries) ? entries.slice() : [];
    const allEntryImages = uniq(arr.flatMap(entryImages));
    const fromDom = domImages().filter(x => !allEntryImages.includes(x));
    if(fromDom.length){
      if(arr.length){
        const first = arr[0];
        const imgs = uniq([...entryImages(first), ...fromDom]);
        arr[0] = {...first, images: imgs, image_urls: imgs, generalImages: imgs, general_images_json: imgs};
      }else{
        arr.push({ created_at:new Date().toISOString(), phase:'Fotódokumentáció', note:'A projekthez rögzített fotódokumentáció.', images: fromDom, image_urls: fromDom, generalImages: fromDom, general_images_json: fromDom });
      }
    }
    return arr;
  }
  function photoGrid(imgs){
    imgs = uniq(imgs);
    if(!imgs.length) return '<p class="muted">Ehhez a bejegyzéshez nincs csatolt fotó.</p>';
    return `<div class="enpPhotos">${imgs.map((src,i)=>`<figure class="enpPhoto"><img src="${esc(src)}" data-full-src="${esc(src)}" alt="Napló fotó ${i+1}" loading="lazy" decoding="async"><figcaption>Nagyítás</figcaption></figure>`).join('')}</div>`;
  }
  function reportCssAndScript(){
    return `<style>
      *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:26px;line-height:1.5}.doc{max-width:1080px;margin:0 auto}.pill{display:inline-block;background:#fff2bf;color:#8a5a00;border-radius:999px;padding:7px 13px;font-weight:800}.cover{border-bottom:4px solid #f5a400;padding-bottom:18px;margin-bottom:22px}h1{font-size:34px;line-height:1.08;margin:18px 0 8px}h2{font-size:24px;margin-top:26px}h3{font-size:18px;margin-top:22px}.muted{color:#4b5563}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:22px 0}.stat{background:#f3f4f6;border-radius:12px;padding:14px}.stat b{display:block;color:#d97706;font-size:24px}.section,.invoice,.aiBox,.entry{break-inside:avoid;page-break-inside:avoid}.aiBox{border-left:5px solid #22c55e;background:#ecfdf5;padding:18px 22px;margin:24px 0;border-radius:12px}.entry{border-left:4px solid #f5a400;background:#fafafa;margin:22px 0;padding:18px 22px;border-radius:12px}.note{margin:12px 0;white-space:normal}.enpPhotos{display:grid;grid-template-columns:repeat(auto-fill,112px);gap:12px;margin:12px 0 8px}.enpPhoto{width:112px;max-width:112px;min-height:132px;border:1px solid #d1d5db;border-radius:12px;padding:5px;background:#fff;margin:0;overflow:hidden;break-inside:avoid;page-break-inside:avoid}.enpPhoto img{display:block;width:100px!important;height:100px!important;max-width:100px!important;max-height:100px!important;object-fit:cover;border-radius:9px;cursor:zoom-in;background:#f8fafc}.enpPhoto figcaption{font-size:11px;color:#64748b;line-height:1.2;margin-top:4px}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #e5e7eb;text-align:left}.enpGallery{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.94);display:none;align-items:center;justify-content:center;padding:70px 60px 30px}.enpGallery.open{display:flex}.enpGallery img{max-width:96vw!important;max-height:86vh!important;width:auto!important;height:auto!important;object-fit:contain!important;border-radius:14px!important;background:#000}.enpGallery button{position:fixed;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:900;cursor:pointer}.enpClose{top:14px;right:14px;padding:10px 14px}.enpPrev,.enpNext{top:50%;transform:translateY(-50%);width:46px;height:70px;font-size:34px}.enpPrev{left:12px}.enpNext{right:12px}@media(max-width:760px){body{padding:16px}.stats{grid-template-columns:repeat(2,1fr)}h1{font-size:28px}.enpPhotos{grid-template-columns:repeat(3,92px)}.enpPhoto{width:92px;min-height:112px}.enpPhoto img{width:80px!important;height:80px!important}.enpGallery{padding:62px 8px 20px}.enpPrev,.enpNext{width:38px;height:56px;font-size:28px}}@media print{@page{size:A4;margin:12mm}body{padding:0}.doc{max-width:none}.stats{grid-template-columns:repeat(5,1fr);gap:5mm}.stat{padding:4mm}.enpGallery{display:none!important}.enpPhotos{grid-template-columns:repeat(4,30mm)!important;gap:5mm!important}.enpPhoto{width:30mm!important;min-height:34mm!important;padding:1mm!important}.enpPhoto img{width:28mm!important;height:28mm!important}.section,.invoice,.aiBox,.entry{break-inside:avoid;page-break-inside:avoid}h1,h2,h3{break-after:avoid;page-break-after:avoid}}
    </style><script>(function(){var idx=0;function imgs(){return Array.prototype.slice.call(document.querySelectorAll('.enpPhotos img,.enpPhoto img')).filter(function(i){return i.src&&!i.closest('.enpGallery')})}function gallery(){var g=document.getElementById('enpGallery');if(g)return g;g=document.createElement('div');g.id='enpGallery';g.className='enpGallery';g.innerHTML='<button class="enpClose" type="button">Bezárás ×</button><button class="enpPrev" type="button">‹</button><img alt="Nagyított napló kép"><button class="enpNext" type="button">›</button>';document.body.appendChild(g);g.querySelector('.enpClose').onclick=function(e){e.preventDefault();g.classList.remove('open')};g.querySelector('.enpPrev').onclick=function(e){e.stopPropagation();show(idx-1)};g.querySelector('.enpNext').onclick=function(e){e.stopPropagation();show(idx+1)};g.onclick=function(e){if(e.target===g)g.classList.remove('open')};return g}function show(n){var list=imgs();if(!list.length)return;idx=(n+list.length)%list.length;var g=gallery();g.querySelector('img').src=list[idx].currentSrc||list[idx].src;g.classList.add('open')}document.addEventListener('click',function(e){var img=e.target.closest&&e.target.closest('.enpPhotos img,.enpPhoto img');if(!img)return;e.preventDefault();e.stopPropagation();show(imgs().indexOf(img))},true);document.addEventListener('keydown',function(e){var g=document.getElementById('enpGallery');if(!g||!g.classList.contains('open'))return;if(e.key==='Escape')g.classList.remove('open');if(e.key==='ArrowLeft')show(idx-1);if(e.key==='ArrowRight')show(idx+1)});})();<\/script>`;
  }
  function buildReportHtml(entries, title, data){
    entries = normalizeEntries(entries);
    data = data || {};
    const materials = Array.isArray(data.materials) ? data.materials : [];
    const invoices = Array.isArray(data.invoices) ? data.invoices : [];
    const invoiceSum = invoices.reduce((s,x)=>s+(Number(x.amount||x.gross_amount||x.total||0)||0),0);
    const photoCount = entries.reduce((s,e)=>s+entryImages(e).length,0);
    const videoCount = entries.reduce((s,e)=>s+((Array.isArray(e.video_urls)?e.video_urls.length:0) || (Array.isArray(e.videos)?e.videos.length:0)),0);
    const materialHtml = materials.length ? materials.map(m=>`<li><b>${esc(m.name||m.material||m.megnevezes||'Anyag')}</b> ${esc(m.quantity||m.qty||m.mennyiseg||'')} ${esc(m.unit||m.egyseg||'')}</li>`).join('') : '<li>Nincs rögzített anyag.</li>';
    const invoiceHtml = invoices.length ? invoices.map(i=>`<tr><td>${esc(i.title||i.name||i.description||'Számla')}</td><td>${money(i.amount||i.gross_amount||i.total)}</td><td>${esc(i.note||'')}</td></tr>`).join('') : '<tr><td colspan="3">Nincs csatolt számla.</td></tr>';
    const rows = entries.map(e=>{
      const imgs = entryImages(e);
      const mats = Array.isArray(e.materials_json) ? e.materials_json : (Array.isArray(e.materials)?e.materials:[]);
      const weather = e.weather || e.weather_text || e.weather_json?.summary || e.weatherJson?.summary || e.weather_json?.text || '';
      const gps = e.location_address || e.locationAddress || e.gps_json?.address || e.gpsJson?.address || e.gps || '';
      const ai = e.ai_report || e.ai_summary || e.ai_json?.summary || e.analysis?.summary || e.ai_json?.photoTextCheck || e.analysis?.photoTextCheck || '';
      const note = e.note || e.description || e.text || '';
      return `<section class="entry"><h2>${esc(fmt(e.created_at))} – ${esc(e.phase||'Napi bejegyzés')}</h2><div class="note">${esc(note).replace(/\n/g,'<br>')}</div><p><b>Dokumentáció:</b> ${imgs.length} fotó, 0 videó.</p>${mats.length?`<p><b>Napi anyag:</b> ${mats.map(m=>`${esc(m.name||m.material||m.megnevezes||'Anyag')} ${esc(m.quantity||m.qty||m.mennyiseg||'')} ${esc(m.unit||m.egyseg||'')}`).join(', ')}</p>`:''}${weather?`<p><b>Időjárás:</b> ${esc(weather)}</p>`:''}${gps?`<p><b>GPS/helyadat:</b> ${esc(gps)}</p>`:''}${ai?`<div class="aiBox"><b>AI szakmai kontroll:</b><br>${esc(ai).replace(/\n/g,'<br>')}</div>`:''}<h3>Munka közben / fotódokumentáció</h3><p>Kattints bármelyik fotóra a nagyításhoz.</p>${photoGrid(imgs)}</section>`;
    }).join('') || '<p>Nincs napi bejegyzés ehhez a projekthez.</p>';
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="icon" type="image/png" href="https://epitesi-naplo.eu/favicon.png"><link rel="shortcut icon" href="https://epitesi-naplo.eu/favicon.ico"><link rel="apple-touch-icon" href="https://epitesi-naplo.eu/favicon.png">${reportCssAndScript()}</head><body><main class="doc"><div class="cover"><span class="pill">Átadásra kész dokumentáció</span><h1>${esc(title)}</h1><p class="muted">Generálva: ${new Date().toLocaleString('hu-HU')} • ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>${entries.length}</b>bejegyzés</div><div class="stat"><b>${photoCount}</b>fotó</div><div class="stat"><b>${videoCount}</b>videó</div><div class="stat"><b>0</b>magas kockázat</div><div class="stat"><b>${money(invoiceSum)}</b>számlák</div></div></div><section class="section"><h2>Rövid összegzés</h2><p>A dokumentum az ügyfélnek átadható, rendezett építési napló: napi munka, fotódokumentáció, anyagok, időjárás/GPS és nyitott ellenőrzések egy helyen.</p></section><section class="section"><h2>Anyagösszesítő</h2><ul>${materialHtml}</ul></section><section class="invoice"><h2>Számlák</h2><table><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr>${invoiceHtml}</table></section><section class="aiBox"><h2>Vezetői AI összefoglaló</h2><p>Állapot: rendezett dokumentáció. Bejegyzések: ${entries.length}, fotók: ${photoCount}, videók: ${videoCount}. A napi bejegyzések és fotók alapján az ügyfél számára átadható dokumentáció készült.</p></section><h2>Napi bejegyzések</h2>${rows}</main></body></html>`;
  }

  async function getCloseData(){
    let data = null;
    try{ if(api().getProjectCloseData && projectId()) data = await api().getProjectCloseData(projectId()); }catch(e){ console.warn('Riport adatlekérés hiba:', e); }
    data = data || {};
    if(!Array.isArray(data.entries) || !data.entries.length) data.entries = state()?.entries || [];
    data.entries = normalizeEntries(data.entries);
    return data;
  }
  function waitImagesIn(win){
    const doc = win?.document || document;
    const imgs = [...doc.images].filter(i=>i.src);
    return Promise.all(imgs.map(img => img.complete && img.naturalWidth !== 0 ? true : new Promise(res=>{ img.onload=img.onerror=res; setTimeout(res,6000); })));
  }
  function downloadHtml(filename, html){
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},1000);
  }
  async function openPrint(html){
    const w = window.open('', '_blank');
    if(!w) return alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakot.');
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(()=>waitImagesIn(w).then(()=>{ try{ w.focus(); w.print(); }catch(_){} }), 800);
  }
  async function makeReport(label, days){
    const data = await getCloseData();
    let entries = data.entries || [];
    if(days){ const cutoff = Date.now() - days*86400000; entries = entries.filter(e => !e.created_at || new Date(e.created_at).getTime() >= cutoff); }
    entries = normalizeEntries(entries);
    const photoCount = entries.reduce((s,e)=>s+entryImages(e).length,0);
    if((state()?.entries || []).length && !photoCount){
      alert('A képek még nem töltődtek be a riporthoz. Várj pár másodpercet, majd próbáld újra.');
      throw new Error('Képek még nem töltődtek be.');
    }
    const title = `${projectTitle()} – ${label}`;
    return { title, html: buildReportHtml(entries, title, {...data, entries}) };
  }
  async function saveDoc(doc){
    const localKey = `stable_report_docs_${projectId() || 'local'}`;
    const row = { id:'local-'+Date.now(), created_at:new Date().toISOString(), ...doc };
    try{
      if(api().saveReportDocument && projectId()) return await api().saveReportDocument({ projectId:projectId(), ...doc });
    }catch(e){ console.warn('Riport dokumentum mentés Supabase-be nem sikerült, helyi mentés lesz:', e); }
    const list = JSON.parse(localStorage.getItem(localKey)||'[]'); list.unshift(row); localStorage.setItem(localKey, JSON.stringify(list.slice(0,50))); return row;
  }
  async function listDocs(){
    let rows=[]; try{ if(api().listReportDocuments && projectId()) rows=await api().listReportDocuments(projectId()); }catch(e){ console.warn(e); }
    const local = JSON.parse(localStorage.getItem(`stable_report_docs_${projectId()||'local'}`)||'[]');
    return [...(rows||[]), ...local];
  }
  async function refreshDocBox(){
    const host = document.getElementById('v74DocumentsBox') || document.getElementById('v71ApprovalsBox');
    if(!host) return;
    let box = document.getElementById('stableSavedReportsBox');
    if(!box){ box=document.createElement('div'); box.id='stableSavedReportsBox'; box.className='notice v74SavedReportsBox'; host.insertAdjacentElement('afterend', box); }
    const docs = await listDocs();
    if(!docs.length){ box.innerHTML='<b>Mentett riport példányok</b><p class="muted">Még nincs külön mentett saját példány.</p>'; return; }
    box.innerHTML = '<b>Mentett riport példányok</b>' + docs.slice(0,12).map(d=>`<div class="v71ApprovalRow"><div><span class="tag info">${esc(d.document_type||d.type||'riport')}</span><br><small>${esc(fmt(d.created_at||''))}</small><p>${esc(d.title||'Építési napló riport')}</p></div><div class="v71ApprovalActions"><button class="btn small primary" type="button" data-stable-open="${esc(d.id)}">Megnyitás</button><button class="btn small ghost" type="button" data-stable-pdf="${esc(d.id)}">PDF / nyomtatás</button><button class="btn small danger" type="button" data-stable-del="${esc(d.id)}">Törlés</button></div></div>`).join('');
  }
  async function findDoc(id){ return (await listDocs()).find(d => String(d.id) === String(id)); }
  window.stableRefreshSavedReports = refreshDocBox;
  window.stableOpenSavedReport = async function(id){ const d=await findDoc(id); if(!d) return alert('Nem találom a mentett riportot.'); const w=window.open('', '_blank'); if(!w) return downloadHtml(`${safeName(d.title)}.html`, d.html_content||d.html||''); w.document.open(); w.document.write(d.html_content||d.html||''); w.document.close(); };
  window.stablePrintSavedReport = async function(id){ const d=await findDoc(id); if(!d) return alert('Nem találom a mentett riportot.'); await openPrint(d.html_content||d.html||''); };
  window.stableDeleteSavedReport = async function(id){ if(!confirm('Biztosan törlöd ezt a mentett riport példányt?')) return; try{ if(!String(id).startsWith('local-') && api().deleteReportDocument) await api().deleteReportDocument(id); const key=`stable_report_docs_${projectId()||'local'}`; localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key)||'[]').filter(x=>String(x.id)!==String(id)))); await refreshDocBox(); }catch(e){ alert('Törlési hiba: '+(e.message||e)); } };

  function setReportCenterResult(html){
    const modal = document.getElementById('reportCenterModalV69');
    const card = modal?.querySelector('.v69ModalCard');
    if(!card) return;
    let box = document.getElementById('stableReportCenterResult');
    if(!box){ box=document.createElement('div'); box.id='stableReportCenterResult'; box.className='notice'; box.style.margin='12px 0'; card.querySelector('.v69ModalHead')?.insertAdjacentElement('afterend', box); }
    box.innerHTML = html;
  }
  function setBtnLoading(btn, text){ if(!btn) return () => {}; const old=btn.innerHTML; btn.disabled=true; btn.classList.add('is-loading'); btn.innerHTML=text; return ()=>{btn.disabled=false;btn.classList.remove('is-loading');btn.innerHTML=old;}; }

  window.buildProReportHtml = buildReportHtml;
  try{ buildProReportHtml = buildReportHtml; }catch(_){ }
  window.printWeeklyReport = async function(btn=document.activeElement){ const done=setBtnLoading(btn,'PDF készül...'); try{ const r=await makeReport('heti építési napló',7); await saveDoc({title:r.title,type:'weekly_pdf_print',html:r.html,text:r.title,meta:{range:'last_7_days'}}); await openPrint(r.html); await refreshDocBox(); setReportCenterResult('<b>Heti PDF / nyomtatás elkészült.</b>'); }catch(e){ if(e.message) console.warn(e); } finally{done();} };
  window.downloadWeeklyReportHtml = async function(btn=document.activeElement){ const done=setBtnLoading(btn,'HTML készül...'); try{ const r=await makeReport('heti építési napló',7); await saveDoc({title:r.title,type:'weekly_html',html:r.html,text:r.title,meta:{range:'last_7_days'}}); downloadHtml(`${safeName(projectTitle())}-heti-riport.html`, r.html); await refreshDocBox(); setReportCenterResult('<b>Heti HTML elkészült és mentve lett.</b>'); }catch(e){ if(e.message) console.warn(e); } finally{done();} };
  window.printClosingDocument = async function(btn=document.activeElement){ const done=setBtnLoading(btn,'PDF készül...'); try{ const r=await makeReport('lezáró építési napló',0); await saveDoc({title:r.title,type:'closing_pdf_print',html:r.html,text:r.title,meta:{all:true}}); await openPrint(r.html); await refreshDocBox(); setReportCenterResult('<b>Lezáró PDF / nyomtatás elkészült.</b>'); }catch(e){ if(e.message) console.warn(e); } finally{done();} };
  window.downloadClosingReportHtml = async function(btn=document.activeElement){ const done=setBtnLoading(btn,'HTML készül...'); try{ const r=await makeReport('lezáró építési napló',0); await saveDoc({title:r.title,type:'closing_html',html:r.html,text:r.title,meta:{all:true}}); downloadHtml(`${safeName(projectTitle())}-lezaro-riport.html`, r.html); await refreshDocBox(); setReportCenterResult('<b>Lezáró HTML elkészült és mentve lett.</b>'); }catch(e){ if(e.message) console.warn(e); } finally{done();} };
  window.exportClosingPdfV25 = window.printClosingDocument;
  window.v71DownloadApprovedHtml = async function(){ const r=await makeReport('saját ügyfélpéldány',0); await saveDoc({title:r.title,type:'own_html',html:r.html,text:r.title,meta:{own:true}}); downloadHtml(`${safeName(projectTitle())}-sajat-peldany.html`, r.html); await refreshDocBox(); };
  window.v71PrintApprovedReport = async function(){ const r=await makeReport('saját ügyfélpéldány',0); await saveDoc({title:r.title,type:'own_pdf_print',html:r.html,text:r.title,meta:{own:true}}); await openPrint(r.html); await refreshDocBox(); };
  window.createProjectClientLinkV25 = async function(btn=document.activeElement){
    const done=setBtnLoading(btn,'Ügyfél link készül...');
    try{
      const r = await makeReport('ügyfélriport',0);
      const text = new DOMParser().parseFromString(r.html,'text/html').body.innerText || r.title;
      const saved = await api().createPublicReport({ projectId:projectId(), projectName:projectTitle(), reportHtml:r.html, reportText:text });
      const link = api().createClientShareUrl ? api().createClientShareUrl(saved.token) : `${location.origin}/view.html?riport=${encodeURIComponent(saved.token)}`;
      try{ await navigator.clipboard.writeText(link); }catch(_){ }
      setReportCenterResult(`<b>Ügyfél link elkészült.</b><p>A link kimásolva. A riportban a fotók kisképként benne vannak.</p><p><a class="btn primary" target="_blank" rel="noopener" href="${esc(link)}">Ügyfélriport megnyitása</a></p><p class="muted" style="word-break:break-all">${esc(link)}</p>`);
      await refreshDocBox();
    }catch(e){ alert('Ügyfél link létrehozási hiba: '+(e.message||e)); }
    finally{ done(); }
  };

  document.addEventListener('click', function(e){
    const b = e.target.closest('[data-stable-open],[data-stable-pdf],[data-stable-del]');
    if(b){ e.preventDefault(); e.stopPropagation(); if(b.dataset.stableOpen) return window.stableOpenSavedReport(b.dataset.stableOpen); if(b.dataset.stablePdf) return window.stablePrintSavedReport(b.dataset.stablePdf); if(b.dataset.stableDel) return window.stableDeleteSavedReport(b.dataset.stableDel); }
    const a = e.target.closest('a');
    if(a && /riport/i.test(a.textContent||'') && /view\.html(?!\?)/i.test(a.getAttribute('href')||'')){
      e.preventDefault(); e.stopPropagation(); if(typeof openReportCenterV69 === 'function') openReportCenterV69();
    }
  }, true);
  document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(refreshDocBox,800); setTimeout(refreshDocBox,2500); });
})();
