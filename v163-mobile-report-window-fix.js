// V163 – CSAK mobilos riport ablak szélesség/olvashatóság javítás
// Nem módosít adatot, Supabase-t, képnézőt vagy riportmotort.
(function(){
  if(window.__epitesNaploV163ReportWindowPatch) return;
  window.__epitesNaploV163ReportWindowPatch = true;

  var css = `
<style id="epites-v163-mobile-report-window-css">
@media screen and (max-width: 820px){
  html,body{width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;overflow-x:hidden!important;-webkit-text-size-adjust:100%!important;}
  body{padding:10px!important;font-size:15px!important;line-height:1.45!important;background:#fff!important;}
  main,.doc,.v74Doc,.publicReportCard,.reportWrap,#publicReportContent{width:100%!important;max-width:100%!important;min-width:0!important;margin-left:auto!important;margin-right:auto!important;padding-left:0!important;padding-right:0!important;box-sizing:border-box!important;overflow-wrap:anywhere!important;}
  .cover,.v74Cover,.entry,.v74Entry,.section,.v74Section,.invoice,.aiBox,.v74Ai{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;}
  .cover,.v74Cover{padding:14px 12px!important;margin:0 0 14px!important;border-radius:12px!important;}
  .entry,.v74Entry,.section,.v74Section,.invoice,.aiBox,.v74Ai{padding:12px!important;margin:12px 0!important;border-radius:12px!important;}
  h1{font-size:24px!important;line-height:1.15!important;letter-spacing:0!important;margin:12px 0 8px!important;}
  h2{font-size:20px!important;line-height:1.2!important;margin:14px 0 8px!important;}
  h3{font-size:17px!important;line-height:1.25!important;}
  p,li,td,th,.note,.v74EntryText,.v74Facts{font-size:14px!important;line-height:1.45!important;}
  table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;}
  .stats,.v74Stats{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin:12px 0!important;}
  .stat,.v74Stat{padding:9px!important;min-width:0!important;}
  .stat b,.v74Stat b{font-size:18px!important;}
  .photos,.v74Photos,.entryImageGrid,.reportImageGrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;align-items:start!important;justify-content:stretch!important;}
  .photo,.v74Photo,figure,.reportMediaTile{width:100%!important;max-width:100%!important;height:auto!important;aspect-ratio:1/1!important;min-height:0!important;box-sizing:border-box!important;}
  .photo img,.v74Photo img,figure img,.photos img,.entryImageGrid img,.reportImageGrid img,.reportMediaTile img{width:100%!important;height:100%!important;max-width:100%!important;max-height:none!important;object-fit:cover!important;}
  #v77Lightbox img,.v74Lightbox img{max-width:96vw!important;max-height:86vh!important;object-fit:contain!important;}
}
@media screen and (max-height:520px) and (orientation:landscape){
  body{padding:8px!important;}
  .cover,.v74Cover{padding:10px!important;margin-bottom:10px!important;}
  .entry,.v74Entry,.section,.v74Section,.invoice,.aiBox,.v74Ai{padding:10px!important;margin:10px 0!important;}
  h1{font-size:22px!important;} h2{font-size:18px!important;} h3{font-size:16px!important;}
  .stats,.v74Stats{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:6px!important;}
  .stat,.v74Stat{padding:7px!important;font-size:12px!important;}
  .stat b,.v74Stat b{font-size:16px!important;}
  .photos,.v74Photos,.entryImageGrid,.reportImageGrid{grid-template-columns:repeat(4,minmax(0,1fr))!important;}
}
</style>`;

  function shouldPatch(html){
    html = String(html || '');
    return /ÉpítésNapló|epitesi-naplo|építési napló|client_report|publicReportCard|v74Doc|class="doc"|class='doc'|Napi bejegyzések/i.test(html);
  }
  function patchHtml(html){
    if(typeof html !== 'string' || !shouldPatch(html) || html.indexOf('epites-v163-mobile-report-window-css') !== -1) return html;
    if(!/<meta\s+name=["']viewport["']/i.test(html)){
      html = html.replace(/<head[^>]*>/i, function(m){ return m + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'; });
    } else {
      html = html.replace(/<meta\s+name=["']viewport["'][^>]*>/i, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
    }
    if(/<\/head>/i.test(html)) return html.replace(/<\/head>/i, css + '</head>');
    return css + html;
  }

  var oldOpen = window.open;
  window.open = function(){
    var w = oldOpen.apply(window, arguments);
    try{
      if(w && w.document && !w.document.__epitesV163WritePatch){
        w.document.__epitesV163WritePatch = true;
        var oldWrite = w.document.write.bind(w.document);
        w.document.write = function(){
          var args = Array.prototype.slice.call(arguments).map(function(x){ return typeof x === 'string' ? patchHtml(x) : x; });
          return oldWrite.apply(w.document, args);
        };
      }
    }catch(e){}
    return w;
  };
})();
