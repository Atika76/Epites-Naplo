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
  function toggleMenu(){
    const nav = document.getElementById('nav');
    const btn = document.querySelector('.menuBtn');
    if(!nav) return;
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    nav.classList.toggle('navOpen', open);
    if(btn) btn.setAttribute('aria-expanded', String(open));
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
      btn.type = 'button';
      btn.setAttribute('aria-label','Menü megnyitása');
      btn.setAttribute('aria-controls','nav');
      btn.setAttribute('aria-expanded','false');
      btn.textContent = '☰';
      brand.insertAdjacentElement('afterend', btn);
    }
    btn.onclick = toggleMenu;
    nav.addEventListener('click', (e) => {
      const t = e.target;
      if(t && (t.tagName === 'A' || t.tagName === 'BUTTON')) closeMenu();
    });
    document.addEventListener('click', (e) => {
      if(window.innerWidth > 860) return;
      if(!topbar.contains(e.target)) closeMenu();
    });
  }

  function renderCommonNav(user, isAdmin){
    const current = page();
    const logged = !!user;
    const logoutId = current === 'project.html' ? 'projectLogoutBtn' : (current === 'project-finance.html' ? 'financeLogoutBtn' : 'logoutBtn');
    const loginBtn = '<button id="loginBtn" class="btn small" type="button" onclick="window.v39OpenLogin()">Belépés / Regisztráció</button>';
    const logoutBtn = `<button id="${logoutId}" class="btn small ghost" type="button" onclick="window.location.href='logout.html'">Kilépés</button>`;
    return `
      <a href="index.html#home">Főoldal</a>
      <a href="index.html#naplo">Napló</a>
      <a href="index.html#subscription">Csomagok</a>
      <a href="view.html">Riport</a>
      ${logged ? '<a id="profileNavLink" href="profile.html">Fiókom</a>' : ''}
      ${isAdmin ? '<a id="adminMessagesNavLink" href="admin-messages.html">Admin inbox</a>' : ''}
      ${isAdmin ? '<a id="adminPanelNavLink" href="admin-panel.html">Admin panel</a>' : ''}
      ${isAdmin && isIndex() ? '<a id="adminNavLink" href="index.html#admin">Admin</a>' : ''}
      ${logged ? '<span class="adminPill">'+(isAdmin?'Admin':'Felhasználó')+'</span>' : ''}
      ${logged ? logoutBtn : loginBtn}
    `;
  }
  window.v39OpenLogin = function(){
    if (typeof window.openAuthModal === 'function') return window.openAuthModal();
    window.location.href = 'index.html#login';
  };
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
    setTimeout(() => { if(document.body.classList.contains('auth-loading')) renderHeader(); }, 1200);
  });
})();
