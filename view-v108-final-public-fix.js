/* V108 - ügyfélriport végleges javítás
   - Facebook/Messenger arculatos előnézet marad
   - riport képeire kattintva nem ugrik főoldalra
   - saját galéria: előző / következő / bezárás
   - favicon biztosítás minden riport nézetben
*/
(function(){
  'use strict';
  const BRAND_ICON = 'https://epitesi-naplo.eu/favicon.png';
  const OG_IMG = 'https://epitesi-naplo.eu/og-epitesi-naplo-v108.png';

  function setMeta(sel, attr, value){
    let el = document.head.querySelector(sel);
    if(!el){
      el = document.createElement('meta');
      if(sel.includes('property=')) el.setAttribute('property', sel.match(/property="([^"]+)"/)?.[1] || '');
      if(sel.includes('name=')) el.setAttribute('name', sel.match(/name="([^"]+)"/)?.[1] || '');
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  }
  function ensureHead(){
    document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]').forEach(l => l.remove());
    const links = [
      ['icon','image/png',BRAND_ICON],
      ['shortcut icon','image/png','https://epitesi-naplo.eu/favicon.ico'],
      ['apple-touch-icon','image/png',BRAND_ICON]
    ];
    links.forEach(([rel,type,href])=>{ const l=document.createElement('link'); l.rel=rel; l.type=type; l.href=href; document.head.appendChild(l); });
    document.title = document.title && !/Ügyfélriport/i.test(document.title) ? document.title : 'Ügyfélriport – ÉpítésNapló AI PRO';
    setMeta('meta[property="og:title"]','content','Ügyfélriport – ÉpítésNapló AI PRO');
    setMeta('meta[property="og:description"]','content','Biztonságos, csak olvasható ügyfélriport ügyfél jóváhagyással.');
    setMeta('meta[property="og:type"]','content','website');
    setMeta('meta[property="og:image"]','content',OG_IMG);
    setMeta('meta[property="og:image:secure_url"]','content',OG_IMG);
    setMeta('meta[property="og:image:width"]','content','1200');
    setMeta('meta[property="og:image:height"]','content','630');
    setMeta('meta[name="twitter:card"]','content','summary_large_image');
    setMeta('meta[name="twitter:image"]','content',OG_IMG);
  }

  function css(){
    if(document.getElementById('v108-public-gallery-css')) return;
    const s=document.createElement('style'); s.id='v108-public-gallery-css';
    s.textContent=`
      #publicReportContent a:has(img), #publicReportContent a:has(video){ cursor:zoom-in!important; text-decoration:none!important; }
      #publicReportContent img:not(.brandIcon):not(.logo), #publicReportContent video{ cursor:zoom-in!important; }
      .v108Gallery{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.92);display:none;align-items:center;justify-content:center;padding:76px 72px 34px;box-sizing:border-box;}
      .v108Gallery.open{display:flex;}
      .v108GalleryTop{position:absolute;left:0;right:0;top:0;height:58px;background:#0f172a;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px;color:#fff;box-sizing:border-box;border-bottom:1px solid rgba(255,255,255,.12)}
      .v108GalleryTitle{font-weight:800;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .v108GalleryClose{border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:900;padding:10px 14px;cursor:pointer;}
      .v108GalleryStage{max-width:100%;max-height:100%;display:grid;place-items:center;}
      .v108GalleryStage img,.v108GalleryStage video{max-width:100%;max-height:calc(100vh - 125px);object-fit:contain;border-radius:12px;background:#000;box-shadow:0 20px 70px rgba(0,0,0,.45)}
      .v108Nav{position:absolute;top:50%;transform:translateY(-50%);width:54px;height:76px;border:1px solid rgba(255,255,255,.20);border-radius:18px;background:rgba(15,23,42,.72);color:#fff;font-size:44px;line-height:1;cursor:pointer;display:grid;place-items:center;}
      .v108Nav.prev{left:14px}.v108Nav.next{right:14px}.v108Nav:hover{background:#fbbf24;color:#111827;}
      @media(max-width:700px){.v108Gallery{padding:66px 12px 24px}.v108Nav{width:44px;height:58px;font-size:34px;background:rgba(15,23,42,.55)}.v108Nav.prev{left:6px}.v108Nav.next{right:6px}.v108GalleryStage img,.v108GalleryStage video{max-height:calc(100vh - 100px)}}`;
    document.head.appendChild(s);
  }

  function mediaItems(root){
    root = root || document.getElementById('publicReportContent') || document;
    const arr=[];
    root.querySelectorAll('img,video').forEach(el=>{
      if(el.classList.contains('brandIcon') || el.classList.contains('logo') || el.closest('.v108Gallery')) return;
      const src = el.currentSrc || el.src || el.getAttribute('data-src') || el.getAttribute('data-full') || el.getAttribute('href');
      if(!src || /^data:image\/svg/i.test(src)) return;
      arr.push({el, src, type:el.tagName==='VIDEO'?'video':'image', title: el.alt || el.title || (el.tagName==='VIDEO'?'Munkavideó':'Napló fotó')});
    });
    return arr;
  }

  let currentIndex=0;
  function ensureGallery(){
    let g=document.getElementById('v108Gallery');
    if(g) return g;
    g=document.createElement('div'); g.id='v108Gallery'; g.className='v108Gallery';
    g.innerHTML='<div class="v108GalleryTop"><div class="v108GalleryTitle" id="v108GalleryTitle">Napló fotó</div><button class="v108GalleryClose" type="button">Bezárás ×</button></div><button class="v108Nav prev" type="button" aria-label="Előző kép">‹</button><div class="v108GalleryStage" id="v108GalleryStage"></div><button class="v108Nav next" type="button" aria-label="Következő kép">›</button>';
    document.body.appendChild(g);
    g.querySelector('.v108GalleryClose').onclick=closeGallery;
    g.querySelector('.prev').onclick=(e)=>{e.stopPropagation(); show(currentIndex-1);};
    g.querySelector('.next').onclick=(e)=>{e.stopPropagation(); show(currentIndex+1);};
    g.addEventListener('click',e=>{ if(e.target===g) closeGallery(); });
    return g;
  }
  function show(i){
    const items=mediaItems(); if(!items.length) return;
    currentIndex=(i+items.length)%items.length;
    const item=items[currentIndex];
    document.getElementById('v108GalleryTitle').textContent=`${item.title} (${currentIndex+1}/${items.length})`;
    document.getElementById('v108GalleryStage').innerHTML = item.type==='video' ? `<video controls playsinline preload="auto" src="${item.src.replace(/"/g,'&quot;')}"></video>` : `<img src="${item.src.replace(/"/g,'&quot;')}" alt="${String(item.title).replace(/"/g,'&quot;')}">`;
    ensureGallery().classList.add('open'); document.body.classList.add('mediaViewerOpen');
  }
  function closeGallery(){
    const g=document.getElementById('v108Gallery');
    if(g){ g.classList.remove('open'); const st=document.getElementById('v108GalleryStage'); if(st) st.innerHTML=''; }
    document.body.classList.remove('mediaViewerOpen');
  }

  function wire(root){
    root=root||document.getElementById('publicReportContent')||document;
    // Régi/hibás linkek semmiképp ne vigyenek el az oldalról.
    root.querySelectorAll('a').forEach(a=>{
      if(a.querySelector('img,video') || a.classList.contains('reportMediaOpen')){
        a.removeAttribute('href'); a.removeAttribute('target'); a.style.cursor='zoom-in';
      }
    });
    root.querySelectorAll('img,video').forEach(el=>{
      if(el.dataset.v108==='1' || el.classList.contains('brandIcon') || el.classList.contains('logo')) return;
      el.dataset.v108='1';
      el.loading = el.loading || 'lazy';
      el.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        const items=mediaItems(root); const idx=Math.max(0, items.findIndex(x=>x.el===el));
        currentIndex=idx; ensureGallery(); show(idx);
      }, true);
    });
  }

  document.addEventListener('click', function(e){
    const a=e.target.closest && e.target.closest('#publicReportContent a');
    if(a && (a.querySelector('img,video') || a.classList.contains('reportMediaOpen'))){
      e.preventDefault(); e.stopPropagation();
      const media=a.querySelector('img,video');
      const items=mediaItems(); const idx=media ? Math.max(0, items.findIndex(x=>x.el===media)) : 0;
      ensureGallery(); show(idx);
    }
  }, true);
  document.addEventListener('keydown', function(e){
    const g=document.getElementById('v108Gallery'); if(!g || !g.classList.contains('open')) return;
    if(e.key==='Escape') closeGallery();
    if(e.key==='ArrowLeft') show(currentIndex-1);
    if(e.key==='ArrowRight') show(currentIndex+1);
  });
  window.closeV108Gallery=closeGallery;
  window.openV108Gallery=show;

  ensureHead(); css();
  const obs=new MutationObserver(()=>wire());
  if(document.body) obs.observe(document.body,{childList:true,subtree:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>wire()); else wire();
})();
