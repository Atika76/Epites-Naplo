// V128 - projekt összefoglaló gomb-visszajelzés fix
// Cél: a Projekt összefoglalóban lévő Saját példány HTML / PDF / ügyfél link gombok is
// láthatóan írják ki, hogy dolgoznak, ne csak csendben induljon el a folyamat.
(function(){
  'use strict';
  if(window.__epitesNaploV128ButtonStatusFix) return;
  window.__epitesNaploV128ButtonStatusFix = true;

  function isButton(el){ return el && el.tagName === 'BUTTON'; }
  function escCss(v){ try { return CSS.escape(String(v)); } catch(_) { return String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); } }

  function setBusy(btn, text){
    if(!isButton(btn)) return function(){};
    if(!btn.dataset.v128OriginalHtml) btn.dataset.v128OriginalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy','true');
    btn.innerHTML = text || 'Dolgozom…';
    return function(){
      if(!isButton(btn)) return;
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
      if(btn.dataset.v128OriginalHtml){
        btn.innerHTML = btn.dataset.v128OriginalHtml;
        delete btn.dataset.v128OriginalHtml;
      }
    };
  }

  function activeButton(){
    const a = document.activeElement;
    return isButton(a) ? a : null;
  }

  function findButtonFor(action, id){
    const a = activeButton();
    if(action === 'html'){
      if(a && (a.matches('[data-v109-copy]') || a.matches('[data-v71-download]') || a.matches('[data-v79-approval-download]'))) return a;
      if(id) return document.querySelector(`[data-v109-copy="${escCss(id)}"], [data-v71-download="${escCss(id)}"], [data-v79-approval-download="${escCss(id)}"]`);
    }
    if(action === 'pdf'){
      if(a && (a.matches('[data-v109-pdf]') || a.matches('[data-v71-print]') || a.matches('[data-v79-approval-print]'))) return a;
      if(id) return document.querySelector(`[data-v109-pdf="${escCss(id)}"], [data-v71-print="${escCss(id)}"], [data-v79-approval-print="${escCss(id)}"]`);
    }
    if(action === 'reply'){
      if(a && a.matches('[data-v109-reply]')) return a;
      if(id) return document.querySelector(`[data-v109-reply="${escCss(id)}"]`);
    }
    if(action === 'clientLink'){
      if(a && /ügyfél|link|jóváhagyás/i.test(a.textContent || '')) return a;
    }
    return null;
  }

  function wrapAsync(fnName, action, label){
    const original = window[fnName];
    if(typeof original !== 'function' || original.__v128Wrapped) return;
    const wrapped = async function(){
      const id = arguments[0];
      const btn = findButtonFor(action, id);
      const done = setBusy(btn, typeof label === 'function' ? label(btn, id) : label);
      try{
        return await original.apply(this, arguments);
      }finally{
        setTimeout(done, 350);
      }
    };
    wrapped.__v128Wrapped = true;
    wrapped.__v128Original = original;
    window[fnName] = wrapped;
  }

  function installWrappers(){
    wrapAsync('v71DownloadApprovedHtml', 'html', 'Saját példány készül…');
    wrapAsync('v71PrintApprovedReport', 'pdf', 'PDF készül…');
    wrapAsync('v109ReplyToClientQuestion', 'reply', 'Válasz ablak nyílik…');
    wrapAsync('createProjectClientLinkV25', 'clientLink', 'Ügyfél link készül…');
  }

  // A V77 mentett riport gombok saját belső kezelőt használnak, ezért itt csak a feliratot pontosítjuk.
  document.addEventListener('click', function(e){
    const btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if(!btn) return;

    if(btn.matches('[data-v77-down]')){
      setTimeout(function(){ if(btn.disabled) btn.innerHTML = 'HTML mentés készül…'; }, 0);
    }
    if(btn.matches('[data-v77-pdf]')){
      setTimeout(function(){ if(btn.disabled) btn.innerHTML = 'PDF készül…'; }, 0);
    }
    if(btn.matches('[data-v77-open]')){
      setTimeout(function(){ if(btn.disabled) btn.innerHTML = 'Riport megnyitása…'; }, 0);
    }
    if(btn.matches('[data-v77-del]')){
      setTimeout(function(){ if(btn.disabled) btn.innerHTML = 'Törlés…'; }, 0);
    }
  }, true);

  installWrappers();
  document.addEventListener('DOMContentLoaded', installWrappers);
  setTimeout(installWrappers, 400);
  setTimeout(installWrappers, 1400);
})();
