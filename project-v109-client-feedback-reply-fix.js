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

// ===== V112: saját példány HTML tisztítás + kiskép fix (nem új logint érintő javítás) =====
(function(){
  'use strict';
  if(window.__epitesNaploV112OwnCopyCleanFix) return;
  window.__epitesNaploV112OwnCopyCleanFix = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeName = v => String(v || 'epitesi-naplo-riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo-riport';
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Építési napló';
  const decisionOf = row => String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase();
  const labelOf = d => (d === 'accepted' || d === 'approved') ? 'Elfogadva / jóváhagyva' : d === 'question' ? 'Kérdése van' : 'Megtekintve';
  const messageOf = row => String(row?.client_comment || row?.message || row?.client_message || row?.approval_message || row?.question || row?.question_text || row?.note || row?.comment || '').trim();
  const isCode = txt => /function\s*\(|=>\s*\{|window\.|document\.|querySelector|addEventListener|EpitesNaploAPI|supabase|<\/script>|const\s+|let\s+|var\s+/i.test(String(txt || ''));

  function ensureFullHtml(html){
    let out = String(html || '');
    if(!/<!doctype|<html/i.test(out)) out = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(projectTitle())}</title><link rel="icon" href="https://epitesi-naplo.eu/favicon.png"></head><body>${out}</body></html>`;
    return out;
  }

  function cleanReportHtml(html){
    html = ensureFullHtml(html);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,.v77Lightbox,.v79ReportLightbox,.v86Lightbox,.v100Lightbox,.v102Lightbox,.v103Lightbox,.v105Lightbox,.v110Gallery,.mediaViewerModal,.reportMediaPending').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(a => { if(/^on/i.test(a.name)) el.removeAttribute(a.name); });
    });
    // Ha egy kép src/alt mezőjébe véletlenül JS-kód került, az egész hibás csempét kivesszük.
    doc.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-full-src') || '';
      const alt = img.getAttribute('alt') || '';
      if(!src || isCode(src) || isCode(alt) || src.length > 2200){
        const tile = img.closest('figure,.photo,.reportMediaTile,.v67ReportPhoto,.v74Photo,.v77Photo,li,div') || img;
        tile.remove();
        return;
      }
      img.removeAttribute('srcset');
      img.setAttribute('loading','lazy');
      img.setAttribute('decoding','async');
      img.style.removeProperty('width');
      img.style.removeProperty('height');
      img.style.cursor = 'zoom-in';
    });
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const badTexts = [];
    while(walker.nextNode()){
      const n = walker.currentNode;
      const t = n.textContent || '';
      if(isCode(t)) badTexts.push(n);
    }
    badTexts.forEach(n => {
      const p = n.parentElement;
      if(!p) return n.remove();
      // Ne töröljünk nagy teljes szekciót, csak a kódot tartalmazó levélelemet vagy magát a text node-ot.
      if(!p.querySelector('img,video') && p.children.length < 3) p.remove(); else n.remove();
    });
    doc.querySelectorAll('a').forEach(a => {
      if(a.querySelector('img,video') || /index\.html|project\.html/i.test(a.getAttribute('href') || '')){
        a.removeAttribute('href'); a.removeAttribute('target'); a.style.cursor='zoom-in';
      }
    });
    const old = doc.getElementById('v112-own-copy-css'); if(old) old.remove();
    const css = doc.createElement('style');
    css.id = 'v112-own-copy-css';
    css.textContent = `
      body{background:#fff!important;color:#111827!important;font-family:Arial,Helvetica,sans-serif!important;line-height:1.45!important}.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhotos,.v68ReportPhotos,.v74Photos,.v77Photos{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(112px,112px))!important;gap:10px!important;align-items:start!important;justify-content:start!important}.reportMediaTile,.v67ReportPhoto,.v74Photo,.v77Photo,.photos figure,figure,.photo{width:112px!important;max-width:112px!important;min-height:132px!important;background:#fff!important;border:1px solid #d1d5db!important;border-radius:10px!important;padding:4px!important;margin:0!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}.reportMediaTile img,.v67ReportPhoto img,.v74Photo img,.v77Photo img,.photos img,.entryImageGrid img,.reportImageGrid img,figure img,img.reportPhoto{display:block!important;width:102px!important;max-width:102px!important;height:102px!important;max-height:102px!important;object-fit:cover!important;border-radius:8px!important;cursor:zoom-in!important;background:#f8fafc!important}.v112Lightbox{position:fixed!important;inset:0!important;background:rgba(2,6,23,.92)!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:999999!important;padding:56px 18px 28px!important}.v112Lightbox img{max-width:94vw!important;max-height:84vh!important;width:auto!important;height:auto!important;object-fit:contain!important;border-radius:12px!important;background:#111!important}.v112Close,.v112Prev,.v112Next{position:fixed!important;border:0!important;border-radius:999px!important;background:#fbbf24!important;color:#111827!important;font-weight:900!important;cursor:pointer!important}.v112Close{right:16px!important;top:14px!important;padding:9px 13px!important}.v112Prev,.v112Next{top:50%!important;transform:translateY(-50%)!important;width:42px!important;height:42px!important;font-size:28px!important}.v112Prev{left:12px!important}.v112Next{right:12px!important}@media(max-width:720px){body{padding:12px!important}.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhotos,.v68ReportPhotos,.v74Photos,.v77Photos{grid-template-columns:repeat(2,112px)!important}}@media print{.v112Lightbox,.v112Close,.v112Prev,.v112Next{display:none!important}.photos,.entryImageGrid,.reportImageGrid,.v67ReportPhotos,.v68ReportPhotos,.v74Photos,.v77Photos{grid-template-columns:repeat(4,30mm)!important}.reportMediaTile,.v67ReportPhoto,.v74Photo,.v77Photo,.photos figure,figure,.photo{width:30mm!important;max-width:30mm!important;min-height:34mm!important}.reportMediaTile img,.v67ReportPhoto img,.v74Photo img,.v77Photo img,.photos img,.entryImageGrid img,.reportImageGrid img,figure img,img.reportPhoto{width:28mm!important;max-width:28mm!important;height:28mm!important;max-height:28mm!important}}
    `;
    doc.head.appendChild(css);
    const lb = doc.createElement('script');
    lb.textContent = `(function(){function imgs(){return Array.from(document.querySelectorAll('img')).filter(function(i){return i.src&&!i.closest('.v112Lightbox')})}function close(){document.querySelectorAll('.v112Lightbox').forEach(function(x){x.remove()})}function openAt(i){var list=imgs();if(!list.length)return;var idx=Math.max(0,Math.min(i,list.length-1));close();var box=document.createElement('div');box.className='v112Lightbox';function render(){box.innerHTML='<button class="v112Close" type="button">Bezárás ×</button>'+(list.length>1?'<button class="v112Prev" type="button">‹</button><button class="v112Next" type="button">›</button>':'')+'<img alt="Nagyított napló kép">';box.querySelector('img').src=list[idx].src;box.querySelector('.v112Close').onclick=function(e){e.preventDefault();e.stopPropagation();close()};var p=box.querySelector('.v112Prev'),n=box.querySelector('.v112Next');if(p)p.onclick=function(e){e.preventDefault();e.stopPropagation();idx=(idx-1+list.length)%list.length;render()};if(n)n.onclick=function(e){e.preventDefault();e.stopPropagation();idx=(idx+1)%list.length;render()};}render();box.onclick=function(e){if(e.target===box)close()};document.body.appendChild(box)}document.addEventListener('click',function(e){var img=e.target.closest&&e.target.closest('img');if(!img||img.closest('.v112Lightbox'))return;e.preventDefault();e.stopPropagation();openAt(imgs().indexOf(img))},true);document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});})();`;
    doc.body.appendChild(lb);
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }


  function reportExpectedPhotoCount(html){
    const txt = String(html || '').replace(/<[^>]+>/g,' ');
    const m = txt.match(/(\d+)\s*fot[óo]/i);
    return m ? Number(m[1]) : 0;
  }
  function reportImageCount(html){
    const doc = new DOMParser().parseFromString(ensureFullHtml(html), 'text/html');
    return [...doc.querySelectorAll('img')].filter(img => {
      const src = img.getAttribute('src') || '';
      const alt = (img.getAttribute('alt') || '').toLowerCase();
      return src && !alt.includes('ikon') && !src.includes('favicon');
    }).length;
  }
  function snapshotMissingImages(html){
    const expected = reportExpectedPhotoCount(html);
    return expected > 0 && reportImageCount(html) < expected;
  }

  function isBadSnapshot(html){
    const s = String(html || '');
    const plain = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return !plain.trim() || plain.length < 500 || isCode(s) || plain.includes('hianyzo riport azonosito') || plain.includes('a riport nem talalhato') || plain.includes('riport betoltesi hiba');
  }

  async function getApproval(id){
    try{ const row = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(row) return row; }catch(_){ }
    try{ const rows = await window.EpitesNaploAPI?.getReportApprovals?.(projectId()); return (rows || []).find(r => String(r.id) === String(id)) || null; }catch(_){ return null; }
  }
  async function buildFreshReport(){
    const data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId()).catch(()=>null);
    const entries = data?.entries || state()?.entries || [];
    const builder = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
    return builder ? builder(entries, `${projectTitle()} – ügyfélriport`, data || {}) : `<h1>${esc(projectTitle())}</h1><p>A riport most nem építhető újra.</p>`;
  }
  function stamp(html,row){
    const msg = messageOf(row);
    let out = cleanReportHtml(html);
    const doc = new DOMParser().parseFromString(out, 'text/html');
    if(!doc.querySelector('.v112ApprovalStamp')){
      const stamp = doc.createElement('section');
      stamp.className = 'v112ApprovalStamp';
      stamp.setAttribute('style','border:2px solid #22c55e;background:#ecfdf5;color:#111827;padding:14px 16px;margin:0 0 18px;border-radius:14px;');
      stamp.innerHTML = `<b>Jóváhagyott ügyfélpéldány</b><br>Állapot: ${esc(labelOf(decisionOf(row)))}<br>Ügyfél: ${esc(row?.client_name || row?.client_email || 'Nincs megadva')}${msg ? `<div style="margin-top:10px;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:10px;"><b>Ügyfél kérdése / észrevétele:</b><br>${esc(msg).replace(/\n/g,'<br>')}</div>` : ''}`;
      doc.body.insertBefore(stamp, doc.body.firstChild);
    }
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }
  async function approvedHtml(id){
    const row = await getApproval(id);
    if(!row) throw new Error('Nem találom az ügyfél visszajelzést. Frissítsd az oldalt.');
    let html = row.approved_report_html || row.report_html_snapshot || row.report_html || '';
    if(isBadSnapshot(html) || snapshotMissingImages(html)){
      try{ const doc = await window.EpitesNaploAPI?.getReportDocumentByApproval?.(id); if(doc?.html_content && !isBadSnapshot(doc.html_content) && !snapshotMissingImages(doc.html_content)) html = doc.html_content; }catch(_){ }
    }
    if(isBadSnapshot(html) || snapshotMissingImages(html)) html = await buildFreshReport();
    return { row, html: stamp(html,row) };
  }
  async function documentHtml(id){
    let d = null;
    try{ const docs = await window.EpitesNaploAPI?.listReportDocuments?.(projectId()); d = (docs || []).find(x => String(x.id) === String(id)); }catch(_){ }
    if(!d){
      for(const pref of ['v77_report_docs_','v75_report_docs_','v74_report_docs_']){
        try{ const arr = JSON.parse(localStorage.getItem(pref + projectId()) || '[]'); d = arr.find(x => String(x.id) === String(id)); if(d) break; }catch(_){ }
      }
    }
    if(!d) throw new Error('Nem találom a mentett riportot.');
    let html = d.html_content || d.html || '';
    if(isBadSnapshot(html) || snapshotMissingImages(html)) html = await buildFreshReport();
    return { doc:d, html: cleanReportHtml(html) };
  }
  function downloadFile(name, html){
    const blob = new Blob([html || ''], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(url); a.remove();}, 1200);
  }
  function openHtml(html, printNow){
    const w = window.open('', '_blank');
    if(!w) return alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakokat.');
    w.document.open(); w.document.write(html); w.document.close();
    if(printNow) setTimeout(()=>{try{w.focus();w.print();}catch(_){ }}, 900);
  }

  window.v71DownloadApprovedHtml = async function(id){
    try{ const r = await approvedHtml(id); downloadFile(`${safeName(projectTitle())}-${safeName(labelOf(decisionOf(r.row)))}-jovahagyott-riport.html`, r.html); }
    catch(e){ alert('HTML riport hiba: ' + (e.message || e)); }
  };
  window.v71PrintApprovedReport = async function(id){
    try{ const r = await approvedHtml(id); openHtml(r.html, true); }
    catch(e){ alert('PDF/nyomtatási hiba: ' + (e.message || e)); }
  };
  window.v75DownloadSavedReport = async function(id){
    try{ const r = await documentHtml(id); downloadFile(`${safeName(r.doc?.title || projectTitle())}.html`, r.html); }
    catch(e){ alert('HTML mentési hiba: ' + (e.message || e)); }
  };
  window.v75PrintSavedReport = async function(id){
    try{ const r = await documentHtml(id); openHtml(r.html, true); }
    catch(e){ alert('PDF/nyomtatási hiba: ' + (e.message || e)); }
  };

  document.addEventListener('click', function(e){
    const b = e.target.closest && e.target.closest('[data-v75-open],[data-v75-pdf],[data-v77-open],[data-v77-pdf],[data-v77-down],[data-v109-copy],[data-v109-pdf]');
    if(!b) return;
    // Csak a megnyitás/HTML/PDF saját példányokat vesszük át, törlést nem.
    if(b.dataset.v77Down || b.dataset.v77Open || b.dataset.v75Open || b.dataset.v109Copy){
      e.preventDefault(); e.stopImmediatePropagation();
      return (b.dataset.v109Copy || b.dataset.v77Down) ? window.v71DownloadApprovedHtml(b.dataset.v109Copy || b.dataset.v77Down) : window.v75DownloadSavedReport(b.dataset.v77Open || b.dataset.v75Open);
    }
    if(b.dataset.v77Pdf || b.dataset.v75Pdf || b.dataset.v109Pdf){
      e.preventDefault(); e.stopImmediatePropagation();
      return (b.dataset.v109Pdf) ? window.v71PrintApprovedReport(b.dataset.v109Pdf) : window.v75PrintSavedReport(b.dataset.v77Pdf || b.dataset.v75Pdf);
    }
  }, true);
})();


// ===== V114 riport kiskep javitas: minden riport/sajat peldany kepet a napi bejegyzesekbol epit ujra =====
(function(){
  'use strict';
  if(window.__v114ReportImageFix) return; window.__v114ReportImageFix = true;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uniq = arr => [...new Set((arr || []).map(x => String(x || '').trim()).filter(Boolean))];
  function collectFrom(value, out){
    if(!value) return;
    if(Array.isArray(value)){ value.forEach(v => collectFrom(v,out)); return; }
    if(typeof value === 'object'){
      const o=value;
      ['url','src','path','image','image_url','storage_path','file_path','publicUrl','signedUrl'].forEach(k=>{ if(o[k]) collectFrom(o[k], out); });
      ['images','imageUrls','image_urls','photos','beforeImages','afterImages','generalImages','before_images_json','after_images_json','general_images_json','media'].forEach(k=>{ if(o[k]) collectFrom(o[k], out); });
      return;
    }
    const s=String(value||'').trim();
    if(!s) return;
    if(/^(blob:|javascript:|function\s*\(|\(function|window\.|document\.|const\s+|let\s+|var\s+)/i.test(s)) return;
    if(/\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(s) || /^data:image\//i.test(s) || /^https?:\/\//i.test(s)) out.push(s);
  }
  function entryImages(entry){
    const out=[];
    try{ if(window.__v114OldGetEntryImages) collectFrom(window.__v114OldGetEntryImages(entry), out); }catch(_){ }
    collectFrom(entry?.images,out); collectFrom(entry?.image_urls,out); collectFrom(entry?.image_url,out); collectFrom(entry?.image,out);
    collectFrom(entry?.before_images_json,out); collectFrom(entry?.after_images_json,out); collectFrom(entry?.general_images_json,out);
    collectFrom(entry?.beforeImages,out); collectFrom(entry?.afterImages,out); collectFrom(entry?.generalImages,out);
    collectFrom(entry?.ai_json,out); collectFrom(entry?.analysis,out);
    return uniq(out);
  }
  try{ if(typeof getEntryImages === 'function' && !window.__v114OldGetEntryImages) window.__v114OldGetEntryImages = getEntryImages; }catch(_){ }
  try{ getEntryImages = entryImages; }catch(_){ }
  window.getEntryImages = entryImages;

  function countImgs(html){ try{ return new DOMParser().parseFromString(String(html||''),'text/html').querySelectorAll('img').length; }catch(_){ return 0; } }
  function expected(entries){ return (entries||[]).reduce((s,e)=>s+entryImages(e).length,0); }
  function photoHtml(imgs){
    return `<div class="photos v114Photos">${imgs.map((src,i)=>`<figure class="v67ReportPhoto"><img src="${esc(src)}" data-full-src="${esc(src)}" alt="Napló fotó ${i+1}" loading="lazy" decoding="async"><figcaption>Nagyítás</figcaption></figure>`).join('')}</div>`;
  }
  function fallbackReport(entries,title,options){
    const safeEntries = Array.isArray(entries) ? entries : [];
    const mats = Array.isArray(options?.materials) ? options.materials : [];
    const invoices = Array.isArray(options?.invoices) ? options.invoices : [];
    const invSum = invoices.reduce((s,x)=>s+(Number(x.amount||x.gross_amount||x.total||0)||0),0);
    const rows = safeEntries.map(e=>{
      const imgs=entryImages(e);
      const note = e?.note || e?.description || e?.text || '';
      const date = e?.created_at ? new Date(e.created_at).toLocaleString('hu-HU') : '';
      const mats = Array.isArray(e?.materials_json) ? e.materials_json : (Array.isArray(e?.materials)?e.materials:[]);
      const weather = e?.weather || e?.weather_json?.summary || e?.weather_json?.text || '';
      const gps = e?.location_address || e?.gps_json?.address || e?.gps || '';
      return `<section class="entry"><h2>${esc(date)} – ${esc(e?.phase||'Napi bejegyzés')}</h2><p>${esc(note).replace(/\n/g,'<br>')}</p><p><b>Dokumentáció:</b> ${imgs.length} fotó, 0 videó.</p>${weather?`<p><b>Időjárás:</b> ${esc(weather)}</p>`:''}${gps?`<p><b>GPS/helyadat:</b> ${esc(gps)}</p>`:''}${mats.length?`<p><b>Napi anyag:</b> ${mats.map(m=>`${esc(m.name||m.megnevezes||'Anyag')} ${esc(m.quantity||m.mennyiseg||'')} ${esc(m.unit||m.egyseg||'')}`).join(', ')}</p>`:''}<h3>Munka közben / dokumentáció</h3><p>Kattints bármelyik fotóra a nagyításhoz.</p>${imgs.length?photoHtml(imgs):'<p>Ehhez a bejegyzéshez nincs csatolt fotó.</p>'}</section>`;
    }).join('');
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title||'Építési napló riport')}</title><link rel="icon" href="https://epitesi-naplo.eu/favicon.png"><style>body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:24px;line-height:1.45}.doc{max-width:1080px;margin:auto}.badge{display:inline-block;background:#fff2bf;color:#8a5a00;border-radius:999px;padding:7px 13px;font-weight:700}.cover{border-bottom:4px solid #f5a400;padding-bottom:16px;margin-bottom:20px}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:18px 0}.stat{background:#f3f4f6;border-radius:12px;padding:14px}.stat b{display:block;color:#d97706;font-size:24px}.entry{border-left:4px solid #f5a400;background:#fafafa;margin:22px 0;padding:18px 22px;break-inside:avoid}.photos{display:grid;grid-template-columns:repeat(auto-fill,112px);gap:10px}.v67ReportPhoto{width:112px;max-width:112px;min-height:132px;border:1px solid #d1d5db;border-radius:12px;background:#fff;padding:5px;margin:0;overflow:hidden}.v67ReportPhoto img{width:102px;height:102px;object-fit:cover;border-radius:9px;cursor:zoom-in}.v67ReportPhoto figcaption{font-size:11px;color:#64748b}@media print{.photos{grid-template-columns:repeat(4,30mm)!important}.v67ReportPhoto{width:30mm!important;min-height:34mm!important}.v67ReportPhoto img{width:28mm!important;height:28mm!important}}</style></head><body><div class="doc"><div class="cover"><span class="badge">Átadásra kész dokumentáció</span><h1>${esc(title||'Építési napló riport')}</h1><p>Generálva: ${new Date().toLocaleString('hu-HU')} • ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>${safeEntries.length}</b>bejegyzés</div><div class="stat"><b>${expected(safeEntries)}</b>fotó</div><div class="stat"><b>0</b>videó</div><div class="stat"><b>0</b>magas kockázat</div><div class="stat"><b>${invSum.toLocaleString('hu-HU')} Ft</b>számlák</div></div></div><h2>Rövid összegzés</h2><p>A dokumentum az ügyfélnek átadható, rendezett építési napló: napi munka, fotódokumentáció, anyagok, időjárás/GPS és nyitott ellenőrzések egy helyen.</p><h2>Napi bejegyzések</h2>${rows}</div></body></html>`;
  }
  function injectMissing(html, entries){
    const exp=expected(entries); if(!exp) return html;
    if(countImgs(html)>=exp) return html;
    return fallbackReport(entries, (detailState?.project?.name||'Építési napló')+' – ügyfélriport', {});
  }
  const oldBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(typeof oldBuild === 'function' && !oldBuild.__v114Images){
    const wrapped = function(entries,title,options){
      let html=''; try{ html=oldBuild(entries,title,options); }catch(e){ console.warn('Régi riportépítő hiba, V114 fallback:', e); }
      const exp=expected(entries); if(exp && countImgs(html)<exp) return fallbackReport(entries,title,options||{});
      return html;
    };
    wrapped.__v114Images=true; window.buildProReportHtml=wrapped; try{ buildProReportHtml=wrapped; }catch(_){ }
  }
})();

// ===== V115 VALÓDI RIPORT KÉP JAVÍTÁS: nem csak DB mezőből, hanem a látható napló képeiből is épít =====
(function(){
  'use strict';
  if(window.__v115RealReportImagesFix) return; window.__v115RealReportImagesFix = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const pid = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Építési napló projekt';
  const uniq = arr => [...new Set((arr || []).map(x => String(x || '').trim()).filter(Boolean))];
  function isImgUrl(s){
    s = String(s || '').trim();
    if(!s) return false;
    if(/^(javascript:|blob:|function\s*\(|\(function|window\.|document\.|const\s+|let\s+|var\s+)/i.test(s)) return false;
    return /^data:image\//i.test(s) || /^https?:\/\//i.test(s) || /^\.\//.test(s) || /^\//.test(s) || /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(s);
  }
  function collect(value, out){
    if(!value) return;
    if(Array.isArray(value)){ value.forEach(v => collect(v,out)); return; }
    if(typeof value === 'object'){
      const o=value;
      ['url','src','href','path','image','image_url','storage_path','file_path','publicUrl','signedUrl','dataUrl'].forEach(k => collect(o[k], out));
      ['images','imageUrls','image_urls','photos','beforeImages','afterImages','generalImages','before_images_json','after_images_json','general_images_json','media','ai_json','analysis'].forEach(k => collect(o[k], out));
      return;
    }
    const s=String(value||'').trim(); if(isImgUrl(s)) out.push(s);
  }
  function entryImages(e){ const out=[]; collect(e,out); return uniq(out); }
  function domImages(){
    const roots = [document.getElementById('projectTimeline'), document.getElementById('timelineList'), document.querySelector('.timeline'), document.querySelector('main')].filter(Boolean);
    const out=[];
    roots.forEach(root => root.querySelectorAll('img').forEach(img => {
      const alt=(img.alt||'').toLowerCase();
      const cls=(img.className||'').toString().toLowerCase();
      if(alt.includes('ikon') || cls.includes('brand') || cls.includes('logo')) return;
      const src = img.getAttribute('data-full-src') || img.getAttribute('data-src') || img.currentSrc || img.src || '';
      if(isImgUrl(src)) out.push(src);
    }));
    return uniq(out);
  }
  function allImages(entries){
    const fromEntries = uniq((entries||[]).flatMap(entryImages));
    const fromDom = domImages();
    return uniq([...fromEntries, ...fromDom]);
  }
  function imgGrid(imgs){
    return `<div class="photos v115Photos">${imgs.map((src,i)=>`<figure class="v67ReportPhoto"><img src="${esc(src)}" data-full-src="${esc(src)}" alt="Napló fotó ${i+1}" loading="lazy" decoding="async"><figcaption>Nagyítás</figcaption></figure>`).join('')}</div>`;
  }
  function countImgs(html){ try{ return new DOMParser().parseFromString(String(html||''),'text/html').querySelectorAll('img[src],img[data-full-src],img[data-src]').length; }catch(_){ return 0; } }
  function css(){ return `<style id="v115-real-report-images-css">
    .photos,.v115Photos,.entryImageGrid,.reportImageGrid{display:grid!important;grid-template-columns:repeat(auto-fill,112px)!important;gap:10px!important;align-items:start!important;justify-content:start!important;margin:12px 0!important}.v67ReportPhoto,.photos figure,figure.photo{width:112px!important;max-width:112px!important;min-height:132px!important;border:1px solid #d1d5db!important;border-radius:12px!important;background:#fff!important;padding:5px!important;margin:0!important;box-sizing:border-box!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}.v67ReportPhoto img,.photos img,.v115Photos img,.entryImageGrid img,.reportImageGrid img{width:102px!important;height:102px!important;max-width:102px!important;max-height:102px!important;object-fit:cover!important;border-radius:9px!important;display:block!important;cursor:zoom-in!important;background:#f8fafc!important}.v67ReportPhoto figcaption,.photos figcaption{font-size:11px!important;color:#64748b!important;line-height:1.2!important;margin-top:4px!important}.v115Lightbox{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.94);display:flex;align-items:center;justify-content:center;padding:70px 60px 30px}.v115Lightbox img{max-width:96vw!important;max-height:86vh!important;width:auto!important;height:auto!important;object-fit:contain!important;border-radius:14px!important;background:#000}.v115Lightbox button{position:fixed;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:900;cursor:pointer}.v115Close{top:14px;right:14px;padding:10px 14px}.v115Prev,.v115Next{top:50%;transform:translateY(-50%);width:46px;height:70px;font-size:34px}.v115Prev{left:12px}.v115Next{right:12px}@media(max-width:760px){.photos,.v115Photos,.entryImageGrid,.reportImageGrid{grid-template-columns:repeat(3,92px)!important}.v67ReportPhoto,.photos figure,figure.photo{width:92px!important;min-height:112px!important}.v67ReportPhoto img,.photos img,.v115Photos img,.entryImageGrid img,.reportImageGrid img{width:82px!important;height:82px!important}.v115Lightbox{padding:62px 8px 20px}.v115Prev,.v115Next{width:38px;height:56px;font-size:28px}}@media print{.v115Lightbox{display:none!important}.photos,.v115Photos{grid-template-columns:repeat(4,30mm)!important}.v67ReportPhoto{width:30mm!important;min-height:34mm!important}.v67ReportPhoto img{width:28mm!important;height:28mm!important}}
  </style>`; }
  function script(){ return `<script>(function(){var idx=0;function imgs(){return Array.prototype.slice.call(document.querySelectorAll('.photos img,.v115Photos img,.entryImageGrid img,.reportImageGrid img')).filter(function(i){return i.src&&!i.closest('.v115Lightbox')});}function open(n){var list=imgs();if(!list.length)return;idx=Math.max(0,Math.min(n,list.length-1));var d=document.querySelector('.v115Lightbox');if(!d){d=document.createElement('div');d.className='v115Lightbox';document.body.appendChild(d);}function draw(){d.innerHTML='<button class="v115Close" type="button">Bezárás ×</button><button class="v115Prev" type="button">‹</button><img src="'+list[idx].src.replace(/"/g,'&quot;')+'" alt="Napló fotó"><button class="v115Next" type="button">›</button>';d.querySelector('.v115Close').onclick=function(){d.remove()};d.querySelector('.v115Prev').onclick=function(e){e.stopPropagation();idx=(idx-1+list.length)%list.length;draw()};d.querySelector('.v115Next').onclick=function(e){e.stopPropagation();idx=(idx+1)%list.length;draw()};}draw();d.onclick=function(e){if(e.target===d)d.remove();};}document.addEventListener('click',function(e){var img=e.target.closest&&e.target.closest('.photos img,.v115Photos img,.entryImageGrid img,.reportImageGrid img');if(!img)return;e.preventDefault();e.stopPropagation();open(imgs().indexOf(img));},true);document.addEventListener('keydown',function(e){var d=document.querySelector('.v115Lightbox');if(!d)return;if(e.key==='Escape')d.remove();if(e.key==='ArrowLeft')d.querySelector('.v115Prev')?.click();if(e.key==='ArrowRight')d.querySelector('.v115Next')?.click();});})();<\/script>`; }
  function ensureFull(html){
    let out=String(html||'');
    if(!/<!doctype|<html/i.test(out)) out=`<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${esc(projectTitle())}</title><link rel="icon" href="https://epitesi-naplo.eu/favicon.png"></head><body>${out}</body></html>`;
    if(!out.includes('v115-real-report-images-css')) out = out.includes('</head>') ? out.replace('</head>', css()+'</head>') : css()+out;
    if(!out.includes('v115Lightbox')) out = out.includes('</body>') ? out.replace('</body>', script()+'</body>') : out+script();
    return out;
  }
  function injectImages(html, imgs){
    if(!imgs.length) return ensureFull(html);
    let out=String(html||'');
    if(countImgs(out) >= imgs.length) return ensureFull(out);
    const block = `<h3>Munka közben / dokumentáció</h3><p>Kattints bármelyik fotóra a nagyításhoz.</p>${imgGrid(imgs)}`;
    if(/Kattints bármelyik fotóra a nagyításhoz\.?/i.test(out)) out = out.replace(/(<p[^>]*>\s*Kattints bármelyik fotóra a nagyításhoz\.?\s*<\/p>)/i, `$1${imgGrid(imgs)}`);
    else if(/(<h3[^>]*>\s*Munka közben[\s\S]*?<\/h3>)/i.test(out)) out = out.replace(/(<h3[^>]*>\s*Munka közben[\s\S]*?<\/h3>)/i, `$1<p>Kattints bármelyik fotóra a nagyításhoz.</p>${imgGrid(imgs)}`);
    else if(/<\/section>/i.test(out)) out = out.replace(/<\/section>/i, `${block}</section>`);
    else out += block;
    return ensureFull(out);
  }
  function fallback(entries,title,options){
    const all=allImages(entries);
    const entry = (entries||[])[0] || {};
    const inv = Array.isArray(options?.invoices)?options.invoices:[];
    const sum=inv.reduce((s,x)=>s+(Number(x.amount||0)||0),0);
    const date = entry?.created_at ? new Date(entry.created_at).toLocaleString('hu-HU') : '';
    const note = entry?.note || '';
    return ensureFull(`<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title||projectTitle()+' – ügyfélriport')}</title><link rel="icon" href="https://epitesi-naplo.eu/favicon.png"><style>body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:24px;line-height:1.45}.doc{max-width:980px;margin:auto}.cover{border-bottom:4px solid #f5a400;margin-bottom:20px;padding-bottom:16px}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.stat{background:#f3f4f6;border-radius:10px;padding:12px}.stat b{display:block;color:#d97706;font-size:22px}.entry{border-left:4px solid #f5a400;background:#fafafa;margin:18px 0;padding:16px 18px}</style></head><body><div class="doc"><div class="cover"><h1>${esc(title||projectTitle()+' – ügyfélriport')}</h1><p>Generálva: ${new Date().toLocaleString('hu-HU')} • ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>${(entries||[]).length}</b>bejegyzés</div><div class="stat"><b>${all.length}</b>fotó</div><div class="stat"><b>0</b>videó</div><div class="stat"><b>0</b>magas kockázat</div><div class="stat"><b>${sum.toLocaleString('hu-HU')} Ft</b>számlák</div></div></div><h2>Rövid összegzés</h2><p>A dokumentum az ügyfélnek átadható, rendezett építési napló.</p><section class="entry"><h2>${esc(date)} – ${esc(entry?.phase||'Napi bejegyzés')}</h2><p>${esc(note).replace(/\n/g,'<br>')}</p><p><b>Dokumentáció:</b> ${all.length} fotó, 0 videó.</p><h3>Munka közben / dokumentáció</h3><p>Kattints bármelyik fotóra a nagyításhoz.</p>${imgGrid(all)}</section></div></body></html>`);
  }
  const oldBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(typeof oldBuild === 'function' && !oldBuild.__v115RealImages){
    const wrapped = function(entries,title,options){
      const imgs = allImages(entries);
      let html=''; try{ html=oldBuild(entries,title,options); }catch(e){ console.warn('V115 riportépítő fallback:', e); }
      if(!html || (imgs.length && countImgs(html) < imgs.length)) return injectImages(html || fallback(entries,title,options||{}), imgs);
      return ensureFull(html);
    };
    wrapped.__v115RealImages=true; window.buildProReportHtml=wrapped; try{ buildProReportHtml=wrapped; }catch(_){ }
  }

  async function closeDataWithDom(){
    let data=null; try{ data = await window.EpitesNaploAPI?.getProjectCloseData?.(pid()); }catch(_){ }
    data = data || {};
    const entries = (Array.isArray(data.entries) && data.entries.length) ? data.entries : (state()?.entries || []);
    const imgs = allImages(entries);
    if(imgs.length){
      const copy = entries.length ? entries.map((e,i)=> i===0 ? {...e, images: uniq([...entryImages(e), ...imgs]), image_urls: uniq([...entryImages(e), ...imgs]), generalImages: uniq([...entryImages(e), ...imgs])} : e) : [{ phase:'Napi dokumentáció', note:'Fotódokumentáció', images:imgs, image_urls:imgs, generalImages:imgs, created_at:new Date().toISOString() }];
      data.entries = copy;
    } else data.entries = entries;
    return data;
  }

  // A legfontosabb: az ügyfél linket és riportokat már a képekkel feltöltött adatból készítjük.
  window.createProjectClientLinkV25 = async function(){
    if(!state()?.project) return alert('Nincs projekt.');
    const btn = document.activeElement;
    const old = btn && btn.tagName==='BUTTON' ? btn.innerText : '';
    try{
      if(btn && old){ btn.disabled=true; btn.innerText='Ügyfél link készül...'; }
      const data = await closeDataWithDom();
      const title = `${projectTitle()} – ügyfélriport`;
      const builder = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
      const html = builder ? builder(data.entries || [], title, data) : fallback(data.entries||[], title, data);
      const text = `${title}\nBejegyzések: ${(data.entries||[]).length}\nFotók: ${allImages(data.entries||[]).length}`;
      const saved = await window.EpitesNaploAPI.createPublicReport({ projectId: pid(), projectName: projectTitle(), reportHtml: html, reportText: text });
      const link = window.EpitesNaploAPI.createClientShareUrl(saved.token);
      try{ await navigator.clipboard.writeText(link); }catch(_){ }
      if(typeof showProjectHelp === 'function') showProjectHelp('Ügyfél link elkészült', `<div class="featureHelpBox"><b>Biztonságos ügyfél link</b><p>A link kimásolva. A riportban a fotók is benne vannak, kattintható kisképként.</p><p><a class="btn primary" target="_blank" href="${esc(link)}">Ügyfélriport megnyitása</a></p><p class="muted">${esc(link)}</p></div>`);
      else alert('Ügyfél link elkészült: '+link);
    }catch(e){ console.error(e); alert('Ügyfél link létrehozási hiba: ' + (e.message || e)); }
    finally{ if(btn && old){ btn.disabled=false; btn.innerText=old; } }
  };

  async function buildCurrentHtml(titleSuffix){
    const data = await closeDataWithDom();
    const title = `${projectTitle()} – ${titleSuffix || 'riport'}`;
    const builder = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
    return builder ? builder(data.entries || [], title, data) : fallback(data.entries || [], title, data);
  }
  const oldV71Html = window.v71DownloadApprovedHtml;
  const oldV71Pdf = window.v71PrintApprovedReport;
  function download(name, html){ const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1200); }
  function safeName(s){ return String(s||'riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'riport'; }
  window.v71DownloadApprovedHtml = async function(id){
    try{
      let html = await buildCurrentHtml('saját ügyfélpéldány');
      download(`${safeName(projectTitle())}-sajat-ugyfelpeldany.html`, html);
    }catch(e){ if(oldV71Html) return oldV71Html(id); alert('HTML riport hiba: '+(e.message||e)); }
  };
  window.v71PrintApprovedReport = async function(id){
    try{
      const html = await buildCurrentHtml('saját ügyfélpéldány');
      const w=window.open('', '_blank'); if(!w) return alert('A böngésző blokkolta az új ablakot.');
      w.document.open(); w.document.write(html); w.document.close(); setTimeout(()=>{try{w.focus();w.print();}catch(_){ }},800);
    }catch(e){ if(oldV71Pdf) return oldV71Pdf(id); alert('PDF/nyomtatási hiba: '+(e.message||e)); }
  };
})();
