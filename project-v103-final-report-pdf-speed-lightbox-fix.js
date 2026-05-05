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
