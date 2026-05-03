/* V110 clean public report: egyetlen tiszta betöltés, galéria, mentés, PDF. */
(function(){
  'use strict';
  let currentToken = '';
  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label = d => ({viewed:'Megnéztem',accepted:'Elfogadom',approved:'Elfogadom',question:'Kérdésem van'}[String(d||'').toLowerCase()] || 'Megnéztem');


  function ensureThumbCss(){
    if(document.getElementById('v112-public-thumb-css')) return;
    const st=document.createElement('style');
    st.id='v112-public-thumb-css';
    st.textContent='.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhotos,.v68ReportPhotos,.v74Photos,.v77Photos{display:grid!important;grid-template-columns:repeat(auto-fill,112px)!important;gap:10px!important;align-items:start!important;justify-content:start!important}.reportMediaTile,.v67ReportPhoto,.v74Photo,.v77Photo,.photos figure,figure.photo,.photo{width:112px!important;max-width:112px!important;min-height:132px!important;overflow:hidden!important}.reportMediaTile img,.v67ReportPhoto img,.v74Photo img,.v77Photo img,.photos img,.entryImageGrid img,.reportImageGrid img,figure img,img.reportPhoto{width:102px!important;max-width:102px!important;height:102px!important;max-height:102px!important;object-fit:cover!important;cursor:zoom-in!important}';
    document.head.appendChild(st);
  }

  function tokenFromUrl(){
    const p = new URLSearchParams(location.search);
    let t = p.get('riport') || p.get('token') || p.get('report') || p.get('id') || '';
    if(!t && location.hash){
      const h = location.hash.replace(/^#\/?/, '');
      const hp = new URLSearchParams(h.includes('=') ? h : '');
      t = hp.get('riport') || hp.get('token') || hp.get('report') || h.replace(/^riport[-/=]?/, '');
    }
    return String(t||'').trim();
  }
  function cleanupReport(root){
    if(!root) return;
    const codeRe = /function\s*\(|=>\s*\{|window\.|document\.|querySelector|addEventListener|EpitesNaploAPI|supabase|<\/script>|const\s+|let\s+|var\s+/i;
    root.querySelectorAll('script,style,.mediaViewerModal,.v74Lightbox,.v108Gallery,.v110Gallery,.reportMediaPending').forEach(el=>el.remove());
    root.querySelectorAll('*').forEach(el=>{
      [...el.attributes].forEach(a=>{ if(/^on/i.test(a.name)) el.removeAttribute(a.name); });
    });
    root.querySelectorAll('img').forEach(img=>{
      const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-full-src') || '';
      const alt = img.getAttribute('alt') || '';
      if(!src || codeRe.test(src) || codeRe.test(alt) || src.length > 2200){
        const tile = img.closest('figure,.photo,.reportMediaTile,.v67ReportPhoto,.v74Photo,.v77Photo,li,div') || img;
        tile.remove();
        return;
      }
      img.removeAttribute('srcset');
      img.loading='lazy'; img.decoding='async';
      img.style.width='102px'; img.style.maxWidth='102px'; img.style.height='102px'; img.style.maxHeight='102px'; img.style.objectFit='cover'; img.style.cursor='zoom-in';
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const bad = [];
    while(walker.nextNode()){
      const n = walker.currentNode;
      if(codeRe.test(n.textContent || '')) bad.push(n);
    }
    bad.forEach(n=>{
      const p = n.parentElement;
      if(!p) return n.remove();
      if(!p.querySelector('img,video') && p.children.length < 3) p.remove(); else n.remove();
    });
    root.querySelectorAll('*').forEach(el=>{
      const txt = (el.textContent || '').trim();
      if(txt.length > 300 && codeRe.test(txt) && !el.querySelector('img,video') && el.children.length < 4) el.remove();
    });
    root.querySelectorAll('a').forEach(a=>{
      if(a.querySelector('img,video') || /index\.html|project\.html/i.test(a.getAttribute('href')||'')){
        a.removeAttribute('href'); a.removeAttribute('target'); a.style.cursor='zoom-in';
      }
    });
    root.querySelectorAll('figure,.photo,.reportMediaTile,.v67ReportPhoto,.v74Photo,.v77Photo').forEach(t=>{
      t.style.width='112px'; t.style.maxWidth='112px'; t.style.minHeight='132px'; t.style.overflow='hidden';
    });
    root.querySelectorAll('.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhotos,.v68ReportPhotos,.v74Photos,.v77Photos').forEach(g=>{
      g.style.display='grid'; g.style.gridTemplateColumns='repeat(auto-fill,112px)'; g.style.gap='10px';
    });
    root.querySelectorAll('video').forEach(v=>{ v.controls=true; v.playsInline=true; v.preload='metadata'; });
  }

  let galleryIndex = 0;
  function mediaItems(){
    const root = $('publicReportContent') || document;
    return [...root.querySelectorAll('img,video')].filter(el=>!el.closest('.v110Gallery') && !(el.alt||'').toLowerCase().includes('ikon')).map(el=>({
      el, type:el.tagName==='VIDEO'?'video':'image', src:el.currentSrc || el.src || el.getAttribute('data-src') || '', title:el.alt || el.title || (el.tagName==='VIDEO'?'Munkavideó':'Napló fotó')
    })).filter(x=>x.src && !/^data:image\/svg/i.test(x.src));
  }
  function ensureGallery(){
    let g = $('v110Gallery'); if(g) return g;
    g = document.createElement('div'); g.id='v110Gallery'; g.className='v110Gallery';
    g.innerHTML = '<div class="v110GalleryTop"><b id="v110GalleryTitle">Napló fotó</b><button class="v110GalleryClose" type="button">Bezárás ×</button></div><button class="v110Nav prev" type="button">‹</button><div id="v110GalleryStage" class="v110GalleryStage"></div><button class="v110Nav next" type="button">›</button>';
    document.body.appendChild(g);
    g.querySelector('.v110GalleryClose').onclick = closeGallery;
    g.querySelector('.prev').onclick = e => { e.stopPropagation(); showGallery(galleryIndex-1); };
    g.querySelector('.next').onclick = e => { e.stopPropagation(); showGallery(galleryIndex+1); };
    g.addEventListener('click', e => { if(e.target === g) closeGallery(); });
    return g;
  }
  function showGallery(i){
    const items = mediaItems(); if(!items.length) return;
    galleryIndex = (i + items.length) % items.length;
    const it = items[galleryIndex];
    $('v110GalleryTitle').textContent = `${it.title} (${galleryIndex+1}/${items.length})`;
    $('v110GalleryStage').innerHTML = it.type === 'video' ? `<video controls playsinline preload="auto" src="${safe(it.src)}"></video>` : `<img src="${safe(it.src)}" alt="${safe(it.title)}">`;
    ensureGallery().classList.add('open');
  }
  function closeGallery(){ const g=$('v110Gallery'); if(g){g.classList.remove('open'); $('v110GalleryStage').innerHTML='';} }
  function wireGallery(){
    const root = $('publicReportContent'); if(!root) return;
    root.querySelectorAll('img,video').forEach(el=>{
      if(el.dataset.v110Wired) return; el.dataset.v110Wired='1';
      el.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); const items=mediaItems(); const idx=Math.max(0,items.findIndex(x=>x.el===el)); ensureGallery(); showGallery(idx); }, true);
    });
  }
  document.addEventListener('keydown', e=>{ const g=$('v110Gallery'); if(!g || !g.classList.contains('open')) return; if(e.key==='Escape') closeGallery(); if(e.key==='ArrowLeft') showGallery(galleryIndex-1); if(e.key==='ArrowRight') showGallery(galleryIndex+1); });

  async function load(){
    ensureThumbCss();
    currentToken = tokenFromUrl();
    const box = $('publicReportContent');
    if(!currentToken){ box.innerHTML = '<h2>Hiányzó riport azonosító.</h2><p>A linkből hiányzik a riport azonosító.</p>'; return; }
    try{
      const report = await window.EpitesNaploAPI.getPublicReport(currentToken);
      if(!report){ box.innerHTML = '<h2>A riport nem található vagy lejárt.</h2><p>Kérj új linket a kivitelezőtől.</p>'; return; }
      try{ await window.EpitesNaploAPI.markPublicReportOpened(currentToken); }catch(_){ }
      const html = window.EpitesNaploAPI?.sanitizeReportHtml ? window.EpitesNaploAPI.sanitizeReportHtml(report.report_html || '') : (report.report_html || '');
      box.innerHTML = '<div class="reportOpenedBox"><b>Riport megnyitva.</b><br>Az oldal csak olvasásra szolgál.</div>' + (html || '<p>A riport üres.</p>');
      try{ await window.EpitesNaploAPI.hydratePublicReportMedia(currentToken, box); }catch(e){ console.warn(e); }
      cleanupReport(box); wireGallery();
      document.title = (report.project_name ? report.project_name + ' – ' : '') + 'ÉpítésNapló ügyfélriport';
      $('approvalBox').classList.remove('hidden');
      $('approvalBox').innerHTML = `<h2>Ügyfél visszajelzés</h2><p class="muted">Válaszd ki, mit szeretnél rögzíteni. A kivitelező látni fogja a döntést és a kérdést/megjegyzést.</p><input id="clientApproveName" placeholder="Név / cég"><input id="clientApproveEmail" placeholder="Email cím (opcionális)"><textarea id="clientApproveMessage" placeholder="Megjegyzés vagy kérdés (opcionális)"></textarea><label class="checkLine"><input id="clientApproveCheck" type="checkbox"> Megtekintettem az építési napló riportot.</label><div class="approvalActionGrid"><button class="btn ghost" onclick="approveReportV110('viewed', this)">Megnéztem</button><button class="btn primary" onclick="approveReportV110('accepted', this)">Elfogadom</button><button class="btn ghost" onclick="approveReportV110('question', this)">Kérdésem van</button></div>`;
    }catch(e){ box.innerHTML = '<h2>Riport betöltési hiba</h2><p>'+safe(e.message||e)+'</p>'; }
  }

  window.approveReportV110 = async function(decision, btn){
    const name = $('clientApproveName')?.value.trim() || '';
    const email = $('clientApproveEmail')?.value.trim() || '';
    const message = $('clientApproveMessage')?.value.trim() || '';
    if(!$('clientApproveCheck')?.checked) return alert('A visszajelzéshez pipáld be a megtekintést.');
    if(decision === 'question' && !message) return alert('Kérdéshez írd be a kérdésedet vagy megjegyzésedet.');
    const buttons = [...document.querySelectorAll('#approvalBox .btn')]; const old = btn?.innerText || '';
    buttons.forEach(b=>b.disabled=true); if(btn){btn.classList.add('is-loading'); btn.innerText='Mentés folyamatban...';}
    const reportNode = $('publicReportContent');
    const clone = reportNode.cloneNode(true); cleanupReport(clone);
    const baseHtml = clone.innerHTML;
    const baseText = clone.innerText || '';
    const extra = message ? `<section class="clientFeedbackBlock" style="margin:22px 0;padding:16px 18px;border-left:5px solid #f59e0b;background:#fff7ed;border-radius:12px;color:#111827;"><h2>Ügyfél kérdése / észrevétele</h2><p style="white-space:pre-wrap;">${safe(message)}</p></section>` : '';
    try{
      await window.EpitesNaploAPI.approvePublicReport(currentToken, { name, email, decision, message, clientComment:message, reportHtml: baseHtml + extra, reportText: baseText + (message ? '\n\nÜgyfél kérdése / észrevétele:\n'+message : '') });
      $('approvalBox').innerHTML = `<div class="reportOpenedBox"><b>Visszajelzés mentve: ${safe(label(decision))}</b><br>Dátum: ${new Date().toLocaleString('hu-HU')}${message ? `<br><small>Kérdés/megjegyzés: ${safe(message)}</small>` : ''}<br><small>A kivitelező projektoldalán megjelenik.</small></div>`;
    }catch(e){ alert('Jóváhagyás mentési hiba: ' + (e.message||e)); }
    finally{ buttons.forEach(b=>b.disabled=false); if(btn){btn.classList.remove('is-loading'); if(old) btn.innerText=old;} }
  };

  async function waitImages(root){
    const imgs=[...root.querySelectorAll('img')].filter(i=>i.src);
    await Promise.all(imgs.map(img=> img.complete && img.naturalWidth>0 ? true : new Promise(res=>{img.onload=res; img.onerror=res; setTimeout(res,5000);} )));
    await new Promise(r=>setTimeout(r,250));
  }
  window.downloadPublicPdfV110 = async function(btn){
    const old=btn?.innerText||''; if(btn){btn.disabled=true;btn.classList.add('is-loading');btn.innerText='PDF készül...';}
    const stage = $('publicReportContent').cloneNode(true); cleanupReport(stage); stage.style.background='#fff'; stage.style.padding='24px'; stage.style.width='900px'; stage.style.position='fixed'; stage.style.left='-9999px'; stage.style.top='0'; document.body.appendChild(stage);
    try{ await waitImages(stage); if(window.html2pdf){ await html2pdf().set({ margin:[8,8,8,8], filename:'epitesi-naplo-ugyfelriport.pdf', image:{type:'jpeg',quality:.96}, html2canvas:{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#ffffff',imageTimeout:12000}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}, pagebreak:{mode:['css','legacy'],avoid:['img','figure','.stat','.photo']} }).from(stage).save(); } else window.print(); }
    finally{ stage.remove(); if(btn){btn.disabled=false;btn.classList.remove('is-loading');btn.innerText=old||'PDF letöltés';} }
  };
  window.copyReportLink = async function(btn){ try{ await navigator.clipboard.writeText(location.href); const old=btn.innerText; btn.innerText='Link másolva'; setTimeout(()=>btn.innerText=old,1500); }catch(_){ prompt('Másold ki a linket:', location.href); } };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
