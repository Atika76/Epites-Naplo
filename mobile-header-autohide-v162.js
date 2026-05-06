// V162 – mobil fejléc viselkedés: lefelé görgetésnél eltűnik, visszagörgetésnél azonnal előjön.
(function(){
  if (window.__epitesNaploMobileHeaderAutoHideV162) return;
  window.__epitesNaploMobileHeaderAutoHideV162 = true;

  function init(){
    var header = document.querySelector('.topbar, .top');
    if (!header) return;
    var lastY = window.scrollY || 0;
    var ticking = false;

    function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 860px)').matches; }
    function menuOpen(){
      var nav = document.getElementById('nav') || header.querySelector('nav');
      return !!(nav && (nav.classList.contains('open') || nav.classList.contains('navOpen')));
    }
    function show(){ document.body.classList.remove('v162MobileHeaderHidden'); }
    function hide(){ document.body.classList.add('v162MobileHeaderHidden'); }
    function update(){
      ticking = false;
      if (!isMobile() || menuOpen()) { show(); lastY = window.scrollY || 0; return; }
      var y = window.scrollY || 0;
      var diff = y - lastY;
      if (y < 30 || diff < -3) show();
      else if (diff > 5 && y > 90) hide();
      lastY = y;
    }
    window.addEventListener('scroll', function(){
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, {passive:true});
    window.addEventListener('resize', function(){ if (!isMobile()) show(); }, {passive:true});
    document.addEventListener('click', function(e){ if (e.target.closest('.menuBtn')) show(); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
