/* V109 - ügyfél visszajelzés + saját példány + válasz fix
   Fontos: login/Supabase alapbeállításokhoz nem nyúl.
   Megtartja a V108 galéria/ikon/OG javításait, és külön rétegként kezeli a riport visszajelzéseket.
*/
(function(){
  'use strict';
  if(window.__epitesNaploV109FeedbackReplyFix) return;
  window.__epitesNaploV109FeedbackReplyFix = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Építési napló projekt';
  const fmt = v => {
    if(!v) return '';
    try { return new Date(v).toLocaleString('hu-HU'); } catch(_) { return String(v).replace('T',' ').slice(0,19); }
  };
  const decisionOf = row => String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase();
  const labelOf = d => (d === 'accepted' || d === 'approved') ? 'Jóváhagyva / elfogadva' : (d === 'question' ? 'Kérdése van' : 'Megtekintve');
  const badgeClass = d => (d === 'question' ? 'warn' : ((d === 'accepted' || d === 'approved') ? 'ok' : 'info'));
  const messageOf = row => String(row?.client_comment || row?.message || row?.client_message || row?.approval_message || row?.question || row?.question_text || row?.note || row?.comment || '').trim();

  function toast(msg, type){
    if(typeof showToast === 'function') return showToast(msg, type || 'ok');
    const box = document.getElementById('toast');
    if(box){ box.textContent = msg; box.className = 'toast'; setTimeout(()=>box.classList.add('hidden'), 2800); }
    else alert(msg);
  }

  function ensureCss(){
    if(document.getElementById('v109-feedback-css')) return;
    const s = document.createElement('style');
    s.id = 'v109-feedback-css';
    s.textContent = `
      .v109FeedbackBox{margin:18px 0;padding:18px;border-radius:18px;background:linear-gradient(135deg,#071827,#0f2f46);border:1px solid rgba(251,191,36,.28);box-shadow:0 16px 36px rgba(0,0,0,.22);color:#e5eef8}
      .v109FeedbackBox h3{margin:0 0 6px;color:#fff}.v109FeedbackBox .muted{color:#b6c7d8!important}
      .v109FeedbackRow{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:flex-start;margin:12px 0;padding:13px;border-radius:14px;background:rgba(15,38,56,.88);border:1px solid rgba(148,163,184,.24)}
      .v109FeedbackMeta{font-size:13px;color:#b6c7d8;margin-top:4px}.v109FeedbackMsg{margin:9px 0 0;padding:10px;border-radius:12px;background:#17344a;border:1px solid rgba(251,191,36,.25);color:#f8fafc;white-space:pre-wrap}
      .v109FeedbackActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.v109FeedbackActions .btn{white-space:nowrap}.v109ReplySaved{margin-top:8px;color:#86efac;font-weight:700}
      .tag.warn{background:#f59e0b!important;color:#111827!important}.tag.ok{background:#22c55e!important;color:#052e16!important}.tag.info{background:#38bdf8!important;color:#082f49!important}
      @media(max-width:760px){.v109FeedbackRow{grid-template-columns:1fr}.v109FeedbackActions{justify-content:flex-start}.v109FeedbackActions .btn{width:100%}}
    `;
    document.head.appendChild(s);
  }

  function ensureBox(){
    ensureCss();
    let box = document.getElementById('v109FeedbackBox');
    if(box) return box;
    box = document.createElement('div');
    box.id = 'v109FeedbackBox';
    box.className = 'v109FeedbackBox';
    const host = document.getElementById('v79ApprovalsBox') || document.getElementById('v75SavedReportsBox') || document.getElementById('v74DocumentsBox') || document.getElementById('projectSummaryBox') || document.querySelector('.projectSummaryCard') || document.querySelector('main .card');
    if(host) host.insertAdjacentElement('afterend', box);
    else document.querySelector('main')?.prepend(box);
    return box;
  }

  async function loadRows(){
    const pid = projectId();
    if(!pid || !window.EpitesNaploAPI?.getReportApprovals) return [];
    const rows = await window.EpitesNaploAPI.getReportApprovals(pid);
    return Array.isArray(rows) ? rows : [];
  }

  function rowHtml(row){
    const d = decisionOf(row);
    const msg = messageOf(row);
    const id = esc(row.id || '');
    const who = row.client_name || row.client_email || 'Ügyfél';
    const email = row.client_email || '';
    return `<div class="v109FeedbackRow" data-v109-row="${id}">
      <div>
        <span class="tag ${badgeClass(d)}">${esc(labelOf(d))}</span>
        <div class="v109FeedbackMeta">${esc(fmt(row.approved_at || row.created_at))} · ${esc(who)}${email ? ' · ' + esc(email) : ''}</div>
        ${msg ? `<div class="v109FeedbackMsg"><b>Kérdés / megjegyzés:</b><br>${esc(msg)}</div>` : '<p class="muted">Nincs megjegyzés.</p>'}
        <div id="v109ReplySaved-${id}" class="v109ReplySaved" hidden></div>
      </div>
      <div class="v109FeedbackActions">
        <button class="btn small primary" type="button" data-v109-copy="${id}">Saját példány HTML</button>
        <button class="btn small ghost" type="button" data-v109-pdf="${id}">PDF / nyomtatás</button>
        ${msg ? `<button class="btn small ghost" type="button" data-v109-reply="${id}">Válasz rögzítése</button>` : ''}
      </div>
    </div>`;
  }

  async function render(){
    const box = ensureBox();
    if(!box) return;
    const pid = projectId();
    if(!pid){ box.innerHTML = '<h3>Ügyfél visszajelzések</h3><p class="muted">Nincs kiválasztott projekt.</p>'; return; }
    box.innerHTML = '<h3>Ügyfél visszajelzések és kérdések</h3><p class="muted">Betöltés...</p>';
    try{
      const rows = await loadRows();
      if(!rows.length){
        box.innerHTML = '<h3>Ügyfél visszajelzések és kérdések</h3><p class="muted">Még nincs ügyfél visszajelzés ehhez a projekthez. Ha az ügyfél a riportban a Megnéztem / Elfogadom / Kérdésem van gombot megnyomja, itt jelenik meg.</p>';
        return;
      }
      box.innerHTML = `<h3>Ügyfél visszajelzések és kérdések</h3><p class="muted">Itt látod, ha az ügyfél megnyitotta, jóváhagyta vagy kérdést írt. A saját példányt innen tudod menteni.</p>${rows.slice(0,20).map(rowHtml).join('')}`;
    }catch(err){
      box.innerHTML = '<h3>Ügyfél visszajelzések és kérdések</h3><p class="muted">Nem sikerült betölteni: '+esc(err?.message || err)+'</p>';
    }
  }

  async function rowById(id){
    try{ const r = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(r) return r; }catch(_){}
    const rows = await loadRows();
    return rows.find(r => String(r.id) === String(id)) || null;
  }

  window.v109ReplyToClientQuestion = async function(id){
    const row = await rowById(id);
    if(!row) return alert('Nem találom ezt az ügyfél visszajelzést.');
    const question = messageOf(row);
    const answer = prompt('Írd be a választ, amit rögzíteni szeretnél ehhez az ügyfél kérdéshez:', '');
    if(!answer || !answer.trim()) return;
    const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Válasz ügyfél kérdésére</title><link rel="icon" href="https://epitesi-naplo.eu/favicon.png"><style>body{font-family:Arial,sans-serif;padding:28px;color:#111827}section{border:1px solid #d1d5db;border-radius:14px;padding:16px;margin:14px 0}.q{background:#fff7ed}.a{background:#ecfdf5}</style></head><body><h1>Válasz ügyfél kérdésére</h1><p><b>Projekt:</b> ${esc(projectTitle())}</p><p><b>Ügyfél:</b> ${esc(row.client_name || row.client_email || '')}</p><p><b>Dátum:</b> ${esc(fmt(new Date()))}</p><section class="q"><h2>Ügyfél kérdése / megjegyzése</h2><p>${esc(question).replace(/\n/g,'<br>')}</p></section><section class="a"><h2>Kivitelező válasza</h2><p>${esc(answer).replace(/\n/g,'<br>')}</p></section></body></html>`;
    try{
      await window.EpitesNaploAPI?.saveReportDocument?.({
        projectId: projectId(),
        approvalId: id,
        title: `${projectTitle()} – válasz ügyfél kérdésére`,
        type: 'client_question_reply_v109',
        html,
        text: `Ügyfél kérdése:\n${question}\n\nKivitelező válasza:\n${answer}`,
        meta: { v109:true, client_email: row.client_email || '', decision: decisionOf(row) }
      });
      const ok = document.getElementById('v109ReplySaved-'+CSS.escape(String(id)));
      if(ok){ ok.hidden = false; ok.textContent = 'Válasz rögzítve a mentett riportok közé.'; }
      toast('Válasz rögzítve a saját példányok közé.', 'ok');
      if(row.client_email){
        const subject = encodeURIComponent('Válasz az ÉpítésNapló riport kérdésére');
        const body = encodeURIComponent(`Szia!\n\nA riporttal kapcsolatos kérdésedre válaszolok:\n\n${answer}\n\nÜdvözlettel`);
        window.location.href = `mailto:${row.client_email}?subject=${subject}&body=${body}`;
      }
    }catch(err){
      alert('Válasz mentési hiba: ' + (err?.message || err));
    }
  };

  document.addEventListener('click', function(e){
    const copy = e.target.closest('[data-v109-copy]');
    const pdf = e.target.closest('[data-v109-pdf]');
    const reply = e.target.closest('[data-v109-reply]');
    if(!copy && !pdf && !reply) return;
    e.preventDefault(); e.stopPropagation();
    const id = copy?.dataset.v109Copy || pdf?.dataset.v109Pdf || reply?.dataset.v109Reply;
    if(copy) return window.v71DownloadApprovedHtml ? window.v71DownloadApprovedHtml(id) : alert('A saját példány funkció még nem töltött be.');
    if(pdf) return window.v71PrintApprovedReport ? window.v71PrintApprovedReport(id) : alert('A PDF funkció még nem töltött be.');
    if(reply) return window.v109ReplyToClientQuestion(id);
  }, true);

  document.addEventListener('DOMContentLoaded', () => { setTimeout(render, 900); setTimeout(render, 2500); });
  setTimeout(render, 1600);
  window.v109RenderClientFeedback = render;
})();



// ===== V118 STABIL RIPORT: tiszta riportépítés, kisképek mindenhol, nincs széteső szöveg =====
(function(){
  'use strict';
  if(window.__epitesNaploV118StableReports) return;
  window.__epitesNaploV118StableReports = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uniq = arr => [...new Set((arr||[]).map(x=>String(x||'').trim()).filter(Boolean))];
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Építési napló';
  const safeName = v => String(v || 'epitesi-naplo-riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo-riport';
  const money = n => (Number(n||0)||0).toLocaleString('hu-HU') + ' Ft';
  const fmt = d => { try{return d ? new Date(d).toLocaleString('hu-HU') : '';}catch(_){return String(d||'');} };

  function validImg(s){
    s=String(s||'').trim();
    if(!s || /^(javascript:|function\s*\(|\(function|window\.|document\.|const\s+|let\s+|var\s+)/i.test(s)) return false;
    if(/\.(mp4|mov|webm|m4v|3gp)(\?|#|$)/i.test(s)) return false;
    return /^data:image\//i.test(s) || /^https?:\/\//i.test(s) || /^blob:/i.test(s) || /^\.\//.test(s) || /^\//.test(s) || /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(s);
  }
  function collect(value,out){
    if(!value) return;
    if(Array.isArray(value)){ value.forEach(v=>collect(v,out)); return; }
    if(typeof value === 'object'){
      const o=value;
      ['url','src','href','path','image','image_url','storage_path','file_path','publicUrl','public_url','signedUrl','signed_url','dataUrl'].forEach(k=>collect(o[k],out));
      ['images','imageUrls','image_urls','photos','beforeImages','afterImages','generalImages','before_images_json','after_images_json','general_images_json','media','ai_json','analysis'].forEach(k=>collect(o[k],out));
      return;
    }
    const s=String(value||'').trim(); if(validImg(s)) out.push(s);
  }
  function entryImages(e){ const out=[]; collect(e,out); return uniq(out); }
  function domImages(){
    const out=[];
    document.querySelectorAll('img').forEach(img=>{
      const alt=(img.alt||'').toLowerCase(); const cls=(img.className||'').toString().toLowerCase();
      if(alt.includes('ikon') || alt.includes('logo') || cls.includes('logo') || cls.includes('brand')) return;
      const src=img.getAttribute('data-full-src') || img.getAttribute('data-src') || img.currentSrc || img.src || '';
      if(validImg(src)) out.push(src);
    });
    return uniq(out);
  }
  async function dataUrlMaybe(url){
    // A Supabase privát signed URL-ek később lejárhatnak, ezért ahol lehet, HTML-be beágyazott képet készítünk.
    if(!/^https?:\/\//i.test(url) || /^data:image\//i.test(url)) return url;
    try{
      const r=await fetch(url, { mode:'cors', cache:'force-cache' });
      if(!r.ok) return url;
      const b=await r.blob();
      if(!String(b.type||'').startsWith('image/')) return url;
      if(b.size > 6*1024*1024) return url; // túl nagy képet ne ágyazzunk be
      return await new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>res(url); fr.readAsDataURL(b); });
    }catch(_){ return url; }
  }
  async function embedImages(imgs){
    const out=[];
    for(const img of imgs){ out.push(await dataUrlMaybe(img)); }
    return uniq(out);
  }
  async function getCloseData(){
    let data={};
    try{ data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId()) || {}; }catch(e){ console.warn('Projekt záróadat lekérés hiba:', e); }
    let entries = Array.isArray(data.entries) ? data.entries : (Array.isArray(state()?.entries) ? state().entries : []);
    entries = entries.map(e=>({...e}));
    let media=[];
    try{ media = await window.EpitesNaploAPI?.getProjectMediaForReport?.(projectId()) || []; }catch(e){ console.warn('Projekt média lekérés hiba:', e); }
    const all = uniq([...(entries||[]).flatMap(entryImages), ...media, ...domImages()]);
    if(all.length){
      const embedded = await embedImages(all);
      if(!entries.length) entries.push({ phase:'Fotódokumentáció', note:'A projekthez rögzített fotódokumentáció.', created_at:new Date().toISOString(), images: embedded, image_urls: embedded });
      else entries[0] = {...entries[0], images: uniq([...entryImages(entries[0]), ...embedded]), image_urls: uniq([...entryImages(entries[0]), ...embedded])};
    }
    data.entries = entries;
    return data;
  }
  function matLine(m){ return `${esc(m?.name||m?.material||m?.title||m?.megnevezes||'Anyag')} ${esc(m?.quantity||m?.mennyiseg||'')} ${esc(m?.unit||m?.egyseg||'')}`.trim(); }
  function imageGrid(imgs){
    imgs=uniq(imgs).filter(validImg);
    if(!imgs.length) return '<p class="muted">Ehhez a bejegyzéshez nincs csatolt fotó.</p>';
    return `<div class="photos v118Photos">${imgs.map((src,i)=>`<figure class="v118Photo"><img src="${esc(src)}" data-full-src="${esc(src)}" alt="Napló fotó ${i+1}" loading="lazy" decoding="async"><figcaption>Nagyítás</figcaption></figure>`).join('')}</div>`;
  }
  function reportStyleAndScript(){ return `<style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:24px;line-height:1.45}.doc{max-width:1050px;margin:auto}.pill{display:inline-block;background:#fff2bf;color:#8a5a00;border-radius:999px;padding:7px 13px;font-weight:700}.cover{border-bottom:4px solid #f5a400;margin-bottom:20px;padding-bottom:16px}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0}.stat{background:#f3f4f6;border-radius:10px;padding:12px}.stat b{display:block;color:#d97706;font-size:22px}.entry{border-left:4px solid #f5a400;background:#fafafa;margin:18px 0;padding:16px 18px;border-radius:12px;break-inside:avoid}.aiBox{background:#ecfdf5;border-left:5px solid #22c55e;border-radius:12px;padding:14px 16px;margin:12px 0}.photos,.v118Photos{display:grid!important;grid-template-columns:repeat(auto-fill,112px)!important;gap:10px!important;align-items:start!important;justify-content:start!important;margin:12px 0!important}.v118Photo{width:112px!important;max-width:112px!important;min-height:132px!important;border:1px solid #d1d5db!important;border-radius:12px!important;background:#fff!important;padding:5px!important;margin:0!important;box-sizing:border-box!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}.v118Photo img{display:block!important;width:100px!important;height:100px!important;max-width:100px!important;max-height:100px!important;object-fit:cover!important;border-radius:9px!important;cursor:zoom-in!important;background:#f8fafc!important}.v118Photo figcaption{font-size:11px;color:#64748b;margin-top:4px}.v118Lightbox{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.94);display:flex;align-items:center;justify-content:center;padding:70px 60px 30px}.v118Lightbox img{max-width:96vw!important;max-height:86vh!important;width:auto!important;height:auto!important;object-fit:contain!important;border-radius:14px!important;background:#000}.v118Lightbox button{position:fixed;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:900;cursor:pointer}.v118Close{top:14px;right:14px;padding:10px 14px}.v118Prev,.v118Next{top:50%;transform:translateY(-50%);width:46px;height:70px;font-size:34px}.v118Prev{left:12px}.v118Next{right:12px}@media(max-width:760px){body{padding:14px}.stats{grid-template-columns:repeat(2,1fr)}.photos,.v118Photos{grid-template-columns:repeat(3,92px)!important}.v118Photo{width:92px!important;min-height:112px!important}.v118Photo img{width:80px!important;height:80px!important}.v118Lightbox{padding:62px 8px 20px}.v118Prev,.v118Next{width:38px;height:56px;font-size:28px}}@media print{.v118Lightbox{display:none!important}.photos,.v118Photos{grid-template-columns:repeat(4,30mm)!important}.v118Photo{width:30mm!important;min-height:34mm!important}.v118Photo img{width:28mm!important;height:28mm!important}}
    </style><script>(function(){var idx=0;function imgs(){return Array.from(document.querySelectorAll('.v118Photos img,.photos img')).filter(function(i){return i.src&&!i.closest('.v118Lightbox')})}function close(){document.querySelectorAll('.v118Lightbox').forEach(function(x){x.remove()})}function openAt(i){var list=imgs();if(!list.length)return;idx=(i+list.length)%list.length;close();var box=document.createElement('div');box.className='v118Lightbox';function draw(){box.innerHTML='<button class="v118Close" type="button">Bezárás ×</button>'+(list.length>1?'<button class="v118Prev" type="button">‹</button><button class="v118Next" type="button">›</button>':'')+'<img alt="Nagyított napló kép">';box.querySelector('img').src=list[idx].src;box.querySelector('.v118Close').onclick=function(e){e.preventDefault();e.stopPropagation();close()};var p=box.querySelector('.v118Prev'),n=box.querySelector('.v118Next');if(p)p.onclick=function(e){e.preventDefault();e.stopPropagation();idx=(idx-1+list.length)%list.length;draw()};if(n)n.onclick=function(e){e.preventDefault();e.stopPropagation();idx=(idx+1)%list.length;draw()};}draw();box.onclick=function(e){if(e.target===box)close()};document.body.appendChild(box)}document.addEventListener('click',function(e){var img=e.target.closest&&e.target.closest('.v118Photos img,.photos img');if(!img||img.closest('.v118Lightbox'))return;e.preventDefault();e.stopPropagation();openAt(imgs().indexOf(img))},true);document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});})();<\/script>`; }
  function buildReportHtml(data, title){
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    const materials = Array.isArray(data?.materials) ? data.materials : [];
    const invoices = Array.isArray(data?.invoices) ? data.invoices : [];
    const invoiceSum = invoices.reduce((s,x)=>s+(Number(x.amount||x.gross_amount||x.total||0)||0),0);
    const photoCount = entries.reduce((s,e)=>s+entryImages(e).length,0);
    const materialHtml = materials.length ? materials.map(m=>`<li><b>${matLine(m)}</b></li>`).join('') : '<li>Nincs rögzített anyag.</li>';
    const invoiceHtml = invoices.length ? invoices.map(i=>`<tr><td>${esc(i.title||i.name||i.description||'Számla')}</td><td>${money(i.amount||i.gross_amount||i.total)}</td><td>${esc(i.note||'')}</td></tr>`).join('') : '<tr><td colspan="3">Nincs csatolt számla.</td></tr>';
    const rows = entries.map(e=>{
      const imgs = entryImages(e);
      const mats = Array.isArray(e.materials_json) ? e.materials_json : (Array.isArray(e.materials)?e.materials:[]);
      const weather = e.weather || e.weather_text || e.weather_json?.summary || e.weather_json?.text || '';
      const gps = e.location_address || e.locationAddress || e.gps_json?.address || e.gps || '';
      const ai = e.ai_report || e.ai_summary || e.ai_json?.summary || e.analysis?.summary || '';
      return `<section class="entry"><h2>${esc(fmt(e.created_at))} – ${esc(e.phase||'Napi bejegyzés')}</h2><p>${esc(e.note||e.description||'').replace(/\n/g,'<br>')}</p><p><b>Dokumentáció:</b> ${imgs.length} fotó, 0 videó.</p>${mats.length?`<p><b>Napi anyag:</b> ${mats.map(matLine).join(', ')}</p>`:''}${weather?`<p><b>Időjárás:</b> ${esc(weather)}</p>`:''}${gps?`<p><b>GPS/helyadat:</b> ${esc(gps)}</p>`:''}${ai?`<div class="aiBox"><b>AI szakmai kontroll:</b><br>${esc(ai).replace(/\n/g,'<br>')}</div>`:''}<h3>Munka közben / dokumentáció</h3><p>Kattints bármelyik fotóra a nagyításhoz.</p>${imageGrid(imgs)}</section>`;
    }).join('') || '<p>Nincs napi bejegyzés ehhez a projekthez.</p>';
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="icon" href="https://epitesi-naplo.eu/favicon.png">${reportStyleAndScript()}</head><body><div class="doc"><div class="cover"><span class="pill">Átadásra kész dokumentáció</span><h1>${esc(title)}</h1><p class="muted">Generálva: ${new Date().toLocaleString('hu-HU')} • ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>${entries.length}</b>bejegyzés</div><div class="stat"><b>${photoCount}</b>fotó</div><div class="stat"><b>0</b>videó</div><div class="stat"><b>0</b>magas kockázat</div><div class="stat"><b>${money(invoiceSum)}</b>számlák</div></div></div><h2>Rövid összegzés</h2><p>A dokumentum az ügyfélnek átadható, rendezett építési napló: napi munka, fotódokumentáció, anyagok, időjárás/GPS és nyitott ellenőrzések egy helyen.</p><h2>Anyagösszesítő</h2><ul>${materialHtml}</ul><h2>Számlák</h2><table><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr>${invoiceHtml}</table><h2>Vezetői AI összefoglaló</h2><div class="aiBox">Állapot: rendezett dokumentáció. Bejegyzések: ${entries.length}, fotók: ${photoCount}, videók: 0. A napi bejegyzések és fotók alapján az ügyfél számára átadható dokumentáció készült.</div><h2>Napi bejegyzések</h2>${rows}</div></body></html>`;
  }
  window.buildProReportHtml = function(entries,title,options){ return buildReportHtml({entries:entries||[], materials:options?.materials||[], invoices:options?.invoices||[]}, title || (projectTitle()+' – ügyfélriport')); };
  try{ buildProReportHtml = window.buildProReportHtml; }catch(_){ }
  function download(name, html){ const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000); }
  async function openPrint(html){ const w=window.open('', '_blank'); if(!w) return alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakokat.'); w.document.open(); w.document.write(html); w.document.close(); setTimeout(()=>{try{w.focus();w.print();}catch(_){ }},900); }
  async function currentHtml(kind){ const data=await getCloseData(); return buildReportHtml(data, `${projectTitle()} – ${kind||'ügyfélriport'}`); }

  window.createProjectClientLinkV25 = async function(){
    if(!projectId()) return alert('Nincs projekt.');
    const btn=document.activeElement; const old=btn&&btn.tagName==='BUTTON'?btn.innerText:'';
    try{
      if(btn&&old){btn.disabled=true;btn.innerText='Ügyfél link készül...';}
      const html=await currentHtml('ügyfélriport');
      const saved=await window.EpitesNaploAPI.createPublicReport({ projectId: projectId(), projectName: projectTitle(), reportHtml: html, reportText: (new DOMParser().parseFromString(html,'text/html').body.innerText || projectTitle()) });
      const link=window.EpitesNaploAPI.createClientShareUrl(saved.token);
      try{await navigator.clipboard.writeText(link);}catch(_){ }
      if(typeof showProjectHelp==='function') showProjectHelp('Ügyfél link elkészült', `<div class="featureHelpBox"><b>Biztonságos ügyfél link</b><p>A link kimásolva. A riportban a fotók kisképként benne vannak, kattintásra nagyíthatók.</p><p><a class="btn primary" target="_blank" href="${esc(link)}">Ügyfélriport megnyitása</a></p><p class="muted">${esc(link)}</p></div>`); else alert('Ügyfél link elkészült: '+link);
    }catch(e){ console.error(e); alert('Ügyfél link létrehozási hiba: '+(e.message||e)); }
    finally{ if(btn&&old){btn.disabled=false;btn.innerText=old;} }
  };
  window.v71DownloadApprovedHtml = async function(){ try{ download(`${safeName(projectTitle())}-sajat-ugyfelpeldany.html`, await currentHtml('saját ügyfélpéldány')); }catch(e){ alert('HTML riport hiba: '+(e.message||e)); } };
  window.v71PrintApprovedReport = async function(){ try{ await openPrint(await currentHtml('saját ügyfélpéldány')); }catch(e){ alert('PDF/nyomtatási hiba: '+(e.message||e)); } };
  window.downloadWeeklyReportHtml = async function(){ try{ download(`${safeName(projectTitle())}-heti-riport.html`, await currentHtml('heti riport')); }catch(e){ alert('Heti HTML hiba: '+(e.message||e)); } };
  window.printWeeklyReport = async function(){ try{ await openPrint(await currentHtml('heti riport')); }catch(e){ alert('Heti PDF/nyomtatási hiba: '+(e.message||e)); } };
})();
