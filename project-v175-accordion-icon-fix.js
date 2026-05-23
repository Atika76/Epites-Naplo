/* V175 – lenyitható blokkok plusz/mínusz ikon szinkron javítás.
   Csak frontend javítás, Supabase-t nem érinti. */
(function(){
  'use strict';

  function setIcon(section){
    if(!section) return;
    const body = section.querySelector(':scope > .v174AccordionBody');
    const icon = section.querySelector(':scope > .v174AccordionHeader .v174AccordionIcon, :scope > .v174AccordionIcon');
    const header = section.querySelector(':scope > .v174AccordionHeader');
    const open = section.classList.contains('v174Open') || (body && body.hidden === false && getComputedStyle(body).display !== 'none');
    const finalOpen = !!open && !section.classList.contains('v174Closed');
    if(icon) icon.textContent = finalOpen ? '−' : '+';
    if(header) header.setAttribute('aria-expanded', finalOpen ? 'true' : 'false');
  }

  function syncAll(){
    document.querySelectorAll('.v174Accordion').forEach(setIcon);
  }

  document.addEventListener('click', function(e){
    const header = e.target.closest('.v174AccordionHeader');
    if(!header) return;
    const section = header.closest('.v174Accordion');
    setTimeout(() => setIcon(section), 0);
    setTimeout(() => setIcon(section), 80);
  }, true);

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAll);
  else syncAll();

  const mo = new MutationObserver(() => syncAll());
  try { mo.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class','hidden','style']}); } catch(_) {}
  setInterval(syncAll, 1200);
})();
