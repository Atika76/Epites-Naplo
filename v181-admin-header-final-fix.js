/* V181 – végleges admin fejléc javítás V179/V180 alapra
   Cél: csak egy valódi Admin menüpont maradhat, és csak tényleges adminnak.
   A nem kattintható / hibás Admin szerepjelvényeket eltávolítja.
   Nincs új Supabase SQL. */
(function(){
  'use strict';
  if (window.__epnV181AdminHeaderFinalFix) return;
  window.__epnV181AdminHeaderFinalFix = true;

  const ADMIN_EMAIL_FALLBACK = 'cegweb26@gmail.com';

  function norm(v){ return String(v || '').trim().toLowerCase(); }

  async function readUserAndProfile(){
    let user = null;
    let profile = null;
    try { user = await window.EpitesNaploAPI?.getCurrentUser?.(); } catch(_) {}
    if (user) {
      try { profile = await window.EpitesNaploAPI?.getProfile?.(); } catch(_) {}
    }
    return { user, profile };
  }

  function isRealAdmin(user, profile){
    const email = norm(user?.email);
    return !!(
      profile?.is_admin === true ||
      norm(profile?.role) === 'admin' ||
      email === ADMIN_EMAIL_FALLBACK
    );
  }

  function isRealAdminNav(el){
    if (!el) return false;
    if (el.id === 'adminNavLink') return true;
    const href = norm(el.getAttribute?.('href'));
    return el.tagName === 'A' && (href.includes('admin-panel.html') || href.includes('#admin'));
  }

  function removeWrongAdminBadges(){
    // Régi fejlécekből maradt szerep-jelvények: ezek nem menüpontok, ezért ne látszódjanak.
    document.querySelectorAll('.adminPill, .rolePill, .userRolePill, .adminBadge').forEach(el => el.remove());

    const nav = document.getElementById('nav') || document.querySelector('.topbar nav');
    if (!nav) return;

    Array.from(nav.children).forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      if (text !== 'admin' && text !== 'felhasználó') return;

      // A valódi admin-panel linket külön kezeljük, azt adminnak meghagyjuk.
      if (isRealAdminNav(el)) return;

      // Minden más Admin/Felhasználó jelvény vagy gombszerű maradék törlendő.
      el.remove();
    });
  }

  function setAdminNavVisible(admin){
    const nav = document.getElementById('nav') || document.querySelector('.topbar nav');
    if (!nav) return;

    const adminLinks = Array.from(nav.querySelectorAll('a')).filter(isRealAdminNav);

    // Ha több valódi admin link maradt régi scriptek miatt, csak az első maradjon.
    adminLinks.forEach((el, index) => {
      if (index > 0) {
        el.remove();
        return;
      }
      el.id = 'adminNavLink';
      el.href = 'admin-panel.html';
      el.textContent = 'Admin';
      el.classList.toggle('hidden', !admin);
      el.style.display = admin ? '' : 'none';
    });
  }

  async function refreshAdminHeader(){
    const { user, profile } = await readUserAndProfile();
    const admin = isRealAdmin(user, profile);
    removeWrongAdminBadges();
    setAdminNavVisible(admin);
    document.body.classList.toggle('v181RealAdmin', admin);
    document.body.classList.toggle('v181NotAdmin', !!user && !admin);
  }

  function refreshSoon(){
    refreshAdminHeader().catch(() => {
      removeWrongAdminBadges();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    refreshSoon();
    setTimeout(refreshSoon, 80);
    setTimeout(refreshSoon, 350);
    setTimeout(refreshSoon, 1000);
    setTimeout(refreshSoon, 2000);
  });

  // Ha a header-v40 vagy script.js később újrarajzolja a menüt, ez azonnal visszajavítja.
  const observer = new MutationObserver(() => refreshSoon());
  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('nav') || document.querySelector('.topbar nav');
    if (nav) observer.observe(nav, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });
  });

  try { window.supabaseDirect?.auth?.onAuthStateChange?.(() => setTimeout(refreshSoon, 100)); } catch(_) {}

  let ticks = 0;
  const timer = setInterval(() => {
    refreshSoon();
    ticks += 1;
    if (ticks > 14) clearInterval(timer);
  }, 600);

  window.epnV181RefreshAdminHeader = refreshSoon;
})();
