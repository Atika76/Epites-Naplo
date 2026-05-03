/* V119 STABIL JAVÍTÁS – riport képek, saját HTML/PDF, ügyfél link, automatikus frissítés.
   Nem nyúl a loginhoz és nem igényel új Supabase SQL-t. */
(function(){
  'use strict';
  if(window.__epitesNaploV119StableReportFix) return;
  window.__epitesNaploV119StableReportFix = true;

  const api = () => window.EpitesNaploAPI || {};
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = v => String(v || 'epitesi-naplo-riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'epitesi-naplo-riport';
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || $('projectTitle')?.textContent?.trim() || 'Építési napló projekt';
  const toast = (msg,type='ok') => { try{ if(typeof showToast === 'function') showToast(msg,type); else console.log(msg); }catch(_){ console.log(msg); } };

  function isImageSrc(s){
    s = String(s || '').trim();
    if(!s) return false;
    if(/^(javascript:|blob:|function\s*\(|\(function|window\.|document\.|const\s+|let\s+|var\s+)/i.test(s)) return false;
    return /^data:image\//i.test(s) || /^https?:\/\//i.test(s) || /^\.\//.test(s) || /^\//.test(s) || /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(s);
  }
  function collectImages(value, out){
    if(!value) return;
    if(Array.isArray(value)){ value.forEach(v => collectImages(v,out)); return; }
    if(typeof value === 'object'){
      const o=value;
      ['url','src','href','path','image','image_url','storage_path','file_path','publicUrl','public_url','signedUrl','signed_url','dataUrl','data_url','full_path'].forEach(k=>collectImages(o[k],out));
      ['images','imageUrls','image_urls','photos','files','media','beforeImages','afterImages','generalImages','before_images_json','after_images_json','general_images_json','ai_json','analysis','supplements'].forEach(k=>collectImages(o[k],out));
      return;
    }
    const s = String(value || '').trim();
    if(isImageSrc(s)) out.push(s);
  }
  function uniq(arr){ return [...new Set((arr||[]).map(x=>String(x||'').trim()).filter(Boolean))]; }
  function imagesOf(entry){ const out=[]; collectImages(entry,out); return uniq(out).filter(x=>!/\.(mp4|mov|webm|avi)(\?|#|$)/i.test(x)); }
  function videosOf(entry){
    const out=[];
    const collect = v => { if(!v)return; if(Array.isArray(v)) return v.forEach(collect); if(typeof v==='object'){ ['url','src','path','video','video_url','storage_path','publicUrl','signedUrl'].forEach(k=>collect(v[k])); ['videos','videoUrls','video_urls','media','supplements'].forEach(k=>collect(v[k])); return; } const s=String(v||'').trim(); if(/^https?:\/\//i.test(s)||/\.(mp4|mov|webm)(\?|#|$)/i.test(s)) out.push(s); };
    collect(entry?.video_urls); collect(entry?.videos); collect(entry?.videoUrls); collect(entry?.ai_json); collect(entry?.analysis);
    return uniq(out);
  }
  function fmtDate(v){ try{ return v ? new Date(v).toLocaleString('hu-HU') : new Date().toLocaleString('hu-HU'); }catch(_){ return String(v||''); } }
  function money(v){ return (Number(v||0)||0).toLocaleString('hu-HU') + ' Ft'; }
  function matLine(m){ return `${esc(m?.name || m?.megnevezes || 'Anyag')}${m?.quantity || m?.mennyiseg ? ': ' + esc(m.quantity || m.mennyiseg) : ''}${m?.unit || m?.egyseg ? ' ' + esc(m.unit || m.egyseg) : ''}`; }
  function textOfHtml(html){ try{ return new DOMParser().parseFromString(String(html||''),'text/html').body.innerText || ''; }catch(_){ return String(html||'').replace(/<[^>]+>/g,' '); } }

  function reportCssAndGallery(){ return `<style>
    *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:24px;line-height:1.48}.doc{max-width:1080px;margin:auto}.badge{display:inline-block;background:#fff2bf;color:#8a5a00;border-radius:999px;padding:7px 13px;font-weight:800}.cover{border-bottom:4px solid #f5a400;padding-bottom:16px;margin-bottom:20px}h1{font-size:34px;line-height:1.1;margin:18px 0 8px}h2{font-size:25px;margin:24px 0 12px}h3{font-size:18px;margin:18px 0 8px}.muted{color:#64748b}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:18px 0}.stat{background:#f3f4f6;border-radius:12px;padding:14px}.stat b{display:block;color:#d97706;font-size:24px}.entry{break-inside:avoid;page-break-inside:avoid;border-left:4px solid #f5a400;background:#fafafa;border-radius:12px;margin:22px 0;padding:18px 22px}.aiBox{break-inside:avoid;border-left:5px solid #22c55e;background:#ecfdf5;border-radius:12px;padding:15px 18px;margin:16px 0}.photos{display:grid!important;grid-template-columns:repeat(auto-fill,112px)!important;gap:10px!important;align-items:start!important;justify-content:start!important;margin:12px 0!important}.v119Photo{width:112px!important;max-width:112px!important;min-height:132px!important;border:1px solid #d1d5db!important;border-radius:12px!important;background:#fff!important;padding:5px!important;margin:0!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}.v119Photo img{display:block!important;width:100px!important;height:100px!important;max-width:100px!important;max-height:100px!important;object-fit:cover!important;border-radius:9px!important;cursor:zoom-in!important;background:#f8fafc!important}.v119Photo figcaption{font-size:11px!important;color:#64748b!important;line-height:1.2!important;margin-top:4px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}table{width:100%;border-collapse:collapse;margin:8px 0}td,th{text-align:left;border-bottom:1px solid #e5e7eb;padding:8px}.v119Lightbox{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.94);display:flex;align-items:center;justify-content:center;padding:70px 62px 30px}.v119Lightbox img{max-width:96vw!important;max-height:86vh!important;width:auto!important;height:auto!important;object-fit:contain!important;border-radius:14px!important;background:#000}.v119Lightbox button{position:fixed;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:900;cursor:pointer}.v119Close{top:14px;right:14px;padding:10px 14px}.v119Prev,.v119Next{top:50%;transform:translateY(-50%);width:46px;height:70px;font-size:34px}.v119Prev{left:12px}.v119Next{right:12px}@media(max-width:760px){body{padding:14px}.stats{grid-template-columns:repeat(2,1fr)}h1{font-size:28px}.photos{grid-template-columns:repeat(3,92px)!important}.v119Photo{width:92px!important;min-height:112px!important}.v119Photo img{width:80px!important;height:80px!important}.v119Lightbox{padding:62px 8px 20px}.v119Prev,.v119Next{width:38px;height:56px;font-size:28px}}@media print{@page{size:A4;margin:12mm}body{padding:0}.doc{max-width:none}.photos{grid-template-columns:repeat(4,30mm)!important;gap:5mm!important}.v119Photo{width:30mm!important;min-height:34mm!important;padding:1mm!important}.v119Photo img{width:28mm!important;height:28mm!important}.v119Lightbox{display:none!important}}
    </style><script>(function(){function imgs(){return Array.from(document.querySelectorAll('.photos img,.v119Photo img')).filter(function(i){return i.src&&!i.closest('.v119Lightbox')})}function close(){document.querySelectorAll('.v119Lightbox').forEach(function(x){x.remove()})}function openAt(i){var list=imgs();if(!list.length)return;var idx=Math.max(0,Math.min(i,list.length-1));close();var box=document.createElement('div');box.className='v119Lightbox';function render(){box.innerHTML='<button class="v119Close" type="button">Bezárás ×</button>'+(list.length>1?'<button class="v119Prev" type="button">‹</button><button class="v119Next" type="button">›</button>':'')+'<img alt="Nagyított napló kép">';box.querySelector('img').src=list[idx].src;box.querySelector('.v119Close').onclick=function(e){e.preventDefault();e.stopPropagation();close()};var p=box.querySelector('.v119Prev'),n=box.querySelector('.v119Next');if(p)p.onclick=function(e){e.preventDefault();e.stopPropagation();idx=(idx-1+list.length)%list.length;render()};if(n)n.onclick=function(e){e.preventDefault();e.stopPropagation();idx=(idx+1)%list.length;render()};}render();box.onclick=function(e){if(e.target===box)close()};document.body.appendChild(box)}document.addEventListener('click',function(e){var img=e.target.closest&&e.target.closest('.photos img,.v119Photo img');if(!img||img.closest('.v119Lightbox'))return;e.preventDefault();e.stopPropagation();openAt(imgs().indexOf(img))},true);document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});})();<\/script>`; }

  function photoGrid(imgs){
    imgs = uniq(imgs).filter(isImageSrc);
    if(!imgs.length) return '<p class="muted">Ehhez a bejegyzéshez nincs csatolt fotó.</p>';
    return `<div class="photos">${imgs.map((src,i)=>`<figure class="v119Photo"><img src="${esc(src)}" data-full-src="${esc(src)}" alt="Napló fotó ${i+1}" loading="lazy" decoding="async"><figcaption>Nagyítás</figcaption></figure>`).join('')}</div>`;
  }

  async function getAllData(){
    const pid = projectId();
    let data = { entries: Array.isArray(state()?.entries) ? state().entries : [], materials: [], invoices: [] };
    try{ const d = await api().getProjectCloseData?.(pid); if(d) data = {...data, ...d}; }catch(e){ console.warn('Projekt záróadat lekérés hiba:', e); }
    data.entries = Array.isArray(data.entries) ? data.entries : [];
    // Ha a DB-ből kevés kép jött vissza, a DOM-ban látható idővonal képeket is belefűzzük.
    let media = [];
    try{ media = await api().getProjectMediaForReport?.(pid) || []; }catch(e){ console.warn('Projekt média lekérés hiba:', e); }
    const domImgs = Array.from(document.querySelectorAll('#entriesTimeline img, .timeline img, .entryCard img, .photoGrid img, .mediaGrid img')).map(i=>i.currentSrc || i.src || i.getAttribute('data-src') || i.getAttribute('data-full-src')).filter(isImageSrc);
    const extra = uniq([...media, ...domImgs]);
    const currentCount = data.entries.reduce((s,e)=>s+imagesOf(e).length,0);
    if(extra.length && currentCount < extra.length){
      if(!data.entries.length){ data.entries.push({ phase:'Fotódokumentáció', note:'A projekthez rögzített fotódokumentáció.', created_at:new Date().toISOString(), images:extra, image_urls:extra }); }
      else { const first = data.entries[0]; data.entries[0] = {...first, images:uniq([...imagesOf(first), ...extra]), image_urls:uniq([...imagesOf(first), ...extra])}; }
    }
    return data;
  }

  function buildReportHtml(entries, title, data={}){
    entries = Array.isArray(entries) ? entries : [];
    const materials = Array.isArray(data.materials) ? data.materials : [];
    const invoices = Array.isArray(data.invoices) ? data.invoices : [];
    const photoCount = entries.reduce((s,e)=>s+imagesOf(e).length,0);
    const videoCount = entries.reduce((s,e)=>s+videosOf(e).length,0);
    const invoiceSum = invoices.reduce((s,x)=>s+(Number(x.amount||x.gross_amount||x.total||0)||0),0);
    const materialHtml = materials.length ? materials.map(m=>`<li><b>${matLine(m)}</b></li>`).join('') : '<li>Nincs rögzített anyag.</li>';
    const invoiceHtml = invoices.length ? invoices.map(i=>`<tr><td>${esc(i.title||i.name||i.description||'Számla')}</td><td>${money(i.amount||i.gross_amount||i.total)}</td><td>${esc(i.note||'')}</td></tr>`).join('') : '<tr><td colspan="3">Nincs csatolt számla.</td></tr>';
    const rows = entries.map(e=>{
      const imgs = imagesOf(e); const vids = videosOf(e);
      const mats = Array.isArray(e.materials_json) ? e.materials_json : (Array.isArray(e.materials) ? e.materials : []);
      const weather = e.weather || e.weather_text || e.weather_json?.summary || e.weather_json?.text || '';
      const gps = e.location_address || e.locationAddress || e.gps_json?.address || e.gps || '';
      const ai = e.ai_report || e.ai_summary || e.ai_json?.photoTextCheck || e.ai_json?.summary || e.analysis?.summary || '';
      const note = e.note || e.description || e.text || '';
      return `<section class="entry"><h2>${esc(fmtDate(e.created_at))} – ${esc(e.phase||'Napi bejegyzés')}</h2>${note?`<p>${esc(note).replace(/\n/g,'<br>')}</p>`:''}<p><b>Dokumentáció:</b> ${imgs.length} fotó, ${vids.length} videó.</p>${mats.length?`<p><b>Napi anyag:</b> ${mats.map(matLine).join(', ')}</p>`:''}${weather?`<p><b>Időjárás:</b> ${esc(weather)}</p>`:''}${gps?`<p><b>GPS/helyadat:</b> ${esc(gps)}</p>`:''}${ai?`<div class="aiBox"><b>AI szakmai kontroll:</b><br>${esc(ai).replace(/\n/g,'<br>')}</div>`:''}<h3>Munka közben / fotódokumentáció</h3><p>Kattints bármelyik fotóra a nagyításhoz.</p>${photoGrid(imgs)}</section>`;
    }).join('') || '<p>Nincs napi bejegyzés ehhez a projekthez.</p>';
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="icon" href="https://epitesi-naplo.eu/favicon.png">${reportCssAndGallery()}</head><body><div class="doc"><div class="cover"><span class="badge">Átadásra kész dokumentáció</span><h1>${esc(title)}</h1><p class="muted">Generálva: ${new Date().toLocaleString('hu-HU')} • ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>${entries.length}</b>bejegyzés</div><div class="stat"><b>${photoCount}</b>fotó</div><div class="stat"><b>${videoCount}</b>videó</div><div class="stat"><b>0</b>magas kockázat</div><div class="stat"><b>${money(invoiceSum)}</b>számlák</div></div></div><h2>Rövid összegzés</h2><p>A dokumentum az ügyfélnek átadható, rendezett építési napló: napi munka, fotódokumentáció, anyagok, időjárás/GPS és nyitott ellenőrzések egy helyen.</p><h2>Anyagösszesítő</h2><ul>${materialHtml}</ul><h2>Számlák</h2><table><thead><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr></thead><tbody>${invoiceHtml}</tbody></table><h2>Vezetői AI összefoglaló</h2><div class="aiBox">Állapot: rendezett dokumentáció. Bejegyzések: ${entries.length}, fotók: ${photoCount}, videók: ${videoCount}. A napi bejegyzések és fotók alapján az ügyfél számára átadható dokumentáció készült.</div><h2>Napi bejegyzések</h2>${rows}</div></body></html>`;
  }
  window.buildProReportHtml = buildReportHtml; try{ buildProReportHtml = buildReportHtml; }catch(_){ }

  function downloadHtml(filename, html){ const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},1200); }
  function openPrint(html){ const w=window.open('', '_blank'); if(!w){ alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakokat.'); return; } w.document.open(); w.document.write(html); w.document.close(); setTimeout(()=>{ try{ w.focus(); w.print(); }catch(_){ } }, 800); }
  async function currentReport(label='ügyfélriport', weekly=false){ const data=await getAllData(); let entries=data.entries||[]; if(weekly){ const d=new Date(); d.setDate(d.getDate()-7); entries=entries.filter(e=>!e.created_at || new Date(e.created_at)>=d); } return buildReportHtml(entries, `${projectTitle()} – ${label}`, {...data, entries}); }

  async function saveOwnDocument(type, title, html, approvalId=null){
    try{ await api().saveReportDocument?.({ projectId:projectId(), approvalId, title, type, html, text:textOfHtml(html), meta:{v119:true, images:(html.match(/<img\b/gi)||[]).length} }); }catch(e){ console.warn('Saját riport mentés figyelmeztetés:', e); }
    setTimeout(refreshReportPanels, 300);
  }
  function ensureSavedDocsBox(){
    let box = document.getElementById('v119SavedReportsBox');
    if(box) return box;
    box = document.createElement('section');
    box.id = 'v119SavedReportsBox';
    box.className = 'card v119SavedReportsBox';
    const projectSummary = [...document.querySelectorAll('.card, section, div')].find(el => /Projekt összefoglaló/i.test(el.textContent||''));
    const oldBox = [...document.querySelectorAll('.card, .notice, section')].find(el => /Mentett riport példányok/i.test(el.textContent||''));
    (oldBox || projectSummary || document.querySelector('main') || document.body).insertAdjacentElement(oldBox ? 'beforebegin' : 'afterend', box);
    return box;
  }
  async function renderSavedDocs(){
    const box = ensureSavedDocsBox();
    if(!box || !projectId()) return;
    box.innerHTML = '<b>Mentett riport példányok</b><p class="muted">Betöltés...</p>';
    let docs=[]; try{ docs = await api().listReportDocuments?.(projectId()) || []; }catch(e){ console.warn(e); }
    // A régi, több verziós mentett riport blokkokat elrejtjük, hogy ne legyen dupla lista.
    [...document.querySelectorAll('.card, .notice, section')].forEach(el => {
      if(el.id !== 'v119SavedReportsBox' && /Mentett riport példányok/i.test(el.textContent||'')) el.style.display = 'none';
    });
    if(!docs.length){ box.innerHTML = '<b>Mentett riport példányok</b><p class="muted">Még nincs külön mentett saját példány.</p>'; return; }
    box.innerHTML = '<b>Mentett riport példányok</b>' + docs.slice(0,10).map(d => `<div class="v71ApprovalRow"><div><span class="tag info">${esc(d.document_type||d.type||'riport')}</span><br><small>${esc(fmtDate(d.created_at||''))}</small><p>${esc(d.title||'Építési napló riport')}</p></div><div class="v71ApprovalActions"><button class="btn small primary" type="button" data-v109-copy="${esc(d.id)}">HTML mentés</button><button class="btn small ghost" type="button" data-v109-pdf="${esc(d.id)}">PDF / nyomtatás</button><button class="btn small danger" type="button" data-v119-del-doc="${esc(d.id)}">Törlés</button></div></div>`).join('');
  }
  async function deleteSavedDoc(id){
    if(!id || !confirm('Biztosan törlöd ezt a mentett riport példányt?')) return;
    try{ await api().deleteReportDocument?.(id); toast('Mentett riport törölve.', 'ok'); renderSavedDocs(); }catch(e){ alert('Riport törlési hiba: '+(e.message||e)); }
  }
  function refreshReportPanels(){
    try{ renderSavedDocs(); }catch(_){ }
    try{ window.v77RenderSavedReports?.(); }catch(_){ }
    try{ window.v75RenderSavedReports?.(); }catch(_){ }
    try{ window.v109RenderClientFeedback?.(); }catch(_){ }
    document.dispatchEvent(new CustomEvent('epitesnaplo:reports-updated'));
  }
  function setBusy(btn, text){ if(!btn || btn.__busy) return ()=>{}; const old=btn.innerText; btn.__busy=true; btn.disabled=true; btn.innerText=text; return ()=>{btn.__busy=false;btn.disabled=false;btn.innerText=old;}; }
  function activeBtn(){ return document.activeElement?.tagName === 'BUTTON' ? document.activeElement : null; }

  window.downloadWeeklyReportHtml = async function(){ const done=setBusy(activeBtn(),'Heti HTML készül...'); try{ const html=await currentReport('heti építési napló', true); await saveOwnDocument('weekly_html_v119', `${projectTitle()} – heti riport`, html); downloadHtml(`${slug(projectTitle())}-heti-riport.html`, html); toast('Heti riport HTML elkészült.', 'ok'); }catch(e){ alert('Heti HTML hiba: '+(e.message||e)); } finally{ done(); } };
  window.printWeeklyReport = async function(){ const done=setBusy(activeBtn(),'Heti PDF készül...'); try{ const html=await currentReport('heti építési napló', true); await saveOwnDocument('weekly_pdf_v119', `${projectTitle()} – heti PDF`, html); openPrint(html); toast('Heti PDF / nyomtatási nézet megnyitva.', 'ok'); }catch(e){ alert('Heti PDF hiba: '+(e.message||e)); } finally{ done(); } };
  window.downloadClosingReportHtml = async function(){ const done=setBusy(activeBtn(),'Lezáró HTML készül...'); try{ const html=await currentReport('lezáró építési napló', false); await saveOwnDocument('closing_html_v119', `${projectTitle()} – lezáró HTML`, html); downloadHtml(`${slug(projectTitle())}-lezaro-riport.html`, html); toast('Lezáró HTML elkészült.', 'ok'); }catch(e){ alert('Lezáró HTML hiba: '+(e.message||e)); } finally{ done(); } };
  window.printClosingDocument = async function(){ const done=setBusy(activeBtn(),'Lezáró PDF készül...'); try{ const html=await currentReport('lezáró építési napló', false); await saveOwnDocument('closing_pdf_v119', `${projectTitle()} – lezáró PDF`, html); openPrint(html); toast('Lezáró PDF / nyomtatási nézet megnyitva.', 'ok'); }catch(e){ alert('Lezáró PDF hiba: '+(e.message||e)); } finally{ done(); } };
  window.exportClosingPdfV25 = window.printClosingDocument;

  window.createProjectClientLinkV25 = async function(){ const done=setBusy(activeBtn(),'Ügyfél link készül...'); try{ if(!projectId()) throw new Error('Nincs projekt.'); const html=await currentReport('ügyfélriport', false); const saved=await api().createPublicReport({ projectId:projectId(), projectName:projectTitle(), reportHtml:html, reportText:textOfHtml(html) }); const link=api().createClientShareUrl(saved.token); try{ await navigator.clipboard.writeText(link); }catch(_){ }
      await saveOwnDocument('client_public_link_v119', `${projectTitle()} – ügyfélriport saját példány`, html);
      if(typeof showProjectHelp === 'function') showProjectHelp('Ügyfél link elkészült', `<div class="featureHelpBox"><b>Biztonságos ügyfél link</b><p>A link kimásolva. A riportban a fotók kisképként benne vannak, kattintásra nagyíthatók.</p><p><a class="btn primary" target="_blank" href="${esc(link)}">Ügyfélriport megnyitása</a></p><p class="muted">${esc(link)}</p></div>`); else alert('Ügyfél link elkészült: '+link);
      refreshReportPanels();
    }catch(e){ console.error(e); alert('Ügyfél link létrehozási hiba: '+(e.message||e)); } finally{ done(); } };

  window.v71DownloadApprovedHtml = async function(id){ const done=setBusy(activeBtn(),'HTML készül...'); try{ let html=''; let title=`${projectTitle()} – saját ügyfélpéldány`; if(id){ try{ const row=await api().getApprovedReportHtml?.(id); html = row?.approved_report_html || row?.html_content || ''; title = row?.title || title; }catch(_){ } } if(!html || (html.match(/<img\b/gi)||[]).length === 0) html = await currentReport('saját ügyfélpéldány', false); await saveOwnDocument('own_html_v119', title, html, id||null); downloadHtml(`${slug(title)}.html`, html); toast('Saját HTML példány elkészült.', 'ok'); }catch(e){ alert('HTML riport hiba: '+(e.message||e)); } finally{ done(); } };
  window.v71PrintApprovedReport = async function(id){ const done=setBusy(activeBtn(),'PDF készül...'); try{ let html=''; let title=`${projectTitle()} – saját PDF`; if(id){ try{ const row=await api().getApprovedReportHtml?.(id); html = row?.approved_report_html || row?.html_content || ''; title = row?.title || title; }catch(_){ } } if(!html || (html.match(/<img\b/gi)||[]).length === 0) html = await currentReport('saját ügyfélpéldány', false); await saveOwnDocument('own_pdf_v119', title, html, id||null); openPrint(html); toast('PDF / nyomtatási nézet megnyitva.', 'ok'); }catch(e){ alert('PDF/nyomtatási hiba: '+(e.message||e)); } finally{ done(); } };

  // Ha a riport központban kattintasz, ne zárja be a modalt, csak dolgozzon.
  document.addEventListener('click', function(e){
    const btn = e.target.closest && e.target.closest('[data-v109-copy],[data-v109-pdf],[data-v75-open],[data-v75-pdf],[data-v77-open],[data-v77-pdf],[data-v77-down],[data-v119-del-doc]');
    if(!btn) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if(btn.dataset.v119DelDoc) return deleteSavedDoc(btn.dataset.v119DelDoc);
    const id = btn.dataset.v109Copy || btn.dataset.v109Pdf || btn.dataset.v75Open || btn.dataset.v75Pdf || btn.dataset.v77Open || btn.dataset.v77Pdf || btn.dataset.v77Down || '';
    if(btn.dataset.v109Pdf || btn.dataset.v75Pdf || btn.dataset.v77Pdf) return window.v71PrintApprovedReport(id);
    return window.v71DownloadApprovedHtml(id);
  }, true);

  // Ügyfél visszajelzések blokk automatikus frissítése.
  function decisionOf(row){ return String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase(); }
  function msgOf(row){ return String(row?.client_comment || row?.message || row?.client_message || row?.question || row?.note || '').trim(); }
  function label(d){ return (d==='accepted'||d==='approved')?'Elfogadva / jóváhagyva':d==='question'?'Kérdése van':'Megtekintve'; }
  function ensureFeedbackBox(){
    let box = document.getElementById('v109ClientFeedbackBox'); if(box) return box;
    box=document.createElement('section'); box.id='v109ClientFeedbackBox'; box.className='card v109FeedbackBox';
    const ref=[...document.querySelectorAll('.card')].find(el=>/Mentett riport|riport példány/i.test(el.textContent||''));
    (ref||document.querySelector('main')||document.body).insertAdjacentElement(ref?'afterend':'afterbegin', box);
    return box;
  }
  async function renderFeedback(){
    const box=ensureFeedbackBox(); if(!box || !projectId()) return;
    box.innerHTML='<h3>Ügyfél visszajelzések és kérdések</h3><p class="muted">Betöltés...</p>';
    let rows=[]; try{ rows=await api().getReportApprovals?.(projectId()) || []; }catch(e){ console.warn(e); }
    if(!rows.length){ box.innerHTML='<h3>Ügyfél visszajelzések és kérdések</h3><p class="muted">Még nincs ügyfél visszajelzés ehhez a projekthez.</p>'; return; }
    box.innerHTML='<h3>Ügyfél visszajelzések és kérdések</h3>'+rows.slice(0,10).map(r=>{ const d=decisionOf(r), m=msgOf(r), id=esc(r.id||''); return `<div class="v71ApprovalRow"><div><span class="tag ${d==='question'?'warn':'success'}">${esc(label(d))}</span><br><small>${esc(fmtDate(r.approved_at||r.created_at))}</small>${m?`<p><b>Kérdés / megjegyzés:</b><br>${esc(m).replace(/\n/g,'<br>')}</p>`:'<p class="muted">Nincs megjegyzés.</p>'}</div><div class="v71ApprovalActions"><button class="btn small primary" type="button" data-v109-copy="${id}">Saját példány HTML</button><button class="btn small ghost" type="button" data-v109-pdf="${id}">PDF / nyomtatás</button></div></div>`; }).join('');
  }
  window.v109RenderClientFeedback = renderFeedback;
  document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(renderFeedback,700); setTimeout(renderFeedback,2200); setTimeout(renderSavedDocs,900); setTimeout(renderSavedDocs,2400); });
  setTimeout(renderFeedback,1200);
  setTimeout(renderSavedDocs,1400);
})();
