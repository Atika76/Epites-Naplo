/* V179 – tiszta főoldal: demo/aktív csomag blokk nélkül, publikus rendszerfunkciók.
   V175b alapból, csak frontend rendezés: nincs új Supabase SQL. */
(function(){
  'use strict';
  if (window.__epnV179RoleCleanup) return;
  window.__epnV179RoleCleanup = true;

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function call(name, fallback){
    try {
      if (typeof window[name] === 'function') return window[name]();
    } catch(_) {}
    return fallback;
  }

  function getPlan(){
    let plan = call('planKey', '');
    if (!plan) {
      const txt = ($('#currentPlanText')?.textContent || '').toLowerCase();
      if (txt.includes('business')) plan = 'business';
      else if (txt.includes('pro')) plan = 'pro';
      else if (txt.includes('alap')) plan = 'starter';
      else if (txt.includes('próba') || txt.includes('ingyen')) plan = 'trial';
      else plan = 'guest';
    }
    return String(plan || 'guest').toLowerCase();
  }

  function isLoggedIn(){
    const email = ($('#currentUserEmail')?.textContent || '').trim();
    return !!email && email !== 'Nincs bejelentkezve';
  }

  function isAdminUser(){
    try { return typeof window.isAdmin === 'function' && !!window.isAdmin(); }
    catch(_) { return false; }
  }

  function isPaid(plan){
    return isAdminUser() || ['starter','pro','business'].includes(plan);
  }

  function ensureActivePlanCard(){ return null; }

  function refreshNav(plan){
    const logged = isLoggedIn();
    const admin = isAdminUser();

    document.body.classList.toggle('v178Guest', !logged);
    document.body.classList.toggle('v178Logged', logged);
    document.body.classList.toggle('v178Admin', admin);
    document.body.classList.toggle('v178Paid', isPaid(plan));

    // Fejléc logika:
    // Vendég: Főoldal + Rendszerfunkciók + Belépés
    // Belépett felhasználó: Főoldal + Napló + Riport + Fiókom + Kilépés
    // Admin: ugyanaz + egyetlen Admin menüpont, külön admin panelre.
    $('#systemFeaturesNavLink')?.classList.toggle('hidden', logged);
    $$('.userWorkNav').forEach(el => el.classList.toggle('hidden', !logged));
    $('#profileNavLink')?.classList.toggle('hidden', !logged);
    $('#adminNavLink')?.classList.toggle('hidden', !admin);

    // Régi többes admin/csomag menük biztos elrejtése, ha egy korábbi script még módosítaná őket.
    $('#packagesNavLink')?.classList.add('hidden');
    $('#adminMessagesNavLink')?.classList.add('hidden');
    $('#adminPanelNavLink')?.classList.add('hidden');
  }

  function refreshPayments(plan){
    const paid = isPaid(plan);
    const sub = $('#subscription');
    const credits = $('#ai-kreditek');

    // V179: aktív csomagnál ne legyen külön nagy kártya a főoldalon.
    // Az állapot a jobb felső "Fiók állapot" kártyában már látszik.
    $('#v175ActivePlanCard')?.remove();

    if (paid) {
      if (sub) sub.classList.add('hidden');
      if (credits) credits.classList.add('hidden');
    } else {
      if (sub) sub.classList.remove('hidden');
      if (credits) credits.classList.remove('hidden');
    }
  }

  function refreshBlocks(){
    const logged = isLoggedIn();
    const admin = isAdminUser();

    // Üzenet az adminnak csak belépett felhasználónak kell.
    $$('.userOnlyBlock').forEach(el => el.classList.toggle('hidden', !logged));

    // Admin áttekintés ne legyen a főoldalon: van külön admin-panel.html.
    $('#admin')?.classList.add('hidden');
    $('#admin') && ($('#admin').style.display = 'none');

    // V179: a demo/aktív hozzáférés extra főoldali blokkok ne jelenjenek meg.
    $('#demo')?.remove();
    $('#v175ActivePlanCard')?.remove();

    // Rendszerfunkciók legyen olvasható a főoldalon vendégnek is.
    $('#systemFeatures')?.classList.remove('hidden');
    $('#systemFeatures') && ($('#systemFeatures').style.display = '');
  }

  function refresh(){
    const plan = getPlan();
    refreshNav(plan);
    refreshPayments(plan);
    refreshBlocks();
  }

  const oldRender = window.render;
  if (typeof oldRender === 'function') {
    window.render = function(){
      const result = oldRender.apply(this, arguments);
      setTimeout(refresh, 0);
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    refresh();
    setTimeout(refresh, 300);
    setTimeout(refresh, 1000);
  });

  let ticks = 0;
  const timer = setInterval(() => {
    refresh();
    ticks += 1;
    if (ticks > 12) clearInterval(timer);
  }, 700);

  window.epnV179RefreshRoleUi = refresh;
})();
