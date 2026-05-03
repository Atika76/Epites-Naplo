/* V117 clean public report: tiszta HTML megjelenítés, kisképek, galéria, PDF, visszajelzés. */
(function(){
  'use strict';
  let currentToken = '';
  let galleryIndex = 0;
  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label = d => ({viewed:'Megnéztem',accepted:'Elfogadom',approved:'Elfogadom',question:'Kérdésem van'}[String(d||'').toLowerCase()] || 'Megnéztem');

  function tokenFromUrl(){
    const p = new URLSearchParams(location.search);
    return String(p.get('riport') || p.get('token') || p.get('report') || p.get('id') || '').trim();
  }
  function decodeMaybeEscapedHtml(html){
    let s = String(html || '');
    if(!s.trim()) return '';
    const lt = (s.match(/&lt;/g)||[]).length;
    const tags = (s.match(/<\/?[a-z][\s>]/ig)||[]).length;
    if(lt > tags){
      const ta = document.createElement('textarea'); ta.innerHTML = s; s = ta.value;
    }
    return s;
  }
  function stripBadCodeText(root){
    const codeRe = /function\s*\(|=>\s*\{|window\.|document\.|querySelector|addEventListener|EpitesNaploAPI|supabase|<\/script>|const\s+|let\s+|var\s+/i;
    root.querySelectorAll('script,noscript,template,.mediaViewerModal,.v74Lightbox,.v108Gallery,.v110Gallery,.reportMediaPending').forEach(el=>el.remove());
    root.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{ if(/^on/i.test(a.name)) el.removeAttribute(a.name); }));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const bad=[];
    while(walker.nextNode()){
      const n=walker.currentNode; const txt=(n.textContent||'').trim();
      if(txt.length>40 && codeRe.test(txt)) bad.push(n);
    }
    bad.forEach(n=>n.remove());
  }
  function normalizeReportHtml(html){
    let s = decodeMaybeEscapedHtml(html);
    if(!s.trim()) return '<p>A riport üres.</p>';
    const parsed = new DOMParser().parseFromString(s, 'text/html');
    let body = parsed.body || parsed;
    stripBadCodeText(body);
    body.querySelectorAll('style').forEach(st=>{
      const txt=st.textContent||'';
      if(/body|\.entry|\.stats|\.photos|table|h1/i.test(txt)) return;
      st.remove();
    });
    body.querySelectorAll('a').forEach(a=>{ if(a.querySelector('img,video') || /index\.html|project\.html/i.test(a.getAttribute('href')||'')){ a.removeAttribute('href'); a.removeAttribute('target'); } });
    body.querySelectorAll('img').forEach(img=>{
      const alt=(img.getAttribute('alt')||'').toLowerCase();
      if(alt.includes('ikon')) return;
      const src = img.getAttribute('src') || img.getAttribute('data-full-src') || img.getAttribute('data-src') || '';
      if(/^\s*(function|window\.|document\.|const\s|let\s|var\s)/i.test(src) || src.length > 5000){ img.closest('figure,.photo,.reportMediaTile,.v67ReportPhoto,div')?.remove(); return; }
      img.setAttribute('loading','lazy'); img.setAttribute('decoding','async');
    });
    return body.innerHTML || s;
  }
  function reportTextExpectedCount(root){
    const txt = (root.innerText || '');
    const m = txt.match(/(\d+)\s*fot[óo]/i);
    return m ? Number(m[1]) : 0;
  }
  function imageCount(root){ return [...root.querySelectorAll('img')].filter(img=>!img.closest('.v110Gallery') && !(img.alt||'').toLowerCase().includes('ikon') && !/favicon/i.test(img.src||'')).length; }
  function mediaItems(){
    const root = $('publicReportContent') || document;
    return [...root.querySelectorAll('img,video')].filter(el=>!el.closest('.v110Gallery') && !(el.alt||'').toLowerCase().includes('ikon')).map(el=>({
      el, type:el.tagName==='VIDEO'?'video':'image', src:el.currentSrc || el.src || el.getAttribute('data-src') || el.getAttribute('data-full-src') || '', title:el.alt || el.title || (el.tagName==='VIDEO'?'Munkavideó':'Napló fotó')
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
    const it = items[galleryIndex]; ensureGallery();
    $('v110GalleryTitle').textContent = `${it.title} (${galleryIndex+1}/${items.length})`;
    $('v110GalleryStage').innerHTML = it.type === 'video' ? `<video controls playsinline preload="auto" src="${safe(it.src)}"></video>` : `<img src="${safe(it.src)}" alt="${safe(it.title)}">`;
    $('v110Gallery').classList.add('open');
  }
  function closeGallery(){ const g=$('v110Gallery'); if(g){g.classList.remove('open'); $('v110GalleryStage').innerHTML='';} }
  function wireGallery(){
    const root = $('publicReportContent'); if(!root) return;
    root.querySelectorAll('img,video').forEach(el=>{
      if(el.dataset.v110Wired) return; el.dataset.v110Wired='1';
      el.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); const items=mediaItems(); const idx=Math.max(0,items.findIndex(x=>x.el===el)); showGallery(idx); }, true);
    });
  }
  document.addEventListener('keydown', e=>{ const g=$('v110Gallery'); if(!g || !g.classList.contains('open')) return; if(e.key==='Escape') closeGallery(); if(e.key==='ArrowLeft') showGallery(galleryIndex-1); if(e.key==='ArrowRight') showGallery(galleryIndex+1); });

  async function injectMissingPublicImages(report){
    const root = $('publicReportContent'); if(!root) return;
    const expected = reportTextExpectedCount(root);
    if(expected && imageCount(root) >= expected) return;
    let media=[];
    try{ media = await window.EpitesNaploAPI?.getPublicReportAllMedia?.(currentToken) || []; }catch(e){ console.warn('Publikus média lekérés nem sikerült:', e); }
    let images = (media || []).filter(x => String(x.type||'image').toLowerCase().startsWith('image') && (x.url || x.signedUrl || x.publicUrl)).map(x => x.url || x.signedUrl || x.publicUrl);
    images = [...new Set(images.filter(Boolean))];
    if(!images.length) return;
    const html = `<div class="photos v117Photos">${images.map((url,i)=>`<figure class="v67ReportPhoto"><img src="${safe(url)}" alt="Napló fotó ${i+1}" loading="lazy" decoding="async"><figcaption>Nagyítás</figcaption></figure>`).join('')}</div>`;
    let target = [...root.querySelectorAll('h2,h3,h4,p')].reverse().find(el => /munka közben|fot[oó]dokument|dokumentáció|kattints/i.test(el.textContent || ''));
    if(target) target.insertAdjacentHTML('afterend', html); else root.insertAdjacentHTML('beforeend', `<h3>Munka közben / dokumentáció</h3><p>Kattints bármelyik fotóra a nagyításhoz.</p>${html}`);
  }

  async function load(){
    currentToken = tokenFromUrl();
    const box = $('publicReportContent');
    if(!currentToken){ box.innerHTML = '<h2>Hiányzó riport azonosító.</h2><p>A linkből hiányzik a riport azonosító.</p>'; return; }
    try{
      const report = await window.EpitesNaploAPI.getPublicReport(currentToken);
      if(!report){ box.innerHTML = '<h2>A riport nem található vagy lejárt.</h2><p>Kérj új linket a kivitelezőtől.</p>'; return; }
      try{ await window.EpitesNaploAPI.markPublicReportOpened(currentToken); }catch(_){ }
      box.innerHTML = '<div class="reportOpenedBox"><b>Riport megnyitva.</b><br>Az oldal csak olvasásra szolgál.</div>' + normalizeReportHtml(report.report_html || report.html || '');
      try{ await window.EpitesNaploAPI.hydratePublicReportMedia(currentToken, box); }catch(e){ console.warn(e); }
      await injectMissingPublicImages(report);
      wireGallery();
      document.title = (report.project_name ? report.project_name + ' – ' : '') + 'ÉpítésNapló ügyfélriport';
      $('approvalBox').classList.remove('hidden');
      $('approvalBox').innerHTML = `<h2>Ügyfél visszajelzés</h2><p class="muted">Válaszd ki, mit szeretnél rögzíteni. A kivitelező látni fogja a döntést és a kérdést/megjegyzést.</p><input id="clientApproveName" placeholder="Név / cég"><input id="clientApproveEmail" placeholder="Email cím (opcionális)"><textarea id="clientApproveMessage" placeholder="Megjegyzés vagy kérdés (opcionális)"></textarea><label class="checkLine"><input id="clientApproveCheck" type="checkbox"> <span>Megtekintettem az építési napló riportot.</span></label><div class="approvalActionGrid"><button class="btn ghost" onclick="approveReportV110('viewed', this)">Megnéztem</button><button class="btn primary" onclick="approveReportV110('accepted', this)">Elfogadom</button><button class="btn ghost" onclick="approveReportV110('question', this)">Kérdésem van</button></div>`;
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
    const clone = $('publicReportContent').cloneNode(true); clone.querySelectorAll('.reportOpenedBox,.v110Gallery').forEach(x=>x.remove()); stripBadCodeText(clone);
    const baseHtml = clone.innerHTML;
    const baseText = clone.innerText || '';
    const extra = message ? `<section class="clientFeedbackBlock" style="margin:22px 0;padding:16px 18px;border-left:5px solid #f59e0b;background:#fff7ed;border-radius:12px;color:#111827;"><h2>Ügyfél kérdése / észrevétele</h2><p style="white-space:pre-wrap;">${safe(message)}</p></section>` : '';
    try{
      await window.EpitesNaploAPI.approvePublicReport(currentToken, { name, email, decision, message, clientComment:message, reportHtml: baseHtml + extra, reportText: baseText + (message ? '\n\nÜgyfél kérdése / észrevétele:\n'+message : '') });
      $('approvalBox').innerHTML = `<div class="reportOpenedBox"><b>Visszajelzés mentve: ${safe(label(decision))}</b><br>Dátum: ${new Date().toLocaleString('hu-HU')}${message ? `<br><small>Kérdés/megjegyzés: ${safe(message)}</small>` : ''}<br><small>A kivitelező projektoldalán megjelenik.</small></div>`;
    }catch(e){ alert('Jóváhagyás mentési hiba: ' + (e.message||e)); }
    finally{ buttons.forEach(b=>b.disabled=false); if(btn){btn.classList.remove('is-loading'); if(old) btn.innerText=old;} }
  };

  async function waitImages(root){ const imgs=[...root.querySelectorAll('img')].filter(i=>i.src); await Promise.all(imgs.map(img=> img.complete && img.naturalWidth>0 ? true : new Promise(res=>{img.onload=res; img.onerror=res; setTimeout(res,6000);} ))); await new Promise(r=>setTimeout(r,250)); }
  window.downloadPublicPdfV110 = async function(btn){
    const old=btn?.innerText||''; if(btn){btn.disabled=true;btn.classList.add('is-loading');btn.innerText='PDF készül...';}
    const stage = $('publicReportContent').cloneNode(true); stage.querySelectorAll('.reportOpenedBox,.v110Gallery').forEach(x=>x.remove()); stripBadCodeText(stage); stage.style.background='#fff'; stage.style.padding='24px'; stage.style.width='900px'; stage.style.position='fixed'; stage.style.left='-9999px'; stage.style.top='0'; document.body.appendChild(stage);
    try{ await waitImages(stage); if(window.html2pdf){ await html2pdf().set({ margin:[8,8,8,8], filename:'epitesi-naplo-ugyfelriport.pdf', image:{type:'jpeg',quality:.96}, html2canvas:{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#ffffff',imageTimeout:12000}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}, pagebreak:{mode:['css','legacy'],avoid:['img','figure','.stat','.photo']} }).from(stage).save(); } else window.print(); }
    finally{ stage.remove(); if(btn){btn.disabled=false;btn.classList.remove('is-loading');btn.innerText=old||'PDF letöltés';} }
  };
  window.copyReportLink = async function(btn){ try{ await navigator.clipboard.writeText(location.href); const old=btn.innerText; btn.innerText='Link másolva'; setTimeout(()=>btn.innerText=old,1500); }catch(_){ prompt('Másold ki a linket:', location.href); } };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
