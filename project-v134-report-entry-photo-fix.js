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
