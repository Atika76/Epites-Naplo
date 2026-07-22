// V184 - letisztult gyors mobilos mentes: foto, video, fajl, megjegyzett GPS es cim duplikacio nelkul.
(function(){
  'use strict';
  if (window.__EPITESNAPLO_V184_MOBILE_QUICK__) return;
  window.__EPITESNAPLO_V184_MOBILE_QUICK__ = true;

  const GPS_PREF_KEY = 'epitesnaplo_v184_quick_gps_enabled';
  const VIDEO_MAX_SECONDS = 30;
  const VIDEO_TARGET_WIDTH = 1280;
  const VIDEO_TARGET_HEIGHT = 720;
  const VIDEO_FPS = 24;
  const VIDEO_BITRATE = 1200000;

  const recorderState = {
    targetInputId: 'v33QuickFiles',
    stream: null,
    recorder: null,
    chunks: [],
    file: null,
    startedAt: 0,
    timer: 0
  };

  function q(id){ return document.getElementById(id); }
  function toast(message, type){
    if (typeof window.showToast === 'function') window.showToast(message, type || 'info');
    else console.log(message);
  }
  function asArray(list){ return Array.from(list || []); }
  function fileKey(file){ return [file?.name, file?.size, file?.lastModified, file?.type].join('|'); }
  function isImage(file){ return String(file?.type || '').startsWith('image/'); }
  function isVideo(file){
    return !!file && (String(file.type || '').startsWith('video/') || /\.(mp4|m4v|mov|webm|3gp|3gpp|mpeg|mpg|avi)$/i.test(String(file.name || '')));
  }
  function hasCoords(text){
    return /-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/.test(String(text || ''));
  }
  function cleanAddress(text){
    return String(text || '')
      .replace(/\(?\s*-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}[^)]*\)?/g, '')
      .replace(/\bGPS\b\s*[:\-]*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  function projectId(){
    return window.detailState?.project?.id || new URLSearchParams(location.search).get('id') || 'current';
  }
  function addressKey(){ return 'epitesnaplo_v184_quick_address_' + projectId(); }

  function gpsToText(gps){
    if (!gps) return '';
    const lat = Number(gps.lat);
    const lon = Number(gps.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return String(gps.text || '');
    const accuracy = gps.accuracy ? ' - pontossag kb. ' + Math.round(Number(gps.accuracy)) + ' m' : '';
    return lat.toFixed(5) + ', ' + lon.toFixed(5) + accuracy;
  }
  function weatherToText(weather){
    if (!weather) return '';
    const parts = [];
    if (weather.temperature !== undefined && weather.temperature !== null && weather.temperature !== '') parts.push(weather.temperature + ' °C');
    if (weather.text) parts.push(weather.text);
    if (weather.wind !== undefined && weather.wind !== null && weather.wind !== '') parts.push('szél: ' + weather.wind + ' km/h');
    if (weather.precipitation !== undefined && weather.precipitation !== null && weather.precipitation !== '') parts.push('csapadék: ' + weather.precipitation + ' mm');
    return parts.join(', ');
  }
  function preferredRecorderType(){
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    return types.find(type => window.MediaRecorder && MediaRecorder.isTypeSupported(type)) || '';
  }

  function quickFiles(){
    const basket = Array.isArray(window.v180QuickFileBasket) ? window.v180QuickFileBasket : [];
    if (basket.length) return basket.slice();
    return asArray(q('v33QuickFiles')?.files);
  }
  function setQuickFiles(files){
    const input = q('v33QuickFiles');
    const list = asArray(files).filter(Boolean);
    window.v180QuickFileBasket = list;
    if (input && typeof DataTransfer !== 'undefined') {
      const dt = new DataTransfer();
      list.forEach(file => { try { dt.items.add(file); } catch (_) {} });
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  function appendQuickFiles(files){
    const map = new Map();
    quickFiles().concat(asArray(files)).filter(Boolean).forEach(file => map.set(fileKey(file), file));
    setQuickFiles(Array.from(map.values()));
  }

  function setQuickStatus(message, type){
    if (typeof window.v33SetQuickStatus === 'function') return window.v33SetQuickStatus(message, type || 'info');
    const box = q('v33QuickStatusBox');
    if (!box) return;
    box.className = 'v32UploadStatus ' + (type || 'info');
    box.classList.remove('hidden');
    box.innerHTML = message;
  }

  function syncQuickGpsPreference(){
    const check = q('v184QuickGpsCheck');
    if (!check) return;
    check.checked = localStorage.getItem(GPS_PREF_KEY) === '1';
    check.addEventListener('change', () => {
      localStorage.setItem(GPS_PREF_KEY, check.checked ? '1' : '0');
    });
  }
  function quickGpsEnabled(){
    const check = q('v184QuickGpsCheck');
    return !!check?.checked;
  }

  function injectQuickUi(){
    const panel = q('v33QuickPanel');
    const input = q('v33QuickFiles');
    if (!panel || !input || q('v184QuickMediaActions')) return false;

    panel.classList.add('v184QuickPrimary');
    const headTitle = panel.querySelector('h2');
    const headText = panel.querySelector('.sectionTop .muted');
    if (headTitle) headTitle.textContent = 'Gyors mobilos naplózás';
    if (headText) headText.textContent = 'Munka közben: rövid jegyzet, fotó, 30 mp videó, cím és opcionális GPS egy helyen.';

    const grid = panel.querySelector('.formGrid');
    if (grid && !q('v184QuickAddress')) {
      const address = document.createElement('input');
      address.id = 'v184QuickAddress';
      address.type = 'text';
      address.placeholder = 'Munka címe: város, utca, házszám';
      try { address.value = localStorage.getItem(addressKey()) || cleanAddress(q('detailWorkAddress')?.value || ''); } catch (_) {}
      address.addEventListener('input', () => {
        const value = cleanAddress(address.value);
        try { localStorage.setItem(addressKey(), value); } catch (_) {}
        if (q('detailWorkAddress')) q('detailWorkAddress').value = value;
      });
      grid.appendChild(address);
    }

    const tools = document.createElement('div');
    tools.id = 'v184QuickMediaActions';
    tools.className = 'v184QuickMediaActions';
    tools.innerHTML = `
      <button class="btn ghost" type="button" onclick="v184OpenQuickPhoto()">Fotó készítése</button>
      <button class="btn primary" type="button" onclick="v184OpenQuickVideo()">Videó max. 30 mp</button>
      <button class="btn ghost" type="button" onclick="v184OpenQuickFilePicker()">Fájl hozzáadása</button>
      <label class="v184QuickGpsToggle"><input id="v184QuickGpsCheck" type="checkbox" /> GPS/időjárás mentése</label>
      <input id="v184QuickPhotoInput" class="hidden" type="file" accept="image/*" capture="environment" multiple />
    `;
    input.insertAdjacentElement('beforebegin', tools);
    input.classList.add('v184NativeFileInput');

    q('v184QuickPhotoInput')?.addEventListener('change', event => {
      const files = asArray(event.target.files).filter(isImage);
      if (files.length) {
        appendQuickFiles(files);
        toast(files.length + ' fotó hozzáadva a gyorsmentéshez.', 'ok');
      }
      event.target.value = '';
    });

    syncQuickGpsPreference();
    tidyDetailedGpsControls();
    syncAddressPlaceholders();
    return true;
  }

  function tidyDetailedGpsControls(){
    document.querySelectorAll('button').forEach(button => {
      const onclick = String(button.getAttribute('onclick') || '');
      const text = String(button.textContent || '').trim().toLowerCase();
      if (onclick.includes('captureGpsOnly') || text.includes('csak gps mentése') || text.includes('új napló gps-szel')) {
        button.classList.add('v184HiddenDetailGps');
        button.setAttribute('aria-hidden', 'true');
      }
    });
  }
  function syncAddressPlaceholders(){
    const address = q('detailWorkAddress');
    if (address) {
      address.placeholder = 'Munka címe: város, utca, házszám (nem GPS koordináta)';
      if (hasCoords(address.value) && q('detailGps') && !q('detailGps').value.trim()) q('detailGps').value = address.value.match(/-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}[^)]*/)?.[0] || '';
      if (hasCoords(address.value)) address.value = cleanAddress(address.value);
    }
    const gps = q('detailGps');
    if (gps) gps.placeholder = 'GPS koordináta - automatikus, ha engedélyezed';
  }

  async function captureGpsWeatherIfEnabled(){
    const empty = { gps: null, weather: null, gpsText: '', weatherText: '', locationAddress: cleanAddress(q('v184QuickAddress')?.value || q('detailWorkAddress')?.value || '') };
    if (!quickGpsEnabled()) return empty;

    setQuickStatus('<b>Gyors mentés folyamatban...</b><br>GPS és időjárás lekérése...', 'info');
    try { v19GpsJson = null; v19WeatherJson = null; } catch (_) {}
    try { window.v19GpsJson = null; window.v19WeatherJson = null; } catch (_) {}

    try {
      if (typeof window.fillWeatherAndGps === 'function') await window.fillWeatherAndGps();
      else if (typeof fillWeatherAndGps === 'function') await fillWeatherAndGps();
      else if (window.EpitesNaploAPI?.getBrowserLocation) {
        const apiGps = await window.EpitesNaploAPI.getBrowserLocation();
        try { v19GpsJson = apiGps; } catch (_) { window.v19GpsJson = apiGps; }
        if (apiGps && window.EpitesNaploAPI?.getWeatherForLocation) {
          const apiWeather = await window.EpitesNaploAPI.getWeatherForLocation(apiGps.lat, apiGps.lon);
          try { v19WeatherJson = apiWeather; } catch (_) { window.v19WeatherJson = apiWeather; }
        }
      }
    } catch (err) {
      console.warn('V184 gyorsmentés GPS/időjárás hiba:', err);
    }

    let sourceGps = null;
    let sourceWeather = null;
    try { if (typeof v19GpsJson !== 'undefined' && v19GpsJson) sourceGps = v19GpsJson; } catch (_) {}
    try { if (typeof v19WeatherJson !== 'undefined' && v19WeatherJson) sourceWeather = v19WeatherJson; } catch (_) {}
    if (!sourceGps && window.v19GpsJson) sourceGps = window.v19GpsJson;
    if (!sourceWeather && window.v19WeatherJson) sourceWeather = window.v19WeatherJson;
    const gps = sourceGps ? { ...sourceGps, captured_at: new Date().toISOString() } : null;
    const weather = sourceWeather ? { ...sourceWeather, captured_at: new Date().toISOString() } : null;
    const gpsText = gpsToText(gps) || (q('detailGps')?.value || '').trim();
    const weatherText = weatherToText(weather) || (q('detailWeather')?.value || q('weatherAutoText')?.value || '').trim();
    const locationAddress = cleanAddress(q('v184QuickAddress')?.value || q('detailWorkAddress')?.value || '');

    if (q('detailGps') && gpsText) q('detailGps').value = gpsText;
    if (q('detailWeather') && weatherText && !/nem sikerült|nem elérhető|nincs engedély/i.test(weatherText)) q('detailWeather').value = weatherText;
    if (q('detailWorkAddress')) q('detailWorkAddress').value = locationAddress;
    if (q('weatherAutoText')) q('weatherAutoText').value = weatherText || 'GPS/időjárás nem elérhető. A gyors mentés folytatódik.';
    return { gps, weather, gpsText, weatherText, locationAddress };
  }

  async function saveQuickEntryV184(){
    if (!window.detailState?.project) return alert('Nincs kiválasztott projekt.');
    const noteBase = (q('v33QuickNote')?.value || '').trim();
    if (!noteBase) return alert('Írj legalább egy rövid jegyzetet.');

    setQuickStatus('<b>Gyors mentés folyamatban...</b><br>Fotók és videók előkészítése.', 'info');
    const files = quickFiles();
    const imageFiles = files.filter(isImage);
    const videoFiles = files.filter(isVideo);
    const captured = await captureGpsWeatherIfEnabled();

    const images = await readFilesAsDataUrls(imageFiles, 8);
    const videos = await window.uploadVideoFilesToStorage(videoFiles, 2);
    const phase = (typeof window.v36GetQuickWorkPhase === 'function') ? window.v36GetQuickWorkPhase() : (q('v33QuickPhase')?.value || 'Munka közben');
    const status = q('v33QuickStatus')?.value || 'Folyamatban';
    const date = new Date().toISOString().slice(0, 10);
    const address = cleanAddress(captured.locationAddress || q('v184QuickAddress')?.value || q('detailWorkAddress')?.value || '');
    const weatherText = quickGpsEnabled() && captured.weatherText && !/nem sikerült|nem elérhető|nincs engedély/i.test(captured.weatherText) ? captured.weatherText : '';
    const gpsText = quickGpsEnabled() ? captured.gpsText : '';

    const noteParts = ['Dátum: ' + date, noteBase];
    if (address) noteParts.push('Munka helyszíne/cím: ' + address);
    if (weatherText) noteParts.push('Automatikus időjárás: ' + weatherText);
    if (gpsText) noteParts.push('GPS/helyadat: rögzítve');
    if (images.length) noteParts.push('Fotó: ' + images.length + ' db');
    if (videos.length) noteParts.push('Munkavideó: ' + videos.length + ' db');
    const note = noteParts.join('\n');

    let analysis = analyzeEntry({ note, phase, status, priority: 'Közepes', images, videos, imageCount: images.length, videoCount: videos.length });
    analysis = { ...(analysis || {}), videos, videoUrls: videos, generalImages: images, weatherJson: captured.weather || null, gpsJson: captured.gps || null };

    const saved = await window.EpitesNaploAPI.saveEntry({
      projectId: window.detailState.project.id,
      phase,
      status,
      priority: 'Közepes',
      responsible: 'Gyors mobilos mentés',
      weather: weatherText || 'Nincs megadva',
      note,
      images,
      generalImages: images,
      videos,
      videoUrls: videos,
      image: images[0] || '',
      analysis,
      weatherJson: captured.weather || null,
      gpsJson: captured.gps ? { ...captured.gps, text: gpsText } : null,
      locationAddress: address || null
    });

    if (!saved?.id) throw new Error('A gyors mentés nem kapott mentett azonosítót. Ellenőrizd a Supabase kapcsolatot.');
    if (videos.length && window.EpitesNaploAPI?.updateEntry) {
      try {
        await window.EpitesNaploAPI.updateEntry(saved.id, {
          video_urls: videos,
          image_urls: images,
          general_images_json: images,
          ai_json: { ...analysis, videos, videoUrls: videos, generalImages: images }
        });
      } catch (err) {
        console.warn('V184 gyorsmentés videó ráerősítő update hiba:', err);
      }
    }

    if (q('v33QuickNote')) q('v33QuickNote').value = '';
    if (q('v33QuickCustomPhase')) q('v33QuickCustomPhase').value = '';
    if (typeof window.v180ClearQuickFileBasket === 'function') window.v180ClearQuickFileBasket();
    else setQuickFiles([]);
    try { v19WeatherJson = null; v19GpsJson = null; } catch (_) {}
    try { window.v19WeatherJson = null; window.v19GpsJson = null; } catch (_) {}

    await reloadProjectEntries();
    if (typeof window.hydratePrivateVideoUrls === 'function') await window.hydratePrivateVideoUrls(window.detailState.entries || []);
    if (typeof window.renderProjectTimeline === 'function') window.renderProjectTimeline();
    if (typeof window.renderProjectSummary === 'function') window.renderProjectSummary();
    setQuickStatus('<b>Gyors mentés kész.</b><br>' + images.length + ' fotó, ' + videos.length + ' videó mentve az idővonalra.', 'ok');
    toast('Gyors mentés kész: média és naplóbejegyzés mentve.', 'ok');
    return saved;
  }

  function installQuickSave(){
    if (typeof window.v33SaveQuickEntry !== 'function') return false;
    if (window.v33SaveQuickEntry.__v184QuickSave) return true;
    saveQuickEntryV184.__v184QuickSave = true;
    window.v33SaveQuickEntry = saveQuickEntryV184;
    try { v33SaveQuickEntry = saveQuickEntryV184; } catch (_) {}
    return true;
  }

  function ensureRecorderModal(){
    let modal = q('v184RecorderModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v184RecorderModal';
    modal.className = 'modal hidden v184RecorderModal';
    modal.innerHTML = `
      <div class="modalContent v184RecorderCard">
        <button class="closeBtn" type="button" onclick="v184CloseVideoCamera()">x</button>
        <p class="badge">Gyors munkavideó</p>
        <h2>30 másodperces videó</h2>
        <video id="v184RecorderPreview" class="v184RecorderPreview" playsinline muted></video>
        <div class="v184RecorderControls">
          <div id="v184ProgressRing" class="v184ProgressRing" style="--p:0"><span id="v184ProgressText">30</span></div>
          <button id="v184RecordStartBtn" class="btn primary" type="button" onclick="v184StartRecording()">Felvétel indítása</button>
          <button id="v184RecordSaveBtn" class="btn ghost hidden" type="button" onclick="v184UseRecordedVideo()">Videó hozzáadása</button>
        </div>
        <small id="v184RecorderStatus" class="muted">A felvétel 30 másodpercnél automatikusan megáll.</small>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }
  function stopTracks(){
    try { recorderState.stream?.getTracks?.().forEach(track => track.stop()); } catch (_) {}
    recorderState.stream = null;
  }
  function updateProgress(elapsedMs){
    const percent = Math.min(100, elapsedMs / (VIDEO_MAX_SECONDS * 1000) * 100);
    const left = Math.max(0, VIDEO_MAX_SECONDS - Math.ceil(elapsedMs / 1000));
    q('v184ProgressRing')?.style.setProperty('--p', percent.toFixed(1));
    if (q('v184ProgressText')) q('v184ProgressText').textContent = String(left);
  }
  async function openVideo(targetInputId){
    recorderState.targetInputId = targetInputId || 'v33QuickFiles';
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert('Ez a böngésző nem engedi a közvetlen kamerás videófelvételt. Használd a Fájl hozzáadása gombot.');
      return;
    }
    const modal = ensureRecorderModal();
    recorderState.file = null;
    recorderState.chunks = [];
    q('v184RecordStartBtn')?.classList.remove('hidden');
    q('v184RecordSaveBtn')?.classList.add('hidden');
    updateProgress(0);
    modal.classList.remove('hidden');
    try {
      recorderState.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: VIDEO_TARGET_WIDTH, max: VIDEO_TARGET_WIDTH },
          height: { ideal: VIDEO_TARGET_HEIGHT, max: VIDEO_TARGET_HEIGHT },
          frameRate: { ideal: VIDEO_FPS, max: 30 }
        },
        audio: true
      });
      const preview = q('v184RecorderPreview');
      if (preview) {
        preview.srcObject = recorderState.stream;
        preview.muted = true;
        await preview.play().catch(() => {});
      }
      if (q('v184RecorderStatus')) q('v184RecorderStatus').textContent = 'Kamera kész. Indíthatod a felvételt.';
    } catch (err) {
      console.warn('V184 kamera hiba:', err);
      if (q('v184RecorderStatus')) q('v184RecorderStatus').textContent = 'A kamera nem indult el. Ellenőrizd az engedélyt.';
    }
  }
  function startRecording(){
    if (!recorderState.stream) return alert('Előbb engedélyezd a kamerát.');
    const type = preferredRecorderType();
    const startBtn = q('v184RecordStartBtn');
    if (startBtn) {
      startBtn.textContent = 'Felvétel leállítása';
      startBtn.onclick = stopRecording;
    }
    recorderState.chunks = [];
    recorderState.recorder = new MediaRecorder(recorderState.stream, {
      mimeType: type || undefined,
      videoBitsPerSecond: VIDEO_BITRATE,
      audioBitsPerSecond: 64000
    });
    recorderState.recorder.ondataavailable = event => { if (event.data && event.data.size) recorderState.chunks.push(event.data); };
    recorderState.recorder.onstop = () => {
      const mime = type || 'video/webm';
      recorderState.file = new File([new Blob(recorderState.chunks, { type: mime })], 'gyors-munkavideo-30mp-' + Date.now() + '.webm', { type: mime, lastModified: Date.now() });
      if (startBtn) {
        startBtn.textContent = 'Felvétel indítása';
        startBtn.onclick = startRecording;
        startBtn.classList.add('hidden');
      }
      q('v184RecordSaveBtn')?.classList.remove('hidden');
      if (q('v184RecorderStatus')) q('v184RecorderStatus').textContent = 'Felvétel kész. Hozzáadhatod a gyorsmentéshez.';
      stopTracks();
    };
    recorderState.startedAt = Date.now();
    recorderState.recorder.start(1000);
    recorderState.timer = window.setInterval(() => {
      const elapsed = Date.now() - recorderState.startedAt;
      updateProgress(elapsed);
      if (elapsed >= VIDEO_MAX_SECONDS * 1000) stopRecording();
    }, 150);
  }
  function stopRecording(){
    window.clearInterval(recorderState.timer);
    updateProgress(VIDEO_MAX_SECONDS * 1000);
    try { if (recorderState.recorder?.state !== 'inactive') recorderState.recorder.stop(); } catch (_) {}
  }
  function closeVideo(){
    window.clearInterval(recorderState.timer);
    try { if (recorderState.recorder?.state !== 'inactive') recorderState.recorder.stop(); } catch (_) {}
    stopTracks();
    const preview = q('v184RecorderPreview');
    if (preview) preview.srcObject = null;
    q('v184RecorderModal')?.classList.add('hidden');
  }
  function useRecordedVideo(){
    if (!recorderState.file) return alert('Még nincs hozzáadható videó.');
    appendQuickFiles([recorderState.file]);
    closeVideo();
    toast('30 mp-es videó hozzáadva a gyorsmentéshez.', 'ok');
  }

  window.v184OpenQuickPhoto = function(){ q('v184QuickPhotoInput')?.click(); };
  window.v184OpenQuickVideo = function(){ openVideo('v33QuickFiles'); };
  window.v184OpenQuickFilePicker = function(){ q('v33QuickFiles')?.click(); };
  window.v184StartRecording = startRecording;
  window.v184CloseVideoCamera = closeVideo;
  window.v184UseRecordedVideo = useRecordedVideo;

  function boot(){
    injectQuickUi();
    installQuickSave();
    tidyDetailedGpsControls();
    syncAddressPlaceholders();
    setTimeout(injectQuickUi, 400);
    setTimeout(injectQuickUi, 1000);
    setTimeout(injectQuickUi, 1800);
    setTimeout(installQuickSave, 500);
    setTimeout(installQuickSave, 1200);
    setTimeout(installQuickSave, 2200);
  }
  document.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
})();
