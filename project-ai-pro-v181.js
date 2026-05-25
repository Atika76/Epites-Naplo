/* V181 AI PRO erősítés – csak helyi, biztonságos AI-logika.
   Nem kell hozzá új SQL és nem nyúl a mentési / képfeltöltési / videófeltöltési működéshez. */
(function(){
  'use strict';
  if (window.__epnAiProV181Loaded) return;
  window.__epnAiProV181Loaded = true;

  const $ = id => document.getElementById(id);
  const esc = value => (typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value)
    : String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])));
  const norm = value => String(value || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function toArray(value){ return Array.isArray(value) ? value.filter(Boolean) : []; }
  function countFromText(text, word){
    const re = new RegExp(word + '\\s*:?\\s*(\\d+)\\s*db', 'i');
    const m = String(text || '').match(re);
    return m ? Number(m[1] || 0) : 0;
  }
  function materialList(input){
    const a = toArray(input.materials || input.materials_json);
    return a.filter(m => m && (m.name || m.quantity || m.unit));
  }
  function mediaCounts(input, note){
    const images = toArray(input.images || input.image_urls);
    const videos = toArray(input.videos || input.videoUrls || input.video_urls);
    const imageCount = Number(input.imageCount ?? input.photoCount ?? images.length ?? 0)
      || countFromText(note, 'foto') || countFromText(note, 'fotó') || countFromText(note, 'kep') || countFromText(note, 'kép');
    const videoCount = Number(input.videoCount ?? videos.length ?? 0)
      || countFromText(note, 'video') || countFromText(note, 'videó') || countFromText(note, 'munkavideo') || countFromText(note, 'munkavideó');
    const beforeImageCount = Number(input.beforeImageCount ?? toArray(input.beforeImages).length ?? 0) || countFromText(note, 'elotte foto') || countFromText(note, 'előtte fotó');
    const afterImageCount = Number(input.afterImageCount ?? toArray(input.afterImages).length ?? 0) || countFromText(note, 'utana foto') || countFromText(note, 'utána fotó');
    return { imageCount, videoCount, beforeImageCount, afterImageCount };
  }

  const highRules = [
    { re:/\b(beazas|beazik|azik|csotores|vizbetores|penesz|nedvesedes|vizes fal|saletrom)\b/, label:'nedvesség / beázás gyanú' },
    { re:/\b(repedes|reped|hasad|sullyedes|statikai|omlas|megrogyott|megsullyedt|falmozg|fodém|fodem|athidalo)\b/, label:'szerkezeti vagy repedési kockázat' },
    { re:/\b(aram|villany|gaz|eletveszely|veszelyes|szikrazik|rovidzarlat|füst|fust)\b/, label:'biztonsági kockázat' },
    { re:/\b(hianyos alatamasztas|alatamasztas nelkul|nincs vedolem|balesetveszely|korlat hianyzik)\b/, label:'munkavédelmi kockázat' }
  ];
  const mediumRules = [
    { re:/\b(hiany|hianyzik|nem keszult|nem lett|kimaradt|elmaradt)\b/, label:'hiányzó vagy elmaradt munkarész' },
    { re:/\b(eso|esett|fagy|minusz|szel|sar|csuszos|nedves|lassult|csuszas|kesik)\b/, label:'időjárás / ütemezési kockázat' },
    { re:/\b(serult|rossz|javitas|ujra kell|visszabontas|bontas|eltérés|elteres)\b/, label:'javítandó eltérés' },
    { re:/\b(nem fer|nem pontos|szint hiba|lejtés|lejtes|vizszint|meret hiba)\b/, label:'méret / szint / lejtés ellenőrizendő' }
  ];

  function phaseHints(text, phase){
    const t = norm((phase || '') + ' ' + text);
    const out = [];
    if (/falaz|tegla|ytong|zsaluko|koszoru/.test(t)) out.push('Falazásnál ellenőrizd a függőt, vízszintet, kötést és áthidalókat.');
    if (/beton|vasalas|aljzat|esztrich|alap|koszoru/.test(t)) out.push('Betonozásnál legyen fotó a vasalásról, zsaluzatról, rétegrendről és időjárásról.');
    if (/szigetel|bitumen|dryvit|homlokzat|hoszigetel/.test(t)) out.push('Szigetelésnél fontos a rétegrend, csatlakozás, átfedés és nedvesség elleni védelem fotózása.');
    if (/burkol|csempe|jarolap|padlolap/.test(t)) out.push('Burkolásnál a sík, lejtés, dilatáció és alapfelület állapota legyen dokumentálva.');
    if (/tető|teto|cserep|bádog|badog|eresz/.test(t)) out.push('Tetőnél külön figyelj a vízelvezetésre, átfedésekre és beázási pontokra.');
    if (/villany|gepészet|gepeszet|viz|csatorna|futes/.test(t)) out.push('Gépészetnél a nyomvonal, kötési pontok és próba/ellenőrzés legyen rögzítve.');
    return out;
  }

  function suggestMaterials(text, phase){
    const t = norm((phase || '') + ' ' + text);
    const set = new Set();
    if (/falaz|tegla|ytong|zsaluko/.test(t)) ['falazóelem','habarcs/ragasztó','vízszint ellenőrzés','áthidaló/koszorú ellenőrzés'].forEach(x=>set.add(x));
    if (/beton|aljzat|esztrich|alap|koszoru/.test(t)) ['beton/cement','sóder vagy készbeton','vasalás','zsaluzat','utókezelés'].forEach(x=>set.add(x));
    if (/szigetel|dryvit|homlokzat|bitumen/.test(t)) ['szigetelőanyag','ragasztó/tapasz','háló/élvédő','csatlakozási részletek'].forEach(x=>set.add(x));
    if (/burkol|csempe|jarolap/.test(t)) ['burkolólap','ragasztó','fuga','alapozó','dilatáció'].forEach(x=>set.add(x));
    if (/fest|glett|vakol/.test(t)) ['glett/vakolat','alapozó','festék','csiszolás ellenőrzése'].forEach(x=>set.add(x));
    return Array.from(set).slice(0, 6);
  }

  function buildAdvancedAnalysis(input = {}){
    const note = String(input.note || input.text || '').trim();
    const phase = String(input.phase || 'Napi bejegyzés').trim();
    const status = String(input.status || '').trim();
    const priority = String(input.priority || '').trim();
    const t = norm(`${phase} ${status} ${priority} ${note}`);
    const mat = materialList(input);
    const media = mediaCounts(input, note);
    const highHits = highRules.filter(r => r.re.test(t)).map(r => r.label);
    const mediumHits = mediumRules.filter(r => r.re.test(t)).map(r => r.label);
    const missing = [];

    if (note.replace(/\s+/g, ' ').length < 35) missing.push('részletesebb munkaleírás');
    if (!media.imageCount) missing.push('fotódokumentáció');
    if (media.imageCount && !(media.beforeImageCount || media.afterImageCount) && /elotte|utana|előtte|utána|bontas|javitas|kesz|átadás|atadas/.test(t)) missing.push('előtte/utána fotó');
    if (!/idojaras|időjárás|korulmeny|körülmény|eso|eső|napos|szel|szél|fagy|homerseklet|hőmérséklet/.test(t)) missing.push('időjárás/körülmény');
    if (!/gps|helyadat|cim|cím|helyszin|helyszín/.test(t)) missing.push('GPS vagy helyszín adat');
    if (!mat.length && !/anyagfelhasznalas|anyagfelhasználás|anyag:|cement|tegla|tégla|beton|ragaszto|ragasztó|festek|festék/.test(t)) missing.push('anyagfelhasználás');

    let score = 0;
    score += highHits.length * 42;
    score += mediumHits.length * 18;
    if (!media.imageCount) score += 16;
    if (media.videoCount && !media.imageCount) score += 8;
    if (missing.includes('időjárás/körülmény')) score += 7;
    if (missing.includes('GPS vagy helyszín adat')) score += 5;
    if (String(priority).toLowerCase() === 'magas') score += 16;
    if (/javitas szukseges|javítás szükséges|ellenorzesre var|ellenőrzésre vár/.test(t)) score += 12;
    score = Math.min(100, score);

    const level = score >= 58 ? 'Magas' : score >= 25 ? 'Közepes' : 'Alacsony';
    const title = level === 'Magas'
      ? 'Ellenőrizendő kockázat a naplóban'
      : level === 'Közepes'
        ? 'Dokumentációs vagy munkafázis ellenőrzés javasolt'
        : 'Rendezett napi dokumentáció';

    const advice = [];
    if (highHits.length) advice.push(`Kiemelt figyelem: ${highHits.join(', ')}. Készíts közeli fotót, távoli áttekintő fotót és rövid magyarázatot.`);
    if (mediumHits.length) advice.push(`Ellenőrizendő pont: ${mediumHits.join(', ')}.`);
    if (!media.imageCount) advice.push('Tegyél fel legalább 1–3 fotót, mert későbbi vitánál a szöveg önmagában kevés.');
    if (media.videoCount && !media.imageCount) advice.push('Van videó, de érdemes legalább egy állóképet is menteni, mert a PDF/riport így stabilabb.');
    if (missing.length) advice.push(`Hiányzó adat: ${missing.slice(0,4).join(', ')}.`);
    phaseHints(note, phase).forEach(x => advice.push(x));
    if (!advice.length) advice.push('A bejegyzés rendben van. Átadás előtt ellenőrizd, hogy a fotók, anyagok és időjárási adatok is megvannak.');

    const nextStep = level === 'Magas'
      ? 'Ne csak mentsd: ellenőrizd a jelzett pontot, fotózd körbe, és írd le a javítás vagy döntés módját.'
      : missing.length
        ? `Egészítsd ki ezzel: ${missing.slice(0,3).join(', ')}.`
        : 'A következő munkafázis előtt érdemes még egy rövid állapotfotót készíteni.';

    const clientSummary = buildClientSummary(note, {phase, status, level, media, missing, highHits, mediumHits});
    const photoTextCheck = `${media.imageCount} fotó, ${media.videoCount} videó. ${missing.length ? 'Hiány: ' + missing.slice(0,3).join(', ') + '.' : 'A dokumentáció alapadatai rendben vannak.'}`;

    return {
      level, title, score,
      advice: advice.slice(0, 6),
      nextStep,
      photoTextCheck,
      clientSummary,
      missingData: missing,
      riskReasons: [...highHits, ...mediumHits],
      materials: mat.length ? mat.map(m => `${m.name || 'anyag'} ${m.quantity || ''} ${m.unit || ''}`.trim()).filter(Boolean) : suggestMaterials(note, phase),
      checklist: [
        media.imageCount ? 'Fotó rögzítve' : 'Fotó hiányzik',
        media.videoCount ? 'Videó rögzítve' : 'Videó nem kötelező, de hasznos lehet',
        missing.includes('időjárás/körülmény') ? 'Időjárás hiányzik' : 'Időjárás/körülmény rögzítve vagy említve',
        missing.includes('GPS vagy helyszín adat') ? 'GPS/helyszín hiányzik' : 'GPS/helyszín rögzítve vagy említve'
      ],
      aiVersion: 'v181-ai-pro-local'
    };
  }

  function buildClientSummary(note, ctx = {}){
    const text = String(note || '').replace(/\s+/g, ' ').trim();
    const phase = ctx.phase || 'napi munka';
    const status = ctx.status || 'rögzítve';
    const media = ctx.media || { imageCount:0, videoCount:0 };
    const risk = ctx.level === 'Magas'
      ? 'A bejegyzésben olyan pont szerepel, amely külön ellenőrzést és dokumentálást igényel.'
      : ctx.level === 'Közepes'
        ? 'A dokumentáció alapján van néhány ellenőrizendő részlet, ezért a következő lépés előtt érdemes átnézni.'
        : 'A dokumentáció alapján a napi munka rendezett formában rögzítésre került.';
    const mediaLine = media.imageCount || media.videoCount
      ? `Csatolva: ${media.imageCount || 0} fotó és ${media.videoCount || 0} videó.`
      : 'A bejegyzéshez még érdemes fotót csatolni.';
    const shortText = text ? `Röviden: ${text.slice(0, 260)}${text.length > 260 ? '…' : ''}` : '';
    return `A(z) ${phase} munkafázis állapota: ${status}. ${risk} ${mediaLine}${shortText ? '\n' + shortText : ''}`;
  }

  const originalAnalyze = window.analyzeEntry;
  window.analyzeEntry = function(input = {}){
    try {
      const base = typeof originalAnalyze === 'function' ? (originalAnalyze(input) || {}) : {};
      return { ...base, ...buildAdvancedAnalysis(input) };
    } catch (err) {
      console.warn('V181 AI elemzés hiba, régi elemzés használata:', err);
      return typeof originalAnalyze === 'function' ? originalAnalyze(input) : { level:'Alacsony', title:'Elemzés', advice:['AI elemzés nem elérhető.'] };
    }
  };
  try { analyzeEntry = window.analyzeEntry; } catch(_) {}

  function currentMaterialsText(){
    try {
      if (typeof collectMaterials === 'function') {
        const arr = collectMaterials();
        if (arr && arr.length) return arr.map(m => `- ${m.name || 'anyag'}: ${m.quantity || ''} ${m.unit || ''}${m.note ? ' (' + m.note + ')' : ''}`.trim()).join('\n');
      }
    } catch(_) {}
    return '';
  }

  window.generateDailyAiText = async function(){
    const phase = $('detailPhase')?.value || 'Napi munkavégzés';
    const status = $('detailStatus')?.value || 'Folyamatban';
    const priority = $('detailPriority')?.value || 'Közepes';
    const responsible = $('detailResponsible')?.value || 'kivitelező';
    const weather = $('weatherAutoText')?.value || $('detailWeather')?.value || 'nincs külön rögzített időjárási adat';
    const current = $('detailNote')?.value || '';
    const matText = currentMaterialsText();
    const analysis = window.analyzeEntry({ note: current, phase, status, priority, materials: typeof collectMaterials === 'function' ? collectMaterials() : [] });
    const generated = [
      `Mai munkanapló – ${phase}`,
      '',
      `Elvégzett / folyamatban lévő munka: A mai napon a(z) ${phase.toLowerCase()} munkafázishoz kapcsolódó feladatok kerültek rögzítésre. Felelős: ${responsible}. Állapot: ${status}. Prioritás: ${priority}.`,
      `Helyszíni körülmény: ${weather}.`,
      matText ? `Anyagfelhasználás:\n${matText}` : 'Anyagfelhasználás: ha volt beépített vagy felhasznált anyag, érdemes külön sorban rögzíteni.',
      `AI szakmai kontroll: ${analysis.level} – ${analysis.title}. ${analysis.photoTextCheck || ''}`,
      `Következő javasolt lépés: ${analysis.nextStep}`,
      '',
      `Ügyfélbarát összefoglaló: ${analysis.clientSummary}`
    ].join('\n');
    const field = $('detailNote');
    if (field) {
      field.value = current.trim() ? `${current.trim()}\n\n${generated}` : generated;
      field.focus();
    }
    updateAiPreview();
    if (typeof showToast === 'function') showToast('✔ Fejlettebb AI napi szöveg elkészült.', 'ok');
  };
  try { generateDailyAiText = window.generateDailyAiText; } catch(_) {}

  window.v33CustomerFriendlyText = function(raw = ''){
    const text = String(raw || '').trim();
    if (!text) return '';
    const phase = $('v33QuickPhase')?.value || 'Gyors mentés';
    const status = $('v33QuickStatus')?.value || 'Folyamatban';
    const files = Array.isArray(window.v180QuickFileBasket) ? window.v180QuickFileBasket : Array.from($('v33QuickFiles')?.files || []);
    const imageCount = files.filter(f => String(f.type || '').startsWith('image/')).length;
    const videoCount = files.filter(f => String(f.type || '').startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(String(f.name || ''))).length;
    const analysis = window.analyzeEntry({ note:text, phase, status, imageCount, videoCount });
    return `${analysis.clientSummary}\n\nKivitelezői megjegyzés: ${text.replace(/\s+/g, ' ')}\n\nKövetkező lépés: ${analysis.nextStep}`;
  };
  try { v33CustomerFriendlyText = window.v33CustomerFriendlyText; } catch(_) {}

  function updateAiPreview(){
    const box = $('detailAiPreview');
    if (!box) return;
    const note = $('detailNote')?.value || '';
    const phase = $('detailPhase')?.value || 'Napi bejegyzés';
    const status = $('detailStatus')?.value || '';
    const priority = $('detailPriority')?.value || '';
    if (!note.trim() && !phase) return;
    const analysis = window.analyzeEntry({ note, phase, status, priority, materials: typeof collectMaterials === 'function' ? collectMaterials() : [] });
    box.classList.remove('hidden');
    box.innerHTML = `
      <b>AI PRO előszűrés:</b> ${esc(analysis.level)} – ${esc(analysis.title)}<br>
      <small>${esc(analysis.photoTextCheck || '')}</small>
      ${analysis.riskReasons?.length ? `<div class="v181AiLine"><b>Figyelendő:</b> ${esc(analysis.riskReasons.join(', '))}</div>` : ''}
      ${analysis.missingData?.length ? `<div class="v181AiLine"><b>Hiányzó adat:</b> ${esc(analysis.missingData.join(', '))}</div>` : ''}
      <div class="v181AiLine"><b>Következő lépés:</b> ${esc(analysis.nextStep || '')}</div>
    `;
  }

  function injectStyle(){
    if ($('v181AiProStyle')) return;
    const style = document.createElement('style');
    style.id = 'v181AiProStyle';
    style.textContent = `
      .v181AiLine{margin-top:7px;padding-top:7px;border-top:1px solid rgba(148,163,184,.18);color:#cbd5e1;line-height:1.45}
      #detailAiPreview{border-left:4px solid #f59e0b!important;background:rgba(15,23,42,.72)!important}
    `;
    document.head.appendChild(style);
  }

  function bindPreview(){
    injectStyle();
    let timer = null;
    ['detailNote','detailPhase','detailStatus','detailPriority','weatherAutoText','detailWeather'].forEach(id => {
      const el = $(id);
      if (!el || el.dataset.v181AiBound === '1') return;
      el.dataset.v181AiBound = '1';
      el.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(updateAiPreview, 350); });
      el.addEventListener('change', () => { clearTimeout(timer); timer = setTimeout(updateAiPreview, 150); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindPreview);
  else bindPreview();
})();
