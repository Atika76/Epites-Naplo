/* V177 – V175b alap: tiszta főoldal, publikus Rendszerfunkciók, fizetési blokkok rendezése.
   Csak frontend javítás: nem hoz létre Supabase hívást és nem kell hozzá új SQL. */
(function(){
  'use strict';
  if (window.__epnV175RoleCleanup) return;
  window.__epnV175RoleCleanup = true;

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
        <p class="muted">Nem mutatjuk a nagy fizetési blokkokat, hogy a munkaoldal ne legyen zsúfolt.</p>
      </div>
      <div class="v175ActivePlanGrid">
        <div><b id="v175PlanCopy">Csomag: –</b><span>Hozzáférés állapota</span></div>
        <div><b id="v175CreditCopy">AI kredit: 0 db</b><span>Külön AI riportokhoz</span></div>
        <div><a class="btn ghost full" href="profile.html">Fiók / csomag kezelése</a></div>
      </div>
    `;
    const credit = $('#ai-kreditek');
    const sub = $('#subscription');
    if (credit && credit.parentNode) credit.parentNode.insertBefore(card, credit.nextSibling);
    else if (sub && sub.parentNode) sub.parentNode.insertBefore(card, sub.nextSibling);
    return card;
  }

  function refreshNav(plan){
    const logged = isLoggedIn();
    const admin = isAdminUser();

    $$('.guestReadableNav').forEach(el => el.classList.toggle('hidden', logged));
    $$('.userWorkNav').forEach(el => el.classList.toggle('hidden', !logged));
    const packages = $('#packagesNavLink');
    if (packages) {
      packages.textContent = isPaid(plan) ? 'Csomagom' : 'Csomagok';
      packages.setAttribute('href', isPaid(plan) ? '#v175ActivePlanCard' : '#subscription');
    }

    $('#adminMessagesNavLink')?.classList.toggle('hidden', !admin);
    $('#adminPanelNavLink')?.classList.toggle('hidden', !admin);
    $('#adminNavLink')?.classList.toggle('hidden', !admin);
    // A rendszerfunkciók nyilvános bemutató blokk: vendégnek is látszódhat.
    $('#systemFeatures')?.classList.remove('hidden');
    $('#admin')?.classList.toggle('hidden', !admin);

    document.body.classList.toggle('v175Guest', !logged);
    document.body.classList.toggle('v175Logged', logged);
    document.body.classList.toggle('v175Admin', admin);
    document.body.classList.toggle('v175Paid', isPaid(plan));
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
      $('#v175PlanCopy').textContent = planText;
      $('#v175CreditCopy').textContent = creditText;
    } else {
      if (sub) sub.classList.remove('hidden');
      if (credits) credits.classList.remove('hidden');
      active.classList.add('hidden');
    }
  }

  function refreshGuestBlocks(){
    const logged = isLoggedIn();
    // A támogatási/admin üzenet csak belépett felhasználónak látszódjon.
    $$('.userOnlyBlock').forEach(el => el.classList.toggle('hidden', !logged));
    // A rendszerfunkciók legyen olvasható vendégnek is; ez mutatja be, mire képes az oldal.
    $('#systemFeatures')?.classList.remove('hidden');
  }

  function refresh(){
    const plan = getPlan();
    refreshNav(plan);
    refreshPayments(plan);
    refreshGuestBlocks();
  }

  // A régi render() futása után is rendezze újra a felületet.
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

  // Supabase auth állapot és később betöltődő profil miatt pár gyors frissítés.
  let ticks = 0;
  const timer = setInterval(() => {
    refresh();
    ticks += 1;
    if (ticks > 12) clearInterval(timer);
  }, 700);

  window.epnV175RefreshRoleUi = refresh;
})();
