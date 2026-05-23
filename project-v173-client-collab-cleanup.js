/* V173 – Megrendelői együttműködés: külön ügyfél-megjegyzések, jóváhagyás, pluszmunka, tisztább projekt törlés UI. */
(function(){
  'use strict';
  if(window.__v173ClientCollabUi) return;
  window.__v173ClientCollabUi = true;

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = v => { try { return v ? new Date(v).toLocaleString('hu-HU') : ''; } catch(_) { return String(v || ''); } };
  const money = v => (Number(v || 0) || 0).toLocaleString('hu-HU') + ' Ft';
  const state = () => window.detailState || (typeof detailState !== 'undefined' ? detailState : null);
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectName = () => state()?.project?.name || $('projectTitle')?.textContent || 'Projekt';
  const toast = (msg, type='ok') => typeof showToast === 'function' ? showToast(msg, type) : alert(msg);
  let lastCollab = { links:[], messages:[], extra_works:[] };

  function statusLabel(s){
    s = String(s || 'pending').toLowerCase();
    if(s === 'accepted' || s === 'approved') return 'Elfogadva';
    if(s === 'question') return 'Kérdés érkezett';
    if(s === 'rejected') return 'Elutasítva';
    return 'Jóváhagyásra vár';
  }
  function statusClass(s){
    s = String(s || 'pending').toLowerCase();
    if(s === 'accepted' || s === 'approved') return 'ok';
    if(s === 'question') return 'warn';
    if(s === 'rejected') return 'danger';
    return 'info';
  }
  function typeLabel(t){
    t = String(t || 'note').toLowerCase();
    if(t === 'issue') return 'Hibajelzés';
    if(t === 'question') return 'Kérdés';
    if(t === 'approval') return 'Jóváhagyás';
    return 'Megjegyzés';
  }

  function latestLink(){
    const links = Array.isArray(lastCollab.links) ? lastCollab.links : [];
    return links[0] || null;
  }
  function clientUrlFromToken(token){
    const base = String(window.EPITESNAPLO_SITE_URL || location.origin || 'https://epitesi-naplo.eu').replace(/\/$/, '');
    return `${base}/view.html?client=${encodeURIComponent(token || '')}`;
  }
  function setShareUrl(url){
    const input = $('v173ClientShareUrl');
    if(input) input.value = url || '';
  }

  async function copyText(value){
    const text = String(value || '').trim();
    if(!text) return false;
    try{ await navigator.clipboard.writeText(text); return true; }
    catch(_){ prompt('Másold ki a linket:', text); return false; }
  }

  function renderLinks(){
    const box = $('v173ClientLinksBox');
    if(!box) return;
    const links = Array.isArray(lastCollab.links) ? lastCollab.links : [];
    if(!links.length){
      box.innerHTML = '<div class="v173Empty">Még nincs megrendelői hozzáférési link. Add meg az ügyfél nevét/email címét, majd kattints a link készítésre.</div>';
      setShareUrl('');
      return;
    }
    const link = links[0];
    const url = link.share_url || clientUrlFromToken(link.token);
    setShareUrl(url);
    box.innerHTML = links.slice(0,5).map(row => {
      const rowUrl = row.share_url || clientUrlFromToken(row.token);
      return `<article class="v173MiniRow">
        <div><b>${esc(row.client_name || row.client_email || 'Megrendelő')}</b><small>${esc(row.client_email || '')}${row.is_active === false ? ' · inaktív' : ''}</small><small>${esc(fmt(row.created_at))}</small></div>
        <button class="btn mini" type="button" onclick="v173CopyClientLink('${esc(rowUrl)}')">Link másolása</button>
      </article>`;
    }).join('');
  }

  function renderMessages(){
    const box = $('v173ClientMessagesBox');
    if(!box) return;
    const rows = Array.isArray(lastCollab.messages) ? lastCollab.messages : [];
    if(!rows.length){
      box.innerHTML = '<div class="v173Empty">Még nincs megrendelői megjegyzés vagy kérdés ennél a projektnél.</div>';
      return;
    }
    box.innerHTML = rows.slice(0,20).map(row => `<article class="v173Message ${esc(row.message_type || 'note')}">
      <div class="v173MessageTop"><b>${esc(typeLabel(row.message_type))}</b><span>${esc(fmt(row.created_at))}</span></div>
      <p>${esc(row.message || row.note || '').replace(/\n/g,'<br>')}</p>
      <small>${esc(row.author_name || 'Megrendelő')}${row.author_email ? ' · ' + esc(row.author_email) : ''}</small>
    </article>`).join('');
  }

  function renderExtraWorks(){
    const box = $('v173ExtraWorksBox');
    if(!box) return;
    const rows = Array.isArray(lastCollab.extra_works) ? lastCollab.extra_works : [];
    if(!rows.length){
      box.innerHTML = '<div class="v173Empty">Még nincs rögzített pluszmunka. Itt tudsz olyan tételt felvenni, amit a megrendelőnek külön jóvá kell hagynia.</div>';
      return;
    }
    box.innerHTML = rows.slice(0,30).map(row => `<article class="v173ExtraRow">
      <div class="v173ExtraHead"><b>${esc(row.title || 'Pluszmunka')}</b><span class="v173Status ${statusClass(row.status)}">${esc(statusLabel(row.status))}</span></div>
      <p>${esc(row.description || '').replace(/\n/g,'<br>')}</p>
      <div class="v173ExtraMeta"><strong>${money(row.amount)}</strong><span>${esc(fmt(row.created_at))}</span></div>
      ${(row.client_message || row.client_name || row.client_email) ? `<div class="v173ClientDecision"><b>Megrendelő visszajelzése:</b><br>${esc(row.client_message || '').replace(/\n/g,'<br>')}<small>${esc(row.client_name || '')}${row.client_email ? ' · ' + esc(row.client_email) : ''}${row.client_decision_at ? ' · ' + esc(fmt(row.client_decision_at)) : ''}</small></div>` : ''}
      <div class="v173ExtraActions"><button class="btn mini ghost" type="button" onclick="v173DeleteExtraWork('${esc(row.id)}')">Tétel törlése</button></div>
    </article>`).join('');
  }

  function renderAll(){ renderLinks(); renderMessages(); renderExtraWorks(); }

  async function load(){
    const pid = projectId();
    if(!pid || !window.EpitesNaploAPI?.getProjectClientCollabV173) return;
    const box = $('v173ClientCollabPanel');
    if(box) box.classList.add('isLoading');
    try{
      lastCollab = await window.EpitesNaploAPI.getProjectClientCollabV173(pid) || { links:[], messages:[], extra_works:[] };
      renderAll();
    }catch(e){
      console.warn('V173 megrendelői rész betöltési hiba:', e);
      const msg = String(e?.message || e || '');
      ['v173ClientLinksBox','v173ClientMessagesBox','v173ExtraWorksBox'].forEach(id => { const el=$(id); if(el) el.innerHTML = `<div class="v173Empty warn">A megrendelői modulhoz futtasd a <b>supabase-v173-client-collab-clean-delete.sql</b> fájlt a Supabase SQL Editorban.<br><small>${esc(msg)}</small></div>`; });
    }finally{ if(box) box.classList.remove('isLoading'); }
  }

  window.v173RefreshClientCollab = load;

  window.v173CreateClientLink = async function(){
    const pid = projectId();
    if(!pid) return alert('Hiányzó projekt azonosító.');
    const btn = $('v173CreateClientLinkBtn');
    const old = btn?.innerText || '';
    if(btn){ btn.disabled = true; btn.innerText = 'Link készül...'; }
    try{
      const name = $('v173ClientName')?.value || '';
      const email = $('v173ClientEmail')?.value || '';
      const row = await window.EpitesNaploAPI.createClientProjectLinkV173({ projectId:pid, clientName:name, clientEmail:email });
      const url = row.share_url || clientUrlFromToken(row.token);
      setShareUrl(url);
      await copyText(url);
      toast('Megrendelői link elkészült és másolva lett.', 'ok');
      await load();
    }catch(e){ alert('Megrendelői link hiba: ' + (e?.message || e)); }
    finally{ if(btn){ btn.disabled = false; btn.innerText = old || 'Megrendelői link készítése'; } }
  };

  window.v173CopyMainClientLink = async function(){
    const val = $('v173ClientShareUrl')?.value || '';
    if(!val) return alert('Előbb készíts megrendelői linket.');
    await copyText(val);
    toast('Megrendelői link másolva.', 'ok');
  };
  window.v173CopyClientLink = async function(url){ await copyText(url); toast('Link másolva.', 'ok'); };
  window.v173OpenClientLink = function(){
    const val = $('v173ClientShareUrl')?.value || latestLink()?.share_url || clientUrlFromToken(latestLink()?.token);
    if(!val || /client=$/.test(val)) return alert('Előbb készíts megrendelői linket.');
    window.open(val, '_blank', 'noopener,noreferrer');
  };
  window.v173MailClientLink = function(){
    const val = $('v173ClientShareUrl')?.value || latestLink()?.share_url || clientUrlFromToken(latestLink()?.token);
    const email = $('v173ClientEmail')?.value || latestLink()?.client_email || '';
    if(!val || /client=$/.test(val)) return alert('Előbb készíts megrendelői linket.');
    const subject = encodeURIComponent('Építési napló hozzáférés – ' + projectName());
    const body = encodeURIComponent(`Szia!\n\nItt tudod megnyitni a projekt megrendelői naplóját és visszajelzést írni:\n${val}\n\nÜdv,`);
    location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  };

  window.v173SaveExtraWork = async function(){
    const pid = projectId();
    if(!pid) return alert('Hiányzó projekt azonosító.');
    const btn = $('v173SaveExtraWorkBtn');
    const old = btn?.innerText || '';
    if(btn){ btn.disabled = true; btn.innerText = 'Mentés...'; }
    try{
      await window.EpitesNaploAPI.saveProjectExtraWorkV173({
        projectId: pid,
        title: $('v173ExtraTitle')?.value || '',
        amount: $('v173ExtraAmount')?.value || '',
        description: $('v173ExtraDescription')?.value || ''
      });
      ['v173ExtraTitle','v173ExtraAmount','v173ExtraDescription'].forEach(id => { const el=$(id); if(el) el.value=''; });
      toast('Pluszmunka rögzítve. A megrendelő a saját linkjén jóvá tudja hagyni.', 'ok');
      await load();
    }catch(e){ alert('Pluszmunka mentési hiba: ' + (e?.message || e)); }
    finally{ if(btn){ btn.disabled = false; btn.innerText = old || 'Pluszmunka mentése'; } }
  };

  window.v173DeleteExtraWork = async function(id){
    if(!confirm('Biztosan törlöd ezt a pluszmunka tételt?')) return;
    try{ await window.EpitesNaploAPI.deleteProjectExtraWorkV173(id); toast('Pluszmunka törölve.', 'ok'); await load(); }
    catch(e){ alert('Pluszmunka törlési hiba: ' + (e?.message || e)); }
  };

  // A meglévő törlés gomb után azonnal frissüljenek a kliens oldali helyi jelzések is.
  const oldDelete = window.deleteCurrentProject;
  if(typeof oldDelete === 'function'){
    window.deleteCurrentProject = async function(){
      return oldDelete.apply(this, arguments);
    };
  }

  function start(){
    if($('v173ClientCollabPanel')) load();
    setTimeout(load, 1200);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
