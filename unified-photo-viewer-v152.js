// ÉpítésNapló AI PRO - V152 egységes képnéző
(function(){
  'use strict';
  if (window.__EpitesNaploUnifiedPhotoViewerV152) return;
  window.__EpitesNaploUnifiedPhotoViewerV152 = true;

  const SEL = '.openableMedia,img.reportPhoto,.photos img,.entryImageGrid img,.reportImageGrid img,.detailImages img,.v74Photos img,.v68ReportPhotos img,.v67ReportPhoto img,.v121Photo img,.v134Photo img,.mediaTile img,.reportMediaTile img,figure img,[data-full-src]';
  const OLD = '#mediaViewerModal,.mediaViewerModal,#v67Lightbox,.v67Lightbox,.v134Lightbox,.v121Lightbox,.v118Lightbox,.v110Gallery,.v103Lightbox,.v102Lightbox,.v100Lightbox,.v86Lightbox,.v79ReportLightbox,.v79GalleryModal,#v77Lightbox,.v77Lightbox,.v74Lightbox,.v150ReportViewer';
  let list = [], index = 0, scale = 1, tx = 0, ty = 0, drag = false, sx = 0, sy = 0;

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function killOld(){try{document.querySelectorAll(OLD).forEach(el=>el.remove());document.body.classList.remove('mediaViewerOpen');document.documentElement.classList.remove('mediaViewerOpen');}catch(_){}}
  function srcOf(el){return el?.getAttribute?.('data-full-src') || el?.getAttribute?.('href') || el?.currentSrc || el?.src || '';}
  function good(el){ if(!el || el.closest('#v152UnifiedViewer')) return false; if(el.tagName==='VIDEO') return false; const s=srcOf(el); if(!s || s.startsWith('blob:')) return false; const r=el.getBoundingClientRect?.(); return !r || (r.width>8 && r.height>8); }
  function collect(ctx){
    const root = ctx?.closest?.('.timelineEntry,.entry,.v133Entry,.publicReportCard,.doc,.reportDoc,section') || document;
    let nodes = [...root.querySelectorAll(SEL)].filter(good);
    if(nodes.length < 2) nodes = [...document.querySelectorAll(SEL)].filter(good);
    const seen = new Set();
    return nodes.filter(el=>{const s=srcOf(el); if(seen.has(s)) return false; seen.add(s); return true;})
      .map((el,i)=>({el, src:srcOf(el), title:el.alt || el.closest('figure')?.querySelector('figcaption')?.textContent || 'Napló fotó '+(i+1)}));
  }
  function css(){ if(document.getElementById('v152UnifiedViewerCss')) return; const st=document.createElement('style'); st.id='v152UnifiedViewerCss'; st.textContent=`
    body.v152Open{overflow:hidden!important}
    #v152UnifiedViewer{position:fixed;inset:0;background:rgba(2,6,23,.90);z-index:2147483647;display:none;color:#fff;font-family:Arial,Helvetica,sans-serif;overscroll-behavior:contain;touch-action:none}
    #v152UnifiedViewer.open{display:block}
    #v152UnifiedViewer .v152Top{position:absolute;left:0;right:0;top:0;min-height:56px;background:#0f172a;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;box-sizing:border-box;z-index:5}
    #v152UnifiedViewer .v152Title{font-weight:900;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff}
    #v152UnifiedViewer .v152Btns{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
    #v152UnifiedViewer button{border:1px solid rgba(255,255,255,.25);background:#172033;color:#fff;border-radius:10px;padding:8px 10px;font-weight:900;cursor:pointer}
    #v152UnifiedViewer button.primary{background:#fbbf24;color:#111827;border-color:#fbbf24}
    #v152UnifiedViewer .v152Stage{position:absolute;inset:56px 0 0 0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:16px;box-sizing:border-box;touch-action:none}
    #v152UnifiedViewer .v152Stage img{max-width:88vw;max-height:calc(100vh - 106px);object-fit:contain;border-radius:12px;box-shadow:0 20px 70px rgba(0,0,0,.55);transition:transform .08s ease;user-select:none;-webkit-user-drag:none;cursor:grab}
    #v152UnifiedViewer .v152Stage.full img{max-width:none;max-height:none}
    #v152UnifiedViewer .v152Nav{position:absolute;top:50%;transform:translateY(-50%);z-index:6;font-size:32px;border-radius:14px;padding:10px 14px;background:#111827dd}
    #v152UnifiedViewer .v152Nav.prev{left:10px}#v152UnifiedViewer .v152Nav.next{right:10px}
    ${OLD}{display:none!important;visibility:hidden!important;pointer-events:none!important}
    @media(max-width:720px){#v152UnifiedViewer .v152Top{align-items:flex-start;min-height:74px}#v152UnifiedViewer .v152Stage{inset:74px 0 0 0}#v152UnifiedViewer .v152Stage img{max-width:92vw;max-height:calc(100vh - 134px)}#v152UnifiedViewer .v152Nav{font-size:24px;padding:8px 12px}#v152UnifiedViewer .v152Title{max-width:38vw}}
  `; document.head.appendChild(st); }
  function viewer(){ killOld(); css(); let v=document.getElementById('v152UnifiedViewer'); if(v) return v; v=document.createElement('div'); v.id='v152UnifiedViewer'; v.innerHTML=`<div class="v152Top"><div id="v152ViewerTitle" class="v152Title">Napló fotó</div><div class="v152Btns"><button type="button" data-a="minus">−</button><button type="button" data-a="plus">+</button><button type="button" data-a="reset">100%</button><button class="primary" type="button" data-a="full">Teljes kép</button><button type="button" data-a="close">Bezárás</button></div></div><button type="button" class="v152Nav prev">‹</button><div id="v152Stage" class="v152Stage"></div><button type="button" class="v152Nav next">›</button>`; document.body.appendChild(v); v.querySelector('.prev').onclick=e=>{e.stopPropagation();show(index-1)}; v.querySelector('.next').onclick=e=>{e.stopPropagation();show(index+1)}; v.querySelector('[data-a="close"]').onclick=close; v.querySelector('[data-a="minus"]').onclick=()=>setScale(scale-.25); v.querySelector('[data-a="plus"]').onclick=()=>setScale(scale+.25); v.querySelector('[data-a="reset"]').onclick=()=>{scale=1;tx=0;ty=0;stage().classList.remove('full');apply()}; v.querySelector('[data-a="full"]').onclick=()=>{stage().classList.toggle('full');scale=stage().classList.contains('full')?Math.max(1.35,scale):1;tx=0;ty=0;apply()}; v.addEventListener('wheel',e=>{if(!v.classList.contains('open'))return;e.preventDefault();setScale(scale+(e.deltaY<0?.2:-.2))},{passive:false}); stage().addEventListener('pointerdown',e=>{drag=true;sx=e.clientX-tx;sy=e.clientY-ty;stage().setPointerCapture?.(e.pointerId)}); stage().addEventListener('pointermove',e=>{if(!drag)return;tx=e.clientX-sx;ty=e.clientY-sy;apply()}); stage().addEventListener('pointerup',()=>drag=false); return v; }
  function stage(){return document.getElementById('v152Stage');}
  function apply(){const img=stage()?.querySelector('img'); if(img) img.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;}
  function setScale(n){scale=Math.max(.5,Math.min(5,n));apply();}
  function close(){const v=document.getElementById('v152UnifiedViewer'); if(v)v.classList.remove('open'); document.body.classList.remove('v152Open');}
  function show(i, ctx){killOld(); if(ctx) list=collect(ctx); if(!list.length) list=collect(document); if(!list.length) return false; index=(i+list.length)%list.length; scale=1;tx=0;ty=0; const it=list[index]; const v=viewer(); document.getElementById('v152ViewerTitle').textContent=(it.title||'Napló fotó')+' ('+(index+1)+'/'+list.length+')'; stage().classList.remove('full'); stage().innerHTML='<img src="'+esc(it.src)+'" alt="'+esc(it.title||'Napló fotó')+'">'; v.classList.add('open'); document.body.classList.add('v152Open'); return false; }
  function openEl(el){ if(!good(el)) return false; list=collect(el); const s=srcOf(el); const i=list.findIndex(x=>x.src===s); return show(i<0?0:i,el); }
  function openBySrc(src,title){ if(!src) return false; const found=[...document.querySelectorAll(SEL)].find(el=>srcOf(el)===src); if(found) return openEl(found); list=[{src,title:title||'Napló fotó'}]; return show(0,document); }
  document.addEventListener('click',function(e){ const btn=e.target?.closest?.('.mediaExpandBtn,.v67ReportPhotoOpen,.v74Photo,[data-v77-img],[onclick*="openMediaViewer"],[onclick*="openMediaViewerFromTile"],[onclick*="openReportMediaLink"],[onclick*="v74OpenReportPhoto"],[onclick*="v77"],[onclick*="Lightbox"]'); let img=e.target?.closest?.(SEL); if(btn && !img) img=btn.closest?.('.mediaTile,.reportMediaTile,figure,.v121Photo,.v134Photo,.v67ReportPhoto,.photos,.v70PhotoBlock')?.querySelector?.('img'); if(!img || img.closest('#v152UnifiedViewer')) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); killOld(); openEl(img); }, true);
  document.addEventListener('keydown',function(e){const v=document.getElementById('v152UnifiedViewer'); if(!v?.classList.contains('open'))return; if(e.key==='Escape')close(); if(e.key==='ArrowRight')show(index+1); if(e.key==='ArrowLeft')show(index-1);});
  function install(){ window.EpitesNaploUnifiedPhotoViewer={openEl,openBySrc,show,close,killOld}; window.openMediaViewer=function(src,type,title){ if(type==='video'){ if(src) window.open(src,'_blank','noopener'); return false;} return openBySrc(src,title||'Napló fotó');}; window.openMediaViewerFromTile=function(button,type,title){ if(type==='video'){ const v=button?.closest?.('.mediaTile,.reportMediaTile,figure')?.querySelector?.('video'); const s=v?.currentSrc||v?.src||button?.dataset?.src||''; if(s) window.open(s,'_blank','noopener'); return false;} const img=button?.closest?.('.mediaTile,.reportMediaTile,figure,.v121Photo,.v134Photo,.v67ReportPhoto,.photos,.v70PhotoBlock')?.querySelector?.('img'); return img?openEl(img):false;}; window.openReportMediaLink=function(event,link){event?.preventDefault?.();event?.stopPropagation?.();event?.stopImmediatePropagation?.(); const img=link?.querySelector?.('img')||link?.closest?.('figure,.photo,.v67ReportPhoto,.v74Photo,.mediaTile,.reportMediaTile')?.querySelector?.('img'); return img?openEl(img):openBySrc(link?.href,'Napló fotó');}; window.v74OpenReportPhoto=window.v77OpenPhoto=window.v86OpenPhoto=window.v100OpenPhoto=function(src){return openBySrc(src,'Napló fotó')}; }
  install(); setTimeout(install,300); setTimeout(install,1500); new MutationObserver(killOld).observe(document.documentElement,{childList:true,subtree:true}); setInterval(killOld,1000);
})();
