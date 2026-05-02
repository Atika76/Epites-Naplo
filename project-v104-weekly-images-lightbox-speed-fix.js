// ===== V104 FINAL: heti PDF képek + képnéző lapozó + gyorsítás =====
(function(){
  if(window.__epitesNaploV104WeeklyImagesLightboxSpeedFix) return;
  window.__epitesNaploV104WeeklyImagesLightboxSpeedFix = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeName = v => String(v || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  const state = () => window.detailState || {};
  const pid = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || 'local';
  const ptitle = () => state()?.project?.name || 'Építési napló';
  const toast = (msg,type='ok') => { try{ if(typeof window.showToast === 'function') window.showToast(msg,type); else console.log(msg); }catch(_){} };

  const pageCss = document.createElement('style');
  pageCss.textContent = `
    .v104-loading{opacity:.85!important;cursor:wait!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important}
    .v104-spinner{width:15px;height:15px;border:2px solid currentColor;border-right-color:transparent;border-radius:999px;display:inline-block;animation:v104spin .75s linear infinite}@keyframes v104spin{to{transform:rotate(360deg)}}
    .v104AppLightbox{position:fixed;inset:0;z-index:2147483647;background:rgba(2,6,23,.92);display:flex;align-items:center;justify-content:center;padding:56px 18px 32px}
    .v104AppLightbox img{max-width:min(94vw,1100px);max-height:82vh;object-fit:contain;border-radius:14px;background:#111;box-shadow:0 20px 80px rgba(0,0,0,.5)}
    .v104Close,.v104Prev,.v104Next{position:fixed;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:900;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.3)}
    .v104Close{right:18px;top:16px;padding:10px 14px;font-size:20px}.v104Prev,.v104Next{top:50%;transform:translateY(-50%);width:46px;height:46px;font-size:28px;display:flex;align-items:center;justify-content:center}.v104Prev{left:18px}.v104Next{right:18px}
    .v104Counter{position:fixed;left:50%;top:18px;transform:translateX(-50%);background:rgba(15,23,42,.82);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:999px;padding:7px 12px;font-weight:800;font-size:13px}
    @media(max-width:720px){.v104Prev,.v104Next{width:40px;height:40px;font-size:24px}.v104Prev{left:8px}.v104Next{right:8px}.v104AppLightbox{padding-left:8px;padding-right:8px}.v104AppLightbox img{max-width:88vw;max-height:78vh}}
  `;
  document.head.appendChild(pageCss);

  let lastButton = null;
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button,[role="button"],a.btn,[data-v71-download],[data-v71-print],[data-v79-approval-download],[data-v79-approval-print],[data-v80-approval-download],[data-v80-approval-print]');
    if(b){ lastButton = b; lastButton.__v104ClickTime = Date.now(); }
  }, true);
  function currentBtn(){ return (document.activeElement && document.activeElement.tagName === 'BUTTON') ? document.activeElement : lastButton; }
  function setBusy(btn, text){
    if(!btn) return () => {};
    const oldHtml = btn.innerHTML, oldDisabled = btn.disabled;
    btn.disabled = true; btn.classList.add('is-loading','v104-loading'); btn.setAttribute('aria-busy','true');
    btn.innerHTML = `<span class="v104-spinner" aria-hidden="true"></span>${esc(text || 'Dolgozom…')}`;
    return () => { btn.disabled = oldDisabled; btn.classList.remove('is-loading','v104-loading'); btn.removeAttribute('aria-busy'); btn.innerHTML = oldHtml; };
  }
  function wrap(name,label,fn){ window[name]=async function(...args){ const done=setBusy(currentBtn(),label); try{return await fn.apply(this,args);} finally{done();} }; try{ eval(name + ' = window[name]'); }catch(_){} }

  function imageSrc(img){ return img?.getAttribute?.('data-full-src') || img?.getAttribute?.('data-src') || img?.currentSrc || img?.src || ''; }
  function collectLiveImages(fromEl){
    const scope = fromEl?.closest?.('.timelineEntry,.entry,.v74Entry,.card,.daily-entry,.naplo-card,article,section') || document;
    let imgs = Array.from(scope.querySelectorAll('img')).filter(i => imageSrc(i) && !i.closest('.v104AppLightbox,.v77Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox'));
    if(imgs.length < 2) imgs = Array.from(document.querySelectorAll('img')).filter(i => imageSrc(i) && !i.closest('.v104AppLightbox,.v77Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox') && i.offsetWidth > 35 && i.offsetHeight > 35);
    const seen = new Set();
    return imgs.map(imageSrc).filter(src => { if(!src || seen.has(src)) return false; seen.add(src); return true; });
  }
  function openLiveLightbox(list, index){
    if(!list?.length) return;
    let idx = Math.max(0, Math.min(index || 0, list.length - 1));
    document.querySelectorAll('.v104AppLightbox,.v77Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox').forEach(x=>x.remove());
    const box = document.createElement('div'); box.className = 'v104AppLightbox';
    const render = () => {
      box.innerHTML = `<button class="v104Close" type="button" aria-label="Bezárás">×</button><div class="v104Counter">${idx+1} / ${list.length}</div>${list.length>1?'<button class="v104Prev" type="button" aria-label="Előző kép">‹</button><button class="v104Next" type="button" aria-label="Következő kép">›</button>':''}<img alt="Nagyított napló fotó">`;
      box.querySelector('img').src = list[idx];
      box.querySelector('.v104Close').onclick = () => box.remove();
      const prev = box.querySelector('.v104Prev'), next = box.querySelector('.v104Next');
      if(prev) prev.onclick = ev => { ev.stopPropagation(); idx = (idx - 1 + list.length) % list.length; render(); };
      if(next) next.onclick = ev => { ev.stopPropagation(); idx = (idx + 1) % list.length; render(); };
    };
    box.addEventListener('click', e => { if(e.target === box) box.remove(); });
    document.addEventListener('keydown', function key(e){
      if(!document.body.contains(box)){ document.removeEventListener('keydown', key); return; }
      if(e.key === 'Escape') box.remove();
      if(e.key === 'ArrowLeft'){ idx = (idx - 1 + list.length) % list.length; render(); }
      if(e.key === 'ArrowRight'){ idx = (idx + 1) % list.length; render(); }
    });
    render(); document.body.appendChild(box);
  }

  // Élő oldali képnéző: kép vagy „Nagy nézet” gomb után lapozható nézet nyílik.
  document.addEventListener('click', function(e){
    const oldClose = e.target.closest && e.target.closest('.v104Close,.v77Lightbox button,.v100Lightbox button,.v102Lightbox button,.v103Lightbox button');
    if(oldClose){ e.preventDefault(); e.stopPropagation(); document.querySelectorAll('.v104AppLightbox,.v77Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox').forEach(x=>x.remove()); return; }
    const btn = e.target.closest && e.target.closest('button');
    const txt = (btn?.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const img = e.target.closest && e.target.closest('img');
    if(img && !img.closest('.v104AppLightbox') && img.offsetWidth > 35 && img.offsetHeight > 35){
      const list = collectLiveImages(img); const src = imageSrc(img); const idx = Math.max(0, list.indexOf(src));
      if(list.length){ e.preventDefault(); e.stopImmediatePropagation(); openLiveLightbox(list, idx); }
      return;
    }
    if(btn && (txt.includes('nagy nezet') || txt.includes('nagyit') || txt.includes('megnyit'))){
      const list = collectLiveImages(btn);
      if(list.length){ e.preventDefault(); e.stopImmediatePropagation(); openLiveLightbox(list, 0); }
    }
  }, true);

  function getEntryMedia(e){
    let images=[]; try{ if(typeof window.getEntryImages==='function') images = window.getEntryImages(e) || []; else if(typeof getEntryImages==='function') images = getEntryImages(e) || []; }catch(_){}
    if(!images.length){
      images = []
        .concat(Array.isArray(e?.images) ? e.images : [])
        .concat(Array.isArray(e?.image_urls) ? e.image_urls : [])
        .concat(Array.isArray(e?.photo_urls) ? e.photo_urls : [])
        .concat(Array.isArray(e?.photos) ? e.photos : [])
        .concat(Array.isArray(e?.beforeImages) ? e.beforeImages : [])
        .concat(Array.isArray(e?.afterImages) ? e.afterImages : [])
        .concat(Array.isArray(e?.generalImages) ? e.generalImages : [])
        .concat(e?.image_url ? [e.image_url] : [])
        .concat(e?.photo_url ? [e.photo_url] : [])
        .concat(e?.image ? [e.image] : []);
    }
    images = images.map(x => typeof x === 'string' ? x : (x?.url || x?.src || x?.publicUrl || x?.signedUrl || x?.path || '')).filter(Boolean);
    let videos=[]; try{ if(typeof window.getEntryVideos==='function') videos = window.getEntryVideos(e) || []; else if(typeof getEntryVideos==='function') videos = getEntryVideos(e) || []; }catch(_){}
    return {images:[...new Set(images)], videos:[...new Set(videos.filter(Boolean))]};
  }
  function entryKey(e){ return String(e?.id || e?.entry_id || ((e?.created_at||'')+'|'+(e?.phase||'')+'|'+(e?.note||'').slice(0,40))); }
  function mergeEntries(primary, secondary){
    const map = new Map();
    [...(primary||[]), ...(secondary||[])].forEach(e => {
      if(!e) return;
      const key = entryKey(e);
      const old = map.get(key) || {};
      const oldMedia = getEntryMedia(old), newMedia = getEntryMedia(e);
      const merged = {...old, ...e};
      if(oldMedia.images.length || newMedia.images.length) merged.images = [...new Set([...oldMedia.images, ...newMedia.images])];
      if(oldMedia.videos.length || newMedia.videos.length) merged.videos = [...new Set([...oldMedia.videos, ...newMedia.videos])];
      map.set(key, merged);
    });
    return Array.from(map.values()).sort((a,b)=> new Date(b.created_at||0) - new Date(a.created_at||0));
  }

  function reportCss(){ return `<style id="v104-report-css">
*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{font-family:Arial,Helvetica,sans-serif!important;color:#111827!important;background:#fff!important;margin:0!important;padding:24px!important;line-height:1.48!important}.doc,.reportDoc,.publicReportCard,.report-card,.reportShell,.v74Doc{max-width:1050px!important;margin:0 auto!important;background:#fff!important;color:#111827!important;overflow:visible!important}.cover,.v74Cover{border-bottom:4px solid #f59e0b!important;margin-bottom:18px!important;padding-bottom:14px!important}.stats,.v74Stats{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:10px!important;margin:14px 0!important}.stat,.v74Stat{background:#f8fafc!important;border:1px solid #e5e7eb!important;border-radius:12px!important;padding:12px!important}.stat b,.v74Stat b{display:block!important;color:#d97706!important;font-size:22px!important}.entry,.v74Entry{break-inside:avoid!important;page-break-inside:avoid!important;border:1px solid #e5e7eb!important;border-left:5px solid #f59e0b!important;background:#fafafa!important;border-radius:14px!important;margin:16px 0!important;padding:14px 16px!important}.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhotos,.v68ReportPhotos,.v74Photos,.v77Photos{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(118px,118px))!important;gap:12px!important;align-items:start!important;justify-content:start!important}.reportMediaTile,.v67ReportPhoto,.v74Photo,.v77Photo,.photos figure,figure,.photo{width:118px!important;height:118px!important;max-width:118px!important;background:#fff!important;border:1px solid #d1d5db!important;border-radius:12px!important;padding:5px!important;margin:0!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}.reportMediaTile img,.v67ReportPhoto img,.v74Photo img,.v77Photo img,.photos img,.entryImageGrid img,.reportImageGrid img,figure img,img.reportPhoto{display:block!important;width:106px!important;max-width:106px!important;height:106px!important;max-height:106px!important;object-fit:cover!important;border-radius:8px!important;cursor:zoom-in!important;background:#f8fafc!important}.entryVideoGrid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;gap:12px!important}.entryVideoGrid video,.reportMediaTile video{width:100%!important;max-height:300px!important;border-radius:10px!important;background:#111!important}table{width:100%!important;border-collapse:collapse!important}td,th{border-bottom:1px solid #e5e7eb!important;text-align:left!important;padding:8px!important;white-space:normal!important;overflow-wrap:anywhere!important}.v104ApprovalStamp{border:2px solid #22c55e!important;background:#ecfdf5!important;border-radius:14px!important;padding:14px 16px!important;margin:0 0 18px!important;break-inside:avoid!important;page-break-inside:avoid!important}.v104Lightbox{position:fixed!important;inset:0!important;background:rgba(2,6,23,.92)!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:999999!important;padding:58px 18px 32px!important}.v104Lightbox img{max-width:94vw!important;max-height:82vh!important;width:auto!important;height:auto!important;object-fit:contain!important;border-radius:12px!important;background:#111!important}.v104Close,.v104Prev,.v104Next{position:fixed!important;border:0!important;border-radius:999px!important;background:#fbbf24!important;color:#111827!important;font-weight:900!important;cursor:pointer!important}.v104Close{right:16px!important;top:14px!important;font-size:22px!important;padding:8px 13px!important}.v104Prev,.v104Next{top:50%!important;transform:translateY(-50%)!important;width:46px!important;height:46px!important;font-size:30px!important}.v104Prev{left:16px!important}.v104Next{right:16px!important}.v104Counter{position:fixed!important;left:50%!important;top:18px!important;transform:translateX(-50%)!important;background:rgba(15,23,42,.82)!important;color:#fff!important;border-radius:999px!important;padding:7px 12px!important;font-weight:800!important;font-size:13px!important}@media(max-width:720px){body{padding:12px!important}.stats,.v74Stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhotos,.v68ReportPhotos,.v74Photos,.v77Photos{grid-template-columns:repeat(2,118px)!important}h1{font-size:30px!important;line-height:1.08!important}h2{font-size:23px!important;line-height:1.15!important}.v104Prev{left:8px!important}.v104Next{right:8px!important}.v104Lightbox img{max-width:88vw!important}}@media print{@page{size:A4;margin:12mm}body{padding:0!important;background:#fff!important}.v104Lightbox{display:none!important}.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhotos,.v68ReportPhotos,.v74Photos,.v77Photos{grid-template-columns:repeat(4,32mm)!important;gap:5mm!important}.reportMediaTile,.v67ReportPhoto,.v74Photo,.v77Photo,.photos figure,figure,.photo{width:32mm!important;height:32mm!important;max-width:32mm!important;padding:1mm!important}.reportMediaTile img,.v67ReportPhoto img,.v74Photo img,.v77Photo img,.photos img,.entryImageGrid img,.reportImageGrid img,figure img,img.reportPhoto{width:30mm!important;max-width:30mm!important;height:30mm!important;max-height:30mm!important}.entry,.v74Entry{page-break-inside:avoid!important;break-inside:avoid!important}.reportMediaOpen,.reportMediaPending,.v74Hint{display:none!important}}
</style>`; }
  function lightboxScript(){ return `<script id="v104-report-lightbox-script">(function(){if(window.__epitesNaploReportLightboxV104)return;window.__epitesNaploReportLightboxV104=true;function closeAll(){document.querySelectorAll('.v77Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox,.v104Lightbox').forEach(function(x){x.remove();});}function imgs(){var seen={};return Array.from(document.querySelectorAll('img')).filter(function(i){var s=i.getAttribute('data-full-src')||i.currentSrc||i.src;if(!s||i.closest('.v77Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox,.v104Lightbox')||seen[s])return false;seen[s]=1;return true;});}function openAt(n){var list=imgs();if(!list.length)return;var idx=Math.max(0,Math.min(n,list.length-1));closeAll();var box=document.createElement('div');box.className='v104Lightbox';function render(){var src=list[idx].getAttribute('data-full-src')||list[idx].currentSrc||list[idx].src;box.innerHTML='<button class="v104Close" type="button" aria-label="Bezárás">×</button><div class="v104Counter">'+(idx+1)+' / '+list.length+'</div>'+(list.length>1?'<button class="v104Prev" type="button" aria-label="Előző kép">‹</button><button class="v104Next" type="button" aria-label="Következő kép">›</button>':'')+'<img alt="Nagyított napló kép">';box.querySelector('img').src=src;box.querySelector('.v104Close').onclick=function(){closeAll();};var p=box.querySelector('.v104Prev'),nx=box.querySelector('.v104Next');if(p)p.onclick=function(e){e.stopPropagation();idx=(idx-1+list.length)%list.length;render();};if(nx)nx.onclick=function(e){e.stopPropagation();idx=(idx+1)%list.length;render();};}render();box.onclick=function(e){if(e.target===box)closeAll();};document.body.appendChild(box);}document.addEventListener('click',function(e){var close=e.target&&e.target.closest&&e.target.closest('.v104Close,.v103Lightbox button,.v102Lightbox button,.v100Lightbox button,.v77Lightbox button');if(close){e.preventDefault();e.stopPropagation();closeAll();return;}var img=e.target&&e.target.closest&&e.target.closest('img');if(!img||img.closest('.v77Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox,.v104Lightbox'))return;e.preventDefault();e.stopPropagation();openAt(imgs().indexOf(img));},true);document.addEventListener('keydown',function(e){var box=document.querySelector('.v104Lightbox');if(e.key==='Escape')closeAll();if(!box)return;if(e.key==='ArrowLeft'){var p=box.querySelector('.v104Prev'); if(p)p.click();}if(e.key==='ArrowRight'){var n=box.querySelector('.v104Next'); if(n)n.click();}});})();<\/script>`; }
  function ensureFullHtml(html){
    let out = String(html || '');
    out = out.replace(/<script[^>]*>[\s\S]*?(?:v74OpenReportPhoto|v74Lightbox|v77Lightbox|v100Lightbox|v102Lightbox|v103Lightbox|v104Lightbox|report-lightbox)[\s\S]*?<\/script>/gi, '');
    out = out.replace(/<style[^>]*>[\s\S]*?(?:v100Lightbox|v102Lightbox|v103Lightbox)[\s\S]*?<\/style>/gi, '');
    if(!/<!doctype|<html/i.test(out)) out = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${out}</body></html>`;
    if(!/<meta name="viewport"/i.test(out)) out = out.replace(/<head[^>]*>/i, m => m + '<meta name="viewport" content="width=device-width,initial-scale=1">');
    if(!out.includes('v104-report-css')) out = out.includes('</head>') ? out.replace('</head>', reportCss() + '</head>') : out.replace(/<body/i, '<head>' + reportCss() + '</head><body');
    if(!out.includes('v104-report-lightbox-script')) out = out.includes('</body>') ? out.replace('</body>', lightboxScript() + '</body>') : out + lightboxScript();
    out = out.replace(/<button([^>]*class=["'][^"']*v74Photo[^"']*["'][^>]*)>(\s*<img[\s\S]*?<\/button>)/gi, '<figure class="v74Photo"><img$2</figure>');
    out = out.replace(/<img\b([^>]*?)>/gi, function(match, attrs){
      if(/data-v104-fixed/i.test(attrs)) return match;
      const srcMatch = attrs.match(/\s(?:src|data-full-src)=["']([^"']+)["']/i);
      const src = srcMatch ? srcMatch[1] : '';
      let fixed = attrs + ' data-v104-fixed="1"';
      if(src && !/data-full-src=/i.test(attrs)) fixed += ` data-full-src="${esc(src)}"`;
      if(!/loading=/i.test(attrs)) fixed += ' loading="eager"'; else fixed = fixed.replace(/loading=["']lazy["']/i,'loading="eager"');
      if(!/decoding=/i.test(attrs)) fixed += ' decoding="async"';
      return `<img${fixed}>`;
    });
    return out;
  }
  function downloadHtml(name, html){ const blob = new Blob([ensureFullHtml(html)], {type:'text/html;charset=utf-8'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1500); }
  async function exportPdfFromHtml(html, filename){
    const full = ensureFullHtml(html);
    const w = window.open('', '_blank');
    if(!w){ downloadHtml(filename.replace(/\.pdf$/i,'.html'), full); alert('A böngésző blokkolta a PDF/nyomtatás ablakot. HTML riportot letöltöttem, azt Edge/Chrome alatt meg tudod nyitni és Ctrl+P → Mentés PDF-ként.'); return; }
    const printScript = `<script>(function(){function done(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},500)}function waitImgs(){var arr=Array.from(document.images||[]);if(!arr.length)return done();var left=arr.length, finished=false;function one(){if(finished)return;left--;if(left<=0){finished=true;done();}}arr.forEach(function(img){if(img.complete&&img.naturalWidth>0)one();else{img.addEventListener('load',one,{once:true});img.addEventListener('error',one,{once:true});}});setTimeout(function(){if(!finished){finished=true;done();}},9000);}window.addEventListener('load',waitImgs);})();<\/script>`;
    w.document.open(); w.document.write(full.replace('</body>', printScript + '</body>')); w.document.close();
  }
  async function getCloseData(){ try{ return await window.EpitesNaploAPI?.getProjectCloseData?.(pid()); }catch(e){ console.warn('V104 adatlekérés hiba:', e); } return {entries:state()?.entries||[],materials:[],invoices:[]}; }
  async function buildCurrentReport(titleSuffix, weekly){
    const data = await getCloseData();
    const supaEntries = Array.isArray(data?.entries) ? data.entries : [];
    const liveEntries = Array.isArray(state()?.entries) ? state().entries : [];
    let entries = mergeEntries(supaEntries, liveEntries);
    if(!entries.length) entries = liveEntries.length ? liveEntries : supaEntries;
    if(weekly){ const from = new Date(); from.setDate(from.getDate()-7); entries = entries.filter(e => new Date(e.created_at || e.date || 0) >= from); }
    // Fontos: a Supabase néha képek nélkül adja vissza a bejegyzést, ezért a detailState képeivel össze van fésülve.
    const title = `${ptitle()} – ${titleSuffix}`;
    const builder = window.v74BuildReportHtml || window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
    const html = builder ? builder(entries, title, {...(data||{}), entries}) : `<h1>${esc(title)}</h1><p>Nincs elérhető riportépítő.</p>`;
    return {title, html: ensureFullHtml(html), entries, data};
  }
  async function saveDoc(title,type,html,meta){ try{ await window.EpitesNaploAPI?.saveReportDocument?.({projectId:pid(),title,type,html:ensureFullHtml(html),text:(new DOMParser().parseFromString(html,'text/html').body?.innerText||'').slice(0,200000),meta:meta||{v104:true}}); }catch(e){ console.warn('V104 riport mentés hiba:', e); } try{ if(typeof window.v77RenderSavedReports==='function') await window.v77RenderSavedReports(); }catch(_){} }

  wrap('downloadWeeklyReportHtml','Heti HTML készül…',async()=>{ const r=await buildCurrentReport('heti építési napló',true); await saveDoc(r.title,'weekly_html_v104',r.html,{v104:true,range:'last_7_days'}); downloadHtml(`${safeName(r.title)}.html`,r.html); toast('Heti HTML riport elkészült.'); });
  wrap('downloadClosingReportHtml','Lezáró HTML készül…',async()=>{ const r=await buildCurrentReport('lezáró építési napló',false); await saveDoc(r.title,'closing_html_v104',r.html,{v104:true,all:true}); downloadHtml(`${safeName(r.title)}.html`,r.html); toast('Lezáró HTML riport elkészült.'); });
  wrap('printWeeklyReport','Heti PDF készül…',async()=>{ const r=await buildCurrentReport('heti PRO építési napló',true); await saveDoc(r.title,'weekly_pdf_v104',r.html,{v104:true,range:'last_7_days',images:r.entries.reduce((s,e)=>s+getEntryMedia(e).images.length,0)}); await exportPdfFromHtml(r.html,`${safeName(r.title)}.pdf`); toast('Heti PDF riport elkészült.'); });
  wrap('exportWeeklyPdfV25','Heti PDF készül…',window.printWeeklyReport);
  wrap('exportClosingPdfV25','Lezáró PDF készül…',async()=>{ const r=await buildCurrentReport('lezáró PRO építési napló',false); await saveDoc(r.title,'closing_pdf_v104',r.html,{v104:true,all:true}); await exportPdfFromHtml(r.html,`${safeName(r.title)}.pdf`); toast('Lezáró PDF riport elkészült.'); });
  wrap('printClosingDocument','Lezáró PDF készül…',window.exportClosingPdfV25);

  function isBad(html){ const t=String(html||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); return !t.trim() || t.length<350 || t.includes('riport tartalma nem talalhato') || t.includes('adatok nem tolthetok') || t.includes('hianyzo riport'); }
  async function approvalRow(id){ try{ const r=await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(r) return r; }catch(_){} try{ const rows=await window.EpitesNaploAPI?.getReportApprovals?.(pid()); return (rows||[]).find(r=>String(r.id)===String(id))||null; }catch(_){} return null; }
  async function approvedHtml(id){ const row=await approvalRow(id); if(!row) throw new Error('Nem találom a jóváhagyott riportot. Frissítsd az oldalt.'); let html=row.approved_report_html||row.report_html_snapshot||row.report_html||row.html_content||row.html||''; if(isBad(html)){ try{ const doc=await window.EpitesNaploAPI?.getReportDocumentByApproval?.(id); if(doc?.html_content&&!isBad(doc.html_content)) html=doc.html_content; }catch(_){} } if(isBad(html)){ const fresh=await buildCurrentReport('jóváhagyott riport',false); html=fresh.html; } const decision=String(row.decision||row.status||(row.approved?'approved':'viewed')).toLowerCase(); const label=decision==='question'?'Kérdése van':(decision==='accepted'||decision==='approved')?'Elfogadva / jóváhagyva':'Megtekintve'; const msg=String(row.client_comment||row.message||row.client_message||row.question||row.note||'').trim(); const stamp=`<section class="v104ApprovalStamp"><h2>Ügyfél visszajelzés</h2><p><b>Állapot:</b> ${esc(label)}</p>${msg?`<p><b>Ügyfél megjegyzése:</b><br>${esc(msg).replace(/\n/g,'<br>')}</p>`:''}</section>`; html=ensureFullHtml(html); if(!html.includes('v104ApprovalStamp')) html=html.replace(/<body[^>]*>/i,m=>m+stamp); return {row,html:ensureFullHtml(html),label}; }
  wrap('v71DownloadApprovedHtml','Jóváhagyott HTML készül…',async(id)=>{ const r=await approvedHtml(id); await saveDoc(`${ptitle()} – jóváhagyott saját példány`,'approved_html_v104',r.html,{v104:true,approvalId:id,label:r.label}); downloadHtml(`${safeName(ptitle())}-${safeName(r.label)}-jovahagyott-riport.html`,r.html); toast('Jóváhagyott HTML riport letöltve.'); });
  wrap('v71PrintApprovedReport','Jóváhagyott PDF készül…',async(id)=>{ const r=await approvedHtml(id); await saveDoc(`${ptitle()} – jóváhagyott PDF példány`,'approved_pdf_v104',r.html,{v104:true,approvalId:id,label:r.label}); await exportPdfFromHtml(r.html,`${safeName(ptitle())}-${safeName(r.label)}-jovahagyott-riport.pdf`); toast('Jóváhagyott PDF riport elkészült.'); });
  document.addEventListener('click',function(e){ const btn=e.target.closest&&e.target.closest('[data-v80-approval-download],[data-v79-approval-download],[data-v71-download],[data-v80-approval-print],[data-v79-approval-print],[data-v71-print]'); if(!btn)return; e.preventDefault(); e.stopImmediatePropagation(); const id=btn.getAttribute('data-v80-approval-download')||btn.getAttribute('data-v79-approval-download')||btn.getAttribute('data-v71-download')||btn.getAttribute('data-v80-approval-print')||btn.getAttribute('data-v79-approval-print')||btn.getAttribute('data-v71-print'); lastButton=btn; if(btn.hasAttribute('data-v80-approval-download')||btn.hasAttribute('data-v79-approval-download')||btn.hasAttribute('data-v71-download')) window.v71DownloadApprovedHtml(id); else window.v71PrintApprovedReport(id); },true);

  console.log('ÉpítésNapló V104 heti képek / lapozós képnéző / gyorsítás javítás aktív.');
})();
