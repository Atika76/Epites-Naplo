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
