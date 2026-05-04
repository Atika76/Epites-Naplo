// V140 – egységes, iPhone/Safari kompatibilis képnéző minden oldalon
// Cél: a projektoldalon is ugyanaz a lapozható/nagyítható nézet legyen, mint az ügyfélriportban.
(function(){
  'use strict';
  const SEL = [
    '.openableMedia',
    '.mediaTileImage img',
    '.entryImageGrid img',
    '.detailImages img',
    '#projectTimeline img',
    '#publicReportContent .photos img',
    '#publicReportContent .v121Photos img',
    '#publicReportContent .v134Photos img',
    '#publicReportContent .v117Photos img',
    '#publicReportContent .entryImageGrid img',
    '#publicReportContent .reportImageGrid img',
    '.v121Photos img',
    '.v134Photos img',
    '.photos img'
  ].join(',');
  let index = 0, scale = 1, tx = 0, ty = 0;
  let startDist = 0, startScale = 1, startX = 0, startY = 0, panX = 0, panY = 0;
  let oneStartX = 0, oneStartY = 0, oneMoved = false;
  let wheelReady = false;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function isVisible(el){
    if(!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  }
  function srcOf(el){ return el?.currentSrc || el?.src || el?.getAttribute?.('data-full-src') || el?.getAttribute?.('href') || ''; }
  function isReportOrTimelineImage(el){
    if(!el || el.tagName !== 'IMG') return false;
    if(el.closest('#v140UnifiedViewer')) return false;
    if(el.closest('.brand') || el.closest('header') || el.closest('.topbar') || el.closest('.top')) return false;
    if(el.classList.contains('brandIcon')) return false;
    return !!el.closest('.mediaTile,.entryImageGrid,.detailImages,#projectTimeline,#publicReportContent,.v121Photos,.v134Photos,.photos,.reportImageGrid,.v117Photos');
  }
  function mediaList(context){
    let root = context?.closest?.('#publicReportContent') || context?.closest?.('#projectTimeline') || document;
    let nodes = Array.from(root.querySelectorAll(SEL)).filter(el => el.tagName === 'IMG' && isVisible(el) && srcOf(el) && isReportOrTimelineImage(el));
    // ismétlődő képek kiszűrése csak ugyanazon listán belül; ha ugyanaz a fotó kétszer külön bejegyzésben van, az első marad.
    const seen = new Set();
    nodes = nodes.filter(el => { const s = srcOf(el); if(seen.has(s)) return false; seen.add(s); return true; });
    return nodes.map((el,i) => ({ el, src: srcOf(el), title: el.alt || el.closest('figure')?.querySelector('figcaption')?.textContent || 'Napló fotó '+(i+1) }));
  }
  function ensureCss(){
    if(document.getElementById('v140UnifiedViewerStyle')) return;
    const st = document.createElement('style');
    st.id = 'v140UnifiedViewerStyle';
    st.textContent = `
      #v140UnifiedViewer{position:fixed;inset:0;z-index:2147483000;background:rgba(2,6,23,.88);display:none;color:#fff;font-family:Arial,Helvetica,sans-serif;touch-action:none}
      #v140UnifiedViewer.open{display:block}
      .v140Top{position:absolute;left:0;right:0;top:0;min-height:58px;background:#081225;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;box-shadow:0 8px 22px rgba(0,0,0,.28);z-index:5}
      .v140Title{font-weight:900;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:36vw}.v140Btns{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      .v140Btns button,.v140Nav{border:1px solid rgba(255,255,255,.16);border-radius:12px;background:#122038;color:#fff;font-weight:900;cursor:pointer;padding:9px 12px;line-height:1}.v140Btns button:hover,.v140Nav:hover{background:#fbbf24;color:#111827}.v140Btns .primary{background:#fbbf24;color:#111827;border-color:#fbbf24}
      .v140Stage{position:absolute;inset:58px 0 0 0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:22px 66px;touch-action:none}.v140Stage img{max-width:100%;max-height:100%;object-fit:contain;border-radius:14px;background:#000;box-shadow:0 22px 70px rgba(0,0,0,.42);transform-origin:center center;will-change:transform;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}.v140Stage.full img{max-width:none;max-height:none;width:auto;height:auto}
      .v140Nav{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:72px;font-size:36px;padding:0;z-index:4;background:rgba(15,23,42,.74)}.v140Nav.prev{left:9px}.v140Nav.next{right:9px}
      body.v140Open{overflow:hidden!important}
      @media(max-width:760px){.v140Top{align-items:flex-start}.v140Title{max-width:28vw;font-size:12px}.v140Btns{gap:5px}.v140Btns button{padding:8px 9px;font-size:12px}.v140Stage{padding:18px 8px}.v140Nav{width:38px;height:58px;font-size:31px;opacity:.92}.v140Nav.prev{left:4px}.v140Nav.next{right:4px}}
      @media print{#v140UnifiedViewer{display:none!important}.mediaTile,.v121Photo,.v134Photo,#publicReportContent figure{break-inside:avoid!important;page-break-inside:avoid!important}}
    `;
    document.head.appendChild(st);
  }
  function viewer(){
    ensureCss();
    let v = document.getElementById('v140UnifiedViewer');
    if(v) return v;
    v = document.createElement('div');
    v.id = 'v140UnifiedViewer';
    v.innerHTML = '<div class="v140Top"><div id="v140Title" class="v140Title">Napló fotó</div><div class="v140Btns"><button type="button" data-act="minus">−</button><button type="button" data-act="plus">+</button><button type="button" data-act="reset">100%</button><button class="primary" type="button" data-act="full">Teljes kép</button><button type="button" data-act="close">Bezárás</button></div></div><button type="button" class="v140Nav prev">‹</button><div id="v140Stage" class="v140Stage"></div><button type="button" class="v140Nav next">›</button>';
    document.body.appendChild(v);
    v.querySelector('.prev').onclick = e => { e.stopPropagation(); show(index-1); };
    v.querySelector('.next').onclick = e => { e.stopPropagation(); show(index+1); };
    v.querySelector('[data-act="close"]').onclick = close;
    v.querySelector('[data-act="minus"]').onclick = () => setScale(scale - .35);
    v.querySelector('[data-act="plus"]').onclick = () => setScale(scale + .35);
    v.querySelector('[data-act="reset"]').onclick = () => { scale=1; tx=0; ty=0; fitMode(false); apply(); };
    v.querySelector('[data-act="full"]').onclick = () => { fitMode(!document.getElementById('v140Stage').classList.contains('full')); if(document.getElementById('v140Stage').classList.contains('full')) setScale(Math.max(scale,1.35)); else {scale=1;tx=0;ty=0;} apply(); };
    v.addEventListener('wheel', e => { if(!v.classList.contains('open')) return; e.preventDefault(); setScale(scale + (e.deltaY < 0 ? .25 : -.25)); }, {passive:false});
    v.addEventListener('touchstart', onTouchStart, {passive:false});
    v.addEventListener('touchmove', onTouchMove, {passive:false});
    v.addEventListener('touchend', onTouchEnd, {passive:false});
    return v;
  }
  function fitMode(on){ const st=document.getElementById('v140Stage'); if(st) st.classList.toggle('full', !!on); }
  function apply(){ const img = document.querySelector('#v140Stage img'); if(img) img.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${scale})`; }
  function setScale(s){ scale = Math.max(1, Math.min(6, s)); if(scale === 1){ tx=0; ty=0; } apply(); }
  function show(i, context){
    const list = mediaList(context || document);
    if(!list.length) return;
    index = (i + list.length) % list.length;
    const item = list[index];
    scale = 1; tx = 0; ty = 0;
    const v = viewer();
    document.getElementById('v140Title').textContent = (item.title || 'Napló fotó') + ' ('+(index+1)+'/'+list.length+')';
    const stage = document.getElementById('v140Stage');
    stage.classList.remove('full');
    stage.innerHTML = '<img src="'+esc(item.src)+'" alt="'+esc(item.title || 'Napló fotó')+'">';
    v.classList.add('open');
    document.body.classList.add('v140Open');
  }
  function close(){
    const v = document.getElementById('v140UnifiedViewer');
    if(v){ v.classList.remove('open'); const st=document.getElementById('v140Stage'); if(st) st.innerHTML=''; }
    document.body.classList.remove('v140Open');
  }
  function dist(a,b){ const dx=a.clientX-b.clientX, dy=a.clientY-b.clientY; return Math.sqrt(dx*dx+dy*dy); }
  function mid(a,b){ return {x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2}; }
  function onTouchStart(e){
    if(!e.currentTarget.classList.contains('open')) return;
    if(e.touches.length === 2){ e.preventDefault(); startDist=dist(e.touches[0],e.touches[1]); startScale=scale; const m=mid(e.touches[0],e.touches[1]); startX=m.x; startY=m.y; panX=tx; panY=ty; }
    else if(e.touches.length === 1){ oneStartX=e.touches[0].clientX; oneStartY=e.touches[0].clientY; panX=tx; panY=ty; oneMoved=false; }
  }
  function onTouchMove(e){
    if(!e.currentTarget.classList.contains('open')) return;
    if(e.touches.length === 2){ e.preventDefault(); const d=dist(e.touches[0],e.touches[1]); const m=mid(e.touches[0],e.touches[1]); scale=Math.max(1,Math.min(6,startScale*(d/Math.max(1,startDist)))); tx=panX+(m.x-startX); ty=panY+(m.y-startY); if(scale===1){tx=0;ty=0;} apply(); }
    else if(e.touches.length === 1){ const dx=e.touches[0].clientX-oneStartX, dy=e.touches[0].clientY-oneStartY; if(Math.abs(dx)>8||Math.abs(dy)>8) oneMoved=true; if(scale>1){ e.preventDefault(); tx=panX+dx; ty=panY+dy; apply(); } }
  }
  function onTouchEnd(e){
    if(!e.currentTarget.classList.contains('open')) return;
    if(scale <= 1 && oneMoved){ const dx=(e.changedTouches[0]?.clientX||oneStartX)-oneStartX; if(Math.abs(dx)>70) show(index + (dx<0?1:-1)); }
  }
  function openForElement(img){
    const list = mediaList(img);
    const s = srcOf(img);
    const i = Math.max(0, list.findIndex(x => x.src === s));
    show(i, img);
  }

  document.addEventListener('click', function(e){
    const img = e.target && e.target.closest && e.target.closest(SEL);
    if(!img || img.tagName !== 'IMG' || !isReportOrTimelineImage(img)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    openForElement(img);
  }, true);

  document.addEventListener('keydown', function(e){
    const v = document.getElementById('v140UnifiedViewer');
    if(!v || !v.classList.contains('open')) return;
    if(e.key === 'Escape') close();
    if(e.key === 'ArrowLeft') show(index-1);
    if(e.key === 'ArrowRight') show(index+1);
    if(e.key === '+' || e.key === '=') setScale(scale+.35);
    if(e.key === '-') setScale(scale-.35);
  });

  // Régi projektes openMediaViewer felülírása: ugyanaz a szép néző jöjjön fel, ne új/üres oldal.
  window.openMediaViewer = function(src, type, title){
    if(type === 'video') return false;
    const existing = Array.from(document.querySelectorAll(SEL)).find(el => srcOf(el) === src);
    if(existing) openForElement(existing); else { ensureCss(); const temp = {src, title:title||'Napló fotó'}; const v=viewer(); index=0; scale=1;tx=0;ty=0;document.getElementById('v140Title').textContent=temp.title+' (1/1)';document.getElementById('v140Stage').innerHTML='<img src="'+esc(temp.src)+'" alt="'+esc(temp.title)+'">';v.classList.add('open');document.body.classList.add('v140Open'); }
    return false;
  };
  window.closeMediaViewer = close;
  window.EpitesNaploOpenPhotoV140 = function(src, title){ window.openMediaViewer(src, 'image', title || 'Napló fotó'); };
})();
