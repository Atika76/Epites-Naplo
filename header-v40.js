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

// ===== V181: a fejléc mindig elérhető marad görgetés közben =====
(function(){
  if(window.__v172ScrollHeaderFix) return;
  window.__v172ScrollHeaderFix = true;

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function(){
    const topbar = document.querySelector('.topbar');
    if(!topbar) return;

    let ticking = false;

    function navOpen(){
      const nav = document.getElementById('nav') || topbar.querySelector('nav');
      return !!(nav && (nav.classList.contains('open') || nav.classList.contains('navOpen')));
    }

    function showHeader(){
      topbar.classList.remove('v172HeaderHidden');
      topbar.style.setProperty('position', 'fixed', 'important');
      topbar.style.setProperty('top', '0', 'important');
      topbar.style.setProperty('left', '0', 'important');
      topbar.style.setProperty('right', '0', 'important');
      topbar.style.setProperty('width', '100%', 'important');
      topbar.style.setProperty('z-index', '2147483000', 'important');
      topbar.style.setProperty('transform', 'none', 'important');
      topbar.style.setProperty('opacity', '1', 'important');
      topbar.style.setProperty('visibility', 'visible', 'important');
      document.body.classList.add('hasFixedTopbar');
      document.documentElement.style.setProperty('--fixed-topbar-space', Math.ceil(topbar.getBoundingClientRect().height || 76) + 'px');
    }

    function applyState(){
      ticking = false;
      topbar.classList.toggle('v172MenuOpen', navOpen());
      showHeader();
    }

    window.addEventListener('wheel', function(e){
      showHeader();
    }, { passive:true });

    window.addEventListener('touchstart', function(e){
      showHeader();
    }, { passive:true });

    window.addEventListener('touchmove', function(e){
      showHeader();
    }, { passive:true });

    window.addEventListener('keydown', function(e){
      if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End','Space'].includes(e.key)) showHeader();
    }, { passive:true });

    window.addEventListener('scroll', function(){
      if(!ticking){
        ticking = true;
        window.requestAnimationFrame(applyState);
      }
    }, { passive:true });

    window.addEventListener('resize', showHeader, { passive:true });
    window.addEventListener('focusin', showHeader);
    document.addEventListener('click', function(){
      setTimeout(applyState, 0);
    }, true);
    showHeader();
  });
})();
