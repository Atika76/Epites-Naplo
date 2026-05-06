// V160 MOBIL RIPORT NÉZET FIX
// Csak megjelenést javít mobilon: fejléc szélesség, riport középre igazítás, about:blank/PDF ablak mobilbarát CSS.
(function(){
  if(window.__epitesNaploMobileReportV160) return;
  window.__epitesNaploMobileReportV160 = true;

  var MOBILE_CSS = `
    @media screen and (max-width: 860px){
      html,body{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important;-webkit-text-size-adjust:100%!important;}
      body{margin:0!important;box-sizing:border-box!important;}
      .topbar,.top,header{width:100vw!important;max-width:100vw!important;min-width:0!important;left:0!important;right:0!important;margin-left:calc(50% - 50vw)!important;margin-right:calc(50% - 50vw)!important;border-radius:0!important;box-sizing:border-box!important;}
      .topbar{padding-left:14px!important;padding-right:14px!important;}
      .topbar .brand,.brand{min-width:0!important;}
      main,.doc,.reportWrap,.publicReportCard,#publicReportContent,.content,.container,.page,section{width:100%!important;max-width:100%!important;min-width:0!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important;}
      body > main, body > .doc, body > .reportWrap, body > .publicReportCard, body > #publicReportContent{padding-left:12px!important;padding-right:12px!important;}
      h1{font-size:26px!important;line-height:1.16!important;letter-spacing:-.4px!important;} h2{font-size:21px!important;line-height:1.22!important;} h3{font-size:18px!important;line-height:1.24!important;}
      p,li,td,th{font-size:15px!important;line-height:1.45!important;}
      .cover{width:100%!important;max-width:100%!important;margin-left:auto!important;margin-right:auto!important;padding:16px!important;}
      .stats{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;width:100%!important;max-width:100%!important;}
      .stat{min-width:0!important;overflow-wrap:anywhere!important;}
      .entry{width:100%!important;max-width:100%!important;margin:14px auto!important;padding:14px!important;box-sizing:border-box!important;}
      .photos,.v74Photos,.v77Photos,.entryImageGrid,.reportImageGrid,.v68ReportPhotos,.v117Photos{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;justify-content:center!important;width:100%!important;max-width:100%!important;}
      .photo,.v67ReportPhoto,figure,.reportMediaTile{width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;box-sizing:border-box!important;}
      .photo img,.v67ReportPhoto img,figure img,.reportMediaTile img,img.reportPhoto{width:100%!important;max-width:100%!important;height:auto!important;aspect-ratio:1/1!important;object-fit:cover!important;display:block!important;}
      table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;white-space:nowrap!important;}
      img,video{max-width:100%!important;}
    }
  `;

  function addStyle(doc){
    try{
      doc = doc || document;
      if(!doc || !doc.head || doc.getElementById('epitesnaplo-mobile-v160-style')) return;
      var st = doc.createElement('style');
      st.id = 'epitesnaplo-mobile-v160-style';
      st.textContent = MOBILE_CSS;
      doc.head.appendChild(st);
    }catch(e){}
  }
  addStyle(document);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ addStyle(document); });

  function injectIntoHtml(html){
    html = String(html || '');
    if(html.indexOf('epitesnaplo-mobile-v160-style') !== -1) return html;
    var style = '<style id="epitesnaplo-mobile-v160-style">'+MOBILE_CSS.replace(/<\/style/gi,'')+'</style>';
    if(/<\/head>/i.test(html)) return html.replace(/<\/head>/i, style+'</head>');
    if(/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, function(m){ return m+style; });
    return '<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+style+'</head><body>'+html+'</body></html>';
  }

  var originalOpen = window.open;
  if(typeof originalOpen === 'function' && !window.__epitesNaploOpenPatchedV160){
    window.__epitesNaploOpenPatchedV160 = true;
    window.open = function(){
      var w = originalOpen.apply(window, arguments);
      try{
        if(w && w.document && !w.__epitesNaploDocWriteV160){
          w.__epitesNaploDocWriteV160 = true;
          var originalWrite = w.document.write.bind(w.document);
          w.document.write = function(html){
            return originalWrite(injectIntoHtml(html));
          };
          setTimeout(function(){ try{ addStyle(w.document); }catch(e){} }, 80);
          setTimeout(function(){ try{ addStyle(w.document); }catch(e){} }, 500);
        }
      }catch(e){}
      return w;
    };
  }
})();
