const detailState = {
  user: null,
  project: null,
  entries: [],
  tasks: []
};

function qs(id) { return document.getElementById(id); }
function normalizeUserText(value) {
  return String(value || '')
    .replaceAll('Ellenőrzési tartalék', 'Ellenőrzési tartalék')
    .replaceAll('Ellenőrzési tartalék', 'Ellenőrzési tartalék')
    .replaceAll('Ellenőrzés rendben', 'Ellenőrzés rendben')
    .replaceAll('nincs komoly hiba gyanú', 'ellenőrzés rendben')
    .replaceAll('nincs kiemelt kockázat', 'nincs kiemelt kockázat')
    .replaceAll('Nincs kiemelt hiba', 'Nincs kiemelt kockázat');
}
function escapeHtml(value) {
  return normalizeUserText(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function formatDate(value) {
  if (!value) return 'Nincs dátum';
  try { return new Date(value).toLocaleString('hu-HU'); } catch (_) { return value; }
}
function showToast(message, type = 'ok') {
  const toast = qs('toast');
  if (!toast) return alert(message);
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('hidden'), 3200);
}
function getProjectId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || params.get('project') || '';
}
function getEntryImages(entry) {
  if (Array.isArray(entry.images)) return entry.images.filter(Boolean);
  if (Array.isArray(entry.image_urls)) return entry.image_urls.filter(Boolean);
  if (entry.image_url) return [entry.image_url];
  if (entry.image) return [entry.image];
  return [];
}

function getEntryVideos(entry) {
  const fromAnalysis = entry.analysis?.videos || entry.analysis?.videoUrls || entry.ai_json?.videos || entry.ai_json?.videoUrls;
  if (Array.isArray(entry.videos)) return entry.videos.filter(Boolean);
  if (Array.isArray(entry.videoUrls)) return entry.videoUrls.filter(Boolean);
  if (Array.isArray(entry.video_urls)) return entry.video_urls.filter(Boolean);
  if (Array.isArray(fromAnalysis)) return fromAnalysis.filter(Boolean);
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

function renderMediaImage(src, alt = 'Napló fotó') {
  const safeSrc = escapeHtml(src);
  const safeAlt = escapeHtml(alt);
  return `<figure class="mediaTile mediaTileImage"><img class="openableMedia" src="${safeSrc}" alt="${safeAlt}" ${mediaClick('image', alt)} /><figcaption class="mediaTileActions"><button class="btn mini mediaExpandBtn" type="button" onclick="openMediaViewerFromTile(this, 'image', '${safeAlt}')">Nagy nézet</button></figcaption></figure>`;
}

function renderMediaVideo(video, title = 'Munkavideó') {
  const src = typeof video === 'object' ? (video.src || '') : video;
  const safeSrc = escapeHtml(src);
  const pathAttr = video && typeof video === 'object' && video.path ? ` data-video-path="${escapeHtml(video.path)}"` : '';
  return `<figure class="mediaTile mediaTileVideo"><video class="openableMedia" controls playsinline preload="metadata" src="${safeSrc}"${pathAttr} onloadedmetadata="this.muted=false;this.volume=1"></video><figcaption class="mediaTileActions"><button class="btn mini mediaExpandBtn" type="button" onclick="openMediaViewerFromTile(this, 'video', '${escapeHtml(title)}')">Nagy nézet</button></figcaption></figure>`;
}

function openMediaViewerFromTile(button, type = 'image', title = '') {
  const tile = button?.closest?.('.mediaTile');
  const media = tile?.querySelector?.('img,video');
  const src = media?.currentSrc || media?.src || '';
  openMediaViewer(src, type, title);
}
window.openMediaViewerFromTile = openMediaViewerFromTile;

function mediaDocumentHtml(src, type = 'image', title = '') {
  const safeSrc = escapeHtml(src);
  const safeTitle = escapeHtml(title || (type === 'video' ? 'Munkavideó' : 'Napló fotó'));
  const media = type === 'video'
    ? `<video controls autoplay playsinline src="${safeSrc}"></video>`
    : `<img src="${safeSrc}" alt="${safeTitle}" />`;
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>body{margin:0;background:#020617;color:#fff;font-family:Arial,sans-serif}.top{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:#0f172a}.top a{color:#fbbf24;font-weight:800}.stage{height:calc(100vh - 54px);display:grid;place-items:center;padding:12px;box-sizing:border-box}img,video{max-width:100%;max-height:100%;object-fit:contain;border-radius:10px;background:#000}</style></head><body><div class="top"><b>${safeTitle}</b><a href="${safeSrc}" download>Letöltés</a></div><div class="stage">${media}</div></body></html>`;
}
function openMediaInNewTab(src, type = 'image', title = '') {
  const mediaSrc = String(src || '');
  if (!mediaSrc) return false;
  const tab = window.open('', '_blank', 'noopener,noreferrer');
  if (!tab) {
    alert('A böngésző blokkolta az új lapot. Engedélyezd a felugró ablakot ehhez az oldalhoz.');
    return false;
  }
  tab.document.open();
  tab.document.write(mediaDocumentHtml(mediaSrc, type, title));
  tab.document.close();
  return false;
}
function openReportMediaLink(event, link) {
  if (event) event.preventDefault();
  const tile = link?.closest?.('.reportMediaTile');
  const media = tile?.querySelector?.('img,video');
  const type = media?.tagName === 'VIDEO' ? 'video' : 'image';
  const src = media?.currentSrc || media?.src || link?.getAttribute?.('href') || '';
  return openMediaInNewTab(src, type, type === 'video' ? 'Munkavideó' : (media?.alt || 'Napló fotó'));
}
window.openMediaInNewTab = openMediaInNewTab;
window.openReportMediaLink = openReportMediaLink;

function ensureMediaViewerModal() {
  let modal = document.getElementById('mediaViewerModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'mediaViewerModal';
  modal.className = 'mediaViewerModal hidden';
  modal.innerHTML = `
    <div class="mediaViewerTop">
      <strong id="mediaViewerTitle">Napló fotó</strong>
      <div class="mediaViewerActions">
        <button class="btn small primary" type="button" onclick="closeMediaViewer()">Bezárás</button>
      </div>
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
  const mediaTitle = title || (type === 'video' ? 'Munkavideó' : 'Napló fotó');
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

function readVideoFilesAsDataUrls(fileList, max = 2) {
  const files = Array.from(fileList || []).slice(0, max);
  const MAX_VIDEO_MB = 35;
  const accepted = [];
  const tooLarge = [];
  files.forEach(file => {
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) tooLarge.push(file.name);
    else accepted.push(file);
  });
  if (tooLarge.length) {
    alert(`Túl nagy videó kimarad: ${tooLarge.join(', ')}\nJavaslat: 10–60 mp-es, tömörített telefonos videó. Maximum kb. ${MAX_VIDEO_MB} MB / videó.`);
  }
  return Promise.all(accepted.map(file => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve({ src: reader.result, name: file.name, type: file.type || 'video/mp4', size: file.size });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  }))).then(items => items.filter(Boolean));
}
async function uploadVideoFilesToStorage(fileList, max = 2) {
  const files = Array.from(fileList || []).slice(0, max);
  if (!files.length) return [];
  const MAX_VIDEO_MB = 80;
  const client = window.supabaseDirect;
  if (!client) { alert('Videó feltöltés nem érhető el: Supabase kapcsolat nem található.'); return []; }
  const uploaded = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!isSupportedVideoFile(file)) { alert(`Ez nem videófájl, kihagyva: ${file.name}`); continue; }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) { alert(`Túl nagy videó kimarad: ${file.name}\nMaximum kb. ${MAX_VIDEO_MB} MB / videó. Javaslat: 10–60 mp-es telefonos videó.`); continue; }
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(-80) || `video.${ext}`;
    const userId = detailState.user?.id || 'user';
    const projectId = detailState.project?.id || 'project';
    const storagePath = `${userId}/${projectId}/${Date.now()}-${i}-${safeName}`;
    const contentType = videoContentType(file);
    const { error } = await client.storage.from('project-videos').upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType });
    if (error) { console.warn('Videó feltöltési probléma:', error); alert('Videó feltöltési probléma: ' + (error.message || error) + '\nEllenőrizd, hogy lefutott-e a V30 SQL és létrejött-e a project-videos bucket.'); continue; }
    const signed = await client.storage.from('project-videos').createSignedUrl(storagePath, 3600);
    uploaded.push({ path: storagePath, src: signed.data?.signedUrl || '', name: file.name, type: contentType, size: file.size, private: true });
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

function riskClass(level) {
  return level === 'Magas' ? 'bad' : level === 'Közepes' ? 'warn' : 'ok';
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

function readFilesAsDataUrls(fileList, max = 10) {
  const files = Array.from(fileList || []).filter(file => String(file.type || '').startsWith('image/')).slice(0, max);
  return Promise.all(files.map(file => compressImageFile(file))).then(items => items.filter(Boolean));
}
function analyzeEntry({ note, phase, status, priority }) {
  const text = `${note} ${phase} ${status} ${priority}`.toLowerCase();
  let score = 8;
  const advice = [];
  const repairs = [];
  const materials = [];

  if (/reped|hasad|rés|mozgás/.test(text)) {
    score += 38;
    advice.push('Repedés vagy szerkezeti mozgás gyanúja: érdemes fotóval dokumentálni és ellenőrizni a kiváltó okot.');
    repairs.push('Repedés kitisztítása, szükség szerint hálózás, javítóhabarcs vagy glett.');
    materials.push('üvegszövet háló', 'javítóhabarcs', 'mélyalapozó');
  }
  if (/nedv|vizes|penész|ázás|salétrom/.test(text)) {
    score += 42;
    advice.push('Nedvesség jele: előbb a vízforrást kell megszüntetni, utána jöhet a javítás.');
    repairs.push('Nedves rész feltárása, szárítás, penészmentesítés, pára- vagy vízszigetelési ellenőrzés.');
    materials.push('penészlemosó', 'szárítóvakolat', 'vízszigetelő anyag');
  }
  if (/levál|pere|laza|üreg|kopog/.test(text)) {
    score += 30;
    advice.push('Laza vagy leváló réteg: csak stabil alapra szabad rájavítani.');
    repairs.push('Laza rész leverése, alapfelület tisztítása, tapadóhíd, újravakolás.');
    materials.push('tapadóhíd', 'vakolat', 'alapozó');
  }
  if (priority === 'Magas' || status === 'Javítás szükséges') score += 20;

  const level = score >= 65 ? 'Magas' : score >= 35 ? 'Közepes' : 'Alacsony';
  return {
    level,
    score: Math.min(score, 100),
    title: level === 'Magas' ? 'Azonnali ellenőrzés javasolt' : level === 'Közepes' ? 'Figyelmet igényel' : 'Normál dokumentáció',
    advice: advice.length ? advice : ['A bejegyzés alapján nincs kiemelt kockázat, a fotós és videós dokumentáció hasznos lehet későbbi vitás helyzetben.'],
    repairs,
    materials,
    estimatedCost: level === 'Magas' ? '25 000–150 000 Ft előzetesen' : level === 'Közepes' ? '10 000–60 000 Ft előzetesen' : 'nincs külön költségbecslés',
    workTime: level === 'Magas' ? 'fél nap – 2 nap' : level === 'Közepes' ? '1–4 óra' : 'nincs külön munkaidő'
  };
}

async function initProjectPage() {
  qs('detailDate').value = new Date().toISOString().slice(0, 10);
  qs('projectLogoutBtn')?.addEventListener('click', () => { window.location.href = 'logout.html'; });

  detailState.user = await window.EpitesNaploAPI.getCurrentUser();
  if (!detailState.user) {
    showToast('A projekt naplóhoz előbb jelentkezz be.', 'error');
    setTimeout(() => window.location.href = 'index.html#login', 900);
    return;
  }

  const projectId = getProjectId();
  const projects = await window.EpitesNaploAPI.getProjects();
  detailState.project = projects.find(p => String(p.id) === String(projectId));

  if (!detailState.project) {
    try {
      const cached = JSON.parse(sessionStorage.getItem('epitesnaplo_selected_project') || '{}');
      if (cached?.id === projectId) detailState.project = cached;
    } catch (_) {}
  }

  if (!detailState.project) {
    qs('projectTitle').textContent = 'Projekt nem található';
    qs('projectSubtitle').textContent = 'Menj vissza a főoldalra, és nyisd meg a projektet a listából.';
    return;
  }

  qs('projectTitle').textContent = detailState.project.name || 'Projekt napló';
  await reloadProjectEntries();
}

async function reloadProjectEntries() {
  const allEntries = await window.EpitesNaploAPI.getEntries();
  const projectId = getProjectId();
  detailState.entries = (allEntries || []).filter(e => String(e.project_id || e.projectId) === String(projectId));
  await hydratePrivateVideoUrls(detailState.entries);
  renderProjectSummary();
  renderProjectTimeline();
}

async function deleteCurrentProject() {
  const project = detailState.project;
  if (!project?.id) return alert('Nincs kiválasztott projekt.');

  const ok = confirm(`Biztosan törlöd ezt a projektet?\n\n${project.name || 'Projekt'}\n\nTörlődik a Supabase-ből a projekt, a naplóbejegyzések, riportok, anyagok, számlák, teendők és a projekt videófájljai is.`);
  if (!ok) return;

  try {
    await window.EpitesNaploAPI.deleteProject(project.id);
    showToast('Projekt törölve.', 'ok');
    try { sessionStorage.removeItem('epitesnaplo_selected_project'); } catch (_) {}
    setTimeout(() => { window.location.href = 'index.html#naplo'; }, 700);
  } catch (err) {
    console.error(err);
    alert('Projekt törlési hiba: ' + (err?.message || err || 'Ismeretlen Supabase hiba.'));
  }
}
window.deleteCurrentProject = deleteCurrentProject;

function renderProjectSummary() {
  const entries = detailState.entries;
  const photos = entries.reduce((sum, e) => sum + getEntryImages(e).length, 0);
  const videos = entries.reduce((sum, e) => sum + getEntryVideos(e).length, 0);
  const risky = entries.filter(e => (e.analysis?.level || e.ai_level) !== 'Alacsony').length;
  qs('projectEntryCount').textContent = entries.length;
  qs('projectPhotoCount').textContent = photos + videos;
  qs('projectRiskCount').textContent = risky;

  const last = entries[0];
  qs('projectSummaryBox').innerHTML = `
    <div class="miniMetric"><b>${entries.length}</b><span>összes napi bejegyzés</span></div>
    <div class="miniMetric"><b>${photos}</b><span>fotó / videó</span></div>
    <div class="miniMetric"><b>${risky}</b><span>AI által jelzett kockázat</span></div>
    <div class="notice"><b>Utolsó aktivitás:</b><br>${last ? formatDate(last.created_at) : 'Még nincs bejegyzés.'}</div>
  `;
  updateProjectHeaderStatus?.();
}

function renderProjectTimeline() {
  const filter = qs('timelineRiskFilter')?.value || 'all';
  let entries = [...detailState.entries];
  if (filter !== 'all') entries = entries.filter(e => (e.analysis?.level || e.ai_level || 'Alacsony') === filter);

  qs('projectTimeline').innerHTML = entries.map(entry => {
    const level = entry.analysis?.level || entry.ai_level || 'Alacsony';
    const title = entry.analysis?.title || entry.ai_title || 'Elemzés';
    const images = getEntryImages(entry);
    const videos = getEntryVideos(entry);
    return `
      <article class="timelineEntry">
        <div class="timelineDate"><b>${formatDate(entry.created_at)}</b><span>${escapeHtml(entry.phase || '')}</span></div>
        <div class="timelineBody">
          ${images.length ? `<div class="entryImageGrid detailImages">${images.map(src => renderMediaImage(src, 'Napló fotó')).join('')}</div>` : ''}
          ${videos.length ? `<div class="entryVideoGrid">${videos.map(v => renderMediaVideo(v, 'Munkavideó')).join('')}</div>` : ''}
          <p>${escapeHtml(entry.note || '')}</p>
          <div class="tagRow">
            <span class="tag ${riskClass(level)}">AI: ${escapeHtml(level)}</span>
            <span class="tag ai">${escapeHtml(title)}</span>
            <span class="tag">${escapeHtml(entry.status || '')}</span>
            ${images.length ? `<span class="tag">${images.length} fotó</span>` : ''}
            ${videos.length ? `<span class="tag">${videos.length} videó</span>` : ''}
          </div>
          ${entry.analysis?.advice?.length ? `<div class="aiAdviceBox"><b>AI javaslat:</b><ul>${entry.analysis.advice.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul></div>` : ''}
          ${entry.analysis?.materials?.length ? `<div class="aiAdviceBox"><b>Anyagjavaslat:</b> ${entry.analysis.materials.map(escapeHtml).join(', ')}</div>` : ''}
        </div>
      </article>
    `;
  }).join('') || '<p class="muted">Még nincs napi bejegyzés ehhez a projekthez.</p>';
}

async function saveDailyEntry() {
  if (!detailState.project) return alert('Nincs kiválasztott projekt.');
  const noteBase = qs('detailNote').value.trim();
  if (!noteBase) return alert('Írd be a mai napló leírását.');

  const date = qs('detailDate').value || new Date().toISOString().slice(0, 10);
  const phase = getSelectedWorkPhaseV34();
  const status = qs('detailStatus').value;
  const priority = qs('detailPriority').value;
  const responsible = qs('detailResponsible').value.trim() || 'Nincs megadva';
  const weather = qs('detailWeather').value.trim() || 'Nincs megadva';
  const note = `Dátum: ${date}\n${noteBase}`;

  if (qs('autoWeatherGpsCheck')?.checked && !v19WeatherJson && !qs('detailGps')?.value.trim()) { await fillWeatherAndGps(); }
  const beforeImages = await readFilesAsDataUrls(qs('beforeFiles')?.files, 5);
  const afterImages = await readFilesAsDataUrls(qs('afterFiles')?.files, 5);
  const generalImages = await readFilesAsDataUrls(qs('detailFiles')?.files, 10);
  const selectedVideos = Array.from(qs('detailVideos')?.files || []).filter(isSupportedVideoFile);
  const videos = await uploadVideoFilesToStorage(qs('detailVideos')?.files, 2);
  if (selectedVideos.length && !videos.length) {
    alert('A videó nem lett feltöltve, ezért a bejegyzést nem mentettem videó nélkül. Futtasd a V44 SQL-t, majd próbáld újra.');
    throw new Error('Videó feltöltés sikertelen.');
  }
  const images = [...beforeImages, ...afterImages, ...generalImages];
  const analysis = analyzeEntry({ note, phase, status, priority });
  qs('detailAiPreview').classList.remove('hidden');
  qs('detailAiPreview').innerHTML = `<b>AI előszűrés:</b> ${escapeHtml(analysis.level)} – ${escapeHtml(analysis.title)}<br><small>${escapeHtml(analysis.advice[0] || '')}</small>`;

  const saved = await window.EpitesNaploAPI.saveEntry({
    projectId: detailState.project.id,
    phase,
    status,
    priority,
    responsible,
    weather,
    note,
    images,
    image: images[0] || '',
    videos,
    videoUrls: videos,
    analysis
  });
  if (!saved?.id) throw new Error('A naplóbejegyzés nem kapott mentett azonosítót. Ellenőrizd a Supabase kapcsolatot.');

  qs('detailNote').value = '';
  qs('detailFiles').value = '';
  if (qs('detailVideos')) qs('detailVideos').value = '';
  if (qs('beforeFiles')) qs('beforeFiles').value = '';
  if (qs('afterFiles')) qs('afterFiles').value = '';
  await reloadProjectEntries();
  showToast('✔ Napi bejegyzés mentve a projekt idővonalába.', 'ok');
  qs('projectTimeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToDailyForm() {
  qs('dailyFormCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  qs('detailNote')?.focus();
}

function copyProjectSummary() {
  const entries = detailState.entries;
  const text = `${detailState.project?.name || 'Projekt'} – építési napló összefoglaló\n\nBejegyzések száma: ${entries.length}\nUtolsó bejegyzés: ${entries[0] ? formatDate(entries[0].created_at) : 'nincs'}\n\n${entries.map(e => `- ${formatDate(e.created_at)}: ${(e.note || '').replace(/\s+/g, ' ').slice(0, 180)}`).join('\n')}`;
  navigator.clipboard?.writeText(text);
  showToast('Összefoglaló másolva.', 'ok');
}

async function logoutFromProjectPage() {
  const btn = qs('projectLogoutBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Kilépés...'; }
  try { await window.EpitesNaploAPI.signOut({ silent: true }); } catch (e) { console.warn(e); }
  window.location.replace('index.html?logout=' + Date.now() + '#home');
}

window.addEventListener('DOMContentLoaded', initProjectPage);

// ===== v19 PRO bővítés: státusz, időjárás, GPS, anyag, heti/lezáró riport =====
let v19WeatherJson = null;
let v19GpsJson = null;
let v19MaterialsCache = [];
let v19InvoicesCache = [];

function statusLabel(value){
  return ({ folyamatban:'Folyamatban', ellenorzesre_var:'Ellenőrzésre vár', elkeszult:'Elkészült', lezarva:'Lezárva' }[value || 'folyamatban'] || 'Folyamatban');
}
function statusClass(value){ return `status-${value || 'folyamatban'}`; }
function projectActivitySignal(entries = [], status = 'folyamatban', manualProgress = 0) {
  const photos = entries.reduce((sum, e) => sum + getEntryImages(e).length, 0);
  const videos = entries.reduce((sum, e) => sum + getEntryVideos(e).length, 0);
  const risky = entries.filter(e => (e.analysis?.level || e.ai_level || 'Alacsony') !== 'Alacsony').length;
  const last = entries[0] || null;
  const finished = status === 'lezarva' || status === 'elkeszult';
  const estimated = finished ? 100 : Math.min(95, Math.max(entries.length ? 12 : 0, entries.length * 14 + Math.min(24, (photos + videos) * 2)));
  const progress = manualProgress > 0 || finished ? manualProgress || estimated : estimated;
  const signalClass = risky ? 'warn' : entries.length ? 'ok' : 'empty';
  const parts = [];
  if (entries.length) parts.push(`${entries.length} napló`);
  if (photos || videos) parts.push(`${photos} fotó`, `${videos} videó`);
  if (risky) parts.push(`${risky} AI jelzés`);
  if (last) parts.push(`utolsó: ${formatDate(last.created_at)}`);
  return {
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    label: manualProgress > 0 || finished ? `Haladás: ${Math.round(manualProgress || estimated)}%` : `Becsült haladás: ${Math.round(progress)}%`,
    html: parts.length ? parts.map(item => `<span>${escapeHtml(item)}</span>`).join('') : '<span>Nincs még mentett napi bejegyzés</span>',
    signalClass
  };
}
function updateProjectHeaderStatus(){
  const p = detailState.project || {};
  const status = p.status || 'folyamatban';
  const entries = detailState.entries || [];
  const manualProgress = Math.max(0, Math.min(100, Number(p.progress || 0)));
  const signal = projectActivitySignal(entries, status, manualProgress);
  const progress = signal.progress;
  const pill = qs('projectStatusPill');
  if(pill){ pill.textContent = statusLabel(status); pill.className = `statusBadge ${statusClass(status)}`; }
  if(qs('projectProgressLabel')) qs('projectProgressLabel').textContent = signal.label;
  if(qs('projectProgressBar')) qs('projectProgressBar').style.width = `${progress}%`;
  if(qs('projectStatusSelect')) qs('projectStatusSelect').value = status;
  if(qs('projectProgressInput')) qs('projectProgressInput').value = manualProgress || progress;
  if(qs('projectSmartSignal')) {
    qs('projectSmartSignal').className = `projectSmartSignal ${signal.signalClass}`;
    qs('projectSmartSignal').innerHTML = signal.html;
  }
  if(qs('financeLink')) qs('financeLink').href = `project-finance.html?id=${encodeURIComponent(getProjectId())}`;
}
async function v19LoadExtras(){
  if(!detailState.project) return;
  updateProjectHeaderStatus();
  try { v19MaterialsCache = await window.EpitesNaploAPI.getProjectMaterials(detailState.project.id); } catch(_) { v19MaterialsCache = []; }
  try { v19InvoicesCache = await window.EpitesNaploAPI.getProjectInvoices(detailState.project.id); } catch(_) { v19InvoicesCache = []; }
  renderMaterialSummary();
  renderSmartNotifications();
}

const v19OldReloadProjectEntries = reloadProjectEntries;
reloadProjectEntries = async function(){
  await v19OldReloadProjectEntries();
  await v19LoadExtras();
};

const v19OldInitProjectPage = initProjectPage;
initProjectPage = async function(){
  await v19OldInitProjectPage();
  addMaterialRow();
  updateProjectHeaderStatus();
  initProjectUxHelpers();
  initCustomWorkPhaseV34();
  maybeShowOnboarding();
};

function addMaterialRow(data = {}){
  const wrap = qs('materialsRows');
  if(!wrap) return;
  const row = document.createElement('div');
  row.className = 'materialRow';
  row.innerHTML = `
    <input class="matName" placeholder="Anyag neve" value="${escapeHtml(data.name || '')}" />
    <input class="matQty" type="number" step="0.01" placeholder="Mennyiség" value="${escapeHtml(data.quantity || '')}" />
    <select class="matUnit"><option>db</option><option>m²</option><option>m³</option><option>fm</option><option>kg</option><option>zsák</option><option>liter</option><option>óra</option></select>
    <input class="matNote" placeholder="Megjegyzés" value="${escapeHtml(data.note || '')}" />
    <button class="btn ghost small" type="button">Törlés</button>`;
  row.querySelector('.matUnit').value = data.unit || 'db';
  row.querySelector('button').onclick = () => row.remove();
  wrap.appendChild(row);
}
function collectMaterials(){
  return Array.from(document.querySelectorAll('.materialRow')).map(row => ({
    name: row.querySelector('.matName')?.value.trim() || '',
    quantity: row.querySelector('.matQty')?.value || 0,
    unit: row.querySelector('.matUnit')?.value || 'db',
    note: row.querySelector('.matNote')?.value.trim() || ''
  })).filter(m => m.name);
}
function clearMaterialRows(){
  const wrap = qs('materialsRows'); if(!wrap) return; wrap.innerHTML=''; addMaterialRow();
}
function renderMaterialSummary(){
  const box = qs('materialSummaryBox');
  if(!box) return;
  const totals = {};
  (v19MaterialsCache || []).forEach(m => {
    const key = `${m.name || 'Anyag'}|${m.unit || 'db'}`;
    totals[key] = (totals[key] || 0) + Number(m.quantity || 0);
  });
  const invoiceSum = (v19InvoicesCache || []).reduce((s, i) => s + Number(i.amount || 0), 0);
  const rows = Object.entries(totals).slice(0, 8).map(([key, qty]) => {
    const [name, unit] = key.split('|');
    return `<li><b>${escapeHtml(name)}</b>: ${Number(qty.toFixed(2))} ${escapeHtml(unit)}</li>`;
  }).join('');
  box.innerHTML = `
    <div class="notice"><b>Anyag- és költség összesítő</b><br>
      ${rows ? `<ul>${rows}</ul>` : '<span class="muted">Még nincs rögzített anyag.</span>'}
      <div class="invoiceTotal">Számlák összesen: <b>${invoiceSum.toLocaleString('hu-HU')} Ft</b></div>
    </div>`;
}

async function saveProjectStatus(){
  if(!detailState.project) return alert('Nincs projekt.');
  try{
    const status = qs('projectStatusSelect').value;
    const progress = qs('projectProgressInput').value || 0;
    const updated = await window.EpitesNaploAPI.updateProjectStatus(detailState.project.id, { status, progress });
    detailState.project = { ...detailState.project, ...(updated || {}), status, progress };
    updateProjectHeaderStatus();
    showToast('✔ Projekt státusz mentve.', 'ok');
  }catch(e){ alert('Státusz mentési hiba: ' + (e.message || e)); }
}

async function fillWeatherAndGps(){
  qs('weatherAutoText').value = 'Helyadat és időjárás lekérése...';
  v19GpsJson = await window.EpitesNaploAPI.getBrowserLocation();
  if(v19GpsJson){
    qs('detailGps').value = `${v19GpsJson.lat.toFixed(5)}, ${v19GpsJson.lon.toFixed(5)}`;
    v19WeatherJson = await window.EpitesNaploAPI.getWeatherForLocation(v19GpsJson.lat, v19GpsJson.lon);
  }
  if(v19WeatherJson){
    const text = `${v19WeatherJson.temperature} °C, ${v19WeatherJson.text}, szél: ${v19WeatherJson.wind} km/h, csapadék: ${v19WeatherJson.precipitation} mm`;
    qs('weatherAutoText').value = text;
    qs('detailWeather').value = text;
    showToast('✔ Időjárás mentésre előkészítve.', 'ok');
  } else {
    qs('weatherAutoText').value = 'Nem sikerült automatikusan lekérni. Kézzel is beírhatod.';
  }
}

saveDailyEntry = async function(){
  if (!detailState.project) return alert('Nincs kiválasztott projekt.');
  const noteBase = qs('detailNote').value.trim();
  if (!noteBase) return alert('Írd be a mai napló leírását.');

  const date = qs('detailDate').value || new Date().toISOString().slice(0, 10);
  const phase = getSelectedWorkPhaseV34();
  const status = qs('detailStatus').value;
  const priority = qs('detailPriority').value;
  const responsible = qs('detailResponsible').value.trim() || 'Nincs megadva';
  const weather = qs('detailWeather').value.trim() || 'Nincs megadva';
  const gpsText = qs('detailGps')?.value.trim() || '';
  const materials = collectMaterials();
  const materialText = materials.length ? `\n\nAnyagfelhasználás:\n${materials.map(m => `- ${m.name}: ${m.quantity} ${m.unit}${m.note ? ' (' + m.note + ')' : ''}`).join('\n')}` : '';
  const weatherText = v19WeatherJson ? `\n\nAutomatikus időjárás: ${qs('weatherAutoText').value}` : '';
  const gpsNote = gpsText ? `\nGPS/helyadat: ${gpsText}` : '';
  const beforeAfterText = (qs("beforeFiles")?.files?.length ? `\nElőtte fotó: ${qs("beforeFiles").files.length} db` : "") + (qs("afterFiles")?.files?.length ? `\nUtána fotó: ${qs("afterFiles").files.length} db` : "");
  const note = `Dátum: ${date}\n${noteBase}${beforeAfterText}${materialText}${weatherText}${gpsNote}`;

  if (qs('autoWeatherGpsCheck')?.checked && !v19WeatherJson && !qs('detailGps')?.value.trim()) { await fillWeatherAndGps(); }
  const beforeImages = await readFilesAsDataUrls(qs('beforeFiles')?.files, 5);
  const afterImages = await readFilesAsDataUrls(qs('afterFiles')?.files, 5);
  const generalImages = await readFilesAsDataUrls(qs('detailFiles')?.files, 10);
  const images = [...beforeImages, ...afterImages, ...generalImages];
  let analysis = analyzeEntry({
    note,
    phase,
    status,
    priority,
    materials,
    images,
    before: beforeImages,
    after: afterImages,
    general: generalImages,
    imageCount: images.length,
    beforeImageCount: beforeImages.length,
    afterImageCount: afterImages.length
  });
  if (images.length && window.EpitesNaploAPI?.analyzePhotoWithAI) {
    try {
      showToast('AI kép + szöveg kontroll készítése...', 'info');
      const vision = await window.EpitesNaploAPI.analyzePhotoWithAI({
        projectId: detailState.project.id,
        note,
        phase,
        status,
        priority,
        imageCount: images.length,
        beforeImageCount: beforeImages.length,
        afterImageCount: afterImages.length,
        images: images.slice(0, 3)
      });
      if (vision?.ok && vision.analysis) {
        analysis = { ...analysis, ...vision.analysis, localAiVersion: 'v60-vision-text' };
      }
    } catch (err) {
      console.warn('AI kép + szöveg kontroll helyi módra váltott:', err);
    }
  }
  qs('detailAiPreview').classList.remove('hidden');
  qs('detailAiPreview').innerHTML = `<b>AI kép + szöveg kontroll:</b> ${escapeHtml(analysis.level)} – ${escapeHtml(analysis.title)}<br><small>${escapeHtml(analysis.photoTextCheck || analysis.nextStep || analysis.advice?.[0] || '')}</small>`;

  await window.EpitesNaploAPI.saveEntry({
    projectId: detailState.project.id, phase, status, priority, responsible, weather, note,
    images, image: images[0] || '', analysis, materials,
    weatherJson: v19WeatherJson, gpsJson: v19GpsJson || (gpsText ? { text: gpsText, captured_at: new Date().toISOString() } : null)
  });

  qs('detailNote').value = ''; qs('detailFiles').value = ''; if(qs('beforeFiles')) qs('beforeFiles').value = ''; if(qs('afterFiles')) qs('afterFiles').value = ''; if(qs('detailVideos')) qs('detailVideos').value = ''; clearMaterialRows();
  v19WeatherJson = null; v19GpsJson = null; if(qs('weatherAutoText')) qs('weatherAutoText').value = '';
  await reloadProjectEntries();
  showToast('✔ Napi bejegyzés, anyag és időjárás mentve.', 'ok');
  qs('projectTimeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

renderProjectTimeline = function(){
  const filter = qs('timelineRiskFilter')?.value || 'all';
  let entries = [...detailState.entries];
  if (filter !== 'all') entries = entries.filter(e => (e.analysis?.level || e.ai_level || 'Alacsony') === filter);
  qs('projectTimeline').innerHTML = entries.map(entry => {
    const level = entry.analysis?.level || entry.ai_level || 'Alacsony';
    const title = entry.analysis?.title || entry.ai_title || 'Elemzés';
    const images = getEntryImages(entry);
    const mats = entry.materials_json || entry.analysis?.materials || [];
    const weatherJson = entry.weather_json || null;
    return `<article class="timelineEntry">
      <div class="timelineDate"><b>${formatDate(entry.created_at)}</b><span>${escapeHtml(entry.phase || '')}</span></div>
      <div class="timelineBody">
        ${images.length ? `<div class="entryImageGrid detailImages">${images.map(src => renderMediaImage(src, 'Napló fotó')).join('')}</div>` : ''}
        <p>${escapeHtml(entry.note || '')}</p>
        <div class="tagRow"><span class="tag ${riskClass(level)}">AI: ${escapeHtml(level)}</span><span class="tag ai">${escapeHtml(title)}</span><span class="tag">${escapeHtml(entry.status || '')}</span>${images.length ? `<span class="tag">${images.length} fotó</span>` : ''}</div>
        ${weatherJson ? `<div class="miniInfo">🌦️ ${escapeHtml(weatherJson.temperature)} °C, ${escapeHtml(weatherJson.text)}, szél: ${escapeHtml(weatherJson.wind)} km/h</div>` : ''}
        ${Array.isArray(mats) && mats.length ? `<div class="miniInfo"><b>Anyag:</b> ${mats.map(m => `${escapeHtml(m.name)} ${escapeHtml(m.quantity)} ${escapeHtml(m.unit)}`).join(', ')}</div>` : ''}
        ${entry.analysis?.advice?.length ? `<div class="aiAdviceBox"><b>AI javaslat:</b><ul>${entry.analysis.advice.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul></div>` : ''}
      </div></article>`;
  }).join('') || '<p class="muted">Még nincs napi bejegyzés ehhez a projekthez.</p>';
};

function openFinancePage(){ window.location.href = `project-finance.html?id=${encodeURIComponent(getProjectId())}`; }
function buildReportHtml(entries, title){
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial;padding:24px;color:#111} h1{font-size:26px}.entry{border-left:4px solid #f5a400;padding:10px 14px;margin:12px 0;background:#f7f7f7} img{max-width:180px;margin:4px;border-radius:8px}.muted{color:#555}</style></head><body><h1>${escapeHtml(title)}</h1><p class="muted">Generálva: ${new Date().toLocaleString('hu-HU')}</p>${entries.map(e=>`<div class="entry"><b>${formatDate(e.created_at)}</b> – ${escapeHtml(e.phase||'')}<p>${escapeHtml(e.note||'')}</p>${getEntryImages(e).map(src=>`<img src="${src}">`).join('')}</div>`).join('')}</body></html>`;
}
function printHtml(html){ const w = window.open('', '_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 500); }
function printWeeklyReport(){
  const now = new Date(); const weekAgo = new Date(); weekAgo.setDate(now.getDate()-7);
  const entries = detailState.entries.filter(e => new Date(e.created_at) >= weekAgo);
  printHtml(buildReportHtml(entries, `${detailState.project?.name || 'Projekt'} – heti építési napló`));
}
async function printClosingDocument(){
  const data = await window.EpitesNaploAPI.getProjectCloseData(detailState.project.id);
  const extra = `<h2>Anyagösszesítő</h2><ul>${data.materials.map(m=>`<li>${escapeHtml(m.name)} – ${escapeHtml(m.quantity)} ${escapeHtml(m.unit)} ${escapeHtml(m.note||'')}</li>`).join('')}</ul><h2>Számlák</h2><p>Összesen: <b>${data.invoices.reduce((s,i)=>s+Number(i.amount||0),0).toLocaleString('hu-HU')} Ft</b></p>`;
  printHtml(buildReportHtml(data.entries, `${detailState.project?.name || 'Projekt'} – lezáró dokumentum`).replace('</body>', extra + '</body>'));
}

// ===== v21 PRO: onboarding, tooltip, előtte/utána fotó, AI napi jelentés, okos értesítések =====
const onboardingSteps = [
  { title: '1. Napi munka rögzítése', text: 'Ide írd be, mi történt ma: munkafázis, felelős, hibák, eltérések és fontos megjegyzések. Ez lesz a bizonyíték alapja.' },
  { title: '2. Időjárás és GPS', text: 'A rendszer a böngésző engedélyével lekéri a helyet, majd Open-Meteo alapján kitölti az időjárást. API-kulcs nem kell hozzá.' },
  { title: '3. Előtte / utána fotó', text: 'A külön előtte és utána képek sokkal erősebb dokumentációt adnak, mint egy sima galéria.' },
  { title: '4. Anyagok és számlák', text: 'A napi anyagfelhasználás és a számlák külön összesítőbe kerülnek, így a projekt költsége később átlátható.' },
  { title: '5. Riport / PDF', text: 'A heti vagy lezáró dokumentumot nyomtatható PDF-ként tudod átadni az ügyfélnek.' }
];
let onboardingIndex = 0;

function initProjectUxHelpers(){
  document.querySelectorAll('[data-tooltip]').forEach(el => {
    el.setAttribute('title', el.dataset.tooltip || '');
    el.addEventListener('click', () => showProjectHelp('Gyors magyarázat', `<div class="featureHelpBox"><b>${escapeHtml(el.placeholder || 'Funkció')}</b><p>${escapeHtml(el.dataset.tooltip || '')}</p></div>`));
  });
  document.querySelectorAll('[data-help]').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.dataset.help;
    if(key === 'daily') showProjectHelp('Mai napló folytatása', '<div class="featureHelpBox"><b>Mire való?</b><p>Itt készül a napi bizonyíték: munka leírása, fotók, időjárás, GPS, anyagfelhasználás és AI előszűrés egy helyen.</p></div><div class="featureHelpBox"><b>Mobilon is jó</b><p>A kérdőjel ikonra kattintva ugyanazt a magyarázatot kapod, amit gépen hover tooltipként látnál.</p></div>');
    if(key === 'summary') showProjectHelp('Projekt összefoglaló', '<div class="featureHelpBox"><b>Mit számol?</b><p>Bejegyzések, fotók, kockázatok, anyagok és számlák összesítése. Ez segít gyorsan látni, hol tart a munka.</p></div>');
  }));
}

function maybeShowOnboarding(){
  if(localStorage.getItem('epitesnaplo_project_onboarding_done') === '1') return;
  onboardingIndex = 0;
  renderOnboardingStep();
  qs('onboardingModal')?.classList.remove('hidden');
}
function renderOnboardingStep(){
  const step = onboardingSteps[onboardingIndex] || onboardingSteps[0];
  const body = qs('onboardingBody');
  if(body) body.innerHTML = `<div class="featureHelpBox"><b>${escapeHtml(step.title)}</b><p>${escapeHtml(step.text)}</p></div><p class="muted">${onboardingIndex+1} / ${onboardingSteps.length}</p>`;
}
function nextOnboardingStep(){
  if(onboardingIndex < onboardingSteps.length - 1){ onboardingIndex++; renderOnboardingStep(); return; }
  closeOnboarding(true);
}
function prevOnboardingStep(){ if(onboardingIndex > 0){ onboardingIndex--; renderOnboardingStep(); } }
function closeOnboarding(done){
  if(done || qs('dontShowOnboarding')?.checked) localStorage.setItem('epitesnaplo_project_onboarding_done','1');
  qs('onboardingModal')?.classList.add('hidden');
}
function showProjectHelp(title, html){
  if(qs('projectHelpTitle')) qs('projectHelpTitle').textContent = title;
  if(qs('projectHelpBody')) qs('projectHelpBody').innerHTML = html;
  qs('projectHelpModal')?.classList.remove('hidden');
}
function closeProjectHelp(){ qs('projectHelpModal')?.classList.add('hidden'); }
function openHelpVideo(){ qs('videoHelpModal')?.classList.remove('hidden'); }
function closeHelpVideo(){ qs('videoHelpModal')?.classList.add('hidden'); }

// ===== V34: Egyéb munkafázis saját beírással =====
function getSelectedWorkPhaseV34(){
  const selectValue = (qs('detailWorkPhase')?.value || '').trim();
  const customValue = (qs('detailCustomWorkPhase')?.value || '').trim();
  if(selectValue.toLowerCase() === 'egyéb' || selectValue.toLowerCase() === 'egyeb'){
    return customValue || 'Egyéb munkafázis';
  }
  return selectValue || 'munkafázis';
}
function updateCustomWorkPhaseV34(){
  const select = qs('detailWorkPhase');
  const input = qs('detailCustomWorkPhase');
  if(!select || !input) return;
  const isOther = ['egyéb','egyeb'].includes(String(select.value || '').toLowerCase());
  input.classList.toggle('hidden', !isOther);
  input.style.display = isOther ? '' : 'none';
  if(isOther) setTimeout(() => input.focus(), 30);
  else input.value = '';
}
function initCustomWorkPhaseV34(){
  const select = qs('detailWorkPhase');
  const input = qs('detailCustomWorkPhase');
  if(!select || !input || select.dataset.v34Ready === '1') return;
  select.dataset.v34Ready = '1';
  input.style.display = 'none';
  select.addEventListener('change', updateCustomWorkPhaseV34);
  updateCustomWorkPhaseV34();
}

function generateDailyAiText(){
  const phase = getSelectedWorkPhaseV34();
  const status = qs('detailStatus')?.value || 'Normál';
  const priority = qs('detailPriority')?.value || 'Közepes';
  const weather = qs('detailWeather')?.value || qs('weatherAutoText')?.value || 'időjárási adat még nincs megadva';
  const responsible = qs('detailResponsible')?.value || 'a kivitelező csapat';
  const materials = collectMaterials();
  const matText = materials.length ? ` Felhasznált anyagok: ${materials.map(m => `${m.name} ${m.quantity} ${m.unit}`).join(', ')}.` : '';
  const generated = `Mai munkanapló – ${phase}\n\nA mai napon a(z) ${phase.toLowerCase()} munkafázishoz kapcsolódó feladatok történtek. A munkavégzés felelőse: ${responsible}. A státusz: ${status}, a prioritás: ${priority}.\n\nHelyszíni körülmény / időjárás: ${weather}.${matText}\n\nMegjegyzés ügyfél részére: a napi dokumentáció fotókkal, időjárási adattal és szükség esetén GPS helyadattal kerül rögzítésre, hogy a munka később is átláthatóan visszakereshető legyen.`;
  const current = qs('detailNote')?.value.trim();
  qs('detailNote').value = current ? `${current}\n\n${generated}` : generated;
  showToast('✔ AI napi jelentés szöveg előkészítve.', 'ok');
}

function renderSmartNotifications(){
  const box = qs('smartNotificationBox');
  if(!box) return;
  const entries = detailState.entries || [];
  const notes = [];
  if(!entries.length) notes.push('Még nincs napi bejegyzés. Érdemes ma legalább egy rövid állapotot rögzíteni.');
  if(entries.length && !entries.some(e => getEntryImages(e).length)) notes.push('Van bejegyzés, de még nincs fotó. Előtte/utána képpel erősebb lesz a bizonyíték.');
  if(entries.some(e => (e.analysis?.level || e.ai_level) === 'Magas')) notes.push('Van magas AI kockázatú bejegyzés. Ezt érdemes külön ellenőrizni és fotóval alátámasztani.');
  const invoiceSum = (v19InvoicesCache || []).reduce((s,i)=>s+Number(i.amount||0),0);
  if(invoiceSum === 0) notes.push('Még nincs számla rögzítve ehhez a projekthez. A költségösszesítő akkor lesz igazán erős, ha a számlák is bekerülnek.');
  box.innerHTML = `<div class="notice"><b>Okos értesítések</b><ul>${notes.slice(0,4).map(n=>`<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`;
}

// ===== v24 FULL PRO BEKÖTÉS: stabil időjárás/GPS, külön előtte-utána mentés, letölthető riportok =====
async function captureGpsOnly(){
  const gpsInput = qs('detailGps');
  const weatherAuto = qs('weatherAutoText');
  if(weatherAuto) weatherAuto.value = 'GPS helyadat lekérése...';
  try{
    v19GpsJson = await window.EpitesNaploAPI.getBrowserLocation();
    if(!v19GpsJson){
      if(weatherAuto) weatherAuto.value = 'A böngésző nem adott GPS engedélyt. Kézzel is beírhatod a címet/helyet.';
      showToast('GPS engedély nem érkezett. Kézzel is beírható.', 'error');
      return null;
    }
    const text = `${v19GpsJson.lat.toFixed(5)}, ${v19GpsJson.lon.toFixed(5)}${v19GpsJson.accuracy ? ' • pontosság: kb. ' + Math.round(v19GpsJson.accuracy) + ' m' : ''}`;
    if(gpsInput) gpsInput.value = text;
    if(weatherAuto) weatherAuto.value = 'GPS rögzítve. Időjárást külön is lekérhetsz.';
    showToast('✔ GPS helyadat rögzítve.', 'ok');
    return v19GpsJson;
  }catch(err){
    console.warn('GPS hiba:', err);
    if(weatherAuto) weatherAuto.value = 'GPS lekérés hiba. Kézzel is beírhatod.';
    showToast('GPS lekérés hiba.', 'error');
    return null;
  }
}

async function ensureWeatherAndGpsBeforeSave(){
  if(!qs('autoWeatherGpsCheck')?.checked) return;
  if(v19WeatherJson || qs('weatherAutoText')?.value?.includes('°C')) return;
  await fillWeatherAndGps();
}

function downloadTextFile(filename, content, mime='text/html;charset=utf-8'){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 800);
}

function safeFileName(text){
  return String(text || 'epitesi-naplo').toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óöőòô]/g,'o').replace(/[úüűùû]/g,'u').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70) || 'epitesi-naplo';
}

function buildProReportHtml(entries, title, options={}){
  const materials = options.materials || [];
  const invoices = options.invoices || [];
  const invoiceSum = invoices.reduce((s,i)=>s+Number(i.amount||0),0);
  const materialTotals = {};
  materials.forEach(m=>{ const key=`${m.name||'Anyag'}|${m.unit||'db'}`; materialTotals[key]=(materialTotals[key]||0)+Number(m.quantity||0); });
  const materialHtml = Object.entries(materialTotals).map(([key,qty])=>{ const [name,unit]=key.split('|'); return `<li><b>${escapeHtml(name)}</b>: ${Number(qty.toFixed(2))} ${escapeHtml(unit)}</li>`; }).join('') || '<li>Nincs rögzített anyag.</li>';
  const invoiceHtml = invoices.map(i=>`<tr><td>${escapeHtml(i.title)}</td><td>${Number(i.amount||0).toLocaleString('hu-HU')} Ft</td><td>${escapeHtml(i.note||'')}</td></tr>`).join('') || '<tr><td colspan="3">Nincs csatolt számla.</td></tr>';
  const entriesHtml = entries.map(e=>{
    const images = getEntryImages(e);
    const videos = getEntryVideos(e);
    const weather = e.weather_json ? `${escapeHtml(e.weather_json.temperature)} °C, ${escapeHtml(e.weather_json.text)}, szél: ${escapeHtml(e.weather_json.wind)} km/h` : escapeHtml(e.weather || '');
    const gps = e.gps_json?.text || (e.gps_json?.lat ? `${e.gps_json.lat}, ${e.gps_json.lon}` : '');
    const mats = e.materials_json || [];
    return `<section class="entry"><h2>${formatDate(e.created_at)} – ${escapeHtml(e.phase||'Napi bejegyzés')}</h2><p>${escapeHtml(e.note||'').replace(/\n/g,'<br>')}</p><p><b>Időjárás:</b> ${weather || 'nincs adat'} ${gps ? '<br><b>GPS/hely:</b> '+escapeHtml(gps) : ''}</p>${Array.isArray(mats)&&mats.length?`<p><b>Napi anyag:</b> ${mats.map(m=>`${escapeHtml(m.name)} ${escapeHtml(m.quantity)} ${escapeHtml(m.unit)}`).join(', ')}</p>`:''}<div class="photos">${images.map(src=>`<img src="${src}" alt="Napló fotó">`).join('')}</div>${videos.length ? `<h3>Munkavideók</h3><div class="videos">${videos.map(v=> v?.path ? `<video controls playsinline preload="metadata" data-video-path="${escapeHtml(v.path)}"></video>` : `<video controls playsinline preload="metadata" src="${escapeHtml(v.src || v)}"></video>`).join('')}</div>` : ''}</section>`;
  }).join('') || '<p>Nincs bejegyzés.</p>';
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#111;margin:0;padding:28px;line-height:1.45}.cover{border-bottom:4px solid #f5a400;margin-bottom:20px;padding-bottom:16px}.muted{color:#555}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0}.stat{background:#f3f4f6;border-radius:10px;padding:12px}.stat b{display:block;font-size:22px;color:#d97706}.entry{break-inside:avoid;border-left:4px solid #f5a400;background:#fafafa;margin:14px 0;padding:12px 16px}.photos{display:flex;flex-wrap:wrap;gap:8px}.photos img{max-width:190px;max-height:145px;object-fit:cover;border-radius:8px;border:1px solid #ddd}.videos{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:10px}.videos video{width:100%;max-height:280px;border-radius:10px;border:1px solid #ddd;background:#111}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border-bottom:1px solid #ddd;text-align:left;padding:8px}@media print{button{display:none}.entry{page-break-inside:avoid}}</style></head><body><div class="cover"><h1>${escapeHtml(title)}</h1><p class="muted">Generálva: ${new Date().toLocaleString('hu-HU')} • ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>${entries.length}</b>bejegyzés</div><div class="stat"><b>${entries.reduce((s,e)=>s+getEntryImages(e).length,0)}</b>fotó</div><div class="stat"><b>${entries.reduce((s,e)=>s+getEntryVideos(e).length,0)}</b>videó</div><div class="stat"><b>${materials.length}</b>anyag sor</div><div class="stat"><b>${invoiceSum.toLocaleString('hu-HU')} Ft</b>számlák</div></div></div><h2>Anyagösszesítő</h2><ul>${materialHtml}</ul><h2>Számlák</h2><table><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr>${invoiceHtml}</table><h2>Napi bejegyzések</h2>${entriesHtml}</body></html>`;
}

async function downloadWeeklyReportHtml(){
  const now = new Date(); const weekAgo = new Date(); weekAgo.setDate(now.getDate()-7);
  const entries = detailState.entries.filter(e => new Date(e.created_at) >= weekAgo);
  const data = await window.EpitesNaploAPI.getProjectCloseData(detailState.project.id);
  const title = `${detailState.project?.name || 'Projekt'} – heti építési napló`;
  downloadTextFile(`${safeFileName(title)}.html`, buildProReportHtml(entries, title, data));
  showToast('✔ Heti riport HTML letöltve. Böngészőből PDF-be nyomtatható.', 'ok');
}

async function downloadClosingReportHtml(){
  const data = await window.EpitesNaploAPI.getProjectCloseData(detailState.project.id);
  const title = `${detailState.project?.name || 'Projekt'} – lezáró dokumentum`;
  downloadTextFile(`${safeFileName(title)}.html`, buildProReportHtml(data.entries, title, data));
  showToast('✔ Lezáró riport HTML letöltve. Böngészőből PDF-be menthető.', 'ok');
}

// V24: felülírjuk a mentést úgy, hogy előtte/utána képek külön JSON mezőként is átmenjenek, ha a Supabase oszlop létezik.
saveDailyEntry = async function(){
  if (!detailState.project) return alert('Nincs kiválasztott projekt.');
  const noteBase = qs('detailNote').value.trim();
  if (!noteBase) return alert('Írd be a mai napló leírását.');
  await ensureWeatherAndGpsBeforeSave();

  const date = qs('detailDate').value || new Date().toISOString().slice(0, 10);
  const phase = getSelectedWorkPhaseV34();
  const status = qs('detailStatus').value;
  const priority = qs('detailPriority').value;
  const responsible = qs('detailResponsible').value.trim() || 'Nincs megadva';
  const weather = qs('detailWeather').value.trim() || qs('weatherAutoText')?.value?.trim() || 'Nincs megadva';
  const gpsText = qs('detailGps')?.value.trim() || '';
  const materials = collectMaterials();
  const beforeImages = await readFilesAsDataUrls(qs('beforeFiles')?.files, 5);
  const afterImages = await readFilesAsDataUrls(qs('afterFiles')?.files, 5);
  const generalImages = await readFilesAsDataUrls(qs('detailFiles')?.files, 10);
  const videos = await uploadVideoFilesToStorage(qs('detailVideos')?.files, 2);
  const materialText = materials.length ? `\n\nAnyagfelhasználás:\n${materials.map(m => `- ${m.name}: ${m.quantity} ${m.unit}${m.note ? ' (' + m.note + ')' : ''}`).join('\n')}` : '';
  const weatherText = (v19WeatherJson || qs('weatherAutoText')?.value) ? `\n\nAutomatikus időjárás: ${qs('weatherAutoText')?.value || ''}` : '';
  const gpsNote = gpsText ? `\nGPS/helyadat: ${gpsText}` : '';
  const beforeAfterText = (beforeImages.length ? `\nElőtte fotó: ${beforeImages.length} db` : '') + (afterImages.length ? `\nUtána fotó: ${afterImages.length} db` : '') + (videos.length ? `\nMunkavideó: ${videos.length} db` : '');
  const note = `Dátum: ${date}\n${noteBase}${beforeAfterText}${materialText}${weatherText}${gpsNote}`;
  const images = [...beforeImages, ...afterImages, ...generalImages];
  let analysis = analyzeEntry({
    note,
    phase,
    status,
    priority,
    materials,
    images,
    before: beforeImages,
    after: afterImages,
    general: generalImages,
    videos,
    imageCount: images.length,
    beforeImageCount: beforeImages.length,
    afterImageCount: afterImages.length,
    videoCount: videos.length
  });
  if (images.length && window.EpitesNaploAPI?.analyzePhotoWithAI) {
    try {
      showToast('AI kép + szöveg kontroll készítése...', 'info');
      const vision = await window.EpitesNaploAPI.analyzePhotoWithAI({
        projectId: detailState.project.id,
        note,
        phase,
        status,
        priority,
        imageCount: images.length,
        beforeImageCount: beforeImages.length,
        afterImageCount: afterImages.length,
        videoCount: videos.length,
        images: images.slice(0, 3)
      });
      if (vision?.ok && vision.analysis) analysis = { ...analysis, ...vision.analysis, localAiVersion: 'v60-vision-text' };
    } catch (err) {
      console.warn('AI kép + szöveg kontroll helyi módra váltott:', err);
    }
  }
  analysis.videos = videos;
  qs('detailAiPreview').classList.remove('hidden');
  qs('detailAiPreview').innerHTML = `<b>AI kép + szöveg kontroll:</b> ${escapeHtml(analysis.level)} – ${escapeHtml(analysis.title)}<br><small>${escapeHtml(analysis.photoTextCheck || analysis.nextStep || analysis.advice?.[0] || '')}</small>`;

  const saved = await window.EpitesNaploAPI.saveEntry({
    projectId: detailState.project.id, phase, status, priority, responsible, weather, note,
    images, beforeImages, afterImages, generalImages, videos, videoUrls: videos, image: images[0] || '', analysis, materials,
    weatherJson: v19WeatherJson, gpsJson: v19GpsJson || (gpsText ? { text: gpsText, captured_at: new Date().toISOString() } : null)
  });
  if (!saved?.id) throw new Error('A naplóbejegyzés nem kapott mentett azonosítót. Ellenőrizd a Supabase kapcsolatot.');
  qs('detailNote').value = ''; qs('detailFiles').value = ''; if(qs('beforeFiles')) qs('beforeFiles').value = ''; if(qs('afterFiles')) qs('afterFiles').value = ''; if(qs('detailVideos')) qs('detailVideos').value = ''; clearMaterialRows();
  v19WeatherJson = null; v19GpsJson = null; if(qs('weatherAutoText')) qs('weatherAutoText').value = ''; if(qs('detailGps')) qs('detailGps').value = '';
  await reloadProjectEntries();
  showToast('✔ Full PRO mentés kész: napló + fotók + anyag + időjárás/GPS.', 'ok');
  qs('projectTimeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ===== v25 KÖVETKEZŐ SZINT PRO: élő PayPal készítés, valódi AI edge, profi PDF, ügyfél link =====
function v25ProjectFileName(text){
  return String(text || 'epitesi-naplo').toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óöőòô]/g,'o').replace(/[úüűùû]/g,'u')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'epitesi-naplo';
}

async function waitForReportImagesV70(root){
  const imgs = Array.from(root.querySelectorAll('img')).filter(img => img.src);
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      try { img.crossOrigin = img.crossOrigin || 'anonymous'; } catch(_) {}
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(resolve, 2500);
    });
  }));
  await new Promise(resolve => setTimeout(resolve, 250));
}

async function exportReportHtmlToPdfV25(html, filename){
  const wrap = document.createElement('div');
  wrap.className = 'v25PdfStage v70PdfStage';
  wrap.style.cssText = 'background:#fff;color:#111;padding:18px;max-width:900px;margin:0 auto;font-family:Arial,sans-serif;line-height:1.45;';
  wrap.innerHTML = html;
  wrap.querySelectorAll('script,.reportMediaOpen,.reportMediaPending').forEach(el => el.remove());
  document.body.appendChild(wrap);
  try{
    await waitForReportImagesV70(wrap);
    if(window.html2pdf){
      await html2pdf().set({
        margin: 8,
        filename,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false, imageTimeout: 8000 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], before: '.v70PageBreakBefore' }
      }).from(wrap).save();
      showToast('✔ Profi PDF export elkészült.', 'ok');
    } else {
      const w = window.open('', '_blank');
      w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 500);
    }
  } finally { setTimeout(()=>wrap.remove(), 1000); }
}


async function exportClosingPdfV25(){
  if(!detailState.project) return alert('Nincs projekt.');
  const data = await window.EpitesNaploAPI.getProjectCloseData(detailState.project.id);
  const title = `${detailState.project?.name || 'Projekt'} – lezáró PRO építési napló`;
  const html = buildProReportHtml(data.entries, title, data);
  await exportReportHtmlToPdfV25(html, `${v25ProjectFileName(title)}.pdf`);
}

async function exportWeeklyPdfV25(){
  if(!detailState.project) return alert('Nincs projekt.');
  const now = new Date(); const weekAgo = new Date(); weekAgo.setDate(now.getDate()-7);
  const entries = detailState.entries.filter(e => new Date(e.created_at) >= weekAgo);
  const data = await window.EpitesNaploAPI.getProjectCloseData(detailState.project.id);
  const title = `${detailState.project?.name || 'Projekt'} – heti PRO építési napló`;
  const html = buildProReportHtml(entries, title, data);
  await exportReportHtmlToPdfV25(html, `${v25ProjectFileName(title)}.pdf`);
}

// régi Heti PDF gombot is valódi PDF exportra kötjük
printWeeklyReport = exportWeeklyPdfV25;
printClosingDocument = exportClosingPdfV25;

async function createProjectClientLinkV25(){
  if(!detailState.project) return alert('Nincs projekt.');
  try{
    const data = await window.EpitesNaploAPI.getProjectCloseData(detailState.project.id);
    const title = `${detailState.project?.name || 'Projekt'} – ügyfélriport`;
    const reportHtml = buildProReportHtml(data.entries, title, data);
    const text = `${title}\nBejegyzések: ${data.entries.length}\nSzámlák: ${data.invoices.reduce((s,i)=>s+Number(i.amount||0),0).toLocaleString('hu-HU')} Ft`;
    const saved = await window.EpitesNaploAPI.createPublicReport({ projectId: detailState.project.id, projectName: detailState.project.name || '', reportHtml, reportText: text });
    const link = window.EpitesNaploAPI.createClientShareUrl(saved.token);
    await navigator.clipboard.writeText(link);
    showProjectHelp('Ügyfél link elkészült', `<div class="featureHelpBox"><b>Biztonságos ügyfél link</b><p>A link kimásolva a vágólapra. Az ügyfél meg tudja nyitni, PDF-et tölthet le, és jóváhagyhatja a riportot.</p><p><a class="btn primary" target="_blank" href="${escapeHtml(link)}">Ügyfélriport megnyitása</a></p><p class="muted">${escapeHtml(link)}</p></div>`);
  }catch(err){
    console.error(err);
    alert('Ügyfél link létrehozási hiba: ' + (err.message || err));
  }
}

// Valódi AI generálás: először Supabase Edge Function, ha nincs deployolva/API kulcs, stabil helyi fallback.
generateDailyAiText = async function(){
  const phase = getSelectedWorkPhaseV34();
  const status = qs('detailStatus')?.value || '';
  const priority = qs('detailPriority')?.value || '';
  const responsible = qs('detailResponsible')?.value || 'kivitelező csapat';
  const weather = qs('detailWeather')?.value || qs('weatherAutoText')?.value || 'nincs külön időjárási adat';
  const note = qs('detailNote')?.value || '';
  const materials = collectMaterials ? collectMaterials() : [];
  const matText = materials.length ? `\nFelhasznált anyagok: ${materials.map(m=>`${m.name} ${m.quantity} ${m.unit}`).join(', ')}.` : '';
  try{
    if(window.EpitesNaploAPI?.generateAiDailyReport){
      showToast('AI napi jelentés készítése...', 'ok');
      const res = await window.EpitesNaploAPI.generateAiDailyReport({ projectName: detailState.project?.name || '', phase, status, priority, responsible, weather, note, materials });
      if(res?.text){
        qs('detailNote').value = note.trim() ? `${note.trim()}\n\n${res.text}` : res.text;
        showToast('✔ Valódi AI napi jelentés elkészült.', 'ok');
        return;
      }
    }
  }catch(err){ console.warn('AI edge fallback:', err); }
  const generated = `Mai munkanapló – ${phase}\n\nA mai napon a(z) ${phase.toLowerCase()} munkafázishoz kapcsolódó feladatok történtek. A munkavégzés felelőse: ${responsible}. A státusz: ${status}, a prioritás: ${priority}.\n\nHelyszíni körülmény / időjárás: ${weather}.${matText}\n\nÜgyfélbarát összegzés: a munkát fotókkal, anyagfelhasználással, időjárási adattal és szükség esetén GPS helyadattal dokumentáltuk. Vita esetén ez később visszakereshető bizonyítékként szolgál.`;
  qs('detailNote').value = note.trim() ? `${note.trim()}\n\n${generated}` : generated;
  showToast('✔ AI napi jelentés elkészült helyi módban.', 'ok');
};


// ===== v27 PLAN FIX + PÉNZKAPU: mindig betölti a csomagot és lezárja a fizetős funkciókat =====
window.userPlan = window.userPlan || 'loading';
window.userPlanStatus = window.userPlanStatus || 'loading';
window.userIsAdmin = window.userIsAdmin || false;
window.__epitesNaploPlanPromise = null;

function v27NormalizePlan(plan){
  const p = String(plan || '').toLowerCase().trim();
  if(['starter','pro','business'].includes(p)) return p;
  if(['trial','free','próba','probaverzio',''].includes(p)) return 'trial';
  return 'trial';
}
function v27IsPaidPlan(plan, status){
  const p = v27NormalizePlan(plan);
  const st = String(status || 'active').toLowerCase();
  if(window.userIsAdmin) return true;
  return ['starter','pro','business'].includes(p) && !['expired','inactive','cancelled','canceled'].includes(st);
}
async function loadUserPlanV27(force=false){
  if(!force && window.__epitesNaploPlanPromise) return window.__epitesNaploPlanPromise;
  window.__epitesNaploPlanPromise = (async()=>{
    try{
      const api = window.EpitesNaploAPI;
      const user = detailState.user || await api?.getCurrentUser?.();
      if(!user){
        window.userPlan = 'trial';
        window.userPlanStatus = 'guest';
        window.userIsAdmin = false;
        return window.userPlan;
      }
      let profile = null;
      let sub = null;
      try { profile = await api.getProfile(); } catch(e) { console.warn('V27 profil betöltési figyelmeztetés:', e); }
      try { sub = await api.getSubscription(); } catch(e) { console.warn('V27 előfizetés betöltési figyelmeztetés:', e); }
      window.userIsAdmin = !!(profile?.is_admin || user.email === window.EPITESNAPLO_CONFIG?.adminEmail);
      const rawPlan = sub?.plan || profile?.plan || 'trial';
      const rawStatus = sub?.status || profile?.plan_status || 'active';
      window.userPlan = window.userIsAdmin ? 'business' : v27NormalizePlan(rawPlan);
      window.userPlanStatus = window.userIsAdmin ? 'active' : rawStatus;
      console.log('USER PLAN:', window.userPlan, 'STATUS:', window.userPlanStatus, 'ADMIN:', window.userIsAdmin);
      v27ApplyPaidUiState();
      return window.userPlan;
    }catch(err){
      console.warn('V27 plan hiba, trial mód:', err);
      window.userPlan = 'trial';
      window.userPlanStatus = 'active';
      window.userIsAdmin = false;
      v27ApplyPaidUiState();
      return window.userPlan;
    }
  })();
  return window.__epitesNaploPlanPromise;
}
async function requirePaidPlanV27(featureName='Ez a funkció'){
  await loadUserPlanV27();
  if(v27IsPaidPlan(window.userPlan, window.userPlanStatus)) return true;
  showProjectHelp('PRO funkció', `<div class="featureHelpBox"><b>${escapeHtml(featureName)} fizetős funkció.</b><p>Ez a rész Starter / Pro / Business csomagban használható.</p><p>Ingyenes próba módban a napló alap funkciói működnek, de az AI, PDF export és ügyfélriport link már fizetős érték.</p><p><a class="btn primary" href="index.html#pricing">Csomag választása</a></p></div>`);
  return false;
}
function v27ApplyPaidUiState(){
  const paid = v27IsPaidPlan(window.userPlan, window.userPlanStatus);
  const paidSelectors = [
    '[onclick="generateDailyAiText()"]',
    '[onclick="exportClosingPdfV25()"]',
    '[onclick="createProjectClientLinkV25()"]',
    '[onclick="printWeeklyReport()"]',
    '[onclick="downloadWeeklyReportHtml()"]',
    '[onclick="printClosingDocument()"]',
    '[onclick="downloadClosingReportHtml()"]'
  ];
  paidSelectors.forEach(sel => document.querySelectorAll(sel).forEach(btn => {
    btn.dataset.proLocked = paid ? '0' : '1';
    btn.title = paid ? 'Aktív fizetős funkció' : 'Fizetős funkció: Starter / Pro / Business csomag szükséges';
    btn.classList.toggle('proLockedBtn', !paid);
  }));
}

const v27OldGenerateDailyAiText = generateDailyAiText;
generateDailyAiText = async function(){
  if(!(await requirePaidPlanV27('AI napi jelentés generálása'))) return;
  return v27OldGenerateDailyAiText.apply(this, arguments);
};
const v27OldExportClosingPdfV25 = exportClosingPdfV25;
exportClosingPdfV25 = async function(){
  if(!(await requirePaidPlanV27('Profi PDF export'))) return;
  return v27OldExportClosingPdfV25.apply(this, arguments);
};
const v27OldExportWeeklyPdfV25 = exportWeeklyPdfV25;
exportWeeklyPdfV25 = async function(){
  if(!(await requirePaidPlanV27('Heti PDF export'))) return;
  return v27OldExportWeeklyPdfV25.apply(this, arguments);
};
printWeeklyReport = exportWeeklyPdfV25;
printClosingDocument = exportClosingPdfV25;
const v27OldDownloadWeeklyReportHtml = downloadWeeklyReportHtml;
downloadWeeklyReportHtml = async function(){
  if(!(await requirePaidPlanV27('Heti riport letöltés'))) return;
  return v27OldDownloadWeeklyReportHtml.apply(this, arguments);
};
const v27OldDownloadClosingReportHtml = downloadClosingReportHtml;
downloadClosingReportHtml = async function(){
  if(!(await requirePaidPlanV27('Lezáró riport letöltés'))) return;
  return v27OldDownloadClosingReportHtml.apply(this, arguments);
};
const v27OldCreateProjectClientLinkV25 = createProjectClientLinkV25;
createProjectClientLinkV25 = async function(){
  if(!(await requirePaidPlanV27('Ügyfél link + jóváhagyás'))) return;
  return v27OldCreateProjectClientLinkV25.apply(this, arguments);
};

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => loadUserPlanV27(true), 350);
  setTimeout(v27ApplyPaidUiState, 900);
});


// ===== v29 PRIVÁT MUNKAVIDEÓK: telefonos videó feltöltés naplóhoz és ügyfélriporthoz =====

// ===== V32 PROFI PROJEKT NAPLO: feltoltesi allapot, media kategoriak, atadasi riport =====
function v32ProjectMedia(entry) {
  const before = Array.isArray(entry.beforeImages) && entry.beforeImages.length
    ? entry.beforeImages
    : (Array.isArray(entry.before_images_json) ? entry.before_images_json : (Array.isArray(entry.ai_json?.beforeImages) ? entry.ai_json.beforeImages : []));
  const after = Array.isArray(entry.afterImages) && entry.afterImages.length
    ? entry.afterImages
    : (Array.isArray(entry.after_images_json) ? entry.after_images_json : (Array.isArray(entry.ai_json?.afterImages) ? entry.ai_json.afterImages : []));
  const generalSaved = Array.isArray(entry.generalImages) && entry.generalImages.length
    ? entry.generalImages
    : (Array.isArray(entry.general_images_json) ? entry.general_images_json : (Array.isArray(entry.ai_json?.generalImages) ? entry.ai_json.generalImages : []));
  const allImages = getEntryImages(entry);
  const known = new Set([...before, ...after, ...generalSaved]);
  const general = generalSaved.length ? generalSaved : allImages.filter(src => !known.has(src));
  return { before, after, general, videos: getEntryVideos(entry) };
}

function v32MediaSection(title, items, type = 'image') {
  if (!items.length) return '';
  const html = type === 'video'
    ? items.map(v => renderMediaVideo(v, title)).join('')
    : items.map(src => renderMediaImage(src, title)).join('');
  return `<div class="v32TimelineMedia"><b>${escapeHtml(title)}</b><div class="${type === 'video' ? 'entryVideoGrid' : 'entryImageGrid detailImages'}">${html}</div></div>`;
}

function v32SetUploadStatus(message, type = 'info') {
  let box = qs('v32UploadStatus');
  if (!box) {
    const upload = document.querySelector('.videoUploadBox') || qs('detailFiles');
    if (!upload?.parentNode) return;
    box = document.createElement('div');
    box.id = 'v32UploadStatus';
    box.className = 'v32UploadStatus';
    upload.parentNode.insertBefore(box, upload.nextSibling);
  }
  box.className = `v32UploadStatus ${type}`;
  box.innerHTML = message;
}

function v32InitUploadPanel() {
  if (qs('v32UploadStatus')) return;
  v32SetUploadStatus('<b>Feltoltesre kesz.</b><br>Valassz fotokat vagy videot, majd mentsd a napi bejegyzest.', 'info');
  ['beforeFiles', 'afterFiles', 'detailFiles', 'detailVideos'].forEach(id => {
    qs(id)?.addEventListener('change', () => {
      const imgCount = (qs('beforeFiles')?.files?.length || 0) + (qs('afterFiles')?.files?.length || 0) + (qs('detailFiles')?.files?.length || 0);
      const videoCount = qs('detailVideos')?.files?.length || 0;
      v32SetUploadStatus(`<b>Kivalasztva:</b> ${imgCount} foto, ${videoCount} video.<br>Mentes utan a riportban kategoriak szerint jelennek meg.`, 'info');
    });
  });
}

const v32OldUploadVideoFilesToStorage = uploadVideoFilesToStorage;
uploadVideoFilesToStorage = async function(fileList, max = 2) {
  const files = Array.from(fileList || []).filter(isSupportedVideoFile).slice(0, max);
  if (!files.length) return [];
  v32SetUploadStatus(`<b>Video feltoltes indul...</b><br>${files.length} video elokeszitese.`, 'info');
  const uploaded = await v32OldUploadVideoFilesToStorage(fileList, max);
  v32SetUploadStatus(`<b>Video feltoltes kesz.</b><br>${uploaded.length} / ${files.length} video sikeresen mentve.`, uploaded.length === files.length ? 'ok' : 'warn');
  return uploaded;
};

const v32OldSaveDailyEntry = saveDailyEntry;
saveDailyEntry = async function() {
  const beforeCount = qs('beforeFiles')?.files?.length || 0;
  const afterCount = qs('afterFiles')?.files?.length || 0;
  const generalCount = qs('detailFiles')?.files?.length || 0;
  const videoCount = qs('detailVideos')?.files?.length || 0;
  v32SetUploadStatus(`<b>Mentes folyamatban...</b><br>${beforeCount + afterCount + generalCount} foto es ${videoCount} video feldolgozasa.`, 'info');
  try {
    await v32OldSaveDailyEntry.apply(this, arguments);
    v32SetUploadStatus('<b>Mentes kesz.</b><br>A fotok, videok es naploadatok bekerultek a projektbe es az ugyfelriportba.', 'ok');
  } catch (err) {
    v32SetUploadStatus(`<b>Mentesi hiba.</b><br>${escapeHtml(err.message || err)}`, 'error');
    throw err;
  }
};

renderProjectTimeline = function(){
  const filter = qs('timelineRiskFilter')?.value || 'all';
  let entries = [...detailState.entries];
  if (filter !== 'all') entries = entries.filter(e => (e.analysis?.level || e.ai_level || 'Alacsony') === filter);
  qs('projectTimeline').innerHTML = entries.map(entry => {
    const level = entry.analysis?.level || entry.ai_level || 'Alacsony';
    const title = entry.analysis?.title || entry.ai_title || 'Elemzes';
    const media = v32ProjectMedia(entry);
    const mats = entry.materials_json || entry.analysis?.materials || [];
    const weatherJson = entry.weather_json || entry.analysis?.weatherJson || null;
    return `<article class="timelineEntry v32TimelineEntry">
      <div class="timelineDate"><b>${formatDate(entry.created_at)}</b><span>${escapeHtml(entry.phase || '')}</span></div>
      <div class="timelineBody">
        ${v32MediaSection('Elotte fotok', media.before)}
        ${v32MediaSection('Munka kozben / dokumentacio', media.general)}
        ${v32MediaSection('Utana fotok', media.after)}
        ${v32MediaSection('Munkavideok', media.videos, 'video')}
        <p>${escapeHtml(entry.note || '')}</p>
        <div class="tagRow"><span class="tag ${riskClass(level)}">AI: ${escapeHtml(level)}</span><span class="tag ai">${escapeHtml(title)}</span><span class="tag">${escapeHtml(entry.status || '')}</span><span class="tag">${media.before.length + media.general.length + media.after.length} foto</span><span class="tag">${media.videos.length} video</span></div>
        ${weatherJson ? `<div class="miniInfo">${escapeHtml(weatherJson.temperature || '')} C, ${escapeHtml(weatherJson.text || '')}, szel: ${escapeHtml(weatherJson.wind || '')} km/h</div>` : ''}
        ${Array.isArray(mats) && mats.length ? `<div class="miniInfo"><b>Anyag:</b> ${mats.map(m => typeof m === 'object' ? `${escapeHtml(m.name)} ${escapeHtml(m.quantity)} ${escapeHtml(m.unit)}` : escapeHtml(m)).join(', ')}</div>` : ''}
        ${entry.analysis?.advice?.length ? `<div class="aiAdviceBox"><b>AI javaslat:</b><ul>${entry.analysis.advice.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul></div>` : ''}
      </div></article>`;
  }).join('') || '<p class="muted">Meg nincs napi bejegyzes ehhez a projekthez.</p>';
};

const v32OldBuildProReportHtml = buildProReportHtml;
buildProReportHtml = function(entries, title, options = {}) {
  const materials = options.materials || [];
  const invoices = options.invoices || [];
  const invoiceSum = invoices.reduce((s,i)=>s+Number(i.amount||0),0);
  const photos = entries.reduce((s,e)=>s+getEntryImages(e).length,0);
  const videos = entries.reduce((s,e)=>s+getEntryVideos(e).length,0);
  const risky = entries.filter(e => (e.analysis?.level || e.ai_level) === 'Magas').length;
  const materialTotals = {};
  materials.forEach(m=>{ const key=`${m.name||'Anyag'}|${m.unit||'db'}`; materialTotals[key]=(materialTotals[key]||0)+Number(m.quantity||0); });
  const materialHtml = Object.entries(materialTotals).map(([key,qty])=>{ const [name,unit]=key.split('|'); return `<li><b>${escapeHtml(name)}</b>: ${Number(qty.toFixed(2))} ${escapeHtml(unit)}</li>`; }).join('') || '<li>Nincs rogzitett anyag.</li>';
  const invoiceHtml = invoices.map(i=>`<tr><td>${escapeHtml(i.title)}</td><td>${Number(i.amount||0).toLocaleString('hu-HU')} Ft</td><td>${escapeHtml(i.note||'')}</td></tr>`).join('') || '<tr><td colspan="3">Nincs csatolt szamla.</td></tr>';
  const entriesHtml = entries.map(e=>{
    const media = v32ProjectMedia(e);
    const weather = e.weather_json ? `${escapeHtml(e.weather_json.temperature)} C, ${escapeHtml(e.weather_json.text)}, szel: ${escapeHtml(e.weather_json.wind)} km/h` : escapeHtml(e.weather || '');
    const gps = e.gps_json?.text || (e.gps_json?.lat ? `${e.gps_json.lat}, ${e.gps_json.lon}` : '');
    const mediaBlock = [
      v32MediaSection('Elotte fotok', media.before),
      v32MediaSection('Munka kozben / dokumentacio', media.general),
      v32MediaSection('Utana fotok', media.after),
      v32MediaSection('Munkavideok', media.videos, 'video')
    ].join('');
    return `<section class="entry"><h2>${formatDate(e.created_at)} - ${escapeHtml(e.phase||'Napi bejegyzes')}</h2><p>${escapeHtml(e.note||'').replace(/\n/g,'<br>')}</p><p><b>Idojaras:</b> ${weather || 'nincs adat'} ${gps ? '<br><b>GPS/hely:</b> '+escapeHtml(gps) : ''}</p>${mediaBlock}</section>`;
  }).join('') || '<p>Nincs bejegyzes.</p>';
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#111;margin:0;padding:28px;line-height:1.45}.cover{border-bottom:4px solid #f5a400;margin-bottom:20px;padding-bottom:16px}.pill{display:inline-block;background:#fff3cd;color:#7c4a00;border-radius:999px;padding:6px 10px;font-weight:700}.muted{color:#555}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0}.stat{background:#f3f4f6;border-radius:10px;padding:12px}.stat b{display:block;font-size:22px;color:#d97706}.entry{break-inside:avoid;border-left:4px solid #f5a400;background:#fafafa;margin:14px 0;padding:12px 16px}.entryImageGrid,.reportImageGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.entryImageGrid img,.reportImageGrid img{width:100%;height:150px;object-fit:cover;border-radius:8px;border:1px solid #ddd}.entryVideoGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.entryVideoGrid video{width:100%;max-height:280px;border-radius:10px;border:1px solid #ddd;background:#111}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border-bottom:1px solid #ddd;text-align:left;padding:8px}h5{margin:14px 0 8px}@media print{button{display:none}.entry{page-break-inside:avoid}}</style></head><body><div class="cover"><span class="pill">Atadasra kesz dokumentacio</span><h1>${escapeHtml(title)}</h1><p class="muted">Generalva: ${new Date().toLocaleString('hu-HU')} - EpitesNaplo AI PRO</p><div class="stats"><div class="stat"><b>${entries.length}</b>bejegyzes</div><div class="stat"><b>${photos}</b>foto</div><div class="stat"><b>${videos}</b>video</div><div class="stat"><b>${risky}</b>magas kockazat</div><div class="stat"><b>${invoiceSum.toLocaleString('hu-HU')} Ft</b>szamlak</div></div></div><h2>Rovid osszegzes</h2><p>A dokumentum az ugyfelnek atadhato, rendezett epitesi naplo: napi munkak, fotok, videok, anyagok, idojaras/GPS es nyitott ellenorzesek egy helyen.</p><h2>Anyagosszesito</h2><ul>${materialHtml}</ul><h2>Szamlak</h2><table><tr><th>Megnevezes</th><th>Osszeg</th><th>Megjegyzes</th></tr>${invoiceHtml}</table><h2>Napi bejegyzesek</h2>${entriesHtml}</body></html>`;
};

const v32OldCreateProjectClientLinkV25 = createProjectClientLinkV25;
createProjectClientLinkV25 = async function() {
  if (typeof requirePaidPlanV27 === 'function' && !(await requirePaidPlanV27('Ugyfel link + jovahagyas'))) return;
  return v32OldCreateProjectClientLinkV25.apply(this, arguments);
};

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(v32InitUploadPanel, 450);
});

// ===== V33: gyors mobilos munkafolyamat, tarhely, archivum, szerepkorok =====
function v33BytesToMb(bytes) {
  return (Number(bytes || 0) / 1024 / 1024).toFixed(1) + ' MB';
}

function v33MediaBytes(entries = []) {
  let imageBytes = 0;
  let videoBytes = 0;
  entries.forEach(entry => {
    getEntryImages(entry).forEach(src => {
      if (String(src || '').startsWith('data:')) imageBytes += Math.round(String(src).length * 0.75);
    });
    getEntryVideos(entry).forEach(video => {
      if (video && typeof video === 'object') videoBytes += Number(video.size || 0);
    });
  });
  return { imageBytes, videoBytes, totalBytes: imageBytes + videoBytes };
}

function v33CustomerFriendlyText(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  let lead = 'A mai munkafolyamat dokumentalva lett.';
  if (/vizes|nedves|beazas|penesz|azik/.test(lower)) lead = 'A felulet szaradasa es nedvessegi ellenorzese folyamatban van.';
  if (/glett|vakol|fest/.test(lower)) lead = 'A felulet elokeszitese folyamatban van, a kovetkezo munkafazis a felulet veglegesitese.';
  if (/reped|hasad/.test(lower)) lead = 'A repedes dokumentalva lett, a kovetkezo lepes az ok ellenorzese es a javitas meghatarozasa.';
  return `${lead}\n\nUgyfelbarat osszegzes: ${text.replace(/\s+/g, ' ')}\n\nKovetkezo lepes: a munka allapota a csatolt fotokkal es videokkal ellenorizheto.`;
}

function v33InjectProjectPanels() {
  const dailyCard = qs('dailyFormCard');
  if (dailyCard && !qs('v33QuickPanel')) {
    const quick = document.createElement('section');
    quick.id = 'v33QuickPanel';
    quick.className = 'card v33QuickPanel';
    quick.innerHTML = `
      <div class="sectionTop slim"><div><h2>Gyors mobilos mentés</h2><p class="muted">Telefonon: fotó, két sor leírás, mentés. A teljes űrlap lent továbbra is használható.</p></div></div>
      <div class="formGrid compactForm">
        <select id="v33QuickPhase"><option>Munka közben</option><option>Előtte állapot</option><option>Utána állapot</option><option>Hiba / eltérés</option><option>Javítás</option><option>Átadás</option></select>
        <select id="v33QuickStatus"><option>Folyamatban</option><option>Ellenőrzésre vár</option><option>Javítás szükséges</option><option>Kész</option></select>
      </div>
      <textarea id="v33QuickNote" rows="4" placeholder="Rövid napi jegyzet..."></textarea>
      <input id="v33QuickFiles" type="file" accept="image/*,video/*" multiple />
      <div class="v33QuickActions"><button class="btn ghost" type="button" onclick="v33FillFriendlyNote()">AI ügyfélszöveg</button><button class="btn primary" type="button" onclick="v33SaveQuickEntry()">Gyors mentés</button></div>
      <div id="v33QuickStatusBox" class="v32UploadStatus hidden"></div>
    `;
    dailyCard.before(quick);
  }

  const summary = qs('projectSummaryBox');
  if (summary && !qs('v33StorageBox')) {
    const box = document.createElement('div');
    box.id = 'v33StorageBox';
    box.className = 'v33StorageBox';
    summary.after(box);
  }

  const smart = qs('smartNotificationBox');
  if (smart && !qs('v33RoleBox')) {
    const role = document.createElement('div');
    role.id = 'v33RoleBox';
    role.className = 'v33RoleBox';
    role.innerHTML = `
      <div class="notice"><b>Szerepkörök</b><p class="muted">Admin mindent kezel, munkatárs naplózhat, ügyfél csak riportot nézhet.</p>
      <div class="formGrid"><input id="v33MemberEmail" placeholder="munkatars@email.hu" /><select id="v33MemberRole"><option value="worker">Munkatárs</option><option value="client">Ügyfél</option><option value="admin">Admin</option></select></div>
      <button class="btn ghost full" type="button" onclick="v33AddProjectMember()">Szerepkör mentése</button><div id="v33MemberList" class="list"></div></div>
    `;
    smart.after(role);
  }
  v33RenderStorageBox();
  v33LoadMembers();
}

function v33SetQuickStatus(message, type = 'info') {
  const box = qs('v33QuickStatusBox');
  if (!box) return;
  box.className = `v32UploadStatus ${type}`;
  box.classList.remove('hidden');
  box.innerHTML = message;
}

function v33FillFriendlyNote() {
  const note = qs('v33QuickNote');
  if (!note) return;
  note.value = v33CustomerFriendlyText(note.value);
  note.focus();
}

async function v33SaveQuickEntry() {
  if (!detailState.project) return alert('Nincs kiválasztott projekt.');
  const noteBase = qs('v33QuickNote')?.value.trim() || '';
  if (!noteBase) return alert('Írj legalább egy rövid jegyzetet.');
  const files = Array.from(qs('v33QuickFiles')?.files || []);
  v33SetQuickStatus('<b>Gyors mentés folyamatban...</b><br>Fotók és videók feldolgozása.', 'info');
  const imageFiles = files.filter(file => String(file.type || '').startsWith('image/'));
  const videoFiles = files.filter(file => String(file.type || '').startsWith('video/'));
  const images = await readFilesAsDataUrls(imageFiles, 8);
  const videos = await uploadVideoFilesToStorage(videoFiles, 2);
  const phase = qs('v33QuickPhase')?.value || 'Munka közben';
  const status = qs('v33QuickStatus')?.value || 'Folyamatban';
  const note = `Dátum: ${new Date().toISOString().slice(0,10)}\n${noteBase}`;
  const analysis = analyzeEntry({ note, phase, status, priority: 'Közepes' });
  analysis.videos = videos;
  const saved = await window.EpitesNaploAPI.saveEntry({
    projectId: detailState.project.id,
    phase,
    status,
    priority: 'Közepes',
    responsible: 'Gyors mobilos mentés',
    weather: qs('detailWeather')?.value || 'Nincs megadva',
    note,
    images,
    generalImages: images,
    videos,
    videoUrls: videos,
    image: images[0] || '',
    analysis
  });
  if (!saved?.id) throw new Error('A gyors mentés nem kapott mentett azonosítót. Ellenőrizd a Supabase kapcsolatot.');
  qs('v33QuickNote').value = '';
  qs('v33QuickFiles').value = '';
  await reloadProjectEntries();
  v33SetQuickStatus(`<b>Gyors mentés kész.</b><br>${images.length} fotó és ${videos.length} videó bekerült a naplóba.`, 'ok');
}

function v33RenderStorageBox() {
  const box = qs('v33StorageBox');
  if (!box) return;
  const entries = detailState.entries || [];
  const photos = entries.reduce((s,e)=>s+getEntryImages(e).length,0);
  const videos = entries.reduce((s,e)=>s+getEntryVideos(e).length,0);
  const bytes = v33MediaBytes(entries);
  box.innerHTML = `
    <div class="notice"><b>Tárhely és projekt állapot</b>
      <div class="v33StorageGrid"><div><b>${photos}</b><span>fotó</span></div><div><b>${videos}</b><span>videó</span></div><div><b>${v33BytesToMb(bytes.totalBytes)}</b><span>becsült média</span></div></div>
      <button class="btn ghost full" type="button" onclick="v33ArchiveProject()">Projekt lezárása (nem törli)</button>
      <button class="btn primary full" type="button" onclick="v68DownloadProjectZip()">Projekt mentése ZIP-be (minden adattal + képpel)</button>
      <small class="muted">A lezárás csak a projekt állapotát állítja lezártra. A fotók, videók és naplóbejegyzések megmaradnak, nem kerülnek külön rejtett helyre.</small>
    </div>
  `;
}

async function v33ArchiveProject() {
  if (!detailState.project) return;
  if (!confirm('Biztosan lezárod ezt a projektet? Ez nem törli az adatokat, csak lezárt állapotra állítja.')) return;
  try {
    if (window.EpitesNaploAPI.updateProjectStatus) {
      await window.EpitesNaploAPI.updateProjectStatus(detailState.project.id, { status: 'lezarva', progress: 100 });
    }
    detailState.project.status = 'lezarva';
    detailState.project.progress = 100;
    updateProjectHeaderStatus?.();
    showToast('Projekt lezárva. Az adatok és képek megmaradtak.', 'ok');
  } catch (err) {
    alert('Projekt lezárási hiba: ' + (err.message || err));
  }
}

async function v33AddProjectMember() {
  if (!detailState.project) return;
  const email = qs('v33MemberEmail')?.value.trim() || '';
  const role = qs('v33MemberRole')?.value || 'worker';
  if (!email) return alert('Adj meg email címet.');
  try {
    if (window.EpitesNaploAPI.saveProjectMember) await window.EpitesNaploAPI.saveProjectMember(detailState.project.id, { email, role });
    else {
      const key = 'epitesnaplo_project_members_' + detailState.project.id;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.unshift({ email, role, status: 'local', created_at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(list));
    }
    qs('v33MemberEmail').value = '';
    await v33LoadMembers();
    showToast('Szerepkör mentve.', 'ok');
  } catch (err) {
    const msg = String(err.message || err || '');
    if (/project_members|relation|schema cache|does not exist/i.test(msg)) {
      const key = 'epitesnaplo_project_members_' + detailState.project.id;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.unshift({ email, role, status: 'local', created_at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(list));
      qs('v33MemberEmail').value = '';
      await v33LoadMembers();
      showToast('Szerepkör helyben mentve. A Supabase V33 SQL után adatbázisba is menthető lesz.', 'ok');
      return;
    }
    alert('Szerepkör mentési hiba: ' + msg);
  }
}

async function v33LoadMembers() {
  const box = qs('v33MemberList');
  if (!box || !detailState.project) return;
  let list = [];
  try { list = await window.EpitesNaploAPI.getProjectMembers(detailState.project.id); } catch (_) {}
  if (!list.length) {
    try { list = JSON.parse(localStorage.getItem('epitesnaplo_project_members_' + detailState.project.id) || '[]'); } catch (_) {}
  }
  box.innerHTML = list.map(m => `<div class="item"><div><b>${escapeHtml(m.email || '')}</b><small>${escapeHtml(m.role || 'worker')} - ${escapeHtml(m.status || 'invited')}</small></div></div>`).join('') || '<p class="muted">Még nincs hozzáadott munkatárs vagy ügyfél.</p>';
}

const v33OldRenderProjectSummary = renderProjectSummary;
renderProjectSummary = function() {
  v33OldRenderProjectSummary.apply(this, arguments);
  setTimeout(v33InjectProjectPanels, 0);
};

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(v33InjectProjectPanels, 900);
});

window.addEventListener('DOMContentLoaded', () => setTimeout(initCustomWorkPhaseV34, 250));

// ===== V36: megbizhato sajat munkafazis mezo a projekt es gyors mentes urlapon =====
function v36NormalizePhaseValue(value){
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getSelectedWorkPhaseV34(){
  const selectValue = (qs('detailWorkPhase')?.value || '').trim();
  const customValue = (qs('detailCustomWorkPhase')?.value || '').trim();
  if(v36NormalizePhaseValue(selectValue) === 'egyeb'){
    return customValue || 'Egyéb munkafázis';
  }
  return selectValue || 'munkafázis';
}

function updateCustomWorkPhaseV34(){
  const select = qs('detailWorkPhase');
  const input = qs('detailCustomWorkPhase');
  if(!select || !input) return;
  const isOther = v36NormalizePhaseValue(select.value) === 'egyeb';
  input.classList.toggle('hidden', !isOther);
  input.style.display = isOther ? '' : 'none';
  input.required = isOther;
  if(isOther) setTimeout(() => input.focus(), 30);
  else input.value = '';
}

function initCustomWorkPhaseV34(){
  const select = qs('detailWorkPhase');
  const input = qs('detailCustomWorkPhase');
  if(!select || !input) return;
  select.dataset.v34Ready = '1';
  select.removeEventListener('change', updateCustomWorkPhaseV34);
  select.addEventListener('change', updateCustomWorkPhaseV34);
  updateCustomWorkPhaseV34();
}

function v36InitQuickCustomPhase(){
  const select = qs('v33QuickPhase');
  if(!select) return;
  if(!Array.from(select.options).some(opt => v36NormalizePhaseValue(opt.value || opt.textContent) === 'egyeb')){
    const option = document.createElement('option');
    option.textContent = 'Egyéb';
    option.value = 'Egyéb';
    select.appendChild(option);
  }
  let input = qs('v33QuickCustomPhase');
  if(!input){
    input = document.createElement('input');
    input.id = 'v33QuickCustomPhase';
    input.className = 'v34CustomWorkPhase hidden';
    input.placeholder = 'Saját munka megnevezése, pl. zsaluzás, tetőfedés, bontás';
    select.insertAdjacentElement('afterend', input);
  }
  const update = () => {
    const isOther = v36NormalizePhaseValue(select.value) === 'egyeb';
    input.classList.toggle('hidden', !isOther);
    input.style.display = isOther ? '' : 'none';
    input.required = isOther;
    if(isOther) setTimeout(() => input.focus(), 30);
    else input.value = '';
  };
  select.onchange = update;
  update();
}

function v36GetQuickWorkPhase(){
  const selectValue = (qs('v33QuickPhase')?.value || '').trim();
  const customValue = (qs('v33QuickCustomPhase')?.value || '').trim();
  if(v36NormalizePhaseValue(selectValue) === 'egyeb'){
    return customValue || 'Egyéb munkafázis';
  }
  return selectValue || 'Munka közben';
}

const v36OldInjectProjectPanels = v33InjectProjectPanels;
v33InjectProjectPanels = function(){
  v36OldInjectProjectPanels.apply(this, arguments);
  initCustomWorkPhaseV34();
  v36InitQuickCustomPhase();
};

v33SaveQuickEntry = async function() {
  if (!detailState.project) return alert('Nincs kiválasztott projekt.');
  const noteBase = qs('v33QuickNote')?.value.trim() || '';
  if (!noteBase) return alert('Írj legalább egy rövid jegyzetet.');
  const files = Array.from(qs('v33QuickFiles')?.files || []);
  v33SetQuickStatus('<b>Gyors mentés folyamatban...</b><br>Fotók és videók feldolgozása.', 'info');
  const imageFiles = files.filter(file => String(file.type || '').startsWith('image/'));
  const videoFiles = files.filter(file => String(file.type || '').startsWith('video/'));
  const images = await readFilesAsDataUrls(imageFiles, 8);
  const videos = await uploadVideoFilesToStorage(videoFiles, 2);
  const phase = v36GetQuickWorkPhase();
  const status = qs('v33QuickStatus')?.value || 'Folyamatban';
  const note = `Dátum: ${new Date().toISOString().slice(0,10)}\n${noteBase}`;
  const analysis = analyzeEntry({ note, phase, status, priority: 'Közepes' });
  analysis.videos = videos;
  const saved = await window.EpitesNaploAPI.saveEntry({
    projectId: detailState.project.id,
    phase,
    status,
    priority: 'Közepes',
    responsible: 'Gyors mobilos mentés',
    weather: qs('detailWeather')?.value || 'Nincs megadva',
    note,
    images,
    generalImages: images,
    videos,
    videoUrls: videos,
    image: images[0] || '',
    analysis
  });
  if (!saved?.id) throw new Error('A gyors mentés nem kapott mentett azonosítót. Ellenőrizd a Supabase kapcsolatot.');
  qs('v33QuickNote').value = '';
  qs('v33QuickFiles').value = '';
  if(qs('v33QuickCustomPhase')) qs('v33QuickCustomPhase').value = '';
  await reloadProjectEntries();
  v33SetQuickStatus(`<b>Gyors mentés kész.</b><br>${images.length} fotó és ${videos.length} videó bekerült a naplóba.`, 'ok');
};

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(initCustomWorkPhaseV34, 300);
  setTimeout(v36InitQuickCustomPhase, 1100);
});

// ===== V37: GPS biztonság + feltöltési kosár + címmező + auth villanás javítás =====
(function(){
  function q(id){ return document.getElementById(id); }
  function fileKey(file){ return [file.name, file.size, file.lastModified, file.type].join('|'); }
  window.v37FileBaskets = window.v37FileBaskets || {};
  function syncInput(id){
    const input = q(id); if(!input) return;
    const dt = new DataTransfer();
    (window.v37FileBaskets[id] || []).forEach(f => dt.items.add(f));
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
    const files = window.v37FileBaskets[id] || [];
    if(!files.length){ box.innerHTML = ''; return; }
    box.innerHTML = files.map((file, idx) => {
      const isImg = String(file.type || '').startsWith('image/');
      const url = isImg ? URL.createObjectURL(file) : '';
      return `<div class="uploadBasketItem">${isImg ? `<img src="${url}" alt="${file.name}">` : `<div class="fileIcon">VID</div>`}<button type="button" data-basket-id="${id}" data-basket-idx="${idx}">×</button><span>${file.name.length > 18 ? file.name.slice(0,15)+'...' : file.name}</span></div>`;
    }).join('');
  }
  function initBasket(id){
    const input = q(id); if(!input || input.dataset.v37Basket === '1') return;
    input.dataset.v37Basket = '1';
    window.v37FileBaskets[id] = window.v37FileBaskets[id] || [];
    input.addEventListener('change', () => {
      const old = window.v37FileBaskets[id] || [];
      const map = new Map(old.map(f => [fileKey(f), f]));
      Array.from(input.files || []).forEach(f => map.set(fileKey(f), f));
      window.v37FileBaskets[id] = Array.from(map.values());
      syncInput(id); renderBasket(id);
    });
  }
  window.v37ClearBasket = function(id){
    window.v37FileBaskets[id] = [];
    const input = q(id); if(input) input.value = '';
    renderBasket(id);
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-basket-id]');
    if(!btn) return;
    const id = btn.dataset.basketId;
    const idx = Number(btn.dataset.basketIdx);
    const arr = window.v37FileBaskets[id] || [];
    arr.splice(idx, 1);
    window.v37FileBaskets[id] = arr;
    syncInput(id); renderBasket(id);
  });
  window.v37InitProjectBaskets = function(){ ['beforeFiles','afterFiles','detailFiles','detailVideos'].forEach(initBasket); };
  document.addEventListener('DOMContentLoaded', () => { setTimeout(window.v37InitProjectBaskets, 300); setTimeout(() => document.body.classList.remove('auth-loading'), 900); });

  // GPS csak külön döntéssel menjen: utólagos otthoni naplózásnál ne írjon rossz koordinátát.
  window.ensureWeatherAndGpsBeforeSave = async function(){
    const check = q('autoWeatherGpsCheck');
    if(!check || !check.checked) return;
    if(v19WeatherJson || q('weatherAutoText')?.value?.includes('°C')) return;
    const ok = confirm('A jelenlegi telefon/laptop helyzet alapján mentem a GPS-t és időjárást. Biztosan a munkaterületen vagy?');
    if(!ok) return;
    await fillWeatherAndGps();
  };

  const oldSave = window.saveDailyEntry;
  if(typeof oldSave === 'function'){
    window.saveDailyEntry = async function(){
      window.v37InitProjectBaskets?.();
      ['beforeFiles','afterFiles','detailFiles','detailVideos'].forEach(syncInput);
      const noteEl = q('detailNote');
      const addrEl = q('detailWorkAddress');
      const original = noteEl?.value || '';
      const addr = (addrEl?.value || '').trim();
      if(noteEl && addr && !original.includes('Munka helyszíne/cím:')){
        noteEl.value = original + `\n\nMunka helyszíne/cím: ${addr}`;
      }
      try{
        await oldSave.apply(this, arguments);
        ['beforeFiles','afterFiles','detailFiles','detailVideos'].forEach(window.v37ClearBasket);
      }catch(err){
        if(noteEl) noteEl.value = original;
        throw err;
      }
    };
  }
})();

// ===== V79 FINAL: utolso reteg, hogy a regi V74/V75/V76 blokkok ne irjak felul =====
(function(){
  if(window.__v79GithubFinalAfterAll) return;
  window.__v79GithubFinalAfterAll = true;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeName = value => String(value || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Epitesi naplo';
  const approvalMessage = row => row?.message || row?.client_message || row?.approval_message || row?.question || row?.note || row?.comment || '';
  const approvalDecision = row => String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase();
  const approvalLabel = decision => (decision === 'accepted' || decision === 'approved') ? 'Jovahagyva / Elfogadva' : decision === 'question' ? 'Kerdese van' : 'Megtekintve';
  function downloadHtml(filename, html){ const b=new Blob([html||''],{type:'text/html;charset=utf-8'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(u);a.remove();},1200); }
  function openPrint(html){ const w=window.open('','_blank'); if(!w) return alert('A bongeszo blokkolta az uj ablakot.'); w.document.open(); w.document.write(html); w.document.close(); setTimeout(()=>{try{w.focus();w.print()}catch(_){}},700); }
  function injectLightbox(html){
    const css = `<style>.v79ApprovalStamp{border:2px solid #22c55e;background:#ecfdf5;color:#111827;padding:16px 18px;margin:0 0 20px;border-radius:10px;font-family:Arial,sans-serif}.v79ApprovalStamp h1{margin:0 0 10px;font-size:24px}.v79ReportLightbox{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.9);display:flex;align-items:center;justify-content:center;padding:24px}.v79ReportLightbox img{max-width:94vw;max-height:88vh;object-fit:contain;background:#111;border-radius:10px}.v79ReportLightbox button{position:fixed;top:14px;right:14px;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:800;padding:10px 14px;cursor:pointer}img{cursor:zoom-in}@media print{.v79ReportLightbox{display:none!important}img{cursor:default}.v79ApprovalStamp{break-inside:avoid;page-break-inside:avoid}}</style>`;
    const script = `<script>(function(){function imgs(){return Array.from(document.querySelectorAll('img')).filter(function(i){return i.src&&!i.closest('.v79ReportLightbox')})}function openAt(n){var list=imgs();if(!list.length)return;var i=Math.max(0,Math.min(n,list.length-1));var d=document.createElement('div');d.className='v79ReportLightbox';function r(){d.innerHTML='<button type="button">Bezaras</button><img src="'+list[i].src.replace(/"/g,'&quot;')+'">';d.querySelector('button').onclick=function(){d.remove()}}r();d.onclick=function(e){if(e.target===d)d.remove()};document.addEventListener('keydown',function key(e){if(!document.body.contains(d)){document.removeEventListener('keydown',key);return}if(e.key==='Escape')d.remove();if(e.key==='ArrowRight'){i=(i+1)%list.length;r()}if(e.key==='ArrowLeft'){i=(i-1+list.length)%list.length;r()}});document.body.appendChild(d)}document.addEventListener('click',function(e){var img=e.target.closest('img');if(!img||img.closest('.v79ReportLightbox'))return;e.preventDefault();openAt(imgs().indexOf(img))},true);})();<\/script>`;
    let out = String(html || '');
    if(!out.includes('v79ReportLightbox')) out = out.includes('</body>') ? out.replace('</body>', `${script}</body>`) : `${out}${script}`;
    if(!out.includes('.v79ReportLightbox')) out = out.includes('</head>') ? out.replace('</head>', `${css}</head>`) : out.replace('<body', `<head>${css}</head><body`);
    return out;
  }
  const finalBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(finalBuild && !finalBuild.__v79FinalGallery){
    const wrapped = function(entries,title,options){ return injectLightbox(finalBuild(entries,title,options)); };
    wrapped.__v79FinalGallery = true;
    window.buildProReportHtml = wrapped;
    try{ buildProReportHtml = wrapped; }catch(_){}
  }
  async function rowForApproval(id){
    try{ const row = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(row) return row; }catch(_){}
    try{ const rows = await window.EpitesNaploAPI?.getReportApprovals?.(projectId()); return (rows||[]).find(r=>String(r.id)===String(id)) || null; }catch(_){ return null; }
  }
  async function fallbackHtml(){
    try{ const data=await window.EpitesNaploAPI?.getProjectCloseData?.(projectId()); const entries=data?.entries || state()?.entries || []; if(typeof window.buildProReportHtml==='function') return window.buildProReportHtml(entries, `${projectTitle()} - ugyfel visszajelzes`, data||{}); }catch(_){}
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Ugyfel visszajelzes</title></head><body><h1>Ugyfel visszajelzes</h1></body></html>`;
  }
  async function approvalHtml(id){
    const row = await rowForApproval(id);
    if(!row) throw new Error('Nem talalom az ugyfel visszajelzest. Frissitsd a projektoldalt, vagy futtasd a V71 jovahagyas SQL-t.');
    let html = row.approved_report_html || row.report_html_snapshot || row.report_html || '';
    if(!html || html.length < 120) html = await fallbackHtml();
    if(!/<!doctype|<html/i.test(html)) html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Ugyfel visszajelzes</title></head><body>${html}</body></html>`;
    const decision = approvalDecision(row);
    const msg = approvalMessage(row);
    const stamp = `<section class="v79ApprovalStamp"><h1>Ugyfel visszajelzes</h1><p><b>Allapot:</b> ${esc(approvalLabel(decision))}</p><p><b>Datum:</b> ${esc(typeof formatDate==='function'?formatDate(row.approved_at||row.created_at||''):(row.approved_at||row.created_at||''))}</p>${row.client_name?`<p><b>Ugyfel:</b> ${esc(row.client_name)}</p>`:''}${row.client_email?`<p><b>Email:</b> ${esc(row.client_email)}</p>`:''}${msg?`<p><b>Kerdes / megjegyzes:</b><br>${esc(msg).replace(/\n/g,'<br>')}</p>`:''}</section>`;
    html = html.replace(/<body[^>]*>/i, m => `${m}${stamp}`);
    return { row, html: injectLightbox(html) };
  }
  window.v71DownloadApprovedHtml = async function(id){ try{ const r=await approvalHtml(id); downloadHtml(`${safeName(projectTitle())}-${safeName(approvalLabel(approvalDecision(r.row)))}.html`, r.html); }catch(e){ alert(e.message||e); } };
  window.v71PrintApprovedReport = async function(id){ try{ const r=await approvalHtml(id); openPrint(r.html); }catch(e){ alert(e.message||e); } };
  async function renderApprovals(){
    const host = document.getElementById('v71ApprovalsBox') || document.getElementById('v74DocumentsBox') || document.getElementById('projectSummaryBox') || document.querySelector('.projectSummaryCard');
    if(!host || !projectId()) return;
    document.getElementById('v71ApprovalsBox')?.style.setProperty('display','none','important');
    let box=document.getElementById('v79ApprovalsBox');
    if(!box){ box=document.createElement('div'); box.id='v79ApprovalsBox'; box.className='notice v79ApprovalsBox'; host.insertAdjacentElement('afterend',box); }
    let rows=[]; try{ rows=await window.EpitesNaploAPI?.getReportApprovals?.(projectId()) || []; }catch(e){ console.warn(e); }
    if(!rows.length){ box.innerHTML='<b>Ugyfel jovahagyasok es kerdesek</b><p class="muted">Meg nincs ugyfel visszajelzes.</p>'; return; }
    box.innerHTML='<b>Ugyfel jovahagyasok es kerdesek</b>'+rows.slice(0,10).map(row=>{ const d=approvalDecision(row); const msg=approvalMessage(row); const cls=d==='question'?'warn':(d==='accepted'||d==='approved')?'ok':'info'; return `<div class="v79ApprovalRow"><div><span class="tag ${cls}">${esc(approvalLabel(d))}</span><br><small>${esc(typeof formatDate==='function'?formatDate(row.approved_at||row.created_at||''):(row.approved_at||row.created_at||''))}${row.client_name?' - '+esc(row.client_name):''}${row.client_email?' - '+esc(row.client_email):''}</small>${msg?`<p class="v79ApprovalMessage">${esc(msg).replace(/\n/g,'<br>')}</p>`:''}</div><div class="v79ApprovalActions"><button class="btn small primary" type="button" data-v79-approval-download="${esc(row.id)}">Sajat peldany HTML</button><button class="btn small ghost" type="button" data-v79-approval-print="${esc(row.id)}">PDF / nyomtatas</button></div></div>`; }).join('');
  }
  window.v79RenderApprovals = renderApprovals;
  document.addEventListener('click', function(e){ const b=e.target.closest('[data-v79-approval-download],[data-v79-approval-print],[data-v71-download],[data-v71-print]'); if(!b)return; e.preventDefault(); e.stopImmediatePropagation(); const id=b.getAttribute('data-v79-approval-download')||b.getAttribute('data-v79-approval-print')||b.getAttribute('data-v71-download')||b.getAttribute('data-v71-print'); if(b.hasAttribute('data-v79-approval-download')||b.hasAttribute('data-v71-download')) return window.v71DownloadApprovedHtml(id); return window.v71PrintApprovedReport(id); }, true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(renderApprovals,900));
  setTimeout(renderApprovals,1600);
})();

// ===== V79: GitHub verzio - publikus riport, kepnagyitas, ugyfel visszajelzes letoltes =====
(function(){
  if(window.__v79GithubPublicReportFix) return;
  window.__v79GithubPublicReportFix = true;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeName = value => String(value || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Epitesi naplo';
  const toast = (msg, type='ok') => { try { if(typeof showToast === 'function') showToast(msg, type); } catch(_) {} };

  function downloadHtml(filename, html){
    const blob = new Blob([html || ''], { type:'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1200);
  }
  function openPrint(html){
    const win = window.open('', '_blank');
    if(!win) return alert('A bongeszo blokkolta az uj ablakot. Engedelyezd a felugro ablakokat.');
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch(_) {} }, 700);
  }
  function approvalDecision(row = {}){
    return String(row.decision || row.status || (row.approved ? 'accepted' : 'viewed')).toLowerCase();
  }
  function approvalMessage(row = {}){
    return row.message || row.client_message || row.approval_message || row.question || row.note || row.comment || '';
  }
  function approvalLabel(decision){
    return decision === 'accepted' || decision === 'approved' ? 'Jovahagyva / Elfogadva' : decision === 'question' ? 'Kerdese van' : 'Megtekintve';
  }
  async function approvalRow(id){
    try {
      const row = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id);
      if(row) return row;
    } catch(_) {}
    try {
      const rows = await window.EpitesNaploAPI?.getReportApprovals?.(projectId());
      return (rows || []).find(row => String(row.id) === String(id)) || null;
    } catch(_) { return null; }
  }
  async function fallbackReportHtml(){
    const title = `${projectTitle()} - ugyfel visszajelzes peldany`;
    try {
      const data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId());
      const entries = data?.entries || state()?.entries || [];
      if(typeof window.buildProReportHtml === 'function') return window.buildProReportHtml(entries, title, data || {});
      if(typeof buildProReportHtml === 'function') return buildProReportHtml(entries, title, data || {});
    } catch(err) { console.warn('V79 approval fallback riport hiba:', err); }
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><h1>${esc(title)}</h1><p>A riport snapshot nem toltheto be, de az ugyfel visszajelzes adatai rogzitve vannak.</p></body></html>`;
  }
  function withApprovalStamp(html, row = {}){
    const decision = approvalDecision(row);
    const msg = approvalMessage(row);
    const stamp = `<section class="v79ApprovalStamp"><h1>Ugyfel visszajelzes</h1><p><b>Allapot:</b> ${esc(approvalLabel(decision))}</p><p><b>Datum:</b> ${esc(typeof formatDate === 'function' ? formatDate(row.approved_at || row.created_at || '') : (row.approved_at || row.created_at || ''))}</p>${row.client_name ? `<p><b>Ugyfel:</b> ${esc(row.client_name)}</p>` : ''}${row.client_email ? `<p><b>Email:</b> ${esc(row.client_email)}</p>` : ''}${msg ? `<p><b>Kerdes / megjegyzes:</b><br>${esc(msg).replace(/\n/g,'<br>')}</p>` : ''}</section>`;
    const css = `<style>.v79ApprovalStamp{border:2px solid #22c55e;background:#ecfdf5;color:#111827;padding:16px 18px;margin:0 0 20px;border-radius:10px;font-family:Arial,sans-serif}.v79ApprovalStamp h1{margin:0 0 10px;font-size:24px}.v79ApprovalStamp p{margin:6px 0}.v79ReportLightbox{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.9);display:flex;align-items:center;justify-content:center;padding:24px}.v79ReportLightbox img{max-width:94vw;max-height:88vh;object-fit:contain;background:#111;border-radius:10px}.v79ReportLightbox button{position:fixed;top:14px;right:14px;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:800;padding:10px 14px;cursor:pointer}@media print{.v79ReportLightbox{display:none!important}.v79ApprovalStamp{break-inside:avoid;page-break-inside:avoid}}</style>`;
    let out = String(html || '');
    if(!/<!doctype|<html/i.test(out)) out = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Ugyfel visszajelzes</title></head><body>${out}</body></html>`;
    out = out.includes('</head>') ? out.replace('</head>', `${css}</head>`) : out.replace('<body', `<head>${css}</head><body`);
    out = out.replace('<body>', `<body>${stamp}`);
    if(!out.includes(stamp)) out = out.replace(/<body[^>]*>/i, match => `${match}${stamp}`);
    return injectReportLightbox(out);
  }
  function injectReportLightbox(html){
    const script = `<script>(function(){function list(){return Array.from(document.querySelectorAll('img')).filter(function(img){return img.src&&!img.closest('.v79ReportLightbox')})}function openAt(i){var imgs=list();if(!imgs.length)return;var idx=Math.max(0,Math.min(i,imgs.length-1));var d=document.createElement('div');d.className='v79ReportLightbox';function render(){d.innerHTML='<button type="button">Bezaras</button><img src="'+imgs[idx].src.replace(/"/g,'&quot;')+'" alt="">';d.querySelector('button').onclick=function(){d.remove()};}render();d.onclick=function(e){if(e.target===d)d.remove()};document.addEventListener('keydown',function key(e){if(!document.body.contains(d)){document.removeEventListener('keydown',key);return}if(e.key==='Escape')d.remove();if(e.key==='ArrowRight'){idx=(idx+1)%imgs.length;render()}if(e.key==='ArrowLeft'){idx=(idx-1+imgs.length)%imgs.length;render()}});document.body.appendChild(d)}document.addEventListener('click',function(e){var img=e.target.closest('img');if(!img||img.closest('.v79ReportLightbox'))return;e.preventDefault();openAt(list().indexOf(img))},true);})();<\/script>`;
    if(html.includes('v79ReportLightbox')) return html;
    return html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
  }
  const previousBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(previousBuild && !previousBuild.__v79GalleryWrapped){
    const wrapped = function(entries, title, options){
      let html = previousBuild(entries, title, options);
      const css = `.v79ReportGalleryHint{color:#4b5563;font-size:13px}.photos img,.v74Photos img,.v77Photos img,.v67ReportPhoto img{cursor:zoom-in!important}@media print{.photos img,.v74Photos img,.v77Photos img,.v67ReportPhoto img{cursor:default!important}}`;
      html = String(html || '');
      html = html.includes('</style>') ? html.replace('</style>', `${css}</style>`) : html.replace('</head>', `<style>${css}</style></head>`);
      return injectReportLightbox(html);
    };
    wrapped.__v79GalleryWrapped = true;
    window.buildProReportHtml = wrapped;
    try { buildProReportHtml = wrapped; } catch(_) {}
  }
  async function normalizedApprovalHtml(id){
    const row = await approvalRow(id);
    if(!row) throw new Error('Nem talalom az ugyfel visszajelzest. Frissitsd a projektoldalt, vagy ellenorizd a Supabase V71 jovahagyas SQL-t.');
    let html = row.approved_report_html || row.report_html_snapshot || row.report_html || '';
    if(!html || html.length < 120) html = await fallbackReportHtml();
    return { row, html: withApprovalStamp(html, row) };
  }
  window.v71DownloadApprovedHtml = async function(id){
    try {
      const { row, html } = await normalizedApprovalHtml(id);
      downloadHtml(`${safeName(projectTitle())}-${safeName(approvalLabel(approvalDecision(row)))}.html`, html);
      try { await window.EpitesNaploAPI?.saveReportDocument?.({ projectId:projectId(), approvalId:id, title:`${projectTitle()} - ${approvalLabel(approvalDecision(row))}`, type:'client_approval_copy', html, text:document.body.innerText || '', meta:{ decision:approvalDecision(row), message:approvalMessage(row) } }); } catch(_) {}
      toast('Ugyfel visszajelzes peldany letoltve.', 'ok');
    } catch(err) { alert(err.message || err); }
  };
  window.v71PrintApprovedReport = async function(id){
    try {
      const { row, html } = await normalizedApprovalHtml(id);
      openPrint(html);
      try { await window.EpitesNaploAPI?.saveReportDocument?.({ projectId:projectId(), approvalId:id, title:`${projectTitle()} - ${approvalLabel(approvalDecision(row))} PDF`, type:'client_approval_pdf', html, text:document.body.innerText || '', meta:{ decision:approvalDecision(row), message:approvalMessage(row) } }); } catch(_) {}
    } catch(err) { alert(err.message || err); }
  };
  async function renderApprovalsV79(){
    const pid = projectId();
    const host = document.getElementById('v71ApprovalsBox') || document.getElementById('v74DocumentsBox') || document.getElementById('projectSummaryBox') || document.querySelector('.projectSummaryCard');
    if(!host || !pid) return;
    let box = document.getElementById('v79ApprovalsBox');
    if(!box){
      box = document.createElement('div');
      box.id = 'v79ApprovalsBox';
      box.className = 'notice v71ApprovalsBox v79ApprovalsBox';
      host.insertAdjacentElement(host.id === 'v71ApprovalsBox' ? 'afterend' : 'afterend', box);
    }
    document.getElementById('v71ApprovalsBox')?.style.setProperty('display','none','important');
    box.innerHTML = '<b>Ugyfel jovahagyasok es kerdesek</b><p class="muted">Betoltes...</p>';
    let rows = [];
    try { rows = await window.EpitesNaploAPI?.getReportApprovals?.(pid) || []; } catch(err) { console.warn(err); }
    if(!rows.length){
      box.innerHTML = '<b>Ugyfel jovahagyasok es kerdesek</b><p class="muted">Meg nincs ugyfel visszajelzes.</p>';
      return;
    }
    box.innerHTML = `<b>Ugyfel jovahagyasok es kerdesek</b>${rows.slice(0,10).map(row => {
      const decision = approvalDecision(row);
      const cls = decision === 'question' ? 'warn' : (decision === 'accepted' || decision === 'approved') ? 'ok' : 'info';
      const msg = approvalMessage(row);
      return `<div class="v79ApprovalRow"><div><span class="tag ${cls}">${esc(approvalLabel(decision))}</span><br><small>${esc(typeof formatDate === 'function' ? formatDate(row.approved_at || row.created_at || '') : (row.approved_at || row.created_at || ''))}${row.client_name ? ' - '+esc(row.client_name) : ''}${row.client_email ? ' - '+esc(row.client_email) : ''}</small>${msg ? `<p class="v79ApprovalMessage">${esc(msg).replace(/\n/g,'<br>')}</p>` : ''}</div><div class="v79ApprovalActions"><button class="btn small primary" type="button" data-v79-approval-download="${esc(row.id)}">Sajat peldany HTML</button><button class="btn small ghost" type="button" data-v79-approval-print="${esc(row.id)}">PDF / nyomtatas</button></div></div>`;
    }).join('')}`;
  }
  window.v79RenderApprovals = renderApprovalsV79;
  document.addEventListener('click', function(event){
    const btn = event.target.closest('[data-v79-approval-download],[data-v79-approval-print],[data-v71-download],[data-v71-print]');
    if(!btn) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = btn.getAttribute('data-v79-approval-download') || btn.getAttribute('data-v79-approval-print') || btn.getAttribute('data-v71-download') || btn.getAttribute('data-v71-print');
    if(btn.hasAttribute('data-v79-approval-download') || btn.hasAttribute('data-v71-download')) return window.v71DownloadApprovedHtml(id);
    return window.v71PrintApprovedReport(id);
  }, true);
  document.addEventListener('DOMContentLoaded', () => setTimeout(renderApprovalsV79, 900));
  setTimeout(renderApprovalsV79, 1600);
})();

// ===== V76: végső GPS cím + riport stabilizálás =====
(function(){
  if(window.__v76FinalFixLoaded) return;
  window.__v76FinalFixLoaded = true;
  const q = (id)=>document.getElementById(id);
  const coordRe = /(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)/;
  const addressCache = new Map();

  function parseCoords(text){
    const match = String(text || '').match(coordRe);
    if(!match) return null;
    const lat = Number(match[1].replace(',', '.'));
    const lon = Number(match[2].replace(',', '.'));
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }

  async function reverseAddressV76(lat, lon){
    const key = `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;
    if(addressCache.has(key)) return addressCache.get(key);
    try{
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1&accept-language=hu`;
      const res = await fetch(url, { headers:{ 'Accept':'application/json' } });
      if(!res.ok) throw new Error('reverse geocode failed');
      const data = await res.json();
      const address = data.display_name || '';
      addressCache.set(key, address);
      return address;
    }catch(err){
      console.warn('GPS cím lekérés hiba:', err);
      addressCache.set(key, '');
      return '';
    }
  }

  async function enrichGpsAddressV76(){
    const gpsInput = q('detailGps');
    const addressInput = q('detailWorkAddress');
    const weatherInfo = q('weatherAutoText');
    const coords = parseCoords(gpsInput?.value || '');
    if(!coords) return '';
    const address = await reverseAddressV76(coords.lat, coords.lon);
    if(!address) return '';
    if(addressInput && !addressInput.value.trim()) addressInput.value = address;
    if(gpsInput) gpsInput.value = `${address} (${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)})`;
    if(weatherInfo && !/cím/i.test(weatherInfo.value || '')) {
      weatherInfo.value = weatherInfo.value ? `${weatherInfo.value} • Cím: ${address}` : `GPS cím: ${address}`;
    }
    try{
      if(window.v19GpsJson && typeof window.v19GpsJson === 'object'){
        window.v19GpsJson.address = address;
        window.v19GpsJson.text = `${address} (${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)})`;
      }
    }catch(_){}
    return address;
  }
  window.v76EnrichGpsAddress = enrichGpsAddressV76;

  const oldFill = window.fillWeatherAndGps || (typeof fillWeatherAndGps === 'function' ? fillWeatherAndGps : null);
  if(oldFill){
    window.fillWeatherAndGps = async function(){
      const result = await oldFill.apply(this, arguments);
      await enrichGpsAddressV76();
      return result;
    };
    try { fillWeatherAndGps = window.fillWeatherAndGps; } catch(_){}
  }

  const oldCapture = window.captureGpsOnly;
  if(oldCapture){
    window.captureGpsOnly = async function(){
      const result = await oldCapture.apply(this, arguments);
      await enrichGpsAddressV76();
      return result;
    };
  }

  const oldEnsure = window.ensureWeatherAndGpsBeforeSave;
  if(oldEnsure){
    window.ensureWeatherAndGpsBeforeSave = async function(){
      const result = await oldEnsure.apply(this, arguments);
      await enrichGpsAddressV76();
      return result;
    };
  }

  const oldSaveDaily = window.saveDailyEntry;
  if(oldSaveDaily){
    window.saveDailyEntry = async function(){
      await enrichGpsAddressV76();
      const noteEl = q('detailNote');
      const address = (q('detailWorkAddress')?.value || '').trim();
      const original = noteEl?.value || '';
      if(noteEl && address && !/Munka helyszíne\/cím:/i.test(original)){
        noteEl.value = `${original}${original ? '\n\n' : ''}Munka helyszíne/cím: ${address}`;
      }
      return oldSaveDaily.apply(this, arguments);
    };
  }

  function installApiSaveWrapper(){
    const api = window.EpitesNaploAPI;
    if(!api || api.__v76SaveEntryWrapped || !api.saveEntry) return;
    const old = api.saveEntry.bind(api);
    api.__v76SaveEntryWrapped = true;
    api.saveEntry = async function(entry = {}){
      const address = (q('detailWorkAddress')?.value || entry.locationAddress || entry.gpsJson?.address || '').trim();
      if(address){
        entry.locationAddress = address;
        entry.gpsJson = { ...(entry.gpsJson || {}), address, text: entry.gpsJson?.text || address };
      }
      return old(entry);
    };
  }
  installApiSaveWrapper();
  document.addEventListener('DOMContentLoaded', () => setTimeout(installApiSaveWrapper, 300));

  function v76ReportCss(){
    return `.v76ReportPolish .photos,.v76ReportPolish .v74Photos{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(112px,112px))!important;gap:10px!important}.v76ReportPolish .photo,.v76ReportPolish .v74Photo,.v76ReportPolish .v67ReportPhoto{width:112px!important;height:112px!important;max-width:112px!important;border-radius:12px!important;box-shadow:0 6px 18px rgba(15,23,42,.08)!important}.v76ReportPolish .photo img,.v76ReportPolish .v74Photo img,.v76ReportPolish .v67ReportPhoto img{width:100%!important;height:100%!important;object-fit:cover!important}@media print{.v76ReportPolish .photos,.v76ReportPolish .v74Photos{grid-template-columns:repeat(4,28mm)!important;gap:4mm!important}.v76ReportPolish .photo,.v76ReportPolish .v74Photo,.v76ReportPolish .v67ReportPhoto{width:28mm!important;height:28mm!important;max-width:28mm!important;box-shadow:none!important}}`;
  }
  const oldBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(oldBuild){
    const wrapped = function(entries, title, options){
      let html = oldBuild(entries, title, options);
      if(!/v76ReportPolish/.test(html)){
        html = String(html).replace('<body', '<body class="v76ReportPolish"');
        html = html.includes('</style>') ? html.replace('</style>', `${v76ReportCss()}</style>`) : html.replace('</head>', `<style>${v76ReportCss()}</style></head>`);
      }
      return html;
    };
    window.buildProReportHtml = wrapped;
    try { buildProReportHtml = wrapped; } catch(_){}
  }
})();

// ===== V49 PRO eszköztár és riport média nagy nézet =====
function v49ReportVideoSrc(video) {
  return typeof video === 'object' ? (video.src || video.url || '') : String(video || '');
}

function v49ReportVideoPath(video) {
  return video && typeof video === 'object' ? (video.path || '') : '';
}

function v49ReportImageTile(src, title = 'Napló fotó') {
  const safeSrc = escapeHtml(src);
  const safeTitle = escapeHtml(title);
  return `<div class="reportMediaTile"><img src="${safeSrc}" alt="${safeTitle}"></div>`;
}

function v49ReportVideoTile(video, title = 'Munkavideó') {
  const src = v49ReportVideoSrc(video);
  const path = v49ReportVideoPath(video);
  const safeSrc = escapeHtml(src);
  const safePath = escapeHtml(path);
  const safeTitle = escapeHtml(title);
  const srcAttr = safeSrc ? ` src="${safeSrc}"` : '';
  const pathAttr = safePath ? ` data-video-path="${safePath}"` : '';
  return `<div class="reportMediaTile reportVideoTile"><video controls playsinline preload="metadata" title="${safeTitle}"${srcAttr}${pathAttr}></video></div>`;
}

function v49ReportMediaSection(title, items, type = 'image') {
  const list = (items || []).filter(Boolean);
  if (!list.length) return '';
  const html = type === 'video'
    ? list.map(item => v49ReportVideoTile(item, title)).join('')
    : list.map(src => v49ReportImageTile(src, title)).join('');
  return `<div class="v32TimelineMedia v49ReportMediaGroup"><b>${escapeHtml(title)}</b><div class="${type === 'video' ? 'entryVideoGrid' : 'entryImageGrid reportImageGrid'}">${html}</div></div>`;
}

function v52ReportMediaScript() {
  return `<script>
function reportSafeText(value){return String(value||'').replace(/[&<>"']/g,function(s){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s];});}
function reportMediaDocument(src,type,title){
  var safeSrc=reportSafeText(src), safeTitle=reportSafeText(title || (type==='video'?'Munkavideó':'Napló fotó'));
  var media=type==='video'?'<video controls autoplay playsinline src="'+safeSrc+'"></video>':'<img src="'+safeSrc+'" alt="'+safeTitle+'">';
  return '<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+safeTitle+'</title><style>body{margin:0;background:#020617;color:#fff;font-family:Arial,sans-serif}.top{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:#0f172a}.top a{color:#fbbf24;font-weight:800}.stage{height:calc(100vh - 54px);display:grid;place-items:center;padding:12px;box-sizing:border-box}img,video{max-width:100%;max-height:100%;object-fit:contain;border-radius:10px;background:#000}</style></head><body><div class="top"><b>'+safeTitle+'</b><a href="'+safeSrc+'" download>Letöltés</a></div><div class="stage">'+media+'</div></body></html>';
}
function openReportMediaLink(event,link){
  if(event) event.preventDefault();
  var tile=link && link.closest ? link.closest('.reportMediaTile') : null;
  var media=tile && tile.querySelector ? tile.querySelector('img,video') : null;
  var type=media && media.tagName==='VIDEO' ? 'video' : 'image';
  var src=(media && (media.currentSrc || media.src)) || (link && link.getAttribute('href')) || '';
  if(!src) return false;
  var tab=window.open('', '_blank', 'noopener,noreferrer');
  if(!tab){ alert('A böngésző blokkolta az új lapot. Engedélyezd a felugró ablakot ehhez az oldalhoz.'); return false; }
  tab.document.open(); tab.document.write(reportMediaDocument(src,type,type==='video'?'Munkavideó':(media && media.alt || 'Napló fotó'))); tab.document.close();
  return false;
}
<\/script>`;
}

buildProReportHtml = function(entries, title, options = {}) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const materials = options.materials || [];
  const invoices = options.invoices || [];
  const invoiceSum = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const photos = safeEntries.reduce((s, e) => s + getEntryImages(e).length, 0);
  const videos = safeEntries.reduce((s, e) => s + getEntryVideos(e).length, 0);
  const risky = safeEntries.filter(e => (e.analysis?.level || e.ai_level) === 'Magas').length;
  const materialTotals = {};
  materials.forEach(m => {
    const key = `${m.name || 'Anyag'}|${m.unit || 'db'}`;
    materialTotals[key] = (materialTotals[key] || 0) + Number(m.quantity || 0);
  });
  const materialHtml = Object.entries(materialTotals).map(([key, qty]) => {
    const [name, unit] = key.split('|');
    return `<li><b>${escapeHtml(name)}</b>: ${Number(qty.toFixed(2))} ${escapeHtml(unit)}</li>`;
  }).join('') || '<li>Nincs rögzített anyag.</li>';
  const invoiceHtml = invoices.map(i => `<tr><td>${escapeHtml(i.title)}</td><td>${Number(i.amount || 0).toLocaleString('hu-HU')} Ft</td><td>${escapeHtml(i.note || '')}</td></tr>`).join('') || '<tr><td colspan="3">Nincs csatolt számla.</td></tr>';
  const entriesHtml = safeEntries.map(e => {
    const media = typeof v32ProjectMedia === 'function'
      ? v32ProjectMedia(e)
      : { before: [], after: [], general: getEntryImages(e), videos: getEntryVideos(e) };
    const weather = e.weather_json ? `${escapeHtml(e.weather_json.temperature)} °C, ${escapeHtml(e.weather_json.text)}, szél: ${escapeHtml(e.weather_json.wind)} km/h` : escapeHtml(e.weather || '');
    const gps = e.gps_json?.text || (e.gps_json?.lat ? `${e.gps_json.lat}, ${e.gps_json.lon}` : '');
    const mediaBlock = [
      v49ReportMediaSection('Előtte fotók', media.before),
      v49ReportMediaSection('Munka közben / dokumentáció', media.general),
      v49ReportMediaSection('Utána fotók', media.after),
      v49ReportMediaSection('Munkavideók', media.videos, 'video')
    ].join('');
    return `<section class="entry v49ReportEntry"><h2>${formatDate(e.created_at)} - ${escapeHtml(e.phase || 'Napi bejegyzés')}</h2><p>${escapeHtml(e.note || '').replace(/\n/g, '<br>')}</p><p><b>Időjárás:</b> ${weather || 'nincs adat'} ${gps ? '<br><b>GPS/hely:</b> ' + escapeHtml(gps) : ''}</p>${mediaBlock}</section>`;
  }).join('') || '<p>Nincs bejegyzés.</p>';
  const reportCss = `body{font-family:Arial,sans-serif;color:#111;margin:0;padding:28px;line-height:1.45;background:#fff}.cover{border-bottom:4px solid #f5a400;margin-bottom:22px;padding-bottom:18px}.pill{display:inline-block;background:#fff3cd;color:#7c4a00;border-radius:999px;padding:6px 10px;font-weight:700}.muted{color:#555}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0}.stat{background:#f3f4f6;border-radius:10px;padding:12px}.stat b{display:block;font-size:22px;color:#d97706}.entry{break-inside:avoid;border-left:4px solid #f5a400;background:#fafafa;margin:16px 0;padding:14px 16px}.entryImageGrid,.reportImageGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.entryVideoGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.reportMediaTile{border:1px solid #ddd;border-radius:10px;background:#fff;padding:8px}.reportMediaTile img{width:100%;height:180px;object-fit:cover;border-radius:8px;display:block}.reportMediaTile video{width:100%;max-height:320px;border-radius:8px;background:#111;display:block}.reportMediaOpen,.reportMediaPending{display:block;margin-top:7px;font-size:12px;font-weight:700;color:#92400e;text-decoration:none}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border-bottom:1px solid #ddd;text-align:left;padding:8px}h5{margin:14px 0 8px}@media(max-width:700px){body{padding:16px}.stats{grid-template-columns:repeat(2,1fr)}.entryImageGrid,.reportImageGrid,.entryVideoGrid{grid-template-columns:1fr}.reportMediaTile img{height:auto;max-height:none;object-fit:contain;background:#f8fafc}}@media print{.reportMediaOpen,.reportMediaPending{display:none}.entry{page-break-inside:avoid}}`;
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${reportCss}</style></head><body><div class="cover"><span class="pill">Átadásra kész dokumentáció</span><h1>${escapeHtml(title)}</h1><p class="muted">Generálva: ${new Date().toLocaleString('hu-HU')} - ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>${safeEntries.length}</b>bejegyzés</div><div class="stat"><b>${photos}</b>fotó</div><div class="stat"><b>${videos}</b>videó</div><div class="stat"><b>${risky}</b>magas kockázat</div><div class="stat"><b>${invoiceSum.toLocaleString('hu-HU')} Ft</b>számlák</div></div></div><h2>Rövid összegzés</h2><p>A dokumentum az ügyfélnek átadható, rendezett építési napló: napi munkák, fotók, videók, anyagok, időjárás/GPS és nyitott ellenőrzések egy helyen.</p><h2>Anyagösszesítő</h2><ul>${materialHtml}</ul><h2>Számlák</h2><table><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr>${invoiceHtml}</table><h2>Napi bejegyzések</h2>${entriesHtml}</body></html>`;
};

// ===== V41: okosabb AI, napló kiegészítés, stabil idővonal gombok =====
(function(){
  const oldAnalyze = analyzeEntry;
  const PHASE_TIPS = {
    alapozás: ['zsaluzat és vasalás fotózása betonozás előtt', 'beton minőség és időjárás rögzítése', 'szintek és méretek ellenőrzése'],
    falazás: ['sorok vízszintje és függője ellenőrizve', 'áthidalók és kötésrend fotózva', 'falazóanyag és habarcs dokumentálva'],
    betonozás: ['bedolgozás, tömörítés és utókezelés rögzítése', 'hőmérséklet/időjárás mentése', 'repedés vagy fészkesedés külön fotózása'],
    vakolás: ['alapfelület portalanítása és alapozása', 'hálózás/sarokvédő helye fotózva', 'száradási körülmények megadva'],
    burkolás: ['aljzat síkpontosság ellenőrzése', 'vízszigetelés és ragasztó típusa rögzítve', 'dilatációk és fugák ellenőrizve'],
    festés: ['alapozás, glettelés, csiszolás dokumentálva', 'nedvességfolt/repedés előtte fotózva', 'rétegek és száradási idő rögzítve'],
    szigetelés: ['átlapolások és csomópontok fotózása', 'anyag típusa és vastagsága rögzítve', 'áttörések körüli zárás ellenőrizve']
  };
  const SMART_RULES = [
    { words:['reped','hasad','süllyed','mozog','statikai'], level:'Magas', title:'Szerkezeti vagy repedési kockázat', advice:['Mérd és fotózd a hibát közelről és távolról is.', 'Javítás előtt az okot kell tisztázni, nem csak elfedni.', 'Ha nő vagy visszatér, műszaki ellenőr/statikus bevonása javasolt.'], materials:['mérőszalag', 'mélyalapozó', 'üvegszövet háló', 'javítóhabarcs'] },
    { words:['beáz','vizes','nedves','penész','salétrom','ázik'], level:'Magas', title:'Nedvesség vagy beázás kockázat', advice:['Először a víz útját kell megtalálni.', 'Száradás előtt ne készüljön végleges fedőréteg.', 'Rögzíts fotót, időjárást és pontos helyet.'], materials:['penészlemosó', 'szárítóvakolat', 'vízszigetelő anyag', 'páramérő'] },
    { words:['levál','omlik','üreges','potyog','laza'], level:'Közepes', title:'Leváló vagy laza réteg', advice:['A laza részt stabil alapig vissza kell bontani.', 'Alapozás/tapadóhíd után javítsd.', 'Átadás előtt kopogtatással és fotóval ellenőrizd.'], materials:['tapadóhíd', 'javítóhabarcs', 'sarokvédő', 'vakolat'] },
    { words:['ferde','eltérés','nem vízszintes','nem függőleges','egyenetlen'], level:'Közepes', title:'Méret- vagy síkpontossági eltérés', advice:['Lézerrel/vízmértékkel mérd vissza.', 'Fotózd mérőeszközzel együtt.', 'Rögzítsd, elfogadott-e vagy javítandó.'], materials:['lézeres szintező', 'vízmérték', 'kiegyenlítő anyag'] },
    { words:['kész','átadás','befejez','elkészült'], level:'Alacsony', title:'Átadás közeli állapot', advice:['Készíts előtte/utána fotópárt.', 'Rögzítsd a nyitott kérdéseket és takarítási állapotot.', 'Ügyfélriportban legyen rövid, érthető összegzés.'], materials:['átadás-átvételi lista', 'fotódokumentáció'] }
  ];
  function levelScore(level){ return level === 'Magas' ? 85 : level === 'Közepes' ? 58 : 22; }
  function smartAnalyze(data = {}){
    const base = oldAnalyze(data) || {};
    const text = `${data.note || ''} ${data.phase || ''} ${data.status || ''} ${data.priority || ''}`.toLowerCase();
    const matched = SMART_RULES.filter(rule => rule.words.some(word => text.includes(word)));
    const top = matched[0];
    const phaseKey = Object.keys(PHASE_TIPS).find(key => text.includes(key));
    const phaseTips = phaseKey ? PHASE_TIPS[phaseKey] : ['legyen legalább egy távoli és egy közeli fotó', 'felelős, dátum és munkafázis legyen rögzítve', 'eltérés esetén legyen külön javítási teendő'];
    const advice = [...new Set([...(top?.advice || []), ...(base.advice || []), ...phaseTips])].slice(0, 6);
    const materials = [...new Set([...(top?.materials || []), ...(base.materials || [])])].slice(0, 8);
    const level = top?.level || base.level || 'Alacsony';
    return {
      ...base,
      level,
      score: Math.max(Number(base.score || 0), levelScore(level)),
      title: top?.title || base.title || 'AI dokumentációs ellenőrzés',
      advice,
      repairs: [...new Set([...(base.repairs || []), ...advice.slice(0, 3)])],
      materials,
      customerSummary: `${data.phase || 'A munkafázis'} dokumentálva. AI ellenőrzés: ${level}. ${advice[0] || 'A bejegyzés visszakereshető módon mentve van.'}`,
      checklist: phaseTips,
      nextStep: advice[0] || 'Készíts fotót és rögzítsd a következő teendőt.'
    };
  }
  analyzeEntry = smartAnalyze;

  function entryAnalysis(entry){
    return entry.analysis || entry.ai_json || analyzeEntry({ note: entry.note || '', phase: entry.phase || '', status: entry.status || '', priority: entry.priority || '' });
  }
  function smartBlock(entry){
    const a = entryAnalysis(entry);
    const list = (a.checklist || a.advice || []).slice(0, 4).map(x => `<li>${escapeHtml(x)}</li>`).join('');
    return `<div class="aiSmartSummary"><b>Okos AI ellenőrzés:</b><p>${escapeHtml(a.customerSummary || a.title || '')}</p>${list ? `<ul>${list}</ul>` : ''}</div>`;
  }
  function ensureSupplementModal(){
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
      <label class="uploadBox"><b>Képek hozzáadása</b><span>Fotó, előtte/utána vagy részletkép</span><input id="supplementImagesV42" type="file" accept="image/*" multiple /></label>
      <label class="uploadBox"><b>Videók hozzáadása</b><span>Rövid munkavideó a kiegészítéshez</span><input id="supplementVideosV42" type="file" accept="video/*" multiple /></label>
      <div id="supplementStatusV42" class="v32UploadStatus hidden"></div>
      <button class="btn primary full" type="button" onclick="saveSupplementModalV42()">Kiegészítés mentése</button>
    </div>`;
    document.body.appendChild(modal);
    return modal;
  }
  window.closeSupplementModalV42 = function(){
    document.getElementById('supplementModalV42')?.classList.add('hidden');
  };
  window.addEntrySupplement = function(entryId){
    const entry = (detailState.entries || []).find(e => String(e.id) === String(entryId));
    if(!entry) return alert('Bejegyzés nem található.');
    const modal = ensureSupplementModal();
    modal.dataset.entryId = entryId;
    qs('supplementTextV42').value = '';
    qs('supplementImagesV42').value = '';
    qs('supplementVideosV42').value = '';
    qs('supplementStatusV42').classList.add('hidden');
    modal.classList.remove('hidden');
    setTimeout(() => qs('supplementTextV42')?.focus(), 50);
  };
  window.saveSupplementModalV42 = async function(){
    const modal = ensureSupplementModal();
    const entryId = modal.dataset.entryId;
    const entry = (detailState.entries || []).find(e => String(e.id) === String(entryId));
    if(!entry) return alert('Bejegyzés nem található.');
    const text = qs('supplementTextV42')?.value.trim() || '';
    const imgFiles = qs('supplementImagesV42')?.files || [];
    const vidFiles = qs('supplementVideosV42')?.files || [];
    if(!text && !imgFiles.length && !vidFiles.length) return alert('Adj meg szöveget, képet vagy videót.');
    const status = qs('supplementStatusV42');
    status.className = 'v32UploadStatus info';
    status.classList.remove('hidden');
    status.innerHTML = '<b>Kiegészítés mentése...</b><br>Képek és videók feldolgozása.';
    try {
      const images = await readFilesAsDataUrls(imgFiles, 8);
      const videos = await uploadVideoFilesToStorage(vidFiles, 3);
      if (vidFiles.length && !videos.length) throw new Error('A videó nem lett feltöltve. Futtasd a V44 SQL-t, majd próbáld újra.');
      const supplementText = text || `${images.length ? images.length + ' kép' : ''}${images.length && videos.length ? ', ' : ''}${videos.length ? videos.length + ' videó' : ''} hozzáadva.`;
      const analysis = analyzeEntry({ note: `${entry.note || ''}\n${supplementText}`, phase: entry.phase || '', status: entry.status || '', priority: entry.priority || '' });
      const saved = await window.EpitesNaploAPI.appendEntrySupplement(entryId, supplementText, analysis, { images, videos });
      Object.assign(entry, saved, {
        images: Array.isArray(saved.image_urls) ? saved.image_urls : getEntryImages(entry).concat(images),
        videoUrls: Array.isArray(saved.video_urls) ? saved.video_urls : getEntryVideos(entry).concat(videos),
        analysis: saved.ai_json || analysis
      });
      await hydratePrivateVideoUrls([entry]);
      renderProjectTimeline();
      renderProjectSummary();
      closeSupplementModalV42();
      showToast('Kiegészítés mentve képpel/videóval.', 'ok');
    } catch (err) {
      status.className = 'v32UploadStatus error';
      status.innerHTML = `<b>Kiegészítés mentési hiba.</b><br>${escapeHtml(err.message || err)}`;
    }
  };
  window.runSmartEntryAi = function(entryId){
    const entry = (detailState.entries || []).find(e => String(e.id) === String(entryId));
    if(!entry) return;
    const a = analyzeEntry({ note: entry.note || '', phase: entry.phase || '', status: entry.status || '', priority: entry.priority || '' });
    showProjectHelp('Okos AI elemzés', `<div class="featureHelpBox"><b>${escapeHtml(a.title)}</b><p>${escapeHtml(a.customerSummary || '')}</p></div><div class="featureHelpBox"><b>Javaslatok</b><ul>${(a.advice || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div><div class="featureHelpBox"><b>Anyag / eszköz</b><p>${(a.materials || []).map(escapeHtml).join(', ') || 'Nincs külön anyagjavaslat.'}</p></div>`);
  };
  renderProjectTimeline = function(){
    const filter = qs('timelineRiskFilter')?.value || 'all';
    let entries = [...(detailState.entries || [])];
    if (filter !== 'all') entries = entries.filter(e => (entryAnalysis(e).level || e.ai_level || 'Alacsony') === filter);
    qs('projectTimeline').innerHTML = entries.map(entry => {
      const a = entryAnalysis(entry);
      const level = a.level || entry.ai_level || 'Alacsony';
      const title = a.title || entry.ai_title || 'Elemzés';
      const images = getEntryImages(entry);
      const videos = getEntryVideos(entry);
      const mats = entry.materials_json || a.materials || [];
      const weatherJson = entry.weather_json || a.weatherJson || null;
      return `<article class="timelineEntry v41TimelineEntry">
        <div class="timelineDate"><b>${formatDate(entry.created_at)}</b><span>${escapeHtml(entry.phase || '')}</span></div>
        <div class="timelineBody">
          ${images.length ? `<div class="entryImageGrid detailImages">${images.map(src => renderMediaImage(src, 'Napló fotó')).join('')}</div>` : ''}
          ${videos.length ? `<div class="entryVideoGrid">${videos.map(v => renderMediaVideo(v, 'Munkavideó')).join('')}</div>` : ''}
          <p>${escapeHtml(entry.note || '')}</p>
          <div class="tagRow"><span class="tag ${riskClass(level)}">AI: ${escapeHtml(level)}</span><span class="tag ai">${escapeHtml(title)}</span><span class="tag">${escapeHtml(entry.status || '')}</span>${images.length ? `<span class="tag">${images.length} fotó</span>` : ''}${videos.length ? `<span class="tag">${videos.length} videó</span>` : ''}</div>
          ${weatherJson ? `<div class="miniInfo">${escapeHtml(weatherJson.temperature || '')} °C, ${escapeHtml(weatherJson.text || '')}, szél: ${escapeHtml(weatherJson.wind || '')} km/h</div>` : ''}
          ${Array.isArray(mats) && mats.length ? `<div class="miniInfo"><b>Anyag:</b> ${mats.map(m => typeof m === 'object' ? `${escapeHtml(m.name)} ${escapeHtml(m.quantity || '')} ${escapeHtml(m.unit || '')}` : escapeHtml(m)).join(', ')}</div>` : ''}
          ${smartBlock(entry)}
          <div class="entryActions"><button class="btn small primary" type="button" onclick="addEntrySupplement('${entry.id}')">+ Kiegészítés hozzáadása</button><button class="btn small ghost" type="button" onclick="runSmartEntryAi('${entry.id}')">AI elemzés</button></div>
        </div>
      </article>`;
    }).join('') || '<p class="muted">Még nincs napi bejegyzés ehhez a projekthez.</p>';
  };

  const oldGenerate = generateDailyAiText;
  generateDailyAiText = async function(){
    await oldGenerate.apply(this, arguments);
    const note = qs('detailNote')?.value || '';
    const phase = getSelectedWorkPhaseV34();
    const a = analyzeEntry({ note, phase, status: qs('detailStatus')?.value || '', priority: qs('detailPriority')?.value || '' });
    const extra = `\n\nAI ellenőrzési lista:\n${(a.checklist || a.advice || []).slice(0,4).map(x => '- ' + x).join('\n')}\nKövetkező lépés: ${a.nextStep || ''}`;
    if(qs('detailNote') && !qs('detailNote').value.includes('AI ellenőrzési lista:')) qs('detailNote').value += extra;
  };
})();

// ===== V50 AI nagy ugrás: projektmemória, szakmai logika, fotó/szöveg kontroll, ügyfél + belső nézet =====
(function(){
  const v50OldAnalyzeEntry = analyzeEntry;
  const v50OldRenderProjectSummary = renderProjectSummary;
  const v50OldRenderProjectTimeline = renderProjectTimeline;
  const v50OldBuildProReportHtml = buildProReportHtml;

  const V50_PHASE_RULES = [
    {
      key: 'térkő alépítmény',
      words: ['térkő', 'terko', 'viakolor', 'murva', 'zúzottkő', 'zuzottko', 'zottko', 'tükör', 'tukor', 'ágyazat', 'agyazat', 'szegély', 'szegely', 'lapvibrátor'],
      evidence: ['Tükör síkja és mélysége fotózva', 'Murva/zúzottkő rétegrend és tömörítés rögzítve', 'Szegélyek, lejtés és vízelvezetés ellenőrizve'],
      risks: ['nem megfelelő tömörítés', 'hibás lejtés vagy vízelvezetés', 'hiányzó rétegrend dokumentáció'],
      next: 'Rögzíts egy távoli áttekintő képet, egy közeli rétegrend fotót és a tömörítés/lejtés ellenőrzését.'
    },
    {
      key: 'alapozás',
      words: ['alapoz', 'sávalap', 'lemezalap', 'vasalás', 'zsaluzat'],
      evidence: ['Vasalás fotó betonozás előtt', 'Zsaluzat és méretellenőrzés', 'Betonozás időjárása és utókezelés'],
      risks: ['hiányzó vasalási dokumentáció', 'eltérés a szintben vagy méretben', 'hideg/meleg időben elégtelen utókezelés'],
      next: 'Betonozás előtt legyen távoli és közeli fotó a vasalásról, zsaluzatról és méretről.'
    },
    {
      key: 'falazás',
      words: ['falaz', 'tégla', 'áthidaló', 'fal', 'ytong'],
      evidence: ['Sorok vízszintje', 'Áthidalók fotója', 'Kötésrend és csatlakozások'],
      risks: ['áthidaló vagy kötésrend dokumentáció hiánya', 'függő vagy vízszint eltérés'],
      next: 'Fotózd az áthidalókat, sarkokat és gépészeti áttöréseket, mielőtt takarásba kerülnek.'
    },
    {
      key: 'vakolás',
      words: ['vakol', 'glett', 'háló', 'sarokvédő', 'javítóhabarcs'],
      evidence: ['Alapfelület állapota', 'Hálózás/sarokvédő fotó', 'Száradási körülmények'],
      risks: ['laza alapra javítás', 'nedves felületre záró réteg', 'repedés elfedése okfeltárás nélkül'],
      next: 'Készíts előtte fotót a hibáról, majd utána fotót a javított felületről azonos nézőpontból.'
    },
    {
      key: 'burkolás',
      words: ['burkol', 'csempe', 'járólap', 'ragasztó', 'fuga', 'vízszigetelés'],
      evidence: ['Aljzat síkpontosság', 'Vízszigetelés fotó', 'Ragasztó/fuga típusa'],
      risks: ['vízszigetelés dokumentálása hiányzik', 'dilatáció vagy síkpontosság nincs ellenőrizve'],
      next: 'Vizes helyiségnél legyen külön vízszigetelés fotó és anyagmegnevezés.'
    },
    {
      key: 'festés',
      words: ['fest', 'alapozó', 'diszperzió', 'szín', 'csiszolás'],
      evidence: ['Alapozás', 'Javított hibák előtte/utána', 'Rétegszám és száradás'],
      risks: ['nedvességfolt elfedése', 'repedés visszatérése', 'nem dokumentált rétegrend'],
      next: 'Rögzítsd a rétegszámot és a száradási körülményt, különösen korábbi nedvesség vagy repedés után.'
    },
    {
      key: 'gépészet',
      words: ['gépészet', 'vízcső', 'csatorna', 'fűtés', 'radiátor', 'kiállás'],
      evidence: ['Nyomvonal fotó takarás előtt', 'Kötések és kiállások', 'Nyomáspróba / ellenőrzés'],
      risks: ['takarás előtti dokumentáció hiánya', 'később nem visszakereshető csőnyomvonal'],
      next: 'Takarás előtt legyen áttekintő fotó és közeli kép a kötésekről, kiállásokról.'
    },
    {
      key: 'villanyszerelés',
      words: ['villany', 'kábel', 'vezeték', 'doboz', 'elosztó', 'konnektor'],
      evidence: ['Kábelnyomvonal fotó', 'Dobozok helye', 'Takarás előtti ellenőrzés'],
      risks: ['takarás utáni hibakeresés nehéz', 'nyomvonal nincs dokumentálva'],
      next: 'Takarás előtt készíts széles képet a nyomvonalakról és közeli képet a kötési pontokról.'
    }
  ];

  const V50_RISK_RULES = [
    { words:['reped','hasad','süllyed','statikai','mozog'], level:'Magas', title:'Repedés / szerkezeti mozgás gyanú', advice:['Mérd és fotózd a repedést közelről és távolról is.', 'Jelöld, hogy nő-e vagy ismétlődik-e.', 'Javítás előtt az okot kell tisztázni, nem csak elfedni.'], materials:['mérőszalag', 'repedésjelölő', 'üvegszövet háló', 'javítóhabarcs'] },
    { words:['beáz','ázás','vizes','nedves','penész','salétrom','pára'], level:'Magas', title:'Nedvesség / beázás kockázat', advice:['Először a víz útját kell megtalálni.', 'Száradás előtt ne készüljön záró réteg.', 'Rögzíts időjárást, helyet és fotót több távolságból.'], materials:['nedvességmérő', 'penészlemosó', 'szárítóvakolat', 'vízszigetelő anyag'] },
    { words:['levál','omlik','potyog','üreges','laza','kopog'], level:'Közepes', title:'Laza vagy leváló réteg', advice:['Stabil alapig bontsd vissza a laza részt.', 'Javítás előtt legyen alapozás vagy tapadóhíd.', 'Átadás előtt kopogtatással ellenőrizd.'], materials:['tapadóhíd', 'mélyalapozó', 'javítóhabarcs'] },
    { words:['eltérés','ferde','nem vízszintes','nem függőleges','egyenetlen','mérethiba'], level:'Közepes', title:'Méreti vagy síkpontossági eltérés', advice:['Mérőeszközzel együtt fotózd az eltérést.', 'Írd le, javítandó vagy elfogadott állapot.', 'Egyeztetés nélkül ne takard el.'], materials:['vízmérték', 'lézeres szintező', 'kiegyenlítő anyag'] },
    { words:['elkészült','átadás','lezárás','befejezve'], level:'Alacsony', title:'Átadás közeli dokumentáció', advice:['Legyen áttekintő és közeli fotó a kész állapotról.', 'A nyitott apró javítások külön listára kerüljenek.', 'Ügyfélriportban legyen rövid, érthető összegzés.'], materials:['átadás-átvételi lista', 'fotódokumentáció'] }
  ];

  function v50Norm(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function v50Includes(text, words) {
    const normalized = v50Norm(text);
    return words.some(word => normalized.includes(v50Norm(word)));
  }
  function v50LevelRank(level) {
    return level === 'Magas' ? 3 : level === 'Közepes' ? 2 : 1;
  }
  function v50MaxLevel(levels) {
    return (levels || []).sort((a, b) => v50LevelRank(b) - v50LevelRank(a))[0] || 'Alacsony';
  }
  function v50Unique(items, max = 8) {
    return [...new Set((items || []).filter(Boolean).map(item => String(item).trim()).filter(Boolean))].slice(0, max);
  }
  function v50PhaseRule(entry = {}) {
    const text = `${entry.note || ''} ${entry.phase || ''} ${entry.status || ''}`;
    return V50_PHASE_RULES.find(rule => v50Includes(text, rule.words)) || null;
  }
  function v50RiskMatches(entry = {}) {
    const text = `${entry.note || ''} ${entry.phase || ''} ${entry.status || ''} ${entry.priority || ''}`;
    return V50_RISK_RULES.filter(rule => v50Includes(text, rule.words));
  }
  function v50EntryMedia(entry = {}) {
    const media = typeof v32ProjectMedia === 'function'
      ? v32ProjectMedia(entry)
      : { before: [], after: [], general: getEntryImages(entry), videos: getEntryVideos(entry) };
    return {
      before: media.before || [],
      after: media.after || [],
      general: media.general || [],
      videos: media.videos || [],
      images: getEntryImages(entry)
    };
  }
  function v50MediaContradictions(entry = {}) {
    const media = v50EntryMedia(entry);
    const text = v50Norm(`${entry.note || ''} ${entry.phase || ''} ${entry.status || ''}`);
    const issues = [];
    const isCompletion = /(^|[^a-z0-9])(kesz|elkeszult|atadas|lezarva|befejezve)([^a-z0-9]|$)/.test(text) && !/(keszites|elkeszit|keszul|keszitese)/.test(text);
    const isPavingBase = /(terko|viakolor|murva|zuzottko|zottko|tukor|agyazat|szegely|lapvibrator)/.test(text);
    if (isCompletion && !media.after.length) {
      issues.push(media.images.length
        ? 'Kész állapot szerepel a szövegben. Van naplófotó, érdemes áttekintő és közeli készállapot-képet is rögzíteni.'
        : 'Kész állapot szerepel a szövegben, de nincs hozzá naplófotó.');
    }
    if (/(reped|beaz|vizes|nedves|penesz|leval|omlik)/.test(text) && media.images.length < 2) issues.push('Hibára utaló szöveg van, de kevés a bizonyító fotó.');
    if (!isPavingBase && /(takaras|eltakar|burkol|vakol|gipszkarton|falazas|gepeszet|villany)/.test(text) && !media.before.length) {
      issues.push(media.images.length
        ? 'Takarásba kerülő munka szerepel. Van naplófotó, de nincs külön "előtte" kategóriába tett fotó.'
        : 'Takarásba kerülő munka szerepel, de nincs hozzá előtte fotó.');
    }
    if ((media.before.length || media.after.length) && !(media.before.length && media.after.length)) issues.push('Van előtte/utána kategória, de a fotópár nem teljes.');
    if (media.videos.length && !media.images.length) issues.push('Van videó, de nincs állókép. Riportban érdemes legalább egy fotót is rögzíteni.');
    return issues;
  }
  function v50AnalyzeEntry(entry = {}) {
    const base = v50OldAnalyzeEntry(entry) || {};
    const phaseRule = v50PhaseRule(entry);
    const matched = v50RiskMatches(entry);
    const contradiction = v50MediaContradictions(entry);
    const media = v50EntryMedia(entry);
    const level = v50MaxLevel([
      base.level || 'Alacsony',
      ...matched.map(rule => rule.level),
      contradiction.length ? 'Közepes' : 'Alacsony',
      String(entry.priority || '') === 'Magas' ? 'Közepes' : 'Alacsony'
    ]);
    const scoreBase = level === 'Magas' ? 86 : level === 'Közepes' ? 58 : 24;
    const evidenceScore = Math.min(100, media.images.length * 12 + media.videos.length * 14 + (media.before.length && media.after.length ? 25 : 0));
    const advice = v50Unique([
      ...matched.flatMap(rule => rule.advice),
      ...(phaseRule?.evidence || []).map(item => `Ellenőrizd / dokumentáld: ${item}.`),
      ...contradiction.map(item => `Dokumentációs rés: ${item}`),
      ...(base.advice || []),
      phaseRule?.next
    ], 9);
    const materials = v50Unique([...matched.flatMap(rule => rule.materials), ...(base.materials || [])], 10);
    const title = matched[0]?.title || (contradiction.length ? 'Dokumentációs ellentmondás figyelmeztetés' : phaseRule ? `${phaseRule.key} szakmai ellenőrzés` : base.title || 'AI szakmai naplóellenőrzés');
    const professionalSummary = [
      `Kockázati szint: ${level}.`,
      phaseRule ? `Munkafázis fókusz: ${phaseRule.key}.` : 'Munkafázis fókusz: általános dokumentáció.',
      contradiction.length ? `Dokumentációs hiány: ${contradiction.join(' ')}` : 'A fotó/szöveg kapcsolatban nincs kiemelt ellentmondás.',
      `Bizonyítéki erő: ${evidenceScore}/100.`
    ].join(' ');
    const customerSummary = level === 'Magas'
      ? 'A bejegyzés alapján kiemelt figyelmet igénylő pont látszik. A javítás vagy ellenőrzés előtt érdemes külön fotóval és rövid magyarázattal rögzíteni az állapotot.'
      : level === 'Közepes'
        ? 'A munka dokumentálva van, de van néhány ellenőrzési pont, amit érdemes tisztázni az átadás előtt.'
        : 'A bejegyzés alapján a dokumentáció rendben van, a munka ügyfél számára is áttekinthetően követhető.';
    return {
      ...base,
      level,
      score: Math.max(Number(base.score || 0), scoreBase + Math.min(10, contradiction.length * 4)),
      title,
      advice: advice.length ? advice : ['Készíts legalább egy távoli és egy közeli fotót, hogy a munka később is bizonyítható legyen.'],
      repairs: v50Unique([...(base.repairs || []), ...advice.slice(0, 4)], 8),
      materials,
      checklist: v50Unique([...(phaseRule?.evidence || []), 'Dátum, felelős, időjárás/helyszín rögzítése', 'Eltérés esetén javítási felelős és határidő'], 8),
      contradictions: contradiction,
      evidenceScore,
      professionalSummary,
      customerSummary,
      nextStep: phaseRule?.next || advice[0] || 'Rögzíts fotót, felelőst és következő teendőt.',
      localAiVersion: 'v59'
    };
  }
  analyzeEntry = v50AnalyzeEntry;

  function v50EntryIntelligence(entry = {}) {
    return v50AnalyzeEntry(entry);
  }
  function v50MaterialsCache() {
    return typeof v19MaterialsCache !== 'undefined' && Array.isArray(v19MaterialsCache) ? v19MaterialsCache : [];
  }
  function v50InvoicesCache() {
    return typeof v19InvoicesCache !== 'undefined' && Array.isArray(v19InvoicesCache) ? v19InvoicesCache : [];
  }
  function v50ProjectMemory(entries = detailState.entries || [], materials = v50MaterialsCache(), invoices = v50InvoicesCache()) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const last = safeEntries[0] || null;
    const phaseCounts = {};
    const riskCounts = { Magas: 0, Közepes: 0, Alacsony: 0 };
    const repeated = {};
    let photos = 0;
    let videos = 0;
    safeEntries.forEach(entry => {
      const phase = entry.phase || 'Nincs fázis';
      phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
      const ai = v50EntryIntelligence(entry);
      riskCounts[ai.level || 'Alacsony'] = (riskCounts[ai.level || 'Alacsony'] || 0) + 1;
      photos += getEntryImages(entry).length;
      videos += getEntryVideos(entry).length;
      v50RiskMatches(entry).forEach(rule => { repeated[rule.title] = (repeated[rule.title] || 0) + 1; });
    });
    const invoiceSum = (invoices || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const materialNames = v50Unique((materials || []).map(item => item.name || item.title || '').filter(Boolean), 8);
    const openRisks = safeEntries
      .filter(entry => v50LevelRank(v50EntryIntelligence(entry).level) >= 2)
      .slice(0, 4)
      .map(entry => `${formatDate(entry.created_at)}: ${v50EntryIntelligence(entry).title}`);
    const weakEvidence = safeEntries
      .filter(entry => v50EntryMedia(entry).images.length === 0 || v50MediaContradictions(entry).length)
      .slice(0, 4)
      .map(entry => {
        const media = v50EntryMedia(entry);
        const issue = v50MediaContradictions(entry)[0];
        return `${formatDate(entry.created_at)}: ${issue || (media.images.length ? 'van naplófotó, de a bizonyíték kategóriázása pontosítható' : 'nincs naplófotó')}`;
      });
    return {
      entries: safeEntries.length,
      photos,
      videos,
      lastDate: last ? formatDate(last.created_at) : 'nincs bejegyzés',
      phaseCounts,
      riskCounts,
      repeated,
      invoiceSum,
      materialNames,
      openRisks,
      weakEvidence
    };
  }
  function v50ExecutiveSummary(entries = detailState.entries || [], options = {}) {
    const memory = v50ProjectMemory(entries, options.materials || v50MaterialsCache(), options.invoices || v50InvoicesCache());
    const mainPhase = Object.entries(memory.phaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'még nincs domináns munkafázis';
    const repeated = Object.entries(memory.repeated).filter(([, count]) => count > 1).map(([name, count]) => `${name} (${count}x)`);
    const status = memory.riskCounts.Magas ? 'Kiemelt műszaki figyelmet igényel' : memory.riskCounts.Közepes ? 'Átadás előtt ellenőrizendő' : 'Rendezett, alacsony kockázatú dokumentáció';
    const next = [
      memory.weakEvidence.length ? 'Nézd át a gyengébb bizonyítékú bejegyzéseket: ha van naplófotó, elég lehet előtte/utána kategóriába rendezni; ha nincs fotó, akkor pótold.' : 'Tartsd meg a fotó + rövid szöveg ritmust minden munkanapon.',
      memory.openRisks.length ? 'A közepes/magas AI jelzéseket külön zárd le megjegyzéssel vagy javítási fotóval.' : 'A heti riport ügyfélnek kiadható, nincs nyitott magas AI jelzés.',
      memory.invoiceSum ? 'A költségösszesítőben már van számlaadat, érdemes hetente egyeztetni.' : 'Rögzíts legalább egy számla/költség sort, hogy a riport pénzügyileg is teljes legyen.'
    ];
    return {
      status,
      mainPhase,
      repeated,
      next,
      memory,
      text: `Állapot: ${status}. Fő munkafázis: ${mainPhase}. Bejegyzések: ${memory.entries}, fotók: ${memory.photos}, videók: ${memory.videos}. ${repeated.length ? 'Ismétlődő jelzések: ' + repeated.join(', ') + '.' : 'Nincs erős ismétlődő hibaminta.'}`
    };
  }
  function v50AiDashboardHtml(entries = detailState.entries || [], options = {}) {
    const summary = v50ExecutiveSummary(entries, options);
    const mem = summary.memory;
    return `<div class="v50AiPanel">
      <div class="v50AiPanelHead"><span>AI projektmemória</span><b>${escapeHtml(summary.status)}</b></div>
      <div class="v50AiGrid">
        <div><b>${mem.entries}</b><span>bejegyzés</span></div>
        <div><b>${mem.photos}</b><span>fotó</span></div>
        <div><b>${mem.videos}</b><span>videó</span></div>
        <div><b>${mem.riskCounts.Magas || 0}</b><span>magas jelzés</span></div>
      </div>
      <p>${escapeHtml(summary.text)}</p>
      ${mem.openRisks.length ? `<div class="v50AiList"><b>Nyitott AI figyelmeztetések</b><ul>${mem.openRisks.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}
      <div class="v50AiList"><b>Következő okos lépések</b><ul>${summary.next.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
    </div>`;
  }

  renderProjectSummary = function() {
    v50OldRenderProjectSummary.apply(this, arguments);
    const box = qs('smartNotificationBox');
    if (box) box.innerHTML = v50AiDashboardHtml();
  };

  window.runSmartEntryAi = function(entryId) {
    const entry = (detailState.entries || []).find(item => String(item.id) === String(entryId));
    if (!entry) return;
    const ai = v50AnalyzeEntry(entry);
    const contradictions = ai.contradictions?.length
      ? `<div class="featureHelpBox warn"><b>Fotó/szöveg kontroll</b><ul>${ai.contradictions.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
      : `<div class="featureHelpBox"><b>Fotó/szöveg kontroll</b><p>Nincs kiemelt ellentmondás a szöveg és a média mennyisége között.</p></div>`;
    showProjectHelp('AI elemzés', `
      <div class="featureHelpBox"><b>${escapeHtml(ai.title)}</b><p>${escapeHtml(ai.professionalSummary)}</p><p><b>Következő lépés:</b> ${escapeHtml(ai.nextStep)}</p></div>
      <div class="featureHelpBox"><b>Ügyfélbarát magyarázat</b><p>${escapeHtml(ai.customerSummary)}</p></div>
      ${contradictions}
      <div class="featureHelpBox"><b>Szakmai ellenőrző lista</b><ul>${(ai.checklist || ai.advice || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
      <div class="featureHelpBox"><b>Anyag / eszköz javaslat</b><p>${(ai.materials || []).map(escapeHtml).join(', ') || 'Nincs külön anyagjavaslat.'}</p></div>
    `);
  };

  renderProjectTimeline = function() {
    const filter = qs('timelineRiskFilter')?.value || 'all';
    let entries = [...(detailState.entries || [])];
    if (filter !== 'all') entries = entries.filter(entry => (v50EntryIntelligence(entry).level || 'Alacsony') === filter);
    qs('projectTimeline').innerHTML = entries.map(entry => {
      const ai = v50EntryIntelligence(entry);
      const level = ai.level || 'Alacsony';
      const media = v50EntryMedia(entry);
      const mats = entry.materials_json || ai.materials || [];
      const weatherJson = entry.weather_json || ai.weatherJson || null;
      return `<article class="timelineEntry v41TimelineEntry v50TimelineEntry">
        <div class="timelineDate"><b>${formatDate(entry.created_at)}</b><span>${escapeHtml(entry.phase || '')}</span><small class="v50Evidence">Bizonyíték: ${Number(ai.evidenceScore || 0)}/100</small></div>
        <div class="timelineBody">
          ${media.images.length ? `<div class="entryImageGrid detailImages">${media.images.map(src => renderMediaImage(src, 'Napló fotó')).join('')}</div>` : ''}
          ${media.videos.length ? `<div class="entryVideoGrid">${media.videos.map(video => renderMediaVideo(video, 'Munkavideó')).join('')}</div>` : ''}
          <p>${escapeHtml(entry.note || '')}</p>
          <div class="tagRow"><span class="tag ${riskClass(level)}">AI: ${escapeHtml(level)}</span><span class="tag ai">${escapeHtml(ai.title || 'Elemzés')}</span><span class="tag">${escapeHtml(entry.status || '')}</span>${media.images.length ? `<span class="tag">${media.images.length} fotó</span>` : ''}${media.videos.length ? `<span class="tag">${media.videos.length} videó</span>` : ''}</div>
          ${weatherJson ? `<div class="miniInfo">${escapeHtml(weatherJson.temperature || '')} °C, ${escapeHtml(weatherJson.text || '')}, szél: ${escapeHtml(weatherJson.wind || '')} km/h</div>` : ''}
          ${Array.isArray(mats) && mats.length ? `<div class="miniInfo"><b>Anyag:</b> ${mats.map(m => typeof m === 'object' ? `${escapeHtml(m.name)} ${escapeHtml(m.quantity || '')} ${escapeHtml(m.unit || '')}` : escapeHtml(m)).join(', ')}</div>` : ''}
          <div class="aiSmartSummary v50SmartSummary"><b>AI szakmai kontroll:</b><p>${escapeHtml(ai.professionalSummary || ai.customerSummary || ai.title || '')}</p>${ai.contradictions?.length ? `<ul>${ai.contradictions.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : `<small>Nincs fotó/szöveg ellentmondás jelzés.</small>`}</div>
          <div class="entryActions"><button class="btn small primary" type="button" onclick="addEntrySupplement('${entry.id}')">+ Kiegészítés hozzáadása</button><button class="btn small ghost" type="button" onclick="runSmartEntryAi('${entry.id}')">AI elemzés</button></div>
        </div>
      </article>`;
    }).join('') || '<p class="muted">Még nincs napi bejegyzés ehhez a projekthez.</p>';
  };

  generateDailyAiText = async function() {
    const phase = getSelectedWorkPhaseV34();
    const status = qs('detailStatus')?.value || '';
    const priority = qs('detailPriority')?.value || '';
    const responsible = qs('detailResponsible')?.value || 'kivitelező csapat';
    const weather = qs('detailWeather')?.value || qs('weatherAutoText')?.value || 'nincs külön időjárási adat';
    const note = qs('detailNote')?.value || '';
    const materials = collectMaterials ? collectMaterials() : [];
    const projectMemory = v50ProjectMemory();
    const localAi = v50AnalyzeEntry({ note, phase, status, priority, materials });
    try {
      if (window.EpitesNaploAPI?.generateAiDailyReport) {
        showToast('AI projektmemória elemzés készítése...', 'ok');
        const res = await window.EpitesNaploAPI.generateAiDailyReport({
          mode: 'v50_project_intelligence',
          projectName: detailState.project?.name || '',
          phase,
          status,
          priority,
          responsible,
          weather,
          note,
          materials,
          projectMemory,
          expectedOutput: ['professionalSummary', 'customerSummary', 'checklist', 'risks', 'nextStep']
        });
        if (res?.text) {
          qs('detailNote').value = note.trim() ? `${note.trim()}\n\n${res.text}` : res.text;
          showToast('AI napi jelentés elkészült.', 'ok');
          return;
        }
      }
    } catch (err) {
      console.warn('V50 AI edge fallback:', err);
    }
    const matText = materials.length ? `\nFelhasznált anyagok: ${materials.map(m => `${m.name} ${m.quantity} ${m.unit}`).join(', ')}.` : '';
    const generated = `AI napi munkanapló - ${phase}

Belső szakmai összegzés:
${localAi.professionalSummary}

Ügyfélbarát összegzés:
${localAi.customerSummary}

Munkavégzés:
A mai napon a(z) ${String(phase || 'munkafázis').toLowerCase()} munkafázishoz kapcsolódó feladatok történtek. Felelős: ${responsible}. Státusz: ${status || 'nincs megadva'}, prioritás: ${priority || 'nincs megadva'}.

Helyszíni körülmény / időjárás:
${weather}.${matText}

Szakmai ellenőrző lista:
${(localAi.checklist || localAi.advice || []).slice(0, 5).map(item => '- ' + item).join('\n')}

Következő javasolt lépés:
${localAi.nextStep}`;
    qs('detailNote').value = note.trim() ? `${note.trim()}\n\n${generated}` : generated;
    showToast('AI napi jelentés elkészült helyi intelligenciával.', 'ok');
  };

  buildProReportHtml = function(entries, title, options = {}) {
    const html = v50OldBuildProReportHtml(entries, title, options);
    const summary = v50ExecutiveSummary(entries || [], options || {});
    const memoryHtml = `<section class="entry v50ReportSummary"><h2>Vezetői AI összefoglaló</h2><p>${escapeHtml(summary.text)}</p><h3>Következő lépések</h3><ul>${summary.next.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>${summary.memory.openRisks.length ? `<h3>Nyitott AI figyelmeztetések</h3><ul>${summary.memory.openRisks.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}${summary.memory.weakEvidence.length ? `<h3>Gyenge bizonyítékú pontok</h3><ul>${summary.memory.weakEvidence.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}</section>`;
    const withSummary = html.replace('<h2>Napi bejegyzések</h2>', `${memoryHtml}<h2>Napi bejegyzések</h2>`);
    // V53: nem injektálunk scriptet az ügyfélriport HTML-be, mert nyers szövegként megjelenhet.
    return withSummary;
  };

  window.v50ExecutiveSummary = v50ExecutiveSummary;
  window.v50ProjectMemory = v50ProjectMemory;
})();

// ===== V60: bizonyíték-alapú AI válaszok, kép + szöveg kontroll =====
(function(){
  const previousAnalyzeEntry = analyzeEntry;

  function v60Norm(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function v60Media(entry = {}) {
    const media = typeof v32ProjectMedia === 'function' && (entry.image_urls || entry.images || entry.before_images || entry.after_images)
      ? v32ProjectMedia(entry)
      : null;
    const images = Array.isArray(entry.images) ? entry.images : (typeof getEntryImages === 'function' ? getEntryImages(entry) : []);
    const videos = Array.isArray(entry.videos) ? entry.videos : (typeof getEntryVideos === 'function' ? getEntryVideos(entry) : []);
    const before = Array.isArray(entry.before) ? entry.before : (Array.isArray(entry.beforeImages) ? entry.beforeImages : (media?.before || []));
    const after = Array.isArray(entry.after) ? entry.after : (Array.isArray(entry.afterImages) ? entry.afterImages : (media?.after || []));
    const general = Array.isArray(entry.general) ? entry.general : (Array.isArray(entry.generalImages) ? entry.generalImages : (media?.general || []));
    return {
      images,
      videos,
      before,
      after,
      general,
      imageCount: Number(entry.imageCount ?? images.length ?? 0),
      videoCount: Number(entry.videoCount ?? videos.length ?? 0),
      beforeImageCount: Number(entry.beforeImageCount ?? before.length ?? 0),
      afterImageCount: Number(entry.afterImageCount ?? after.length ?? 0)
    };
  }

  function v60WorkType(text) {
    const normalized = v60Norm(text);
    const rules = [
      ['térkő alépítmény', /(terko|viakolor|murva|zuzottko|zottko|tukor|agyazat|szegely|lapvibrator)/],
      ['alapozás / beton', /(beton|vasalas|zsaluzat|lemezalap|savalap)/],
      ['falazás', /(falaz|tegla|ytong|athidalo)/],
      ['vakolás / glettelés', /(vakol|glett|halo|sarokvedo|javitohabarcs)/],
      ['burkolás', /(burkol|csempe|jarolap|ragaszto|fuga|vizszigeteles)/],
      ['festés', /(fest|alapozo|diszperzio|szin|csiszolas)/],
      ['gépészet', /(gepeszet|vizcso|csatorna|futes|radiator|kiallas)/],
      ['villanyszerelés', /(villany|kabel|vezetek|doboz|eloszto|konnektor)/]
    ];
    return rules.find(([, pattern]) => pattern.test(normalized))?.[0] || 'általános építési dokumentáció';
  }

  function v60StrictAnalyzeEntry(entry = {}) {
    const base = previousAnalyzeEntry(entry) || {};
    const media = v60Media(entry);
    const note = String(entry.note || '');
    const phase = String(entry.phase || '');
    const status = String(entry.status || '');
    const priority = String(entry.priority || '');
    const text = `${note} ${phase} ${status} ${priority}`;
    const normalized = v60Norm(text);
    const completion = /(^|[^a-z0-9])(kesz|elkeszult|atadas|lezarva|befejezve)([^a-z0-9]|$)/.test(normalized) && !/(keszites|keszitese|elkeszit|keszul)/.test(normalized);
    const workType = v60WorkType(text);
    const certain = [
      phase ? `Munkafázis megadva: ${phase}.` : '',
      status ? `Státusz megadva: ${status}.` : '',
      priority ? `Prioritás megadva: ${priority}.` : '',
      note ? 'Van szöveges naplóleírás.' : '',
      `${media.imageCount} fotó és ${media.videoCount} videó tartozik a bejegyzéshez.`,
      media.beforeImageCount || media.afterImageCount ? `${media.beforeImageCount} előtte és ${media.afterImageCount} utána fotó van kategorizálva.` : ''
    ].filter(Boolean);
    const assumptions = [
      workType !== 'általános építési dokumentáció' ? `A szöveg alapján valószínű munkaterület: ${workType}.` : '',
      /eltérés|ferde|lejt|szint|egyenetlen|meret/i.test(normalized) ? 'Méreti vagy lejtési eltérés lehet, ezt mérőeszközzel kell igazolni.' : '',
      /reped|beaz|nedves|penesz|leval|omlik/i.test(normalized) ? 'Hibára utaló szöveg szerepel, a pontos ok csak helyszíni ellenőrzéssel dönthető el.' : ''
    ].filter(Boolean);
    const missingData = [
      !media.imageCount ? 'Nincs fotó, ezért képi állapot nem bizonyítható.' : '',
      media.imageCount && !note ? 'Van fotó, de nincs hozzá részletes szöveges magyarázat.' : '',
      completion && !media.afterImageCount ? 'Kész/átadás állapothoz nincs külön készállapot vagy utána fotó.' : '',
      workType === 'térkő alépítmény' && !/tomorit|lapvibrator|lejtes|vizelvezetes|reteg/i.test(normalized) ? 'Térkő alépítménynél hiányzik a tömörítés, rétegrend, lejtés vagy vízelvezetés ellenőrzésének leírása.' : ''
    ].filter(Boolean);
    const evidenceScore = Math.max(
      Number(base.evidenceScore || 0),
      Math.min(100,
        media.imageCount * 12 +
        media.videoCount * 14 +
        (note ? 18 : 0) +
        (phase ? 10 : 0) +
        (media.beforeImageCount && media.afterImageCount ? 22 : 0) -
        missingData.length * 5
      )
    );
    const photoTextCheck = missingData.length
      ? missingData.join(' ')
      : 'A megadott szöveg és a média mennyisége alapján nincs kiemelt ellentmondás.';
    const level = missingData.length >= 2 && (base.level || 'Alacsony') === 'Alacsony' ? 'Közepes' : (base.level || 'Alacsony');
    const checklist = [
      ...(base.checklist || []),
      workType === 'térkő alépítmény' ? 'Ellenőrizd a tükör mélységét, rétegrendet, tömörítést, lejtést és vízelvezetést.' : '',
      'Csak azt tekintsd bizonyítottnak, ami fotón, videón vagy szövegben ténylegesen szerepel.',
      'Ha átadás/kész állapot a cél, legyen áttekintő és közeli készállapot fotó.'
    ].filter(Boolean);
    const professionalSummary = [
      `Kockázati szint: ${level}.`,
      `Munkafázis fókusz: ${workType}.`,
      `Bizonyítéki erő: ${Math.round(evidenceScore)}/100.`,
      `Biztos adatok: ${certain.join(' ') || 'kevés rögzített adat.'}`,
      assumptions.length ? `Következtetés: ${assumptions.join(' ')}` : 'Következtetés: nincs külön bizonytalan szakmai feltételezés.',
      missingData.length ? `Hiányzó adat: ${missingData.join(' ')}` : 'Hiányzó adat: nincs kiemelt hiány.'
    ].join(' ');

    return {
      ...base,
      level,
      evidenceScore: Math.round(evidenceScore),
      workType,
      certain,
      assumptions,
      missingData,
      photoTextCheck,
      checklist: [...new Set(checklist)].slice(0, 10),
      professionalSummary,
      customerSummary: missingData.length
        ? 'A munka dokumentálva van, de néhány adatot még érdemes pontosítani, hogy az átadásnál egyértelmű legyen.'
        : (base.customerSummary || 'A bejegyzés alapján a dokumentáció követhető és ügyfél számára is érthető.'),
      nextStep: missingData[0] || base.nextStep || 'Rögzíts egy távoli és egy közeli fotót rövid szöveges magyarázattal.',
      localAiVersion: 'v60-evidence-first'
    };
  }

  analyzeEntry = v60StrictAnalyzeEntry;
  window.v60StrictAnalyzeEntry = v60StrictAnalyzeEntry;

  window.runSmartEntryAi = function(entryId) {
    const entry = (detailState.entries || []).find(item => String(item.id) === String(entryId));
    if (!entry) return;
    const ai = v60StrictAnalyzeEntry(entry);
    const listHtml = (items = []) => items.length ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>Nincs külön tétel.</p>';
    showProjectHelp('AI elemzés', `
      <div class="featureHelpBox"><b>${escapeHtml(ai.title || 'AI szakmai elemzés')}</b><p>${escapeHtml(ai.professionalSummary)}</p><p><b>Következő lépés:</b> ${escapeHtml(ai.nextStep)}</p></div>
      <div class="featureHelpBox ok"><b>Biztosan ismert</b>${listHtml(ai.certain)}</div>
      <div class="featureHelpBox"><b>Óvatos következtetés</b>${listHtml(ai.assumptions)}</div>
      <div class="featureHelpBox warn"><b>Nem bizonyítható / hiányzik</b>${listHtml(ai.missingData)}</div>
      <div class="featureHelpBox"><b>Ügyfélbarát magyarázat</b><p>${escapeHtml(ai.customerSummary)}</p></div>
      <div class="featureHelpBox"><b>Szakmai ellenőrző lista</b>${listHtml(ai.checklist || ai.advice || [])}</div>
    `);
  };

  const previousGenerateDailyAiText = generateDailyAiText;
  generateDailyAiText = async function() {
    const phase = getSelectedWorkPhaseV34();
    const status = qs('detailStatus')?.value || '';
    const priority = qs('detailPriority')?.value || '';
    const responsible = qs('detailResponsible')?.value || 'kivitelező csapat';
    const weather = qs('detailWeather')?.value || qs('weatherAutoText')?.value || 'nincs külön időjárási adat';
    const note = qs('detailNote')?.value || '';
    const materials = collectMaterials ? collectMaterials() : [];
    const media = {
      imageCount: (qs('beforeFiles')?.files?.length || 0) + (qs('afterFiles')?.files?.length || 0) + (qs('detailFiles')?.files?.length || 0),
      beforeImageCount: qs('beforeFiles')?.files?.length || 0,
      afterImageCount: qs('afterFiles')?.files?.length || 0,
      videoCount: qs('detailVideos')?.files?.length || 0
    };
    const localAi = v60StrictAnalyzeEntry({ note, phase, status, priority, materials, ...media });
    try {
      if (window.EpitesNaploAPI?.generateAiDailyReport) {
        showToast('AI bizonyíték-alapú jelentés készítése...', 'ok');
        const res = await window.EpitesNaploAPI.generateAiDailyReport({
          mode: 'v60_evidence_first',
          projectName: detailState.project?.name || '',
          phase,
          status,
          priority,
          responsible,
          weather,
          note,
          materials,
          media,
          projectMemory: window.v50ProjectMemory ? window.v50ProjectMemory() : {},
          localAi,
          expectedOutput: ['certain', 'assumptions', 'missingData', 'professionalSummary', 'customerSummary', 'checklist', 'nextStep']
        });
        if (res?.text) {
          qs('detailNote').value = note.trim() ? `${note.trim()}\n\n${res.text}` : res.text;
          showToast('AI jelentés elkészült.', 'ok');
          return;
        }
      }
    } catch (err) {
      console.warn('V60 AI edge fallback:', err);
    }
    const generated = `AI napi munkanapló - ${phase || 'munkafázis'}

Biztosan ismert adatok:
${(localAi.certain || []).map(item => '- ' + item).join('\n') || '- Nincs elég rögzített adat.'}

Belső szakmai összegzés:
${localAi.professionalSummary}

Ügyfélbarát összegzés:
${localAi.customerSummary}

Nem bizonyítható / hiányzó adat:
${(localAi.missingData || []).map(item => '- ' + item).join('\n') || '- Nincs kiemelt hiányzó adat.'}

Szakmai ellenőrző lista:
${(localAi.checklist || []).slice(0, 6).map(item => '- ' + item).join('\n')}

Következő javasolt lépés:
${localAi.nextStep}`;
    qs('detailNote').value = note.trim() ? `${note.trim()}\n\n${generated}` : generated;
    showToast('AI jelentés elkészült helyi bizonyítéklogikával.', 'ok');
  };
})();

// ===== V65: V60 kinézet megtartva, képmentés + AI szöveg stabilizálás =====
(function(){
  function v65Arr(value) { return Array.isArray(value) ? value.filter(Boolean) : []; }
  function v65Media(entry = {}) {
    const ai = entry.ai_json || entry.analysis || {};
    const before = v65Arr(entry.beforeImages).concat(v65Arr(entry.before_images_json), v65Arr(ai.beforeImages));
    const after = v65Arr(entry.afterImages).concat(v65Arr(entry.after_images_json), v65Arr(ai.afterImages));
    const general = v65Arr(entry.generalImages).concat(v65Arr(entry.general_images_json), v65Arr(ai.generalImages));
    const baseImages = v65Arr(entry.images).concat(v65Arr(entry.image_urls), entry.image_url ? [entry.image_url] : [], entry.image ? [entry.image] : []);
    const images = [...new Set([...baseImages, ...before, ...after, ...general])];
    const videos = [...new Set(v65Arr(entry.videos).concat(v65Arr(entry.videoUrls), v65Arr(entry.video_urls), v65Arr(ai.videos), v65Arr(ai.videoUrls), entry.video_url ? [entry.video_url] : []))];
    return { images, videos, before: [...new Set(before)], after: [...new Set(after)], general: [...new Set(general)] };
  }
  window.v65Media = v65Media;

  const oldGetEntryImages = window.getEntryImages || getEntryImages;
  getEntryImages = function(entry) {
    const media = v65Media(entry || {});
    return media.images.length ? media.images : oldGetEntryImages(entry || {});
  };

  const oldGetEntryVideos = window.getEntryVideos || getEntryVideos;
  getEntryVideos = function(entry) {
    const media = v65Media(entry || {});
    return media.videos.length ? media.videos : oldGetEntryVideos(entry || {});
  };

  function isPaverWork(text) {
    return /térkő|terko|viakolor|tükör|tukor|murva|zúzottkő|zuzottko|ágyazat|agyazat|lapvibrátor|lapvibrator/i.test(String(text || ''));
  }
  function cleanPaverList(items) {
    const bad = /vakolat|glett|festés|festes|mélyalapozó|melyalapozo|üvegszövet|uvegszovet|javítóhabarcs|javitohabarcs|tapadóhíd|tapadohid|szárítóvakolat|szaritovakolat/i;
    return [...new Set((items || []).filter(Boolean).map(String).filter(x => !bad.test(x)))];
  }
  function paverAnalysisPatch(ai, entry) {
    const text = `${entry?.note || ''} ${entry?.phase || ''} ${entry?.status || ''}`;
    if (!isPaverWork(text)) return ai;
    const media = v65Media(entry || {});
    const hasPhoto = media.images.length > 0 || Number(entry.imageCount || 0) > 0;
    const hasVideo = media.videos.length > 0 || Number(entry.videoCount || 0) > 0;
    const missing = [];
    if (!hasPhoto && !hasVideo) missing.push('Javasolt legalább egy áttekintő fotó a munkaterületről.');
    if (!/tömör|tomor|lapvibr|réteg|reteg|lejt|vízelvezet|vizelvezet|szint/i.test(text)) missing.push('Érdemes röviden rögzíteni a tömörítést, rétegrendet, lejtést vagy szintellenőrzést.');
    return {
      ...ai,
      level: ai.level || 'Alacsony',
      title: 'Térkő alatti tükör szakmai kontroll',
      workType: 'térkő alépítmény',
      materials: cleanPaverList(ai.materials || ['murva / zúzottkő', 'ágyazó réteg', 'szegélyanyag', 'geotextília, ha szükséges']),
      advice: cleanPaverList(ai.advice || []).concat(missing).slice(0, 4),
      missingData: missing,
      photoTextCheck: missing.length ? missing.join(' ') : 'A képek és a szöveg alapján a bejegyzés dokumentációja rendben van.',
      customerSummary: 'A térkő alatti tükör készítése dokumentálva van. A lényeg: megfelelő rétegrend, tömörítés, szint és lejtés ellenőrzése.',
      professionalSummary: `Térkő alatti tükör: ${hasPhoto ? media.images.length + ' fotó' : 'fotó nélkül'}, ${hasVideo ? media.videos.length + ' videó' : 'videó nélkül'}. Ellenőrizendő: rétegrend, tömörítés, szint/lejtés és vízelvezetés.`,
      nextStep: missing[0] || 'Következő lépés: a rétegrend, tömörítés és lejtés rövid dokumentálása, majd következő munkafázis rögzítése.'
    };
  }

  const previousAnalyze = analyzeEntry;
  analyzeEntry = function(entry = {}) {
    const ai = previousAnalyze(entry) || {};
    const media = v65Media(entry);
    if (media.images.length || media.videos.length || Number(entry.imageCount || 0) || Number(entry.videoCount || 0)) {
      ai.missingData = (ai.missingData || []).filter(x => !/nincs fotó|nincs naplófotó|képi állapot nem bizonyítható/i.test(String(x)));
      if (ai.photoTextCheck && /nincs fotó|nincs naplófotó|képi állapot nem bizonyítható/i.test(ai.photoTextCheck)) {
        ai.photoTextCheck = 'A bejegyzéshez tartozik kép vagy videó, ezért a dokumentáció képi része rögzítve van.';
      }
    }
    return paverAnalysisPatch(ai, entry);
  };
  window.v60StrictAnalyzeEntry = analyzeEntry;

  window.generateDailyAiText = async function() {
    const phase = getSelectedWorkPhaseV34();
    const note = qs('detailNote')?.value || '';
    const status = qs('detailStatus')?.value || '';
    const priority = qs('detailPriority')?.value || '';
    const materials = typeof collectMaterials === 'function' ? collectMaterials() : [];
    const media = {
      imageCount: (qs('beforeFiles')?.files?.length || 0) + (qs('afterFiles')?.files?.length || 0) + (qs('detailFiles')?.files?.length || 0),
      beforeImageCount: qs('beforeFiles')?.files?.length || 0,
      afterImageCount: qs('afterFiles')?.files?.length || 0,
      videoCount: qs('detailVideos')?.files?.length || 0
    };
    const ai = analyzeEntry({ note, phase, status, priority, materials, ...media });
    const generated = isPaverWork(`${phase} ${note}`)
      ? `Mai napló röviden – ${phase}\n\nA térkő alatti tükör készítése / előkészítése történt. Ellenőrizendő fő pontok: rétegrend, tömörítés, szint, lejtés és vízelvezetés.\n\nDokumentáció: ${media.imageCount} fotó, ${media.videoCount} videó.\nKövetkező lépés: ${ai.nextStep}`
      : `Mai napló röviden – ${phase}\n\nElvégzett munka: ${note || 'rövid helyszíni leírás szükséges.'}\nStátusz: ${status || 'nincs megadva'}. Prioritás: ${priority || 'nincs megadva'}.\nDokumentáció: ${media.imageCount} fotó, ${media.videoCount} videó.\nKövetkező lépés: ${ai.nextStep || 'a munkafolyamat folytatása és dokumentálása.'}`;
    qs('detailNote').value = note.trim() ? `${note.trim()}\n\n${generated}` : generated;
    showToast('AI rövid naplószöveg elkészült.', 'ok');
  };

  // Mentésnél a fájlok ténylegesen bekerülnek az entry objektumba, és nem dobunk fals hibát akkor,
  // ha a Supabase mentés után a select visszaolvasás nem ad azonnal azonosítót.
  saveDailyEntry = async function(){
    if (!detailState.project) return alert('Nincs kiválasztott projekt.');
    const noteBase = qs('detailNote')?.value.trim() || '';
    if (!noteBase) return alert('Írd be a mai napló leírását.');
    const date = qs('detailDate')?.value || new Date().toISOString().slice(0, 10);
    const phase = getSelectedWorkPhaseV34();
    const status = qs('detailStatus')?.value || 'Folyamatban';
    const priority = qs('detailPriority')?.value || 'Közepes';
    const responsible = qs('detailResponsible')?.value.trim() || 'Nincs megadva';
    const weather = qs('detailWeather')?.value.trim() || 'Nincs megadva';
    const gpsText = qs('detailGps')?.value.trim() || '';
    const materials = typeof collectMaterials === 'function' ? collectMaterials() : [];
    const beforeImages = await readFilesAsDataUrls(qs('beforeFiles')?.files, 5);
    const afterImages = await readFilesAsDataUrls(qs('afterFiles')?.files, 5);
    const generalImages = await readFilesAsDataUrls(qs('detailFiles')?.files, 10);
    const selectedVideos = Array.from(qs('detailVideos')?.files || []).filter(isSupportedVideoFile);
    const videos = await uploadVideoFilesToStorage(qs('detailVideos')?.files, 2);
    if (selectedVideos.length && !videos.length) {
      return alert('A videó feltöltése nem sikerült. A fotókat mentheted videó nélkül, vagy próbáld újra kisebb videóval.');
    }
    const images = [...beforeImages, ...afterImages, ...generalImages];
    const materialText = materials.length ? `\n\nAnyagfelhasználás:\n${materials.map(m => `- ${m.name}: ${m.quantity} ${m.unit}${m.note ? ' (' + m.note + ')' : ''}`).join('\n')}` : '';
    const beforeAfterText = `${beforeImages.length ? `\nElőtte fotó: ${beforeImages.length} db` : ''}${afterImages.length ? `\nUtána fotó: ${afterImages.length} db` : ''}${generalImages.length ? `\nÁltalános fotó: ${generalImages.length} db` : ''}${videos.length ? `\nMunkavideó: ${videos.length} db` : ''}`;
    const weatherText = weather ? `\nIdőjárás / körülmény: ${weather}` : '';
    const gpsNote = gpsText ? `\nGPS/helyadat: ${gpsText}` : '';
    const note = `Dátum: ${date}\n${noteBase}${beforeAfterText}${materialText}${weatherText}${gpsNote}`;
    let analysis = analyzeEntry({ note, phase, status, priority, materials, images, before: beforeImages, after: afterImages, general: generalImages, videos, imageCount: images.length, videoCount: videos.length, beforeImageCount: beforeImages.length, afterImageCount: afterImages.length });
    if (images.length && window.EpitesNaploAPI?.analyzePhotoWithAI) {
      try {
        showToast('AI kép + szöveg kontroll készítése...', 'info');
        const vision = await window.EpitesNaploAPI.analyzePhotoWithAI({ projectId: detailState.project.id, note, phase, status, priority, imageCount: images.length, beforeImageCount: beforeImages.length, afterImageCount: afterImages.length, images: images.slice(0, 3) });
        if (vision?.ok && vision.analysis) analysis = analyzeEntry({ ...vision.analysis, note, phase, status, priority, images, before: beforeImages, after: afterImages, general: generalImages, videos, imageCount: images.length, videoCount: videos.length, beforeImageCount: beforeImages.length, afterImageCount: afterImages.length });
      } catch (err) { console.warn('AI kép + szöveg kontroll helyi módra váltott:', err); }
    }
    qs('detailAiPreview')?.classList.remove('hidden');
    if (qs('detailAiPreview')) qs('detailAiPreview').innerHTML = `<b>AI kép + szöveg kontroll:</b> ${escapeHtml(analysis.level || 'Alacsony')} – ${escapeHtml(analysis.title || 'Elemzés')}<br><small>${escapeHtml(analysis.photoTextCheck || analysis.nextStep || '')}</small>`;
    try {
      await window.EpitesNaploAPI.saveEntry({ projectId: detailState.project.id, phase, status, priority, responsible, weather, note, images, beforeImages, afterImages, generalImages, image: images[0] || '', videos, videoUrls: videos, analysis, materials, weatherJson: v19WeatherJson, gpsJson: v19GpsJson || (gpsText ? { text: gpsText, captured_at: new Date().toISOString() } : null) });
      qs('detailNote').value = '';
      if (qs('detailFiles')) qs('detailFiles').value = '';
      if (qs('beforeFiles')) qs('beforeFiles').value = '';
      if (qs('afterFiles')) qs('afterFiles').value = '';
      if (qs('detailVideos')) qs('detailVideos').value = '';
      if (typeof clearMaterialRows === 'function') clearMaterialRows();
      v19WeatherJson = null; v19GpsJson = null;
      if(qs('weatherAutoText')) qs('weatherAutoText').value = '';
      await reloadProjectEntries();
      showToast('✔ Napi bejegyzés mentve a projekt idővonalába.', 'ok');
      qs('projectTimeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error(err);
      alert('Mentési hiba: ' + (err?.message || err || 'Ismeretlen hiba'));
    }
  };

  const oldRenderTimeline = renderProjectTimeline;
  renderProjectTimeline = function(){
    oldRenderTimeline.apply(this, arguments);
    // A már kirenderelt AI dobozokból kivesszük a fals fotóhiányt, ha az adott bejegyzésnél van kép vagy videó.
    document.querySelectorAll('.v50SmartSummary, .aiSmartSummary').forEach(box => {
      box.innerHTML = box.innerHTML
        .replace(/Nincs fotó, ezért képi állapot nem bizonyítható\.?/gi, '')
        .replace(/Takarásba kerülő munka szerepel, de nincs hozzá előtte fotó\.?/gi, '');
    });
  };
})();


// ===== V67: riport képnagyítás, PDF tördelés, ügyfélriport képek, másolható összefoglaló FIX =====
(function(){
  function v67Esc(value){
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function v67Plain(value){
    return String(value || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  }
  function v67Date(value){
    try { return value ? new Date(value).toLocaleString('hu-HU') : 'nincs dátum'; } catch(_) { return value || 'nincs dátum'; }
  }
  function v67SafeFileName(text){
    if (typeof safeFileName === 'function') return safeFileName(text);
    return String(text || 'epitesi-naplo').toLowerCase().replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'epitesi-naplo';
  }
  function v67MediaLightboxScript(){
    return `<script>(function(){
      function openMedia(src,type,title){
        if(!src)return;
        var modal=document.getElementById('v67Lightbox');
        if(!modal){
          modal=document.createElement('div');
          modal.id='v67Lightbox';
          modal.innerHTML='<div class="v67LightboxTop"><b id="v67LightboxTitle">Napló fotó</b><button type="button" id="v67LightboxClose">Bezárás ✕</button></div><div id="v67LightboxBody"></div>';
          document.body.appendChild(modal);
          document.getElementById('v67LightboxClose').onclick=function(){modal.classList.remove('open');document.getElementById('v67LightboxBody').innerHTML='';};
          modal.addEventListener('click',function(e){if(e.target===modal)document.getElementById('v67LightboxClose').click();});
          document.addEventListener('keydown',function(e){if(e.key==='Escape'&&modal.classList.contains('open'))document.getElementById('v67LightboxClose').click();});
        }
        document.getElementById('v67LightboxTitle').textContent=title||'Napló fotó';
        document.getElementById('v67LightboxBody').innerHTML= type==='video' ? '<video controls autoplay playsinline src="'+src.replace(/"/g,'&quot;')+'"></video>' : '<img src="'+src.replace(/"/g,'&quot;')+'" alt="Napló fotó">';
        modal.classList.add('open');
      }
      document.addEventListener('click',function(e){
        var img=e.target.closest('.v67ReportPhoto img,.photos img,.v67ReportPhotoOpen');
        if(img){e.preventDefault(); var src=img.getAttribute('href')||img.currentSrc||img.src; openMedia(src,'image','Napló fotó'); return;}
        var vid=e.target.closest('.videos video');
        if(vid){ openMedia(vid.currentSrc||vid.src,'video','Munkavideó'); }
      });
    })();<\/script>`;
  }
  function v67ReportCss(){
    return `
      body{font-family:Arial,sans-serif;color:#111;margin:0;padding:24px;line-height:1.42;background:#fff;font-size:15px;}
      h1{font-size:34px;line-height:1.08;margin:18px 0 12px;} h2{font-size:23px;margin:20px 0 10px;} h3{font-size:17px;margin:14px 0 8px;}
      .cover{border-bottom:4px solid #f5a400;margin-bottom:20px;padding-bottom:16px}.badge{display:inline-block;background:#fff3c4;color:#7a4a00;border-radius:999px;padding:7px 12px;font-weight:800;font-size:13px}.muted{color:#555}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0}.stat{background:#f3f4f6;border-radius:10px;padding:12px;min-height:54px}.stat b{display:block;font-size:22px;color:#d97706}.v67Section{break-inside:avoid;page-break-inside:avoid}.v67AiBox{break-inside:avoid;page-break-inside:avoid;border-left:4px solid #22c55e;background:#ecfdf5;margin:16px 0;padding:14px 18px}.entry{break-inside:avoid;page-break-inside:avoid;border-left:4px solid #f5a400;background:#fafafa;margin:18px 0;padding:14px 18px}.v70PhotoBlock{break-inside:avoid;page-break-inside:avoid;margin-top:14px}.photos{display:grid;grid-template-columns:repeat(auto-fill,128px);gap:12px;margin-top:10px;align-items:start;justify-content:start}.v67ReportPhoto{width:128px;height:128px;max-width:128px;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px;margin:0;box-sizing:border-box;break-inside:avoid;page-break-inside:avoid;overflow:hidden}.v67ReportPhoto a{display:block;width:100%;height:100%;aspect-ratio:1/1}.v67ReportPhoto img{width:100%!important;height:100%!important;aspect-ratio:1/1;object-fit:cover;border-radius:7px;display:block;cursor:zoom-in;background:#f8fafc}.v67ReportPhoto span{display:none!important}.videos{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:10px}.videos video{width:100%;max-height:280px;border-radius:10px;border:1px solid #ddd;background:#111}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border-bottom:1px solid #ddd;text-align:left;padding:8px}.v73InvoiceBlock{break-inside:avoid;page-break-inside:avoid;margin:10px 0 18px}.v73InvoiceBlock table,.v73InvoiceBlock tr,.v73InvoiceBlock td,.v73InvoiceBlock th{break-inside:avoid;page-break-inside:avoid}.v67PhotoHint{color:#9a5b00;font-weight:800;font-size:13px;margin:6px 0 0}.v67LightboxTop{position:fixed;left:0;right:0;top:0;height:58px;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 14px;z-index:10001;box-sizing:border-box}.v67LightboxTop button{border:0;border-radius:10px;background:#f5a400;color:#111;padding:9px 12px;font-weight:800}#v67Lightbox{display:none;position:fixed;inset:0;background:#020617;z-index:10000}#v67Lightbox.open{display:block}#v67LightboxBody{position:fixed;inset:58px 0 0 0;display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;overflow:auto}#v67LightboxBody img,#v67LightboxBody video{width:auto!important;height:auto!important;max-width:96vw!important;max-height:calc(100vh - 100px)!important;object-fit:contain;border-radius:12px;background:#000;display:block}#v67LightboxBody img{cursor:zoom-out}
      @media(max-width:700px){body{padding:16px;font-size:14px}h1{font-size:28px}.stats{grid-template-columns:repeat(2,1fr)}.photos{grid-template-columns:repeat(2,128px)}.v67ReportPhoto{width:128px;height:128px}.v67ReportPhoto img{width:100%!important;height:100%!important}}
      @media print{body{padding:10mm;font-size:11pt;line-height:1.32}h1{font-size:23pt;margin-top:4mm}h2{font-size:15pt}.cover,.v67Section,.v67AiBox{break-inside:avoid;page-break-inside:avoid}.entry{break-inside:auto;page-break-inside:auto}.v73InvoiceBlock{break-inside:avoid!important;page-break-inside:avoid!important}.v73InvoiceBlock table,.v73InvoiceBlock tr,.v73InvoiceBlock td,.v73InvoiceBlock th{break-inside:avoid!important;page-break-inside:avoid!important}.v70PhotoBlock{break-inside:auto;page-break-inside:auto;margin-top:5mm}.photos{display:grid!important;grid-template-columns:repeat(4,27mm)!important;gap:4mm!important;break-inside:auto!important;page-break-inside:auto!important}.v67ReportPhoto{width:27mm!important;height:27mm!important;max-width:27mm!important;padding:1.2mm!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}.v67ReportPhoto a{width:100%!important;height:100%!important}.v67ReportPhoto img{width:100%!important;height:100%!important;object-fit:cover!important}.v67ReportPhoto span,.v67PhotoHint{display:none!important}#v67Lightbox{display:none!important}.stats{grid-template-columns:repeat(5,1fr)}.stat{padding:7px}.stat b{font-size:15pt}}
    `;
  }
  function v67BuildReport(entries, title, options={}){
    entries = Array.isArray(entries) ? entries : [];
    const materials = options.materials || [];
    const invoices = options.invoices || [];
    const invoiceSum = invoices.reduce((s,i)=>s+Number(i.amount||0),0);
    const materialTotals = {};
    materials.forEach(m=>{ const key=`${m.name||'Anyag'}|${m.unit||'db'}`; materialTotals[key]=(materialTotals[key]||0)+Number(m.quantity||0); });
    const materialHtml = Object.entries(materialTotals).map(([key,qty])=>{ const [name,unit]=key.split('|'); return `<li><b>${v67Esc(name)}</b>: ${Number(Number(qty).toFixed(2))} ${v67Esc(unit)}</li>`; }).join('') || '<li>Nincs rögzített anyag.</li>';
    const invoiceHtml = invoices.map(i=>`<tr><td>${v67Esc(i.title)}</td><td>${Number(i.amount||0).toLocaleString('hu-HU')} Ft</td><td>${v67Esc(i.note||'')}</td></tr>`).join('') || '<tr><td colspan="3">Nincs csatolt számla.</td></tr>';
    const imageCount = entries.reduce((s,e)=>s+(typeof getEntryImages==='function'?getEntryImages(e).length:0),0);
    const videoCount = entries.reduce((s,e)=>s+(typeof getEntryVideos==='function'?getEntryVideos(e).length:0),0);
    const summaryText = imageCount ? `A dokumentum az ügyfélnek átadható, rendezett építési napló: napi munka, fotódokumentáció, anyagok, időjárás/GPS és nyitott ellenőrzések egy helyen.` : `A dokumentum az ügyfélnek átadható építési napló. Érdemes legalább néhány fotót is csatolni a dokumentáció erősítéséhez.`;
    const entriesHtml = entries.map(e=>{
      const images = typeof getEntryImages === 'function' ? getEntryImages(e) : [];
      const videos = typeof getEntryVideos === 'function' ? getEntryVideos(e) : [];
      const weather = e.weather_json ? `${v67Esc(e.weather_json.temperature)} °C, ${v67Esc(e.weather_json.text)}, szél: ${v67Esc(e.weather_json.wind)} km/h` : v67Esc(e.weather || '');
      const gps = e.gps_json?.text || (e.gps_json?.lat ? `${e.gps_json.lat}, ${e.gps_json.lon}` : '');
      const mats = e.materials_json || [];
      const photos = images.length ? `<div class="v70PhotoBlock"><h3>Munka közben / dokumentáció</h3><p class="v67PhotoHint">Kattints bármelyik fotóra a nagyításhoz.</p><div class="photos">${images.map((src,idx)=>`<figure class="v67ReportPhoto"><a class="v67ReportPhotoOpen" href="${v67Esc(src)}"><img crossorigin="anonymous" src="${v67Esc(src)}" alt="Napló fotó ${idx+1}"></a><span>Nagyítás</span></figure>`).join('')}</div></div>` : '<p><b>Fotók:</b> nincs csatolt fotó ehhez a bejegyzéshez.</p>';
      const vids = videos.length ? `<h3>Munkavideók</h3><div class="videos">${videos.map(v=> v?.path ? `<video controls playsinline preload="metadata" data-video-path="${v67Esc(v.path)}"></video>` : `<video controls playsinline preload="metadata" src="${v67Esc(v.src || v)}"></video>`).join('')}</div>` : '';
      return `<section class="entry"><h2>${v67Date(e.created_at)} – ${v67Esc(e.phase||'Napi bejegyzés')}</h2><p>${v67Esc(e.note||'').replace(/\n/g,'<br>')}</p><p><b>Időjárás:</b> ${weather || 'nincs adat'} ${gps ? '<br><b>GPS/hely:</b> '+v67Esc(gps) : ''}</p>${Array.isArray(mats)&&mats.length?`<p><b>Napi anyag:</b> ${mats.map(m=>`${v67Esc(m.name)} ${v67Esc(m.quantity)} ${v67Esc(m.unit)}`).join(', ')}</p>`:''}${photos}${vids}</section>`;
    }).join('') || '<p>Nincs bejegyzés.</p>';
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${v67Esc(title)}</title><style>${v67ReportCss()}</style></head><body><div class="cover"><span class="badge">Átadásra kész dokumentáció</span><h1>${v67Esc(title)}</h1><p class="muted">Generálva: ${new Date().toLocaleString('hu-HU')} • ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>${entries.length}</b>bejegyzés</div><div class="stat"><b>${imageCount}</b>fotó</div><div class="stat"><b>${videoCount}</b>videó</div><div class="stat"><b>${entries.filter(e => String(e.ai_level || e.analysis?.level || '').toLowerCase().includes('magas')).length}</b>magas kockázat</div><div class="stat"><b>${invoiceSum.toLocaleString('hu-HU')} Ft</b>számlák</div></div></div><section class="v67Section"><h2>Rövid összegzés</h2><p>${summaryText}</p></section><section class="v67Section"><h2>Anyagösszesítő</h2><ul>${materialHtml}</ul></section><section class="v67Section v73InvoiceBlock"><h2>Számlák</h2><table><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr>${invoiceHtml}</table></section><section class="v67AiBox"><h2>Vezetői AI összefoglaló</h2><p>Állapot: rendezett dokumentáció. Bejegyzések: ${entries.length}, fotók: ${imageCount}, videók: ${videoCount}. ${entries.length ? 'A napi bejegyzések és fotók alapján az ügyfél számára átadható dokumentáció készült.' : 'Még nincs naplóbejegyzés.'}</p><h3>Következő lépések</h3><ul><li>Tartsd meg a fotó + rövid szöveg ritmust minden munkanapon.</li><li>Átadás előtt ellenőrizd a fotók és anyagok teljességét.</li><li>Ügyfélnek küldés előtt nyisd meg a riportot ellenőrzésre.</li></ul></section><h2>Napi bejegyzések</h2>${entriesHtml}${v67MediaLightboxScript()}</body></html>`;
  }
  window.buildProReportHtml = v67BuildReport;
  window.downloadWeeklyReportHtml = async function(){
    const now = new Date(); const weekAgo = new Date(); weekAgo.setDate(now.getDate()-7);
    const entries = (detailState.entries || []).filter(e => new Date(e.created_at) >= weekAgo);
    const data = await window.EpitesNaploAPI.getProjectCloseData(detailState.project.id);
    const title = `${detailState.project?.name || 'Projekt'} – heti PRO építési napló`;
    downloadTextFile(`${v67SafeFileName(title)}.html`, v67BuildReport(entries, title, data));
    showToast('✔ Heti riport HTML letöltve. A fotók kattintásra nagyíthatók.', 'ok');
  };
  window.downloadClosingReportHtml = async function(){
    const data = await window.EpitesNaploAPI.getProjectCloseData(detailState.project.id);
    const title = `${detailState.project?.name || 'Projekt'} – lezáró dokumentum`;
    downloadTextFile(`${v67SafeFileName(title)}.html`, v67BuildReport(data.entries, title, data));
    showToast('✔ Lezáró riport HTML letöltve. A fotók kattintásra nagyíthatók.', 'ok');
  };
  window.exportClosingPdfV25 = async function(){
    if(!detailState.project) return alert('Nincs projekt.');
    const data = await window.EpitesNaploAPI.getProjectCloseData(detailState.project.id);
    const title = `${detailState.project?.name || 'Projekt'} – lezáró PRO építési napló`;
    await exportReportHtmlToPdfV25(v67BuildReport(data.entries, title, data), `${v67SafeFileName(title)}.pdf`);
  };
  window.exportWeeklyPdfV25 = async function(){
    if(!detailState.project) return alert('Nincs projekt.');
    const now = new Date(); const weekAgo = new Date(); weekAgo.setDate(now.getDate()-7);
    const entries = (detailState.entries || []).filter(e => new Date(e.created_at) >= weekAgo);
    const data = await window.EpitesNaploAPI.getProjectCloseData(detailState.project.id);
    const title = `${detailState.project?.name || 'Projekt'} – heti PRO építési napló`;
    await exportReportHtmlToPdfV25(v67BuildReport(entries, title, data), `${v67SafeFileName(title)}.pdf`);
  };
  window.printWeeklyReport = window.exportWeeklyPdfV25;
  window.printClosingDocument = window.exportClosingPdfV25;
  window.createProjectClientLinkV25 = async function(){
    if(!detailState.project) return alert('Nincs projekt.');
    try{
      const data = await window.EpitesNaploAPI.getProjectCloseData(detailState.project.id);
      const title = `${detailState.project?.name || 'Projekt'} – ügyfélriport`;
      const reportHtml = v67BuildReport(data.entries, title, data);
      const imageCount = data.entries.reduce((s,e)=>s+getEntryImages(e).length,0);
      const text = `${title}\nBejegyzések: ${data.entries.length}\nFotók: ${imageCount}\nSzámlák: ${data.invoices.reduce((s,i)=>s+Number(i.amount||0),0).toLocaleString('hu-HU')} Ft`;
      const saved = await window.EpitesNaploAPI.createPublicReport({ projectId: detailState.project.id, projectName: detailState.project.name || '', reportHtml, reportText: text });
      const link = window.EpitesNaploAPI.createClientShareUrl(saved.token);
      window.lastClientReportLinkV67 = link;
      try { localStorage.setItem(`epitesnaplo:lastReportLink:${detailState.project.id}`, link); } catch(_) {}
      await navigator.clipboard.writeText(link);
      showProjectHelp('Ügyfél link elkészült', `<div class="featureHelpBox"><b>Biztonságos ügyfél link</b><p>A link kimásolva a vágólapra. Az ügyfél meg tudja nyitni, látja a fotókat, PDF-et tölthet le, és jóváhagyhatja a riportot.</p><p><a class="btn primary" target="_blank" href="${v67Esc(link)}">Ügyfélriport megnyitása</a></p><p class="muted">${v67Esc(link)}</p></div>`);
    }catch(err){ console.error(err); alert('Ügyfél link létrehozási hiba: ' + (err.message || err)); }
  };
  window.copyProjectSummary = function(){
    const entries = detailState.entries || [];
    const photos = entries.reduce((s,e)=>s+getEntryImages(e).length,0);
    const videos = entries.reduce((s,e)=>s+getEntryVideos(e).length,0);
    let link = window.lastClientReportLinkV67 || '';
    try { link = link || localStorage.getItem(`epitesnaplo:lastReportLink:${detailState.project?.id}`) || ''; } catch(_) {}
    const lines = [];
    lines.push(`${detailState.project?.name || 'Projekt'} – építési napló összefoglaló`);
    lines.push(`Állapot: ${detailState.project?.status || 'folyamatban'}`);
    lines.push(`Bejegyzések száma: ${entries.length}`);
    lines.push(`Fotók: ${photos}, videók: ${videos}`);
    lines.push(`Utolsó bejegyzés: ${entries[0] ? v67Date(entries[0].created_at) : 'nincs'}`);
    if (link) lines.push(`Ügyfélriport link: ${link}`);
    lines.push('');
    entries.slice(0,5).forEach(e => {
      lines.push(`- ${v67Date(e.created_at)} – ${e.phase || 'Napi bejegyzés'}`);
      const note = v67Plain(e.note || '');
      if(note) lines.push(`  ${note.slice(0, 420)}${note.length > 420 ? '...' : ''}`);
      const imgCount = getEntryImages(e).length;
      if(imgCount) lines.push(`  Fotó: ${imgCount} db`);
    });
    const text = lines.join('\n');
    navigator.clipboard?.writeText(text).then(()=>showToast('Teljesebb összefoglaló kimásolva.', 'ok')).catch(()=>alert(text));
  };
})();

// ===== V68: projekt ZIP mentés, stabil média nézet és saját példány =====
(function(){
  function safeName(text){
    try { if (typeof safeFileName === 'function') return safeFileName(text); } catch(_) {}
    return String(text || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'epitesi-naplo';
  }
  function collectImages(entries){
    const out=[]; (entries||[]).forEach((e,ei)=>{ const list=(typeof getEntryImages==='function'?getEntryImages(e):[]); list.forEach((src,idx)=>{ if(src) out.push({src,name:`bejegyzes-${ei+1}-foto-${idx+1}`}); }); }); return out;
  }
  function collectVideos(entries){
    const out=[]; (entries||[]).forEach((e,ei)=>{ const list=(typeof getEntryVideos==='function'?getEntryVideos(e):[]); list.forEach((v,idx)=>{ const src=typeof v==='object'?(v.src||v.url||v.publicUrl||''):v; if(src) out.push({src,name:`bejegyzes-${ei+1}-video-${idx+1}`}); }); }); return out;
  }
  function extFromUrl(url, fallback){ try{ const ext=String(url).split('?')[0].split('#')[0].split('.').pop().toLowerCase(); return /^[a-z0-9]{2,5}$/.test(ext)?ext:fallback; }catch(_){ return fallback; } }
  function loadJSZip(){
    if(window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((resolve,reject)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'; s.async=true; s.onload=()=>window.JSZip?resolve(window.JSZip):reject(new Error('JSZip nem töltődött be.')); s.onerror=()=>reject(new Error('A ZIP készítő könyvtár nem töltődött be.')); document.head.appendChild(s); });
  }
  async function fetchBlob(url){ const res=await fetch(url,{mode:'cors',credentials:'omit'}); if(!res.ok) throw new Error('Letöltési hiba '+res.status); return await res.blob(); }
  function downloadBlob(filename, blob){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},1200); }
  window.v68DownloadProjectZip = async function(){
    if(!detailState?.project) return alert('Nincs megnyitott projekt.');
    const buttons=[...document.querySelectorAll('button')].filter(b=>(b.textContent||'').includes('ZIP-be'));
    buttons.forEach(b=>{b.disabled=true;b.dataset.oldText=b.textContent;b.textContent='ZIP készítése...';});
    try{
      const JSZip=await loadJSZip(); const zip=new JSZip();
      let closeData=null; try{ closeData=await window.EpitesNaploAPI?.getProjectCloseData?.(detailState.project.id); }catch(_){}
      const entries=closeData?.entries || detailState.entries || [];
      const title=`${detailState.project.name || 'Projekt'} – lezárt projekt saját példány`;
      const reportHtml=(typeof window.buildProReportHtml==='function') ? window.buildProReportHtml(entries,title,closeData||{}) : `<html><body><h1>${title}</h1></body></html>`;
      zip.file('riport.html',reportHtml);
      zip.file('adatok.json',JSON.stringify({exportedAt:new Date().toISOString(),project:detailState.project,entries,materials:closeData?.materials||[],invoices:closeData?.invoices||[],approvals:closeData?.approvals||[]},null,2));
      const failed=[];
      for(const item of collectImages(entries)){ try{ zip.file(`kepek/${safeName(item.name)}.${extFromUrl(item.src,'jpg')}`, await fetchBlob(item.src)); }catch(e){ failed.push('KÉP: '+item.src); } }
      for(const item of collectVideos(entries)){ try{ zip.file(`videok/${safeName(item.name)}.${extFromUrl(item.src,'mp4')}`, await fetchBlob(item.src)); }catch(e){ failed.push('VIDEÓ: '+item.src); } }
      if(failed.length) zip.file('media-linkek.txt',failed.join('\n'));
      zip.file('README.txt','ÉpítésNapló AI PRO saját projektmentés. A riport.html böngészőben megnyitható. Az adatok.json tartalmazza a napló adatokat.');
      const blob=await zip.generateAsync({type:'blob'});
      downloadBlob(`${safeName(detailState.project.name || 'epitesi-naplo')}-projekt-mentes.zip`,blob);
      showToast('✔ Projekt ZIP mentés elkészült. Ez a saját példányod.', 'ok');
    }catch(err){ console.error(err); alert('Projekt ZIP mentési hiba: '+(err.message||err)); }
    finally{ buttons.forEach(b=>{b.disabled=false;b.textContent=b.dataset.oldText||'Projekt mentése ZIP-be';}); }
  };
})();

// ===== V69: profi UX riportközpont =====
function openReportCenterV69(){
  const modal = document.getElementById('reportCenterV69');
  if(!modal) return;
  modal.classList.remove('hidden');
  document.body.classList.add('v69ModalOpen');
}
function closeReportCenterV69(){
  const modal = document.getElementById('reportCenterV69');
  if(!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('v69ModalOpen');
}
function scrollToProjectStorageV69(){
  const box = document.getElementById('v33StorageBox') || document.querySelector('.projectSummaryCard') || document.querySelector('#projectSummary');
  if(box){ box.scrollIntoView({behavior:'smooth', block:'center'}); }
}
document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeReportCenterV69(); });

// ===== V71: ügyfél jóváhagyás PRO - saját letölthető példány =====
(function(){
  function safeNameV71(text){
    return String(text || 'jovahagyott-riport').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'jovahagyott-riport';
  }
  function downloadTextV71(filename, text, type='text/html;charset=utf-8'){
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }
  function normalizeApprovedHtmlV71(row){
    const body = row?.approved_report_html || row?.report_html_snapshot || row?.report_html || '';
    if(!body) return '';
    if(/<!doctype|<html/i.test(body)) return body;
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jóváhagyott építési napló riport</title><link rel="stylesheet" href="style.css"><style>body{background:#f8fafc;color:#111827;font-family:Arial,sans-serif;padding:24px}.approvedStamp{border:2px solid #22c55e;background:#ecfdf5;border-radius:14px;padding:14px;margin:0 0 18px}.publicReportCard{max-width:1050px;margin:auto;background:white;padding:24px;border-radius:18px}.mediaViewerModal,.topbar{display:none!important}@media print{body{padding:0;background:#fff}.publicReportCard{box-shadow:none;border-radius:0}.approvedStamp{break-inside:avoid}}</style></head><body><div class="publicReportCard"><div class="approvedStamp"><b>Jóváhagyott példány</b><br>Elfogadás dátuma: ${String(row?.approved_at || '').replace('T',' ').slice(0,19)}<br>Ügyfél: ${String(row?.client_name || '')}</div>${body}</div></body></html>`;
  }
  window.v71DownloadApprovedHtml = async function(approvalId){
    const row = await window.EpitesNaploAPI?.getApprovedReportHtml?.(approvalId);
    if(!row) return alert('Nem találom a jóváhagyott példányt. Ellenőrizd, hogy a V71 SQL le van-e futtatva.');
    const html = normalizeApprovedHtmlV71(row);
    if(!html) return alert('Ehhez a jóváhagyáshoz nincs mentett riport példány. Kérlek hozz létre új ügyfélriport linket V71 után.');
    downloadTextV71(`${safeNameV71(detailState?.project?.name || 'epitesi-naplo')}-jovahagyott-riport.html`, html);
  };
  window.v71PrintApprovedReport = async function(approvalId){
    const row = await window.EpitesNaploAPI?.getApprovedReportHtml?.(approvalId);
    if(!row) return alert('Nem találom a jóváhagyott példányt.');
    const html = normalizeApprovedHtmlV71(row);
    if(!html) return alert('Ehhez a jóváhagyáshoz nincs mentett riport példány.');
    const w = window.open('', '_blank');
    if(!w) return alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakot.');
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(()=>{ try{ w.focus(); w.print(); }catch(_){} }, 800);
  };
  async function renderApprovalsV71(){
    const projectId = detailState?.project?.id;
    const box = document.getElementById('v71ApprovalsBox');
    if(!box || !projectId) return;
    box.innerHTML = '<b>Ügyfél jóváhagyások</b><p class="muted">Betöltés...</p>';
    let rows=[];
    try { rows = await window.EpitesNaploAPI.getReportApprovals(projectId); } catch(e){ console.warn(e); }
    if(!rows.length){
      box.innerHTML = '<b>Ügyfél jóváhagyások</b><p class="muted">Még nincs ügyfél által mentett visszajelzés.</p>';
      return;
    }
    box.innerHTML = `<b>Ügyfél jóváhagyások</b>${rows.slice(0,5).map(r=>{
      const decision = String(r.decision || (r.approved ? 'accepted' : 'viewed')).toLowerCase();
      const label = decision === 'accepted' ? 'Jóváhagyva / Elfogadva' : decision === 'question' ? 'Kérdésem van' : 'Megtekintve';
      const cls = decision === 'accepted' ? 'ok' : decision === 'question' ? 'warn' : 'info';
      const canDownload = !!(r.approved_report_html || r.report_html_snapshot || r.report_html);
      return `<div class="v71ApprovalRow">
        <div><span class="tag ${cls}">${escapeHtml(label)}</span><br><small>${escapeHtml(formatDate(r.approved_at || r.created_at || ''))} ${r.client_name ? '• '+escapeHtml(r.client_name) : ''}</small>${r.message ? `<p>${escapeHtml(r.message)}</p>` : ''}</div>
        <div class="v71ApprovalActions">
          <button class="btn small primary" type="button" data-v71-download="${r.id}" onclick="v71DownloadApprovedHtml('${r.id}')" ${canDownload?'':'disabled'}>Jóváhagyott HTML letöltése</button>
          <button class="btn small ghost" type="button" data-v71-print="${r.id}" onclick="v71PrintApprovedReport('${r.id}')" ${canDownload?'':'disabled'}>PDF / nyomtatás</button>
        </div>
      </div>`;
    }).join('')}`;
  }
  function ensureApprovalBoxV71(){
    const host = document.getElementById('v33StorageBox') || document.getElementById('projectSummaryBox');
    if(!host || document.getElementById('v71ApprovalsBox')) return;
    const box = document.createElement('div');
    box.id = 'v71ApprovalsBox';
    box.className = 'notice v71ApprovalsBox';
    host.insertAdjacentElement('afterend', box);
  }
  const oldRenderSummary = window.renderProjectSummary || (typeof renderProjectSummary === 'function' ? renderProjectSummary : null);
  if(oldRenderSummary){
    window.renderProjectSummary = async function(){
      const res = oldRenderSummary.apply(this, arguments);
      ensureApprovalBoxV71();
      setTimeout(renderApprovalsV71, 120);
      return res;
    };
    try { renderProjectSummary = window.renderProjectSummary; } catch(_) {}
  }
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(()=>{ ensureApprovalBoxV71(); renderApprovalsV71(); }, 900));
})();


// ===== V73: jóváhagyott példány gombok + riport/PDF tördelés stabilizálás =====
(function(){
  function v73Safe(text){
    return String(text || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  }
  function v73DownloadText(filename, text, type='text/html;charset=utf-8'){
    const blob = new Blob([text], {type});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function v73ImproveReportHtml(html){
    html = String(html || '');
    const extraCss = `.v73InvoiceBlock{break-inside:avoid!important;page-break-inside:avoid!important}.v73InvoiceBlock table,.v73InvoiceBlock tr,.v73InvoiceBlock td,.v73InvoiceBlock th{break-inside:avoid!important;page-break-inside:avoid!important}.v67ReportPhoto{width:128px!important;height:128px!important}.v67ReportPhoto img{width:100%!important;height:100%!important;object-fit:cover!important}@media print{.v73InvoiceBlock{break-inside:avoid!important;page-break-inside:avoid!important}.v73InvoiceBlock table,.v73InvoiceBlock tr,.v73InvoiceBlock td,.v73InvoiceBlock th{break-inside:avoid!important;page-break-inside:avoid!important}.photos{grid-template-columns:repeat(4,27mm)!important;gap:4mm!important}.v67ReportPhoto{width:27mm!important;height:27mm!important;max-width:27mm!important}.v67ReportPhoto img{width:100%!important;height:100%!important;object-fit:cover!important}}`;
    if(html.includes('</style>')) html = html.replace('</style>', extraCss + '</style>');
    if(!html.includes('v73InvoiceBlock')){
      html = html.replace('<h2>Számlák</h2><table>', '<div class="v73InvoiceBlock"><h2>Számlák</h2><table>');
      html = html.replace('</table></section><section class="v67AiBox">', '</table></div></section><section class="v67AiBox">');
    }
    return html;
  }
  async function v73GetApprovalRow(approvalId){
    let row = null;
    try { row = await window.EpitesNaploAPI?.getApprovedReportHtml?.(approvalId); } catch(_) {}
    if(row) return row;
    try {
      const projectId = detailState?.project?.id;
      if(projectId && window.EpitesNaploAPI?.getReportApprovals){
        const rows = await window.EpitesNaploAPI.getReportApprovals(projectId);
        row = (rows || []).find(r => String(r.id) === String(approvalId));
      }
    } catch(_) {}
    return row;
  }
  async function v73BuildFallbackApprovedHtml(row){
    const project = detailState?.project || {};
    let data = null;
    try { data = await window.EpitesNaploAPI?.getProjectCloseData?.(project.id); } catch(_) {}
    const entries = data?.entries || detailState?.entries || [];
    const title = `${project.name || 'Építési napló'} – jóváhagyott példány`;
    let body = '';
    if(typeof window.buildProReportHtml === 'function'){
      body = window.buildProReportHtml(entries, title, data || {});
    } else if(typeof buildProReportHtml === 'function'){
      body = buildProReportHtml(entries, title, data || {});
    }
    if(!body) body = '<h1>Jóváhagyott építési napló</h1><p>A riport adatai nem tölthetők be.</p>';
    return body;
  }
  async function v73NormalizeApprovedHtml(approvalId){
    const row = await v73GetApprovalRow(approvalId);
    if(!row) throw new Error('Nem találom a jóváhagyott példányt. Ha még nem futtattad, futtasd a V71 SQL fájlt Supabase-ben.');
    let body = row.approved_report_html || row.report_html_snapshot || row.report_html || '';
    if(!body) body = await v73BuildFallbackApprovedHtml(row);
    body = v73ImproveReportHtml(body);
    if(/<!doctype|<html/i.test(body)){
      const stamp = `<div class="approvedStamp"><b>Jóváhagyott példány</b><br>Elfogadás dátuma: ${String(row.approved_at || row.created_at || '').replace('T',' ').slice(0,19)}<br>Ügyfél: ${String(row.client_name || '')}</div>`;
      if(body.includes('<body>')) body = body.replace('<body>', '<body>'+stamp);
      return body;
    }
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jóváhagyott építési napló riport</title><link rel="stylesheet" href="style.css"><style>body{background:#f8fafc;color:#111827;font-family:Arial,sans-serif;padding:24px}.approvedStamp{border:2px solid #22c55e;background:#ecfdf5;border-radius:14px;padding:14px;margin:0 0 18px}.publicReportCard{max-width:1050px;margin:auto;background:white;padding:24px;border-radius:18px}@media print{body{padding:0;background:#fff}.publicReportCard{box-shadow:none;border-radius:0}.approvedStamp{break-inside:avoid}}</style></head><body><div class="publicReportCard"><div class="approvedStamp"><b>Jóváhagyott példány</b><br>Elfogadás dátuma: ${String(row.approved_at || row.created_at || '').replace('T',' ').slice(0,19)}<br>Ügyfél: ${String(row.client_name || '')}</div>${body}</div></body></html>`;
  }
  window.v71DownloadApprovedHtml = async function(approvalId){
    try{
      const html = await v73NormalizeApprovedHtml(approvalId);
      v73DownloadText(`${v73Safe(detailState?.project?.name || 'epitesi-naplo')}-jovahagyott-riport.html`, html);
      if(typeof showToast === 'function') showToast('✔ Jóváhagyott HTML példány letöltve.', 'ok');
    }catch(err){ alert(err.message || err); }
  };
  window.v71PrintApprovedReport = async function(approvalId){
    try{
      const html = await v73NormalizeApprovedHtml(approvalId);
      const w = window.open('', '_blank');
      if(!w) return alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakot.');
      w.document.open(); w.document.write(html); w.document.close();
      setTimeout(()=>{ try{ w.focus(); w.print(); }catch(_){} }, 900);
    }catch(err){ alert(err.message || err); }
  };
  document.addEventListener('click', function(e){
    const btn = e.target.closest('[data-v71-download],[data-v71-print]');
    if(!btn) return;
    const id = btn.getAttribute('data-v71-download') || btn.getAttribute('data-v71-print');
    e.preventDefault();
    if(btn.hasAttribute('data-v71-download')) window.v71DownloadApprovedHtml(id);
    else window.v71PrintApprovedReport(id);
  });
})();

// ===== V74: PRO riport dokumentumkezelő + PDF/kép javítás =====
(function(){
  function v74Safe(text){
    return String(text || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  }
  function v74Esc(text){
    if(typeof escapeHtml === 'function') return escapeHtml(text);
    return String(text ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function v74Download(filename, content, mime='text/html;charset=utf-8'){
    const blob = new Blob([content], { type:mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1400);
  }
  function v74Media(entry){
    let images = [];
    try { images = typeof getEntryImages === 'function' ? getEntryImages(entry) : []; } catch(_) {}
    if(!images?.length){
      images = []
        .concat(Array.isArray(entry?.images) ? entry.images : [])
        .concat(Array.isArray(entry?.image_urls) ? entry.image_urls : [])
        .concat(Array.isArray(entry?.beforeImages) ? entry.beforeImages : [])
        .concat(Array.isArray(entry?.afterImages) ? entry.afterImages : [])
        .concat(Array.isArray(entry?.generalImages) ? entry.generalImages : [])
        .concat(entry?.image_url ? [entry.image_url] : [])
        .concat(entry?.image ? [entry.image] : []);
    }
    let videos = [];
    try { videos = typeof getEntryVideos === 'function' ? getEntryVideos(entry) : []; } catch(_) {}
    return { images:[...new Set((images || []).filter(Boolean))], videos:[...new Set((videos || []).filter(Boolean))] };
  }
  function v74ProjectTitle(){ return detailState?.project?.name || 'Építési napló'; }
  function v74CollectMaterials(entries, options){
    const totals = {};
    (options?.materials || []).forEach(m => {
      const key = `${m.name || 'Anyag'}|${m.unit || 'db'}`;
      totals[key] = (totals[key] || 0) + Number(m.quantity || 0);
    });
    (entries || []).forEach(e => {
      const list = Array.isArray(e.materials_json) ? e.materials_json : [];
      list.forEach(m => {
        const key = `${m.name || 'Anyag'}|${m.unit || 'db'}`;
        totals[key] = (totals[key] || 0) + Number(m.quantity || 0);
      });
    });
    return Object.entries(totals).map(([key, qty]) => {
      const [name, unit] = key.split('|');
      return { name, unit, quantity: Number(Number(qty).toFixed(2)) };
    });
  }
  function v74ReportHtml(entries, title, options={}){
    entries = Array.isArray(entries) ? entries : [];
    const materials = v74CollectMaterials(entries, options);
    const invoices = Array.isArray(options.invoices) ? options.invoices : [];
    const invoiceSum = invoices.reduce((s,i)=>s+Number(i.amount||0),0);
    const imageCount = entries.reduce((s,e)=>s+v74Media(e).images.length,0);
    const videoCount = entries.reduce((s,e)=>s+v74Media(e).videos.length,0);
    const materialHtml = materials.length ? materials.map(m=>`<li><b>${v74Esc(m.name)}</b>: ${v74Esc(m.quantity)} ${v74Esc(m.unit)}</li>`).join('') : '<li>Nincs rögzített anyag.</li>';
    const invoiceHtml = invoices.length ? `<table><thead><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr></thead><tbody>${invoices.map(i=>`<tr><td>${v74Esc(i.title||'Számla')}</td><td>${Number(i.amount||0).toLocaleString('hu-HU')} Ft</td><td>${v74Esc(i.note||'')}</td></tr>`).join('')}</tbody></table>` : '<div class="v74Empty">Nincs csatolt számla.</div>';
    const entriesHtml = entries.map((e, idx)=>{
      const media = v74Media(e);
      const weather = e.weather_json ? `${v74Esc(e.weather_json.temperature)} °C, ${v74Esc(e.weather_json.text)}, szél: ${v74Esc(e.weather_json.wind)} km/h, csapadék: ${v74Esc(e.weather_json.rain || 0)} mm` : v74Esc(e.weather || 'nincs adat');
      const gps = e.gps_json?.text || (e.gps_json?.lat ? `${e.gps_json.lat}, ${e.gps_json.lon}` : '');
      const mats = Array.isArray(e.materials_json) ? e.materials_json : [];
      const analysis = e.ai_json || e.analysis || {};
      const note = String(e.note || '').replace(/\n/g,'<br>');
      return `<section class="v74Entry"><h2>${v74Esc(formatDate ? formatDate(e.created_at) : e.created_at || '')} – ${v74Esc(e.phase || 'Napi bejegyzés')}</h2>
        <div class="v74EntryText"><p>${v74Esc(note).replace(/&lt;br&gt;/g,'<br>')}</p></div>
        <div class="v74Facts">
          <p><b>Dokumentáció:</b> ${media.images.length} fotó, ${media.videos.length} videó.</p>
          <p><b>Időjárás:</b> ${weather}${gps ? `<br><b>GPS/hely:</b> ${v74Esc(gps)}` : ''}</p>
          ${mats.length ? `<p><b>Napi anyag:</b> ${mats.map(m=>`${v74Esc(m.name)} ${v74Esc(m.quantity)} ${v74Esc(m.unit)}`).join(', ')}</p>` : ''}
          ${analysis?.photoTextCheck ? `<p><b>AI szakmai kontroll:</b> ${v74Esc(analysis.photoTextCheck)}</p>` : ''}
        </div>
        ${media.images.length ? `<h3>Munka közben / fotódokumentáció</h3><p class="v74Hint">Kattints a képre a nagyításhoz.</p><div class="v74Photos">${media.images.map((src,i)=>`<button class="v74Photo" type="button" onclick="window.v74OpenReportPhoto && window.v74OpenReportPhoto('${String(src).replace(/'/g,'\\\'')}')"><img src="${v74Esc(src)}" alt="Napló fotó ${idx+1}/${i+1}" loading="eager"></button>`).join('')}</div>` : '<p class="v74Muted">Ehhez a bejegyzéshez nincs csatolt fotó.</p>'}
      </section>`;
    }).join('') || '<p>Nincs bejegyzés.</p>';
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${v74Esc(title)}</title><style>
      :root{--accent:#f5a400;--text:#111827;--muted:#4b5563;--soft:#f8fafc;--ok:#10b981}
      *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:var(--text);background:#fff;margin:0;padding:28px;line-height:1.48}.v74Doc{max-width:1100px;margin:auto}.v74Badge{display:inline-block;background:#fff2bf;color:#8a5a00;border-radius:999px;padding:7px 13px;font-weight:700}.v74Cover{border-bottom:4px solid var(--accent);padding-bottom:18px;margin-bottom:22px}.v74Cover h1{font-size:34px;line-height:1.08;margin:24px 0 8px}.v74Muted,.v74Hint{color:var(--muted)}.v74Stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:22px 0}.v74Stat{background:#f3f4f6;border-radius:12px;padding:14px}.v74Stat b{display:block;font-size:24px;color:#d97706}.v74Section{break-inside:avoid;page-break-inside:avoid;margin:22px 0}.v74Empty{border:1px solid #e5e7eb;border-radius:10px;padding:12px;background:#fafafa}.v74Ai{border-left:5px solid #22c55e;background:#ecfdf5;padding:18px 22px;margin:24px 0;break-inside:avoid;page-break-inside:avoid}.v74Entry{border-left:4px solid var(--accent);background:#fafafa;margin:22px 0;padding:18px 22px;break-inside:avoid;page-break-inside:avoid}.v74Entry h2{font-size:24px;line-height:1.2}.v74EntryText,.v74Facts{font-size:15px}.v74Photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,132px));gap:14px;align-items:start;margin-top:10px}.v74Photo{width:132px;height:132px;border:1px solid #d1d5db;border-radius:12px;padding:5px;background:#fff;cursor:pointer;overflow:hidden}.v74Photo img{display:block;width:100%;height:100%;object-fit:cover;border-radius:8px}.v74Lightbox{position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.86);display:flex;align-items:center;justify-content:center;padding:24px}.v74Lightbox img{max-width:96vw;max-height:92vh;object-fit:contain;border-radius:12px;background:#111}.v74Lightbox button{position:fixed;top:16px;right:18px;font-size:18px;border:0;border-radius:999px;padding:10px 14px;cursor:pointer}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e5e7eb;text-align:left;padding:9px}
      @media print{body{padding:18mm}.v74Doc{max-width:none}.v74Cover{break-inside:avoid;page-break-inside:avoid}.v74Stats{grid-template-columns:repeat(5,1fr)}.v74Section,.v74Ai,.v74Entry{break-inside:avoid;page-break-inside:avoid}.v74Photos{grid-template-columns:repeat(4,30mm)!important;gap:5mm!important}.v74Photo{width:30mm!important;height:30mm!important;padding:1.5mm!important}.v74Photo img{width:100%!important;height:100%!important;object-fit:cover!important}.v74Hint{display:none}.v74Lightbox{display:none!important}h1,h2,h3{break-after:avoid;page-break-after:avoid}table,tr,td,th{break-inside:avoid;page-break-inside:avoid}}
      @media(max-width:720px){body{padding:18px}.v74Stats{grid-template-columns:repeat(2,1fr)}.v74Photos{grid-template-columns:repeat(auto-fill,minmax(105px,105px))}.v74Photo{width:105px;height:105px}.v74Cover h1{font-size:28px}}
      </style></head><body><main class="v74Doc"><div class="v74Cover"><span class="v74Badge">Átadásra kész dokumentáció</span><h1>${v74Esc(title)}</h1><p class="v74Muted">Generálva: ${new Date().toLocaleString('hu-HU')} • ÉpítésNapló AI PRO</p><div class="v74Stats"><div class="v74Stat"><b>${entries.length}</b>bejegyzés</div><div class="v74Stat"><b>${imageCount}</b>fotó</div><div class="v74Stat"><b>${videoCount}</b>videó</div><div class="v74Stat"><b>0</b>magas kockázat</div><div class="v74Stat"><b>${invoiceSum.toLocaleString('hu-HU')} Ft</b>számlák</div></div></div>
      <section class="v74Section"><h2>Rövid összegzés</h2><p>A dokumentum az ügyfélnek átadható, rendezett építési napló: napi munka, fotódokumentáció, anyagok, időjárás/GPS és nyitott ellenőrzések egy helyen.</p></section>
      <section class="v74Section"><h2>Anyagösszesítő</h2><ul>${materialHtml}</ul></section>
      <section class="v74Section"><h2>Számlák</h2>${invoiceHtml}</section>
      <section class="v74Ai"><h2>Vezetői AI összefoglaló</h2><p>Állapot: rendezett dokumentáció. Bejegyzések: ${entries.length}, fotók: ${imageCount}, videók: ${videoCount}. A napi bejegyzések és fotók alapján az ügyfél számára átadható dokumentáció készült.</p><h3>Következő lépések</h3><ul><li>Tartsd meg a fotó + rövid szöveg ritmust minden munkanapon.</li><li>Átadás előtt ellenőrizd a fotók és anyagok teljességét.</li><li>Ügyfélnek küldés előtt nyisd meg a riportot ellenőrzésre.</li></ul></section>
      <h2>Napi bejegyzések</h2>${entriesHtml}</main><script>window.v74OpenReportPhoto=function(src){var d=document.createElement('div');d.className='v74Lightbox';d.innerHTML='<button type="button">Bezárás ✕</button><img src="'+src.replace(/"/g,'&quot;')+'">';d.onclick=function(e){if(e.target===d||e.target.tagName==='BUTTON')d.remove()};document.addEventListener('keydown',function esc(ev){if(ev.key==='Escape'){d.remove();document.removeEventListener('keydown',esc)}});document.body.appendChild(d)};<\/script></body></html>`;
  }
  window.v74BuildReportHtml = v74ReportHtml;
  window.buildProReportHtml = v74ReportHtml;
  try { buildProReportHtml = v74ReportHtml; } catch(_) {}

  async function v74GetCloseData(){
    const projectId = detailState?.project?.id;
    try { if(window.EpitesNaploAPI?.getProjectCloseData) return await window.EpitesNaploAPI.getProjectCloseData(projectId); } catch(e){ console.warn(e); }
    return { entries: detailState?.entries || [], materials:[], invoices:[] };
  }
  async function v74MakeCurrentReport(titleSuffix='jóváhagyott riport'){
    const data = await v74GetCloseData();
    const entries = data?.entries || detailState?.entries || [];
    const title = `${v74ProjectTitle()} – ${titleSuffix}`;
    return { html:v74ReportHtml(entries,title,data||{}), title, entries, data };
  }
  async function v74PersistDocument(payload){
    const projectId = detailState?.project?.id;
    const key = `v74_report_docs_${projectId || 'local'}`;
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    const localDoc = { id:'local-'+Date.now(), created_at:new Date().toISOString(), ...payload };
    try{
      if(window.EpitesNaploAPI?.saveReportDocument && projectId){
        const saved = await window.EpitesNaploAPI.saveReportDocument({ projectId, ...payload });
        return saved;
      }
    }catch(err){ console.warn('Supabase riportmentés hiba, helyi mentés lesz:', err); }
    local.unshift(localDoc); localStorage.setItem(key, JSON.stringify(local.slice(0,30)));
    return localDoc;
  }
  async function v74ListDocuments(){
    const projectId = detailState?.project?.id;
    let rows=[];
    try{ if(window.EpitesNaploAPI?.listReportDocuments && projectId) rows = await window.EpitesNaploAPI.listReportDocuments(projectId); }catch(err){ console.warn(err); }
    const key = `v74_report_docs_${projectId || 'local'}`;
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    return [...(rows||[]), ...local];
  }
  async function v74DeleteDocument(id){
    if(!confirm('Biztosan törlöd ezt a mentett riport példányt? A projekt nem törlődik.')) return;
    try{
      if(!String(id).startsWith('local-') && window.EpitesNaploAPI?.deleteReportDocument){
        await window.EpitesNaploAPI.deleteReportDocument(id);
      } else {
        const projectId = detailState?.project?.id;
        const key = `v74_report_docs_${projectId || 'local'}`;
        const local = JSON.parse(localStorage.getItem(key) || '[]').filter(x => String(x.id) !== String(id));
        localStorage.setItem(key, JSON.stringify(local));
      }
      if(typeof showToast === 'function') showToast('✔ Mentett riport példány törölve.', 'ok');
      v74RenderDocumentBox();
    }catch(err){ alert('Törlési hiba: '+(err.message||err)); }
  }
  window.v74DeleteReportDocument = v74DeleteDocument;
  async function v74RenderDocumentBox(){
    const host = document.getElementById('v74DocumentsBox') || document.getElementById('v71ApprovalsBox');
    if(!host) return;
    let box = document.getElementById('v74SavedReportsBox');
    if(!box){ box = document.createElement('div'); box.id='v74SavedReportsBox'; box.className='notice v74SavedReportsBox'; host.insertAdjacentElement('afterend', box); }
    const docs = await v74ListDocuments();
    if(!docs.length){ box.innerHTML = '<b>Mentett riport példányok</b><p class="muted">Még nincs külön mentett saját példány.</p>'; return; }
    box.innerHTML = `<b>Mentett riport példányok</b>${docs.slice(0,8).map(d=>`<div class="v71ApprovalRow"><div><span class="tag info">${v74Esc(d.document_type || d.type || 'riport')}</span><br><small>${v74Esc(formatDate ? formatDate(d.created_at || '') : d.created_at || '')}</small><p>${v74Esc(d.title || 'Építési napló riport')}</p></div><div class="v71ApprovalActions"><button class="btn small primary" type="button" onclick="v74DownloadSavedReport('${d.id}')">HTML letöltés</button><button class="btn small ghost" type="button" onclick="v74PrintSavedReport('${d.id}')">PDF / nyomtatás</button><button class="btn small danger" type="button" onclick="v74DeleteReportDocument('${d.id}')">Törlés</button></div></div>`).join('')}`;
  }
  window.v74DownloadSavedReport = async function(id){
    const docs = await v74ListDocuments();
    const d = docs.find(x => String(x.id) === String(id));
    if(!d) return alert('Nem találom a mentett riportot.');
    v74Download(`${v74Safe(d.title || v74ProjectTitle())}.html`, d.html_content || d.html || '');
  };
  window.v74PrintSavedReport = async function(id){
    const docs = await v74ListDocuments();
    const d = docs.find(x => String(x.id) === String(id));
    if(!d) return alert('Nem találom a mentett riportot.');
    v74OpenPrint(d.html_content || d.html || '');
  };
  function v74OpenPrint(html){
    const w = window.open('', '_blank');
    if(!w) return alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakot.');
    w.document.open(); w.document.write(html); w.document.close();
    const wait = () => {
      const imgs = [...w.document.images];
      if(!imgs.length) return Promise.resolve();
      return Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; setTimeout(res, 2500); })));
    };
    setTimeout(()=>wait().then(()=>{ try{ w.focus(); w.print(); }catch(_){} }), 600);
  }
  async function v74GetApprovalRow(id){
    try{ if(window.EpitesNaploAPI?.getApprovedReportHtml) { const r = await window.EpitesNaploAPI.getApprovedReportHtml(id); if(r) return r; } }catch(_){}
    try{ const rows = await window.EpitesNaploAPI?.getReportApprovals?.(detailState?.project?.id); return (rows||[]).find(r => String(r.id) === String(id)); }catch(_){ return null; }
  }
  async function v74ApprovalHtml(id){
    const row = await v74GetApprovalRow(id);
    let html = row?.approved_report_html || row?.report_html_snapshot || row?.report_html || '';
    if(!html){ const made = await v74MakeCurrentReport('jóváhagyott riport'); html = made.html; }
    if(!/<!doctype|<html/i.test(html)) html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Jóváhagyott riport</title></head><body>${html}</body></html>`;
    return { html, row };
  }
  window.v71DownloadApprovedHtml = async function(approvalId){
    try{
      const {html,row} = await v74ApprovalHtml(approvalId);
      await v74PersistDocument({ approvalId, title:`${v74ProjectTitle()} – jóváhagyott riport`, type:'approved_report', html, text:(document.body.innerText || '').slice(0,20000), meta:{source:'approval', decision:row?.decision||''} });
      v74Download(`${v74Safe(v74ProjectTitle())}-jovahagyott-riport.html`, html);
      v74RenderDocumentBox();
    }catch(err){ alert('HTML letöltési hiba: '+(err.message||err)); }
  };
  window.v71PrintApprovedReport = async function(approvalId){
    try{
      const {html,row} = await v74ApprovalHtml(approvalId);
      await v74PersistDocument({ approvalId, title:`${v74ProjectTitle()} – jóváhagyott PDF`, type:'approved_pdf_print', html, text:(document.body.innerText || '').slice(0,20000), meta:{source:'approval', decision:row?.decision||''} });
      v74OpenPrint(html);
      v74RenderDocumentBox();
    }catch(err){ alert('PDF/nyomtatás hiba: '+(err.message||err)); }
  };
  const oldPrintWeekly = window.printWeeklyReport || (typeof printWeeklyReport === 'function' ? printWeeklyReport : null);
  window.printWeeklyReport = async function(){
    const now = new Date(), weekAgo = new Date(); weekAgo.setDate(now.getDate()-7);
    const data = await v74GetCloseData();
    const entries = (data.entries || detailState.entries || []).filter(e => new Date(e.created_at) >= weekAgo);
    const html = v74ReportHtml(entries, `${v74ProjectTitle()} – heti PRO építési napló`, data);
    await v74PersistDocument({ title:`${v74ProjectTitle()} – heti riport`, type:'weekly_report', html, text:'Heti riport', meta:{range:'last_7_days'} });
    v74OpenPrint(html); v74RenderDocumentBox();
  };
  window.printClosingDocument = async function(){
    const data = await v74GetCloseData();
    const html = v74ReportHtml(data.entries || detailState.entries || [], `${v74ProjectTitle()} – lezáró PRO építési napló`, data);
    await v74PersistDocument({ title:`${v74ProjectTitle()} – lezáró riport`, type:'closing_report', html, text:'Lezáró riport', meta:{all:true} });
    v74OpenPrint(html); v74RenderDocumentBox();
  };
  window.downloadWeeklyReportHtml = async function(){
    const now = new Date(), weekAgo = new Date(); weekAgo.setDate(now.getDate()-7);
    const data = await v74GetCloseData();
    const entries = (data.entries || detailState.entries || []).filter(e => new Date(e.created_at) >= weekAgo);
    const html = v74ReportHtml(entries, `${v74ProjectTitle()} – heti építési napló`, data);
    await v74PersistDocument({ title:`${v74ProjectTitle()} – heti HTML`, type:'weekly_html', html, text:'Heti HTML', meta:{range:'last_7_days'} });
    v74Download(`${v74Safe(v74ProjectTitle())}-heti-riport.html`, html); v74RenderDocumentBox();
  };
  window.downloadClosingReportHtml = async function(){
    const data = await v74GetCloseData();
    const html = v74ReportHtml(data.entries || detailState.entries || [], `${v74ProjectTitle()} – lezáró dokumentum`, data);
    await v74PersistDocument({ title:`${v74ProjectTitle()} – lezáró HTML`, type:'closing_html', html, text:'Lezáró HTML', meta:{all:true} });
    v74Download(`${v74Safe(v74ProjectTitle())}-lezaro-riport.html`, html); v74RenderDocumentBox();
  };
  document.addEventListener('click', function(e){
    const btn = e.target.closest('[data-v71-download],[data-v71-print]');
    if(!btn) return;
    e.preventDefault(); e.stopPropagation();
    const id = btn.getAttribute('data-v71-download') || btn.getAttribute('data-v71-print');
    if(btn.hasAttribute('data-v71-download')) window.v71DownloadApprovedHtml(id); else window.v71PrintApprovedReport(id);
  }, true);
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(v74RenderDocumentBox, 1200));
  setTimeout(v74RenderDocumentBox, 1800);
})();

// ===== V75: javított riport gombok, törölhető mentett példányok, PDF képfix, GPS cím =====
(function(){
  const esc = (t)=> String(t ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const safe = (t)=> String(t || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  const projectId = ()=> window.detailState?.project?.id || new URLSearchParams(location.search).get('id') || 'local';
  const projectTitle = ()=> window.detailState?.project?.name || 'Építési napló';
  function dl(name, html){ const b=new Blob([html||''],{type:'text/html;charset=utf-8'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(u);a.remove();},1000); }
  function imagesOf(e){
    let arr=[];
    try{ if(typeof getEntryImages==='function') arr=getEntryImages(e)||[]; }catch(_){ }
    arr=[...arr, ...(Array.isArray(e?.images)?e.images:[]), ...(Array.isArray(e?.image_urls)?e.image_urls:[]), ...(Array.isArray(e?.beforeImages)?e.beforeImages:[]), ...(Array.isArray(e?.afterImages)?e.afterImages:[]), ...(Array.isArray(e?.generalImages)?e.generalImages:[]), ...(e?.image_url?[e.image_url]:[]), ...(e?.image?[e.image]:[])];
    return [...new Set(arr.filter(Boolean))];
  }
  function videosOf(e){ try{ if(typeof getEntryVideos==='function') return getEntryVideos(e)||[]; }catch(_){} return []; }
  function materialsFrom(entries, extra=[]){
    const map={};
    [...(extra||[])].forEach(m=>{ const k=`${m.name||'Anyag'}|${m.unit||'db'}`; map[k]=(map[k]||0)+Number(m.quantity||0); });
    (entries||[]).forEach(e=>(Array.isArray(e.materials_json)?e.materials_json:[]).forEach(m=>{ const k=`${m.name||'Anyag'}|${m.unit||'db'}`; map[k]=(map[k]||0)+Number(m.quantity||0); }));
    return Object.entries(map).map(([k,q])=>{ const [name,unit]=k.split('|'); return {name,unit,quantity:Number(Number(q).toFixed(2))}; });
  }
  async function closeData(){
    try{ if(window.EpitesNaploAPI?.getProjectCloseData) return await window.EpitesNaploAPI.getProjectCloseData(projectId()); }catch(e){ console.warn(e); }
    return {entries:window.detailState?.entries||[], materials:[], invoices:[]};
  }
  function reportHtml(entries, title, data={}){
    entries=Array.isArray(entries)?entries:[];
    const mats=materialsFrom(entries,data.materials||[]);
    const invoices=Array.isArray(data.invoices)?data.invoices:[];
    const imageCount=entries.reduce((s,e)=>s+imagesOf(e).length,0);
    const videoCount=entries.reduce((s,e)=>s+videosOf(e).length,0);
    const invoiceSum=invoices.reduce((s,i)=>s+Number(i.amount||0),0);
    const matsHtml=mats.length?mats.map(m=>`<li><b>${esc(m.name)}</b>: ${esc(m.quantity)} ${esc(m.unit)}</li>`).join(''):'<li>Nincs rögzített anyag.</li>';
    const invoicesHtml=invoices.length?`<table><thead><tr><th>Megnevezés</th><th>Összeg</th><th>Megjegyzés</th></tr></thead><tbody>${invoices.map(i=>`<tr><td>${esc(i.title||'Számla')}</td><td>${Number(i.amount||0).toLocaleString('hu-HU')} Ft</td><td>${esc(i.note||'')}</td></tr>`).join('')}</tbody></table>`:'<p>Nincs csatolt számla.</p>';
    const entriesHtml=entries.map(e=>{
      const imgs=imagesOf(e); const vids=videosOf(e); const note=String(e.note||'').replace(/\n/g,'<br>');
      const w=e.weather_json?`${esc(e.weather_json.temperature)} °C, ${esc(e.weather_json.text||'')}, szél: ${esc(e.weather_json.wind||0)} km/h, csapadék: ${esc(e.weather_json.rain||0)} mm`:esc(e.weather||'nincs adat');
      const gps=e.gps_json?.address || e.gps_json?.text || (e.gps_json?.lat?`${e.gps_json.lat}, ${e.gps_json.lon}`:'');
      const gpsLine=gps?`<p><b>GPS/hely:</b> ${esc(gps)}</p>`:'';
      const m=Array.isArray(e.materials_json)?e.materials_json:[];
      return `<section class="entry"><h2>${esc(typeof formatDate==='function'?formatDate(e.created_at):e.created_at||'')} – ${esc(e.phase||'Napi bejegyzés')}</h2><div class="note">${esc(note).replace(/&lt;br&gt;/g,'<br>')}</div><p><b>Dokumentáció:</b> ${imgs.length} fotó, ${vids.length} videó.</p><p><b>Időjárás:</b> ${w}</p>${gpsLine}${m.length?`<p><b>Napi anyag:</b> ${m.map(x=>`${esc(x.name)} ${esc(x.quantity)} ${esc(x.unit)}`).join(', ')}</p>`:''}${e.ai_json?.photoTextCheck?`<p class="ai"><b>AI szakmai kontroll:</b> ${esc(e.ai_json.photoTextCheck)}</p>`:''}${imgs.length?`<h3>Munka közben / fotódokumentáció</h3><div class="photos">${imgs.map((src,i)=>`<a class="photo" href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="Napló fotó ${i+1}" loading="eager"></a>`).join('')}</div>`:'<p>Ehhez a bejegyzéshez nincs csatolt fotó.</p>'}</section>`;
    }).join('') || '<p>Nincs bejegyzés.</p>';
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
      *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:24px;line-height:1.45}.doc{max-width:1080px;margin:0 auto}.badge{display:inline-block;background:#fff2bf;color:#8a5a00;border-radius:999px;padding:7px 13px;font-weight:700}.cover{border-bottom:4px solid #f5a400;padding:0 0 16px;margin:0 0 20px}h1{font-size:34px;line-height:1.08;margin:22px 0 8px}h2{font-size:24px}.muted{color:#4b5563}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:22px 0}.stat{background:#f3f4f6;border-radius:12px;padding:14px}.stat b{display:block;color:#d97706;font-size:24px}.section,.invoice,.aiBox,.entry{break-inside:avoid;page-break-inside:avoid}.aiBox{border-left:5px solid #22c55e;background:#ecfdf5;padding:18px 22px;margin:24px 0}.entry{border-left:4px solid #f5a400;background:#fafafa;margin:22px 0;padding:18px 22px}.note{margin:12px 0}.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,132px));gap:14px;margin-top:12px}.photo{display:block;width:132px;height:132px;border:1px solid #d1d5db;border-radius:12px;padding:5px;background:#fff;overflow:hidden}.photo img{display:block;width:100%;height:100%;object-fit:cover;border-radius:8px}.ai{background:#e6fffb;border-radius:10px;padding:10px}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #e5e7eb;text-align:left}@media print{@page{size:A4;margin:12mm}body{padding:0}.doc{max-width:none}.cover{margin-top:0}.stats{grid-template-columns:repeat(5,1fr);gap:5mm}.stat{padding:4mm}.section,.invoice,.aiBox,.entry{break-inside:avoid;page-break-inside:avoid}.photos{grid-template-columns:repeat(4,32mm)!important;gap:5mm!important}.photo{width:32mm!important;height:32mm!important;padding:1mm!important}.photo img{width:100%!important;height:100%!important;object-fit:cover!important}h1,h2,h3{break-after:avoid;page-break-after:avoid}table,tr,td,th{break-inside:avoid;page-break-inside:avoid}}@media(max-width:720px){body{padding:16px}.stats{grid-template-columns:repeat(2,1fr)}h1{font-size:28px}.photos{grid-template-columns:repeat(auto-fill,minmax(105px,105px))}.photo{width:105px;height:105px}}
    </style></head><body><main class="doc"><div class="cover"><span class="badge">Átadásra kész dokumentáció</span><h1>${esc(title)}</h1><p class="muted">Generálva: ${new Date().toLocaleString('hu-HU')} • ÉpítésNapló AI PRO</p><div class="stats"><div class="stat"><b>${entries.length}</b>bejegyzés</div><div class="stat"><b>${imageCount}</b>fotó</div><div class="stat"><b>${videoCount}</b>videó</div><div class="stat"><b>0</b>magas kockázat</div><div class="stat"><b>${invoiceSum.toLocaleString('hu-HU')} Ft</b>számlák</div></div></div><section class="section"><h2>Rövid összegzés</h2><p>A dokumentum az ügyfélnek átadható, rendezett építési napló: napi munka, fotódokumentáció, anyagok, időjárás/GPS és nyitott ellenőrzések egy helyen.</p></section><section class="section"><h2>Anyagösszesítő</h2><ul>${matsHtml}</ul></section><section class="invoice"><h2>Számlák</h2>${invoicesHtml}</section><section class="aiBox"><h2>Vezetői AI összefoglaló</h2><p>Állapot: rendezett dokumentáció. Bejegyzések: ${entries.length}, fotók: ${imageCount}, videók: ${videoCount}. A napi bejegyzések és fotók alapján az ügyfél számára átadható dokumentáció készült.</p><h3>Következő lépések</h3><ul><li>Átadás előtt ellenőrizd a fotók és anyagok teljességét.</li><li>Ügyfélnek küldés előtt nyisd meg a riportot ellenőrzésre.</li></ul></section><h2>Napi bejegyzések</h2>${entriesHtml}</main></body></html>`;
  }
  async function makeReport(suffix, weekly=false){
    const data=await closeData(); let entries=data.entries||window.detailState?.entries||[];
    if(weekly){ const d=new Date(); d.setDate(d.getDate()-7); entries=entries.filter(e=>new Date(e.created_at)>=d); }
    return {html:reportHtml(entries,`${projectTitle()} – ${suffix}`,data), title:`${projectTitle()} – ${suffix}`};
  }
  async function persist(doc){
    const key=`v75_report_docs_${projectId()}`; const local=JSON.parse(localStorage.getItem(key)||'[]');
    const row={id:'local-'+Date.now(),created_at:new Date().toISOString(),...doc};
    try{ if(window.EpitesNaploAPI?.saveReportDocument && projectId()){ const saved=await window.EpitesNaploAPI.saveReportDocument({projectId:projectId(),...doc}); return saved; } }catch(e){ console.warn('Supabase riport mentés hiba, helyi mentés:',e); }
    local.unshift(row); localStorage.setItem(key,JSON.stringify(local.slice(0,50))); return row;
  }
  async function listDocs(){
    let rows=[]; try{ if(window.EpitesNaploAPI?.listReportDocuments && projectId()) rows=await window.EpitesNaploAPI.listReportDocuments(projectId()); }catch(e){ console.warn(e); }
    const local=JSON.parse(localStorage.getItem(`v75_report_docs_${projectId()}`)||'[]');
    const old=JSON.parse(localStorage.getItem(`v74_report_docs_${projectId()}`)||'[]');
    return [...(rows||[]),...local,...old];
  }
  async function findDoc(id){ return (await listDocs()).find(d=>String(d.id)===String(id)); }
  window.v75DownloadSavedReport=async function(id){ const d=await findDoc(id); if(!d) return alert('Nem találom a mentett riportot.'); dl(`${safe(d.title||projectTitle())}.html`,d.html_content||d.html||''); };
  window.v75PrintSavedReport=async function(id){ const d=await findDoc(id); if(!d) return alert('Nem találom a mentett riportot.'); openPrint(d.html_content||d.html||''); };
  window.v75DeleteSavedReport=async function(id){ if(!confirm('Biztosan törlöd ezt a mentett riport példányt? A projekt nem törlődik.')) return; try{ if(!String(id).startsWith('local-') && window.EpitesNaploAPI?.deleteReportDocument){ await window.EpitesNaploAPI.deleteReportDocument(id); } ['v75_report_docs_','v74_report_docs_'].forEach(pref=>{ const key=pref+projectId(); const arr=JSON.parse(localStorage.getItem(key)||'[]').filter(x=>String(x.id)!==String(id)); localStorage.setItem(key,JSON.stringify(arr)); }); if(typeof showToast==='function') showToast('✔ Mentett riport törölve.','ok'); renderBox(); }catch(e){ alert('Törlési hiba: '+(e.message||e)); } };
  function openPrint(html){ const w=window.open('','_blank'); if(!w) return alert('A böngésző blokkolta az új ablakot. Engedélyezd a felugró ablakokat.'); w.document.open(); w.document.write(html); w.document.close(); const wait=()=>Promise.all([...w.document.images].map(img=>img.complete?Promise.resolve():new Promise(res=>{img.onload=img.onerror=res;setTimeout(res,3500)}))); setTimeout(()=>wait().then(()=>{try{w.focus();w.print()}catch(_){}}),700); }
  async function approvalHtml(id){
    let row=null; try{ if(window.EpitesNaploAPI?.getApprovedReportHtml) row=await window.EpitesNaploAPI.getApprovedReportHtml(id); }catch(_){ }
    if(!row){ try{ const rows=await window.EpitesNaploAPI?.getReportApprovals?.(projectId()); row=(rows||[]).find(r=>String(r.id)===String(id)); }catch(_){} }
    let html=row?.approved_report_html||row?.report_html_snapshot||row?.report_html||'';
    if(!html){ const r=await makeReport('jóváhagyott riport',false); html=r.html; }
    if(!/<!doctype|<html/i.test(html)) html=`<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Jóváhagyott riport</title></head><body>${html}</body></html>`;
    return {html,row};
  }
  window.v71DownloadApprovedHtml=async function(id){ try{ const {html,row}=await approvalHtml(id); await persist({approvalId:id,title:`${projectTitle()} – jóváhagyott riport`,type:'approved_report',html,text:'Jóváhagyott riport',meta:{decision:row?.decision||''}}); dl(`${safe(projectTitle())}-jovahagyott-riport.html`,html); renderBox(); }catch(e){ alert('HTML letöltési hiba: '+(e.message||e)); } };
  window.v71PrintApprovedReport=async function(id){ try{ const {html,row}=await approvalHtml(id); await persist({approvalId:id,title:`${projectTitle()} – jóváhagyott PDF`,type:'approved_pdf_print',html,text:'Jóváhagyott PDF',meta:{decision:row?.decision||''}}); openPrint(html); renderBox(); }catch(e){ alert('PDF/nyomtatási hiba: '+(e.message||e)); } };
  window.printWeeklyReport=async function(){ const r=await makeReport('heti PRO építési napló',true); await persist({title:r.title,type:'weekly_report',html:r.html,text:'Heti riport',meta:{range:'last_7_days'}}); openPrint(r.html); renderBox(); };
  window.printClosingDocument=async function(){ const r=await makeReport('lezáró PRO építési napló',false); await persist({title:r.title,type:'closing_report',html:r.html,text:'Lezáró riport',meta:{all:true}}); openPrint(r.html); renderBox(); };
  window.downloadWeeklyReportHtml=async function(){ const r=await makeReport('heti építési napló',true); await persist({title:r.title,type:'weekly_html',html:r.html,text:'Heti HTML',meta:{range:'last_7_days'}}); dl(`${safe(projectTitle())}-heti-riport.html`,r.html); renderBox(); };
  window.downloadClosingReportHtml=async function(){ const r=await makeReport('lezáró dokumentum',false); await persist({title:r.title,type:'closing_html',html:r.html,text:'Lezáró HTML',meta:{all:true}}); dl(`${safe(projectTitle())}-lezaro-riport.html`,r.html); renderBox(); };
  async function renderBox(){
    const host=document.getElementById('v74DocumentsBox')||document.getElementById('v71ApprovalsBox'); if(!host) return;
    let box=document.getElementById('v75SavedReportsBox'); if(!box){ box=document.createElement('div'); box.id='v75SavedReportsBox'; box.className='notice v74SavedReportsBox'; host.insertAdjacentElement('afterend',box); }
    const docs=await listDocs();
    if(!docs.length){ box.innerHTML='<b>Mentett riport példányok</b><p class="muted">Még nincs külön mentett saját példány.</p>'; return; }
    box.innerHTML='<b>Mentett riport példányok</b>'+docs.slice(0,10).map(d=>`<div class="v71ApprovalRow"><div><span class="tag info">${esc(d.document_type||d.type||'riport')}</span><br><small>${esc(typeof formatDate==='function'?formatDate(d.created_at||''):d.created_at||'')}</small><p>${esc(d.title||'Építési napló riport')}</p></div><div class="v71ApprovalActions"><button class="btn small primary" type="button" data-v75-open="${esc(d.id)}">HTML megnyitás/letöltés</button><button class="btn small ghost" type="button" data-v75-pdf="${esc(d.id)}">PDF / nyomtatás</button><button class="btn small danger" type="button" data-v75-del="${esc(d.id)}">Törlés</button></div></div>`).join('');
  }
  window.v75RenderDocumentBox=renderBox;
  document.addEventListener('click',function(e){ const b=e.target.closest('[data-v75-open],[data-v75-pdf],[data-v75-del],[data-v71-download],[data-v71-print]'); if(!b) return; e.preventDefault(); e.stopPropagation(); if(b.dataset.v75Open) return window.v75DownloadSavedReport(b.dataset.v75Open); if(b.dataset.v75Pdf) return window.v75PrintSavedReport(b.dataset.v75Pdf); if(b.dataset.v75Del) return window.v75DeleteSavedReport(b.dataset.v75Del); const id=b.getAttribute('data-v71-download')||b.getAttribute('data-v71-print'); if(b.hasAttribute('data-v71-download')) return window.v71DownloadApprovedHtml(id); return window.v71PrintApprovedReport(id); },true);

  async function reverseAddress(lat,lon){
    try{ const res=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`,{headers:{'Accept':'application/json'}}); if(!res.ok) return ''; const j=await res.json(); return j.display_name||''; }catch(_){ return ''; }
  }
  const oldCapture=window.captureGpsOnly;
  window.captureGpsOnly=async function(){
    let gps=null; try{ gps=await (oldCapture?oldCapture():null); }catch(e){ console.warn(e); }
    if(gps?.lat&&gps?.lon){ const addr=await reverseAddress(gps.lat,gps.lon); if(addr){ gps.address=addr; gps.text=`${addr} (${Number(gps.lat).toFixed(5)}, ${Number(gps.lon).toFixed(5)})`; try{ window.v19GpsJson=gps; }catch(_){} const inp=document.getElementById('detailGps'); if(inp) inp.value=gps.text; const w=document.getElementById('weatherAutoText'); if(w) w.value='GPS és cím rögzítve.'; if(typeof showToast==='function') showToast('✔ GPS koordináta és cím rögzítve.','ok'); } }
    return gps;
  };
  document.addEventListener('DOMContentLoaded',()=>setTimeout(renderBox,1500)); setTimeout(renderBox,2200);
})();

// ===== V76 FINAL: minden korábbi réteg után GPS cím + riport + mentés fix =====
(function(){
  if(window.__v76FinalAfterV75) return;
  window.__v76FinalAfterV75 = true;
  const byId = id => document.getElementById(id);
  const coordRe = /(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)/;
  const cache = new Map();
  function coordsFromText(text){
    const m = String(text || '').match(coordRe);
    if(!m) return null;
    const lat = Number(m[1].replace(',', '.'));
    const lon = Number(m[2].replace(',', '.'));
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }
  async function reverseAddress(lat, lon){
    const key = `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;
    if(cache.has(key)) return cache.get(key);
    try{
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1&accept-language=hu`, { headers:{ Accept:'application/json' } });
      const json = res.ok ? await res.json() : {};
      const address = json.display_name || '';
      cache.set(key, address);
      return address;
    }catch(e){
      console.warn('GPS cím lekérés hiba:', e);
      cache.set(key, '');
      return '';
    }
  }
  async function enrichGps(){
    const gpsInput = byId('detailGps');
    const addressInput = byId('detailWorkAddress');
    const weatherInfo = byId('weatherAutoText');
    const coords = coordsFromText(gpsInput?.value || '');
    if(!coords) return '';
    const address = await reverseAddress(coords.lat, coords.lon);
    if(!address) return '';
    if(addressInput && !addressInput.value.trim()) addressInput.value = address;
    if(gpsInput) gpsInput.value = `${address} (${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)})`;
    if(weatherInfo && !/cím/i.test(weatherInfo.value || '')) weatherInfo.value = weatherInfo.value ? `${weatherInfo.value} • Cím: ${address}` : `GPS cím: ${address}`;
    return address;
  }
  window.v76EnrichGpsAddress = enrichGps;

  const oldCapture = window.captureGpsOnly;
  if(oldCapture){
    window.captureGpsOnly = async function(){
      const result = await oldCapture.apply(this, arguments);
      await enrichGps();
      return result;
    };
  }
  const oldFill = window.fillWeatherAndGps || (typeof fillWeatherAndGps === 'function' ? fillWeatherAndGps : null);
  if(oldFill){
    const wrappedFill = async function(){
      const result = await oldFill.apply(this, arguments);
      await enrichGps();
      return result;
    };
    window.fillWeatherAndGps = wrappedFill;
    try { fillWeatherAndGps = wrappedFill; } catch(_){}
  }
  const oldEnsure = window.ensureWeatherAndGpsBeforeSave;
  if(oldEnsure){
    window.ensureWeatherAndGpsBeforeSave = async function(){
      const result = await oldEnsure.apply(this, arguments);
      await enrichGps();
      return result;
    };
  }
  const oldSaveDaily = window.saveDailyEntry;
  if(oldSaveDaily){
    window.saveDailyEntry = async function(){
      await enrichGps();
      const address = (byId('detailWorkAddress')?.value || '').trim();
      const note = byId('detailNote');
      if(note && address && !/Munka helyszíne\/cím:/i.test(note.value || '')){
        note.value = `${note.value || ''}${note.value ? '\n\n' : ''}Munka helyszíne/cím: ${address}`;
      }
      return oldSaveDaily.apply(this, arguments);
    };
  }
  function wrapApi(){
    const api = window.EpitesNaploAPI;
    if(!api || api.__v76FinalSaveWrapped || !api.saveEntry) return;
    const old = api.saveEntry.bind(api);
    api.__v76FinalSaveWrapped = true;
    api.saveEntry = async function(entry = {}){
      const address = (byId('detailWorkAddress')?.value || entry.locationAddress || entry.gpsJson?.address || '').trim();
      if(address){
        entry.locationAddress = address;
        entry.gpsJson = { ...(entry.gpsJson || {}), address, text: entry.gpsJson?.text || address };
      }
      return old(entry);
    };
  }
  wrapApi();
  document.addEventListener('DOMContentLoaded', () => setTimeout(wrapApi, 250));

  const oldBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(oldBuild && !oldBuild.__v76FinalReportWrapped){
    const css = `.v76ReportPolish .photos,.v76ReportPolish .v74Photos{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(112px,112px))!important;gap:10px!important}.v76ReportPolish .photo,.v76ReportPolish .v74Photo,.v76ReportPolish .v67ReportPhoto{width:112px!important;height:112px!important;max-width:112px!important}.v76ReportPolish .photo img,.v76ReportPolish .v74Photo img,.v76ReportPolish .v67ReportPhoto img{width:100%!important;height:100%!important;object-fit:cover!important}@media print{.v76ReportPolish .photos,.v76ReportPolish .v74Photos{grid-template-columns:repeat(4,28mm)!important;gap:4mm!important}.v76ReportPolish .photo,.v76ReportPolish .v74Photo,.v76ReportPolish .v67ReportPhoto{width:28mm!important;height:28mm!important;max-width:28mm!important}}`;
    const wrapped = function(entries, title, options){
      let html = oldBuild(entries, title, options);
      html = String(html || '');
      if(!html.includes('v76ReportPolish')){
        html = html.replace('<body', '<body class="v76ReportPolish"');
        html = html.includes('</style>') ? html.replace('</style>', `${css}</style>`) : html.replace('</head>', `<style>${css}</style></head>`);
      }
      return html;
    };
    wrapped.__v76FinalReportWrapped = true;
    window.buildProReportHtml = wrapped;
    try { buildProReportHtml = wrapped; } catch(_){}
  }
})();

// ===== V79 FINAL AFTER ALL: GitHub v78 javitasok tenylegesen utolso retegkent =====
(function(){
  if(window.__v79FinalAfterAllReally) return;
  window.__v79FinalAfterAllReally = true;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeName = value => String(value || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Epitesi naplo';
  const messageOf = row => row?.message || row?.client_message || row?.approval_message || row?.question || row?.note || row?.comment || '';
  const decisionOf = row => String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase();
  const labelOf = d => (d === 'accepted' || d === 'approved') ? 'Jovahagyva / Elfogadva' : d === 'question' ? 'Kerdese van' : 'Megtekintve';
  function downloadHtml(name, html){ const b=new Blob([html||''],{type:'text/html;charset=utf-8'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(u);a.remove();},1200); }
  function openPrint(html){ const w=window.open('','_blank'); if(!w) return alert('A bongeszo blokkolta az uj ablakot.'); w.document.open(); w.document.write(html); w.document.close(); setTimeout(()=>{try{w.focus();w.print()}catch(_){}},700); }
  function injectReportViewer(html){
    const css = `<style>.v79ApprovalStamp{border:2px solid #22c55e;background:#ecfdf5;color:#111827;padding:16px 18px;margin:0 0 20px;border-radius:10px;font-family:Arial,sans-serif}.v79ApprovalStamp h1{margin:0 0 10px;font-size:24px}.v79ReportLightbox{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.9);display:flex;align-items:center;justify-content:center;padding:24px}.v79ReportLightbox img{max-width:94vw;max-height:88vh;object-fit:contain;background:#111;border-radius:10px}.v79ReportLightbox button{position:fixed;top:14px;right:14px;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:800;padding:10px 14px;cursor:pointer}img{cursor:zoom-in}@media print{.v79ReportLightbox{display:none!important}img{cursor:default}.v79ApprovalStamp{break-inside:avoid;page-break-inside:avoid}}</style>`;
    const script = `<script>(function(){function imgs(){return Array.from(document.querySelectorAll('img')).filter(function(i){return i.src&&!i.closest('.v79ReportLightbox')})}function openAt(n){var list=imgs();if(!list.length)return;var i=Math.max(0,Math.min(n,list.length-1));var d=document.createElement('div');d.className='v79ReportLightbox';function r(){d.innerHTML='<button type="button">Bezaras</button><img src="'+list[i].src.replace(/"/g,'&quot;')+'">';d.querySelector('button').onclick=function(){d.remove()}}r();d.onclick=function(e){if(e.target===d)d.remove()};document.addEventListener('keydown',function key(e){if(!document.body.contains(d)){document.removeEventListener('keydown',key);return}if(e.key==='Escape')d.remove();if(e.key==='ArrowRight'){i=(i+1)%list.length;r()}if(e.key==='ArrowLeft'){i=(i-1+list.length)%list.length;r()}});document.body.appendChild(d)}document.addEventListener('click',function(e){var img=e.target.closest('img');if(!img||img.closest('.v79ReportLightbox'))return;e.preventDefault();openAt(imgs().indexOf(img))},true);})();<\/script>`;
    let out = String(html || '');
    if(!out.includes('.v79ReportLightbox')) out = out.includes('</head>') ? out.replace('</head>', `${css}</head>`) : out.replace('<body', `<head>${css}</head><body`);
    if(!out.includes('v79ReportLightbox')) out = out.includes('</body>') ? out.replace('</body>', `${script}</body>`) : `${out}${script}`;
    return out;
  }
  const baseBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(baseBuild){
    const galleryBuild = function(entries, title, options){ return injectReportViewer(baseBuild(entries, title, options)); };
    window.buildProReportHtml = galleryBuild;
    try { buildProReportHtml = galleryBuild; } catch(_) {}
  }
  async function rowForApproval(id){
    try { const row = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(row) return row; } catch(_) {}
    try { const rows = await window.EpitesNaploAPI?.getReportApprovals?.(projectId()); return (rows || []).find(r => String(r.id) === String(id)) || null; } catch(_) { return null; }
  }
  async function fallbackHtml(){
    try { const data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId()); const entries = data?.entries || state()?.entries || []; if(typeof window.buildProReportHtml === 'function') return window.buildProReportHtml(entries, `${projectTitle()} - ugyfel visszajelzes`, data || {}); } catch(_) {}
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Ugyfel visszajelzes</title></head><body><h1>Ugyfel visszajelzes</h1></body></html>`;
  }
  async function approvalHtml(id){
    const row = await rowForApproval(id);
    if(!row) throw new Error('Nem talalom az ugyfel visszajelzest. Frissitsd a projektoldalt, vagy ellenorizd a V71 SQL-t.');
    let html = row.approved_report_html || row.report_html_snapshot || row.report_html || '';
    if(!html || html.length < 120) html = await fallbackHtml();
    if(!/<!doctype|<html/i.test(html)) html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Ugyfel visszajelzes</title></head><body>${html}</body></html>`;
    const d = decisionOf(row);
    const msg = messageOf(row);
    const stamp = `<section class="v79ApprovalStamp"><h1>Ugyfel visszajelzes</h1><p><b>Allapot:</b> ${esc(labelOf(d))}</p><p><b>Datum:</b> ${esc(typeof formatDate === 'function' ? formatDate(row.approved_at || row.created_at || '') : (row.approved_at || row.created_at || ''))}</p>${row.client_name ? `<p><b>Ugyfel:</b> ${esc(row.client_name)}</p>` : ''}${row.client_email ? `<p><b>Email:</b> ${esc(row.client_email)}</p>` : ''}${msg ? `<p><b>Kerdes / megjegyzes:</b><br>${esc(msg).replace(/\n/g,'<br>')}</p>` : ''}</section>`;
    html = html.replace(/<body[^>]*>/i, match => `${match}${stamp}`);
    return { row, html: injectReportViewer(html) };
  }
  window.v71DownloadApprovedHtml = async function(id){ try { const r = await approvalHtml(id); downloadHtml(`${safeName(projectTitle())}-${safeName(labelOf(decisionOf(r.row)))}.html`, r.html); } catch(e) { alert(e.message || e); } };
  window.v71PrintApprovedReport = async function(id){ try { const r = await approvalHtml(id); openPrint(r.html); } catch(e) { alert(e.message || e); } };
  async function renderApprovals(){
    const host = document.getElementById('v71ApprovalsBox') || document.getElementById('v74DocumentsBox') || document.getElementById('projectSummaryBox') || document.querySelector('.projectSummaryCard');
    if(!host || !projectId()) return;
    document.getElementById('v71ApprovalsBox')?.style.setProperty('display','none','important');
    let box = document.getElementById('v79ApprovalsBox');
    if(!box){ box = document.createElement('div'); box.id = 'v79ApprovalsBox'; box.className = 'notice v79ApprovalsBox'; host.insertAdjacentElement('afterend', box); }
    let rows = [];
    try { rows = await window.EpitesNaploAPI?.getReportApprovals?.(projectId()) || []; } catch(e) { console.warn(e); }
    if(!rows.length){ box.innerHTML = '<b>Ugyfel jovahagyasok es kerdesek</b><p class="muted">Meg nincs ugyfel visszajelzes.</p>'; return; }
    box.innerHTML = '<b>Ugyfel jovahagyasok es kerdesek</b>' + rows.slice(0,10).map(row => { const d=decisionOf(row); const msg=messageOf(row); const cls=d==='question'?'warn':(d==='accepted'||d==='approved')?'ok':'info'; return `<div class="v79ApprovalRow"><div><span class="tag ${cls}">${esc(labelOf(d))}</span><br><small>${esc(typeof formatDate === 'function' ? formatDate(row.approved_at || row.created_at || '') : (row.approved_at || row.created_at || ''))}${row.client_name ? ' - '+esc(row.client_name) : ''}${row.client_email ? ' - '+esc(row.client_email) : ''}</small>${msg ? `<p class="v79ApprovalMessage">${esc(msg).replace(/\n/g,'<br>')}</p>` : ''}</div><div class="v79ApprovalActions"><button class="btn small primary" type="button" data-v79-approval-download="${esc(row.id)}">Sajat peldany HTML</button><button class="btn small ghost" type="button" data-v79-approval-print="${esc(row.id)}">PDF / nyomtatas</button></div></div>`; }).join('');
  }
  window.v79RenderApprovals = renderApprovals;
  document.addEventListener('click', function(e){ const b=e.target.closest('[data-v79-approval-download],[data-v79-approval-print],[data-v71-download],[data-v71-print]'); if(!b) return; e.preventDefault(); e.stopImmediatePropagation(); const id=b.getAttribute('data-v79-approval-download') || b.getAttribute('data-v79-approval-print') || b.getAttribute('data-v71-download') || b.getAttribute('data-v71-print'); if(b.hasAttribute('data-v79-approval-download') || b.hasAttribute('data-v71-download')) return window.v71DownloadApprovedHtml(id); return window.v71PrintApprovedReport(id); }, true);
  document.addEventListener('DOMContentLoaded', () => setTimeout(renderApprovals, 900));
  setTimeout(renderApprovals, 1600);
})();

// ===== V80 FINAL SAFE: jovahagyott peldany, kerdesek, PDF fotok =====
(function(){
  if(window.__v80FinalSafeFix) return;
  window.__v80FinalSafeFix = true;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeName = value => String(value || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Epitesi naplo';
  const rowMessage = row => row?.message || row?.client_message || row?.approval_message || row?.question || row?.question_text || row?.note || row?.comment || '';
  const rowDecision = row => String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase();
  const rowLabel = decision => (decision === 'accepted' || decision === 'approved') ? 'Elfogadva / jovahagyva' : decision === 'question' ? 'Kerdese van' : 'Megtekintve';
  const rowDate = row => (typeof formatDate === 'function' ? formatDate(row?.approved_at || row?.created_at || '') : String(row?.approved_at || row?.created_at || '').replace('T',' ').slice(0,19));

  function snapshotMissing(html){
    const text = String(html || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return !text.trim() ||
      text.includes('jovahagyott riport tartalma nem talalhato') ||
      text.includes('de a jovahagyas rekordja elerheto') ||
      text.includes('a riport adatai nem tolthetok be') ||
      text.includes('hianyzo riport azonosito');
  }
  function downloadHtml(name, html){
    const blob = new Blob([html || ''], { type:'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1200);
  }
  function improveReportHtml(html){
    let out = String(html || '');
    if(!/<!doctype|<html/i.test(out)) out = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Riport</title></head><body>${out}</body></html>`;
    try{
      const doc = new DOMParser().parseFromString(out, 'text/html');
      doc.querySelectorAll('.approvedStamp,.v79ApprovalStamp,.v80ApprovalStamp,.reportMediaPending,.v67PhotoHint').forEach(el => el.remove());
      doc.querySelectorAll('.reportMediaOpen').forEach(link => {
        const media = link.querySelector('img,video');
        if(media) link.replaceWith(media);
      });
      doc.querySelectorAll('.photos,.v74Photos,.v77Photos,.entryImageGrid,.reportImageGrid').forEach(block => block.classList.add('v80PhotoBlock'));
      doc.querySelectorAll('h2,h3,h4').forEach(heading => {
        const text = (heading.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        if((text.includes('foto') || text.includes('dokument')) && heading.nextElementSibling) heading.nextElementSibling.classList?.add('v80PhotoBlock');
      });
      out = '<!doctype html>\n' + doc.documentElement.outerHTML;
    } catch(_) {}
    const css = `<style>
      .v80PhotoBlock,.photos,.v74Photos,.v77Photos,.entryImageGrid,.reportImageGrid{break-inside:avoid!important;page-break-inside:avoid!important;margin-top:10px!important}
      .v80PhotoBlock img,.photos img,.v74Photos img,.v77Photos img,.entryImageGrid img,.reportImageGrid img{display:block!important;object-fit:cover!important}
      .reportMediaOpen,.reportMediaPending,.v67PhotoHint{display:none!important}
      @media print{.v80PhotoBlock,.photos,.v74Photos,.v77Photos,.entryImageGrid,.reportImageGrid{break-inside:avoid!important;page-break-inside:avoid!important}.v80ApprovalStamp{break-inside:avoid!important;page-break-inside:avoid!important}}
    </style>`;
    return out.includes('</head>') ? out.replace('</head>', `${css}</head>`) : `${css}${out}`;
  }
  function approvalStamp(row){
    const message = rowMessage(row);
    return `<section class="v80ApprovalStamp">
      <div><span class="v80ApprovalKicker">Ugyfel visszajelzes</span><h1>${esc(rowLabel(rowDecision(row)))}</h1></div>
      <div class="v80ApprovalGrid">
        <p><b>Datum:</b><br>${esc(rowDate(row))}</p>
        <p><b>Ugyfel / ceg:</b><br>${esc(row?.client_name || row?.customer_name || 'Nincs megadva')}</p>
        <p><b>Email:</b><br>${esc(row?.client_email || row?.customer_email || 'Nincs megadva')}</p>
      </div>
      ${message ? `<div class="v80ApprovalQuestion"><b>Kerdes / megjegyzes:</b><br>${esc(message).replace(/\n/g,'<br>')}</div>` : ''}
    </section>`;
  }
  function addApprovalStamp(html, row){
    let out = improveReportHtml(html);
    const css = `<style>
      body{background:#f8fafc;color:#111827}
      .v80ApprovalStamp{border:2px solid #22c55e;background:#ecfdf5;color:#111827;padding:20px 22px;margin:0 0 24px;border-radius:12px;font-family:Arial,Helvetica,sans-serif;line-height:1.45}
      .v80ApprovalKicker{display:inline-block;background:#bbf7d0;color:#14532d;border-radius:999px;padding:5px 10px;font-weight:800;font-size:13px;margin-bottom:8px}
      .v80ApprovalStamp h1{margin:4px 0 12px;font-size:30px;line-height:1.12}
      .v80ApprovalGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .v80ApprovalGrid p{margin:0;background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:10px}
      .v80ApprovalQuestion{margin-top:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:12px;font-size:16px}
      @media(max-width:720px){.v80ApprovalGrid{grid-template-columns:1fr}.v80ApprovalStamp h1{font-size:24px}}
    </style>`;
    out = out.includes('</head>') ? out.replace('</head>', `${css}</head>`) : `${css}${out}`;
    return out.replace(/<body[^>]*>/i, match => `${match}${approvalStamp(row)}`);
  }
  async function currentFullReport(){
    try{
      const data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId());
      const entries = data?.entries || state()?.entries || [];
      if(typeof window.buildProReportHtml === 'function') return window.buildProReportHtml(entries, `${projectTitle()} - jovahagyott riport`, data || {});
      if(typeof buildProReportHtml === 'function') return buildProReportHtml(entries, `${projectTitle()} - jovahagyott riport`, data || {});
    } catch(err){ console.warn('V80 riport fallback hiba:', err); }
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${esc(projectTitle())}</title></head><body><h1>${esc(projectTitle())}</h1><p>A riport adatai nem tolthetok be.</p></body></html>`;
  }
  async function findApprovalRow(id){
    try{ const row = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(row) return row; }catch(_){}
    try{ const rows = await window.EpitesNaploAPI?.getReportApprovals?.(projectId()); return (rows || []).find(row => String(row.id) === String(id)) || null; }catch(_){ return null; }
  }
  async function approvalHtml(id){
    const row = await findApprovalRow(id);
    if(!row) throw new Error('Nem talalom az ugyfel visszajelzest. Frissitsd a projektoldalt, vagy ellenorizd a jovahagyas adatbazis sort.');
    let html = row.approved_report_html || row.report_html_snapshot || row.report_html || '';
    if(snapshotMissing(html)) html = await currentFullReport();
    return { row, html:addApprovalStamp(html, row) };
  }
  function waitImages(root){
    return Promise.all([...root.querySelectorAll('img')].filter(img => img.src).map(img => img.complete && img.naturalWidth > 0 ? Promise.resolve() : new Promise(resolve => {
      img.onload = img.onerror = resolve;
      setTimeout(resolve, 3500);
    })));
  }
  async function exportPdf(html, filename){
    const stage = document.createElement('div');
    stage.className = 'v76PdfStage v80PdfStage';
    stage.innerHTML = improveReportHtml(html);
    document.body.appendChild(stage);
    try{
      await waitImages(stage);
      if(window.html2pdf){
        await html2pdf().set({
          margin:[10,8,10,8],
          filename,
          image:{type:'jpeg',quality:0.96},
          html2canvas:{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#ffffff',imageTimeout:9000,logging:false},
          jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
          pagebreak:{mode:['css','legacy'],avoid:['.v80PhotoBlock','.photos','.v74Photos','.v77Photos','figure','img']}
        }).from(stage).save();
      } else {
        const win = window.open('', '_blank');
        if(!win) return alert('A bongeszo blokkolta az uj ablakot. Engedelyezd a felugro ablakokat.');
        win.document.open();
        win.document.write(stage.innerHTML);
        win.document.close();
        setTimeout(() => { try{ win.focus(); win.print(); }catch(_){} }, 700);
      }
    } finally {
      setTimeout(() => stage.remove(), 700);
    }
  }
  const oldBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(oldBuild && !oldBuild.__v80FinalSafeWrapped){
    const wrappedBuild = function(entries, title, options){ return improveReportHtml(oldBuild(entries, title, options)); };
    wrappedBuild.__v80FinalSafeWrapped = true;
    window.buildProReportHtml = wrappedBuild;
    try{ buildProReportHtml = wrappedBuild; }catch(_){}
  }
  async function buildReport(titleSuffix, weekly){
    const data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId());
    let entries = data?.entries || state()?.entries || [];
    if(weekly){
      const from = new Date();
      from.setDate(from.getDate() - 7);
      entries = entries.filter(entry => new Date(entry.created_at || 0) >= from);
    }
    const title = `${projectTitle()} - ${titleSuffix}`;
    const builder = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
    return { title, html:builder ? builder(entries, title, data || {}) : '' };
  }
  window.v71DownloadApprovedHtml = async function(id){
    try{
      const result = await approvalHtml(id);
      downloadHtml(`${safeName(projectTitle())}-${safeName(rowLabel(rowDecision(result.row)))}.html`, result.html);
      try{ if(typeof showToast === 'function') showToast('Ugyfel visszajelzes teljes riporttal letoltve.', 'ok'); }catch(_){}
    }catch(err){ alert(err.message || err); }
  };
  window.v71PrintApprovedReport = async function(id){
    try{
      const result = await approvalHtml(id);
      const win = window.open('', '_blank');
      if(!win) return alert('A bongeszo blokkolta az uj ablakot. Engedelyezd a felugro ablakokat.');
      win.document.open();
      win.document.write(result.html);
      win.document.close();
      setTimeout(() => { try{ win.focus(); win.print(); }catch(_){} }, 700);
    }catch(err){ alert(err.message || err); }
  };
  window.exportClosingPdfV25 = async function(){
    const report = await buildReport('lezaro PRO epitesi naplo', false);
    await exportPdf(report.html, `${safeName(report.title)}.pdf`);
  };
  window.exportWeeklyPdfV25 = async function(){
    const report = await buildReport('heti PRO epitesi naplo', true);
    await exportPdf(report.html, `${safeName(report.title)}.pdf`);
  };
  window.printClosingDocument = window.exportClosingPdfV25;
  window.printWeeklyReport = window.exportWeeklyPdfV25;
  try{ exportClosingPdfV25 = window.exportClosingPdfV25; exportWeeklyPdfV25 = window.exportWeeklyPdfV25; printClosingDocument = window.exportClosingPdfV25; printWeeklyReport = window.exportWeeklyPdfV25; }catch(_){}

  async function renderApprovals(){
    const baseHost = document.getElementById('v79ApprovalsBox') || document.getElementById('v71ApprovalsBox') || document.getElementById('v74DocumentsBox') || document.getElementById('projectSummaryBox') || document.querySelector('.projectSummaryCard');
    if(!baseHost || !projectId()) return;
    let box = document.getElementById('v79ApprovalsBox');
    if(!box){
      box = document.createElement('div');
      box.id = 'v79ApprovalsBox';
      box.className = 'notice v79ApprovalsBox';
      baseHost.insertAdjacentElement('afterend', box);
    }
    let rows = [];
    try{ rows = await window.EpitesNaploAPI?.getReportApprovals?.(projectId()) || []; }catch(err){ console.warn(err); }
    if(!rows.length){
      box.innerHTML = '<b>Ugyfel jovahagyasok es kerdesek</b><p class="muted">Meg nincs ugyfel visszajelzes.</p>';
      return;
    }
    box.innerHTML = '<b>Ugyfel jovahagyasok es kerdesek</b>' + rows.slice(0,10).map(row => {
      const decision = rowDecision(row);
      const message = rowMessage(row);
      const cls = decision === 'question' ? 'warn' : (decision === 'accepted' || decision === 'approved') ? 'ok' : 'info';
      return `<div class="v80ApprovalRow"><div><span class="tag ${cls}">${esc(rowLabel(decision))}</span><br><small>${esc(rowDate(row))}${row.client_name ? ' - '+esc(row.client_name) : ''}${row.client_email ? ' - '+esc(row.client_email) : ''}</small>${message ? `<p class="v80ApprovalMessage">${esc(message).replace(/\n/g,'<br>')}</p>` : ''}</div><div class="v80ApprovalActions"><button class="btn small primary" type="button" data-v80-approval-download="${esc(row.id)}">Sajat peldany HTML</button><button class="btn small ghost" type="button" data-v80-approval-print="${esc(row.id)}">PDF / nyomtatas</button></div></div>`;
    }).join('');
  }
  document.addEventListener('click', function(event){
    const btn = event.target.closest('[data-v80-approval-download],[data-v80-approval-print],[data-v79-approval-download],[data-v79-approval-print],[data-v71-download],[data-v71-print]');
    if(!btn) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = btn.getAttribute('data-v80-approval-download') || btn.getAttribute('data-v80-approval-print') || btn.getAttribute('data-v79-approval-download') || btn.getAttribute('data-v79-approval-print') || btn.getAttribute('data-v71-download') || btn.getAttribute('data-v71-print');
    if(btn.hasAttribute('data-v80-approval-download') || btn.hasAttribute('data-v79-approval-download') || btn.hasAttribute('data-v71-download')) return window.v71DownloadApprovedHtml(id);
    return window.v71PrintApprovedReport(id);
  }, true);
  document.addEventListener('DOMContentLoaded', () => setTimeout(renderApprovals, 1200));
  setTimeout(renderApprovals, 1900);
})();

// ===== V86: V80 alap véglegesítés - olvasható kártyák, teljes jóváhagyott riport saját példány, tiszta törlés =====
(function(){
  if(window.__v86FinalProjectFix) return;
  window.__v86FinalProjectFix = true;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = v => String(v || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const pid = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const ptitle = () => state()?.project?.name || 'Építési napló';
  const decisionOf = row => String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase();
  const messageOf = row => row?.message || row?.client_message || row?.approval_message || row?.question || row?.question_text || row?.note || row?.comment || '';
  const labelOf = d => (d === 'accepted' || d === 'approved') ? 'Elfogadva / jóváhagyva' : d === 'question' ? 'Kérdése van' : 'Megtekintve';
  const rowDate = row => (typeof formatDate === 'function' ? formatDate(row?.approved_at || row?.created_at || '') : (row?.approved_at || row?.created_at || ''));
  const isBadSnapshot = html => !html || String(html).length < 500 || /tartalma nem található|snapshot nem|adatok nem tolthetok|nem található/i.test(String(html));
  function toast(msg,type){ try{ if(typeof showToast === 'function') showToast(msg,type||'ok'); }catch(_){} }
  function downloadHtml(name, html){ const blob = new Blob([html || ''], { type:'text/html;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1500); }
  function fullReportCss(){ return `<style>
    body{background:#f8fafc!important;color:#111827!important;font-family:Arial,Helvetica,sans-serif}.v86ApprovalStamp{border:2px solid #22c55e;background:#ecfdf5;color:#111827;padding:20px 22px;margin:0 0 24px;border-radius:14px;line-height:1.45}.v86ApprovalStamp h1{margin:4px 0 12px;font-size:28px}.v86Grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.v86Grid p{margin:0;background:#fff;border:1px solid #bbf7d0;border-radius:10px;padding:10px}.v86Question{margin-top:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:12px}.v86Lightbox{position:fixed;inset:0;background:rgba(2,6,23,.92);display:flex;align-items:center;justify-content:center;z-index:999999;padding:20px}.v86Lightbox img{max-width:94vw;max-height:88vh;object-fit:contain;border-radius:12px;background:#111}.v86Lightbox button{position:fixed;right:16px;top:16px;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:800;padding:10px 14px}@media(max-width:720px){.v86Grid{grid-template-columns:1fr}.v86ApprovalStamp h1{font-size:23px}}@media print{.v86Lightbox{display:none!important}.v86ApprovalStamp{break-inside:avoid;page-break-inside:avoid}}
  </style>`; }
  function injectLightbox(html){
    const script = `<script>(function(){function imgs(){return Array.from(document.querySelectorAll('img')).filter(function(i){return i.src&&!i.closest('.v86Lightbox')})}function openAt(n){var list=imgs();if(!list.length)return;var idx=Math.max(0,Math.min(n,list.length-1));var d=document.createElement('div');d.className='v86Lightbox';function r(){d.innerHTML='<button type="button">Bezárás</button><img src="'+list[idx].src.replace(/"/g,'&quot;')+'">';d.querySelector('button').onclick=function(){d.remove()}}r();d.onclick=function(e){if(e.target===d)d.remove()};document.addEventListener('keydown',function key(e){if(!document.body.contains(d)){document.removeEventListener('keydown',key);return}if(e.key==='Escape')d.remove();if(e.key==='ArrowRight'){idx=(idx+1)%list.length;r()}if(e.key==='ArrowLeft'){idx=(idx-1+list.length)%list.length;r()}});document.body.appendChild(d)}document.addEventListener('click',function(e){var img=e.target.closest('img');if(!img||img.closest('.v86Lightbox'))return;e.preventDefault();openAt(imgs().indexOf(img))},true);})();<\/script>`;
    return String(html || '').includes('v86Lightbox') ? html : String(html || '').replace('</body>', `${script}</body>`);
  }
  function stamp(html,row){
    let out = String(html || '');
    if(!/<!doctype|<html/i.test(out)) out = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${esc(ptitle())}</title></head><body>${out}</body></html>`;
    const d = decisionOf(row), msg = messageOf(row);
    const stampHtml = `<section class="v86ApprovalStamp"><h1>Jóváhagyott ügyfélpéldány</h1><div class="v86Grid"><p><b>Állapot:</b><br>${esc(labelOf(d))}</p><p><b>Dátum:</b><br>${esc(rowDate(row))}</p><p><b>Ügyfél:</b><br>${esc(row?.client_name || row?.client_email || 'Nincs megadva')}</p></div>${msg ? `<div class="v86Question"><b>Kérdés / megjegyzés:</b><br>${esc(msg).replace(/\n/g,'<br>')}</div>` : ''}</section>`;
    out = out.includes('</head>') ? out.replace('</head>', `${fullReportCss()}</head>`) : out.replace('<body', `<head>${fullReportCss()}</head><body`);
    out = out.replace(/<body[^>]*>/i, m => `${m}${stampHtml}`);
    return injectLightbox(out);
  }
  async function currentReport(){
    try{
      const data = await window.EpitesNaploAPI?.getProjectCloseData?.(pid());
      const entries = data?.entries || state()?.entries || [];
      const builder = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
      if(builder) return builder(entries, `${ptitle()} – jóváhagyott riport`, data || {});
    }catch(e){ console.warn('V86 aktuális riport építési hiba:', e); }
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${esc(ptitle())}</title></head><body><h1>${esc(ptitle())}</h1><p>A riport pillanatnyilag nem építhető újra.</p></body></html>`;
  }
  async function approvalRow(id){
    try{ const r = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(r) return r; }catch(_){}
    try{ const rows = await window.EpitesNaploAPI?.getReportApprovals?.(pid()); return (rows || []).find(r => String(r.id) === String(id)) || null; }catch(_){ return null; }
  }
  async function approvalFullHtml(id){
    const row = await approvalRow(id);
    if(!row) throw new Error('Nem találom az ügyfél jóváhagyást. Frissítsd az oldalt.');
    let html = row.approved_report_html || row.report_html_snapshot || row.report_html || '';
    if(isBadSnapshot(html)){
      try{ const doc = await window.EpitesNaploAPI?.getReportDocumentByApproval?.(id); if(doc?.html_content && !isBadSnapshot(doc.html_content)) html = doc.html_content; }catch(_){}
    }
    if(isBadSnapshot(html)) html = await currentReport();
    return { row, html:stamp(html,row) };
  }
  window.v71DownloadApprovedHtml = async function(id){
    try{
      const r = await approvalFullHtml(id);
      downloadHtml(`${safe(ptitle())}-${safe(labelOf(decisionOf(r.row)))}-teljes-jovahagyott-riport.html`, r.html);
      try{ await window.EpitesNaploAPI?.saveReportDocument?.({ projectId:pid(), approvalId:id, title:`${ptitle()} – teljes jóváhagyott saját példány`, type:'approved_full_copy', html:r.html, text:document.body.innerText || '', meta:{ decision:decisionOf(r.row), message:messageOf(r.row), v86:true } }); }catch(e){ console.warn(e); }
      toast('Teljes jóváhagyott saját példány letöltve és mentve.', 'ok');
    }catch(e){ alert(e.message || e); }
  };
  window.v71PrintApprovedReport = async function(id){
    try{ const r = await approvalFullHtml(id); const w = window.open('', '_blank'); if(!w) return alert('A böngésző blokkolta az új ablakot.'); w.document.open(); w.document.write(r.html); w.document.close(); setTimeout(()=>{try{w.focus();w.print()}catch(_){}},800); try{ await window.EpitesNaploAPI?.saveReportDocument?.({ projectId:pid(), approvalId:id, title:`${ptitle()} – teljes jóváhagyott PDF példány`, type:'approved_full_pdf', html:r.html, text:document.body.innerText || '', meta:{ decision:decisionOf(r.row), message:messageOf(r.row), v86:true } }); }catch(_){} }catch(e){ alert(e.message || e); }
  };

  // Mentett riportok olvashatóbb, sötét kártyája.
  const css = document.createElement('style');
  css.textContent = `
    #v75SavedReportsBox .v71ApprovalRow,#v79ApprovalsBox .v79ApprovalRow,#v79ApprovalsBox .v80ApprovalRow{background:#0f2638!important;border:1px solid rgba(148,163,184,.28)!important;border-radius:14px!important;padding:12px!important;margin:10px 0!important;color:#e5eef8!important;display:flex;gap:10px;justify-content:space-between;align-items:flex-start;box-shadow:0 8px 20px rgba(0,0,0,.18)}
    #v75SavedReportsBox small,#v79ApprovalsBox small{color:#b6c7d8!important}#v75SavedReportsBox p,#v79ApprovalsBox p{color:#e5eef8!important}.v79ApprovalActions,.v80ApprovalActions,.v71ApprovalActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.v79ApprovalMessage,.v80ApprovalMessage{background:#17344a!important;border:1px solid rgba(251,191,36,.25);border-radius:10px;padding:8px;color:#f8fafc!important}
    .v33RoleBox .notice p.muted::after{content:'  A munkatárs email címmel meghívható. Fotót csak akkor tud hozzáadni, ha regisztrált fiókkal belép és a projekt jogosultság aktív.';display:block;margin-top:6px;color:#fbbf24;font-weight:700}.featureExplainGrid .featureExplainBtn{cursor:pointer}.featureExplainGrid::before{content:'Ezek a funkciók regisztráció nélkül is olvashatók, így a látogató előre látja, mit tud az Építési Napló PRO.';display:block;grid-column:1/-1;color:#cbd5e1;background:#10263a;border:1px solid rgba(251,191,36,.25);padding:10px 12px;border-radius:12px;margin-bottom:8px}
    .entryActions .v86DeleteEntry{background:#7f1d1d!important;color:#fff!important;border-color:#ef4444!important}`;
  document.head.appendChild(css);

  // Bejegyzés törlés: DB sorok törlése, hogy ne maradjon felesleges adat Supabase-ben.
  window.v86DeleteEntry = async function(entryId){
    if(!entryId) return;
    if(!confirm('Biztosan törlöd ezt a napi bejegyzést? A Supabase-ből is törlődik, nem csak a képernyőről.')) return;
    try{ await window.EpitesNaploAPI?.deleteEntry?.(entryId); if(state().entries) state().entries = state().entries.filter(e => String(e.id) !== String(entryId)); if(typeof renderProjectTimeline === 'function') renderProjectTimeline(); toast('Bejegyzés törölve a Supabase-ből is.', 'ok'); }catch(e){ alert('Bejegyzés törlési hiba: ' + (e.message || e)); }
  };
  function addDeleteButtons(){
    document.querySelectorAll('.timelineEntry').forEach(card => {
      const onclicks = [...card.querySelectorAll('button[onclick]')].map(b => b.getAttribute('onclick') || '').join(' ');
      const m = onclicks.match(/addEntrySupplement\('([^']+)'\)/);
      if(!m || card.querySelector('.v86DeleteEntry')) return;
      const actions = card.querySelector('.entryActions') || card.querySelector('.timelineBody');
      if(actions) actions.insertAdjacentHTML('beforeend', `<button class="btn small danger v86DeleteEntry" type="button" onclick="v86DeleteEntry('${esc(m[1])}')">Bejegyzés törlése</button>`);
    });
  }
  const oldRender = window.renderProjectTimeline || (typeof renderProjectTimeline === 'function' ? renderProjectTimeline : null);
  if(oldRender && !oldRender.__v86DeleteWrapped){
    const wrapped = function(){ const res = oldRender.apply(this, arguments); setTimeout(addDeleteButtons, 50); return res; };
    wrapped.__v86DeleteWrapped = true;
    window.renderProjectTimeline = wrapped;
    try{ renderProjectTimeline = wrapped; }catch(_){}
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(addDeleteButtons, 1200));
  setTimeout(addDeleteButtons, 1800);
})();

// ===== V89: csak 2 javítás - anyag duplázás megszüntetése + ügyfél kérdés a jóváhagyott riportban =====
(function(){
  if(window.__v89OnlyMaterialAndClientQuestionFix) return;
  window.__v89OnlyMaterialAndClientQuestionFix = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeName = v => String(v || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Építési napló';
  const rowDate = row => (typeof formatDate === 'function' ? formatDate(row?.approved_at || row?.created_at || '') : String(row?.approved_at || row?.created_at || '').replace('T',' ').slice(0,19));
  const rowDecision = row => String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase();
  const rowLabel = d => (d === 'accepted' || d === 'approved') ? 'Elfogadva / jóváhagyva' : d === 'question' ? 'Kérdése van' : 'Megtekintve';
  const rowMessage = row => String(row?.client_comment || row?.message || row?.client_message || row?.approval_message || row?.question || row?.question_text || row?.note || row?.comment || '').trim();

  function normalizeMaterial(m){
    if(!m) return null;
    const name = String(m.name || m.material || m.title || '').trim();
    const unit = String(m.unit || m.unit_name || 'db').trim();
    const q = Number(String(m.quantity ?? m.qty ?? m.amount ?? '').replace(',', '.'));
    if(!name || !Number.isFinite(q) || q <= 0) return null;
    return { name, unit, quantity: q };
  }

  function collectEntryMaterials(entries){
    const map = new Map();
    (Array.isArray(entries) ? entries : []).forEach(e => {
      const list = Array.isArray(e?.materials_json) ? e.materials_json : [];
      list.forEach(raw => {
        const m = normalizeMaterial(raw);
        if(!m) return;
        const key = `${m.name.toLowerCase()}|${m.unit.toLowerCase()}`;
        const prev = map.get(key) || { name:m.name, unit:m.unit, quantity:0 };
        prev.quantity += m.quantity;
        map.set(key, prev);
      });
    });
    return Array.from(map.values()).map(m => ({...m, quantity:Number(m.quantity.toFixed(2))}));
  }

  function collectFallbackMaterials(extra){
    const map = new Map();
    (Array.isArray(extra) ? extra : []).forEach(raw => {
      const m = normalizeMaterial(raw);
      if(!m) return;
      const key = `${m.name.toLowerCase()}|${m.unit.toLowerCase()}`;
      const prev = map.get(key) || { name:m.name, unit:m.unit, quantity:0 };
      prev.quantity += m.quantity;
      map.set(key, prev);
    });
    return Array.from(map.values()).map(m => ({...m, quantity:Number(m.quantity.toFixed(2))}));
  }

  function materialListHtml(entries, options){
    let materials = collectEntryMaterials(entries);
    // Fontos: ha van naplóbejegyzéshez mentett strukturált anyag, csak azt számoljuk.
    // Így nem adódik hozzá még egyszer ugyanaz az anyag a szövegből / projektösszesítőből.
    if(!materials.length) materials = collectFallbackMaterials(options?.materials || []);
    return materials.length
      ? materials.map(m => `<li><b>${esc(m.name)}</b>: ${esc(m.quantity)} ${esc(m.unit)}</li>`).join('')
      : '<li>Nincs rögzített anyag.</li>';
  }

  function fixMaterialSummary(html, entries, options){
    let out = String(html || '');
    const list = materialListHtml(entries || state()?.entries || [], options || {});
    out = out.replace(/(<h2[^>]*>\s*Anyagösszesítő\s*<\/h2>\s*)<ul>[\s\S]*?<\/ul>/i, `$1<ul>${list}</ul>`);
    return out;
  }

  function injectClientQuestion(html, row){
    const msg = rowMessage(row);
    if(!msg) return html;
    let out = String(html || '');
    const block = `<section class="v89ClientQuestion" style="margin:22px 0;padding:16px 18px;border-left:5px solid #f59e0b;background:#fff7ed;border-radius:12px;color:#111827;break-inside:avoid;page-break-inside:avoid;"><h2 style="margin:0 0 8px;">Ügyfél kérdése / észrevétele</h2><p style="white-space:pre-wrap;margin:0;">${esc(msg)}</p></section>`;
    if(out.includes('v89ClientQuestion') || out.includes(esc(msg))) return out;
    if(/<h2[^>]*>\s*Anyagösszesítő\s*<\/h2>/i.test(out)){
      return out.replace(/(<h2[^>]*>\s*Anyagösszesítő\s*<\/h2>)/i, `${block}$1`);
    }
    return out.replace(/<body[^>]*>/i, m => `${m}${block}`);
  }

  function improveMobilePrint(html){
    const css = `<style>
      @media(max-width:720px){body{padding:14px!important;overflow-x:hidden!important}.doc,.publicReportCard{max-width:100%!important;width:100%!important;padding:16px!important}h1{font-size:30px!important;line-height:1.08!important}h2{font-size:23px!important}table{display:block!important;width:100%!important;overflow-x:auto!important;white-space:nowrap!important}.stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}.photos,.v74Photos,.v77Photos,.entryImageGrid,.reportImageGrid{grid-template-columns:repeat(auto-fill,minmax(92px,1fr))!important}.photo,.v67ReportPhoto,.v74Photo{width:92px!important;height:92px!important}.photo img,.v67ReportPhoto img,.v74Photo img{width:100%!important;height:100%!important;object-fit:cover!important}}
      @media print{.v89ClientQuestion{break-inside:avoid!important;page-break-inside:avoid!important}}
    </style>`;
    return String(html || '').includes('v89ClientQuestion') || String(html || '').includes('v89')
      ? String(html || '').replace('</head>', `${css}</head>`)
      : (String(html || '').includes('</head>') ? String(html || '').replace('</head>', `${css}</head>`) : `${css}${html}`);
  }

  const oldBuild = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
  if(oldBuild && !oldBuild.__v89NoMaterialDoubleCount){
    const wrapped = function(entries, title, options){
      return fixMaterialSummary(oldBuild(entries, title, options), entries, options);
    };
    wrapped.__v89NoMaterialDoubleCount = true;
    window.buildProReportHtml = wrapped;
    try{ buildProReportHtml = wrapped; }catch(_){}
  }

  function isBadSnapshot(html){
    const text = String(html || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return !text.trim() || text.length < 500 || text.includes('jovahagyott riport tartalma nem talalhato') || text.includes('de a jovahagyas rekordja elerheto') || text.includes('a riport adatai nem tolthetok') || text.includes('hianyzo riport azonosito');
  }

  async function getApprovalRow(id){
    try{ const row = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(row) return row; }catch(_){}
    try{ const rows = await window.EpitesNaploAPI?.getReportApprovals?.(projectId()); return (rows || []).find(r => String(r.id) === String(id)) || null; }catch(_){ return null; }
  }

  async function getCurrentReportHtml(){
    const data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId()).catch(() => null);
    const entries = data?.entries || state()?.entries || [];
    const builder = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
    return builder ? builder(entries, `${projectTitle()} – jóváhagyott riport`, data || {}) : '<!doctype html><html><body><h1>Riport</h1></body></html>';
  }

  function stamp(html, row){
    let out = String(html || '');
    if(!/<!doctype|<html/i.test(out)) out = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${esc(projectTitle())}</title></head><body>${out}</body></html>`;
    const msg = rowMessage(row);
    const stampHtml = `<section class="v89ApprovalStamp" style="border:2px solid #22c55e;background:#ecfdf5;color:#111827;padding:18px 20px;margin:0 0 22px;border-radius:14px;break-inside:avoid;page-break-inside:avoid;"><b>Jóváhagyott példány</b><br>Állapot: ${esc(rowLabel(rowDecision(row)))}<br>Elfogadás dátuma: ${esc(rowDate(row))}<br>Ügyfél: ${esc(row?.client_name || row?.client_email || 'Nincs megadva')}${msg ? `<div style="margin-top:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:12px;"><b>Ügyfél kérdése / észrevétele:</b><br>${esc(msg).replace(/\n/g,'<br>')}</div>` : ''}</section>`;
    out = injectClientQuestion(out, row);
    out = out.replace(/<body[^>]*>/i, m => `${m}${stampHtml}`);
    return improveMobilePrint(out);
  }

  async function fullApprovedHtml(id){
    const row = await getApprovalRow(id);
    if(!row) throw new Error('Nem találom az ügyfél jóváhagyást. Frissítsd az oldalt.');
    let html = row.approved_report_html || row.report_html_snapshot || row.report_html || '';
    if(isBadSnapshot(html)){
      try{ const doc = await window.EpitesNaploAPI?.getReportDocumentByApproval?.(id); if(doc?.html_content && !isBadSnapshot(doc.html_content)) html = doc.html_content; }catch(_){}
    }
    if(isBadSnapshot(html)) html = await getCurrentReportHtml();
    // Régebbi mentett riportnál is cseréljük az anyagösszesítőt az aktuális, nem duplázott számításra.
    try{ const data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId()); html = fixMaterialSummary(html, data?.entries || state()?.entries || [], data || {}); }catch(_){ html = fixMaterialSummary(html, state()?.entries || [], {}); }
    return { row, html:stamp(html, row) };
  }

  function downloadHtmlFile(name, html){
    const blob = new Blob([html || ''], { type:'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1200);
  }

  window.v71DownloadApprovedHtml = async function(id){
    try{
      const r = await fullApprovedHtml(id);
      downloadHtmlFile(`${safeName(projectTitle())}-${safeName(rowLabel(rowDecision(r.row)))}-jovahagyott-riport.html`, r.html);
    }catch(e){ alert(e.message || e); }
  };
  window.v71PrintApprovedReport = async function(id){
    try{
      const r = await fullApprovedHtml(id);
      const w = window.open('', '_blank');
      if(!w) return alert('A böngésző blokkolta az új ablakot.');
      w.document.open(); w.document.write(r.html); w.document.close();
      setTimeout(() => { try{ w.focus(); w.print(); }catch(_){} }, 700);
    }catch(e){ alert(e.message || e); }
  };
})();


// ===== V100 FINAL: saját példány gomb loading + jóváhagyott riport kis/kattintható képek =====
(function(){
  if(window.__v100FinalApprovedReportPatch) return;
  window.__v100FinalApprovedReportPatch = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeName = v => String(v || 'epitesi-naplo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'epitesi-naplo';
  const state = () => (typeof detailState !== 'undefined' ? detailState : (window.detailState || {}));
  const projectId = () => state()?.project?.id || new URLSearchParams(location.search).get('id') || '';
  const projectTitle = () => state()?.project?.name || 'Építési napló';
  const decisionOf = row => String(row?.decision || row?.status || (row?.approved ? 'accepted' : 'viewed')).toLowerCase();
  const labelOf = d => (d === 'accepted' || d === 'approved') ? 'Elfogadva / jóváhagyva' : d === 'question' ? 'Kérdése van' : 'Megtekintve';
  const messageOf = row => String(row?.client_comment || row?.message || row?.client_message || row?.approval_message || row?.question || row?.question_text || row?.note || row?.comment || '').trim();
  const rowDate = row => (typeof formatDate === 'function' ? formatDate(row?.approved_at || row?.created_at || '') : String(row?.approved_at || row?.created_at || '').replace('T',' ').slice(0,19));
  function toast(msg,type){ try{ if(typeof showToast === 'function') showToast(msg,type||'ok'); else console.log(msg); }catch(_){} }
  function setBtnLoading(btn, text){
    if(!btn) return () => {};
    const old = btn.innerText;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.innerText = text || 'Dolgozom...';
    return () => { btn.disabled = false; btn.classList.remove('is-loading'); btn.innerText = old; };
  }
  function findButton(id, type){
    const attr = type === 'print' ? 'data-v79-approval-print' : 'data-v79-approval-download';
    return document.querySelector(`[${attr}="${CSS.escape(String(id))}"]`) || document.querySelector(`[data-v71-${type === 'print' ? 'print' : 'download'}="${CSS.escape(String(id))}"]`);
  }
  function isBadSnapshot(html){
    const text = String(html || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return !text.trim() || text.length < 500 || text.includes('jovahagyott riport tartalma nem talalhato') || text.includes('de a jovahagyas rekordja elerheto') || text.includes('a riport adatai nem tolthetok') || text.includes('hianyzo riport azonosito');
  }
  function normalizeMaterial(m){
    if(!m) return null;
    const name = String(m.name || m.material || m.title || '').trim();
    const unit = String(m.unit || m.unit_name || 'db').trim();
    const q = Number(String(m.quantity ?? m.qty ?? m.amount ?? '').replace(',', '.'));
    if(!name || !Number.isFinite(q) || q <= 0) return null;
    return { name, unit, quantity:q };
  }
  function materialList(entries, extra){
    const map = new Map();
    (Array.isArray(entries) ? entries : []).forEach(e => (Array.isArray(e?.materials_json) ? e.materials_json : []).forEach(raw => {
      const m = normalizeMaterial(raw); if(!m) return;
      const key = `${m.name.toLowerCase()}|${m.unit.toLowerCase()}`;
      const p = map.get(key) || {name:m.name, unit:m.unit, quantity:0}; p.quantity += m.quantity; map.set(key,p);
    }));
    if(!map.size) (Array.isArray(extra) ? extra : []).forEach(raw => {
      const m = normalizeMaterial(raw); if(!m) return;
      const key = `${m.name.toLowerCase()}|${m.unit.toLowerCase()}`;
      const p = map.get(key) || {name:m.name, unit:m.unit, quantity:0}; p.quantity += m.quantity; map.set(key,p);
    });
    return Array.from(map.values()).map(m => `<li><b>${esc(m.name)}</b>: ${Number(m.quantity.toFixed(2))} ${esc(m.unit)}</li>`).join('') || '<li>Nincs rögzített anyag.</li>';
  }
  function fixMaterialSummary(html, entries, options){
    const list = materialList(entries, options?.materials || []);
    return String(html || '').replace(/(<h2[^>]*>\s*Anyagösszesítő\s*<\/h2>\s*)<ul>[\s\S]*?<\/ul>/i, `$1<ul>${list}</ul>`);
  }
  function reportCss(){ return `<style id="v100-approved-report-css">
    body{background:#f8fafc!important;color:#111827!important;font-family:Arial,Helvetica,sans-serif!important;margin:0!important;padding:28px!important;line-height:1.45!important}.doc,.reportDoc,.publicReportCard{max-width:980px!important;margin:0 auto!important;background:#fff!important;color:#111827!important}.v100ApprovalStamp{border:2px solid #22c55e;background:#ecfdf5;color:#111827;padding:18px 20px;margin:0 0 22px;border-radius:14px;break-inside:avoid;page-break-inside:avoid}.v100ApprovalStamp h1{font-size:26px;margin:0 0 10px}.v100Grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.v100Grid p{margin:0;background:#fff;border:1px solid #bbf7d0;border-radius:10px;padding:10px}.v100Question{margin-top:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:12px}.photos,.entryImageGrid,.reportImageGrid,.v68ReportPhotos{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(112px,112px))!important;gap:12px!important;align-items:start!important;justify-content:start!important}.v67ReportPhoto,.photos figure,figure{width:112px!important;max-width:112px!important;background:#fff!important;border:1px solid #d1d5db!important;border-radius:12px!important;padding:6px!important;margin:0!important;box-sizing:border-box!important;break-inside:avoid!important;page-break-inside:avoid!important}.v67ReportPhoto a,.photos figure a,figure a{display:block!important;width:100%!important;height:104px!important}.v67ReportPhoto img,.photos img,.entryImageGrid img,.reportImageGrid img,figure img,img.reportPhoto{width:100%!important;height:104px!important;max-width:100%!important;object-fit:cover!important;border-radius:8px!important;display:block!important;cursor:zoom-in!important;background:#f8fafc!important}body > img,img:not(.brandIcon):not(.logo):not(.paypal-logo):not(.v100LightboxImg){max-width:120px!important;max-height:120px!important;width:120px!important;height:120px!important;object-fit:cover!important;border-radius:10px!important;cursor:zoom-in!important;display:inline-block!important;margin:6px!important}.v100Lightbox{position:fixed;inset:0;background:rgba(2,6,23,.92);display:flex;align-items:center;justify-content:center;z-index:999999;padding:20px}.v100LightboxImg{max-width:94vw!important;max-height:88vh!important;width:auto!important;height:auto!important;object-fit:contain!important;border-radius:12px!important;background:#111}.v100Lightbox button{position:fixed;right:16px;top:16px;border:0;border-radius:999px;background:#fbbf24;color:#111827;font-weight:800;padding:10px 14px;cursor:pointer}@media(max-width:720px){body{padding:12px!important}.v100Grid{grid-template-columns:1fr}.photos,.entryImageGrid,.reportImageGrid,.v68ReportPhotos{grid-template-columns:repeat(2,112px)!important}h1{font-size:30px!important;line-height:1.08!important}h2{font-size:23px!important}table{display:block!important;max-width:100%!important;overflow-x:auto!important;white-space:nowrap!important}}@media print{.v100Lightbox{display:none!important}body{padding:18px!important}.v100ApprovalStamp{break-inside:avoid;page-break-inside:avoid}}
  </style>`; }
  function lightboxScript(){ return `<script>(function(){function list(){return Array.from(document.querySelectorAll('img')).filter(function(i){return i.src&&!i.closest('.v100Lightbox')})}function openAt(n){var imgs=list();if(!imgs.length)return;var idx=Math.max(0,Math.min(n,imgs.length-1));var d=document.createElement('div');d.className='v100Lightbox';function render(){d.innerHTML='<button type="button">Bezárás</button><img class="v100LightboxImg" src="'+imgs[idx].src.replace(/"/g,'&quot;')+'">';d.querySelector('button').onclick=function(){d.remove()}}render();d.onclick=function(e){if(e.target===d)d.remove()};document.addEventListener('keydown',function key(e){if(!document.body.contains(d)){document.removeEventListener('keydown',key);return}if(e.key==='Escape')d.remove();if(e.key==='ArrowRight'){idx=(idx+1)%imgs.length;render()}if(e.key==='ArrowLeft'){idx=(idx-1+imgs.length)%imgs.length;render()}});document.body.appendChild(d)}document.addEventListener('click',function(e){var img=e.target.closest('img');if(!img||img.closest('.v100Lightbox'))return;e.preventDefault();openAt(list().indexOf(img))},true);})();<\/script>`; }
  function injectHead(html){
    let out = String(html || '');
    if(!/<!doctype|<html/i.test(out)) out = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${esc(projectTitle())}</title></head><body>${out}</body></html>`;
    if(!out.includes('v100-approved-report-css')) out = out.includes('</head>') ? out.replace('</head>', `${reportCss()}</head>`) : out.replace(/<body/i, `<head><meta charset="utf-8">${reportCss()}</head><body`);
    if(!out.includes('v100Lightbox')) out = out.includes('</body>') ? out.replace('</body>', `${lightboxScript()}</body>`) : out + lightboxScript();
    return out;
  }
  function stamp(html,row){
    let out = injectHead(html);
    const msg = messageOf(row);
    const questionBlock = msg ? `<section class="v100Question"><b>Ügyfél kérdése / észrevétele:</b><br>${esc(msg).replace(/\n/g,'<br>')}</section>` : '';
    if(msg && !out.includes('Ügyfél kérdése / észrevétele')){
      out = out.replace(/(<h2[^>]*>\s*Anyagösszesítő\s*<\/h2>)/i, `${questionBlock}$1`);
    }
    const stampHtml = `<section class="v100ApprovalStamp"><h1>Jóváhagyott ügyfélpéldány</h1><div class="v100Grid"><p><b>Állapot:</b><br>${esc(labelOf(decisionOf(row)))}</p><p><b>Dátum:</b><br>${esc(rowDate(row))}</p><p><b>Ügyfél:</b><br>${esc(row?.client_name || row?.client_email || 'Nincs megadva')}</p></div>${questionBlock}</section>`;
    if(!out.includes('v100ApprovalStamp')) out = out.replace(/<body[^>]*>/i, m => `${m}${stampHtml}`);
    return out;
  }
  async function approvalRow(id){
    try{ const row = await window.EpitesNaploAPI?.getApprovedReportHtml?.(id); if(row) return row; }catch(_){ }
    try{ const rows = await window.EpitesNaploAPI?.getReportApprovals?.(projectId()); return (rows || []).find(r => String(r.id) === String(id)) || null; }catch(_){ return null; }
  }
  async function currentReportHtml(){
    const data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId()).catch(() => null);
    const entries = data?.entries || state()?.entries || [];
    const builder = window.buildProReportHtml || (typeof buildProReportHtml === 'function' ? buildProReportHtml : null);
    return builder ? builder(entries, `${projectTitle()} – jóváhagyott riport`, data || {}) : `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${esc(projectTitle())}</title></head><body><h1>${esc(projectTitle())}</h1><p>A riport pillanatnyilag nem építhető újra.</p></body></html>`;
  }
  async function fullHtml(id){
    const row = await approvalRow(id);
    if(!row) throw new Error('Nem találom az ügyfél jóváhagyást. Frissítsd az oldalt.');
    let html = row.approved_report_html || row.report_html_snapshot || row.report_html || '';
    if(isBadSnapshot(html)){
      try{ const doc = await window.EpitesNaploAPI?.getReportDocumentByApproval?.(id); if(doc?.html_content && !isBadSnapshot(doc.html_content)) html = doc.html_content; }catch(_){ }
    }
    if(isBadSnapshot(html)) html = await currentReportHtml();
    try{ const data = await window.EpitesNaploAPI?.getProjectCloseData?.(projectId()); html = fixMaterialSummary(html, data?.entries || state()?.entries || [], data || {}); }catch(_){ html = fixMaterialSummary(html, state()?.entries || [], {}); }
    return {row, html:stamp(html,row)};
  }
  function downloadFile(name, html){
    const blob = new Blob([html || ''], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1200);
  }

  window.v71DownloadApprovedHtml = async function(id){
    const done = setBtnLoading(findButton(id,'download'), 'Letöltés...');
    try{
      const r = await fullHtml(id);
      downloadFile(`${safeName(projectTitle())}-${safeName(labelOf(decisionOf(r.row)))}-jovahagyott-riport.html`, r.html);
      toast('Saját példány HTML elkészült.', 'ok');
    }catch(e){
      alert('HTML riport hiba: ' + (e.message || e));
    }finally{ done(); }
  };

  window.v71PrintApprovedReport = async function(id){
    const done = setBtnLoading(findButton(id,'print'), 'PDF készül...');
    try{
      const r = await fullHtml(id);
      const w = window.open('', '_blank');
      if(!w) return alert('A böngésző blokkolta az új ablakot.');
      w.document.open(); w.document.write(r.html); w.document.close();
      setTimeout(()=>{ try{ w.focus(); w.print(); }catch(_){} }, 800);
      toast('PDF / nyomtatási nézet megnyitva.', 'ok');
    }catch(e){
      alert('PDF/nyomtatási hiba: ' + (e.message || e));
    }finally{ done(); }
  };
})();
