// V88 - csak két javítás: ügyfél kérdés/észrevétel bekerül a teljes saját riportba + mobilos riportnézet javítása
(function(){
  if(window.__v88ClientQuestionMobileReportFix) return;
  window.__v88ClientQuestionMobileReportFix = true;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const pid = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const ptitle = () => state()?.project?.name || document.querySelector('h1')?.textContent || 'Építési napló';
  const msgOf = row => row?.client_comment || row?.message || row?.client_message || row?.approval_message || row?.question || row?.question_text || row?.note || row?.comment || '';
  const decisionOf = row => String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase();
  const labelOf = d => (d === 'accepted' || d === 'approved') ? 'Elfogadva / jóváhagyva' : d === 'question' ? 'Kérdése van' : 'Megtekintve';
  const rowDate = row => (typeof formatDate === 'function' ? formatDate(row?.approved_at || row?.created_at || '') : String(row?.approved_at || row?.created_at || '').replace('T',' ').slice(0,19));
  const safeName = v => String(v || 'riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'riport';
  const isBad = html => !html || String(html).length < 700 || /tartalma nem található|snapshot nem|adatok nem tolthetok|nem található/i.test(String(html));

  function mobileCss(){ return `<style id="v88MobileReportCss">
    html,body{max-width:100%;overflow-x:hidden}.publicReportCard,.report-card,.reportShell{max-width:min(1050px,calc(100vw - 20px))!important;box-sizing:border-box!important;overflow:hidden!important;margin-left:auto!important;margin-right:auto!important}
    #publicReportContent,#publicReportContent *{box-sizing:border-box;max-width:100%}#publicReportContent{overflow-wrap:anywhere;word-break:normal}
    #publicReportContent h1,h1{font-size:clamp(30px,9vw,62px)!important;line-height:1.06!important;word-break:break-word}#publicReportContent h2,h2{font-size:clamp(22px,6.5vw,34px)!important;line-height:1.15!important}#publicReportContent h3,h3{font-size:clamp(18px,5vw,26px)!important;line-height:1.2!important}
    #publicReportContent p,#publicReportContent li,#publicReportContent td,#publicReportContent th{font-size:clamp(14px,3.8vw,17px)!important;line-height:1.42!important}#publicReportContent img{height:auto!important;object-fit:cover}
    #publicReportContent table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important;display:table!important;overflow:visible!important}#publicReportContent th,#publicReportContent td{white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;padding:8px 6px!important;vertical-align:top!important}
    @media(max-width:640px){body{padding:0!important}.publicHero{padding:22px 14px!important}.publicHero h1{font-size:clamp(30px,10vw,48px)!important}.publicActions{display:flex!important;gap:8px!important;flex-wrap:wrap!important}.publicReportView{padding:12px!important}.publicReportCard{padding:14px!important;border-radius:16px!important}#publicReportContent table{font-size:14px!important}#publicReportContent th:nth-child(3),#publicReportContent td:nth-child(3){display:none!important}.v86ApprovalStamp,.v87ClientQuestion,.v87AiProfessional,.v88ClientQuestion,.v88AiProfessional{padding:12px!important;margin:14px 0!important}}
    @media print{html,body{overflow:visible!important}.publicReportCard{max-width:100%!important;overflow:visible!important}#publicReportContent th:nth-child(3),#publicReportContent td:nth-child(3){display:table-cell!important}}
  </style>`; }

  function aiFromEntry(e = {}){ return e.ai_json || e.analysis || e.ai || {}; }
  function clean(v){ return String(v || '').trim(); }
  function buildAiBlock(entries){
    entries = Array.isArray(entries) ? entries : [];
    const items = [];
    entries.forEach((e, idx) => {
      const ai = aiFromEntry(e);
      const title = clean(ai.title || e.ai_title || e.phase || e.title || ('Bejegyzés ' + (idx + 1)));
      const textParts = [ai.professionalSummary, ai.customerSummary, ai.photoTextCheck, ai.nextStep, e.ai_summary, e.ai_text].map(clean).filter(Boolean);
      const list = [];
      ['advice','checklist','risks','warnings','tasks'].forEach(k => { if(Array.isArray(ai[k])) ai[k].filter(Boolean).slice(0,4).forEach(x => list.push(x)); });
      const body = [];
      if(textParts[0]) body.push(`<p>${esc(textParts[0])}</p>`);
      if(list.length) body.push(`<ul>${list.slice(0,7).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`);
      if(body.length) items.push(`<article class="v88AiItem"><h3>${esc(title)}</h3>${body.join('')}</article>`);
    });
    const fallback = `<p>A riportban szereplő AI szakmai kontroll a kivitelezési folyamat fő ellenőrzési pontjait rögzíti. Különösen fontos: rétegrend, tömörítés, szint, lejtés, vízelvezetés, fotódokumentáció és a következő munkafázis előtti ellenőrzés.</p>`;
    return `<section class="v88AiProfessional"><h2>AI szakmai elemzés / kivitelezői megjegyzés</h2>${items.length ? items.join('') : fallback}</section>`;
  }
  function clientBlock(row){
    const msg = msgOf(row);
    if(!msg) return '';
    return `<section class="v88ClientQuestion"><h2>Ügyfél kérdése / észrevétele</h2><p>${esc(msg).replace(/\n/g,'<br>')}</p></section>`;
  }
  function extraCss(){ return `${mobileCss()}<style id="v88QuestionAiCss">
    .v88ClientQuestion{margin:22px 0;padding:16px 18px;border-left:5px solid #f59e0b;background:#fff7ed;border-radius:12px;color:#111827;break-inside:avoid;page-break-inside:avoid}.v88ClientQuestion h2{margin:0 0 8px;color:#111827}.v88ClientQuestion p{white-space:pre-wrap;margin:0;color:#111827}
    .v88AiProfessional{margin:22px 0;padding:16px 18px;border-left:5px solid #22c55e;background:#ecfdf5;border-radius:12px;color:#111827;break-inside:avoid;page-break-inside:avoid}.v88AiProfessional h2{margin:0 0 10px;color:#111827}.v88AiProfessional h3{margin:10px 0 6px;color:#111827}.v88AiProfessional p,.v88AiProfessional li{color:#111827}.v88AiItem{margin:10px 0;padding:10px 12px;background:#ffffff;border:1px solid #bbf7d0;border-radius:10px}
  </style>`; }
  function ensureHtml(html){
    let out = String(html || '');
    if(!/<!doctype|<html/i.test(out)) out = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ptitle())}</title></head><body>${out}</body></html>`;
    if(!/<meta name="viewport"/i.test(out)) out = out.replace('<head>', '<head><meta name="viewport" content="width=device-width,initial-scale=1">');
    if(!out.includes('v88MobileReportCss')) out = out.includes('</head>') ? out.replace('</head>', extraCss() + '</head>') : out.replace('<body', `<head>${extraCss()}</head><body`);
    return out;
  }
  function insertBlocks(html, row, entries){
    let out = ensureHtml(html);
    const blocks = `${clientBlock(row)}${buildAiBlock(entries)}`;
    if(clientBlock(row) && !out.includes('v88ClientQuestion')){
      const marker = /<h2[^>]*>\s*(Napi bejegyzések|Munka közben|Vezetői AI összefoglaló)\s*<\/h2>/i;
      out = marker.test(out) ? out.replace(marker, clientBlock(row) + '$&') : out.replace('</body>', clientBlock(row) + '</body>');
    }
    if(!out.includes('v88AiProfessional')){
      const marker = /<h2[^>]*>\s*Napi bejegyzések\s*<\/h2>/i;
      out = marker.test(out) ? out.replace(marker, buildAiBlock(entries) + '$&') : out.replace('</body>', buildAiBlock(entries) + '</body>');
    }
    return out;
  }
  async function approvalRow(id){
    try{ const r = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(r) return r; }catch(_){}
    try{ const rows = await window.EpitesNaploAPI?.getReportApprovals?.(pid()); return (rows || []).find(r => String(r.id) === String(id)) || null; }catch(_){ return null; }
  }
  async function reportDoc(id){ try{ return await window.EpitesNaploAPI?.getReportDocumentByApproval?.(id); }catch(_){ return null; } }
  async function freshReportHtml(){
    const closeData = await window.EpitesNaploAPI?.getProjectCloseData?.(pid());
    const entries = closeData?.entries || state()?.entries || [];
    const builder = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
    if(typeof builder === 'function') return { html: builder(entries, `${ptitle()} – jóváhagyott riport`, closeData || {}), entries };
    return { html:`<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ptitle())}</title></head><body><h1>${esc(ptitle())}</h1><p>A riport pillanatnyilag nem építhető újra.</p></body></html>`, entries };
  }
  async function fullApprovedHtml(id){
    const row = await approvalRow(id);
    if(!row) throw new Error('Nem találom az ügyfél jóváhagyást. Frissítsd az oldalt.');
    let html = row.approved_report_html || row.report_html_snapshot || row.report_html || '';
    const doc = isBad(html) ? await reportDoc(id) : null;
    if(doc?.html_content && !isBad(doc.html_content)) html = doc.html_content;
    let entries = state()?.entries || [];
    if(isBad(html)){
      const fresh = await freshReportHtml();
      html = fresh.html;
      entries = fresh.entries || entries;
    }
    return { row, html: insertBlocks(html, row, entries) };
  }
  function downloadHtml(name, html){ const blob = new Blob([html || ''], {type:'text/html;charset=utf-8'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1500); }

  window.v71DownloadApprovedHtml = async function(id){
    try{
      const r = await fullApprovedHtml(id);
      downloadHtml(`${safeName(ptitle())}-${safeName(labelOf(decisionOf(r.row)))}-teljes-jovahagyott-riport.html`, r.html);
      try{ await window.EpitesNaploAPI?.saveReportDocument?.({ projectId:pid(), approvalId:id, title:`${ptitle()} – teljes jóváhagyott saját példány`, type:'approved_full_copy_v88', html:r.html, text:(new DOMParser().parseFromString(r.html,'text/html').body?.innerText || ''), meta:{ v88:true, decision:decisionOf(r.row), client_comment:msgOf(r.row) } }); }catch(e){ console.warn(e); }
      try{ if(typeof showToast === 'function') showToast('Teljes jóváhagyott riport letöltve és mentve.', 'ok'); }catch(_){}
    }catch(e){ alert(e.message || e); }
  };
  window.v71PrintApprovedReport = async function(id){
    try{
      const r = await fullApprovedHtml(id);
      const w = window.open('', '_blank'); if(!w) return alert('A böngésző blokkolta az új ablakot.');
      w.document.open(); w.document.write(r.html); w.document.close(); setTimeout(()=>{try{w.focus();w.print()}catch(_){}},800);
      try{ await window.EpitesNaploAPI?.saveReportDocument?.({ projectId:pid(), approvalId:id, title:`${ptitle()} – teljes jóváhagyott PDF példány`, type:'approved_full_pdf_v88', html:r.html, text:(new DOMParser().parseFromString(r.html,'text/html').body?.innerText || ''), meta:{ v88:true, decision:decisionOf(r.row), client_comment:msgOf(r.row) } }); }catch(_){}
    }catch(e){ alert(e.message || e); }
  };

  // Az újonnan készülő ügyfélriport HTML-je is mobilbarát legyen.
  const oldBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(typeof oldBuild === 'function' && !oldBuild.__v88Wrapped){
    const wrapped = function(entries, title, options){
      const html = oldBuild(entries, title, options);
      return ensureHtml(html);
    };
    wrapped.__v88Wrapped = true;
    window.buildProReportHtml = wrapped;
    try{ buildProReportHtml = wrapped; }catch(_){}
  }
})();
