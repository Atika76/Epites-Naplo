/* V174 – mobilbarát, lenyitható projektoldal UI.
   Csak kinézeti/használhatósági javítás: nem hoz létre Supabase-hívást és nem kell hozzá új SQL. */
(function(){
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const LS_KEY = 'epn_v174_accordion_state_v1';
  const DEFAULTS = {
    v33QuickPanel: true,
    dailyFormCard: false,
    v174ProjectSummaryCard: false,
    v173ClientCollabPanel: false,
    v174TimelineCard: false
  };

  function readState(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }
    catch(_) { return {}; }
  }

  function writeState(id, open){
    try {
      const state = readState();
      state[id] = !!open;
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch(_) {}
  }

  function icon(open){ return open ? '−' : '+'; }

  function setOpen(section, open, save=true){
    if(!section) return;
    const body = section.querySelector(':scope > .v174AccordionBody');
    const header = section.querySelector(':scope > .v174AccordionHeader');
    const mark = (header && header.querySelector('.v174AccordionIcon')) || section.querySelector('.v174AccordionIcon');
    section.classList.toggle('v174Open', !!open);
    section.classList.toggle('v174Closed', !open);
    if(body) body.hidden = !open;
    if(header) header.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(mark) mark.textContent = icon(open);
    if(save && section.id) writeState(section.id, open);
  }

  function openAndScroll(id){
    const section = document.getElementById(id);
    if(!section) return false;
    setOpen(section, true);
    setTimeout(() => section.scrollIntoView({behavior:'smooth', block:'start'}), 40);
    return true;
  }

  function makeAccordion(section, cfg){
    if(!section || section.dataset.v174Accordion === '1') return;
    if(!section.id) section.id = cfg.id;
    section.dataset.v174Accordion = '1';
    section.classList.add('v174Accordion');

    const id = section.id || cfg.id;
    const saved = readState();
    const defaultOpen = Object.prototype.hasOwnProperty.call(saved, id) ? !!saved[id] : !!cfg.open;

    const original = Array.from(section.childNodes);
    const body = document.createElement('div');
    body.className = 'v174AccordionBody';
    original.forEach(node => body.appendChild(node));

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'v174AccordionHeader';
    header.setAttribute('aria-controls', id + '_body');
    body.id = id + '_body';
    header.innerHTML = `
      <span class="v174AccordionText">
        <strong>${cfg.title}</strong>
        <small>${cfg.desc || ''}</small>
      </span>
      <span class="v174AccordionIcon" aria-hidden="true">${icon(defaultOpen)}</span>
    `;
    header.addEventListener('click', () => setOpen(section, !section.classList.contains('v174Open')));

    section.appendChild(header);
    section.appendChild(body);
    setOpen(section, defaultOpen, false);
  }

  function labelCards(){
    const summary = $('#projectSummaryBox')?.closest('.card');
    if(summary && !summary.id) summary.id = 'v174ProjectSummaryCard';
    const timeline = $('#projectTimeline')?.closest('.card');
    if(timeline && !timeline.id) timeline.id = 'v174TimelineCard';
  }

  function buildAccordions(){
    labelCards();
    makeAccordion($('#v33QuickPanel'), {
      id:'v33QuickPanel',
      title:'Gyors mentés',
      desc:'Telefonon a leggyorsabb: fotó, rövid jegyzet, mentés.',
      open: DEFAULTS.v33QuickPanel
    });
    makeAccordion($('#dailyFormCard'), {
      id:'dailyFormCard',
      title:'Mai napló',
      desc:'Részletes napi bejegyzés, státusz, GPS, időjárás, anyagok és fotók.',
      open: DEFAULTS.dailyFormCard
    });
    makeAccordion($('#v174ProjectSummaryCard'), {
      id:'v174ProjectSummaryCard',
      title:'Projekt összefoglaló',
      desc:'Állapot, statisztika, mentés, törlés, számlák és projektzárás.',
      open: DEFAULTS.v174ProjectSummaryCard
    });
    makeAccordion($('#v173ClientCollabPanel'), {
      id:'v173ClientCollabPanel',
      title:'Megrendelői együttműködés',
      desc:'Ügyfél link, jóváhagyások, megrendelői bejegyzések és pluszmunka.',
      open: DEFAULTS.v173ClientCollabPanel
    });
    makeAccordion($('#v174TimelineCard'), {
      id:'v174TimelineCard',
      title:'Idővonal',
      desc:'Napi bejegyzések, fotók, anyagok és AI jelzések egy helyen.',
      open: DEFAULTS.v174TimelineCard
    });
  }

  function isMobileJumpBar(){
    return !!(window.matchMedia && window.matchMedia('(max-width: 860px)').matches);
  }

  function getMainNav(){
    return document.getElementById('nav') || document.querySelector('.topbar nav');
  }

  function createJumpBar(){
    const bar = document.createElement('nav');
    bar.id = 'v174JumpBar';
    bar.className = 'v174JumpBar';
    bar.setAttribute('aria-label','Projekt gyorsmenü');
    bar.innerHTML = `
      <button class="v174JumpItem" type="button" data-target="v33QuickPanel">Gyors</button>
      <button class="v174JumpItem" type="button" data-target="dailyFormCard">Napló</button>
      <button class="v174JumpItem" type="button" data-target="v174ProjectSummaryCard">Projekt</button>
      <button class="v174JumpItem" type="button" data-target="v173ClientCollabPanel">Ügyfél</button>
      <button class="v174JumpItem" type="button" data-target="v174TimelineCard">Idővonal</button>
    `;
    bar.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-target]');
      if(!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      openAndScroll(btn.dataset.target);
      try{ window.closeMobileMenu?.(); }catch(_){}
    });
    return bar;
  }

  function mountJumpBar(bar){
    if(!bar) return;
    const nav = getMainNav();
    if(isMobileJumpBar() && nav){
      // V181: a gyors projekt menü mindig a hamburger menü jobb oldali oszlopában marad.
      // A fejléc auth-frissítése néha újrarajzolja a nav tartalmát, ezért itt minden hívásnál visszatesszük.
      bar.classList.add('v174InMenu');
      nav.classList.add('hasV174JumpBar');
      if(bar.parentElement !== nav) nav.appendChild(bar);
      return;
    }
    bar.classList.remove('v174InMenu');
    if(nav) nav.classList.remove('hasV174JumpBar');
    if(bar.parentElement !== document.body) document.body.appendChild(bar);
  }

  function buildJumpBar(){
    let bar = document.getElementById('v174JumpBar');
    if(!bar) bar = createJumpBar();

    // Biztonsági ellenőrzés: ha régi ZIP/cache miatt sérült vagy hiányos a menü, újraépítjük.
    const expected = ['Gyors','Napló','Projekt','Ügyfél','Idővonal'];
    const actual = Array.from(bar.querySelectorAll('[data-target]')).map(x => (x.textContent || '').trim());
    if(expected.some(label => !actual.includes(label))){
      bar.replaceWith(createJumpBar());
      bar = document.getElementById('v174JumpBar') || createJumpBar();
    }
    mountJumpBar(bar);
  }

  function patchExistingButtons(){
    const originalScrollToDaily = window.scrollToDailyForm;
    window.scrollToDailyForm = function(){
      if(!openAndScroll('dailyFormCard') && typeof originalScrollToDaily === 'function') originalScrollToDaily();
    };

    document.addEventListener('click', (ev) => {
      const clientBtn = ev.target.closest('.v173ClientAction');
      if(clientBtn){
        setTimeout(() => openAndScroll('v173ClientCollabPanel'), 20);
      }
    }, true);
  }

  function init(){
    buildAccordions();
    buildJumpBar();
    patchExistingButtons();

    let jumpBarTimer = null;
    function scheduleJumpBar(){
      clearTimeout(jumpBarTimer);
      jumpBarTimer = setTimeout(() => { buildAccordions(); buildJumpBar(); }, 25);
    }

    window.addEventListener('resize', scheduleJumpBar, { passive:true });
    window.addEventListener('orientationchange', scheduleJumpBar, { passive:true });
    window.addEventListener('hashchange', scheduleJumpBar, { passive:true });
    document.addEventListener('click', (ev) => {
      if(ev.target.closest('.menuBtn')) setTimeout(buildJumpBar, 0);
    }, true);

    // V181: nem csak a projekt tartalmát figyeljük, hanem a fejlécet is,
    // mert a bejelentkezési állapot frissítése felülírhatja a hamburger menü HTML-jét.
    const mo = new MutationObserver(scheduleJumpBar);
    const shell = $('.projectPageShell') || document.body;
    mo.observe(shell, {childList:true, subtree:true});
    const topbar = $('.topbar') || document.body;
    mo.observe(topbar, {childList:true, subtree:true, attributes:true, attributeFilter:['class','aria-expanded']});

    // Rövid indítási őrzés: lassabb telefonon / auth betöltés után is visszakerül a jobb oldali gyorsmenü.
    [60, 180, 420, 900, 1600].forEach(ms => setTimeout(scheduleJumpBar, ms));
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
