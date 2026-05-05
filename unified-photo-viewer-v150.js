// V150 – végleges egységes képnéző: régi nézők teljes tiltása, mobil/desktop egységes megjelenés
(function(){
  'use strict';
  const SEL = [
    '.openableMedia', '.mediaTileImage img', '.entryImageGrid img', '.detailImages img',
    '#projectTimeline img', '#publicReportContent .photos img', '#publicReportContent .v121Photos img',
    '#publicReportContent .v134Photos img', '#publicReportContent .v117Photos img',
    '#publicReportContent .entryImageGrid img', '#publicReportContent .reportImageGrid img',
    '.v121Photos img', '.v134Photos img', '.photos img', '.reportImageGrid img'
  ].join(',');
  const OLD_VIEWERS = ['#mediaViewerModal','.mediaViewerModal','#v67Lightbox','.v67Lightbox','.v134Lightbox','.v121Lightbox','.v118Lightbox','.v110Gallery','.v103Lightbox','.v102Lightbox','.v100Lightbox','.v86Lightbox','.v79ReportLightbox','.v79GalleryModal','#v77Lightbox','.v77Lightbox'];
  let index=0, scale=1, tx=0, ty=0, list=[];
  let startDist=0,startScale=1,startX=0,startY=0,panX=0,panY=0,oneX=0,oneY=0,oneMoved=false;
  function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));}
  function srcOf(el){return el?.getAttribute?.('data-full-src') || el?.currentSrc || el?.src || el?.getAttribute?.('href') || '';}
  function visible(el){if(!el) return false; const r=el.getBoundingClientRect(); return r.width>8 && r.height>8 && getComputedStyle(el).display!=='none' && getComputedStyle(el).visibility!=='hidden';}
  function killOld(){try{OLD_VIEWERS.forEach(s=>document.querySelectorAll(s).forEach(el=>el.remove()));document.body.classList.remove('mediaViewerOpen');document.documentElement.classList.remove('mediaViewerOpen');}catch(_){}}
  function isGoodImg(el){
    if(!el || el.tagName!=='IMG') return false;
    if(el.closest('#v150UnifiedViewer')) return false;
    if(el.closest(OLD_VIEWERS.join(','))) return false;
    if(el.closest('.brand,header,.topbar,.top')) return false;
    if(el.classList.contains('brandIcon')) return false;
    return !!el.closest('.mediaTile,.mediaTileImage,.entryImageGrid,.detailImages,#projectTimeline,#publicReportContent,.v121Photos,.v134Photos,.v117Photos,.v67ReportPhoto,.v70PhotoBlock,.photos,.reportImageGrid,.reportMediaTile,figure');
  }
  function collect(ctx){
    let root = ctx?.closest?.('#publicReportContent') || ctx?.closest?.('#projectTimeline') || ctx?.closest?.('.entry') || document;
    let nodes=[...root.querySelectorAll(SEL)].filter(el=>isGoodImg(el)&&visible(el)&&srcOf(el));
    if(nodes.length<2) nodes=[...document.querySelectorAll(SEL)].filter(el=>isGoodImg(el)&&visible(el)&&srcOf(el));
    const seen=new Set();
    return nodes.filter(el=>{const s=srcOf(el); if(seen.has(s)) return false; seen.add(s); return true;})
      .map((el,i)=>({el,src:srcOf(el),title:el.alt || el.closest('figure')?.querySelector('figcaption')?.textContent || 'Napló fotó '+(i+1)}));
  }
  function css(){
    if(document.getElementById('v150UnifiedViewerStyle')) return;
    const st=document.createElement('style'); st.id='v150UnifiedViewerStyle'; st.textContent=`
      ${OLD_VIEWERS.join(',')}{display:none!important;visibility:hidden!important;pointer-events:none!important}
      #v150UnifiedViewer{position:fixed!important;inset:0!important;z-index:2147483646!important;background:rgba(2,6,23,.96)!important;display:none!important;color:#fff!important;font-family:Arial,Helvetica,sans-serif!important;touch-action:none!important}
      #v150UnifiedViewer.open{display:block!important}
      .v150Top{position:absolute!important;left:0!important;right:0!important;top:0!important;min-height:58px!important;background:#081225!important;color:#fff!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:9px 12px!important;box-shadow:0 8px 22px rgba(0,0,0,.3)!important;z-index:2!important}
      .v150Title{font-weight:900!important;font-size:14px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:36vw!important}.v150Btns{display:flex!important;gap:7px!important;align-items:center!important;flex-wrap:wrap!important;justify-content:flex-end!important}
      .v150Btns button,.v150Nav{border:1px solid rgba(255,255,255,.18)!important;border-radius:12px!important;background:#122038!important;color:#fff!important;font-weight:900!important;cursor:pointer!important;padding:9px 12px!important;line-height:1!important}.v150Btns button:hover,.v150Nav:hover{background:#fbbf24!important;color:#111827!important}.v150Btns .primary{background:#fbbf24!important;color:#111827!important;border-color:#fbbf24!important}
      .v150Stage{position:absolute!important;inset:58px 0 0 0!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;padding:22px 66px!important;touch-action:none!important}.v150Stage img{max-width:100%!important;max-height:100%!important;object-fit:contain!important;border-radius:14px!important;background:#000!important;box-shadow:0 22px 70px rgba(0,0,0,.42)!important;transform-origin:center center!important;will-change:transform!important;user-select:none!important;-webkit-user-select:none!important;-webkit-touch-callout:none!important}.v150Stage.full img{max-width:none!important;max-height:none!important;width:auto!important;height:auto!important}
      .v150Nav{position:absolute!important;top:50%!important;transform:translateY(-50%)!important;width:46px!important;height:72px!important;font-size:36px!important;padding:0!important;background:rgba(15,23,42,.86)!important;z-index:3!important}.v150Nav.prev{left:9px!important}.v150Nav.next{right:9px!important}body.v150Open{overflow:hidden!important}
      @media(max-width:760px){.v150Top{align-items:flex-start!important}.v150Title{font-size:12px!important;max-width:28vw!important}.v150Btns{gap:5px!important}.v150Btns button{padding:8px 9px!important;font-size:12px!important}.v150Stage{padding:18px 8px!important}.v150Nav{width:38px!important;height:58px!important;font-size:31px!important;opacity:.92}.v150Nav.prev{left:4px!important}.v150Nav.next{right:4px!important}}
      @media print{#v150UnifiedViewer{display:none!important}.mediaTile,.v121Photo,.v134Photo,#publicReportContent figure{break-inside:avoid!important;page-break-inside:avoid!important}}
    `; document.head.appendChild(st);
  }
  function viewer(){killOld();css();let v=document.getElementById('v150UnifiedViewer'); if(v) return v; v=document.createElement('div');v.id='v150UnifiedViewer';v.innerHTML='<div class="v150Top"><div id="v150Title" class="v150Title">Napló fotó</div><div class="v150Btns"><button type="button" data-act="minus">−</button><button type="button" data-act="plus">+</button><button type="button" data-act="reset">100%</button><button class="primary" type="button" data-act="full">Teljes kép</button><button type="button" data-act="close">Bezárás</button></div></div><button type="button" class="v150Nav prev">‹</button><div id="v150Stage" class="v150Stage"></div><button type="button" class="v150Nav next">›</button>';document.body.appendChild(v);v.querySelector('.prev').onclick=e=>{e.stopPropagation();show(index-1)};v.querySelector('.next').onclick=e=>{e.stopPropagation();show(index+1)};v.querySelector('[data-act="close"]').onclick=close;v.querySelector('[data-act="minus"]').onclick=()=>setScale(scale-.35);v.querySelector('[data-act="plus"]').onclick=()=>setScale(scale+.35);v.querySelector('[data-act="reset"]').onclick=()=>{scale=1;tx=0;ty=0;stage().classList.remove('full');apply()};v.querySelector('[data-act="full"]').onclick=()=>{stage().classList.toggle('full');if(stage().classList.contains('full'))setScale(Math.max(1.35,scale));else{scale=1;tx=0;ty=0;apply()}};v.addEventListener('click',e=>{ if(e.target.closest('img')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }}, true);v.addEventListener('wheel',e=>{if(!v.classList.contains('open'))return;e.preventDefault();setScale(scale+(e.deltaY<0?.25:-.25))},{passive:false});v.addEventListener('touchstart',touchStart,{passive:false});v.addEventListener('touchmove',touchMove,{passive:false});v.addEventListener('touchend',touchEnd,{passive:false});return v;}
  function stage(){return document.getElementById('v150Stage')}
  function apply(){const img=stage()?.querySelector('img'); if(img) img.style.transform=`translate3d(${tx}px,${ty}px,0) scale(${scale})`;}
  function setScale(s){scale=Math.max(1,Math.min(6,s)); if(scale===1){tx=0;ty=0} apply();}
  function show(i,ctx){killOld(); if(ctx) list=collect(ctx); if(!list.length) list=collect(document); if(!list.length) return; index=(i+list.length)%list.length; scale=1;tx=0;ty=0;const it=list[index],v=viewer();document.getElementById('v150Title').textContent=(it.title||'Napló fotó')+' ('+(index+1)+'/'+list.length+')';stage().classList.remove('full');stage().innerHTML='<img src="'+esc(it.src)+'" alt="'+esc(it.title||'Napló fotó')+'">';v.classList.add('open');document.body.classList.add('v150Open');}
  function close(){const v=document.getElementById('v150UnifiedViewer'); if(v){v.classList.remove('open'); const st=stage(); if(st) st.innerHTML='';} document.body.classList.remove('v150Open');}
  function dist(a,b){const dx=a.clientX-b.clientX,dy=a.clientY-b.clientY; return Math.sqrt(dx*dx+dy*dy)} function mid(a,b){return{x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2}}
  function touchStart(e){if(!e.currentTarget.classList.contains('open'))return;if(e.touches.length===2){e.preventDefault();startDist=dist(e.touches[0],e.touches[1]);startScale=scale;const m=mid(e.touches[0],e.touches[1]);startX=m.x;startY=m.y;panX=tx;panY=ty}else if(e.touches.length===1){oneX=e.touches[0].clientX;oneY=e.touches[0].clientY;panX=tx;panY=ty;oneMoved=false}}
  function touchMove(e){if(!e.currentTarget.classList.contains('open'))return;if(e.touches.length===2){e.preventDefault();const d=dist(e.touches[0],e.touches[1]),m=mid(e.touches[0],e.touches[1]);scale=Math.max(1,Math.min(6,startScale*(d/Math.max(1,startDist))));tx=panX+(m.x-startX);ty=panY+(m.y-startY);if(scale===1){tx=0;ty=0}apply()}else if(e.touches.length===1){const dx=e.touches[0].clientX-oneX,dy=e.touches[0].clientY-oneY;if(Math.abs(dx)>8||Math.abs(dy)>8)oneMoved=true;if(scale>1){e.preventDefault();tx=panX+dx;ty=panY+dy;apply()}}}
  function touchEnd(e){if(!e.currentTarget.classList.contains('open'))return;if(scale<=1&&oneMoved){const dx=(e.changedTouches[0]?.clientX||oneX)-oneX;if(Math.abs(dx)>70)show(index+(dx<0?1:-1))}}
  function openImg(img){list=collect(img); const s=srcOf(img); const i=Math.max(0,list.findIndex(x=>x.src===s)); show(i,img);}
  document.addEventListener('click',function(e){let img=e.target?.closest?.(SEL);const btn=e.target?.closest?.('.mediaExpandBtn,.v67ReportPhotoOpen,[onclick*="openMediaViewer"],[onclick*="openMediaViewerFromTile"],[onclick*="openReportMediaLink"]');if(btn&&!img){const tile=btn.closest('.mediaTile,.reportMediaTile,.v121Photo,.v134Photo,.v67ReportPhoto,figure,.photos,.v70PhotoBlock');img=tile?.querySelector?.('img')}if(!img||!isGoodImg(img))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();killOld();openImg(img)},true);
  document.addEventListener('keydown',function(e){const v=document.getElementById('v150UnifiedViewer');if(!v?.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')show(index-1);if(e.key==='ArrowRight')show(index+1);if(e.key==='+'||e.key==='=')setScale(scale+.35);if(e.key==='-')setScale(scale-.35)});
  function install(){window.openMediaViewer=function(src,type,title){if(type==='video')return false;killOld();const found=[...document.querySelectorAll(SEL)].find(el=>srcOf(el)===src);if(found)openImg(found);else{list=[{src,title:title||'Napló fotó'}];show(0,document)}return false};window.openMediaViewerFromTile=function(button,type,title){const img=button?.closest?.('.mediaTile,.reportMediaTile,figure,.v121Photo,.v134Photo,.v67ReportPhoto,.photos,.v70PhotoBlock')?.querySelector?.('img');if(img)openImg(img);return false};window.openReportMediaLink=function(event,link){if(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation&&event.stopImmediatePropagation()}const img=link?.closest?.('.reportMediaTile,.mediaTile,figure,.v121Photo,.v134Photo,.v67ReportPhoto,.photos,.v70PhotoBlock')?.querySelector?.('img');if(img)openImg(img);return false};window.closeMediaViewer=close;window.EpitesNaploOpenPhotoV140=window.EpitesNaploOpenPhotoV141=window.EpitesNaploOpenPhotoV142=function(src,title){return window.openMediaViewer(src,'image',title||'Napló fotó')}}
  install(); css(); killOld(); [0,50,200,700,1500,3000,6000].forEach(ms=>setTimeout(()=>{install();killOld();},ms));
  try{new MutationObserver(()=>killOld()).observe(document.documentElement,{childList:true,subtree:true});}catch(_){}
})();
