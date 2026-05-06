// V162 – mobil riport megnyitás javítás
// Csak a mentett riport "Megnyitás" / "PDF" gomb mobilos about:blank nézetét javítja.
(function(){
  if (window.__epitesNaploMobileReportOpenV162) return;
  window.__epitesNaploMobileReportOpenV162 = true;

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c;
    });
  }
  function projectId(){
    try { return window.detailState?.project?.id || new URLSearchParams(location.search).get('id') || 'local'; }
    catch(_) { return 'local'; }
  }
  function safeName(v){
    return String(v || 'epitesi-naplo-riport')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
      .slice(0,90) || 'epitesi-naplo-riport';
  }
  async function listDocs(){
    var rows = [];
    try {
      if (window.EpitesNaploAPI?.listReportDocuments && projectId() !== 'local') {
        rows = await window.EpitesNaploAPI.listReportDocuments(projectId());
      }
    } catch(e) { console.warn('V162 riport lista Supabase hiba:', e); }
    var local = [];
    ['v77_report_docs_','v75_report_docs_','v74_report_docs_'].forEach(function(pref){
      try {
        var arr = JSON.parse(localStorage.getItem(pref + projectId()) || '[]');
        if (Array.isArray(arr)) local = local.concat(arr);
      } catch(_) {}
    });
    return [].concat(rows || [], local || []);
  }
  async function findDoc(id){
    var docs = await listDocs();
    return docs.find(function(d){ return String(d.id) === String(id); });
  }
  function mobileCss(){
    return '<style id="v162MobileReportFix">' +
      'html,body{margin:0!important;min-width:0!important;max-width:100%!important;overflow-x:hidden!important;background:#fff!important;-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important;}' +
      'body{padding:24px!important;font-family:Arial,Helvetica,sans-serif!important;line-height:1.48!important;color:#111827!important;}' +
      '.doc,.publicReportCard,.reportWrap,main{width:100%!important;max-width:min(100%,1080px)!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important;}' +
      'img,video,table{max-width:100%!important;box-sizing:border-box!important;}' +
      'table{width:100%!important;border-collapse:collapse!important;}' +
      '.entry,.cover,.section,.invoice,.aiBox{box-sizing:border-box!important;}' +
      '@media(max-width:760px){' +
        'body{padding:12px!important;font-size:16px!important;line-height:1.45!important;width:100%!important;}' +
        '.doc,.publicReportCard,.reportWrap,main{width:100%!important;max-width:100%!important;margin:0 auto!important;padding:0!important;}' +
        '.cover,.entry,.section,.invoice,.aiBox{width:100%!important;max-width:100%!important;margin:14px auto!important;padding:14px!important;border-radius:14px!important;}' +
        'h1{font-size:24px!important;line-height:1.15!important;letter-spacing:-.2px!important;overflow-wrap:anywhere!important;}' +
        'h2{font-size:20px!important;line-height:1.2!important;overflow-wrap:anywhere!important;}' +
        'h3{font-size:17px!important;line-height:1.25!important;}' +
        'p,li,td,th,div{overflow-wrap:anywhere!important;}' +
        '.stats{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;width:100%!important;}' +
        '.stat{min-width:0!important;padding:11px!important;}' +
        '.photos,.v134Photos,.v121Photos,.entryImageGrid,.reportImageGrid,.v68ReportPhotos,.v117Photos{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;justify-content:stretch!important;align-items:start!important;width:100%!important;}' +
        '.photo,.v121Photo,.v134Photo,figure,.v67ReportPhoto,.reportMediaTile{width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;margin:0!important;display:block!important;}' +
        '.photo img,.v121Photo img,.v134Photo img,figure img,.photos img,.entryImageGrid img,.reportImageGrid img,.v68ReportPhotos img,.v117Photos img{width:100%!important;max-width:100%!important;height:128px!important;max-height:128px!important;object-fit:cover!important;display:block!important;}' +
        'table{display:block!important;overflow-x:auto!important;white-space:nowrap!important;}' +
      '}' +
      '@media print{body{padding:0!important}.doc,.publicReportCard,.reportWrap,main{max-width:none!important}}' +
    '</style>';
  }
  function normalizeHtml(html){
    var out = String(html || '<p>Nincs riport tartalom.</p>');
    if (!/<!doctype|<html[\s>]/i.test(out)) {
      out = '<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Építési napló riport</title></head><body><main class="doc">' + out + '</main></body></html>';
    }
    if (!/<head[\s>]/i.test(out)) {
      out = out.replace(/<html[^>]*>/i, function(m){ return m + '<head><meta charset="utf-8"></head>'; });
    }
    if (!/<meta\s+name=["']viewport["']/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, function(m){ return m + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'; });
    }
    if (!/<meta\s+charset=/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, function(m){ return m + '<meta charset="utf-8">'; });
    }
    if (!/id=["']v162MobileReportFix["']/i.test(out)) {
      out = out.replace(/<\/head>/i, mobileCss() + '</head>');
    }
    return out;
  }
  function openHtml(html, printNow){
    var w = window.open('', '_blank');
    if (!w) {
      alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakokat.');
      return;
    }
    var finalHtml = normalizeHtml(html);
    w.document.open();
    w.document.write(finalHtml);
    w.document.close();
    if (printNow) {
      var waitImages = function(){
        try {
          return Promise.all(Array.prototype.slice.call(w.document.images || []).map(function(img){
            return img.complete ? Promise.resolve() : new Promise(function(resolve){
              img.onload = img.onerror = resolve;
              setTimeout(resolve, 2600);
            });
          }));
        } catch(_) { return Promise.resolve(); }
      };
      setTimeout(function(){ waitImages().then(function(){ try { w.focus(); w.print(); } catch(_){} }); }, 500);
    }
  }
  function downloadHtml(name, html){
    var blob = new Blob([normalizeHtml(html)], {type:'text/html;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name || 'epitesi-naplo-riport.html';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1200);
  }
  function setBusy(button, text){
    if (!button) return function(){};
    var old = button.innerHTML;
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = text || 'Megnyitás…';
    return function(){ button.disabled = false; button.classList.remove('is-loading'); button.innerHTML = old; };
  }

  document.addEventListener('click', async function(e){
    var b = e.target && e.target.closest && e.target.closest('[data-v77-open],[data-v77-pdf],[data-v77-down]');
    if (!b) return;
    if (!b.dataset.v77Open && !b.dataset.v77Pdf && !b.dataset.v77Down) return;

    // Csak a riport megnyitás/nyomtatás/HTML mentés mobilos ablakát vesszük át.
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    var done = setBusy(b, b.dataset.v77Pdf ? 'PDF…' : (b.dataset.v77Down ? 'HTML…' : 'Megnyitás…'));
    try {
      var id = b.dataset.v77Open || b.dataset.v77Pdf || b.dataset.v77Down;
      var d = await findDoc(id);
      if (!d) { alert('Nem találom a mentett riportot.'); return; }
      var html = d.html_content || d.html || d.report_html || d.report_html_snapshot || '';
      if (b.dataset.v77Down) downloadHtml(safeName(d.title || 'epitesi-naplo-riport') + '.html', html);
      else openHtml(html, !!b.dataset.v77Pdf);
    } catch(err) {
      console.error(err);
      alert(err && err.message ? err.message : 'A riport megnyitása nem sikerült.');
    } finally {
      done();
    }
  }, true);
})();
