(function(){
  const ADMIN_EMAILS = ['cegweb26@gmail.com','atika.76@windowslive.com'];
  function isAdminEmail(email){ return ADMIN_EMAILS.includes(String(email||'').toLowerCase()); }
  function page(){ return (location.pathname.split('/').pop() || 'index.html').toLowerCase(); }

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
    const logoutId = current === 'project.html' ? 'projectLogoutBtn' : 'logoutBtn';
    const loginBtn = '<button id="loginBtn" class="btn small" type="button" onclick="window.v38OpenLogin()">Belépés / Regisztráció</button>';
    const logoutBtn = `<button id="${logoutId}" class="btn small ghost" type="button" onclick="window.location.href='logout.html'">Kilépés</button>`;
    return `
      <a href="index.html#home">Főoldal</a>
      <a href="index.html#naplo">Napló</a>
      <a href="index.html#subscription">Csomagok</a>
      <a href="#riport" onclick="return window.v130OpenReportNav(event)">Riport</a>
      ${logged ? '<a id="profileNavLink" href="profile.html">Fiókom</a>' : ''}
      ${isAdmin ? '<a id="adminMessagesNavLink" href="admin-messages.html">Admin inbox</a>' : ''}
      ${isAdmin ? '<a id="adminPanelNavLink" href="admin-panel.html">Admin panel</a>' : ''}
      ${isAdmin && current === 'index.html' ? '<a id="adminNavLink" href="index.html#admin">Admin</a>' : ''}
      ${logged ? logoutBtn : loginBtn}
    `;
  }
  window.v38OpenLogin = function(){
    if (typeof window.openAuthModal === 'function') return window.openAuthModal();
    window.location.href = 'index.html#login';
  };
  async function renderHeader(){
    const nav = document.getElementById('nav');
    if(!nav) return;
    let user = null, profile = null;
    try { user = await window.EpitesNaploAPI?.getCurrentUser?.(); } catch(e) {}
    if(user){ try { profile = await window.EpitesNaploAPI?.getProfile?.(); } catch(e) {} }
    const admin = !!(profile?.is_admin || profile?.role === 'admin' || isAdminEmail(user?.email));
    nav.innerHTML = renderCommonNav(user, admin);
    document.body.classList.remove('auth-loading');
    document.body.classList.add('auth-ready');
  }
  document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    try { window.supabaseDirect?.auth?.onAuthStateChange?.(() => setTimeout(renderHeader, 60)); } catch(e) {}
    setTimeout(() => { if(document.body.classList.contains('auth-loading')) renderHeader(); }, 1200);
  });
})();
