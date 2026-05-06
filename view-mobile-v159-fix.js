/* V159 – mobil ügyfélriport igazítás.
   Nem nyúl a képnéző működéséhez, csak a régi mentett riport HTML fix szélességeit teszi mobilbaráttá. */
(function(){
  'use strict';
  if(window.__epitesNaploViewMobileV159Fix) return;
  window.__epitesNaploViewMobileV159Fix = true;

  function isMobile(){
    return window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  }

  function normalizeReportWidths(){
    if(!isMobile()) return;
    var root = document.getElementById('publicReportContent');
    if(!root) return;

    root.style.width = '100%';
    root.style.maxWidth = '100%';
    root.style.marginLeft = 'auto';
    root.style.marginRight = 'auto';

    var blocks = root.querySelectorAll('div,section,article,main,table,ul,ol');
    blocks.forEach(function(el){
      el.style.maxWidth = '100%';
      var st = (el.getAttribute('style') || '').toLowerCase();
      if(st.indexOf('width') !== -1 || st.indexOf('margin-left') !== -1 || st.indexOf('transform') !== -1){
        if(el.tagName !== 'IMG' && el.tagName !== 'VIDEO'){
          el.style.width = '100%';
          el.style.marginLeft = 'auto';
          el.style.marginRight = 'auto';
        }
      }
    });
  }

  function compactHeaderOnMobile(){
    if(!isMobile()) return;
    var top = document.querySelector('.top');
    if(top){
      top.style.position = 'relative';
      top.style.top = 'auto';
    }
  }

  function run(){
    compactHeaderOnMobile();
    normalizeReportWidths();
  }

  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('load', run);
  window.addEventListener('resize', run);
  setTimeout(run, 500);
  setTimeout(run, 1500);
  setTimeout(run, 3000);

  var target = document.getElementById('publicReportContent');
  if(target && window.MutationObserver){
    new MutationObserver(function(){ setTimeout(run, 60); }).observe(target, {childList:true, subtree:true});
  }else if(window.MutationObserver){
    document.addEventListener('DOMContentLoaded', function(){
      var r = document.getElementById('publicReportContent');
      if(r) new MutationObserver(function(){ setTimeout(run, 60); }).observe(r, {childList:true, subtree:true});
    });
  }
})();
