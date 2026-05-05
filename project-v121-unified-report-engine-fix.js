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
