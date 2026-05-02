let state = {
  user: null,
  subscription: null,
  profile: null,
  projects: [],
  entries: [],
  tasks: [],
  adminUsers: [],
  adminPayments: [],
  adminSupportMessages: [],
  notifications: [],
  publicProjectId: null,
  adminViewingUser: null,
  adminTestPlan: null,
  lastClientReportLink: null,
  aiCredits: 0
};

const PLAN_LIMITS = {
  guest: { label: 'Vendég', maxProjects: 0, canAddEntries: false, canUseAI: false, canPdf: false, canClientReport: false },
  trial: { label: '1 hét ingyenes próba', maxProjects: 1, canAddEntries: true, canUseAI: false, canPdf: false, canClientReport: false },
  starter: { label: 'Starter csomag', maxProjects: 3, canAddEntries: true, canUseAI: true, canPdf: true, canClientReport: true },
  pro: { label: 'Pro csomag', maxProjects: 15, canAddEntries: true, canUseAI: true, canPdf: true, canClientReport: true },
  business: { label: 'Business csomag', maxProjects: 9999, canAddEntries: true, canUseAI: true, canPdf: true, canClientReport: true },
  expired: { label: 'Lejárt csomag', maxProjects: 0, canAddEntries: false, canUseAI: false, canPdf: false, canClientReport: false }
};

const AI_RULES = [
  {
    words: ['repedés', 'repedt', 'megrepedt', 'hajszálrepedés'],
    risk: 3,
    title: 'Repedés gyanú',
    advice: 'Fotózd több szögből, mérd a repedés hosszát/szélességét, és javítás előtt keresd meg az okát.',
    repair: [
      'Hajszálrepedésnél kaparás, portalanítás, mélyalapozó, glettelés, csiszolás, festés.',
      'Nagyobb repedésnél a laza részt el kell távolítani, szükség esetén üvegszövet hálóval erősíteni.',
      'Ha a repedés újra megjelenik, szerkezeti mozgás vagy nedvesség is lehet a háttérben.'
    ],
    materials: ['Baumit Grund mélyalapozó', 'Rigips Rimano glett', 'Mapei Mapenet üvegszövet háló', 'Soudal rugalmas repedésjavító', 'Héra / Dulux festék']
  },
  {
    words: ['beázás', 'vizes', 'vizesedés', 'ázik', 'nedves', 'penész'],
    risk: 4,
    title: 'Nedvesség / beázás gyanú',
    advice: 'Először a víz útját kell megtalálni. Javítás csak kiszáradás és ok megszüntetése után ajánlott.',
    repair: [
      'Meg kell keresni a beázás forrását: tető, eresz, lábazat, cső, szigetelés vagy hőhíd.',
      'A vizes/laza vakolatot el kell távolítani, a felületet ki kell szárítani.',
      'Penésznél fertőtlenítés, majd pára- és hőhíd okának megszüntetése szükséges.'
    ],
    materials: ['Szavo penészlemosó', 'Baumit Sanova szárítóvakolat', 'Mapei Primer G mélyalapozó', 'Mapei Mapelastic vízszigetelés', 'Baumit lábazati rendszer']
  },
  {
    words: ['omlik', 'omlás', 'leválik', 'leesik', 'potyog'],
    risk: 4,
    title: 'Leválás / omlás veszély',
    advice: 'Balesetveszély miatt a területet biztosítani kell, a laza részeket el kell távolítani.',
    repair: [
      'A leváló részeket teljesen le kell verni stabil alapig.',
      'Portalanítás és alapozás után javítóhabarcs vagy vakolat használható.',
      'Nagy felületnél hálózás és teljes újravakolás is szükséges lehet.'
    ],
    materials: ['Baumit javítóhabarcs', 'Baumit MPI 25 vakolat', 'Mapei Primer G', 'Mapei Mapenet háló', 'PVC/alumínium sarokvédő']
  },
  {
    words: ['süllyed', 'megsüllyedt', 'süllyedés', 'mozog', 'instabil'],
    risk: 4,
    title: 'Süllyedés / szerkezeti mozgás gyanú',
    advice: 'Itt nem szabad csak felületi javítással kezdeni. Először az okot kell ellenőrizni.',
    repair: [
      'Ellenőrizni kell az alapot, vízelvezetést, tömörítést és terhelést.',
      'Járda/térkő süllyedésnél visszabontás, ágyazat javítás, tömörítés, újrarakás szükséges.',
      'Fal vagy alap mozgásánál szakértői/műszaki ellenőri vizsgálat javasolt.'
    ],
    materials: ['0-22 vagy 0-32 zúzottkő', 'mosott homok + cement', 'geotextília', 'C16/20 beton', 'dréncső szükség szerint']
  },
  {
    words: ['ferde', 'nem vízszintes', 'nem függőleges', 'eltérés', 'pontatlan'],
    risk: 3,
    title: 'Pontossági eltérés gyanú',
    advice: 'Mérés és dokumentálás szükséges, átadás előtt tisztázni kell az elfogadható eltérést.',
    repair: [
      'Vízmértékkel, lézerrel vagy zsinórral ellenőrizni kell az eltérést.',
      'Kisebb eltérés javítható gletteléssel/vakolattal.',
      'Nagy eltérésnél bontás vagy újraépítés is szóba jöhet.'
    ],
    materials: ['lézeres szintező', 'Rigips Rimano / Baumit glett', 'Baumit MPI 25 vakolat', 'Mapei Planitop kiegyenlítő']
  },
  {
    words: ['hiányzik', 'kimaradt', 'nincs kész', 'rossz', 'hibás', 'bontani kell'],
    risk: 3,
    title: 'Hiány / hibás teljesítés gyanú',
    advice: 'Írásban rögzíteni kell, mi hiányzik, ki felel érte és mikorra javítandó.',
    repair: [
      'Készíts pontos eltérésleírást és fotót.',
      'Rögzítsd a javítás felelősét és határidejét.',
      'Átadás előtt ellenőrző lista alapján pipáld végig a hibákat.'
    ],
    materials: ['munkafázistól függő Baumit/Mapei/Rigips javítóanyag', 'ellenőrző lista', 'fotódokumentáció']
  }
];

const AI_PHOTO_RULES = [
  { label: 'Repedés / szerkezeti mozgás', icon: '🧱', words: ['repedés','repedt','hajszál','crack','falrepedés','süllyed','mozog','szerkezeti'], risk: 4, materials: ['Mapei Mapenet üvegszövet háló','Baumit Grund mélyalapozó','Rigips Rimano glett','rugalmas repedésjavító'], fix: ['repedés szélesség mérése','laza részek eltávolítása','hálózás + glettelés','ok megszüntetése átadás előtt'] },
  { label: 'Nedvesség / penész / beázás', icon: '💧', words: ['nedves','vizes','beázás','penész','salétrom','mold','water','ázik','folt'], risk: 5, materials: ['Szavo penészlemosó','Baumit Sanova szárítóvakolat','Mapei Primer G','Mapei Mapelastic','páratechnikai ellenőrzés'], fix: ['vízforrás megkeresése','kiszárítás','fertőtlenítés','szárítóvakolat vagy vízszigetelés'] },
  { label: 'Vakolat / burkolat leválás', icon: '🧰', words: ['omlik','leválik','leesik','potyog','üreges','csempe','burkolat','vakolat','plaster','tile'], risk: 4, materials: ['Baumit javítóhabarcs','Baumit MPI 25 vakolat','Mapei Primer G','flexibilis csemperagasztó','sarokvédő'], fix: ['üreges részek feltárása','visszabontás stabil alapig','tapadóhíd/alapozás','újravakolás vagy újraragasztás'] },
  { label: 'Pontossági / síkpontossági eltérés', icon: '📐', words: ['ferde','szint','vízszint','függő','eltérés','egyenetlen','lejt','méret','level'], risk: 3, materials: ['lézeres szintező','Mapei Planitop kiegyenlítő','Baumit glett/vakolat','ellenőrző jegyzőkönyv'], fix: ['mérés lézerrel','eltérés fotózása mérőszalaggal','ellenőrzési tolerancia egyeztetése','kiegyenlítés vagy bontás döntése'] }
];

function getImageNameSignals(entry) {
  const imgs = getEntryImages(entry);
  return imgs.map(src => {
    try { return decodeURIComponent(String(src).split('/').pop().split('?')[0] || ''); } catch { return String(src || ''); }
  }).join(' ');
}

function localVisionFallback(entry) {
  const images = getEntryImages(entry);
  const videos = getEntryVideos(entry);
  const text = `${entry.note || ''} ${entry.phase || ''} ${entry.status || ''} ${entry.priority || ''} ${getImageNameSignals(entry)}`.toLowerCase();
  const matched = AI_PHOTO_RULES.map(rule => {
    const hits = rule.words.filter(w => text.includes(w));
    if (!hits.length) return null;
    return { ...rule, hits, confidence: Math.min(96, 55 + hits.length * 12 + rule.risk * 4) };
  }).filter(Boolean).sort((a,b) => b.confidence - a.confidence);
  const base = entry.analysis || analyzeEntry({ note: entry.note || '', phase: entry.phase || '', status: entry.status || '', priority: entry.priority || '' });
  const top = matched[0];
  const hasWorkClaim = /elkészült|kész|befejez|átadás|javítva|burkolva|festve|vakolva|szerelve/.test(text);
  const hasRiskClaim = matched.length || /hiba|rossz|nem jó|javítani|ellenőriz|probléma|reped|nedves|beáz/.test(text);
  const evidenceScore = Math.max(15, Math.min(100, images.length * 24 + videos.length * 18 + (entry.note ? 18 : 0) + (entry.phase ? 10 : 0) + (matched.length ? 12 : 0)));
  const photoTextCheck = !images.length && hasRiskClaim
    ? 'A szöveg műszaki problémát jelez, de nincs hozzá fotó. Bizonyításhoz pótold a közelit és a távoli képet.'
    : !images.length && hasWorkClaim
      ? 'A bejegyzés elkészült munkát állít, de fotó nélkül gyenge az átadási bizonyíték.'
      : images.length && !entry.note
        ? 'Van fotó, de kevés a szöveges magyarázat. Írd mellé, mi látszik és mi lett elvégezve.'
        : 'A fotó/szöveg párosítás használható, de nagyobb biztonságot ad a mérés vagy előtte-utána fotó.';
  const checklist = [
    images.length ? 'Fotódokumentáció rögzítve.' : 'Pótolandó fotódokumentáció.',
    videos.length ? 'Videós bizonyíték is elérhető.' : 'Rövid videó ajánlott, ha mozgás, lejtés vagy átadási állapot a kérdés.',
    hasRiskClaim ? 'A kockázati kulcsszavak miatt átadás előtt külön ellenőrzés kell.' : 'Nincs erős hibakulcsszó a bejegyzésben.',
    evidenceScore >= 70 ? 'A bizonyíték ereje jó.' : 'A bizonyíték ereje közepes vagy gyenge, érdemes pontosítani.'
  ];
  const level = top ? (top.risk >= 5 ? 'Magas' : top.risk >= 4 ? 'Közepes' : 'Alacsony') : (base.level || 'Alacsony');
  const title = top ? top.label : (base.title || 'Nem látható egyértelmű kockázat');
  return {
    source: 'AI helyi előszűrés', entryId: entry.id || null,
    title,
    icon: top?.icon || '📸',
    level,
    score: Math.max(base.score || 1, Math.round(evidenceScore / 12)),
    confidence: top ? top.confidence : Math.max(35, Math.min(70, (base.score || 1) * 10)),
    findings: matched.slice(0, 3).map(m => ({ title: m.label, confidence: m.confidence, hits: m.hits })),
    fix: top?.fix || base.repairs || ['Készíts közelebbi és távolabbi fotót, lehetőleg mérőszalaggal vagy vízmértékkel.'],
    materials: [...new Set([...(top?.materials || []), ...(base.materials || [])])].slice(0, 10),
    estimatedCost: estimateRepairCost(level, (top?.fix || []).length, (top?.materials || []).length),
    estimatedHours: estimateWorkHours(level, (top?.fix || []).length),
    evidenceScore,
    photoTextCheck,
    checklist,
    professionalSummary: `${level} kockázati szint. ${title}. Bizonyíték-erősség: ${evidenceScore}%.`,
    customerSummary: level === 'Magas'
      ? 'Ezt a pontot érdemes átadás előtt külön ellenőrizni és javítási fotóval lezárni.'
      : level === 'Közepes'
        ? 'Van olyan részlet, amit még érdemes pontosítani, de dokumentálva jól kezelhető.'
        : 'A bejegyzés alapján nincs kiemelt probléma, a dokumentációt érdemes tovább erősíteni.',
    nextStep: top?.fix?.[0] || (images.length ? 'Egészítsd ki rövid szöveggel, mi látszik a fotón.' : 'Tölts fel közelit és távoli képet ugyanarról a részről.'),
    warning: 'Ez automatikus előszűrés. Végleges szakvéleményhez helyszíni ellenőrzés szükséges.'
  };
}

async function visionAnalyzeEntry(entry) {
  const fallback = localVisionFallback(entry);
  try {
    if (!window.EpitesNaploAPI?.analyzePhotoWithAI) return fallback;
    const images = getEntryImages(entry).slice(0, 3);
    if (!images.length) return fallback;
    const result = await window.EpitesNaploAPI.analyzePhotoWithAI({
      entryId: entry.id || null,
      projectId: entry.project_id || entry.projectId || null,
      note: entry.note || '',
      phase: entry.phase || '',
      status: entry.status || '',
      priority: entry.priority || '',
      imageCount: images.length,
      videoCount: getEntryVideos(entry).length,
      images
    });
    return result?.ok && result.analysis ? { ...fallback, ...result.analysis, source: result.source || 'AI képfelismerés' } : fallback;
  } catch (err) {
    console.warn('AI képfelismerés fallback módra váltott:', err);
    return fallback;
  }
}


function safeEl(id) {
  return document.getElementById(id);
}

function setHidden(id, shouldHide) {
  const el = safeEl(id);
  if (!el) return;
  el.classList.toggle('hidden', !!shouldHide);
}

function showToast(message, type = 'ok') {
  const toast = safeEl('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast ' + type;
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => toast.classList.add('hidden'), 3200);
}

function firstNameFromProfile() {
  const raw = displayOwnerName();
  const clean = String(raw || '').split('@')[0].trim();
  return clean.split(/\s+/)[0] || 'Felhasználó';
}

function toggleMenu() {
  document.getElementById('nav').classList.toggle('open');
}

let authMode = 'login';
let magicLinkCooldownTimer = null;

function openAuthModal() {
  document.getElementById('authModal').classList.remove('hidden');
  setAuthMode('login');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}

function setAuthMode(mode) {
  authMode = mode;
  const loginTab = safeEl('authTabLogin');
  const registerTab = safeEl('authTabRegister');
  const magicTab = safeEl('authTabMagic');
  const nameWrap = safeEl('authNameWrap');
  const passwordWrap = safeEl('authPasswordWrap');
  const submitBtn = safeEl('authSubmitBtn');
  const magicBtn = safeEl('magicLinkBtn');
  const forgotBtn = safeEl('forgotPasswordBtn');
  const help = safeEl('authHelp');

  [loginTab, registerTab, magicTab].forEach(btn => btn && btn.classList.remove('active'));
  if (mode === 'login' && loginTab) loginTab.classList.add('active');
  if (mode === 'register' && registerTab) registerTab.classList.add('active');
  if (mode === 'magic' && magicTab) magicTab.classList.add('active');

  if (nameWrap) nameWrap.classList.toggle('hidden', mode !== 'register');
  if (passwordWrap) passwordWrap.classList.toggle('hidden', mode === 'magic');
  if (submitBtn) submitBtn.classList.toggle('hidden', mode === 'magic');
  if (magicBtn) magicBtn.classList.toggle('hidden', mode !== 'magic');
  if (forgotBtn) forgotBtn.classList.toggle('hidden', mode !== 'login');

  if (submitBtn) submitBtn.textContent = mode === 'register' ? 'Regisztráció létrehozása' : 'Belépés';
  if (help) {
    help.innerHTML = mode === 'magic'
      ? '<b>Email link:</b> csak egyszer kattints. Ha túl sok linket kérsz rövid idő alatt, a Supabase ideiglenesen letiltja a küldést.'
      : '<b>Tipp:</b> ha már regisztráltál, használd a jelszavas belépést. Így nem kell minden alkalommal email linket kérned.';
  }
}

function toggleAuthPassword() {
  const input = safeEl('authPassword');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  const btn = document.querySelector('.passwordToggle');
  if (btn) btn.textContent = input.type === 'password' ? '👁' : '🙈';
}

function resetRedirectUrl() {
  const base = window.location.href.split('#')[0].split('?')[0];
  const dir = base.endsWith('/') ? base : base.substring(0, base.lastIndexOf('/') + 1);
  return dir + 'reset-password.html';
}

async function requestPasswordReset() {
  const email = (safeEl('authEmail')?.value || '').trim();
  const btn = safeEl('forgotPasswordBtn');
  if (!email) return showToast('Először írd be az email címed.', 'error');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Email küldése...'; }
    await window.EpitesNaploAPI.resetPassword(email, resetRedirectUrl());
    showToast('Jelszó visszaállító email elküldve. Nézd meg a bejövőket és a spam mappát is.', 'ok');
  } catch (error) {
    showToast(friendlyAuthError(error), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Elfelejtett jelszó?'; }
  }
}

function friendlyAuthError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  if (msg.includes('rate limit')) return 'Túl sok emailes próbálkozás történt. Várj pár percet, és inkább használd a jelszavas belépést.';
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) return 'Nem jó az email vagy a jelszó. Ellenőrizd, majd próbáld újra.';
  if (msg.includes('password')) return 'A jelszó nem megfelelő. Regisztrációnál legalább 6 karakter legyen.';
  if (msg.includes('email')) return 'Ellenőrizd az email címet.';
  return error?.message || 'Ismeretlen belépési hiba történt.';
}

async function handleAuthSubmit() {
  const name = (safeEl('authName')?.value || '').trim() || 'Felhasználó';
  const email = (safeEl('authEmail')?.value || '').trim();
  const password = (safeEl('authPassword')?.value || '').trim();
  const btn = safeEl('authSubmitBtn');

  if (!email) return showToast('Adj meg email címet.', 'error');
  if (!password || password.length < 6) return showToast('Adj meg legalább 6 karakteres jelszót.', 'error');

  try {
    if (btn) { btn.disabled = true; btn.textContent = authMode === 'register' ? 'Regisztráció...' : 'Belépés...'; }
    if (authMode === 'register') {
      const res = await window.EpitesNaploAPI.signUpWithPassword(email, password, name);
      if (res?.needsEmailConfirm) {
        showToast('Regisztráció kész. Nézd meg az emailt a megerősítéshez.', 'ok');
      } else {
        showToast('Regisztráció és belépés sikeres.', 'ok');
        closeAuthModal();
      }
    } else {
      await window.EpitesNaploAPI.signInWithPassword(email, password);
      showToast('Sikeres belépés.', 'ok');
      closeAuthModal();
    }
    await initApp();
  } catch (error) {
    showToast(friendlyAuthError(error), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = authMode === 'register' ? 'Regisztráció létrehozása' : 'Belépés'; }
  }
}

async function requestMagicLink() {
  const name = (safeEl('authName')?.value || '').trim() || 'Felhasználó';
  const email = (safeEl('authEmail')?.value || '').trim();
  const btn = safeEl('magicLinkBtn');

  if (!email) return showToast('Adj meg email címet.', 'error');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Email link elküldve...'; }
    await window.EpitesNaploAPI.signInOrSignUp(email, name);
    showToast('Belépési link elküldve. Ne kérd újra rögtön, nézd meg az emailt és a spam mappát is.', 'ok');
    let left = 30;
    window.clearInterval(magicLinkCooldownTimer);
    magicLinkCooldownTimer = window.setInterval(() => {
      left -= 1;
      if (!btn) return;
      btn.textContent = `Újraküldés ${left} mp múlva`;
      if (left <= 0) {
        window.clearInterval(magicLinkCooldownTimer);
        btn.disabled = false;
        btn.textContent = 'Belépési link kérése emailben';
      }
    }, 1000);
  } catch (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Belépési link kérése emailben'; }
    showToast(friendlyAuthError(error), 'error');
  }
}

async function loginUser() {
  return handleAuthSubmit();
}

async function logoutUser() {
  const btn = document.getElementById("logoutBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Kilépés..."; }

  try {
    await window.EpitesNaploAPI.signOut({ silent: true });
  } catch (err) {
    console.warn("Kijelentkezési hiba:", err);
  }

  state.user = null;
  state.subscription = null;
  state.profile = null;
  state.projects = [];
  state.entries = [];
  state.tasks = [];
  state.adminUsers = [];
  state.adminPayments = [];
  state.adminSupportMessages = [];
  state.notifications = [];
  state.adminViewingUser = null;
  state.adminTestPlan = null;
  state.aiCredits = 0;

  try {
    localStorage.removeItem("epitesnaplo_admin_view_user");
    localStorage.removeItem("epitesnaplo_last_user");
  } catch (_) {}

  const panel = document.getElementById("notificationPanel");
  if (panel) panel.classList.add("hidden");

  render();
  showToast("Sikeresen kijelentkeztél.", "ok");

  const cleanUrl = window.location.origin + window.location.pathname + "?logout=" + Date.now() + "#home";
  window.location.replace(cleanUrl);
}

function planKey() {
  if (isAdmin() && state.adminTestPlan) return state.adminTestPlan;
  if (isAdmin()) return 'business';

  if (!state.user) return 'guest';

  const subPlanRaw = state.subscription?.plan || state.profile?.plan || 'trial';
  const subStatus = state.subscription?.status || 'active';
  const subPlan = ['trial', 'starter', 'pro', 'business'].includes(subPlanRaw) ? subPlanRaw : 'trial';

  if (subStatus !== 'active') return 'expired';
  return subPlan;
}

function currentLimit() {
  return PLAN_LIMITS[planKey()] || PLAN_LIMITS.guest;
}

function isAdmin() {
  return !!(state.profile?.is_admin || state.user?.email === window.EPITESNAPLO_CONFIG.adminEmail);
}

function displayOwnerName() {
  const name = state.profile?.company_name || state.profile?.full_name || state.user?.user_metadata?.full_name || state.user?.email || 'ÉpítésNapló AI PRO';
  return String(name).trim() || 'ÉpítésNapló AI PRO';
}

function reportTitle() {
  return displayOwnerName() + ' – Építési Napló';
}

function getEntryImages(entry) {
  if (Array.isArray(entry.images) && entry.images.length) return entry.images.filter(Boolean);
  if (Array.isArray(entry.image_urls) && entry.image_urls.length) return entry.image_urls.filter(Boolean);
  if (entry.image || entry.image_url) return [entry.image || entry.image_url];
  return [];
}

function getEntryVideos(entry) {
  const fromAnalysis = entry.analysis?.videos || entry.analysis?.videoUrls || entry.ai_json?.videos || entry.ai_json?.videoUrls;
  if (Array.isArray(entry.videos) && entry.videos.length) return entry.videos.filter(Boolean);
  if (Array.isArray(entry.videoUrls) && entry.videoUrls.length) return entry.videoUrls.filter(Boolean);
  if (Array.isArray(entry.video_urls) && entry.video_urls.length) return entry.video_urls.filter(Boolean);
  if (Array.isArray(fromAnalysis) && fromAnalysis.length) return fromAnalysis.filter(Boolean);
  if (entry.video_url) return [entry.video_url];
  return [];
}

function isSupportedVideoFile(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type.startsWith('video/')) return true;
  return /\.(mp4|m4v|mov|webm|3gp|3gpp|mpeg|mpg|avi)$/i.test(String(file?.name || ''));
}

function videoContentType(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type.startsWith('video/')) return type;
  const ext = String(file?.name || '').split('.').pop().toLowerCase();
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'm4v') return 'video/x-m4v';
  if (ext === 'webm') return 'video/webm';
  if (ext === '3gp' || ext === '3gpp') return 'video/3gpp';
  if (ext === 'mpeg' || ext === 'mpg') return 'video/mpeg';
  if (ext === 'avi') return 'video/x-msvideo';
  return 'video/mp4';
}

function mediaClick(type, title = '') {
  return `onclick="openMediaViewer(this.currentSrc || this.src, '${type}', '${escapeHtml(title)}')"`;
}

function renderMediaImage(src, alt = 'Építési fotó') {
  return `<img class="openableMedia" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" ${mediaClick('image', alt)} />`;
}

function renderMediaVideo(video, title = 'Munkavideó') {
  const src = typeof video === 'object' ? (video.src || '') : video;
  return `<video class="openableMedia" controls playsinline preload="metadata" src="${escapeHtml(src)}" ${mediaClick('video', title)} onloadedmetadata="this.muted=false;this.volume=1"></video>`;
}

function renderPublicReportVideo(video, title = 'Munkavideó') {
  const path = typeof video === 'object' ? (video.path || '') : '';
  const src = typeof video === 'object' ? (video.src || '') : video;
  if (path) {
    return `<video class="openableMedia publicReportVideo" controls playsinline preload="metadata" data-video-path="${escapeHtml(path)}"></video>`;
  }
  return src ? renderMediaVideo(src, title) : '';
}

function ensureMediaViewerModal() {
  let modal = document.getElementById('mediaViewerModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'mediaViewerModal';
  modal.className = 'mediaViewerModal hidden';
  modal.innerHTML = `
    <div class="mediaViewerTop">
      <strong id="mediaViewerTitle">Építési fotó</strong>
      <button class="btn small primary" type="button" onclick="closeMediaViewer()">Bezárás</button>
    </div>
    <div id="mediaViewerBody" class="mediaViewerBody"></div>`;
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeMediaViewer();
  });
  document.body.appendChild(modal);
  return modal;
}

function openMediaViewer(src, type = 'image', title = '') {
  const mediaSrc = String(src || '');
  if (!mediaSrc) return;
  const mediaTitle = title || (type === 'video' ? 'Munkavideó' : 'Építési fotó');
  const modal = ensureMediaViewerModal();
  const body = document.getElementById('mediaViewerBody');
  document.getElementById('mediaViewerTitle').textContent = mediaTitle;
  body.innerHTML = type === 'video'
    ? `<video id="mediaViewerItem" controls playsinline preload="auto" src="${escapeHtml(mediaSrc)}"></video>`
    : `<img id="mediaViewerItem" src="${escapeHtml(mediaSrc)}" alt="${escapeHtml(mediaTitle)}" />`;
  modal.classList.remove('hidden');
  document.body.classList.add('mediaViewerOpen');
  const media = document.getElementById('mediaViewerItem');
  if (media?.tagName === 'VIDEO') { media.muted = false; media.defaultMuted = false; media.volume = 1; }
}

window.closeMediaViewer = function() {
  const modal = document.getElementById('mediaViewerModal');
  const body = document.getElementById('mediaViewerBody');
  if (body) body.innerHTML = '';
  modal?.classList.add('hidden');
  document.body.classList.remove('mediaViewerOpen');
};

function wireMediaViewerClicks(root = document) {
  root.querySelectorAll('img').forEach(img => {
    img.classList.add('openableMedia');
    img.onclick = () => openMediaViewer(img.currentSrc || img.src, 'image', img.alt || 'Építési fotó');
  });
  root.querySelectorAll('video').forEach(video => {
    video.classList.add('openableMedia');
    video.addEventListener('loadedmetadata', () => { video.muted = false; video.volume = 1; });
    video.onclick = () => openMediaViewer(video.currentSrc || video.src, 'video', 'Munkavideó');
  });
}

function fileToDataUrl(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file, maxSide = 1600, quality = 0.72) {
  if (!String(file?.type || '').startsWith('image/')) return '';
  const original = await fileToDataUrl(file);
  if (!original) return '';
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = original;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
    canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL('image/jpeg', quality);
    return compressed && compressed.length < original.length ? compressed : original;
  } catch (_) {
    return original;
  }
}

function readFilesAsDataUrls(files, max = 8) {
  const selected = Array.from(files || []).filter(file => String(file.type || '').startsWith('image/')).slice(0, max);
  return Promise.all(selected.map(file => compressImageFile(file))).then(items => items.filter(Boolean));
}

async function uploadVideoFilesToStorage(files, projectId, max = 2) {
  const selected = Array.from(files || []).filter(isSupportedVideoFile).slice(0, max);
  if (!selected.length) return [];

  const client = window.supabaseDirect;
  if (!client || !state.user?.id) {
    alert('Videó feltöltés nem érhető el: nincs Supabase kapcsolat vagy bejelentkezett felhasználó.');
    return [];
  }

  const MAX_VIDEO_MB = 80;
  const uploaded = [];

  for (let i = 0; i < selected.length; i++) {
    const file = selected[i];
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      alert(`Túl nagy videó kimarad: ${file.name}\nMaximum kb. ${MAX_VIDEO_MB} MB / videó.`);
      continue;
    }

    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(-80) || `video.${ext}`;
    const storagePath = `${state.user.id}/${projectId}/${Date.now()}-${i}-${safeName}`;
    const contentType = videoContentType(file);
    const { error } = await client.storage.from('project-videos').upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType
    });

    if (error) {
      console.warn('Videó feltöltési probléma:', error);
      alert('Videó feltöltési probléma: ' + (error.message || error) + '\nEllenőrizd, hogy lefutott-e a V31 SQL és privát project-videos bucket létezik-e.');
      continue;
    }

    const signed = await client.storage.from('project-videos').createSignedUrl(storagePath, 3600);
    uploaded.push({
      path: storagePath,
      src: signed.data?.signedUrl || '',
      name: file.name,
      type: contentType,
      size: file.size,
      private: true
    });
  }

  return uploaded;
}

async function hydratePrivateVideoUrls(entries) {
  const client = window.supabaseDirect;
  if (!client || !Array.isArray(entries)) return entries || [];
  await Promise.all(entries.map(async (entry) => {
    const videos = getEntryVideos(entry);
    await Promise.all(videos.map(async (video) => {
      if (!video || typeof video !== 'object' || !video.path) return;
      const { data, error } = await client.storage.from('project-videos').createSignedUrl(video.path, 3600);
      if (!error && data?.signedUrl) video.src = data.signedUrl;
    }));
  }));
  return entries;
}

async function loadProfile() {
  try {
    state.profile = await window.EpitesNaploAPI.getProfile();
  } catch (err) {
    console.warn('Profil betöltési hiba:', err);
    state.profile = { full_name: state.user?.user_metadata?.full_name || state.user?.email || 'Felhasználó', email: state.user?.email || '' };
  }
}

async function loadAiCredits() {
  if (!state.user) { state.aiCredits = 0; return 0; }
  try {
    state.aiCredits = await window.EpitesNaploAPI.getAiCredits();
  } catch (err) {
    console.warn('AI kredit betöltési hiba:', err);
    state.aiCredits = 0;
  }
  return state.aiCredits;
}


async function initApp() {
  const params = new URLSearchParams(window.location.search);
  const reportToken = params.get("riport");
  const hash = window.location.hash || "";

  if (params.has("logout")) {
    try { await window.EpitesNaploAPI.clearAuthStorage(); } catch (_) {}
    state.user = null;
    state.subscription = null;
    state.profile = null;
    history.replaceState(null, "", window.location.pathname + "#home");
  }

  preventSupportSubjectAutofill();

  if (reportToken) {
    await loadPublicReport(reportToken);
    return;
  }

  if (hash.startsWith("#riport-")) {
    const token = hash.replace("#riport-", "");
    await loadPublicReport(token);
    return;
  }

  if (hash.startsWith("#client-")) {
    state.publicProjectId = hash.replace("#client-", "");
  }

  state.user = await window.EpitesNaploAPI.getCurrentUser();

  if (state.user) {
    await loadProfile();
    state.subscription = await window.EpitesNaploAPI.getSubscription();
    await loadAiCredits();
    await loadUserData();
    await loadAdminData();
  }

  renderPayPal();
  render();
  initCustomWorkPhaseV35();

  window.supabaseDirect.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || await window.EpitesNaploAPI.getCurrentUser();

    if (state.user) {
      await loadProfile();
      state.subscription = await window.EpitesNaploAPI.getSubscription();
      await loadAiCredits();
      await loadUserData();
      await loadAdminData();
    } else {
      state.profile = null;
      state.subscription = null;
      state.aiCredits = 0;
      state.projects = [];
      state.entries = [];
      state.tasks = [];
    }

    renderPayPal();
    render();
    initCustomWorkPhaseV35();
  });
}

async function loadPublicReport(token) {
  window.currentPublicReportToken = token;
  document.body.classList.add('publicMode');

  const header = document.querySelector('.topbar');
  const hero = document.querySelector('.hero');
  const benefits = document.querySelector('.benefits');
  const main = document.querySelector('main');
  const footer = document.querySelector('footer');
  const publicView = document.getElementById('publicReportView');

  if (header) header.classList.add('hidden');
  if (hero) hero.classList.add('hidden');
  if (benefits) benefits.classList.add('hidden');
  if (main) main.classList.add('hidden');
  if (footer) footer.classList.add('hidden');
  if (publicView) publicView.classList.remove('hidden');

  const box = document.getElementById('publicReportContent');
  box.innerHTML = '<p>Riport betöltése...</p>';

  const report = await window.EpitesNaploAPI.getPublicReport(token);

  if (!report) {
    box.innerHTML = '<h2>A riport nem található vagy lejárt.</h2><p>Kérj új linket a kivitelezőtől.</p>';
    return;
  }

  try { await window.EpitesNaploAPI.markPublicReportOpened(token); } catch(e) { console.warn(e); }
  const safeReportHtml = window.EpitesNaploAPI?.sanitizeReportHtml
    ? window.EpitesNaploAPI.sanitizeReportHtml(report.report_html)
    : (report.report_html || '<p>A riport üres.</p>');
  box.innerHTML = `<div class="reportOpenedBox"><b>Ügyfélriport megnyitva.</b><br><span>Ez a link csak olvasásra szolgál, szerkesztésre nem.</span></div>` + (safeReportHtml || '<p>A riport üres.</p>') + buildPublicApprovalBoxV71(report);
  try { await window.EpitesNaploAPI.hydratePublicReportMedia(token, box); } catch (e) { console.warn(e); }
  wireMediaViewerClicks(box);
  initPublicApprovalBoxV71(token, report);
}

function buildPublicApprovalBoxV71(report) {
  const status = String(report?.status || '').toLowerCase();
  const already = status === 'accepted' || status === 'approved' || report?.approved_at;
  return `
    <section id="publicApprovalV71" class="approvalBox v71ApprovalBox">
      <h2>Ügyfél visszajelzés</h2>
      ${already ? `<div class="v71ApprovalSaved"><b>Ez a riport már jóváhagyva.</b><br><span>Dátum: ${escapeHtml(formatDate(report.approved_at || report.updated_at || report.created_at || ''))}</span></div>` : ''}
      <p class="muted">A visszajelzés mentés után a kivitelező projektjében is megjelenik, és külön jóváhagyott példányként letölthető lesz.</p>
      <input id="v71ApprovalName" placeholder="Név / cég" />
      <input id="v71ApprovalEmail" placeholder="Email cím (opcionális)" />
      <textarea id="v71ApprovalMessage" rows="4" placeholder="Megjegyzés vagy kérdés (opcionális)"></textarea>
      <label class="checkLine"><input id="v71ApprovalCheck" type="checkbox" /> Megtekintettem az építési napló riportot.</label>
      <div class="approvalActionGrid">
        <button class="btn ghost" type="button" onclick="submitPublicApprovalV71('viewed')">Megnéztem</button>
        <button class="btn primary" type="button" onclick="submitPublicApprovalV71('accepted')">Elfogadom</button>
        <button class="btn ghost" type="button" onclick="submitPublicApprovalV71('question')">Kérdésem van</button>
      </div>
      <div id="v71ApprovalResult" class="v71ApprovalResult hidden"></div>
    </section>`;
}

function initPublicApprovalBoxV71(token, report) {
  window.currentPublicReportToken = token;
}

async function submitPublicApprovalV71(decision) {
  const token = window.currentPublicReportToken;
  const resultBox = document.getElementById('v71ApprovalResult');
  const checked = document.getElementById('v71ApprovalCheck')?.checked;
  if (!token) return alert('Hiányzó ügyfélriport token. Nyisd meg újra a linket.');
  if (!checked && decision !== 'question') return alert('Előbb pipáld be, hogy megtekintetted a riportot.');
  const payload = {
    decision,
    name: document.getElementById('v71ApprovalName')?.value || '',
    email: document.getElementById('v71ApprovalEmail')?.value || '',
    message: document.getElementById('v71ApprovalMessage')?.value || '',
    clientComment: document.getElementById('v71ApprovalMessage')?.value || '',
    reportHtml: document.getElementById('publicReportContent')?.innerHTML || '',
    reportText: document.getElementById('publicReportContent')?.innerText || ''
  };
  try {
    if (resultBox) { resultBox.classList.remove('hidden'); resultBox.innerHTML = 'Visszajelzés mentése...'; }
    await window.EpitesNaploAPI.approvePublicReport(token, payload);
    const label = decision === 'accepted' ? 'Elfogadva' : decision === 'question' ? 'Kérdés mentve' : 'Megtekintve';
    if (resultBox) resultBox.innerHTML = `<b>Visszajelzés mentve: ${label}</b><br>Dátum: ${escapeHtml(formatDate(new Date().toISOString()))}`;
    alert('Visszajelzés mentve. A kivitelezőnél is meg fog jelenni.');
  } catch (err) {
    console.error(err);
    if (resultBox) resultBox.innerHTML = '<b>Mentési hiba.</b><br>' + escapeHtml(err.message || String(err));
    alert('Nem sikerült menteni a visszajelzést: ' + (err.message || err));
  }
}
window.submitPublicApprovalV71 = submitPublicApprovalV71;


async function loadUserData() {
  state.projects = await window.EpitesNaploAPI.getProjects();
  state.entries = await window.EpitesNaploAPI.getEntries();
  await hydratePrivateVideoUrls(state.entries);
  state.tasks = await window.EpitesNaploAPI.getTasks();
}

async function loadAdminData() {
  if (!isAdmin()) return;
  state.adminUsers = await window.EpitesNaploAPI.getAdminUsers();
  state.adminPayments = await window.EpitesNaploAPI.getAdminPayments();
  state.adminSupportMessages = await window.EpitesNaploAPI.getAdminSupportMessages();
  state.notifications = await window.EpitesNaploAPI.getNotifications();
}

function renderPayPal() {
  if (!window.paypal) return;

  const plans = [
    { id: 'paypal-starter', key: 'starter', name: 'Starter', amount: '9900' },
    { id: 'paypal-pro', key: 'pro', name: 'Pro', amount: '19900' },
    { id: 'paypal-business', key: 'business', name: 'Business első hónap', amount: '19900' }
  ];

  plans.forEach(plan => {
    const container = document.getElementById(plan.id);
    if (!container) return;

    container.innerHTML = '';

    paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal'
      },
      createOrder: function(data, actions) {
        if (!state.user) {
          alert('Fizetés előtt jelentkezz be.');
          openAuthModal();
          throw new Error('Nincs bejelentkezve');
        }

        if (isAdmin()) {
          alert('Admin fiókkal nem kell fizetned, teljes hozzáférésed van.');
          throw new Error('Admin nem fizet');
        }

        return actions.order.create({
          purchase_units: [{
            description: `ÉpítésNapló AI PRO - ${plan.name} csomag`,
            custom_id: plan.key,
            amount: {
              currency_code: 'HUF',
              value: plan.amount
            }
          }]
        });
      },
      onApprove: async function(data, actions) {
        const details = await actions.order.capture();
        const orderId = details?.id || data.orderID;
        state.subscription = await window.EpitesNaploAPI.activateProViaEdge(orderId, plan.key);
        await loadProfile();
        await loadAdminData();
        render();
      },
      onError: function(err) {
        console.error(err);
        alert('PayPal fizetési hiba történt.');
      }
    }).render('#' + plan.id);
  });

  const creditProducts = [
    { id: 'paypal-ai-credit-1', credits: 1, name: '1 AI riport kredit', amount: '990' },
    { id: 'paypal-ai-credit-10', credits: 10, name: '10 AI riport kredit', amount: '4990' }
  ];

  creditProducts.forEach(product => {
    const container = document.getElementById(product.id);
    if (!container) return;
    container.innerHTML = '';

    paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
      createOrder: function(data, actions) {
        if (!state.user) {
          alert('AI kredit vásárlás előtt jelentkezz be.');
          openAuthModal();
          throw new Error('Nincs bejelentkezve');
        }
        return actions.order.create({
          purchase_units: [{
            description: `ÉpítésNapló AI PRO - ${product.name}`,
            amount: { currency_code: 'HUF', value: product.amount }
          }]
        });
      },
      onApprove: async function(data, actions) {
        const details = await actions.order.capture();
        const orderId = details?.id || data.orderID;
        const result = await window.EpitesNaploAPI.activateAiCreditsViaEdge(orderId, product.credits, product.amount);
        state.aiCredits = result?.credits ?? await window.EpitesNaploAPI.getAiCredits();
        render();
        preparePaidAiReportOffer();
        showToast(`✔ ${product.credits} AI riport kredit jóváírva`);
      },
      onError: function(err) {
        console.error(err);
        alert('PayPal AI kredit fizetési hiba történt.');
      }
    }).render('#' + product.id);
  });

}

function checkProjectLimit() {
  const limit = currentLimit();

  if (!state.user) {
    showGuestLockV38('Projekt létrehozásához regisztráció szükséges.');
    return false;
  }

  if (limit.maxProjects === 0) {
    alert('A jelenlegi csomaggal nem hozhatsz létre új projektet.');
    return false;
  }

  if (state.projects.length >= limit.maxProjects) {
    alert(`Az ingyenes csomag maximum ${limit.maxProjects} projektet enged. Több projekthez válassz Starter, Pro vagy Business csomagot.`);
    return false;
  }

  return true;
}

async function addProject() {
  if (!checkProjectLimit()) return;

  const input = document.getElementById('projectName');
  const name = input.value.trim();
  if (!name) return alert('Írd be a projekt nevét.');

  const saved = await window.EpitesNaploAPI.saveProject({ name });
  state.projects.unshift({
    id: saved.id,
    name: saved.name || name,
    created_at: saved.created_at || new Date().toISOString()
  });

  input.value = '';
  render();
  showToast('✔ Projekt mentve');
}


// ===== V35: Egyéb munkafázis saját beírással a főoldali napló űrlapon is =====
function getSelectedWorkPhaseV35(){
  const selectValue = (document.getElementById('workPhase')?.value || '').trim();
  const customValue = (document.getElementById('customWorkPhase')?.value || '').trim();
  if(['egyéb','egyeb'].includes(selectValue.toLowerCase())){
    return customValue || 'Egyéb munkafázis';
  }
  return selectValue || 'munkafázis';
}

function updateCustomWorkPhaseV35(){
  const select = document.getElementById('workPhase');
  const input = document.getElementById('customWorkPhase');
  if(!select || !input) return;
  const isOther = ['egyéb','egyeb'].includes(String(select.value || '').toLowerCase());
  input.classList.toggle('hidden', !isOther);
  input.style.display = isOther ? '' : 'none';
  if(isOther) setTimeout(() => input.focus(), 30);
  else input.value = '';
}

function initCustomWorkPhaseV35(){
  const select = document.getElementById('workPhase');
  const input = document.getElementById('customWorkPhase');
  if(!select || !input || select.dataset.v35Ready === '1') return;
  select.dataset.v35Ready = '1';
  input.style.display = 'none';
  select.addEventListener('change', updateCustomWorkPhaseV35);
  updateCustomWorkPhaseV35();
}

async function addEntry() {
  const limit = currentLimit();

  if (!state.user) {
    showGuestLockV38('Naplóbejegyzés mentéséhez regisztráció szükséges.');
    return;
  }

  if (!limit.canAddEntries) {
    alert('A jelenlegi csomaggal nem menthetsz naplóbejegyzést.');
    return;
  }

  const projectId = document.getElementById('entryProject').value;
  const phase = getSelectedWorkPhaseV35();
  const status = document.getElementById('entryStatus').value;
  const priority = document.getElementById('priority').value;
  const responsible = document.getElementById('responsible').value.trim();
  const weather = document.getElementById('weather').value.trim();
  const note = document.getElementById('entryNote').value.trim();
  const files = document.getElementById('entryFile').files;

  if (!projectId) return alert('Előbb hozz létre vagy válassz projektet.');
  if (!note) return alert('Írj megjegyzést, mert ebből dolgozik az AI előszűrő.');

  const images = await readFilesAsDataUrls(files, 8);
  const videos = await uploadVideoFilesToStorage(files, projectId, 2);
  const analysis = analyzeEntry({ note, phase, status, priority, imageCount: images.length, videoCount: videos.length });
  if (images.length || videos.length) showToast('Média mentése és AI elemzés folyamatban...', 'info');

  const entry = {
    projectId,
    phase,
    status,
    priority,
    responsible: responsible || 'Nincs megadva',
    weather: weather || 'Nincs megadva',
    note,
    image: images[0] || '',
    images,
    videos,
    videoUrls: videos,
    analysis
  };

  const saved = await window.EpitesNaploAPI.saveEntry(entry);
  state.entries.unshift({
    id: saved.id || crypto.randomUUID(),
    project_id: projectId,
    projectId,
    phase,
    status,
    priority,
    responsible: entry.responsible,
    weather: entry.weather,
    note,
    image_url: images[0] || '',
    image_urls: images,
    video_urls: videos,
    image: images[0] || '',
    images,
    videos,
    videoUrls: videos,
    ai_level: analysis.level,
    ai_score: analysis.score,
    ai_title: analysis.title,
    ai_json: analysis,
    analysis,
    created_at: saved.created_at || new Date().toISOString()
  });

  if (analysis.level !== 'Alacsony') {
    const task = {
      projectId,
      title: analysis.title,
      owner: responsible || 'Ellenőrzendő',
      deadline: null,
      done: false,
      priority: analysis.level
    };
    const savedTask = await window.EpitesNaploAPI.saveTask(task);
    state.tasks.unshift({
      ...task,
      id: savedTask.id || crypto.randomUUID(),
      project_id: projectId
    });
  }

  clearEntryForm();
  showLastAnalysis(analysis);
  render();
  const mediaText = [
    images.length ? images.length + ' fotó' : '',
    videos.length ? videos.length + ' videó' : ''
  ].filter(Boolean).join(' és ');
  showToast('✔ Naplóbejegyzés mentve. ' + (mediaText ? mediaText + ' feltöltve.' : 'Média nélkül mentve.'));
}

function analyzeEntry(data) {
  const text = `${data.note} ${data.phase} ${data.status} ${data.priority}`.toLowerCase();
  let score = 0;
  let findings = [];

  AI_RULES.forEach(rule => {
    const matched = rule.words.filter(w => text.includes(w));
    if (matched.length) {
      score += rule.risk;
      findings.push({ title: rule.title, words: matched, advice: rule.advice, repair: rule.repair || [], materials: rule.materials || [] });
    }
  });

  if (data.status === 'Ellenőrzés szükséges') score += 3;
  if (data.status === 'Ellenőrzésre vár') score += 2;
  if (data.priority === 'Sürgős') score += 3;
  if (data.priority === 'Fontos') score += 1;

  let level = 'Alacsony';
  if (score >= 3) level = 'Közepes';
  if (score >= 6) level = 'Magas';

  let title = 'Ellenőrzés rendben';
  if (level === 'Közepes') title = findings[0]?.title || 'Ellenőrzendő kockázat';
  if (level === 'Magas') title = findings[0]?.title || 'Magas kockázatú eltérés gyanú';

  const generalAdvice = [
    'Készíts több fotót közelről és távolról.',
    'Rögzítsd, ki volt felelős a munkafázisért.',
    'Átadás vagy fizetés előtt legyen ellenőrzés.',
    'Vitás esetben írásos egyeztetés javasolt.'
  ];

  const repairs = findings.flatMap(f => f.repair || []).slice(0, 6);
  const materials = [...new Set(findings.flatMap(f => f.materials || []))].slice(0, 8);

  return {
    score,
    level,
    title,
    findings,
    advice: findings.map(f => f.advice).concat(generalAdvice).slice(0, 6),
    repairs,
    materials,
    estimatedCost: estimateRepairCost(level, repairs.length, materials.length),
    estimatedHours: estimateWorkHours(level, repairs.length),
    createdAt: new Date().toLocaleString('hu-HU')
  };
}

function estimateRepairCost(level, repairCount, materialCount) {
  const base = level === 'Magas' ? 85000 : level === 'Közepes' ? 45000 : 18000;
  return base + (repairCount * 6500) + (materialCount * 3500);
}
function estimateWorkHours(level, repairCount) {
  const base = level === 'Magas' ? 8 : level === 'Közepes' ? 4 : 2;
  return Math.max(base, base + Math.ceil(repairCount / 2));
}
function money(value) {
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(Number(value || 0));
}
function selectedProProject() {
  const projectId = selectedClientProjectId() || document.getElementById('entryProject')?.value || state.projects[0]?.id || '';
  return state.projects.find(p => p.id === projectId) || null;
}
function selectedProjectEntries(projectId) { return state.entries.filter(e => (e.project_id || e.projectId) === projectId); }
function selectedProjectTasks(projectId) { return state.tasks.filter(t => (t.project_id || t.projectId) === projectId); }
function proResult(html) { const box = document.getElementById('proToolsResult'); if (box) box.innerHTML = html; }

function showLastAnalysis(analysis) {
  const box = document.getElementById('aiLastResult');
  box.className = 'result ' + (analysis.level === 'Magas' ? 'high' : analysis.level === 'Közepes' ? 'medium' : '');
  box.innerHTML = `
    <b>AI elemzés: ${analysis.level} kockázat</b>
    <p><strong>${escapeHtml(analysis.title)}</strong></p>
    <p>Pontszám: ${analysis.score} • Ellenőrzési tartalék: <b>${money(analysis.estimatedCost)}</b> • Munkaidő: <b>${analysis.estimatedHours} óra</b></p>
    ${analysis.evidenceScore ? `<p><b>Bizonyíték-erősség:</b> ${Math.round(analysis.evidenceScore)}% • ${escapeHtml(analysis.photoTextCheck || '')}</p>` : ''}
    <ul>${analysis.advice.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
    <div class="aiAdviceBox">
      <b>Javítási javaslat</b>
      <ul>${(analysis.repairs || []).map(a => `<li>${escapeHtml(a)}</li>`).join('') || '<li>Nincs külön beavatkozási javaslat.</li>'}</ul>
      <b>Lehetséges anyagok</b>
      <ul>${(analysis.materials || []).map(a => `<li>${escapeHtml(a)}</li>`).join('') || '<li>Nincs külön anyagjavaslat.</li>'}</ul>
    </div>
  `;
}

function clearEntryForm() {
  document.getElementById('entryNote').value = '';
  document.getElementById('entryFile').value = '';
  document.getElementById('responsible').value = '';
  document.getElementById('weather').value = '';
}

async function addTask() {
  if (!state.user) {
    alert('Hibajegyhez előbb jelentkezz be.');
    openAuthModal();
    return;
  }

  const projectId = document.getElementById('taskProject').value;
  const title = document.getElementById('taskTitle').value.trim();
  const owner = document.getElementById('taskOwner').value.trim();
  const deadline = document.getElementById('taskDeadline').value;

  if (!projectId) return alert('Előbb hozz létre vagy válassz projektet.');
  if (!title) return alert('Írd be a hibát vagy feladatot.');

  const task = {
    projectId,
    title,
    owner: owner || 'Nincs megadva',
    deadline: deadline || null,
    done: false,
    priority: 'Kézi'
  };

  const saved = await window.EpitesNaploAPI.saveTask(task);
  state.tasks.unshift({
    ...task,
    id: saved.id || crypto.randomUUID(),
    project_id: projectId
  });

  document.getElementById('taskTitle').value = '';
  document.getElementById('taskOwner').value = '';
  document.getElementById('taskDeadline').value = '';
  render();
}

function projectName(projectId) {
  return state.projects.find(p => p.id === projectId)?.name || 'Ismeretlen projekt';
}

function copyReport() {
  const text = document.getElementById('reportText').innerText;
  navigator.clipboard.writeText(text).then(() => alert('Riport szöveg kimásolva.'));
}

function setAdminTestPlan(plan) {
  if (!isAdmin()) return;

  state.adminTestPlan = plan;
  render();

  const label = PLAN_LIMITS[plan]?.label || plan;
  alert('Admin tesztnézet bekapcsolva: ' + label);
}

function clearAdminTestPlan() {
  if (!isAdmin()) return;

  state.adminTestPlan = null;
  render();
  alert('Admin tesztnézet kikapcsolva. Vissza teljes admin hozzáférésre.');
}


function displayedPlanLabel() {
  const limit = currentLimit();

  if (isAdmin() && state.adminTestPlan) {
    return `${limit.label} teszt`;
  }

  if (isAdmin()) {
    return 'Business csomag';
  }

  return limit.label;
}

function render() {
  const limit = currentLimit();

  document.getElementById('accountBadge').textContent = state.user ? 'Belépve' : 'Vendég mód';
  document.getElementById('currentUserName').textContent = state.user ? `Üdv, ${firstNameFromProfile()}!` : 'Vendég felhasználó';
  document.getElementById('currentUserEmail').textContent = state.user?.email || 'Nincs bejelentkezve';
  document.getElementById('currentPlanText').textContent = `Csomag: ${displayedPlanLabel()}`;
  const aiCreditText = document.getElementById('currentAiCreditsText');
  if (aiCreditText) aiCreditText.textContent = `AI riport kredit: ${state.aiCredits || 0} db`;
  const aiCreditBadge = document.getElementById('aiCreditBadge');
  if (aiCreditBadge) aiCreditBadge.textContent = state.aiCredits || 0;

  setHidden('loginBtn', !!state.user);
  setHidden('heroRegisterBtn', !!state.user);
  setHidden('logoutBtn', !state.user);
  setHidden('adminOnlyPlanNotice', !isAdmin());
  setHidden('publicPlanNotice', isAdmin());
  setHidden('notificationBtn', !state.user);
  setHidden('profileNavLink', !state.user);
  setHidden('adminMessagesNavLink', !isAdmin());
  setHidden('adminPanelNavLink', !isAdmin());

  document.getElementById('statProjects').textContent = state.projects.length;
  document.getElementById('statEntries').textContent = state.entries.length;
  document.getElementById('statRisks').textContent = state.entries.filter(e => (e.analysis?.level || e.ai_level) !== 'Alacsony').length;

  document.getElementById('limitBox').innerHTML = `
    <b>Aktuális csomag:</b> ${displayedPlanLabel()}<br>
    Projektkeret: ${limit.maxProjects >= 9999 ? 'korlátlan' : limit.maxProjects + ' projekt'}<br>
    AI használat: ${limit.canUseAI ? 'engedélyezve' : 'fizetős csomagban'}<br>
    PDF export: ${limit.canPdf ? 'engedélyezve' : 'fizetős csomagban'}<br>
    Ügyfél link: ${limit.canClientReport ? 'engedélyezve' : 'fizetős csomagban'}<br>
    Napló mentés: ${limit.canAddEntries ? 'engedélyezve' : 'letiltva'}
    ${isAdmin() && state.adminViewingUser ? `<br><br><b>Admin felhasználóteszt:</b> ${escapeHtml(state.adminViewingUser.email || '')}` : ''}
    ${isAdmin() ? `
      <div class="adminPlanTester">
        <b>Admin csomag teszt:</b>
        <p>Ezzel fizetés nélkül kipróbálhatod, mit lát a Próba / Starter / Pro / Business / Lejárt felhasználó.</p>
        <div class="adminPlanButtons">
          <button class="btn small ghost" onclick="setAdminTestPlan('trial')">Próba</button>
          <button class="btn small ghost" onclick="setAdminTestPlan('starter')">Starter 9 900</button>
          <button class="btn small ghost" onclick="setAdminTestPlan('pro')">Pro 19 900</button>
          <button class="btn small ghost" onclick="setAdminTestPlan('business')">Business 39 900</button>
          <button class="btn small ghost" onclick="setAdminTestPlan('expired')">Lejárt nézet</button>
          <button class="btn small primary" onclick="clearAdminTestPlan()">Teljes admin</button>
        </div>
        ${state.adminTestPlan ? `<small>Most ezt teszteled: <b>${PLAN_LIMITS[state.adminTestPlan]?.label || state.adminTestPlan}</b></small>` : `<small>Most teljes admin hozzáférés aktív.</small>`}
      </div>
    ` : ''}
  `;

  const adminSection = document.getElementById('admin');
  const adminLink = document.getElementById('adminNavLink');

  if (adminSection) {
    adminSection.classList.toggle('hidden', !isAdmin());
  }

  if (adminLink) {
    adminLink.classList.toggle('hidden', !isAdmin());
  }

  const projectOptions = state.projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  const emptyOption = '<option value="">Válassz projektet</option>';
  document.getElementById('entryProject').innerHTML = emptyOption + projectOptions;
  document.getElementById('taskProject').innerHTML = emptyOption + projectOptions;
  const clientSelect = document.getElementById('clientReportProject');
  if (clientSelect) clientSelect.innerHTML = emptyOption + projectOptions;

  renderProjects();
  renderEntries();
  renderTasks();
  updateReport();
  renderAdmin();
  renderPayments();
  renderAdminSupportMessages();
  renderNotifications();
}

function renderProjects() {
  document.getElementById('projectList').innerHTML = state.projects.map(p => `
    <div class="item">
      <div>
        <b>${escapeHtml(p.name)}</b>
        <small>Létrehozva: ${formatDate(p.created_at)}</small>
      </div>
      <div class="itemActions">
        ${state.adminViewingUser ? '<span class="tag">admin megtekintés</span>' : `<button class="btn small primary" onclick="continueProject('${p.id}')">Projekt napló megnyitása</button><button class="btn small ghost" onclick="renameProject('${p.id}')">Név módosítása</button><button class="btn small dangerBtn" onclick="deleteProject('${p.id}')">Törlés</button>`}
      </div>
    </div>
  `).join('') || `<div class="emptyState"><b>Indítsd el az első projekted 👇</b><p class="muted">Adj meg egy projektnevet feljebb, majd kattints a Projekt hozzáadása gombra.</p><a class="btn primary" href="#naplo">Projekt létrehozása</a></div>`;
}

function continueProject(projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;

  try {
    sessionStorage.setItem('epitesnaplo_selected_project', JSON.stringify({ id: project.id, name: project.name }));
  } catch (_) {}

  window.location.href = `project.html?id=${encodeURIComponent(projectId)}`;
}

async function editProject(projectId) {
  return continueProject(projectId);
}

async function renameProject(projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;

  const newName = prompt('Új projekt név:', project.name);
  if (!newName || !newName.trim()) return;

  try {
    const saved = await window.EpitesNaploAPI.updateProject(projectId, newName.trim());
    state.projects = state.projects.map(p => p.id === projectId ? { ...p, name: saved.name || newName.trim() } : p);
    render();
    showToast('Projekt neve módosítva.', 'ok');
  } catch (err) {
    console.error(err);
    alert('Nem sikerült módosítani a projektet.');
  }
}

async function deleteProject(projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;

  const ok = confirm(`Biztosan törlöd ezt a projektet?\n\n${project.name}\n\nTörlődik a Supabase-ből a projekt, a naplóbejegyzések, teendők, riportok, anyagok, számlák és a projekt videófájljai is.`);
  if (!ok) return;

  try {
    await window.EpitesNaploAPI.deleteProject(projectId);

    state.projects = state.projects.filter(p => p.id !== projectId);
    state.entries = state.entries.filter(e => (e.project_id || e.projectId) !== projectId);
    state.tasks = state.tasks.filter(t => (t.project_id || t.projectId) !== projectId);

    render();
    alert('Projekt törölve.');
  } catch (err) {
    console.error(err);
    alert('Projekt törlési hiba: ' + (err?.message || err || 'Ismeretlen Supabase hiba.'));
  }
}


function renderEntries() {
  const dateFilter = document.getElementById('dateFilter')?.value || '';
  const riskFilter = document.getElementById('riskFilter')?.value || 'all';

  let entries = [...state.entries];

  if (dateFilter) {
    entries = entries.filter(entry => {
      const d = entry.created_at ? new Date(entry.created_at).toISOString().slice(0, 10) : '';
      return d === dateFilter;
    });
  }

  if (riskFilter !== 'all') {
    entries = entries.filter(entry => (entry.analysis?.level || entry.ai_level || 'Alacsony') === riskFilter);
  }

  document.getElementById('entryList').innerHTML = entries.map(entry => {
    const level = entry.analysis?.level || entry.ai_level || 'Alacsony';
    const title = entry.analysis?.title || entry.ai_title || 'Elemzés';
    const levelClass = level === 'Magas' ? 'bad' : level === 'Közepes' ? 'warn' : 'ok';
    const images = getEntryImages(entry);
    const videos = getEntryVideos(entry);
    return `
      <div class="photoCard">
        ${images.length ? `<div class="entryImageGrid">${images.map(src => renderMediaImage(src, 'Építési fotó')).join('')}</div>` : ''}
        ${videos.length ? `<div class="entryVideoGrid">${videos.map(v => renderMediaVideo(v, 'Munkavideó')).join('')}</div>` : ''}
        <div>
          <b>${escapeHtml(projectName(entry.project_id || entry.projectId))}</b>
          <small>${formatDate(entry.created_at)}${images.length ? ' • ' + images.length + ' fotó' : ''}${videos.length ? ' • ' + videos.length + ' videó' : ''}</small>
          <p>${escapeHtml(entry.note)}</p>
          <span class="tag ai">AI: ${escapeHtml(level)}</span>
          <span class="tag ${levelClass}">${escapeHtml(title)}</span>
          <span class="tag">${escapeHtml(entry.phase)}</span>
          <span class="tag">${escapeHtml(entry.status)}</span>
          <small>Felelős: ${escapeHtml(entry.responsible || 'Nincs megadva')} • ${escapeHtml(entry.weather || '')}</small>
          ${entry.analysis?.repairs?.length ? `<div class="aiAdviceBox"><b>Javítási javaslat:</b><ul>${entry.analysis.repairs.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>` : ''}
          ${entry.analysis?.materials?.length ? `<div class="aiAdviceBox"><b>Anyagjavaslat:</b><br>${entry.analysis.materials.map(m => escapeHtml(m)).join(', ')}</div>` : ''}
        </div>
      </div>
    `;
  }).join('') || '<p class="muted">Nincs bejegyzés a kiválasztott szűrés alapján.</p>';
}

function renderTasks() {
  document.getElementById('taskList').innerHTML = state.tasks.map(t => `
    <div class="item">
      <div>
        <b>${escapeHtml(t.title)}</b>
        <small>Projekt: ${escapeHtml(projectName(t.project_id || t.projectId))} • Felelős: ${escapeHtml(t.owner || '')} • Határidő: ${escapeHtml(t.deadline || 'Nincs határidő')}</small>
      </div>
      <div class="itemActions">
        <span class="tag ${t.done ? 'ok' : 'bad'}">${t.done ? 'Kész' : 'Nyitott'}</span>
        <span class="tag warn">${escapeHtml(t.priority || 'Normál')}</span>
      </div>
    </div>
  `).join('') || '<p class="muted">Még nincs eltérés vagy feladat.</p>';
}

function updateReport() {
  const openTasks = state.tasks.filter(t => !t.done);
  const urgent = state.tasks.filter(t => String(t.priority).includes('Magas') || String(t.priority).includes('Sürgős'));
  const review = state.entries.filter(e => e.status === 'Ellenőrzésre vár');
  const highRisk = state.entries.filter(e => (e.analysis?.level || e.ai_level) === 'Magas');

  document.getElementById('reportOpen').textContent = openTasks.length;
  document.getElementById('reportUrgent').textContent = urgent.length;
  document.getElementById('reportReview').textContent = review.length;
  document.getElementById('reportHighRisk').textContent = highRisk.length;

  document.getElementById('reportText').innerHTML = `
    <b>Automatikus összefoglaló</b>
    <p>Összes projekt: ${state.projects.length}</p>
    <p>Összes naplóbejegyzés: ${state.entries.length}</p>
    <p>Nyitott hibák: ${openTasks.length}</p>
    <p>Magas kockázatú bejegyzések: ${highRisk.length}</p>
    <p>Javaslat: magas kockázatú vagy ellenőrzésre váró munkát átadás előtt külön dokumentálni kell.</p>
  `;
}

async function adminViewUser(userId) {
  if (!isAdmin()) return;

  const target = state.adminUsers.find(u => u.id === userId);
  if (!target) {
    alert('Felhasználó nem található.');
    return;
  }

  state.adminViewingUser = target;
  state.projects = await window.EpitesNaploAPI.getAdminUserProjects(userId);
  state.entries = await window.EpitesNaploAPI.getAdminUserEntries(userId);
  await hydratePrivateVideoUrls(state.entries);
  state.tasks = await window.EpitesNaploAPI.getAdminUserTasks(userId);

  render();
  window.location.hash = '#naplo';
  alert('Admin tesztnézet betöltve: ' + (target.email || target.full_name || 'felhasználó'));
}

async function adminBackToOwnView() {
  if (!isAdmin()) return;

  state.adminViewingUser = null;
  await loadUserData();
  render();
  alert('Saját admin nézet visszaállítva.');
}

function renderAdmin() {
  if (!isAdmin()) return;

  const search = (document.getElementById('adminSearch')?.value || '').toLowerCase();
  const filter = document.getElementById('adminFilter')?.value || 'all';

  let users = [...state.adminUsers];

  users = users.filter(u => {
    const name = (u.full_name || u.email || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const plan = ['trial','starter','pro','business'].includes(u.plan) ? u.plan : 'trial';
    const matchesSearch = name.includes(search) || email.includes(search);
    const matchesFilter = filter === 'all' || plan === filter;
    return matchesSearch && matchesFilter;
  });

  document.getElementById('adminList').innerHTML = users.map(u => `
    <div class="item">
      <div>
        <b>${escapeHtml(u.full_name || u.email || 'Felhasználó')}</b>
        <small>${escapeHtml(u.email || '')} • Projektek: ${u.project_count || 0}</small>
      </div>
      <div class="itemActions">
        <span class="tag ${u.plan === 'business' ? 'ok' : u.plan === 'pro' ? 'ok' : u.plan === 'starter' ? 'warn' : u.plan === 'expired' ? 'bad' : 'warn'}">${escapeHtml(['trial','starter','pro','business'].includes(u.plan) ? u.plan : 'trial')}</span>
        <span class="tag">${escapeHtml(u.status || 'active')}</span>
        <span class="tag">${u.current_period_end ? 'Lejár: ' + formatDate(u.current_period_end) : ''}</span>
        <button class="btn small ghost" onclick="adminViewUser('${u.id}')">Megnézés</button>
      </div>
    </div>
  `).join('') || '<p class="muted">Nincs találat.</p>';
}

function renderPayments() {
  if (!isAdmin()) return;

  document.getElementById('paymentList').innerHTML = state.adminPayments.map(p => `
    <div class="item">
      <div>
        <b>${escapeHtml(p.email || 'Ismeretlen felhasználó')}</b>
        <small>PayPal order: ${escapeHtml(p.paypal_order_id || '')}</small>
        <small>${escapeHtml(p.amount || '')} ${escapeHtml(p.currency || '')} • ${formatDate(p.created_at)}</small>
      </div>
      <div class="itemActions">
        <span class="tag ${p.status === 'completed' ? 'ok' : 'warn'}">${escapeHtml(p.status || '')}</span>
      </div>
    </div>
  `).join('') || '<p class="muted">Még nincs fizetés.</p>';
}

function selectedClientProjectId() {
  return document.getElementById('clientReportProject')?.value || '';
}

function generateClientReport() {
  const limit = currentLimit();

  if (!state.user) {
    alert('Riport készítéséhez előbb jelentkezz be.');
    openAuthModal();
    return;
  }

  if (!limit.canClientReport) {
    alert('Az ügyfélriport fizetős funkció. Válassz Starter, Pro vagy Business csomagot.');
    return;
  }

  const projectId = selectedClientProjectId();
  if (!projectId) {
    alert('Válassz projektet az ügyfélriporthoz.');
    return;
  }

  const project = state.projects.find(p => p.id === projectId);
  const entries = state.entries.filter(e => (e.project_id || e.projectId) === projectId);
  const tasks = state.tasks.filter(t => (t.project_id || t.projectId) === projectId && !t.done);

  const html = buildClientReportHtml(project, entries, tasks);
  document.getElementById('clientReportPreview').innerHTML = html;
}

function buildClientReportHtml(project, entries, tasks) {
  const today = new Date().toLocaleDateString('hu-HU');
  const highRisk = entries.filter(e => (e.analysis?.level || e.ai_level) === 'Magas').length;
  const budget = buildBudgetSummary(entries, tasks, project);
  const entryHtml = entries.map(entry => {
    const level = entry.analysis?.level || entry.ai_level || 'Alacsony';
    const title = entry.analysis?.title || entry.ai_title || 'Elemzés';
    const materials = entry.analysis?.materials || [];
    const repairs = entry.analysis?.repairs || [];
    const advice = entry.analysis?.advice || [];
    const images = getEntryImages(entry);
    const videos = getEntryVideos(entry);
    return `
      <div class="clientReportEntry">
        <b>${formatDate(entry.created_at)} – ${escapeHtml(entry.phase || '')}</b>
        <p>${escapeHtml(entry.note || '')}</p>
        <p><b>Állapot:</b> ${escapeHtml(entry.status || '')} • <b>Kockázat:</b> ${escapeHtml(level)} • ${escapeHtml(title)}</p>
        ${advice.length ? `<p><b>AI rövid tanács:</b></p><ul>${advice.slice(0,3).map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
        ${repairs.length ? `<p><b>Javítási javaslat:</b></p><ul>${repairs.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
        ${materials.length ? `<p><b>Lehetséges anyagok:</b> ${materials.map(m => escapeHtml(m)).join(', ')}</p>` : ''}
        ${images.length ? `<div class="reportImageGrid">${images.map(src => renderMediaImage(src, 'Napló fotó')).join('')}</div>` : ''}
        ${videos.length ? `<p><b>Csatolt munkavideók:</b> ${videos.length} db</p><div class="entryVideoGrid">${videos.map(v => renderPublicReportVideo(v, 'Munkavideó')).join('')}</div>` : ''}
      </div>
    `;
  }).join('');

  const taskHtml = tasks.map(t => `<li>${escapeHtml(t.title)} – felelős: ${escapeHtml(t.owner || 'nincs megadva')}</li>`).join('');

  return `
    <div class="clientReportHeader">
      <h3>${escapeHtml(reportTitle())}</h3>
      <p><b>Projekt:</b> ${escapeHtml(project?.name || 'Nincs megadva')}</p>
      <p><b>Készítés dátuma:</b> ${today}</p>
      <p><b>Készítette:</b> ${escapeHtml(displayOwnerName())}</p>
    </div>
    <div class="reportGrid compactReportStats">
      <div><b>${entries.length}</b><span>naplóbejegyzés</span></div>
      <div><b>${tasks.length}</b><span>nyitott teendő</span></div>
      <div><b>${highRisk}</b><span>magas kockázat</span></div>
      <div><b>${money(budget.total)}</b><span>ellenőrzési tartalék</span></div>
    </div>
    <p><b>AI összegzés:</b> A jelentés a rögzített munkafázisok, megjegyzések és fotók alapján készült. A javaslatok előszűrésre és dokumentálásra szolgálnak, műszaki döntésnél szakember/műszaki ellenőr ellenőrzése javasolt.</p>
    <h4>Automatikus anyaglista és költségbecslés</h4>
    ${budget.html}
    ${tasks.length ? `<h4>Nyitott teendők / ellenőrzések</h4><ul>${taskHtml}</ul>` : '<p>Nincs nyitott teendőjegy.</p>'}
    <h4>Naplóbejegyzések</h4>
    ${entryHtml || '<p>Még nincs naplóbejegyzés ehhez a projekthez.</p>'}
    <div class="signatureBox"><b>Átvétel / megjegyzés / aláírás:</b><br><br><span>............................................................</span></div>
  `;
}

function copyClientReport() {
  const preview = document.getElementById('clientReportPreview');
  if (!preview || !preview.innerText.trim()) {
    alert('Előbb készíts ügyfélriportot.');
    return;
  }
  navigator.clipboard.writeText(preview.innerText).then(() => alert('Ügyfélriport szöveg kimásolva.'));
}

function downloadClientReportPdf() {
  const limit = currentLimit();

  if (!limit.canPdf) {
    alert('PDF export fizetős funkció. Válassz Starter, Pro vagy Business csomagot.');
    return;
  }

  const preview = document.getElementById('clientReportPreview');
  if (!preview || preview.innerText.includes('Még nincs előkészített')) {
    alert('Előbb készíts ügyfélriportot.');
    return;
  }

  const projectId = selectedClientProjectId();
  const project = state.projects.find(p => p.id === projectId);
  const filename = `${reportTitle().replaceAll(' ', '-')}-${(project?.name || 'riport').replaceAll(' ', '-')}.pdf`;

  html2pdf().set({
    margin: 10,
    filename,
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(preview).save();
}

function createShareText() {
  const projectId = selectedClientProjectId();
  const project = state.projects.find(p => p.id === projectId);
  const preview = document.getElementById('clientReportPreview');

  if (!projectId || !preview || preview.innerText.includes('Még nincs előkészített')) {
    alert('Előbb válassz projektet és készíts riportot.');
    return;
  }

  const text =
`Szia!

Elkészült az ÉpítésNapló jelentés a következő munkáról:
${project?.name || ''}

A jelentés tartalmazza:
- naplóbejegyzések
- hibák / javítások
- AI kockázati jelzések
- javasolt javítások és anyagok

Biztonságos ügyfél link:
${window.EpitesNaploAPI.createClientShareUrl(projectId)}

A riportot külön elküldöm PDF-ben vagy üzenetben.`;

  navigator.clipboard.writeText(text).then(() => alert('Megosztható üzenet kimásolva.'));
}


async function createAndCopyClientLink() {
  const limit = currentLimit();

  if (!limit.canClientReport) {
    alert('Ügyfél link Starter, Pro vagy Business csomagban érhető el.');
    return;
  }

  const projectId = selectedClientProjectId();
  if (!projectId) {
    alert('Előbb válassz projektet.');
    return;
  }

  const project = state.projects.find(p => p.id === projectId);
  const preview = document.getElementById('clientReportPreview');

  if (!preview || preview.innerText.includes('Még nincs előkészített')) {
    generateClientReport();
  }

  const finalPreview = document.getElementById('clientReportPreview');
  const reportHtml = finalPreview.innerHTML;
  const reportText = finalPreview.innerText;

  try {
    const saved = await window.EpitesNaploAPI.createPublicReport({
      projectId,
      projectName: project?.name || '',
      reportHtml,
      reportText
    });

    const link = window.EpitesNaploAPI.createClientShareUrl(saved.token);
    state.lastClientReportLink = link;

    await navigator.clipboard.writeText(link);
    alert('Működő ügyfél link létrehozva és kimásolva.');
  } catch (err) {
    console.error(err);
    alert('Nem sikerült létrehozni az ügyfél linket.');
  }
}

function copyClientShareLink() {
  if (!state.lastClientReportLink) {
    alert('Még nincs létrehozott ügyfél link. Előbb nyomd meg: Működő ügyfél link létrehozása.');
    return;
  }

  navigator.clipboard.writeText(state.lastClientReportLink).then(() => {
    alert('Ügyfél link kimásolva: ' + state.lastClientReportLink);
  });
}

function createShareText() {
  const projectId = selectedClientProjectId();
  const project = state.projects.find(p => p.id === projectId);
  const preview = document.getElementById('clientReportPreview');

  if (!projectId || !preview || preview.innerText.includes('Még nincs előkészített')) {
    alert('Előbb válassz projektet és készíts riportot.');
    return;
  }

  const linkLine = state.lastClientReportLink
    ? `\nBiztonságos ügyfél link:\n${state.lastClientReportLink}\n`
    : '\nA működő ügyfél linkhez előbb nyomd meg a link létrehozása gombot.\n';

  const text =
`Szia!

Elkészült az ÉpítésNapló jelentés a következő munkáról:
${project?.name || ''}

A jelentés tartalmazza:
- naplóbejegyzések
- hibák / javítások
- AI kockázati jelzések
- javasolt javítások és anyagok
${linkLine}
A riportot PDF-ben is el tudom küldeni.`;

  navigator.clipboard.writeText(text).then(() => alert('Megosztható üzenet kimásolva.'));
}



function preventSupportSubjectAutofill() {
  const clearIfEmail = () => {
    const input = document.getElementById('supportSubject');
    if (!input) return;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('data-lpignore', 'true');
    input.setAttribute('data-form-type', 'other');
    const v = (input.value || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) input.value = '';
  };
  clearIfEmail();
  setTimeout(clearIfEmail, 250);
  setTimeout(clearIfEmail, 1000);
}

async function sendSupportMessage() {
  if (!state.user) {
    alert('Üzenet küldéséhez előbb jelentkezz be.');
    openAuthModal();
    return;
  }

  preventSupportSubjectAutofill();
  const rawSubject = document.getElementById('supportSubject')?.value.trim() || '';
  const subject = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawSubject) ? 'Hibabejelentés' : (rawSubject || 'Hibabejelentés');
  const message = document.getElementById('supportMessage')?.value.trim();

  if (!message) {
    alert('Írd le a hibát vagy kérdést.');
    return;
  }

  try {
    await window.EpitesNaploAPI.saveSupportMessage({ subject, message });

    document.getElementById('supportSubject').value = '';
    document.getElementById('supportMessage').value = '';

    const result = document.getElementById('supportResult');
    if (result) {
      result.classList.remove('hidden');
      result.innerHTML = '<b>Üzenet elküldve.</b><br>Az admin felületen meg fog jelenni.';
    }

    if (isAdmin()) {
      state.adminSupportMessages = await window.EpitesNaploAPI.getAdminSupportMessages();
      renderAdminSupportMessages();
    }
  } catch (err) {
    console.error(err);
    alert('Nem sikerült elküldeni az üzenetet.');
  }
}

function renderAdminSupportMessages() {
  if (!isAdmin()) return;

  const box = document.getElementById('adminSupportList');
  if (!box) return;

  box.innerHTML = (state.adminSupportMessages || []).map(m => `
    <div class="item supportMessageBox">
      <div>
        <b>${escapeHtml(m.subject || 'Üzenet')}</b>
        <small>${escapeHtml(m.name || '')} • ${escapeHtml(m.email || '')} • ${formatDate(m.created_at)}</small>
        <p>${escapeHtml(m.message || '')}</p>
      </div>
      <div class="itemActions">
        <span class="tag ${m.status === 'new' ? 'warn' : 'ok'}">${escapeHtml(m.status || 'new')}</span>
        <button class="btn small ghost" onclick="markSupportMessageRead('${m.id}')">Elolvasva</button>
        <a class="btn small primary" href="mailto:${escapeHtml(m.email || '')}?subject=${encodeURIComponent('Válasz: ' + (m.subject || 'Üzenet'))}">Válasz</a>
        <button class="btn small dangerBtn" onclick="deleteSupportMessage('${m.id}')">Törlés</button>
      </div>
    </div>
  `).join('') || '<p class="muted">Még nincs admin üzenet.</p>';
}


function toggleNotificationPanel() {
  const panel = document.getElementById('notificationPanel');
  if (panel) panel.classList.toggle('hidden');
}

function renderNotifications() {
  const countEl = document.getElementById('notificationCount');
  const listEl = document.getElementById('notificationList');
  if (!countEl || !listEl) return;

  const items = state.notifications || [];
  const unread = items.filter(n => !n.read).length;
  countEl.textContent = unread || items.length || 0;

  const headerActions = items.length ? `
    <div class="notificationActions">
      <button class="btn mini ghost" onclick="markAllNotificationsRead()">Mind olvasott</button>
      <button class="btn mini danger" onclick="clearNotifications()">Összes törlése</button>
    </div>
  ` : '';

  listEl.innerHTML = headerActions + (items.slice(0, 12).map(n => `
    <div class="notificationItem ${!n.read ? 'unread' : ''}">
      <div class="notificationItemTop">
        <b>${escapeHtml(n.title || n.type || 'Értesítés')}</b>
        <button class="closeMini" title="Értesítés törlése" onclick="deleteNotification('${n.id}')">×</button>
      </div>
      <p>${escapeHtml(n.message || '')}</p>
      <small>${formatDate(n.created_at)}</small>
      ${!n.read ? `<button class="btn mini ghost" onclick="markNotificationRead('${n.id}')">Olvasottra</button>` : ''}
    </div>
  `).join('') || '<p class="muted">Nincs új értesítés.</p>');
}

async function markNotificationRead(notificationId) {
  try {
    await window.EpitesNaploAPI.markNotificationRead(notificationId);
    state.notifications = await window.EpitesNaploAPI.getNotifications();
    renderNotifications();
  } catch (error) {
    showToast('Értesítés frissítési hiba: ' + (error.message || error), 'error');
  }
}

async function markAllNotificationsRead() {
  try {
    const unread = (state.notifications || []).filter(n => !n.read);
    await Promise.all(unread.map(n => window.EpitesNaploAPI.markNotificationRead(n.id)));
    state.notifications = await window.EpitesNaploAPI.getNotifications();
    renderNotifications();
  } catch (error) {
    showToast('Értesítések frissítési hiba: ' + (error.message || error), 'error');
  }
}

async function deleteNotification(notificationId) {
  try {
    await window.EpitesNaploAPI.deleteNotification(notificationId);
    state.notifications = (state.notifications || []).filter(n => n.id !== notificationId);
    renderNotifications();
    showToast('Értesítés törölve.', 'ok');
  } catch (error) {
    showToast('Értesítés törlési hiba: ' + (error.message || error), 'error');
  }
}

async function clearNotifications() {
  if (!confirm('Törlöd az összes értesítést?')) return;
  try {
    await window.EpitesNaploAPI.clearMyNotifications();
    state.notifications = [];
    renderNotifications();
    showToast('Értesítések törölve.', 'ok');
  } catch (error) {
    showToast('Értesítések törlési hiba: ' + (error.message || error), 'error');
  }
}
async function markSupportMessageRead(messageId) {
  if (!isAdmin()) return;
  await window.EpitesNaploAPI.markSupportMessageRead(messageId);
  state.adminSupportMessages = await window.EpitesNaploAPI.getAdminSupportMessages();
  renderAdminSupportMessages();
}

async function deleteSupportMessage(messageId) {
  if (!isAdmin()) return;
  if (!confirm('Biztosan törlöd ezt az admin üzenetet?')) return;
  try {
    await window.EpitesNaploAPI.deleteSupportMessage(messageId);
    state.adminSupportMessages = (state.adminSupportMessages || []).filter(m => m.id !== messageId);
    renderAdminSupportMessages();
    showToast('Admin üzenet törölve.', 'ok');
  } catch (error) {
    showToast('Admin üzenet törlési hiba: ' + (error.message || error), 'error');
  }
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('hu-HU');
  } catch {
    return value;
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[s]));
}

initApp();


function v54TextPool(project, entries = []) {
  return [project?.name, project?.description, ...(Array.isArray(entries) ? entries.flatMap(e => [e.phase, e.note, e.status, e.weather, e.location]) : [])].filter(Boolean).join(' ').toLowerCase();
}

function v54IsPavingMirrorWork(text) {
  const t = String(text || '').toLowerCase();
  return (t.includes('tükör') || t.includes('tukor')) && (t.includes('térkő') || t.includes('terko') || t.includes('viakolor') || t.includes('burkolat'));
}

function v54CleanMaterialName(name) {
  const clean = String(name || '').trim();
  if (!clean) return '';
  const bad = ['átadás-átvételi lista','atadas-atveteli lista','fotódokumentáció','fotodokumentacio','lézeres szintező','lezeres szintezo','vízmérték','vizmertek','kiegyenlítő anyag','kiegyenlito anyag','üvegszövet háló','uvegszovet halo','javítóhabarcs','javitohabarcs','mélyalapozó','melyalapozo','dokumentáció','dokumentacio','ellenőrzés','ellenorzes','jegyzőkönyv','jegyzokonyv'];
  const low = clean.toLowerCase();
  if (bad.some(x => low.includes(x))) return '';
  return clean;
}

function v54PavingMirrorMaterials() {
  return [
    { name: 'kitűzés és szintellenőrzés', note: 'lejtés, magasság és vízelvezetés ellenőrzése' },
    { name: 'tükörfelület tömörítése', note: 'teherbíró, egyenletes alapfelület kialakítása' },
    { name: 'geotextília', note: 'talaj és alapréteg elválasztására, ha a helyszín indokolja' },
    { name: 'zúzottkő / murva alapréteg', note: 'rétegrend szerint, tömörítve' },
    { name: 'ágyazó réteg', note: 'finom zúzalék vagy homok a térkő alá' },
    { name: 'szegélykő / megtámasztás', note: 'a burkolat oldalirányú megtámasztásához' }
  ];
}

function buildBudgetSummary(entries, tasks = [], project = null) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const text = v54TextPool(project, safeEntries);
  const isPavingMirror = v54IsPavingMirrorWork(text);
  const materialMap = new Map();
  let total = 0;
  let hours = 0;
  safeEntries.forEach(entry => {
    const analysis = entry.analysis || {};
    const level = analysis.level || entry.ai_level || 'Alacsony';
    const repairs = Array.isArray(analysis.repairs) ? analysis.repairs : [];
    const materials = Array.isArray(analysis.materials) ? analysis.materials : [];
    const estimatedCost = Number(analysis.estimatedCost);
    const estimatedHours = Number(analysis.estimatedHours);
    const cost = Number.isFinite(estimatedCost) ? estimatedCost : estimateRepairCost(level, repairs.length, materials.length);
    const workHours = Number.isFinite(estimatedHours) ? estimatedHours : estimateWorkHours(level, repairs.length);
    total += Number.isFinite(cost) ? cost : 0;
    hours += Number.isFinite(workHours) ? workHours : 0;
    if (!isPavingMirror) {
      materials.forEach(m => {
        const name = typeof m === 'object' ? (m.name || m.title || m.label || '') : m;
        const clean = v54CleanMaterialName(name);
        if (clean) materialMap.set(clean, (materialMap.get(clean) || 0) + 1);
      });
    }
  });
  total += (Array.isArray(tasks) ? tasks : []).filter(t => !t.done).length * 12000;
  total = Number.isFinite(total) ? total : 0;
  hours = Number.isFinite(hours) ? hours : 0;
  let materials = [...materialMap.entries()].map(([name, qty]) => ({ name, qty }));
  let body = '';
  if (isPavingMirror) {
    materials = v54PavingMirrorMaterials();
    body = `<p><b>Tükörkészítés / térkő alatti alap ellenőrzési pontok:</b></p><ul>${materials.map(m => `<li><b>${escapeHtml(m.name)}</b> – ${escapeHtml(m.note)}</li>`).join('')}</ul><p class="muted">Ez nem kész anyagkiírás és nem javítási lista. A mennyiségek csak helyszíni méret, rétegrend és megrendelői igény alapján adhatók meg pontosan.</p>`;
  } else {
    body = materials.length ? `<p><b>Anyag / eszköz javaslat:</b></p><ul>${materials.map(m => `<li>${escapeHtml(m.name)} – ${m.qty} kapcsolódó bejegyzésben szerepel</li>`).join('')}</ul>` : '<p>Nincs külön, munkához köthető anyagjavaslat rögzítve.</p>';
  }
  const html = `<div class="budgetBox"><p><b>${isPavingMirror ? 'Ellenőrzési keret / előzetes tartalék:' : 'Ellenőrzési / többletköltség tartalék:'}</b> ${money(total)}</p><p><b>Becsült munkaidő:</b> ${hours || 0} óra</p>${body}<p class="muted">A tartalék nem azt jelenti, hogy hibás a munka. Ez előzetes biztonsági keret ellenőrzésre, dokumentálásra, kisebb korrekcióra vagy anyageltérésre.</p></div>`;
  return { total, hours, materials, html, isPavingMirror };
}

async function runAiPhotoRecognition() {
  const limit = currentLimit();
  if (!limit.canUseAI) return alert('Az AI elemzés fizetős funkció. Válassz Starter, Pro vagy Business csomagot.');
  const project = selectedProProject();
  if (!project) return alert('Előbb hozz létre vagy válassz projektet.');
  const entries = selectedProjectEntries(project.id);
  const withImages = entries.filter(e => getEntryImages(e).length);
  if (!withImages.length) {
    return proResult('<h3>📸 AI képfelismerés</h3><p>A kiválasztott projektnél még nincs fotós bejegyzés.</p><p class="muted">Tölts fel több képet egy naplóbejegyzéshez, majd indítsd újra az elemzést.</p>');
  }
  showToast('📸 AI elemzés folyamatban...', 'info');
  proResult('<h3>📸 AI képfelismerés indul...</h3><p>' + withImages.length + ' fotós bejegyzést vizsgálok. Ha nincs bekötve a Vision Edge Function, akkor biztonságos helyi előszűréssel dolgozom.</p>');
  const results = [];
  for (const entry of withImages.slice(0, 12)) {
    const result = await visionAnalyzeEntry(entry);
    results.push({ entry, result });
  }
  const high = results.filter(x => x.result.level === 'Magas').length;
  const medium = results.filter(x => x.result.level === 'Közepes').length;
  const materials = [...new Set(results.flatMap(x => x.result.materials || []))].slice(0, 18);
  const totalCost = results.reduce((sum, x) => sum + Number(x.result.estimatedCost || 0), 0);
  const totalHours = results.reduce((sum, x) => sum + Number(x.result.estimatedHours || 0), 0);
  proResult(`
    <h3>📸 AI képfelismerés + fotó/szöveg kontroll</h3>
    <p><b>Projekt:</b> ${escapeHtml(project.name)}</p>
    <div class="metricGrid compact">
      <div><b>${withImages.length}</b><small>fotós bejegyzés</small></div>
      <div><b>${high}</b><small>magas kockázat</small></div>
      <div><b>${medium}</b><small>közepes kockázat</small></div>
      <div><b>${money(totalCost)}</b><small>ellenőrzési tartalék</small></div>
    </div>
    <div class="visionList">
      ${results.map(({entry, result}) => `
        <div class="visionCard ${result.level === 'Magas' ? 'danger' : result.level === 'Közepes' ? 'warn' : ''}">
          <div class="visionHead"><b>${result.icon || '📸'} ${escapeHtml(result.title)}</b><span>${escapeHtml(result.level)} • ${Math.round(result.confidence || 0)}%</span></div>
          <small>${escapeHtml(projectName(entry.project_id || entry.projectId))} • ${formatDate(entry.created_at)} • forrás: ${escapeHtml(result.source || 'AI')}</small>
          <p>${escapeHtml(entry.note || '').slice(0, 220)}</p>
          <div class="visionInsightGrid">
            <div><b>Belső szakmai nézet</b><span>${escapeHtml(result.professionalSummary || result.warning || 'Nincs külön szakmai összegzés.')}</span></div>
            <div><b>Ügyfélbarát összegzés</b><span>${escapeHtml(result.customerSummary || 'Rövid, ügyfélnek is érthető összegzés még nem érhető el.')}</span></div>
            <div><b>Fotó/szöveg kontroll</b><span>${escapeHtml(result.photoTextCheck || 'A fotók és a szöveg együtt ellenőrizve.')}</span></div>
            <div><b>Következő lépés</b><span>${escapeHtml(result.nextStep || 'A bejegyzést ellenőrizd és szükség esetén egészítsd ki.')}</span></div>
          </div>
          <p><b>Bizonyíték-erősség:</b> ${Math.round(result.evidenceScore || result.confidence || 0)}%</p>
          ${(result.findings || []).length ? `<p><b>Felismerések:</b> ${(result.findings || []).map(f => escapeHtml(f.title || f)).join(', ')}</p>` : ''}
          ${(result.checklist || []).length ? `<p><b>AI ellenőrző lista:</b></p><ul>${(result.checklist || []).slice(0, 5).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}
          <p><b>Javítási terv:</b></p>
          <ul>${(result.fix || []).slice(0, 5).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
          ${(result.materials || []).length ? `<p><b>Anyag:</b> ${(result.materials || []).map(escapeHtml).join(', ')}</p>` : ''}
          <p><b>Becslés:</b> ${money(result.estimatedCost)} • ${result.estimatedHours || 0} óra</p>
        </div>`).join('')}
    </div>
    ${materials.length ? `<div class="budgetBox"><b>Összesített anyaglista:</b><ul>${materials.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul><p><b>Teljes előzetes munkaidő:</b> ${totalHours} óra</p></div>` : ''}
    <p class="muted">A rendszer Gemini Vision Edge Functionnel valódi képtartalom-elemzésre kész. Ha a GEMINI_API_KEY még nincs beállítva Supabase-ben, automatikusan helyi építőipari előszűrésre vált.</p>
    <button class="btn ghost full" onclick="copyProToolsResult()">AI képfelismerési riport másolása</button>
  `);
  showToast('✔ AI képfelismerés elkészült');
  if (window.EpitesNaploAPI?.savePhotoAnalyses) {
    window.EpitesNaploAPI.savePhotoAnalyses(project.id, results.map(x => ({ entry_id: x.entry.id || null, analysis: x.result }))).catch(console.warn);
  }
}

function generateAutoBudget() {
  const project = selectedProProject();
  if (!project) return alert('Előbb válassz projektet az ügyfélriport résznél.');
  const budget = buildBudgetSummary(selectedProjectEntries(project.id), selectedProjectTasks(project.id), project);
  proResult(`<h3>📊 Automatikus költségvetés</h3><p><b>Projekt:</b> ${escapeHtml(project.name)}</p>${budget.html}<button class="btn ghost full" onclick="copyProToolsResult()">Költségvetés másolása</button>`);
}

function generateInvoiceDraft() {
  const project = selectedProProject();
  if (!project) return alert('Előbb válassz projektet az ügyfélriport résznél.');
  const entries = selectedProjectEntries(project.id);
  const budget = buildBudgetSummary(entries, selectedProjectTasks(project.id), project);
  const today = new Date().toLocaleDateString('hu-HU');
  proResult(`
    <h3>🧾 Számla / díjbekérő vázlat</h3>
    <p><b>Kiállító:</b> ${escapeHtml(displayOwnerName())}</p><p><b>Projekt:</b> ${escapeHtml(project.name)}</p><p><b>Dátum:</b> ${today}</p>
    <table class="simpleTable"><tr><th>Tétel</th><th>Mennyiség</th><th>Összeg</th></tr><tr><td>Építési napló dokumentáció és ügyfélriport</td><td>1 db</td><td>${money(9900)}</td></tr><tr><td>AI beavatkozási javaslat és anyaglista</td><td>${entries.length} bejegyzés</td><td>${money(Math.max(990, entries.length * 990))}</td></tr><tr><td>Ellenőrzési tartalék</td><td>előzetes</td><td>${money(budget.total)}</td></tr></table>
    <p><b>Összesen előzetesen:</b> ${money(9900 + Math.max(990, entries.length * 990) + budget.total)}</p><p class="muted">Ez nem NAV-os számla, hanem számlázóprogramba másolható előkészítő/díjbekérő szöveg.</p><button class="btn ghost full" onclick="copyProToolsResult()">Számla vázlat másolása</button>`);
}

function preparePaidAiReportOffer() {
  const project = selectedProProject();
  const projectName = project?.name || 'kiválasztott projekt';
  proResult(`
    <h3>💰 AI riport kredit rendszer</h3>
    <div class="offerBox">
      <p><b>Részletes AI építési kockázati riport</b></p>
      <p>A(z) ${escapeHtml(projectName)} dokumentációja alapján a rendszer elkészíti a kockázati összefoglalót, beavatkozási javaslatot, anyaglistát és előzetes költségbecslést.</p>
      <div class="creditStatusBox"><b>Elérhető AI riport kredit:</b> ${state.aiCredits || 0} db</div>
      <div class="formRow">
        <button class="btn primary" onclick="runPaidAiReport()">AI riport elkészítése (-1 kredit)</button>
        <button class="btn ghost" onclick="loadAiCredits().then(render)">Kreditek frissítése</button>
      </div>
    </div>
    <div class="creditBuyGrid">
      <div class="creditBuyCard"><b>1 AI riport</b><strong>990 Ft</strong><div id="paypal-ai-credit-1" class="paypalBox"></div></div>
      <div class="creditBuyCard"><b>10 AI riport</b><strong>4 990 Ft</strong><small>jobb ár, több projekthez</small><div id="paypal-ai-credit-10" class="paypalBox"></div></div>
    </div>
    <p class="muted">Fizetés után a kredit automatikusan jóváíródik a fiókodhoz. Egy részletes AI riport 1 kreditet használ fel.</p>`);
  renderPayPal();
}

async function runPaidAiReport() {
  if (!state.user) { openAuthModal(); return; }
  const project = selectedProProject();
  if (!project) return alert('Előbb válassz projektet az ügyfélriport résznél.');
  await loadAiCredits();
  if ((state.aiCredits || 0) <= 0) {
    preparePaidAiReportOffer();
    return alert('Nincs AI riport kredited. Vásárolj 1 db vagy 10 db AI riport kreditet.');
  }

  const ok = confirm('Elindítod a fizetős AI riportot? Ez 1 AI kreditet levon a fiókodból.');
  if (!ok) return;

  showToast('🧠 Fizetős AI riport készül...', 'info');
  const spend = await window.EpitesNaploAPI.spendAiCredit('paid_ai_report', project.id);
  state.aiCredits = spend?.credits ?? Math.max(0, (state.aiCredits || 0) - 1);

  const entries = selectedProjectEntries(project.id);
  const tasks = selectedProjectTasks(project.id);
  const budget = buildBudgetSummary(entries, tasks, project);
  const risky = entries.filter(e => (e.analysis?.level || e.ai_level) !== 'Alacsony');
  const materials = budget.materials || [];
  const urgent = risky.filter(e => (e.analysis?.level || e.ai_level) === 'Magas');

  proResult(`
    <h3>💰 Fizetős AI riport elkészült</h3>
    <div class="paidReportBox">
      <p><b>Projekt:</b> ${escapeHtml(project.name)}</p>
      <p><b>Felhasznált kredit:</b> 1 db • <b>Maradék:</b> ${state.aiCredits || 0} db</p>
      <div class="metricGrid compact">
        <div><b>${entries.length}</b><small>bejegyzés</small></div>
        <div><b>${risky.length}</b><small>kockázatos pont</small></div>
        <div><b>${urgent.length}</b><small>magas kockázat</small></div>
        <div><b>${money(budget.total)}</b><small>becsült keret</small></div>
      </div>
      <h4>AI összefoglaló</h4>
      <p>${risky.length ? 'A projektben talált kockázatos bejegyzések alapján ellenőrzési és beavatkozási terv készült.' : 'A projekt jelenlegi bejegyzései alapján nincs kiemelt kockázat, de az átadás előtti ellenőrzés javasolt.'}</p>
      <h4>Javasolt teendők</h4>
      <ul>
        ${(risky.slice(0, 6).map(e => `<li><b>${escapeHtml(e.phase || 'Munkafázis')}</b>: ${escapeHtml(e.analysis?.advice || e.note || 'Ellenőrzés javasolt.')}</li>`).join('')) || '<li>Fotók és munkafázisok rendszeres dokumentálása.</li>'}
      </ul>
      <h4>Anyaglista</h4>
      ${materials.length ? `<ul>${materials.slice(0, 12).map(m => `<li>${escapeHtml(m.name)} – ellenőrizendő mennyiség: ${m.qty} egység / m² alapján</li>`).join('')}</ul>` : '<p>Nincs külön anyagjavaslat.</p>'}
      ${budget.html}
    </div>
    <button class="btn ghost full" onclick="copyProToolsResult()">Fizetős AI riport másolása</button>`);
  render();
}

function copyProToolsResult() { const box = document.getElementById('proToolsResult'); if (box) navigator.clipboard.writeText(box.innerText).then(() => alert('Szöveg kimásolva.')); }

async function sendClientNotification() {
  const projectId = selectedClientProjectId();
  const project = state.projects.find(p => p.id === projectId);
  const email = document.getElementById('clientEmail')?.value.trim() || '';
  const phone = document.getElementById('clientPhone')?.value.trim() || '';
  const resultBox = document.getElementById('clientNotifyResult');

  if (!projectId) return alert('Előbb válassz projektet.');

  if (!state.lastClientReportLink) {
    await createAndCopyClientLink();
  }

  const link = state.lastClientReportLink || '';
  const message = `Szia!\n\nElkészült a(z) ${project?.name || ''} építési napló jelentése.\n\nMegnyitás: ${link}\n\nÜdvözlettel: ${displayOwnerName()}`;

  await navigator.clipboard.writeText(message);

  if (resultBox) {
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = '<b>Értesítő szöveg kimásolva.</b><br>Email/SMS küldéshez a szöveg és az ügyfél link készen áll.';
  }

  if (email || phone) {
    try {
      const res = await window.EpitesNaploAPI.sendClientNotification({
        email,
        phone,
        projectName: project?.name || '',
        link,
        message
      });
      if (res?.ok && resultBox) {
        resultBox.innerHTML = '<b>Értesítés elküldve.</b><br>Az ügyfél megkapta a napló linkjét.';
      } else if (resultBox) {
        resultBox.innerHTML = '<b>Értesítő előkészítve.</b><br>Az automatikus email/SMS küldéshez a notify-client Edge Function bekötése szükséges. A szöveget kimásoltam.';
      }
    } catch (err) {
      console.warn(err);
      if (resultBox) resultBox.innerHTML = '<b>Értesítő előkészítve.</b><br>Az automatikus küldés még nincs bekötve, de a szöveget kimásoltam.';
    }
  }
}


// V23 – Rendszerfunkciók kattintható, ügyfélbarát magyarázatai
const FEATURE_EXPLAIN = {
  fiok:{title:'Felhasználói fiókok',what:'Minden szakember vagy cég saját fiókkal tud belépni, így a projektek, naplók, riportok és ügyfélanyagok külön kezelhetők.',how:'Belépés után a rendszer a felhasználóhoz köti a projekteket. Így nem keveredik más munkáival, és később visszakereshető minden dokumentáció.',why:'Ettől lesz a napló nem csak egy egyszerű űrlap, hanem saját, digitális munkaterület.'},
  paypal:{title:'PayPal ellenőrzés',what:'A fizetős csomagoknál a rendszer PayPal fizetéshez kapcsolódik.',how:'A felhasználó kiválaszt egy csomagot, fizet, majd a rendszer ellenőrzi, hogy a fizetés megtörtént-e.',why:'Ez azért fontos, mert így később eladható szolgáltatásként működhet: ingyenes alap csomag + fizetős PRO funkciók.'},
  csomag:{title:'Automatikus csomagaktiválás',what:'Fizetés után nem kézzel kell átállítani a hozzáférést, hanem a rendszer aktiválja a kiválasztott csomagot.',how:'A csomaghoz időtartam és jogosultság tartozik. Például Starter, Pro vagy Business csomag.',why:'Ez leveszi rólad az adminisztrációt, és profibbá teszi az egész fizetési folyamatot.'},
  adminFizetes:{title:'Admin fizetéskövetés',what:'Az admin látja, ki milyen csomagot használ, mikor aktiválódott, és meddig érvényes.',how:'Az admin áttekintésben megjelennek a fizetések és a felhasználói hozzáférések.',why:'Így könnyebb kezelni az ügyfeleket, reklamációkat, előfizetéseket és jogosultságokat.'},
  projekt:{title:'Projektkezelés',what:'Egy építkezés vagy felújítás külön projektként kezelhető.',how:'A projekten belül lehet naplózni a munkát, képeket feltölteni, anyagokat rögzíteni, riportot készíteni és ügyfélnek küldeni.',why:'Ettől minden munka rendezett lesz: nem Facebook üzenetekben, papíron vagy telefonban szétszórva van az információ.'},
  naplo:{title:'Naplóbejegyzések',what:'A napi munkák külön bejegyzésekben kerülnek mentésre.',how:'Megadható dátum, munkafázis, felelős, státusz, leírás, fotó, anyag, időjárás és GPS/helyadat.',why:'Vita esetén bizonyíték, átadásnál profi dokumentáció, később pedig referenciaanyag.'},
  ai:{title:'AI elemzés',what:'Az AI segít felismerni a kockázatokat, kockázati lehetőségeket és javaslatot adhat a beavatkozásokra.',how:'A rendszer a beírt szövegek, státuszok és fotók alapján készít ügyfélbarát vagy szakmai összefoglalót.',why:'Ez az egyik legnagyobb érték: gyorsabban készül profi szöveg, és az ügyfél is jobban érti, mi történik a munkán.'},
  riport:{title:'Riport előnézet',what:'A rendszer megmutatja, hogyan fog kinézni az ügyfélnek küldhető napló vagy jelentés.',how:'A bejegyzésekből összefoglalót készít: képek, állapot, kockázatok, anyagok, megjegyzések.',why:'Így elküldés előtt átnézhető, hogy minden érthető és vállalható legyen.'},
  foto:{title:'AI fotóelemzés',what:'A képek alapján a rendszer segíthet észrevenni hibákat, hiányosságokat vagy kockázatos részeket.',how:'Feltöltött munkafotók alapján készülhet rövid megállapítás és javaslat.',why:'Ez erős bizonyítási és minőségbiztosítási funkció: előtte/utána állapot, hibák, javítások egy helyen.'},
  koltseg:{title:'Automatikus költségvetés',what:'A rendszer segít becsülni az anyag- és munkadíj jellegű költségeket.',how:'A megadott anyagok, mennyiségek és munkafázisok alapján készülhet egy áttekinthető költséglista.',why:'Ez később külön fizetős PRO funkció lehet, mert gyorsítja az ajánlatadást és az elszámolást.'},
  szamla:{title:'Számla-előkészítés',what:'Nem valódi számlázóprogram, hanem számla vagy díjbekérő előkészítő segédlet.',how:'A projekt adataiból, tételeiből és összegeiből nyomtatható vázlat készíthető.',why:'Segít abban, hogy ne kelljen mindent újra begépelni, és az elszámolás rendezettebb legyen.'},
  upsell:{title:'Fizetős AI riport upsell',what:'Ez a bevételi rész: az alap használat mellé külön megvásárolható AI riport vagy kredit.',how:'A felhasználó kaphat alap funkciókat ingyen, de a komolyabb AI riportért fizethet egyszeri díjat vagy csomagot.',why:'Ettől lehet az ÉpítésNaplóból pénztermelő rendszer, nem csak saját használatú app.'}
};
function openFeatureExplain(key){const data=FEATURE_EXPLAIN[key]; if(!data)return; const modal=document.getElementById('featureExplainModal'); const title=document.getElementById('featureExplainTitle'); const body=document.getElementById('featureExplainBody'); if(!modal||!title||!body)return; title.textContent=data.title; body.innerHTML=`<div class="featureExplainBox"><b>Mit jelent?</b><p>${escapeHtml(data.what)}</p></div><div class="featureExplainBox"><b>Hogyan működik?</b><p>${escapeHtml(data.how)}</p></div><div class="featureExplainBox"><b>Miért hasznos?</b><p>${escapeHtml(data.why)}</p></div><div class="featureExplainTip"><b>PRO üzenet:</b> ezt a magyarázatot az ügyfél és a szakember is érti, ezért csökkenti a félreértést és profibbá teszi a rendszert.</div>`; modal.classList.remove('hidden');}
function closeFeatureExplain(){document.getElementById('featureExplainModal')?.classList.add('hidden');}
document.addEventListener('keydown',(event)=>{if(event.key==='Escape')closeFeatureExplain();});

// ===== V41: okosabb AI, működő admin megtekintés, bejegyzés-kiegészítés =====
(function(){
  const oldAnalyze = analyzeEntry;
  const SMART_RULES = [
    { words:['reped','hasad','süllyed','mozog','statikai'], level:'Magas', title:'Szerkezeti vagy repedési kockázat', advice:['Fotózd mérőszalaggal közelről és távolról.', 'Javítás előtt az okot kell megszüntetni.', 'Visszatérő repedésnél műszaki ellenőr/statikus javasolt.'], materials:['mélyalapozó', 'üvegszövet háló', 'javítóhabarcs'] },
    { words:['beáz','vizes','nedves','penész','salétrom','ázik'], level:'Magas', title:'Nedvesség vagy beázás kockázat', advice:['A víz útját kell először megtalálni.', 'Száradás előtt ne készüljön végleges fedőréteg.', 'Rögzíts fotót, időjárást és pontos helyet.'], materials:['penészlemosó', 'szárítóvakolat', 'vízszigetelő anyag'] },
    { words:['levál','omlik','üreges','potyog','laza'], level:'Közepes', title:'Leváló vagy laza réteg', advice:['Vissza kell bontani stabil alapig.', 'Alapozás/tapadóhíd után javítsd.', 'Átadás előtt kopogtatással ellenőrizd.'], materials:['tapadóhíd', 'javítóhabarcs', 'sarokvédő'] },
    { words:['ferde','eltérés','nem vízszintes','nem függőleges','egyenetlen'], level:'Közepes', title:'Méret- vagy síkpontossági eltérés', advice:['Lézerrel vagy vízmértékkel mérd vissza.', 'Fotózd mérőeszközzel együtt.', 'Rögzítsd, javítandó-e vagy elfogadott.'], materials:['lézeres szintező', 'vízmérték', 'kiegyenlítő anyag'] },
    { words:['kész','átadás','befejez','elkészült'], level:'Alacsony', title:'Átadás közeli állapot', advice:['Készíts előtte/utána fotópárt.', 'Rögzítsd a nyitott kérdéseket.', 'Ügyfélriportban legyen rövid összegzés.'], materials:['átadás-átvételi lista', 'fotódokumentáció'] }
  ];
  const PHASE_TIPS = {
    alapozás:['vasalás/zsaluzat fotó betonozás előtt', 'betonminőség és időjárás rögzítve', 'szintek visszamérve'],
    falazás:['függő és vízszint ellenőrizve', 'áthidalók és kötésrend fotózva', 'anyag/habarcs rögzítve'],
    vakolás:['alapfelület előkészítve', 'sarokvédő/hálózás fotózva', 'száradási körülmény megadva'],
    burkolás:['aljzat és vízszigetelés ellenőrizve', 'ragasztó/fuga típusa rögzítve', 'dilatáció ellenőrizve'],
    festés:['alapozás és glettelés dokumentálva', 'folt/repedés előtte fotózva', 'rétegek és száradás rögzítve']
  };
  function levelScore(level){ return level === 'Magas' ? 86 : level === 'Közepes' ? 58 : 24; }
  analyzeEntry = function(data = {}){
    const base = oldAnalyze(data) || {};
    const text = `${data.note || ''} ${data.phase || ''} ${data.status || ''} ${data.priority || ''}`.toLowerCase();
    const top = SMART_RULES.find(rule => rule.words.some(word => text.includes(word)));
    const phaseKey = Object.keys(PHASE_TIPS).find(key => text.includes(key));
    const checklist = phaseKey ? PHASE_TIPS[phaseKey] : ['legyen fotó dokumentáció', 'legyen felelős és dátum', 'eltérés esetén legyen javítási teendő'];
    const level = top?.level || base.level || 'Alacsony';
    const imageCount = Number(data.imageCount || 0);
    const videoCount = Number(data.videoCount || 0);
    const evidenceScore = Math.max(15, Math.min(100, imageCount * 24 + videoCount * 18 + (data.note ? 22 : 0) + (data.phase ? 10 : 0) + (top ? 14 : 0)));
    const photoTextCheck = imageCount
      ? 'A bejegyzéshez fotó is tartozik, ezért az AI a szöveget és a dokumentáció erejét együtt értékeli.'
      : 'Fotó nélkül az AI csak szöveges előszűrést ad. Bizonyításhoz pótolj legalább egy közelit és egy távoli képet.';
    const advice = [...new Set([...(top?.advice || []), ...(base.advice || []), ...checklist])].slice(0, 6);
    const materials = [...new Set([...(top?.materials || []), ...(base.materials || [])])].slice(0, 8);
    return {
      ...base,
      level,
      score: Math.max(Number(base.score || 0), levelScore(level)),
      title: top?.title || base.title || 'AI dokumentációs ellenőrzés',
      advice,
      repairs: [...new Set([...(base.repairs || []), ...advice.slice(0, 3)])],
      materials,
      checklist,
      evidenceScore,
      photoTextCheck,
      professionalSummary: `${level} kockázati szint. Bizonyíték-erősség: ${evidenceScore}%. ${advice[0] || ''}`,
      nextStep: advice[0] || 'Rögzíts fotót és következő teendőt.',
      customerSummary: `AI ellenőrzés: ${level}. ${advice[0] || 'A bejegyzés dokumentálva van.'}`
    };
  };
  function entryAnalysis(entry){
    return entry.analysis || entry.ai_json || analyzeEntry({ note: entry.note || '', phase: entry.phase || '', status: entry.status || '', priority: entry.priority || '' });
  }
  function smartEntryBox(entry){
    const a = entryAnalysis(entry);
    return `<div class="aiSmartSummary"><b>Okos AI:</b><p>${escapeHtml(a.customerSummary || a.title || '')}</p>${(a.advice || []).length ? `<ul>${a.advice.slice(0,3).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  function ensureSupplementModalMain(){
    let modal = document.getElementById('supplementModalV42');
    if(modal) return modal;
    modal = document.createElement('div');
    modal.id = 'supplementModalV42';
    modal.className = 'modal hidden';
    modal.innerHTML = `<div class="modalContent supplementModalContent">
      <button class="closeBtn" type="button" onclick="closeSupplementModalV42()">×</button>
      <p class="badge">Napló kiegészítés</p>
      <h2>Kiegészítés hozzáadása</h2>
      <textarea id="supplementTextV42" rows="5" placeholder="Mit szeretnél hozzáírni ehhez a bejegyzéshez?"></textarea>
      <label class="uploadBox"><b>Képek hozzáadása</b><span>Fotó vagy részletkép</span><input id="supplementImagesV42" type="file" accept="image/*" multiple /></label>
      <label class="uploadBox"><b>Videók hozzáadása</b><span>Rövid munkavideó</span><input id="supplementVideosV42" type="file" accept="video/*" multiple /></label>
      <div id="supplementStatusV42" class="v32UploadStatus hidden"></div>
      <button class="btn primary full" type="button" onclick="saveSupplementModalV42()">Kiegészítés mentése</button>
    </div>`;
    document.body.appendChild(modal);
    return modal;
  }
  window.closeSupplementModalV42 = function(){ document.getElementById('supplementModalV42')?.classList.add('hidden'); };
  window.addEntrySupplementMain = function(entryId){
    const entry = (state.entries || []).find(e => String(e.id) === String(entryId));
    if(!entry) return alert('Bejegyzés nem található.');
    const modal = ensureSupplementModalMain();
    modal.dataset.entryId = entryId;
    document.getElementById('supplementTextV42').value = '';
    document.getElementById('supplementImagesV42').value = '';
    document.getElementById('supplementVideosV42').value = '';
    document.getElementById('supplementStatusV42').classList.add('hidden');
    modal.classList.remove('hidden');
  };
  window.saveSupplementModalV42 = async function(){
    const modal = ensureSupplementModalMain();
    const entryId = modal.dataset.entryId;
    const entry = (state.entries || []).find(e => String(e.id) === String(entryId));
    if(!entry) return alert('Bejegyzés nem található.');
    const text = document.getElementById('supplementTextV42')?.value.trim() || '';
    const imgFiles = document.getElementById('supplementImagesV42')?.files || [];
    const vidFiles = document.getElementById('supplementVideosV42')?.files || [];
    if(!text && !imgFiles.length && !vidFiles.length) return alert('Adj meg szöveget, képet vagy videót.');
    const status = document.getElementById('supplementStatusV42');
    status.className = 'v32UploadStatus info';
    status.classList.remove('hidden');
    status.innerHTML = '<b>Kiegészítés mentése...</b><br>Képek és videók feldolgozása.';
    try {
      const images = await readFilesAsDataUrls(imgFiles, 8);
      const videos = await uploadVideoFilesToStorage(vidFiles, entry.project_id || entry.projectId, 3);
      if (vidFiles.length && !videos.length) throw new Error('A videó nem lett feltöltve. Futtasd a V44 SQL-t, majd próbáld újra.');
      const supplementText = text || `${images.length ? images.length + ' kép' : ''}${images.length && videos.length ? ', ' : ''}${videos.length ? videos.length + ' videó' : ''} hozzáadva.`;
      const analysis = analyzeEntry({
        note: `${entry.note || ''}\n${supplementText}`,
        phase: entry.phase || '',
        status: entry.status || '',
        priority: entry.priority || '',
        imageCount: getEntryImages(entry).length + images.length,
        videoCount: getEntryVideos(entry).length + videos.length
      });
      const saved = await window.EpitesNaploAPI.appendEntrySupplement(entryId, supplementText, analysis, { images, videos });
      Object.assign(entry, saved, {
        images: Array.isArray(saved.image_urls) ? saved.image_urls : getEntryImages(entry).concat(images),
        videoUrls: Array.isArray(saved.video_urls) ? saved.video_urls : getEntryVideos(entry).concat(videos),
        analysis: saved.ai_json || analysis
      });
      await hydratePrivateVideoUrls([entry]);
      renderEntries();
      updateReport();
      closeSupplementModalV42();
      showToast('Kiegészítés mentve képpel/videóval.', 'ok');
    } catch (err) {
      status.className = 'v32UploadStatus error';
      status.innerHTML = `<b>Kiegészítés mentési hiba.</b><br>${escapeHtml(err.message || err)}`;
    }
  };
  window.runSmartEntryAiMain = function(entryId){
    const entry = (state.entries || []).find(e => String(e.id) === String(entryId));
    if(!entry) return;
    const a = analyzeEntry({ note: entry.note || '', phase: entry.phase || '', status: entry.status || '', priority: entry.priority || '' });
    alert(`${a.title}\n\n${(a.advice || []).join('\n')}\n\nAnyag/eszköz: ${(a.materials || []).join(', ') || 'nincs külön javaslat'}`);
  };
  const oldAdminViewUser = adminViewUser;
  adminViewUser = async function(userId){
    try {
      showToast('Felhasználó adatai betöltése...', 'info');
      await oldAdminViewUser.apply(this, arguments);
      const box = document.getElementById('activeProjectHint');
      if(box && state.adminViewingUser){
        box.classList.remove('hidden');
        box.innerHTML = `<b>Admin megtekintés:</b> ${escapeHtml(state.adminViewingUser.email || state.adminViewingUser.full_name || 'felhasználó')} <button class="btn small ghost" type="button" onclick="adminBackToOwnView()">Saját nézet vissza</button>`;
      }
    } catch (err) {
      alert('Megnézés hiba: ' + (err.message || err));
    }
  };
  renderEntries = function() {
    const dateFilter = document.getElementById('dateFilter')?.value || '';
    const riskFilter = document.getElementById('riskFilter')?.value || 'all';
    let entries = [...state.entries];
    if (dateFilter) entries = entries.filter(entry => (entry.created_at ? new Date(entry.created_at).toISOString().slice(0, 10) : '') === dateFilter);
    if (riskFilter !== 'all') entries = entries.filter(entry => (entryAnalysis(entry).level || entry.ai_level || 'Alacsony') === riskFilter);
    document.getElementById('entryList').innerHTML = entries.map(entry => {
      const a = entryAnalysis(entry);
      const level = a.level || entry.ai_level || 'Alacsony';
      const levelClass = level === 'Magas' ? 'bad' : level === 'Közepes' ? 'warn' : 'ok';
      const images = getEntryImages(entry);
      const videos = getEntryVideos(entry);
      return `<div class="photoCard">
        ${images.length ? `<div class="entryImageGrid">${images.map(src => renderMediaImage(src, 'Építési fotó')).join('')}</div>` : ''}
        ${videos.length ? `<div class="entryVideoGrid">${videos.map(v => renderMediaVideo(v, 'Munkavideó')).join('')}</div>` : ''}
        <div class="photoCardBody">
          <b>${escapeHtml(projectName(entry.project_id || entry.projectId))}</b>
          <small>${formatDate(entry.created_at)}${images.length ? ' • ' + images.length + ' fotó' : ''}${videos.length ? ' • ' + videos.length + ' videó' : ''}</small>
          <p>${escapeHtml(entry.note)}</p>
          <span class="tag ai">AI: ${escapeHtml(level)}</span><span class="tag ${levelClass}">${escapeHtml(a.title || entry.ai_title || 'Elemzés')}</span><span class="tag">${escapeHtml(entry.phase)}</span><span class="tag">${escapeHtml(entry.status)}</span>
          <small>Felelős: ${escapeHtml(entry.responsible || 'Nincs megadva')} • ${escapeHtml(entry.weather || '')}</small>
          ${smartEntryBox(entry)}
          <div class="entryActions"><button class="btn small primary" type="button" onclick="addEntrySupplementMain('${entry.id}')">➕ Kiegészítés hozzáadása</button><button class="btn small ghost" type="button" onclick="runSmartEntryAiMain('${entry.id}')">AI újraelemzés</button></div>
        </div>
      </div>`;
    }).join('') || '<p class="muted">Nincs bejegyzés a kiválasztott szűrés alapján.</p>';
  };
})();

// ===== V32 PROFI UGYFELRIPORT: atadasi nezet, kategoriak, jovahagyas kovetes =====
function v32EntryMedia(entry) {
  const before = Array.isArray(entry.beforeImages) && entry.beforeImages.length
    ? entry.beforeImages
    : (Array.isArray(entry.ai_json?.beforeImages) ? entry.ai_json.beforeImages : []);
  const after = Array.isArray(entry.afterImages) && entry.afterImages.length
    ? entry.afterImages
    : (Array.isArray(entry.ai_json?.afterImages) ? entry.ai_json.afterImages : []);
  const generalSaved = Array.isArray(entry.generalImages) && entry.generalImages.length
    ? entry.generalImages
    : (Array.isArray(entry.ai_json?.generalImages) ? entry.ai_json.generalImages : []);
  const allImages = getEntryImages(entry);
  const known = new Set([...before, ...after, ...generalSaved]);
  const general = generalSaved.length ? generalSaved : allImages.filter(src => !known.has(src));
  return { before, after, general, videos: getEntryVideos(entry) };
}

function v32MediaGroup(title, items, type = 'image') {
  if (!items.length) return '';
  const media = type === 'video'
    ? items.map(v => renderPublicReportVideo(v, title)).join('')
    : items.map(src => renderMediaImage(src, title)).join('');
  return `<div class="v32MediaGroup"><h5>${escapeHtml(title)}</h5><div class="${type === 'video' ? 'entryVideoGrid' : 'reportImageGrid'}">${media}</div></div>`;
}

function v32CustomerSummary(project, entries, tasks) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const risky = safeEntries.filter(e => (e.analysis?.level || e.ai_level) === 'Magas');
  const review = safeEntries.filter(e => String(e.status || '').toLowerCase().includes('ellen'));
  const last = [...safeEntries].sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  const text = v54TextPool(project, safeEntries);
  const status = risky.length ? 'külön ellenőrzést igényel' : review.length ? 'ellenőrzés alatt van' : 'rendben halad';
  const workLabel = v54IsPavingMirrorWork(text) ? 'A térkő alatti tükörkészítés dokumentálása' : `A(z) ${project?.name || 'projekt'} jelenlegi állapota`;
  return `${workLabel}: ${status}. Összesen ${safeEntries.length} naplóbejegyzés, ${safeTasks.length} nyitott teendő és ${risky.length} magas kockázatú jelzés szerepel a riportban.${last ? ' Utolsó dokumentált munka: ' + formatDate(last.created_at) + '.' : ''}`;
}

function v32BuildShareMessage(project, link) {
  return `Szia!\n\nElkeszult a(z) ${project?.name || ''} epitesi naplo ugyfelriportja.\n\nA linken meg tudod nezni a munkafotoket, munkavideokat, napi bejegyzeseket, nyitott teendoket es a jelenlegi allapotot:\n${link || '[ugyfel link]'}\n\nHa mindent rendben talalsz, a riport aljan jovahagyhatod a megtekintest.\n\nUdvozlettel:\n${displayOwnerName()}`;
}

function v32InjectClientReportTools() {
  const section = document.getElementById('ugyfel-riport');
  const preview = document.getElementById('clientReportPreview');
  if (!section || !preview || document.getElementById('v32ClientReportTools')) return;
  const tools = document.createElement('div');
  tools.id = 'v32ClientReportTools';
  tools.className = 'v32ClientTools';
  tools.innerHTML = `
    <div class="v32ToolHead">
      <div><b>Profi atadasi riport</b><span>Ugyfelbarat osszegzes, media kategoriak, jovahagyasi kovetes.</span></div>
      <button class="btn ghost small" type="button" onclick="v32PrepareCustomerMessage()">Ugyfel uzenet elokeszitese</button>
    </div>
    <div id="clientReportStatus" class="v32StatusGrid">
      <div><b>0</b><span>megnyitas</span></div>
      <div><b>0</b><span>jovahagyas</span></div>
      <div><b>-</b><span>utolso link</span></div>
    </div>
    <textarea id="v32CustomerMessage" class="v32MessageBox" placeholder="Itt jelenik meg az ugyfelnek kuldheto uzenet."></textarea>
  `;
  preview.before(tools);
}

async function v32RefreshClientReportStatus(projectId) {
  const box = document.getElementById('clientReportStatus');
  if (!box) return;
  let approvals = [];
  try { approvals = await window.EpitesNaploAPI.getReportApprovals(projectId); } catch (_) {}
  const approvedAt = approvals[0]?.approved_at ? formatDate(approvals[0].approved_at) : 'nincs';
  box.innerHTML = `
    <div><b>${state.lastClientReportLink ? 'kesz' : '-'}</b><span>utolso link</span></div>
    <div><b>${approvals.length}</b><span>jovahagyas</span></div>
    <div><b>${escapeHtml(approvedAt)}</b><span>utolso jovahagyas</span></div>
  `;
}

function v32PrepareCustomerMessage() {
  const projectId = selectedClientProjectId();
  const project = state.projects.find(p => p.id === projectId);
  const box = document.getElementById('v32CustomerMessage');
  if (!projectId) return alert('Elobb valassz projektet.');
  if (box) {
    box.value = v32BuildShareMessage(project, state.lastClientReportLink || '');
    box.focus();
  }
}

const v32OldBuildClientReportHtml = buildClientReportHtml;
function v51ReportNoteHtml(note) {
  const raw = String(note || '').trim();
  if (!raw) return '<p class="v51ReportNote empty">Nincs külön szöveges leírás.</p>';
  const lines = raw
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 18);
  if (lines.length > 1) {
    return `<div class="v51ReportNote"><b>Szöveges leírás</b><ul>${lines.map(line => `<li>${escapeHtml(line.replace(/^[-•]\s*/, ''))}</li>`).join('')}</ul></div>`;
  }
  const chunks = raw
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ0-9])/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 8);
  return `<div class="v51ReportNote"><b>Szöveges leírás</b>${chunks.length > 1 ? `<ul>${chunks.map(part => `<li>${escapeHtml(part)}</li>`).join('')}</ul>` : `<p>${escapeHtml(raw)}</p>`}</div>`;
}
buildClientReportHtml = function(project, entries, tasks) {
  const today = new Date().toLocaleDateString('hu-HU');
  const highRisk = entries.filter(e => (e.analysis?.level || e.ai_level) === 'Magas').length;
  const review = entries.filter(e => String(e.status || '').toLowerCase().includes('ellen')).length;
  const photoCount = entries.reduce((sum, e) => sum + getEntryImages(e).length, 0);
  const videoCount = entries.reduce((sum, e) => sum + getEntryVideos(e).length, 0);
  const budget = buildBudgetSummary(entries, tasks, project);
  const entryHtml = entries.map(entry => {
    const level = entry.analysis?.level || entry.ai_level || 'Alacsony';
    const title = entry.analysis?.title || entry.ai_title || 'Elemzes';
    const advice = entry.analysis?.advice || [];
    const repairs = entry.analysis?.repairs || [];
    const materials = entry.analysis?.materials || entry.materials_json || [];
    const media = v32EntryMedia(entry);
    return `
      <article class="clientReportEntry v32ReportEntry">
        <div class="v32EntryTop">
          <div><b>${formatDate(entry.created_at)} - ${escapeHtml(entry.phase || 'Napi bejegyzes')}</b><small>${escapeHtml(entry.responsible || 'Felelos nincs megadva')} - ${escapeHtml(entry.weather || '')}</small></div>
          <span class="tag ${level === 'Magas' ? 'bad' : (level === 'Kozepes' || level === 'Közepes') ? 'warn' : 'ok'}">${escapeHtml(level)}</span>
        </div>
        ${v51ReportNoteHtml(entry.note)}
        <p><b>Allapot:</b> ${escapeHtml(entry.status || '')} - <b>AI jelzes:</b> ${escapeHtml(title)}</p>
        ${advice.length ? `<div class="v32CustomerAdvice"><b>Ugyfelbarat magyarazat</b><ul>${advice.slice(0,3).map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>` : ''}
        ${repairs.length ? `<div class="aiAdviceBox"><b>Javitasi javaslat</b><ul>${repairs.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>` : ''}
        ${Array.isArray(materials) && materials.length ? `<p><b>Anyag / eszkoz javaslat:</b> ${materials.map(m => escapeHtml(typeof m === 'object' ? `${m.name || ''} ${m.quantity || ''} ${m.unit || ''}` : m)).join(', ')}</p>` : ''}
        ${v32MediaGroup('Elotte fotok', media.before)}
        ${v32MediaGroup('Munka kozben / dokumentacio', media.general)}
        ${v32MediaGroup('Utana fotok', media.after)}
        ${v32MediaGroup('Munkavideok', media.videos, 'video')}
      </article>
    `;
  }).join('');

  const taskHtml = tasks.map(t => `<li>${escapeHtml(t.title)} - felelos: ${escapeHtml(t.owner || 'nincs megadva')}</li>`).join('');
  return `
    <section class="v32ReportCover">
      <div>
        <span class="statusPill">Atadasra kesz ugyfelriport</span>
        <h2>${escapeHtml(project?.name || 'Epitesi projekt')}</h2>
        <p>${escapeHtml(v32CustomerSummary(project, entries, tasks))}</p>
      </div>
      <div class="v32ReportMeta">
        <b>${escapeHtml(displayOwnerName())}</b>
        <span>Keszites datuma: ${today}</span>
        <span>Dokumentacio: EpitesNaplo AI PRO</span>
      </div>
    </section>
    <div class="reportGrid compactReportStats v32ReportStats">
      <div><b>${entries.length}</b><span>naplobejegyzes</span></div>
      <div><b>${photoCount}</b><span>foto</span></div>
      <div><b>${videoCount}</b><span>video</span></div>
      <div><b>${tasks.length}</b><span>nyitott teendo</span></div>
      <div><b>${highRisk}</b><span>magas kockazat</span></div>
      <div><b>${review}</b><span>ellenorzes</span></div>
    </div>
    <section class="v32ExecutiveSummary">
      <h3>Rovid ugyfel osszegzes</h3>
      <p>${escapeHtml(v32CustomerSummary(project, entries, tasks))}</p>
      <p><b>Koltseg / ellenorzesi tartalek:</b> ${money(budget.total)}</p>
    </section>
    <h3>${budget.isPavingMirror ? 'Tükörkészítés szakmai ellenőrzési pontjai' : 'Anyaglista és költségbecslés'}</h3>
    ${budget.html}
    ${tasks.length ? `<h3>Nyitott teendok / ellenorzesek</h3><ul>${taskHtml}</ul>` : '<p class="v32OkLine">Nincs nyitott teendojegy.</p>'}
    <h3>Napi dokumentacio</h3>
    ${entryHtml || '<p>Meg nincs naplobejegyzes ehhez a projekthez.</p>'}
    <section class="signatureBox v32Signature"><b>Ugyfel megtekintes / jovahagyas:</b><br><br><span>............................................................</span><p class="muted">Online linknel az ugyfel a riport aljan digitalisan is rogzithet megtekintest.</p></section>
  `;
};

const v32OldGenerateClientReport = generateClientReport;
generateClientReport = function() {
  v32OldGenerateClientReport.apply(this, arguments);
  const projectId = selectedClientProjectId();
  v32RefreshClientReportStatus(projectId);
  v32PrepareCustomerMessage();
};

const v32OldCreateAndCopyClientLink = createAndCopyClientLink;
createAndCopyClientLink = async function() {
  await v32OldCreateAndCopyClientLink.apply(this, arguments);
  const projectId = selectedClientProjectId();
  const project = state.projects.find(p => p.id === projectId);
  const box = document.getElementById('v32CustomerMessage');
  if (box) box.value = v32BuildShareMessage(project, state.lastClientReportLink || '');
  await v32RefreshClientReportStatus(projectId);
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(v32InjectClientReportTools, 350);
});

// ===== V33: ceges logo, AI ugyfelszoveg, tarhely es archivum a riporthoz =====
function v33GetCompanyLogo() {
  try { return localStorage.getItem('epitesnaplo_company_logo') || ''; } catch (_) { return ''; }
}

function v33LogoHtml() {
  const logo = v33GetCompanyLogo();
  return logo ? `<img class="v33ReportLogoImg" src="${escapeHtml(logo)}" alt="Ceges logo" />` : '';
}

function v33HandleLogoUpload(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (!String(file.type || '').startsWith('image/')) return alert('Logohoz kepfajlt valassz.');
  const reader = new FileReader();
  reader.onload = () => {
    try { localStorage.setItem('epitesnaplo_company_logo', reader.result); } catch (_) {}
    showToast('Ceges logo mentve. A kovetkezo PDF riport boritojan megjelenik.', 'ok');
    generateClientReport();
  };
  reader.readAsDataURL(file);
}

function v33FriendlyCustomerText(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  let prefix = 'A mai munkafolyamat dokumentalva lett.';
  if (/vizes|nedves|beazas|penesz|azik/.test(lower)) prefix = 'A fal vagy felulet szaradasa es ellenorzese folyamatban van.';
  if (/reped|hasad/.test(lower)) prefix = 'A lathato repedes dokumentalva lett, a kovetkezo lepes az ok ellenorzese es a javitasi mod meghatarozasa.';
  if (/glett|fest|vakol/.test(lower)) prefix = 'A felulet elokeszitese folyamatban van, a kovetkezo munkafazis a felulet veglegesitese.';
  if (/kesz|atadas|befejez/.test(lower)) prefix = 'Az adott munkafazis elkeszult, a dokumentacio atadasra es ellenorzesre alkalmas.';
  return `${prefix}\n\nUgyfelnek szant osszegzes: ${text.replace(/\s+/g, ' ')}\n\nKovetkezo lepes: a munkat fotokkal/videoval vissza lehet ellenorizni, es szukseg eseten a riport aljan kerdes vagy jovahagyas rogzitheto.`;
}

function v33GenerateCustomerText() {
  const raw = document.getElementById('v33RawCustomerNote')?.value || '';
  const out = document.getElementById('v33FriendlyCustomerText');
  if (!out) return;
  out.value = v33FriendlyCustomerText(raw);
  out.focus();
}

function v33InjectClientTools() {
  const tools = document.getElementById('v32ClientReportTools');
  if (!tools || document.getElementById('v33ClientTools')) return;
  const extra = document.createElement('div');
  extra.id = 'v33ClientTools';
  extra.className = 'v33ClientTools';
  extra.innerHTML = `
    <div class="v33LogoTool">
      <b>Ceges logo a PDF boritora</b>
      <input type="file" accept="image/*" onchange="v33HandleLogoUpload(this)" />
      <small class="muted">A logo ezen a gepen mentodik, es a kovetkezo ugyfelriport/PDF boritojan megjelenik.</small>
    </div>
    <div class="v33AiWriter">
      <b>AI ugyfelbarat szovegiro</b>
      <textarea id="v33RawCustomerNote" placeholder="Nyers jegyzet, pl. fal vizes, gletteles holnap"></textarea>
      <button class="btn ghost full" type="button" onclick="v33GenerateCustomerText()">Ugyfelbarat szoveg keszitese</button>
      <textarea id="v33FriendlyCustomerText" placeholder="Itt jelenik meg az ugyfelnek kuldheto szoveg."></textarea>
    </div>
  `;
  tools.appendChild(extra);
}

function v33NextSteps(entries, tasks) {
  const risky = entries.filter(e => (e.analysis?.level || e.ai_level) === 'Magas');
  const openTasks = tasks.filter(t => !t.done);
  const steps = [];
  if (risky.length) steps.push('Magas kockazatu bejegyzes ellenorzese es fotoval/video dokumentalasa.');
  if (openTasks.length) steps.push('Nyitott teendok lezarsa vagy hatarido egyeztetese.');
  if (!entries.some(e => getEntryVideos(e).length)) steps.push('Rovid munkavideo keszitese az atadas elott.');
  steps.push('Ugyfel visszajelzes rogzitese: Megneztem / Elfogadom / Kerdesem van.');
  return `<section class="v33NextSteps"><h3>Kovetkezo lepesek</h3><ol>${steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol></section>`;
}

function v33IssueSection(entries) {
  const issues = entries.filter(e => (e.analysis?.level || e.ai_level) === 'Magas' || String(e.status || '').toLowerCase().includes('javit'));
  const fixes = entries.filter(e => /kesz|javitas|ut[aá]na|befejez/i.test(String(e.status || '') + ' ' + String(e.note || '')));
  return `
    <section class="v33StoryBlocks">
      <div><h3>Hiba / ellenorzes</h3>${issues.length ? `<ul>${issues.slice(0,6).map(e => `<li>${formatDate(e.created_at)} - ${escapeHtml(e.phase || '')}: ${escapeHtml((e.note || '').slice(0,140))}</li>`).join('')}</ul>` : '<p>Nincs kiemelt hiba rogzitve.</p>'}</div>
      <div><h3>Javitas / atadas</h3>${fixes.length ? `<ul>${fixes.slice(0,6).map(e => `<li>${formatDate(e.created_at)} - ${escapeHtml(e.phase || '')}</li>`).join('')}</ul>` : '<p>A javitasi vagy atadasi allapot a naplobejegyzesekben kovetheto.</p>'}</div>
    </section>
  `;
}

const v33OldBuildClientReportHtml = buildClientReportHtml;
buildClientReportHtml = function(project, entries, tasks) {
  let html = v33OldBuildClientReportHtml(project, entries, tasks);
  const logo = v33LogoHtml();
  if (logo) {
    html = html.replace('<section class="v32ReportCover">', `<section class="v32ReportCover v33ReportCover"><div class="v33ReportLogo">${logo}</div>`);
  }
  html = html.replace('<h3>Napi dokumentacio</h3>', `${v33NextSteps(entries, tasks)}${v33IssueSection(entries)}<h3>Napi dokumentacio</h3>`);
  return html;
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(v33InjectClientTools, 650);
});


// V35 biztosító inicializálás: ha a főoldali űrlap már betöltött, az Egyéb mező azonnal működik.
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initCustomWorkPhaseV35, 300);
  setTimeout(initCustomWorkPhaseV35, 1000);
});

// ===== V37: főoldali képfeltöltési kosár + auth villanás csökkentés + részletes projektirány =====
(function(){
  function q(id){ return document.getElementById(id); }
  function fileKey(file){ return [file.name, file.size, file.lastModified, file.type].join('|'); }
  window.v37MainFileBaskets = window.v37MainFileBaskets || {};
  function syncInput(id){
    const input = q(id); if(!input) return;
    const dt = new DataTransfer();
    (window.v37MainFileBaskets[id] || []).forEach(f => dt.items.add(f));
    input.files = dt.files;
  }
  function renderBasket(id){
    const input = q(id); if(!input) return;
    let box = q(id + 'BasketPreview');
    if(!box){
      box = document.createElement('div');
      box.id = id + 'BasketPreview';
      box.className = 'uploadBasketPreview';
      input.insertAdjacentElement('afterend', box);
    }
    const files = window.v37MainFileBaskets[id] || [];
    if(!files.length){ box.innerHTML = ''; return; }
    box.innerHTML = files.map((file, idx) => {
      const isImg = String(file.type || '').startsWith('image/');
      const url = isImg ? URL.createObjectURL(file) : '';
      return `<div class="uploadBasketItem">${isImg ? `<img src="${url}" alt="${file.name}">` : `<div class="fileIcon">VID</div>`}<button type="button" data-main-basket-id="${id}" data-main-basket-idx="${idx}">×</button><span>${file.name.length > 18 ? file.name.slice(0,15)+'...' : file.name}</span></div>`;
    }).join('');
  }
  function initBasket(id){
    const input = q(id); if(!input || input.dataset.v37Basket === '1') return;
    input.dataset.v37Basket = '1';
    window.v37MainFileBaskets[id] = window.v37MainFileBaskets[id] || [];
    input.addEventListener('change', () => {
      const old = window.v37MainFileBaskets[id] || [];
      const map = new Map(old.map(f => [fileKey(f), f]));
      Array.from(input.files || []).forEach(f => map.set(fileKey(f), f));
      window.v37MainFileBaskets[id] = Array.from(map.values());
      syncInput(id); renderBasket(id);
    });
  }
  window.v37ClearMainBasket = function(id){
    window.v37MainFileBaskets[id] = [];
    const input = q(id); if(input) input.value = '';
    renderBasket(id);
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-main-basket-id]');
    if(!btn) return;
    const id = btn.dataset.mainBasketId;
    const idx = Number(btn.dataset.mainBasketIdx);
    const arr = window.v37MainFileBaskets[id] || [];
    arr.splice(idx, 1);
    window.v37MainFileBaskets[id] = arr;
    syncInput(id); renderBasket(id);
  });
  window.v37InitMainBaskets = function(){ initBasket('entryFile'); };
  document.addEventListener('DOMContentLoaded', () => { setTimeout(window.v37InitMainBaskets, 300); setTimeout(() => document.body.classList.remove('auth-loading'), 900); });

  const oldAddEntry = window.addEntry;
  if(typeof oldAddEntry === 'function'){
    window.addEntry = async function(){
      window.v37InitMainBaskets?.();
      syncInput('entryFile');
      await oldAddEntry.apply(this, arguments);
      window.v37ClearMainBasket('entryFile');
    };
  }

  const oldAddProject = window.addProject;
  if(typeof oldAddProject === 'function'){
    window.addProject = async function(){
      const before = (state.projects || []).length;
      await oldAddProject.apply(this, arguments);
      const newest = state.projects && state.projects[0];
      if(newest && (state.projects || []).length > before){
        const open = confirm('Projekt létrejött. Megnyitod a részletes projekt napló oldalt? Itt lesz cím, biztonságos GPS, fotó/videó kosár és ügyfélriport.');
        if(open) window.location.href = `project.html?id=${encodeURIComponent(newest.id)}`;
      }
    };
  }
})();

// ===== V38: letisztított főoldal + vendég zárolás =====
function showGuestLockV38(message){
  const msg = message || 'A funkció használatához regisztráció szükséges.';
  let modal = document.getElementById('guestLockModalV38');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'guestLockModalV38';
    modal.className = 'modal hidden';
    modal.innerHTML = `<div class="modalContent v38LockBox"><button class="closeBtn" onclick="document.getElementById('guestLockModalV38').classList.add('hidden')">×</button><h2>🔒 Regisztráció szükséges</h2><p id="guestLockTextV38" class="muted"></p><div class="notice">Regisztráció után 1 hétig ingyen kipróbálhatod az alap naplózást 1 projekttel.</div><div class="heroActions"><button class="btn primary" onclick="document.getElementById('guestLockModalV38').classList.add('hidden'); openAuthModal(); setAuthMode('register');">Regisztráció</button><button class="btn ghost" onclick="document.getElementById('guestLockModalV38').classList.add('hidden'); openAuthModal(); setAuthMode('login');">Belépés</button></div></div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('guestLockTextV38').textContent = msg;
  modal.classList.remove('hidden');
}
function requireLoginV38(message){
  if(state.user) return true;
  showGuestLockV38(message);
  return false;
}
(function(){
  const guarded = ['addTask','generateClientReport','downloadClientReportPdf','createAndCopyClientLink','copyClientShareLink','sendClientNotification','runAiPhotoRecognition','generateAutoBudget','generateInvoiceDraft','preparePaidAiReportOffer','copyReport','copyClientReport','createShareText'];
  guarded.forEach(name => {
    const old = window[name];
    if(typeof old === 'function'){
      window[name] = function(){
        if(!requireLoginV38('A funkció használatához regisztráció szükséges.')) return;
        return old.apply(this, arguments);
      };
    }
  });
  document.addEventListener('click', (e) => {
    if(state.user) return;
    const target = e.target.closest('button, a, input, select, textarea');
    if(!target) return;
    if(target.closest('#authModal') || target.closest('#guestLockModalV38') || target.closest('#subscription') || target.id === 'heroRegisterBtn') return;
    const href = target.getAttribute && target.getAttribute('href');
    if(href && (href.startsWith('#home') || href.startsWith('#subscription') || href.startsWith('index.html#home') || href.startsWith('index.html#subscription'))) return;
    if(target.matches('input, select, textarea') || target.onclick || target.tagName === 'BUTTON'){
      e.preventDefault();
      e.stopPropagation();
      showGuestLockV38('A funkció használatához regisztráció szükséges.');
    }
  }, true);
})();
