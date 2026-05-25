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

// ===== V184: CSAK fejlec gorgetes javitas - lefele elbujik, felfele azonnal visszajon =====
(function(){
  if(window.__v184HeaderScrollDirectionFix) return;
  window.__v184HeaderScrollDirectionFix = true;

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function(){
    const topbar = document.querySelector('.topbar');
    if(!topbar) return;

    let lastScrollY = Math.max(0, window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0);
    let lastTouchY = null;
    let ticking = false;
    let forceShowUntil = 0;

    function getY(){
      return Math.max(0, window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0);
    }

    function navOpen(){
      const nav = document.getElementById('nav') || topbar.querySelector('nav');
      return !!(nav && (nav.classList.contains('open') || nav.classList.contains('navOpen')));
    }

    function showHeader(){
      topbar.classList.remove('v172HeaderHidden');
      topbar.classList.remove('v184HeaderHidden');
      topbar.style.removeProperty('transform');
    }

    function hideHeader(){
      if(navOpen() || topbar.matches(':focus-within')) return;
      topbar.classList.add('v172HeaderHidden');
      topbar.classList.add('v184HeaderHidden');
    }

    function forceShow(){
      forceShowUntil = Date.now() + 450;
      showHeader();
    }

    function apply(){
      ticking = false;
      const y = getY();
      const delta = y - lastScrollY;

      topbar.classList.toggle('v172MenuOpen', navOpen());

      // Mindig latszodjon a lap tetejen, nyitott menunel, beviteli mezonel,
      // illetve kozvetlenul felfele gorgetesi jel utan.
      if(y <= 40 || navOpen() || topbar.matches(':focus-within') || Date.now() < forceShowUntil){
        showHeader();
        lastScrollY = y;
        return;
      }

      // Lefelegorgetes: eltunik.
      if(delta > 3){
        hideHeader();
      }

      // Felfelegorgetes: azonnal visszajon, nem csak a lap tetejen.
      if(delta < -1){
        showHeader();
      }

      lastScrollY = y;
    }

    function requestApply(){
      if(!ticking){
        ticking = true;
        requestAnimationFrame(apply);
      }
    }

    // Normal scroll es touchpad/eger.
    window.addEventListener('scroll', requestApply, {passive:true});
    window.addEventListener('wheel', function(e){
      if(e.deltaY < 0){
        // Egergorgo/touchpad felfele: mutasd azonnal, meg a scroll event elott.
        forceShow();
      }else if(e.deltaY > 0 && getY() > 80){
        hideHeader();
      }
    }, {passive:true});

    // Mobil: ha az ujj lefele mozdul, a tartalom a lap teteje fele megy, tehat a fejlec jojjon elo.
    window.addEventListener('touchstart', function(e){
      lastTouchY = e.touches && e.touches[0] ? e.touches[0].clientY : null;
    }, {passive:true});

    window.addEventListener('touchmove', function(e){
      if(lastTouchY == null || !e.touches || !e.touches[0]) return;
      const currentTouchY = e.touches[0].clientY;
      const touchDelta = currentTouchY - lastTouchY;
      if(touchDelta > 3){
        // Felfele haladsz a lapon: fejlec azonnal vissza.
        forceShow();
      }else if(touchDelta < -5 && getY() > 80){
        // Lefelegorgetes: fejlec elbujik.
        hideHeader();
      }
      lastTouchY = currentTouchY;
    }, {passive:true});

    window.addEventListener('touchend', function(){ lastTouchY = null; }, {passive:true});

    // Billentyuzet es egyeb navigacios esetek.
    window.addEventListener('keydown', function(e){
      if(['ArrowUp','PageUp','Home'].includes(e.key)) forceShow();
      if(['ArrowDown','PageDown','End',' '].includes(e.key) && getY() > 80) hideHeader();
    }, {passive:true});

    window.addEventListener('resize', forceShow, {passive:true});
    window.addEventListener('focusin', forceShow);
    document.addEventListener('click', function(){ setTimeout(requestApply, 0); }, true);

    showHeader();
  });
})();
