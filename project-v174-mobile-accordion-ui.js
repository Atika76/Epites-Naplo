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

  function mountJumpBar(bar){
    if(!bar) return;
    const nav = $('#nav');
    if(isMobileJumpBar() && nav){
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
    let bar = $('#v174JumpBar');
    if(!bar){
      bar = document.createElement('nav');
      bar.id = 'v174JumpBar';
      bar.className = 'v174JumpBar';
      bar.setAttribute('aria-label','Projekt gyorsmenü');
      bar.innerHTML = `
        <span class="v174JumpItem" role="button" tabindex="0" data-target="v33QuickPanel">Gyors</span>
        <span class="v174JumpItem" role="button" tabindex="0" data-target="dailyFormCard">Napló</span>
        <span class="v174JumpItem" role="button" tabindex="0" data-target="v174ProjectSummaryCard">Projekt</span>
        <span class="v174JumpItem" role="button" tabindex="0" data-target="v173ClientCollabPanel">Ügyfél</span>
        <span class="v174JumpItem" role="button" tabindex="0" data-target="v174TimelineCard">Idővonal</span>
      `;
      bar.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-target]');
        if(!btn) return;
        openAndScroll(btn.dataset.target);
      });
      bar.addEventListener('keydown', (ev) => {
        if(ev.key !== 'Enter' && ev.key !== ' ') return;
        const btn = ev.target.closest('[data-target]');
        if(!btn) return;
        ev.preventDefault();
        openAndScroll(btn.dataset.target);
      });
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
    window.addEventListener('resize', buildJumpBar, { passive:true });
    document.addEventListener('click', (ev) => {
      if(ev.target.closest('.menuBtn')) setTimeout(buildJumpBar, 30);
    }, true);

    const mo = new MutationObserver(() => { buildAccordions(); buildJumpBar(); });
    const shell = $('.projectPageShell') || document.body;
    mo.observe(shell, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
