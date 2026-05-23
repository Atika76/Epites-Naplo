/* V178 – tiszta főoldal és szerepkör szerinti menü.
   V175b alapból, csak frontend rendezés: nincs új Supabase SQL. */
(function(){
  'use strict';
  if (window.__epnV178RoleCleanup) return;
  window.__epnV178RoleCleanup = true;

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

  function ensureActivePlanCard(){
    let card = $('#v175ActivePlanCard');
    if (card) return card;

    card = document.createElement('section');
    card.id = 'v175ActivePlanCard';
    card.className = 'card wide v175ActivePlanCard hidden';
    card.innerHTML = `
      <div>
        <p class="badge">Aktív hozzáférés</p>
        <h2>Csomagod aktív</h2>
        <p class="muted">Nem mutatjuk a nagy fizetési blokkokat, hogy a főoldal ne legyen zsúfolt.</p>
      </div>
      <div class="v175ActivePlanGrid">
        <div><b id="v175PlanCopy">Csomag: –</b><span>Hozzáférés állapota</span></div>
        <div><b id="v175CreditCopy">AI kredit: 0 db</b><span>Külön AI riportokhoz</span></div>
        <div><a class="btn ghost full" href="profile.html">Fiók / csomag kezelése</a></div>
      </div>
    `;
    const subscription = $('#subscription');
    if (subscription && subscription.parentNode) subscription.parentNode.insertBefore(card, subscription.nextSibling);
    else document.querySelector('main')?.prepend(card);
    return card;
  }

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
    const active = ensureActivePlanCard();

    if (paid) {
      if (sub) sub.classList.add('hidden');
      if (credits) credits.classList.add('hidden');
      active.classList.remove('hidden');
      const planText = ($('#currentPlanText')?.textContent || 'Csomag: aktív').trim();
      const creditText = ($('#currentAiCreditsText')?.textContent || 'AI riport kredit: 0 db').trim();
      $('#v175PlanCopy') && ($('#v175PlanCopy').textContent = planText);
      $('#v175CreditCopy') && ($('#v175CreditCopy').textContent = creditText);
    } else {
      if (sub) sub.classList.remove('hidden');
      if (credits) credits.classList.remove('hidden');
      active.classList.add('hidden');
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

  window.epnV178RefreshRoleUi = refresh;
})();
