/* V118 public report viewer: normal tagolt riport, kisképek, galéria, PDF, ügyfél visszajelzés. */
(function(){
  'use strict';
  let currentToken=''; let galleryIndex=0;
  const $=id=>document.getElementById(id);
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=d=>({viewed:'Megnéztem',accepted:'Elfogadom',approved:'Elfogadom',question:'Kérdésem van'}[String(d||'').toLowerCase()]||'Megnéztem');
  function tokenFromUrl(){ const p=new URLSearchParams(location.search); return String(p.get('riport')||p.get('token')||p.get('report')||p.get('id')||'').trim(); }
  function decodeHtml(s){ s=String(s||''); if((s.match(/&lt;/g)||[]).length>(s.match(/<\w+/g)||[]).length){ const t=document.createElement('textarea'); t.innerHTML=s; return t.value; } return s; }
  function looksPlainText(s){ const tags=(String(s).match(/<\/?(div|section|h1|h2|h3|p|figure|img|table|ul|li|br)\b/ig)||[]).length; return tags < 4; }
  function plainToHtml(text){
    text=String(text||'').replace(/\r/g,'').trim(); if(!text) return '<p>A riport üres.</p>';
    let out=safe(text)
      .replace(/(Átadásra kész dokumentáció)/g,'<p class="pill">$1</p>')
      .replace(/(Rövid összegzés|Anyagösszesítő|Számlák|Vezetői AI összefoglaló|Napi bejegyzések|Munka közben \/ dokumentáció|Ügyfél kérdése \/ észrevétele)/g,'<h2>$1</h2>')
      .replace(/(\d{4}\.\s*\d{2}\.\s*\d{2}[^\n]*?–[^\n]*)/g,'<h3>$1</h3>')
      .replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br>');
    return '<p>'+out+'</p>';
  }
  function cleanHtml(html){
    let s=decodeHtml(html); if(looksPlainText(s)) return plainToHtml(s);
    const doc=new DOMParser().parseFromString(s,'text/html'); const body=doc.body||doc;
    body.querySelectorAll('script,noscript,template,.v112Lightbox,.v115Lightbox,.v117Lightbox,.v118Lightbox,.mediaViewerModal').forEach(x=>x.remove());
    body.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{ if(/^on/i.test(a.name)) el.removeAttribute(a.name); }));
    body.querySelectorAll('a').forEach(a=>{ if(a.querySelector('img,video') || /index\.html|project\.html/i.test(a.getAttribute('href')||'')){ a.removeAttribute('href'); a.removeAttribute('target'); }});
    body.querySelectorAll('img').forEach(img=>{ img.loading='lazy'; img.decoding='async'; if(!img.alt) img.alt='Napló fotó'; });
    return body.innerHTML || plainToHtml(s);
  }
  function mediaItems(){ const root=$('publicReportContent')||document; return [...root.querySelectorAll('img,video')].filter(el=>!el.closest('.v110Gallery') && !(el.alt||'').toLowerCase().includes('ikon') && !/favicon/i.test(el.src||'')).map(el=>({el,type:el.tagName==='VIDEO'?'video':'image',src:el.currentSrc||el.src||el.getAttribute('data-full-src')||el.getAttribute('data-src')||'',title:el.alt||el.title||'Napló fotó'})).filter(x=>x.src); }
  function ensureGallery(){ let g=$('v110Gallery'); if(g) return g; g=document.createElement('div'); g.id='v110Gallery'; g.className='v110Gallery'; g.innerHTML='<div class="v110GalleryTop"><b id="v110GalleryTitle">Napló fotó</b><button class="v110GalleryClose" type="button">Bezárás ×</button></div><button class="v110Nav prev" type="button">‹</button><div id="v110GalleryStage" class="v110GalleryStage"></div><button class="v110Nav next" type="button">›</button>'; document.body.appendChild(g); g.querySelector('.v110GalleryClose').onclick=closeGallery; g.querySelector('.prev').onclick=e=>{e.stopPropagation();showGallery(galleryIndex-1)}; g.querySelector('.next').onclick=e=>{e.stopPropagation();showGallery(galleryIndex+1)}; g.onclick=e=>{if(e.target===g)closeGallery()}; return g; }
  function showGallery(i){ const items=mediaItems(); if(!items.length) return; galleryIndex=(i+items.length)%items.length; const it=items[galleryIndex]; ensureGallery(); $('v110GalleryTitle').textContent=`${it.title} (${galleryIndex+1}/${items.length})`; $('v110GalleryStage').innerHTML=it.type==='video'?`<video controls playsinline preload="auto" src="${safe(it.src)}"></video>`:`<img src="${safe(it.src)}" alt="${safe(it.title)}">`; $('v110Gallery').classList.add('open'); }
  function closeGallery(){ const g=$('v110Gallery'); if(g){ g.classList.remove('open'); $('v110GalleryStage').innerHTML=''; } }
  function wireGallery(){ const root=$('publicReportContent'); if(!root)return; root.querySelectorAll('img,video').forEach(el=>{ if(el.dataset.v118Wired)return; el.dataset.v118Wired='1'; el.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); const items=mediaItems(); showGallery(Math.max(0,items.findIndex(x=>x.el===el))); },true); }); }
  document.addEventListener('keydown',e=>{ const g=$('v110Gallery'); if(!g||!g.classList.contains('open'))return; if(e.key==='Escape')closeGallery(); if(e.key==='ArrowLeft')showGallery(galleryIndex-1); if(e.key==='ArrowRight')showGallery(galleryIndex+1); });
  async function load(){
    currentToken=tokenFromUrl(); const box=$('publicReportContent');
    if(!currentToken){
      try{
        const pid = localStorage.getItem('epitesnaplo_last_project_id') || localStorage.getItem('epitesnaplo_current_project_id') || '';
        if(pid){
          window.location.replace('project.html?id=' + encodeURIComponent(pid) + '&openReport=1');
          return;
        }
      }catch(_){}
      box.innerHTML='<h2>Hiányzó riport azonosító.</h2><p>A linkből hiányzik a riport azonosító. Nyisd meg a projektet, majd a Riport gombbal a Riportok és átadás ablakot.</p>';
      return;
    }
    try{
      const report=await window.EpitesNaploAPI.getPublicReport(currentToken);
      if(!report){ box.innerHTML='<h2>A riport nem található vagy lejárt.</h2><p>Kérj új linket a kivitelezőtől.</p>'; return; }
      try{ await window.EpitesNaploAPI.markPublicReportOpened(currentToken); }catch(_){ }
      box.innerHTML='<div class="reportOpenedBox"><b>Riport megnyitva.</b><br>Az oldal csak olvasásra szolgál.</div>'+cleanHtml(report.report_html||report.html||report.report_text||'');
      try{ await window.EpitesNaploAPI.hydratePublicReportMedia(currentToken, box); }catch(e){ console.warn(e); }
      wireGallery();
      document.title=(report.project_name?report.project_name+' – ':'')+'ÉpítésNapló ügyfélriport';
      $('approvalBox').classList.remove('hidden');
      $('approvalBox').innerHTML=`<h2>Ügyfél visszajelzés</h2><p class="muted">Válaszd ki, mit szeretnél rögzíteni. A kivitelező látni fogja a döntést és a kérdést/megjegyzést.</p><input id="clientApproveName" placeholder="Név / cég"><input id="clientApproveEmail" placeholder="Email cím (opcionális)"><textarea id="clientApproveMessage" placeholder="Megjegyzés vagy kérdés (opcionális)"></textarea><label class="checkLine"><input id="clientApproveCheck" type="checkbox"> <span>Megtekintettem az építési napló riportot.</span></label><div class="approvalActionGrid"><button class="btn ghost" onclick="approveReportV110('viewed', this)">Megnéztem</button><button class="btn primary" onclick="approveReportV110('accepted', this)">Elfogadom</button><button class="btn ghost" onclick="approveReportV110('question', this)">Kérdésem van</button></div>`;
    }catch(e){ box.innerHTML='<h2>Riport betöltési hiba</h2><p>'+safe(e.message||e)+'</p>'; }
  }
  window.approveReportV110=async function(decision,btn){ const name=$('clientApproveName')?.value.trim()||''; const email=$('clientApproveEmail')?.value.trim()||''; const message=$('clientApproveMessage')?.value.trim()||''; if(!$('clientApproveCheck')?.checked)return alert('A visszajelzéshez pipáld be a megtekintést.'); if(decision==='question'&&!message)return alert('Kérdéshez írd be a kérdésedet vagy megjegyzésedet.'); const buttons=[...document.querySelectorAll('#approvalBox .btn')]; const old=btn?.innerText||''; buttons.forEach(b=>b.disabled=true); if(btn){btn.classList.add('is-loading');btn.innerText='Mentés folyamatban...';} const clone=$('publicReportContent').cloneNode(true); clone.querySelectorAll('.reportOpenedBox,.v110Gallery').forEach(x=>x.remove()); const baseHtml=clone.innerHTML; const baseText=clone.innerText||''; const extra=message?`<section class="clientFeedbackBlock"><h2>Ügyfél kérdése / észrevétele</h2><p style="white-space:pre-wrap;">${safe(message)}</p></section>`:''; try{ await window.EpitesNaploAPI.approvePublicReport(currentToken,{name,email,decision,message,clientComment:message,reportHtml:baseHtml+extra,reportText:baseText+(message?'\n\nÜgyfél kérdése / észrevétele:\n'+message:'')}); $('approvalBox').innerHTML=`<div class="reportOpenedBox"><b>Visszajelzés mentve: ${safe(label(decision))}</b><br>Dátum: ${new Date().toLocaleString('hu-HU')}${message?`<br><small>Kérdés/megjegyzés: ${safe(message)}</small>`:''}<br><small>A kivitelező projektoldalán megjelenik.</small></div>`; }catch(e){ alert('Jóváhagyás mentési hiba: '+(e.message||e)); } finally{ buttons.forEach(b=>b.disabled=false); if(btn){btn.classList.remove('is-loading'); if(old)btn.innerText=old;} } };
  async function waitImages(root){ const imgs=[...root.querySelectorAll('img')].filter(i=>i.src); await Promise.all(imgs.map(img=>img.complete&&img.naturalWidth>0?true:new Promise(res=>{img.onload=res;img.onerror=res;setTimeout(res,6000)}))); await new Promise(r=>setTimeout(r,250)); }
  window.downloadPublicPdfV110=async function(btn){ const old=btn?.innerText||''; if(btn){btn.disabled=true;btn.classList.add('is-loading');btn.innerText='PDF készül...';} const stage=$('publicReportContent').cloneNode(true); stage.querySelectorAll('.reportOpenedBox,.v110Gallery').forEach(x=>x.remove()); stage.style.background='#fff'; stage.style.padding='24px'; stage.style.width='900px'; stage.style.position='fixed'; stage.style.left='-9999px'; stage.style.top='0'; document.body.appendChild(stage); try{ await waitImages(stage); if(window.html2pdf){ await html2pdf().set({margin:[8,8,8,8],filename:'epitesi-naplo-ugyfelriport.pdf',image:{type:'jpeg',quality:.96},html2canvas:{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#ffffff',imageTimeout:12000},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy'],avoid:['img','figure','.stat','.photo']}}).from(stage).save(); } else window.print(); } finally{ stage.remove(); if(btn){btn.disabled=false;btn.classList.remove('is-loading');btn.innerText=old||'PDF letöltés';} } };
  window.copyReportLink=async function(btn){ try{ await navigator.clipboard.writeText(location.href); const old=btn.innerText; btn.innerText='Link másolva'; setTimeout(()=>btn.innerText=old,1500); }catch(_){ prompt('Másold ki a linket:',location.href); } };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load); else load();
})();



// ===== V133: publikus ügyfélriport fotó-visszatöltés + üres PDF javítás =====
(function(){
  if (window.__v133PublicReportMediaPdfFix) return;
  window.__v133PublicReportMediaPdfFix = true;

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
    });
  }
  function token(){
    try{
      const p = new URLSearchParams(location.search);
      return String(p.get('riport') || p.get('token') || p.get('report') || p.get('id') || '').trim();
    }catch(_){ return ''; }
  }
  function realPhotoCount(root){
    root = root || document.getElementById('publicReportContent') || document;
    return Array.from(root.querySelectorAll('img')).filter(function(img){
      const s = String(img.currentSrc || img.src || img.getAttribute('data-path') || img.getAttribute('data-image-path') || '').toLowerCase();
      return s && !s.includes('favicon') && !s.includes('epitesi-naplo.eu/favicon');
    }).length;
  }
  function mediaKey(m){
    return String(m && (m.path || m.url || m.src) || '').trim();
  }
  function addFallbackGallery(media){
    const box = document.getElementById('publicReportContent');
    if(!box || !Array.isArray(media) || !media.length) return;
    if(box.querySelector('.v133FallbackGallery')) return;

    const existing = new Set(Array.from(box.querySelectorAll('img,video')).map(function(el){
      return String(el.getAttribute('data-path') || el.getAttribute('data-image-path') || el.getAttribute('data-media-path') || el.getAttribute('data-video-path') || el.currentSrc || el.src || '').trim();
    }).filter(Boolean));

    const images = media.filter(function(m){ return String(m.type || '').toLowerCase() !== 'video' && (m.url || m.path); });
    const videos = media.filter(function(m){ return String(m.type || '').toLowerCase() === 'video' && (m.url || m.path); });
    const missingImages = images.filter(function(m){ return !existing.has(mediaKey(m)) && !existing.has(String(m.url || '').trim()); });
    const missingVideos = videos.filter(function(m){ return !existing.has(mediaKey(m)) && !existing.has(String(m.url || '').trim()); });

    if(!missingImages.length && !missingVideos.length) return;

    const htmlImages = missingImages.map(function(m, i){
      const url = esc(m.url || '');
      const path = esc(m.path || '');
      return '<figure class="v67ReportPhoto v133FallbackPhoto">'+
        '<img src="'+url+'" data-path="'+path+'" alt="Napló fotó '+(i+1)+'" loading="lazy" decoding="async" onclick="window.open(this.currentSrc || this.src, \'_blank\')">'+
        '<figcaption>'+(i+1)+'. kép – nagyítás</figcaption>'+
      '</figure>';
    }).join('');

    const htmlVideos = missingVideos.map(function(m, i){
      const url = esc(m.url || '');
      const path = esc(m.path || '');
      return '<figure class="v67ReportPhoto v133FallbackVideo">'+
        '<video controls playsinline preload="metadata" src="'+url+'" data-video-path="'+path+'"></video>'+
        '<figcaption>'+(i+1)+'. videó</figcaption>'+
      '</figure>';
    }).join('');

    const section = document.createElement('section');
    section.className = 'entry v133FallbackGallery';
    section.innerHTML =
      '<h2>Fotódokumentáció</h2>'+
      '<p><b>A riporthoz tartozó feltöltött képek és videók.</b></p>'+
      (htmlImages ? '<div class="photos">'+htmlImages+'</div>' : '')+
      (htmlVideos ? '<h3>Munkavideók</h3><div class="photos">'+htmlVideos+'</div>' : '');
    box.appendChild(section);
  }

  async function hydrateMissingPhotos(){
    const t = token();
    const box = document.getElementById('publicReportContent');
    if(!t || !box || !window.EpitesNaploAPI || typeof window.EpitesNaploAPI.getPublicReportAllMedia !== 'function') return;
    if(box.dataset.v133Hydrated === '1') return;
    box.dataset.v133Hydrated = '1';
    try{
      const media = await window.EpitesNaploAPI.getPublicReportAllMedia(t);
      if(Array.isArray(media) && media.length){
        // Ha a mentett HTML-ből a képek hiányoznak vagy kevesebb látszik, a teljes projektmédia visszakerül a riport aljára.
        if(realPhotoCount(box) < media.filter(function(m){ return String(m.type || '').toLowerCase() !== 'video'; }).length){
          addFallbackGallery(media);
        }
      }
    }catch(err){
      console.warn('V133 publikus fotó visszatöltés hiba:', err);
    }
  }

  function reportContentHtml(){
    const box = document.getElementById('publicReportContent');
    if(!box) return '<h1>Ügyfélriport</h1><p>Nincs betöltött riport.</p>';
    const clone = box.cloneNode(true);
    clone.querySelectorAll('.reportOpenedBox,.v110Gallery,.hidden,script').forEach(function(x){ x.remove(); });
    return clone.innerHTML || '<h1>Ügyfélriport</h1><p>Nincs betöltött riport.</p>';
  }

  function printCss(){
    return '<style>'+
      '*{box-sizing:border-box} body{margin:0;background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif;line-height:1.45;padding:24px}'+
      'h1{font-size:30px;margin:12px 0} h2{font-size:22px;margin:22px 0 10px} h3{font-size:18px;margin:18px 0 8px} p{margin:8px 0}'+
      '.cover{border-bottom:4px solid #f59e0b;margin-bottom:20px;padding-bottom:16px}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:14px 0}.stat{background:#f3f4f6;border-radius:10px;padding:10px}.stat b{display:block;color:#d97706;font-size:20px}'+
      '.entry{break-inside:avoid;border-left:4px solid #f59e0b;background:#fafafa;margin:14px 0;padding:14px;border-radius:12px}.photos{display:grid;grid-template-columns:repeat(auto-fill,105px);gap:10px;margin:12px 0}.v67ReportPhoto,figure{margin:0;border:1px solid #e5e7eb;border-radius:10px;padding:5px;background:#fff;break-inside:avoid}.v67ReportPhoto img,figure img{width:95px;height:95px;object-fit:cover;border-radius:8px;display:block}.v67ReportPhoto video,figure video{width:160px;max-width:100%;border-radius:8px}figcaption,.v67ReportPhoto span{font-size:10px;color:#64748b;display:block;margin-top:4px}'+
      'table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e5e7eb;padding:7px;text-align:left}'+
      '@media print{body{padding:8mm}.entry,.v67ReportPhoto,figure{break-inside:avoid;page-break-inside:avoid}.photos{grid-template-columns:repeat(4,28mm)}.v67ReportPhoto img,figure img{width:26mm;height:26mm}}'+
    '</style>';
  }

  async function waitImgs(doc){
    const imgs = Array.from((doc || document).querySelectorAll('img')).filter(function(img){ return img.src; });
    await Promise.race([
      Promise.all(imgs.map(function(img){ return img.complete ? Promise.resolve() : new Promise(function(res){ img.onload=res; img.onerror=res; }); })),
      new Promise(function(res){ setTimeout(res, 3500); })
    ]);
  }

  // A régi html2pdf-es rejtett export helyett látható nyomtatási/PDF ablakot használunk, így nem lesz üres.
  window.downloadPublicPdfV110 = async function(btn){
    const old = btn ? btn.innerText : '';
    if(btn){ btn.disabled = true; btn.classList.add('is-loading'); btn.innerText = 'PDF készül...'; }
    try{
      await hydrateMissingPhotos();
      const w = window.open('', '_blank');
      if(!w){
        alert('A böngésző blokkolta az új ablakot. Engedélyezd az előugró ablakot.');
        return;
      }
      const html = '<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ÉpítésNapló ügyfélriport PDF</title>'+printCss()+'</head><body>'+reportContentHtml()+'<script>function wi(){var imgs=Array.prototype.slice.call(document.images||[]);return Promise.race([Promise.all(imgs.map(function(i){return i.complete?Promise.resolve():new Promise(function(r){i.onload=r;i.onerror=r;});})),new Promise(function(r){setTimeout(r,3500);})]);}window.addEventListener("load",function(){wi().then(function(){setTimeout(function(){window.focus();window.print();},500);});});<\/script></body></html>';
      w.document.open();
      w.document.write(html);
      w.document.close();
    }finally{
      if(btn){ btn.disabled = false; btn.classList.remove('is-loading'); btn.innerText = old || 'PDF letöltés'; }
    }
  };

  // Többször próbáljuk, mert a Supabase riport betöltése aszinkron.
  document.addEventListener('DOMContentLoaded', function(){
    [700, 1500, 3000, 5000].forEach(function(ms){ setTimeout(hydrateMissingPhotos, ms); });
  });
  if(document.readyState !== 'loading'){
    [700, 1500, 3000, 5000].forEach(function(ms){ setTimeout(hydrateMissingPhotos, ms); });
  }
})();


// ===== V137: iPhone/Safari kompatibilis képnagyítás + lapozás az ügyfélriportban =====
(function(){
  if(window.__v137IphoneZoomGallery) return;
  window.__v137IphoneZoomGallery = true;

  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function mediaList(){
    const root = document.getElementById('publicReportContent') || document;
    return Array.from(root.querySelectorAll('img,video')).filter(function(el){
      const s = String(el.currentSrc || el.src || el.getAttribute('data-full-src') || el.getAttribute('data-src') || '').toLowerCase();
      return s && !s.includes('favicon') && !el.closest('#v137ZoomViewer');
    }).map(function(el){
      return {
        el:el,
        type:el.tagName === 'VIDEO' ? 'video' : 'image',
        src:el.currentSrc || el.src || el.getAttribute('data-full-src') || el.getAttribute('data-src') || '',
        title:el.alt || el.title || 'Napló fotó'
      };
    });
  }

  let idx = 0, scale = 1, tx = 0, ty = 0;
  let startDist = 0, startScale = 1, startX = 0, startY = 0, panX = 0, panY = 0, oneStartX = 0, oneStartY = 0, oneMoved = false;

  function css(){
    if(document.getElementById('v137ZoomCss')) return;
    const st = document.createElement('style');
    st.id = 'v137ZoomCss';
    st.textContent = `
      #v137ZoomViewer{position:fixed;inset:0;z-index:2147483647;background:rgba(2,6,23,.96);display:none;color:#fff;touch-action:none;overscroll-behavior:contain}
      #v137ZoomViewer.open{display:flex;align-items:center;justify-content:center}
      .v137ZoomTop{position:absolute;top:0;left:0;right:0;min-height:58px;background:#0f172a;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 10px;z-index:2}
      .v137ZoomTitle{font-weight:800;font-size:14px;line-height:1.25;max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .v137ZoomBtns{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
      .v137ZoomBtns button,.v137ZoomNav{border:1px solid rgba(255,255,255,.24);background:#132238;color:#fff;border-radius:12px;padding:9px 11px;font-weight:900}
      .v137ZoomBtns .primary{background:#fbbf24;color:#111827;border-color:#fbbf24}
      .v137ZoomStage{width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:70px 52px 34px;overflow:hidden}
      .v137ZoomStage img{max-width:100%;max-height:100%;object-fit:contain;border-radius:14px;transform-origin:center center;will-change:transform;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
      .v137ZoomStage video{max-width:100%;max-height:100%;border-radius:14px;background:#000}
      .v137ZoomNav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:64px;font-size:34px;padding:0;background:rgba(15,23,42,.72);z-index:2}
      .v137ZoomNav.prev{left:8px}.v137ZoomNav.next{right:8px}
      @media(max-width:760px){.v137ZoomStage{padding:68px 8px 24px}.v137ZoomNav{width:38px;height:54px;font-size:30px;opacity:.88}.v137ZoomTitle{max-width:35vw}.v137ZoomBtns button{padding:8px 9px;font-size:12px}}
      @media print{#v137ZoomViewer{display:none!important}}
    `;
    document.head.appendChild(st);
  }


  function openFullMediaV138(it){
    const src = String(it && it.src || '').trim();
    if(!src) return alert('A teljes kép linkje nem található.');
    const title = String(it.title || 'Teljes kép');
    const w = window.open('', '_blank');
    if(!w){
      // Utolsó esély: ugyanabban az ablakban nyitjuk meg, hogy iPhone/Messenger se dobjon üres oldalt.
      location.href = src;
      return;
    }
    const isVideo = it.type === 'video' || /\.(mp4|mov|webm)(\?|#|$)/i.test(src);
    const body = isVideo
      ? '<video controls playsinline autoplay style="max-width:100%;max-height:88vh;border-radius:14px;background:#000" src="'+esc(src)+'"></video>'
      : '<img alt="'+esc(title)+'" src="'+esc(src)+'" style="max-width:100%;height:auto;max-height:none;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.35);touch-action:auto;-webkit-user-select:auto;user-select:auto">';
    w.document.open();
    w.document.write('<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=8,user-scalable=yes"><title>'+esc(title)+'</title><style>body{margin:0;background:#07111f;color:#fff;font-family:Arial,Helvetica,sans-serif}.top{position:sticky;top:0;background:#0f172a;padding:12px 14px;display:flex;gap:10px;align-items:center;justify-content:space-between}.top b{font-size:16px}.top button,.top a{border:0;border-radius:10px;background:#fbbf24;color:#111827;font-weight:900;padding:10px 12px;text-decoration:none}.stage{padding:16px;min-height:calc(100vh - 60px);display:flex;align-items:flex-start;justify-content:center;overflow:auto;-webkit-overflow-scrolling:touch}@media(max-width:760px){.stage{display:block;text-align:center;padding:10px}.top{align-items:flex-start;flex-direction:column}.top button,.top a{width:100%;text-align:center}}</style></head><body><div class="top"><b>'+esc(title)+'</b><div><a href="'+esc(src)+'" target="_self">Kép megnyitása közvetlenül</a> <button onclick="window.close()">Bezárás</button></div></div><div class="stage">'+body+'</div></body></html>');
    w.document.close();
  }

  function viewer(){
    css();
    let v = document.getElementById('v137ZoomViewer');
    if(v) return v;
    v = document.createElement('div');
    v.id = 'v137ZoomViewer';
    v.innerHTML = '<div class="v137ZoomTop"><div id="v137ZoomTitle" class="v137ZoomTitle">Napló fotó</div><div class="v137ZoomBtns"><button type="button" data-act="minus">−</button><button type="button" data-act="plus">+</button><button type="button" data-act="reset">100%</button><button class="primary" type="button" data-act="open">Teljes kép</button><button type="button" data-act="close">Bezárás</button></div></div><button type="button" class="v137ZoomNav prev">‹</button><div id="v137ZoomStage" class="v137ZoomStage"></div><button type="button" class="v137ZoomNav next">›</button>';
    document.body.appendChild(v);
    v.querySelector('.prev').onclick = function(e){ e.stopPropagation(); show(idx-1); };
    v.querySelector('.next').onclick = function(e){ e.stopPropagation(); show(idx+1); };
    v.querySelector('[data-act="close"]').onclick = close;
    v.querySelector('[data-act="minus"]').onclick = function(){ setScale(scale - .35); };
    v.querySelector('[data-act="plus"]').onclick = function(){ setScale(scale + .35); };
    v.querySelector('[data-act="reset"]').onclick = function(){ scale=1; tx=0; ty=0; applyTransform(); };
    v.querySelector('[data-act="open"]').onclick = function(){ const it = mediaList()[idx]; if(it && it.src) openFullMediaV138(it); };
    v.addEventListener('wheel', function(e){ if(!v.classList.contains('open')) return; e.preventDefault(); setScale(scale + (e.deltaY < 0 ? .25 : -.25)); }, {passive:false});
    v.addEventListener('touchstart', onTouchStart, {passive:false});
    v.addEventListener('touchmove', onTouchMove, {passive:false});
    v.addEventListener('touchend', onTouchEnd, {passive:false});
    return v;
  }

  function applyTransform(){
    const img = document.querySelector('#v137ZoomStage img');
    if(img) img.style.transform = 'translate3d('+tx+'px,'+ty+'px,0) scale('+scale+')';
  }
  function setScale(s){
    scale = Math.max(1, Math.min(5, s));
    if(scale === 1){ tx = 0; ty = 0; }
    applyTransform();
  }
  function show(i){
    const list = mediaList();
    if(!list.length) return;
    idx = (i + list.length) % list.length;
    const it = list[idx];
    scale = 1; tx = 0; ty = 0;
    const v = viewer();
    document.getElementById('v137ZoomTitle').textContent = (it.title || 'Napló fotó') + ' ('+(idx+1)+'/'+list.length+')';
    const stage = document.getElementById('v137ZoomStage');
    stage.innerHTML = it.type === 'video'
      ? '<video controls playsinline preload="auto" src="'+esc(it.src)+'"></video>'
      : '<img src="'+esc(it.src)+'" alt="'+esc(it.title)+'">';
    v.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
  }
  function close(){
    const v = document.getElementById('v137ZoomViewer');
    if(v){ v.classList.remove('open'); document.getElementById('v137ZoomStage').innerHTML = ''; }
    document.documentElement.style.overflow = '';
  }
  function dist(t1,t2){ const dx=t1.clientX-t2.clientX, dy=t1.clientY-t2.clientY; return Math.sqrt(dx*dx+dy*dy); }
  function mid(t1,t2){ return {x:(t1.clientX+t2.clientX)/2, y:(t1.clientY+t2.clientY)/2}; }

  function onTouchStart(e){
    if(!e.currentTarget.classList.contains('open')) return;
    if(e.touches.length === 2){
      e.preventDefault();
      startDist = dist(e.touches[0], e.touches[1]);
      startScale = scale;
      const m = mid(e.touches[0], e.touches[1]);
      startX = m.x; startY = m.y; panX = tx; panY = ty;
    }else if(e.touches.length === 1){
      oneStartX = e.touches[0].clientX;
      oneStartY = e.touches[0].clientY;
      panX = tx; panY = ty;
      oneMoved = false;
    }
  }
  function onTouchMove(e){
    if(!e.currentTarget.classList.contains('open')) return;
    if(e.touches.length === 2){
      e.preventDefault();
      const d = dist(e.touches[0], e.touches[1]);
      const m = mid(e.touches[0], e.touches[1]);
      scale = Math.max(1, Math.min(5, startScale * (d / Math.max(1, startDist))));
      tx = panX + (m.x - startX);
      ty = panY + (m.y - startY);
      if(scale === 1){ tx = 0; ty = 0; }
      applyTransform();
    }else if(e.touches.length === 1){
      const dx = e.touches[0].clientX - oneStartX;
      const dy = e.touches[0].clientY - oneStartY;
      if(Math.abs(dx) > 8 || Math.abs(dy) > 8) oneMoved = true;
      if(scale > 1){
        e.preventDefault();
        tx = panX + dx;
        ty = panY + dy;
        applyTransform();
      }
    }
  }
  function onTouchEnd(e){
    if(e.touches.length) return;
    const changed = e.changedTouches && e.changedTouches[0];
    const dx = (changed ? changed.clientX : oneStartX) - oneStartX;
    const dy = (changed ? changed.clientY : oneStartY) - oneStartY;
    if(scale === 1 && oneMoved && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4){
      show(idx + (dx < 0 ? 1 : -1));
    }
  }

  document.addEventListener('keydown', function(e){
    const v = document.getElementById('v137ZoomViewer');
    if(!v || !v.classList.contains('open')) return;
    if(e.key === 'Escape') close();
    if(e.key === 'ArrowRight') show(idx+1);
    if(e.key === 'ArrowLeft') show(idx-1);
    if(e.key === '+' || e.key === '=') setScale(scale+.35);
    if(e.key === '-') setScale(scale-.35);
  });

  document.addEventListener('click', function(e){
    const img = e.target && e.target.closest ? e.target.closest('#publicReportContent img, #publicReportContent video') : null;
    if(!img || img.closest('#v137ZoomViewer')) return;
    const src = img.currentSrc || img.src || img.getAttribute('data-full-src') || img.getAttribute('data-src') || '';
    if(!src || /favicon/i.test(src)) return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    const list = mediaList();
    show(Math.max(0, list.findIndex(x => x.el === img)));
  }, true);
})();
