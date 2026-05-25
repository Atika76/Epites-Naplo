(function(){
  const ADMIN_EMAILS = ['cegweb26@gmail.com','atika.76@windowslive.com'];
  function isAdminEmail(email){ return ADMIN_EMAILS.includes(String(email||'').toLowerCase()); }
  function page(){ return (location.pathname.split('/').pop() || 'index.html').toLowerCase(); }
  function isIndex(){ const p = page(); return p === 'index.html' || p === ''; }
  function closeMenu(){
    const nav = document.getElementById('nav');
    const btn = document.querySelector('.menuBtn');
    if(nav) nav.classList.remove('open','navOpen');
    if(btn) btn.setAttribute('aria-expanded','false');
  }
  function toggleMenu(event){
    if(event && typeof event.preventDefault === 'function') event.preventDefault();
    if(event && typeof event.stopPropagation === 'function') event.stopPropagation();
    const nav = document.getElementById('nav') || document.querySelector('.topbar nav');
    const btn = document.querySelector('.menuBtn');
    if(!nav) return false;

    // Mobilon a menünek akkor is működnie kell, ha az auth lekérdezés lassú
    // és a body még auth-loading állapotban maradt.
    document.body.classList.remove('auth-loading');
    document.body.classList.add('auth-ready');

    if(!nav.id) nav.id = 'nav';
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    nav.classList.toggle('navOpen', open);
    if(btn) btn.setAttribute('aria-expanded', String(open));
    return false;
  }
  window.toggleMenu = toggleMenu;
  window.closeMobileMenu = closeMenu;

  function ensureMobileMenuButton(){
    const topbar = document.querySelector('.topbar');
    const nav = document.getElementById('nav') || topbar?.querySelector('nav');
    const brand = topbar?.querySelector('.brand');
    if(!topbar || !nav || !brand) return;
    if(!nav.id) nav.id = 'nav';
    let btn = topbar.querySelector('.menuBtn');
    if(!btn){
      btn = document.createElement('button');
      btn.className = 'menuBtn';
      brand.insertAdjacentElement('afterend', btn);
    }
    btn.type = 'button';
    btn.setAttribute('aria-label','Menü megnyitása');
    btn.setAttribute('aria-controls','nav');
    btn.setAttribute('aria-expanded', nav.classList.contains('open') ? 'true' : 'false');
    btn.textContent = '☰';
    btn.onclick = toggleMenu;
    if(!btn.dataset.v169ClickReady){
      btn.dataset.v169ClickReady = '1';
      btn.addEventListener('click', toggleMenu, true);
      btn.addEventListener('touchstart', function(e){
        // Edge/Messenger mobil nézetben néha a click késik vagy elveszik.
        toggleMenu(e);
      }, {passive:false, capture:true});
    }
    if(!nav.dataset.mobileMenuReady){
      nav.dataset.mobileMenuReady = '1';
      nav.addEventListener('click', (e) => {
        const t = e.target;
        if(t && (t.closest('a') || t.closest('button'))) closeMenu();
      });
    }
    if(!document.documentElement.dataset.mobileMenuOutsideReady){
      document.documentElement.dataset.mobileMenuOutsideReady = '1';
      document.addEventListener('click', (e) => {
        if(window.innerWidth > 860) return;
        if(!topbar.contains(e.target)) closeMenu();
      });
    }
  }

  // V169: hamburger menü védő javítás mobilra.
  // Ha valamelyik oldal régi inline onclickot vagy cache-elt fejlécet használ,
  // ez akkor is elkapja a menü gomb érintését.
  if(!document.documentElement.dataset.v169HamburgerReady){
    document.documentElement.dataset.v169HamburgerReady = '1';
    document.addEventListener('click', function(e){
      const btn = e.target && e.target.closest ? e.target.closest('.menuBtn') : null;
      if(!btn) return;
      toggleMenu(e);
    }, true);
  }


  function v130OpenReportNav(event){
    if(event && typeof event.preventDefault === 'function') event.preventDefault();
    closeMenu();
    try{
      if(typeof window.openReportCenterV69 === 'function'){
        window.openReportCenterV69();
        return false;
      }
      const params = new URLSearchParams(window.location.search);
      const pidFromUrl = params.get('id') || params.get('project') || '';
      const pid = pidFromUrl || localStorage.getItem('epitesnaplo_last_project_id') || localStorage.getItem('epitesnaplo_current_project_id') || '';
      if(pid){
        window.location.href = 'project.html?id=' + encodeURIComponent(pid) + '&openReport=1';
        return false;
      }
      window.location.href = 'index.html#naplo';
    }catch(_){
      window.location.href = 'index.html#naplo';
    }
    return false;
  }
  window.v130OpenReportNav = v130OpenReportNav;

  function renderCommonNav(user, isAdmin){
    const current = page();
    const logged = !!user;
    const logoutId = current === 'project.html' ? 'projectLogoutBtn' : (current === 'project-finance.html' ? 'financeLogoutBtn' : 'logoutBtn');
    const loginBtn = '<button id="loginBtn" class="btn small" type="button" onclick="window.v40OpenLogin()">Belépés / Regisztráció</button>';
    const logoutBtn = `<button id="${logoutId}" class="btn small ghost" type="button" onclick="window.location.href='logout.html'">Kilépés</button>`;
    const reportNav = current === 'project.html'
      ? `<a href="#reportCenterV69" onclick="event.preventDefault(); if(typeof window.openReportCenterV69 === 'function'){ window.openReportCenterV69(); }">Riport</a>`
      : '<a href="#riport" onclick="return window.v130OpenReportNav(event)">Riport</a>';
    if (!logged) {
      return `
        <a href="index.html#home">Főoldal</a>
        <a id="systemFeaturesNavLink" href="index.html#systemFeatures">Rendszerfunkciók</a>
        ${loginBtn}
      `;
    }
    return `
      <a href="index.html#home">Főoldal</a>
      <a href="index.html#naplo">Napló</a>
      ${reportNav}
      <a id="profileNavLink" href="profile.html">Fiókom</a>
      ${isAdmin ? '<a id="adminNavLink" href="admin-panel.html">Admin</a>' : ''}
      ${logoutBtn}
    `;
  }
  window.v40OpenLogin = function(){
    if (typeof window.openAuthModal === 'function') return window.openAuthModal();
    window.location.href = 'index.html#login';
  };
  window.v39OpenLogin = window.v40OpenLogin;
  async function renderHeader(){
    ensureMobileMenuButton();
    const nav = document.getElementById('nav');
    if(!nav) return;
    let user = null, profile = null;
    try { user = await window.EpitesNaploAPI?.getCurrentUser?.(); } catch(e) {}
    if(user){ try { profile = await window.EpitesNaploAPI?.getProfile?.(); } catch(e) {} }
    const admin = !!(profile?.is_admin || profile?.role === 'admin' || isAdminEmail(user?.email));
    nav.innerHTML = renderCommonNav(user, admin);
    nav.classList.remove('open','navOpen');
    document.body.classList.remove('auth-loading');
    document.body.classList.add('auth-ready');
  }
  document.addEventListener('DOMContentLoaded', () => {
    ensureMobileMenuButton();
    renderHeader();
    try { window.supabaseDirect?.auth?.onAuthStateChange?.(() => setTimeout(renderHeader, 60)); } catch(e) {}
    setTimeout(() => {
      if(document.body.classList.contains('auth-loading')){
        document.body.classList.remove('auth-loading');
        document.body.classList.add('auth-ready');
        ensureMobileMenuButton();
        renderHeader();
      }
    }, 900);
  });
})();

// ===== V180-STABIL: CSAK fejléc görgetés irány szerint =====
(function(){
  if(window.__v180StableHeaderScrollFix) return;
  window.__v180StableHeaderScrollFix = true;

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function(){
    const topbar = document.querySelector('.topbar');
    if(!topbar) return;

    const HIDE_AFTER_Y = 80;
    const HIDE_DELTA = 6;
    const SHOW_DELTA = 1;

    let lastY = getScrollY();
    let touchY = null;
    let ticking = false;

    function getScrollY(){
      return Math.max(
        0,
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      );
    }

    function getNav(){
      return document.getElementById('nav') || topbar.querySelector('nav');
    }

    function isMenuOpen(){
      const nav = getNav();
      return !!(nav && (nav.classList.contains('open') || nav.classList.contains('navOpen')));
    }

    function markMenuState(){
      topbar.classList.toggle('v172MenuOpen', isMenuOpen());
    }

    function showHeader(){
      topbar.classList.remove('v172HeaderHidden', 'v185HeaderHidden', 'v180HeaderHidden');
      topbar.classList.add('v185HeaderVisible', 'v180HeaderVisible');
      topbar.style.setProperty('transform', 'translate3d(0,0,0)', 'important');
      markMenuState();
    }

    function hideHeader(){
      markMenuState();
      if(isMenuOpen()){
        showHeader();
        return;
      }
      if(getScrollY() <= HIDE_AFTER_Y){
        showHeader();
        return;
      }
      topbar.classList.remove('v185HeaderVisible', 'v180HeaderVisible');
      topbar.classList.add('v185HeaderHidden', 'v180HeaderHidden');
      topbar.style.setProperty('transform', 'translate3d(0, calc(-100% - 8px), 0)', 'important');
    }

    function applyScrollDirection(){
      ticking = false;
      const y = getScrollY();
      const delta = y - lastY;

      markMenuState();

      if(isMenuOpen() || y <= HIDE_AFTER_Y){
        showHeader();
      } else if(delta < -SHOW_DELTA){
        // Felfelé görgetés: azonnali visszajelzés, nem várjuk meg az oldal tetejét.
        showHeader();
      } else if(delta > HIDE_DELTA){
        // Lefelé görgetés: a fejléc elbújik, hogy több hely maradjon a tartalomnak.
        hideHeader();
      }

      lastY = y;
    }

    function requestApply(){
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(applyScrollDirection);
    }

    // A fő logika: mindig a tényleges scroll pozíciót hasonlítja az előzőhöz.
    window.addEventListener('scroll', requestApply, { passive:true });

    // Desktop egér / touchpad: felfelé mozdításnál már a görgetés elején megjelenik.
    window.addEventListener('wheel', function(e){
      if(!e) return;
      if(e.deltaY < -SHOW_DELTA) showHeader();
      else if(e.deltaY > HIDE_DELTA) hideHeader();
    }, { passive:true });

    // Mobil: az ujj lefelé húzása az oldal felfelé görgetését jelenti, ezért azonnal visszahozzuk a fejlécet.
    window.addEventListener('touchstart', function(e){
      if(e.touches && e.touches.length) touchY = e.touches[0].clientY;
    }, { passive:true });

    window.addEventListener('touchmove', function(e){
      if(!e.touches || !e.touches.length || touchY === null) return;
      const currentY = e.touches[0].clientY;
      const fingerDelta = currentY - touchY;
      if(fingerDelta > SHOW_DELTA) showHeader();
      else if(fingerDelta < -HIDE_DELTA) hideHeader();
      touchY = currentY;
    }, { passive:true });

    window.addEventListener('touchend', function(){ touchY = null; }, { passive:true });
    window.addEventListener('touchcancel', function(){ touchY = null; }, { passive:true });
    window.addEventListener('resize', function(){ lastY = getScrollY(); showHeader(); }, { passive:true });
    window.addEventListener('focusin', showHeader);

    // Ha a hamburger menü kinyílik, a fejléc soha ne maradjon elbújva.
    document.addEventListener('click', function(e){
      if(e.target && e.target.closest && e.target.closest('.menuBtn')){
        showHeader();
        setTimeout(showHeader, 0);
      } else {
        setTimeout(requestApply, 0);
      }
    }, true);

    const nav = getNav();
    if(nav && window.MutationObserver){
      new MutationObserver(function(){
        if(isMenuOpen()) showHeader();
        else markMenuState();
      }).observe(nav, { attributes:true, attributeFilter:['class'] });
    }

    // Induláskor mindig látható legyen.
    showHeader();
  });
})();
