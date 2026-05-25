// V180 REAL FIX – CSAK fejléc scroll működés
// Lefelé eltűnik, felfelé azonnal visszajön. Nyitott hamburger/riport menünél látható marad.
(function(){
  if(window.__EPITES_NAPLO_V180_REAL_HEADER_SCROLL_FIX__) return;
  window.__EPITES_NAPLO_V180_REAL_HEADER_SCROLL_FIX__ = true;

  var HIDE_AFTER_Y = 72;
  var DOWN_DELTA = 5;
  var UP_DELTA = 1;
  var lastPageY = getPageY();
  var lastTouchY = null;
  var ticking = false;
  var observed = false;
  var lastScrollByTarget = new WeakMap();

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  function getPageY(){
    var se = document.scrollingElement || document.documentElement || document.body;
    return Math.max(0, window.scrollY || window.pageYOffset || (se && se.scrollTop) || document.documentElement.scrollTop || document.body.scrollTop || 0);
  }

  function headers(){
    return Array.prototype.slice.call(document.querySelectorAll('.topbar, .top'));
  }

  function isSmallScreen(){
    return (window.innerWidth || document.documentElement.clientWidth || 9999) <= 860;
  }

  function getMenuPieces(header){
    var nav = header.querySelector('nav') || document.getElementById('nav');
    var reportMenu = document.getElementById('reportMenu');
    var menuBtn = header.querySelector('.menuBtn, .reportMenuBtn') || document.querySelector('.menuBtn, .reportMenuBtn');
    return { nav: nav, reportMenu: reportMenu, menuBtn: menuBtn };
  }

  function isMenuOpen(header){
    var parts = getMenuPieces(header);
    var navOpen = false;
    if(parts.nav && isSmallScreen()){
      navOpen = parts.nav.classList.contains('open') || parts.nav.classList.contains('navOpen');
    }
    var reportOpen = !!(parts.reportMenu && parts.reportMenu.classList.contains('open'));
    var btnOpen = !!(parts.menuBtn && parts.menuBtn.getAttribute('aria-expanded') === 'true');
    return navOpen || reportOpen || btnOpen;
  }

  function anyMenuOpen(){
    var hs = headers();
    for(var i=0;i<hs.length;i++) if(isMenuOpen(hs[i])) return true;
    return false;
  }

  function applyVisible(show, reason){
    var pageY = getPageY();
    var hs = headers();
    if(!hs.length) return;

    for(var i=0;i<hs.length;i++){
      var h = hs[i];
      var menuOpen = isMenuOpen(h);
      var mustShow = show || menuOpen || pageY <= HIDE_AFTER_Y;

      h.classList.add('v180HeaderScrollReady');
      h.classList.toggle('v172MenuOpen', menuOpen);
      h.classList.toggle('v180HeaderScrollVisible', mustShow);
      h.classList.toggle('v180HeaderScrollHidden', !mustShow);
      // Régi próbálkozások osztályait is felülírjuk, hogy ne maradjon bent ellenkező állapot.
      if(mustShow){
        h.classList.remove('v172HeaderHidden', 'v185HeaderHidden');
        h.classList.add('v185HeaderVisible');
      } else {
        h.classList.remove('v185HeaderVisible');
      }
      h.style.setProperty('transition', 'transform .16s ease', 'important');
      h.style.setProperty('will-change', 'transform', 'important');
      h.style.setProperty('transform', mustShow ? 'translate3d(0,0,0)' : 'translate3d(0, calc(-100% - 10px), 0)', 'important');
      h.dataset.headerScrollState = mustShow ? 'visible' : 'hidden';
      h.dataset.headerScrollReason = reason || '';
    }
  }

  function showHeader(reason){ applyVisible(true, reason || 'show'); }
  function hideHeader(reason){
    if(anyMenuOpen() || getPageY() <= HIDE_AFTER_Y){ showHeader('blocked-hide'); return; }
    applyVisible(false, reason || 'hide');
  }

  function processPageDirection(reason){
    ticking = false;
    var y = getPageY();
    var delta = y - lastPageY;

    if(anyMenuOpen() || y <= HIDE_AFTER_Y){
      showHeader(reason || 'top/menu');
    } else if(delta < -UP_DELTA){
      showHeader(reason || 'scroll-up');
    } else if(delta > DOWN_DELTA){
      hideHeader(reason || 'scroll-down');
    }
    lastPageY = y;
  }

  function requestProcess(reason){
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(function(){ processPageDirection(reason); });
  }

  function getTargetScrollTop(target){
    if(!target || target === window || target === document || target === document.body || target === document.documentElement){
      return getPageY();
    }
    if(typeof target.scrollTop === 'number') return Math.max(0, target.scrollTop);
    return getPageY();
  }

  function processScrollEvent(e){
    var target = e && e.target ? e.target : document;
    var y = getTargetScrollTop(target);
    var previous = lastScrollByTarget.has(target) ? lastScrollByTarget.get(target) : y;
    var delta = y - previous;
    lastScrollByTarget.set(target, y);

    // A normál oldal-scrollt külön kezeljük, mert az adja a legpontosabb irányt.
    if(target === document || target === document.body || target === document.documentElement){
      requestProcess('page-scroll');
      return;
    }

    if(anyMenuOpen() || getPageY() <= HIDE_AFTER_Y){
      showHeader('nested-top/menu');
    } else if(delta < -UP_DELTA){
      showHeader('nested-scroll-up');
    } else if(delta > DOWN_DELTA){
      hideHeader('nested-scroll-down');
    } else {
      requestProcess('scroll');
    }
  }

  function installObservers(){
    if(observed) return;
    observed = true;
    if(!window.MutationObserver) return;
    var observer = new MutationObserver(function(){
      if(anyMenuOpen()) showHeader('menu-mutation');
      else requestProcess('mutation');
    });
    headers().forEach(function(h){
      observer.observe(h, { attributes:true, attributeFilter:['class', 'style'] });
      var parts = getMenuPieces(h);
      if(parts.nav) observer.observe(parts.nav, { attributes:true, attributeFilter:['class', 'aria-expanded'] });
      if(parts.reportMenu) observer.observe(parts.reportMenu, { attributes:true, attributeFilter:['class'] });
      if(parts.menuBtn) observer.observe(parts.menuBtn, { attributes:true, attributeFilter:['aria-expanded', 'class'] });
    });
  }

  ready(function(){
    showHeader('init');
    installObservers();

    window.addEventListener('scroll', processScrollEvent, { passive:true, capture:true });
    document.addEventListener('scroll', processScrollEvent, { passive:true, capture:true });

    window.addEventListener('wheel', function(e){
      if(!e) return;
      if(anyMenuOpen() || getPageY() <= HIDE_AFTER_Y){ showHeader('wheel-menu/top'); return; }
      if(e.deltaY < -UP_DELTA) showHeader('wheel-up');
      else if(e.deltaY > DOWN_DELTA) hideHeader('wheel-down');
    }, { passive:true, capture:true });

    window.addEventListener('touchstart', function(e){
      if(e.touches && e.touches.length) lastTouchY = e.touches[0].clientY;
      if(anyMenuOpen()) showHeader('touch-menu');
    }, { passive:true, capture:true });

    window.addEventListener('touchmove', function(e){
      if(!e.touches || !e.touches.length || lastTouchY === null) return;
      var current = e.touches[0].clientY;
      var fingerDelta = current - lastTouchY;
      if(anyMenuOpen() || getPageY() <= HIDE_AFTER_Y){
        showHeader('touch-top/menu');
      } else if(fingerDelta > UP_DELTA){
        // Ujj lefelé = oldal felfelé: azonnal jelenjen meg.
        showHeader('touch-up');
      } else if(fingerDelta < -DOWN_DELTA){
        // Ujj felfelé = oldal lefelé: elbújhat.
        hideHeader('touch-down');
      }
      lastTouchY = current;
    }, { passive:true, capture:true });

    window.addEventListener('touchend', function(){ lastTouchY = null; }, { passive:true, capture:true });
    window.addEventListener('touchcancel', function(){ lastTouchY = null; }, { passive:true, capture:true });

    document.addEventListener('click', function(e){
      if(e.target && e.target.closest && e.target.closest('.menuBtn, .reportMenuBtn, nav, #reportMenu')){
        showHeader('menu-click');
        setTimeout(function(){ if(anyMenuOpen()) showHeader('menu-click-late'); }, 0);
      }
    }, true);

    window.addEventListener('keydown', function(e){
      var k = e.key || '';
      if(k === 'ArrowUp' || k === 'PageUp' || k === 'Home') showHeader('key-up');
      if(k === 'ArrowDown' || k === 'PageDown' || k === ' '){
        if(getPageY() > HIDE_AFTER_Y && !anyMenuOpen()) hideHeader('key-down');
      }
    }, { passive:true });

    window.addEventListener('resize', function(){ lastPageY = getPageY(); showHeader('resize'); installObservers(); }, { passive:true });
    window.addEventListener('focusin', function(){ showHeader('focus'); });
    window.addEventListener('hashchange', function(){ setTimeout(function(){ lastPageY = getPageY(); showHeader('hash'); }, 30); });

    // Késleltetett ismétlés: auth/nav újrarajzolás után is rátapadjon az új menüre.
    setTimeout(function(){ installObservers(); showHeader('late-1'); }, 250);
    setTimeout(function(){ installObservers(); requestProcess('late-2'); }, 1000);
  });
})();
