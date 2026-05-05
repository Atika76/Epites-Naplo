// V87 - ügyfél kérdés/észrevétel + AI szakmai kiegészítés a saját jóváhagyott riportba
// Csak a riport tartalmát egészíti ki. Más működést nem változtat.
(function(){
  if (window.__v87ClientQuestionAiReportFix) return;
  window.__v87ClientQuestionAiReportFix = true;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const msgOf = row => row?.client_comment || row?.message || row?.client_message || row?.approval_message || row?.question || row?.question_text || row?.note || row?.comment || '';
  const normalizeAi = (entry = {}) => entry.ai_json || entry.analysis || entry.ai || {};
  const clean = v => String(v || '').trim();

  function buildAiProfessionalBlock(entries){
    entries = Array.isArray(entries) ? entries : [];
    const items = [];
    entries.forEach((e, idx) => {
      const ai = normalizeAi(e);
      const title = clean(ai.title || e.ai_title || e.phase || ('Bejegyzés ' + (idx + 1)));
      const professional = clean(ai.professionalSummary || ai.photoTextCheck || ai.customerSummary || ai.nextStep || '');
      const advice = Array.isArray(ai.advice) ? ai.advice.filter(Boolean) : [];
      const checklist = Array.isArray(ai.checklist) ? ai.checklist.filter(Boolean) : [];
      const risks = Array.isArray(ai.risks) ? ai.risks.filter(Boolean) : [];
      const lines = [];
      if (professional) lines.push(`<p>${esc(professional)}</p>`);
      const list = [...advice, ...checklist, ...risks].slice(0, 6);
      if (list.length) lines.push(`<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
      if (clean(ai.nextStep)) lines.push(`<p><b>Következő szakmai lépés:</b> ${esc(ai.nextStep)}</p>`);
      if (lines.length) items.push(`<article class="v87AiItem"><h3>${esc(title)}</h3>${lines.join('')}</article>`);
    });
    const fallback = `<p>A riportban szereplő AI szakmai kontroll a kivitelezési folyamat fő ellenőrzési pontjait rögzíti. Különösen fontos: rétegrend, tömörítés, szint, lejtés, vízelvezetés, fotódokumentáció és a következő munkafázis előtti ellenőrzés.</p>`;
    return `<section class="v87AiProfessional"><h2>AI szakmai elemzés / kivitelezői megjegyzés</h2>${items.length ? items.join('') : fallback}</section>`;
  }

  function buildClientBlock(row){
    const msg = msgOf(row);
    if(!msg) return '';
    return `<section class="v87ClientQuestion"><h2>Ügyfél kérdése / észrevétele</h2><p>${esc(msg).replace(/\n/g,'<br>')}</p></section>`;
  }

  function css(){ return `<style>
    .v87ClientQuestion{margin:22px 0;padding:16px 18px;border-left:5px solid #f59e0b;background:#fff7ed;border-radius:12px;color:#111827;break-inside:avoid;page-break-inside:avoid}.v87ClientQuestion h2{margin:0 0 8px;color:#111827}.v87ClientQuestion p{white-space:pre-wrap;margin:0;color:#111827}
    .v87AiProfessional{margin:22px 0;padding:16px 18px;border-left:5px solid #22c55e;background:#ecfdf5;border-radius:12px;color:#111827;break-inside:avoid;page-break-inside:avoid}.v87AiProfessional h2{margin:0 0 10px;color:#111827}.v87AiProfessional h3{margin:10px 0 6px;color:#111827}.v87AiProfessional p,.v87AiProfessional li{color:#111827}.v87AiItem{margin:10px 0;padding:10px 12px;background:#ffffff;border:1px solid #bbf7d0;border-radius:10px}
  </style>`; }

  function insertBeforeDaily(html, block){
    let out = String(html || '');
    if(!block || out.includes('v87ClientQuestion') && out.includes('v87AiProfessional')) return out;
    if(out.includes('</head>')) out = out.replace('</head>', css() + '</head>');
    const marker = /<h2[^>]*>\s*Napi bejegyzések\s*<\/h2>/i;
    if(marker.test(out)) return out.replace(marker, block + '$&');
    return out.replace('</body>', block + '</body>');
  }

  // A teljes jóváhagyott saját példánynál is garantáltan bekerül a kérdés + AI elemzés.
  const oldDownload = window.v71DownloadApprovedHtml;
  const oldPrint = window.v71PrintApprovedReport;

  async function getApprovalRow(id){
    try { const r = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(r) return r; } catch(_) {}
    try {
      const st = (typeof detailState !== 'undefined' ? detailState : window.detailState || {});
      const pid = st?.project?.id || new URLSearchParams(location.search).get('id');
      const rows = await window.EpitesNaploAPI?.getReportApprovals?.(pid);
      return (rows || []).find(x => String(x.id) === String(id)) || null;
    } catch(_) { return null; }
  }

  function currentEntries(){
    try { return (typeof detailState !== 'undefined' && Array.isArray(detailState.entries)) ? detailState.entries : (Array.isArray(window.detailState?.entries) ? window.detailState.entries : []); } catch(_) { return []; }
  }

  async function enhancedHtml(id){
    const row = await getApprovalRow(id);
    let html = row?.approved_report_html || row?.report_html_snapshot || row?.report_html || '';
    if(!html || html.length < 500 || /tartalma nem található/i.test(html)) {
      // Ha a mentett snapshot üres, a v86 saját építőjére hagyatkozunk, de utána még kiegészítjük.
      if(typeof oldDownload === 'function') return null;
    }
    const extra = buildClientBlock(row || {}) + buildAiProfessionalBlock(currentEntries());
    return insertBeforeDaily(html, extra);
  }

  window.v71DownloadApprovedHtml = async function(id){
    try {
      const row = await getApprovalRow(id);
      let html = await enhancedHtml(id);
      if(!html && typeof oldDownload === 'function') return oldDownload(id);
      const name = ((document.querySelector('h1')?.textContent || 'epitesi-naplo') + '-jovahagyott-riport.html').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
      const blob = new Blob([html], {type:'text/html;charset=utf-8'});
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();}, 1500);
      try { await window.EpitesNaploAPI?.saveReportDocument?.({ projectId: (typeof detailState !== 'undefined' ? detailState?.project?.id : window.detailState?.project?.id), approvalId:id, title:'Jóváhagyott riport ügyfélkérdéssel és AI elemzéssel', type:'approved_full_copy_v87', html, text:document.body.innerText || '', meta:{ v87:true, client_comment:msgOf(row||{}) } }); } catch(_) {}
    } catch(e) { if(typeof oldDownload === 'function') return oldDownload(id); alert(e.message || e); }
  };

  window.v71PrintApprovedReport = async function(id){
    try {
      let html = await enhancedHtml(id);
      if(!html && typeof oldPrint === 'function') return oldPrint(id);
      const w = window.open('', '_blank'); if(!w) return alert('A böngésző blokkolta az új ablakot.');
      w.document.open(); w.document.write(html); w.document.close(); setTimeout(()=>{try{w.focus();w.print()}catch(_){}}, 800);
    } catch(e) { if(typeof oldPrint === 'function') return oldPrint(id); alert(e.message || e); }
  };

  // Ha új ügyfélriport link készül, a friss riport HTML-be is bekerül az AI szakmai blokk.
  const oldBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(typeof oldBuild === 'function'){
    const wrapped = function(entries, title, options){
      const html = oldBuild(entries, title, options);
      return insertBeforeDaily(html, buildAiProfessionalBlock(entries));
    };
    window.buildProReportHtml = wrapped;
    try { buildProReportHtml = wrapped; } catch(_) {}
  }
})();
