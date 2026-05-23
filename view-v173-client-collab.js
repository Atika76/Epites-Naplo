/* V173 – Publikus megrendelői napló: külön ügyfél-megjegyzés, pluszmunka jóváhagyás, a kivitelezői napló módosítása nélkül. */
(function(){
  'use strict';
  if(window.__v173PublicClientCollab) return;
  window.__v173PublicClientCollab = true;

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = v => { try { return v ? new Date(v).toLocaleString('hu-HU') : ''; } catch(_) { return String(v || ''); } };
  const money = v => (Number(v || 0) || 0).toLocaleString('hu-HU') + ' Ft';
  const params = () => new URLSearchParams(location.search);
  const clientToken = () => String(params().get('client') || params().get('ugyfel') || '').trim();
  const reportToken = () => String(params().get('riport') || params().get('token') || params().get('report') || params().get('id') || '').trim();
  let collab = { ok:false, messages:[], extra_works:[] };

  function css(){
    if($('v173ClientCollabCss')) return;
    const style = document.createElement('style');
    style.id = 'v173ClientCollabCss';
    style.textContent = `
      .v173ClientBox{max-width:1120px;margin:18px auto 32px;padding:0 16px}.v173ClientCard{background:#fff;border-radius:18px;padding:22px;box-shadow:0 18px 55px rgba(0,0,0,.22);border:1px solid #e5e7eb;color:#0f172a}.v173ClientHead{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:16px}.v173ClientHead h2{margin:0;font-size:25px}.v173ClientHead p{margin:6px 0 0;color:#64748b}.v173Badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:#dcfce7;color:#166534;font-weight:900;font-size:13px;padding:8px 11px}.v173ClientGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.v173Panel{border:1px solid #e5e7eb;background:#f8fafc;border-radius:16px;padding:16px}.v173Panel h3{margin:0 0 10px}.v173Panel input,.v173Panel textarea,.v173Panel select{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:12px;margin:6px 0;font-size:15px}.v173Panel textarea{min-height:110px;resize:vertical}.v173Actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.v173Btn{border:0;border-radius:12px;padding:11px 14px;font-weight:900;cursor:pointer;background:#e5e7eb;color:#111827}.v173Btn.primary{background:linear-gradient(135deg,#fbbf24,#f59e0b)}.v173Btn.ghost{background:#17263b;color:#fff}.v173Btn:disabled{opacity:.65;cursor:wait}.v173Note,.v173Extra{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:13px;margin:10px 0}.v173NoteTop,.v173ExtraTop{display:flex;justify-content:space-between;gap:10px;align-items:center}.v173Note p,.v173Extra p{white-space:pre-wrap;color:#334155;margin:8px 0}.v173Note small,.v173Extra small{display:block;color:#64748b}.v173Status{display:inline-flex;border-radius:999px;padding:6px 9px;font-size:12px;font-weight:900}.v173Status.pending{background:#fef3c7;color:#92400e}.v173Status.accepted{background:#dcfce7;color:#166534}.v173Status.question{background:#ffedd5;color:#9a3412}.v173Status.rejected{background:#fee2e2;color:#991b1b}.v173Empty{padding:14px;border-radius:14px;background:#f1f5f9;color:#475569}.v173Saved{margin-top:10px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;border-radius:14px;padding:12px;font-weight:800}@media(max-width:760px){.v173ClientHead{display:block}.v173ClientGrid{grid-template-columns:1fr}.v173ClientCard{padding:18px;border-radius:16px}.v173Actions .v173Btn{width:100%}}@media print{.v173ClientBox{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function typeLabel(t){
    t = String(t || 'note').toLowerCase();
    if(t === 'issue') return 'Hibajelzés';
    if(t === 'question') return 'Kérdés';
    if(t === 'approval') return 'Jóváhagyás';
    return 'Megjegyzés';
  }
  function statusLabel(s){
    s = String(s || 'pending').toLowerCase();
    if(s === 'accepted' || s === 'approved') return 'Elfogadva';
    if(s === 'question') return 'Kérdés érkezett';
    if(s === 'rejected') return 'Elutasítva';
    return 'Jóváhagyásra vár';
  }
  function statusClass(s){
    s = String(s || 'pending').toLowerCase();
    if(s === 'accepted' || s === 'approved') return 'accepted';
    if(s === 'question') return 'question';
    if(s === 'rejected') return 'rejected';
    return 'pending';
  }

  function ensureBox(){
    css();
    let host = $('v173ClientCollabHost');
    if(host) return host;
    host = document.createElement('section');
    host.id = 'v173ClientCollabHost';
    host.className = 'v173ClientBox';
    const main = document.querySelector('main') || document.body;
    main.appendChild(host);
    return host;
  }

  function render(){
    const host = ensureBox();
    const messages = Array.isArray(collab.messages) ? collab.messages : [];
    const extras = Array.isArray(collab.extra_works) ? collab.extra_works : [];
    const title = collab.project_name || 'Építési projekt';
    host.innerHTML = `<div class="v173ClientCard">
      <div class="v173ClientHead"><div><span class="v173Badge">Megrendelői felület</span><h2>Visszajelzés és megrendelői napló</h2><p><b>${esc(title)}</b><br>A kivitelező hivatalos naplóját nem tudod átírni. Itt külön megjegyzést, kérdést, hibajelzést vagy pluszmunka-választ tudsz rögzíteni.</p></div></div>
      <div class="v173ClientGrid">
        <section class="v173Panel">
          <h3>Megjegyzés / kérdés írása</h3>
          <input id="v173PublicClientName" placeholder="Név / cég">
          <input id="v173PublicClientEmail" placeholder="Email cím (opcionális)">
          <select id="v173PublicClientType"><option value="note">Megjegyzés</option><option value="question">Kérdés</option><option value="issue">Hibajelzés</option><option value="approval">Jóváhagyási megjegyzés</option></select>
          <textarea id="v173PublicClientMessage" placeholder="Írd le, amit rögzíteni szeretnél. Példa: Megtekintettem a mai munkát, a konyhai falrészt még szeretném egyeztetni."></textarea>
          <div class="v173Actions"><button id="v173PublicSaveNoteBtn" class="v173Btn primary" type="button" onclick="v173PublicSaveClientNote(this)">Visszajelzés mentése</button></div>
          <div id="v173PublicSaveResult"></div>
        </section>
        <section class="v173Panel">
          <h3>Pluszmunkák jóváhagyása</h3>
          <div id="v173PublicExtraList">${renderExtras(extras)}</div>
        </section>
      </div>
      <section class="v173Panel" style="margin-top:14px"><h3>Korábbi megrendelői bejegyzések</h3><div id="v173PublicMessageList">${renderMessages(messages)}</div></section>
    </div>`;
  }

  function renderMessages(rows){
    if(!rows.length) return '<div class="v173Empty">Még nincs megrendelői bejegyzés.</div>';
    return rows.slice(0,30).map(row => `<article class="v173Note"><div class="v173NoteTop"><b>${esc(typeLabel(row.message_type))}</b><span>${esc(fmt(row.created_at))}</span></div><p>${esc(row.message || '').replace(/\n/g,'<br>')}</p><small>${esc(row.author_name || 'Megrendelő')}${row.author_email ? ' · ' + esc(row.author_email) : ''}</small></article>`).join('');
  }
  function renderExtras(rows){
    if(!rows.length) return '<div class="v173Empty">Nincs jóváhagyásra váró pluszmunka.</div>';
    return rows.map(row => `<article class="v173Extra"><div class="v173ExtraTop"><b>${esc(row.title || 'Pluszmunka')}</b><span class="v173Status ${statusClass(row.status)}">${esc(statusLabel(row.status))}</span></div><p>${esc(row.description || '').replace(/\n/g,'<br>')}</p><small><b>${money(row.amount)}</b> · ${esc(fmt(row.created_at))}</small>${String(row.status || 'pending').toLowerCase()==='pending' ? `<div class="v173Actions"><button class="v173Btn primary" onclick="v173PublicDecideExtra('${esc(row.id)}','accepted',this)">Elfogadom</button><button class="v173Btn ghost" onclick="v173PublicDecideExtra('${esc(row.id)}','question',this)">Kérdésem van</button><button class="v173Btn" onclick="v173PublicDecideExtra('${esc(row.id)}','rejected',this)">Nem fogadom el</button></div>` : ''}</article>`).join('');
  }

  async function load(){
    if(!window.EpitesNaploAPI?.clientGetProjectCollabV173) return;
    const ct = clientToken();
    const rt = reportToken();
    if(!ct && !rt) return;
    const host = ensureBox();
    host.innerHTML = '<div class="v173ClientCard"><div class="v173Empty">Megrendelői felület betöltése...</div></div>';
    try{
      collab = await window.EpitesNaploAPI.clientGetProjectCollabV173({ clientToken:ct, reportToken:rt }) || { ok:false };
      if(!collab.ok){
        host.innerHTML = '<div class="v173ClientCard"><div class="v173Empty">A megrendelői link nem található vagy már nem aktív.</div></div>';
        if(ct && !rt){ const box=$('publicReportContent'); if(box) box.innerHTML='<h2>Megrendelői napló</h2><p>Riport nélkül is tudsz visszajelzést írni a kivitelezőnek az alábbi felületen.</p>'; }
        return;
      }
      if(ct && !rt){ const box=$('publicReportContent'); if(box) box.innerHTML=`<h2>${esc(collab.project_name || 'Megrendelői napló')}</h2><p>Ez a megrendelői felület. Itt kérdést, megjegyzést vagy hibajelzést írhatsz, a kivitelező pedig látni fogja a projektoldalon.</p>`; }
      render();
    }catch(e){
      host.innerHTML = `<div class="v173ClientCard"><div class="v173Empty">Megrendelői modul hiba. A kivitelezőnek futtatnia kell a V173 Supabase SQL fájlt.<br><small>${esc(e?.message || e)}</small></div></div>`;
    }
  }

  window.v173PublicSaveClientNote = async function(btn){
    const old = btn?.innerText || '';
    if(btn){ btn.disabled = true; btn.innerText = 'Mentés...'; }
    try{
      await window.EpitesNaploAPI.clientAddProjectNoteV173({
        clientToken: clientToken(),
        reportToken: reportToken(),
        name: $('v173PublicClientName')?.value || '',
        email: $('v173PublicClientEmail')?.value || '',
        type: $('v173PublicClientType')?.value || 'note',
        message: $('v173PublicClientMessage')?.value || ''
      });
      const res = $('v173PublicSaveResult');
      if(res) res.innerHTML = '<div class="v173Saved">Visszajelzés mentve. A kivitelező látni fogja a projektoldalon.</div>';
      const msg = $('v173PublicClientMessage'); if(msg) msg.value = '';
      await load();
    }catch(e){ alert('Mentési hiba: ' + (e?.message || e)); }
    finally{ if(btn){ btn.disabled = false; btn.innerText = old || 'Visszajelzés mentése'; } }
  };

  window.v173PublicDecideExtra = async function(id, decision, btn){
    const name = $('v173PublicClientName')?.value || prompt('Név / cég a jóváhagyáshoz:', '') || '';
    const email = $('v173PublicClientEmail')?.value || '';
    const message = prompt(decision === 'accepted' ? 'Megjegyzés a pluszmunka elfogadásához (opcionális):' : 'Írd le röviden az indoklást vagy kérdést:', '') || '';
    const old = btn?.innerText || '';
    if(btn){ btn.disabled = true; btn.innerText = 'Mentés...'; }
    try{
      await window.EpitesNaploAPI.clientDecideExtraWorkV173({ clientToken:clientToken(), reportToken:reportToken(), extraWorkId:id, decision, name, email, message });
      alert('Visszajelzés mentve.');
      await load();
    }catch(e){ alert('Pluszmunka válasz mentési hiba: ' + (e?.message || e)); }
    finally{ if(btn){ btn.disabled = false; btn.innerText = old; } }
  };

  function start(){ setTimeout(load, 900); setTimeout(load, 2200); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
