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
