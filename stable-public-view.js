/* ÉpítésNapló stabil publikus ügyfélriport nézet */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let currentToken = '';
  let idx = 0;
  (function injectStableCss(){
    if(document.getElementById('stablePublicViewCss')) return;
    const st=document.createElement('style'); st.id='stablePublicViewCss';
    st.textContent='.enpPhotos{display:grid;grid-template-columns:repeat(auto-fill,112px);gap:12px;margin:12px 0 8px}.enpPhoto{width:112px;max-width:112px;min-height:132px;border:1px solid #d1d5db;border-radius:12px;padding:5px;background:#fff;margin:0;overflow:hidden}.enpPhoto img{display:block;width:100px!important;height:100px!important;max-width:100px!important;max-height:100px!important;object-fit:cover;border-radius:9px;cursor:zoom-in}.enpPhoto figcaption{font-size:11px;color:#64748b}.enpGallery{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.94);display:none;align-items:center;justify-content:center;padding:70px 60px 30px}.enpGallery.open{display:flex}.enpGallery img{max-width:96vw!important;max-height:86vh!important;width:auto!important;height:auto!important;object-fit:contain!important;border-radius:14px!important;background:#000}.enpGallery button{position:fixed;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:900;cursor:pointer}.enpClose{top:14px;right:14px;padding:10px 14px}.enpPrev,.enpNext{top:50%;transform:translateY(-50%);width:46px;height:70px;font-size:34px}.enpPrev{left:12px}.enpNext{right:12px}@media(max-width:760px){.enpPhotos{grid-template-columns:repeat(3,92px)}.enpPhoto{width:92px;min-height:112px}.enpPhoto img{width:80px!important;height:80px!important}.enpGallery{padding:62px 8px 20px}.enpPrev,.enpNext{width:38px;height:56px;font-size:28px}}';
    document.head.appendChild(st);
  })();
  function token(){ const p=new URLSearchParams(location.search); return String(p.get('riport')||p.get('token')||p.get('report')||p.get('id')||'').trim(); }
  function decodeHtml(s){ s=String(s||''); if((s.match(/&lt;/g)||[]).length > (s.match(/<\/?[a-z]/ig)||[]).length){ const t=document.createElement('textarea'); t.innerHTML=s; return t.value; } return s; }
  function clean(html){
    html = decodeHtml(html);
    const doc = new DOMParser().parseFromString(html || '<p>A riport üres.</p>', 'text/html');
    const body = doc.body || doc;
    body.querySelectorAll('script,noscript,template,.enpGallery,.v110Gallery,.v117Lightbox,.mediaViewerModal').forEach(x=>x.remove());
    body.querySelectorAll('*').forEach(el => [...el.attributes].forEach(a => { if(/^on/i.test(a.name)) el.removeAttribute(a.name); }));
    body.querySelectorAll('a').forEach(a=>{ if(a.querySelector('img,video')){ a.removeAttribute('href'); a.removeAttribute('target'); } });
    body.querySelectorAll('img').forEach(img=>{ img.setAttribute('loading','lazy'); img.setAttribute('decoding','async'); });
    return body.innerHTML || html;
  }
  function images(){ return [...document.querySelectorAll('#publicReportContent img')].filter(i => i.src && !(i.alt||'').toLowerCase().includes('ikon')); }
  function ensureGallery(){
    let g=$('publicGalleryStable'); if(g) return g;
    g=document.createElement('div'); g.id='publicGalleryStable'; g.className='enpGallery';
    g.innerHTML='<button class="enpClose" type="button">Bezárás ×</button><button class="enpPrev" type="button">‹</button><img alt="Nagyított napló kép"><button class="enpNext" type="button">›</button>';
    document.body.appendChild(g);
    g.querySelector('.enpClose').onclick=e=>{e.preventDefault();g.classList.remove('open')};
    g.querySelector('.enpPrev').onclick=e=>{e.stopPropagation();show(idx-1)};
    g.querySelector('.enpNext').onclick=e=>{e.stopPropagation();show(idx+1)};
    g.onclick=e=>{ if(e.target===g) g.classList.remove('open'); };
    return g;
  }
  function show(n){ const list=images(); if(!list.length)return; idx=(n+list.length)%list.length; const g=ensureGallery(); g.querySelector('img').src=list[idx].currentSrc||list[idx].src; g.classList.add('open'); }
  function wire(){ const box=$('publicReportContent'); if(!box)return; box.querySelectorAll('img').forEach(img=>{ if(img.dataset.stableWired)return; img.dataset.stableWired='1'; img.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();show(images().indexOf(img));},true); }); }
  document.addEventListener('keydown',e=>{ const g=$('publicGalleryStable'); if(!g||!g.classList.contains('open'))return; if(e.key==='Escape')g.classList.remove('open'); if(e.key==='ArrowLeft')show(idx-1); if(e.key==='ArrowRight')show(idx+1); });
  async function load(){
    currentToken=token(); const box=$('publicReportContent');
    if(!box) return;
    if(!currentToken){ box.innerHTML='<h2>Hiányzó riport azonosító.</h2><p>A linkből hiányzik a riport azonosító.</p>'; return; }
    try{
      const report=await window.EpitesNaploAPI.getPublicReport(currentToken);
      if(!report){ box.innerHTML='<h2>A riport nem található vagy lejárt.</h2><p>Kérj új linket a kivitelezőtől.</p>'; return; }
      try{ await window.EpitesNaploAPI.markPublicReportOpened(currentToken); }catch(_){ }
      box.innerHTML='<div class="reportOpenedBox"><b>Riport megnyitva.</b><br>Az oldal csak olvasásra szolgál.</div>'+clean(report.report_html||report.html||'');
      try{ await window.EpitesNaploAPI.hydratePublicReportMedia(currentToken, box); }catch(_){ }
      wire(); document.title=(report.project_name?report.project_name+' – ':'')+'ÉpítésNapló ügyfélriport';
      const approval=$('approvalBox'); if(approval){ approval.classList.remove('hidden'); approval.innerHTML='<h2>Ügyfél visszajelzés</h2><p class="muted">Válaszd ki, mit szeretnél rögzíteni. A kivitelező látni fogja a döntést és a kérdést/megjegyzést.</p><input id="clientApproveName" placeholder="Név / cég"><input id="clientApproveEmail" placeholder="Email cím (opcionális)"><textarea id="clientApproveMessage" placeholder="Megjegyzés vagy kérdés (opcionális)"></textarea><label class="checkLine"><input id="clientApproveCheck" type="checkbox"> <span>Megtekintettem az építési napló riportot.</span></label><div class="approvalActionGrid"><button class="btn ghost" onclick="approveReportStable(\'viewed\', this)">Megnéztem</button><button class="btn primary" onclick="approveReportStable(\'accepted\', this)">Elfogadom</button><button class="btn ghost" onclick="approveReportStable(\'question\', this)">Kérdésem van</button></div>'; }
    }catch(e){ box.innerHTML='<h2>Riport betöltési hiba</h2><p>'+safe(e.message||e)+'</p>'; }
  }
  window.approveReportStable=async function(decision, btn){
    const name=$('clientApproveName')?.value.trim()||''; const email=$('clientApproveEmail')?.value.trim()||''; const message=$('clientApproveMessage')?.value.trim()||'';
    if(!$('clientApproveCheck')?.checked) return alert('A visszajelzéshez pipáld be a megtekintést.');
    if(decision==='question'&&!message) return alert('Kérdéshez írd be a kérdésedet vagy megjegyzésedet.');
    const old=btn?.innerText||''; if(btn){btn.disabled=true;btn.innerText='Mentés...';}
    try{ const clone=$('publicReportContent').cloneNode(true); clone.querySelectorAll('.reportOpenedBox').forEach(x=>x.remove()); await window.EpitesNaploAPI.approvePublicReport(currentToken,{name,email,decision,message,clientComment:message,reportHtml:clone.innerHTML,reportText:clone.innerText||''}); $('approvalBox').innerHTML='<div class="reportOpenedBox"><b>Visszajelzés mentve.</b><br>A kivitelező projektoldalán megjelenik.</div>'; }catch(e){ alert('Jóváhagyás mentési hiba: '+(e.message||e)); } finally{ if(btn){btn.disabled=false;btn.innerText=old;} }
  };
  window.downloadPublicPdfStable=async function(btn){ const old=btn?.innerText||''; if(btn){btn.disabled=true;btn.innerText='PDF készül...';} try{ if(window.html2pdf){ const stage=$('publicReportContent').cloneNode(true); stage.style.background='#fff'; stage.style.padding='24px'; stage.style.width='900px'; stage.style.position='fixed'; stage.style.left='-9999px'; document.body.appendChild(stage); await Promise.all([...stage.images].map(img=>img.complete?true:new Promise(res=>{img.onload=img.onerror=res;setTimeout(res,6000)}))); await html2pdf().set({margin:[8,8,8,8],filename:'epitesi-naplo-ugyfelriport.pdf',image:{type:'jpeg',quality:.96},html2canvas:{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#ffffff'},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(stage).save(); stage.remove(); } else window.print(); } finally{ if(btn){btn.disabled=false;btn.innerText=old||'PDF letöltés';} } };
  window.copyReportLink=async function(btn){ try{ await navigator.clipboard.writeText(location.href); const old=btn.innerText; btn.innerText='Link másolva'; setTimeout(()=>btn.innerText=old,1500); }catch(_){ prompt('Másold ki a linket:', location.href); } };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load); else load();
})();
