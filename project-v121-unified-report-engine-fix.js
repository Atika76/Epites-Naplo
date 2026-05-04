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
    body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:24px;line-height:1.45}.doc{max-width:1050px;margin:auto}.pill{display:inline-block;background:#fff2bf;color:#8a5a00;border-radius:999px;padding:7px 13px;font-weight:700}.cover{border-bottom:4px solid #f5a400;margin-bottom:20px;padding-bottom:16px}.muted{color:#64748b}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0}.stat{background:#f3f4f6;border-radius:10px;padding:12px}.stat b{display:block;color:#d97706;font-size:22px}.entry{border-left:4px solid #f5a400;background:#fafafa;margin:18px 0;padding:16px 18px;border-radius:12px;break-inside:avoid}.aiBox{background:#ecfdf5;border-left:5px solid #22c55e;border-radius:12px;padding:14px 16px;margin:12px 0}.photos,.v121Photos{display:grid!important;grid-template-columns:repeat(auto-fill,112px)!important;gap:10px!important;align-items:start!important;margin:12px 0!important}.v121Photo{width:112px!important;min-height:132px!important;border:1px solid #d1d5db!important;border-radius:12px!important;background:#fff!important;padding:5px!important;margin:0!important;box-sizing:border-box!important;overflow:hidden!important;break-inside:avoid!important}.v121Photo img{display:block!important;width:100px!important;height:100px!important;object-fit:cover!important;border-radius:9px!important;cursor:zoom-in!important;background:#f8fafc!important}.v121Photo figcaption{font-size:11px;color:#64748b;margin-top:4px}.v121Lightbox{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.94);display:flex;align-items:center;justify-content:center;padding:70px 58px 30px}.v121Lightbox img{max-width:96vw!important;max-height:86vh!important;width:auto!important;height:auto!important;object-fit:contain!important;border-radius:14px!important;background:#000}.v121Lightbox button{position:fixed;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:900;cursor:pointer}.v121Close{top:14px;right:14px;padding:10px 14px}.v121Prev,.v121Next{top:50%;transform:translateY(-50%);width:46px;height:70px;font-size:34px}.v121Prev{left:12px}.v121Next{right:12px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e5e7eb;text-align:left;padding:8px}@media(max-width:760px){body{padding:14px}.stats{grid-template-columns:repeat(2,1fr)}.photos,.v121Photos{grid-template-columns:repeat(3,92px)!important}.v121Photo{width:92px!important;min-height:112px!important}.v121Photo img{width:80px!important;height:80px!important}.v121Lightbox{padding:62px 8px 20px}.v121Prev,.v121Next{width:38px;height:56px;font-size:28px}}@media print{.v121Lightbox{display:none!important}.photos,.v121Photos{grid-template-columns:repeat(4,30mm)!important}.v121Photo{width:30mm!important;min-height:34mm!important}.v121Photo img{width:28mm!important;height:28mm!important}}
    </style><script>(function(){var idx=0;function imgs(){return Array.from(document.querySelectorAll('.v121Photos img,.photos img')).filter(function(i){return i.src&&!i.closest('.v121Lightbox')})}function close(){document.querySelectorAll('.v121Lightbox').forEach(function(x){x.remove()})}function openAt(i){var list=imgs();if(!list.length)return;idx=(i+list.length)%list.length;close();var box=document.createElement('div');box.className='v121Lightbox';function draw(){box.innerHTML='<button class="v121Close" type="button">Bezárás ×</button>'+(list.length>1?'<button class="v121Prev" type="button">‹</button><button class="v121Next" type="button">›</button>':'')+'<img alt="Nagyított napló kép">';box.querySelector('img').src=list[idx].src;box.querySelector('.v121Close').onclick=function(e){e.preventDefault();e.stopPropagation();close()};var p=box.querySelector('.v121Prev'),n=box.querySelector('.v121Next');if(p)p.onclick=function(e){e.preventDefault();e.stopPropagation();idx=(idx-1+list.length)%list.length;draw()};if(n)n.onclick=function(e){e.preventDefault();e.stopPropagation();idx=(idx+1)%list.length;draw()};}draw();box.onclick=function(e){if(e.target===box)close()};document.body.appendChild(box)}document.addEventListener('click',function(e){var img=e.target.closest&&e.target.closest('.v121Photos img,.photos img');if(!img||img.closest('.v121Lightbox'))return;e.preventDefault();e.stopPropagation();openAt(imgs().indexOf(img))},true);document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});})();<\/script>`; }

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
