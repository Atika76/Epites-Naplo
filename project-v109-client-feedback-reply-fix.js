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
