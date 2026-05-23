/* V175 – szerepkör szerinti tiszta megjelenés + publikus bemutató + fizetés elrejtése aktív csomagnál.
   Csak frontend javítás, nem hoz létre új Supabase hívást és nem kell hozzá új SQL. */
(function(){
  'use strict';

  const ADMIN_EMAILS = ['cegweb26@gmail.com', 'atika.76@windowslive.com'];
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function norm(v){ return String(v || '').trim().toLowerCase(); }

  function getEmail(){ return ($('#currentUserEmail')?.textContent || '').trim(); }
  function isLogged(){
    const email = norm(getEmail());
    return !!email && !email.includes('nincs bejelentkezve') && !email.includes('vendég');
  }
  function isAdmin(){ return ADMIN_EMAILS.includes(norm(getEmail())) || !!document.querySelector('#admin:not(.hidden)'); }
  function planText(){ return norm($('#currentPlanText')?.textContent || ''); }
  function isPaidPlan(){
    const t = planText();
    if(isAdmin()) return true;
    return t.includes('alap csomag') || t.includes('starter') || t.includes('pro csomag') || t.includes('business csomag');
  }

  function ensurePublicInfo(){
    if($('#v175PublicInfo')) return;
    const benefits = $('.benefits');
    if(!benefits) return;
    const sec = document.createElement('section');
    sec.id = 'v175PublicInfo';
    sec.className = 'card wide v175PublicInfo';
    sec.innerHTML = `
      <div id="mire-jo" class="v175Anchor"></div>
      <p class="badge">Regisztráció nélkül is olvasható</p>
      <h2>Mire használható az ÉpítésNapló?</h2>
      <p class="muted v175Lead">Az oldal lényege, hogy ne WhatsApp üzenetekből, elveszett fotókból és emlékezetből kelljen bizonyítani, mi történt egy munkán. A kivitelező naplóz, a megrendelő átlátható riportot és jóváhagyási lehetőséget kap.</p>
      <div class="v175InfoGrid">
        <article><b>📸 Fotós munkanapló</b><span>Napi bejegyzések, előtte/utána képek, helyszín, anyagok és megjegyzések egy projekthez.</span></article>
        <article><b>🧾 Ügyfélriport</b><span>Átadható összefoglaló PDF/HTML formában, hogy a megrendelő lássa a haladást.</span></article>
        <article><b>✅ Jóváhagyások</b><span>A megrendelő külön felületen kérdezhet, jelezhet hibát, és jóváhagyhat pluszmunkát.</span></article>
        <article><b>🤖 AI segítség</b><span>A rendszer segíthet kockázatot, hibát, hiányzó információt vagy rosszul dokumentált munkát észrevenni.</span></article>
      </div>
      <div id="public-demo" class="v175DemoBox">
        <div>
          <h3>Demo példa regisztráció nélkül</h3>
          <p class="muted">Itt látható, milyen logikával működik egy projekt: naplózás → fotók → ügyfélriport → megrendelői visszajelzés → pluszmunka jóváhagyás.</p>
        </div>
        <div class="v175DemoSteps" aria-label="ÉpítésNapló demo folyamat">
          <span>1. Projekt</span><span>2. Napi napló</span><span>3. Fotók</span><span>4. Riport</span><span>5. Ügyfél jóváhagyás</span>
        </div>
      </div>
    `;
    benefits.insertAdjacentElement('afterend', sec);
  }

  function ensurePaidStatusCard(){
    let card = $('#v175PaidStatusCard');
    if(!card){
      card = document.createElement('section');
      card.id = 'v175PaidStatusCard';
      card.className = 'card wide v175PaidStatusCard hidden';
      const grid = $('main.grid');
      if(grid) grid.insertBefore(card, grid.firstElementChild);
    }
    const name = ($('#currentUserName')?.textContent || 'Felhasználó').replace(/^Üdv,\s*/i,'');
    const plan = ($('#currentPlanText')?.textContent || 'Aktív csomag').replace(/^Csomag:\s*/i,'');
    const credits = ($('#currentAiCreditsText')?.textContent || 'AI riport kredit: 0 db');
    card.innerHTML = `
      <div class="v175PaidTop">
        <div>
          <p class="badge">Aktív hozzáférés</p>
          <h2>Csomagod rendben van</h2>
          <p class="muted">Nem mutatjuk feleslegesen a fizetési gombokat. Munka közben a projekt, napló, riport és ügyfélkezelés marad elöl.</p>
        </div>
        <a class="btn ghost" href="profile.html">Fiókom / csomag kezelése</a>
      </div>
      <div class="v175StatusGrid">
        <div><b>${escapeText(name)}</b><span>fiók</span></div>
        <div><b>${escapeText(plan)}</b><span>aktuális csomag</span></div>
        <div><b>${escapeText(credits.replace('AI riport kredit:', '').trim())}</b><span>AI kredit</span></div>
      </div>
    `;
  }

  function escapeText(value){
    return String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function markSystemFunctions(){
    $$('section.card, section.card.wide').forEach(sec => {
      const title = norm(sec.querySelector('h2')?.textContent || '');
      if(title.includes('rendszerfunkció')) sec.classList.add('v175AdminOnlyBlock');
      if(sec.id === 'admin') sec.classList.add('v175AdminOnlyBlock');
    });
  }

  function makeGuestNaploPreview(){
    const naplo = $('#naplo');
    if(!naplo || $('#v175GuestNaploPreview')) return;
    const preview = document.createElement('div');
    preview.id = 'v175GuestNaploPreview';
    preview.className = 'notice v175GuestNaploPreview';
    preview.innerHTML = `<b>Projekt létrehozás regisztráció után</b><br>Az oldal bemutató részei szabadon olvashatók. Saját projekt, fotófeltöltés, PDF és ügyfélriport mentéséhez belépés szükséges.`;
    naplo.insertBefore(preview, naplo.querySelector('.formRow'));
  }

  function applyVisibility(){
    ensurePublicInfo();
    ensurePaidStatusCard();
    markSystemFunctions();
    makeGuestNaploPreview();

    const logged = isLogged();
    const admin = isAdmin();
    const paid = isPaidPlan();
    document.body.classList.toggle('v175Guest', !logged);
    document.body.classList.toggle('v175Logged', logged);
    document.body.classList.toggle('v175Admin', admin);
    document.body.classList.toggle('v175Paid', paid);
    document.body.classList.toggle('v175Unpaid', !paid);

    // Fizetési blokkok: aktív csomagnál és adminnál ne foglalják a helyet.
    ['subscription','ai-kreditek'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.classList.toggle('v175HiddenByPlan', paid);
    });
    $$('.paypalBox').forEach(el => el.classList.toggle('v175HiddenByPlan', paid));
    $('#v175PaidStatusCard')?.classList.toggle('hidden', !paid || !logged);

    // Admin és technikai rendszerblokkok csak adminnak.
    $$('.v175AdminOnlyBlock').forEach(el => el.classList.toggle('hidden', !admin));
    $$('#adminMessagesNavLink,#adminPanelNavLink').forEach(el => { if(el) el.classList.toggle('hidden', !admin); });

    // Vendégnek olvasható bemutató, de ne lásson munkavégző űrlap-falat.
    const naplo = $('#naplo');
    if(naplo){
      naplo.classList.toggle('v175GuestLockedCard', !logged);
    }

    // Hero gombok értelmesebb feliratot kapjanak látogatónak.
    const heroPrimary = $('.heroActions .btn.primary');
    if(heroPrimary && !logged){
      heroPrimary.textContent = 'Mire használható?';
      heroPrimary.setAttribute('href', '#mire-jo');
    } else if(heroPrimary && logged){
      heroPrimary.textContent = 'Projektjeim';
      heroPrimary.setAttribute('href', '#naplo');
    }
  }

  // A render() több helyen frissíti a DOM-ot, ezért pár alkalommal újraszinkronizáljuk.
  function schedule(){
    applyVisibility();
    setTimeout(applyVisibility, 120);
    setTimeout(applyVisibility, 600);
    setTimeout(applyVisibility, 1200);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  window.addEventListener('hashchange', schedule);
  try { window.supabaseDirect?.auth?.onAuthStateChange?.(() => setTimeout(schedule, 120)); } catch(_) {}
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if(a && /#(mire-jo|public-demo|home|subscription)/.test(a.getAttribute('href') || '')) setTimeout(schedule, 60);
  }, true);
})();
