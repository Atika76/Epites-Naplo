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
    const permissionBtn = `<button class="btn small ghost permissionNavBtn" type="button" onclick="if(window.openPermissionSettingsV187){window.openPermissionSettingsV187()}else{alert('Az engedély beállítások még töltődnek. Próbáld újra pár másodperc múlva.')}">Engedélyek</button>`;
    if (!logged) {
      return `
        <a href="index.html#home">Főoldal</a>
        <a id="systemFeaturesNavLink" href="index.html#systemFeatures">Rendszerfunkciók</a>
        ${permissionBtn}
        ${loginBtn}
      `;
    }
    return `
      <a href="index.html#home">Főoldal</a>
      <a href="index.html#naplo">Napló</a>
      ${reportNav}
      <a id="profileNavLink" href="profile.html">Fiókom</a>
      ${isAdmin ? '<a id="adminNavLink" href="admin-panel.html">Admin</a>' : ''}
      ${permissionBtn}
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

// ===== V180 CLEAN REAL FIX: fix pozíciós fejléc, valódi felfelé visszajövetel =====
// Csak a fejléc görgetését kezeli:
// - lefelé görgetéskor eltűnik
// - felfelé görgetéskor azonnal visszajön
// - nyitott hamburger menünél mindig látható marad
// - a fix fejléc miatt a tartalom kap felső helyet, így nem takarja ki a Rendszerfunkciók tetejét
(function(){
  if(window.__epnV180CleanHeaderScrollRealFix) return;
  window.__epnV180CleanHeaderScrollRealFix = true;

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  ready(function(){
    const topbar = document.querySelector('body > .topbar') || document.querySelector('.topbar');
    if(!topbar) return;

    const SHOW_AT_TOP = 70;
    const HIDE_AFTER = 110;
    let lastY = Math.max(0, window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0);
    let ticking = false;
    let lastTouchY = null;
    let lastState = '';

    function getY(){
      return Math.max(0, window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0);
    }

    function getNav(){
      return document.getElementById('nav') || topbar.querySelector('nav');
    }

    function getMenuBtn(){
      return topbar.querySelector('.menuBtn') || document.querySelector('.menuBtn');
    }

    function navOpen(){
      const nav = getNav();
      const btn = getMenuBtn();
      return !!(
        (nav && (nav.classList.contains('open') || nav.classList.contains('navOpen'))) ||
        (btn && btn.getAttribute('aria-expanded') === 'true')
      );
    }

    function headerFocused(){
      return !!(document.activeElement && topbar.contains(document.activeElement));
    }

    function headerHeight(){
      const h = Math.ceil(topbar.offsetHeight || topbar.getBoundingClientRect().height || 76);
      return Math.max(48, h);
    }

    function syncFixedHeaderSpace(){
      const h = headerHeight();
      document.body.classList.add('epnFixedTopbar');
      document.documentElement.style.setProperty('--epnTopbarSpace', h + 'px');
      topbar.classList.add('epnScrollManagedTopbar');
      topbar.style.setProperty('position', 'fixed', 'important');
      topbar.style.setProperty('top', '0', 'important');
      topbar.style.setProperty('left', '0', 'important');
      topbar.style.setProperty('right', '0', 'important');
      topbar.style.setProperty('width', '100%', 'important');
      topbar.style.setProperty('z-index', '2147483000', 'important');
    }

    function setVisible(){
      syncFixedHeaderSpace();
      lastState = 'visible';
      topbar.classList.remove('v172HeaderHidden','v180HeaderHidden','epnHeaderHidden');
      topbar.classList.add('v180HeaderVisible','epnHeaderVisible');
      topbar.style.setProperty('transform', 'translate3d(0, 0, 0)', 'important');
      topbar.style.setProperty('opacity', '1', 'important');
      topbar.style.setProperty('visibility', 'visible', 'important');
      topbar.style.setProperty('pointer-events', 'auto', 'important');
    }

    function setHidden(){
      syncFixedHeaderSpace();
      if(navOpen() || headerFocused() || getY() < HIDE_AFTER){
        setVisible();
        return;
      }
      lastState = 'hidden';
      topbar.classList.remove('v180HeaderVisible','epnHeaderVisible');
      topbar.classList.add('v172HeaderHidden','v180HeaderHidden','epnHeaderHidden');
      topbar.style.setProperty('transform', 'translate3d(0, calc(-100% - 8px), 0)', 'important');
      topbar.style.setProperty('opacity', '0.98', 'important');
      topbar.style.setProperty('visibility', 'visible', 'important');
      topbar.style.setProperty('pointer-events', 'none', 'important');
    }

    function apply(){
      ticking = false;
      syncFixedHeaderSpace();
      const y = getY();
      const delta = y - lastY;

      topbar.classList.toggle('v172MenuOpen', navOpen());

      if(navOpen() || headerFocused() || y <= SHOW_AT_TOP){
        setVisible();
      } else if(delta < 0){
        // Már az első felfelé mozdulásnál visszajön.
        setVisible();
      } else if(delta > 0 && y > HIDE_AFTER){
        setHidden();
      } else if(lastState !== 'hidden'){
        setVisible();
      }

      lastY = y;
    }

    function requestApply(){
      if(!ticking){
        ticking = true;
        window.requestAnimationFrame(apply);
      }
    }

    // Egér / touchpad: felfelé görgetésnél azonnal mutatjuk, nem várunk a lap tetejéig.
    window.addEventListener('wheel', function(e){
      if(navOpen()){
        setVisible();
        return;
      }
      if(e.deltaY < 0){
        setVisible();
      }
      requestApply();
    }, { passive:true });

    // Mobil: ha az ujj lefelé húz, a lap felfelé megy, ezért azonnal jelenjen meg a fejléc.
    window.addEventListener('touchstart', function(e){
      if(e.touches && e.touches.length) lastTouchY = e.touches[0].clientY;
    }, { passive:true });

    window.addEventListener('touchmove', function(e){
      if(!e.touches || !e.touches.length || lastTouchY === null){
        requestApply();
        return;
      }
      const currentTouchY = e.touches[0].clientY;
      const fingerDelta = currentTouchY - lastTouchY;
      if(navOpen()){
        setVisible();
      } else if(fingerDelta > 1){
        setVisible();
      }
      lastTouchY = currentTouchY;
      requestApply();
    }, { passive:true });

    window.addEventListener('touchend', function(){
      lastTouchY = null;
      requestApply();
    }, { passive:true });

    window.addEventListener('scroll', requestApply, { passive:true });
    window.addEventListener('resize', function(){ syncFixedHeaderSpace(); lastY = getY(); setVisible(); }, { passive:true });
    window.addEventListener('focusin', setVisible);

    window.addEventListener('keydown', function(e){
      if(['ArrowUp','PageUp','Home'].includes(e.key)){
        setVisible();
      }
      requestApply();
    }, { passive:true });

    document.addEventListener('click', function(e){
      const btn = e.target && e.target.closest ? e.target.closest('.menuBtn') : null;
      if(btn) setVisible();
      setTimeout(requestApply, 0);
      setTimeout(requestApply, 80);
    }, true);

    const nav = getNav();
    const btn = getMenuBtn();
    try{
      const observer = new MutationObserver(function(){
        syncFixedHeaderSpace();
        if(navOpen()) setVisible();
        else requestApply();
      });
      observer.observe(topbar, { childList:true, subtree:true });
      if(nav) observer.observe(nav, { attributes:true, attributeFilter:['class'] });
      if(btn) observer.observe(btn, { attributes:true, attributeFilter:['aria-expanded'] });
    }catch(_e){}

    try{
      if('ResizeObserver' in window){
        const ro = new ResizeObserver(function(){ syncFixedHeaderSpace(); });
        ro.observe(topbar);
      }
    }catch(_e){}

    // Horgonyra ugrásnál ne takarja ki a Rendszerfunkciók tetejét.
    document.addEventListener('click', function(e){
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if(!a) return;
      const href = a.getAttribute('href') || '';
      const hashIndex = href.indexOf('#');
      if(hashIndex === -1) return;
      const hash = href.slice(hashIndex + 1);
      if(!hash) return;
      setTimeout(function(){
        const target = document.getElementById(hash);
        if(!target) return;
        syncFixedHeaderSpace();
        const h = headerHeight();
        const top = target.getBoundingClientRect().top + getY() - h - 16;
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
        setVisible();
        lastY = getY();
      }, 70);
    }, true);

    syncFixedHeaderSpace();
    setVisible();
    lastY = getY();
    setTimeout(syncFixedHeaderSpace, 250);
    setTimeout(syncFixedHeaderSpace, 1000);
  });
})();
