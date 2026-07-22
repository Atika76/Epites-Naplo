// V183 - GPS-es projektinditas, mobil kamera, 30 mp-es videolimit es feltoltes elotti tomorites.
(function(){
  'use strict';
  if (window.__EPITESNAPLO_V183_MEDIA_GPS__) return;
  window.__EPITESNAPLO_V183_MEDIA_GPS__ = true;

  const MB = 1024 * 1024;
  const VIDEO_MAX_SECONDS = 30;
  const VIDEO_TARGET_WIDTH = 1280;
  const VIDEO_TARGET_HEIGHT = 720;
  const VIDEO_FPS = 24;
  const VIDEO_TARGET_BITRATE = 1200000;

  function q(id){ return document.getElementById(id); }
  function toast(message, type){
    if (typeof window.showToast === 'function') window.showToast(message, type || 'info');
    else console.log(message);
  }
  function fileKey(file){ return [file.name, file.size, file.lastModified, file.type].join('|'); }
  function isVideo(file){
    return !!file && (String(file.type || '').startsWith('video/') || /\.(mp4|m4v|mov|webm|3gp|3gpp|mpeg|mpg|avi)$/i.test(String(file.name || '')));
  }

  function setUploadStatus(message, type){
    try {
      if (typeof window.v32SetUploadStatus === 'function') return window.v32SetUploadStatus(message, type || 'info');
      let box = q('v32UploadStatus');
      if (!box) {
        const anchor = document.querySelector('.v183CameraActions') || q('detailVideos') || q('dailyFormCard');
        if (anchor?.parentNode) {
          box = document.createElement('div');
          box.id = 'v32UploadStatus';
          box.className = 'v32UploadStatus';
          anchor.parentNode.insertBefore(box, anchor.nextSibling);
        }
      }
      if (box) {
        box.className = 'v32UploadStatus ' + (type || 'info');
        box.innerHTML = message;
      }
    } catch (_) {}
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

  function appendFilesToInput(inputId, files){
    const input = q(inputId);
    const incoming = Array.from(files || []).filter(Boolean);
    if (!input || !incoming.length || typeof DataTransfer === 'undefined') return false;

    const existing = [];
    const projectBasket = window.v37FileBaskets && Array.isArray(window.v37FileBaskets[inputId]) ? window.v37FileBaskets[inputId] : [];
    const mainBasket = window.v37MainFileBaskets && Array.isArray(window.v37MainFileBaskets[inputId]) ? window.v37MainFileBaskets[inputId] : [];
    existing.push(...projectBasket, ...mainBasket, ...Array.from(input.files || []));

    const map = new Map();
    existing.concat(incoming).forEach(file => map.set(fileKey(file), file));

    const dt = new DataTransfer();
    Array.from(map.values()).forEach(file => dt.items.add(file));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function getBrowserLocation(){
    if (window.EpitesNaploAPI?.getBrowserLocation) return window.EpitesNaploAPI.getBrowserLocation();
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          captured_at: new Date().toISOString()
        }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
      );
    });
  }

  function gpsText(gps){
    if (!gps) return '';
    const accuracy = gps.accuracy ? ' - pontossag kb. ' + Math.round(gps.accuracy) + ' m' : '';
    return `${Number(gps.lat).toFixed(5)}, ${Number(gps.lon).toFixed(5)}${accuracy}`;
  }

  async function captureProjectGpsV183(){
    const status = q('v183ProjectGpsStatus');
    if (status) status.textContent = 'GPS hely lekérése...';
    const gps = await getBrowserLocation();
    if (!gps) {
      if (status) status.textContent = 'Nem jött GPS engedély. Kézzel is megadhatod a címet.';
      toast('GPS engedély nem érkezett.', 'error');
      return null;
    }
    const address = (q('v183ProjectAddress')?.value || '').trim();
    const payload = { gps, address, gpsText: gpsText(gps), capturedAt: new Date().toISOString() };
    try { localStorage.setItem('epitesnaplo_v183_last_project_gps', JSON.stringify(payload)); } catch (_) {}
    if (status) status.textContent = 'GPS mentésre előkészítve: ' + payload.gpsText;
    toast('GPS hely előkészítve az új projekthez.', 'ok');
    return payload;
  }

  function injectProjectCreateGps(){
    const projectName = q('projectName');
    if (!projectName || q('v183ProjectGpsBox')) return;
    const row = projectName.closest('.formRow') || projectName.parentElement;
    if (!row?.parentNode) return;
    const box = document.createElement('div');
    box.id = 'v183ProjectGpsBox';
    box.className = 'v183ProjectGpsBox';
    box.innerHTML = `
      <input id="v183ProjectAddress" type="text" placeholder="Munkahely címe, ha tudod - GPS-szel is kitölthető" />
      <button class="btn ghost" type="button" onclick="v183CaptureProjectGps()">Munkahely GPS alapján</button>
      <small id="v183ProjectGpsStatus" class="muted">Ha a munkaterületen vagy, a GPS helyet az új projekt első naplójához is eltesszük.</small>
    `;
    row.parentNode.insertBefore(box, row.nextSibling);
  }

  function installProjectSaveGpsHook(){
    const api = window.EpitesNaploAPI;
    if (!api || api.__v183ProjectGpsHook || typeof api.saveProject !== 'function') return false;
    api.__v183ProjectGpsHook = true;
    const oldSaveProject = api.saveProject.bind(api);
    api.saveProject = async function(project = {}){
      const result = await oldSaveProject(project);
      try {
        const raw = localStorage.getItem('epitesnaplo_v183_last_project_gps');
        const address = (q('v183ProjectAddress')?.value || '').trim();
        if ((raw || address) && result?.id) {
          const payload = raw ? JSON.parse(raw) : {};
          payload.address = address || payload.address || '';
          payload.projectName = project.name || result.name || '';
          payload.savedAt = new Date().toISOString();
          localStorage.setItem('epitesnaplo_v183_project_gps_' + result.id, JSON.stringify(payload));
          localStorage.removeItem('epitesnaplo_v183_last_project_gps');
        }
      } catch (_) {}
      return result;
    };
    return true;
  }

  async function applyPendingProjectGps(){
    const params = new URLSearchParams(location.search);
    const id = params.get('id') || window.detailState?.project?.id || '';
    if (!id) return;
    let payload = null;
    try { payload = JSON.parse(localStorage.getItem('epitesnaplo_v183_project_gps_' + id) || 'null'); } catch (_) {}
    if (!payload) return;
    const gpsValue = payload.gpsText || gpsText(payload.gps);
    const addressValue = payload.address || (gpsValue ? 'GPS munkahely: ' + gpsValue : '');
    if (gpsValue && q('detailGps') && !q('detailGps').value.trim()) q('detailGps').value = gpsValue;
    if (addressValue && q('detailWorkAddress') && !q('detailWorkAddress').value.trim()) q('detailWorkAddress').value = addressValue;
    if (q('weatherAutoText') && gpsValue && !q('weatherAutoText').value.trim()) q('weatherAutoText').value = 'Projekt indításakor rögzített GPS hely betöltve.';
  }

  async function startGpsDailyLogV183(){
    const form = q('dailyFormCard');
    form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (q('detailDate')) q('detailDate').value = new Date().toISOString().slice(0, 10);
    if (q('weatherAutoText')) q('weatherAutoText').value = 'GPS-es új napló előkészítése...';
    try {
      if (typeof window.fillWeatherAndGps === 'function') await window.fillWeatherAndGps();
      else if (typeof fillWeatherAndGps === 'function') await fillWeatherAndGps();
    } catch (_) {
      if (typeof window.captureGpsOnly === 'function') await window.captureGpsOnly();
    }
    q('detailNote')?.focus();
    toast('GPS-es új napló előkészítve. Írd be, mi készült ma.', 'ok');
  }

  function injectProjectCameraUi(){
    if (!q('dailyFormCard') || q('v183CameraActions')) return;
    const anchor = q('detailFiles') || document.querySelector('.videoUploadBox');
    if (!anchor?.parentNode) return;
    const actions = document.createElement('div');
    actions.id = 'v183CameraActions';
    actions.className = 'v183CameraActions';
    actions.innerHTML = `
      <button class="btn ghost" type="button" onclick="v183OpenPhotoCamera()">Fotó készítése kamerával</button>
      <button class="btn primary" type="button" onclick="v183OpenVideoCamera()">Videó készítése - max. 30 mp</button>
      <small class="muted">A sima fájlfeltöltés megmarad. A kamera gombok mobilon közvetlenül a telefon kameráját használják.</small>
      <input id="v183PhotoCaptureInput" class="hidden" type="file" accept="image/*" capture="environment" multiple />
    `;
    anchor.parentNode.insertBefore(actions, anchor.nextSibling);

    q('v183PhotoCaptureInput')?.addEventListener('change', event => {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;
      appendFilesToInput('detailFiles', files);
      event.target.value = '';
      toast(files.length + ' kamerás fotó hozzáadva.', 'ok');
    });

    const gpsButton = document.createElement('button');
    gpsButton.className = 'btn primary';
    gpsButton.type = 'button';
    gpsButton.textContent = 'Új napló GPS-szel';
    gpsButton.onclick = startGpsDailyLogV183;
    const gpsAnchor = q('autoWeatherGpsCheck') || q('weatherAutoText');
    gpsAnchor?.parentNode?.insertBefore(gpsButton, gpsAnchor.nextSibling);
  }

  function ensureRecorderModal(){
    let modal = q('v183RecorderModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v183RecorderModal';
    modal.className = 'modal hidden v183RecorderModal';
    modal.innerHTML = `
      <div class="modalContent v183RecorderCard">
        <button class="closeBtn" type="button" onclick="v183CloseVideoCamera()">x</button>
        <p class="badge">Mobil munkavideó</p>
        <h2>30 másodperces videó</h2>
        <video id="v183RecorderPreview" class="v183RecorderPreview" playsinline muted></video>
        <div class="v183RecorderControls">
          <div id="v183ProgressRing" class="v183ProgressRing" style="--p:0"><span id="v183ProgressText">30</span></div>
          <button id="v183RecordStartBtn" class="btn primary" type="button" onclick="v183StartRecording()">Felvétel indítása</button>
          <button id="v183RecordSaveBtn" class="btn ghost hidden" type="button" onclick="v183UseRecordedVideo()">Videó hozzáadása</button>
        </div>
        <small id="v183RecorderStatus" class="muted">A felvétel automatikusan megáll 30 másodpercnél, és feltöltés előtt kisebb webes méretre kerül.</small>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  const recorderState = { stream: null, recorder: null, chunks: [], file: null, startedAt: 0, timer: 0 };

  function stopTracks(){
    try { recorderState.stream?.getTracks?.().forEach(track => track.stop()); } catch (_) {}
    recorderState.stream = null;
  }

  async function openVideoCameraV183(){
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert('Ez a böngésző nem engedi a közvetlen kamerás videófelvételt. A sima videó fájlfeltöltés továbbra is használható.');
      return;
    }
    const modal = ensureRecorderModal();
    recorderState.file = null;
    recorderState.chunks = [];
    q('v183RecordStartBtn')?.classList.remove('hidden');
    q('v183RecordSaveBtn')?.classList.add('hidden');
    updateRecorderProgress(0);
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
      const preview = q('v183RecorderPreview');
      if (preview) {
        preview.srcObject = recorderState.stream;
        preview.muted = true;
        await preview.play().catch(() => {});
      }
      q('v183RecorderStatus').textContent = 'Kamera kész. Indíthatod a 30 mp-es felvételt.';
    } catch (err) {
      console.warn('V183 kamera hiba:', err);
      q('v183RecorderStatus').textContent = 'A kamera nem indult el. Ellenőrizd a böngésző engedélyt.';
      toast('Kamera engedély nem érkezett.', 'error');
    }
  }

  function updateRecorderProgress(elapsedMs){
    const percent = Math.min(100, (elapsedMs / (VIDEO_MAX_SECONDS * 1000)) * 100);
    const left = Math.max(0, VIDEO_MAX_SECONDS - Math.ceil(elapsedMs / 1000));
    const ring = q('v183ProgressRing');
    const text = q('v183ProgressText');
    if (ring) ring.style.setProperty('--p', percent.toFixed(1));
    if (text) text.textContent = String(left);
  }

  function startRecordingV183(){
    if (!recorderState.stream) return alert('Előbb engedélyezd a kamerát.');
    const type = preferredRecorderType();
    const startBtn = q('v183RecordStartBtn');
    if (startBtn) {
      startBtn.textContent = 'Felvétel leállítása';
      startBtn.onclick = stopRecordingV183;
    }
    recorderState.chunks = [];
    recorderState.file = null;
    recorderState.recorder = new MediaRecorder(recorderState.stream, {
      mimeType: type || undefined,
      videoBitsPerSecond: VIDEO_TARGET_BITRATE,
      audioBitsPerSecond: 64000
    });
    recorderState.recorder.ondataavailable = event => {
      if (event.data && event.data.size) recorderState.chunks.push(event.data);
    };
    recorderState.recorder.onstop = () => {
      const mime = type || 'video/webm';
      const blob = new Blob(recorderState.chunks, { type: mime });
      recorderState.file = new File([blob], 'munkavideo-30mp-' + Date.now() + '.webm', { type: mime, lastModified: Date.now() });
      if (startBtn) {
        startBtn.textContent = 'Felvétel indítása';
        startBtn.onclick = startRecordingV183;
        startBtn.classList.add('hidden');
      }
      q('v183RecordSaveBtn')?.classList.remove('hidden');
      q('v183RecorderStatus').textContent = 'Felvétel kész. Hozzáadhatod a napi bejegyzés videóihoz.';
      stopTracks();
    };
    recorderState.startedAt = Date.now();
    recorderState.recorder.start(1000);
    q('v183RecorderStatus').textContent = 'Felvétel folyamatban...';
    recorderState.timer = window.setInterval(() => {
      const elapsed = Date.now() - recorderState.startedAt;
      updateRecorderProgress(elapsed);
      if (elapsed >= VIDEO_MAX_SECONDS * 1000) stopRecordingV183();
    }, 150);
  }

  function stopRecordingV183(){
    window.clearInterval(recorderState.timer);
    updateRecorderProgress(VIDEO_MAX_SECONDS * 1000);
    try {
      if (recorderState.recorder && recorderState.recorder.state !== 'inactive') recorderState.recorder.stop();
    } catch (_) {}
  }

  function useRecordedVideoV183(){
    if (!recorderState.file) return alert('Még nincs hozzáadható videó.');
    appendFilesToInput('detailVideos', [recorderState.file]);
    closeVideoCameraV183();
    toast('30 mp-es kamerás videó hozzáadva.', 'ok');
  }

  function closeVideoCameraV183(){
    window.clearInterval(recorderState.timer);
    try {
      if (recorderState.recorder && recorderState.recorder.state !== 'inactive') recorderState.recorder.stop();
    } catch (_) {}
    stopTracks();
    const preview = q('v183RecorderPreview');
    if (preview) preview.srcObject = null;
    q('v183RecorderModal')?.classList.add('hidden');
  }

  function videoMetadata(file){
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.playsInline = true;
      video.muted = true;
      video.onloadedmetadata = () => {
        const data = {
          duration: Number(video.duration || 0),
          width: video.videoWidth || 0,
          height: video.videoHeight || 0
        };
        URL.revokeObjectURL(url);
        resolve(data);
      };
      video.onerror = () => { URL.revokeObjectURL(url); resolve({ duration: 0, width: 0, height: 0 }); };
      video.src = url;
    });
  }

  async function recompressVideoFirst30(file){
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
    const type = preferredRecorderType();
    if (!type) return null;
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    try {
      await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; });
      const duration = Math.min(Number(video.duration || VIDEO_MAX_SECONDS), VIDEO_MAX_SECONDS);
      const w = video.videoWidth || VIDEO_TARGET_WIDTH;
      const h = video.videoHeight || VIDEO_TARGET_HEIGHT;
      const scale = Math.min(1, VIDEO_TARGET_WIDTH / w, VIDEO_TARGET_HEIGHT / h);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, Math.round(w * scale));
      canvas.height = Math.max(2, Math.round(h * scale));
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(VIDEO_FPS);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: VIDEO_TARGET_BITRATE });
      recorder.ondataavailable = event => { if (event.data && event.data.size) chunks.push(event.data); };
      const done = new Promise(resolve => { recorder.onstop = resolve; });

      function draw(){
        if (video.paused || video.ended) return;
        try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); } catch (_) {}
        requestAnimationFrame(draw);
      }

      recorder.start(800);
      video.currentTime = 0;
      await video.play();
      draw();
      await new Promise(resolve => setTimeout(resolve, Math.max(1200, duration * 1000)));
      video.pause();
      if (recorder.state !== 'inactive') recorder.stop();
      await done;
      URL.revokeObjectURL(url);
      const blob = new Blob(chunks, { type });
      if (!blob.size) return null;
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-30mp-tomoritett.webm', { type, lastModified: Date.now() });
    } catch (err) {
      URL.revokeObjectURL(url);
      console.warn('V183 videó tömörítés hiba:', err);
      return null;
    }
  }

  async function prepareVideoFilesV183(fileList, max = 2){
    const files = Array.from(fileList || []).filter(isVideo).slice(0, max);
    const prepared = [];
    for (const file of files) {
      const meta = await videoMetadata(file);
      const needsWork = meta.duration > VIDEO_MAX_SECONDS + 0.5 || file.size > 12 * MB || !/webm/i.test(file.type || file.name || '');
      if (!needsWork) {
        prepared.push(file);
        continue;
      }
      setUploadStatus('<b>Videó előkészítése...</b><br>30 mp-re vágás és webes méretre tömörítés: ' + file.name, 'info');
      const optimized = await recompressVideoFirst30(file);
      if (optimized) {
        prepared.push(optimized);
        continue;
      }
      if (meta.duration > VIDEO_MAX_SECONDS + 0.5 || file.size > 45 * MB) {
        alert('Ez a videó túl nagy vagy hosszú, és ezen a böngészőn nem sikerült automatikusan 30 mp-re tömöríteni: ' + file.name);
      } else {
        prepared.push(file);
      }
    }
    return prepared;
  }

  function installVideoUploadWrappers(){
    if (window.__EPITESNAPLO_V183_VIDEO_WRAPPERS__) return;
    const oldUpload = window.uploadVideoFilesToStorage || (typeof uploadVideoFilesToStorage === 'function' ? uploadVideoFilesToStorage : null);
    const oldDirect = window.v180UploadDailyVideosDirect || (typeof v180UploadDailyVideosDirect === 'function' ? v180UploadDailyVideosDirect : null);
    if (!oldUpload && !oldDirect) return;
    window.__EPITESNAPLO_V183_VIDEO_WRAPPERS__ = true;

    if (oldUpload) {
      window.uploadVideoFilesToStorage = async function(fileList, max = 2){
        const prepared = await prepareVideoFilesV183(fileList, max);
        return oldUpload.call(this, prepared, max);
      };
      try { uploadVideoFilesToStorage = window.uploadVideoFilesToStorage; } catch (_) {}
    }

    if (oldDirect) {
      window.v180UploadDailyVideosDirect = async function(fileList, max = 2){
        const prepared = await prepareVideoFilesV183(fileList, max);
        return oldDirect.call(this, prepared, max);
      };
      try { v180UploadDailyVideosDirect = window.v180UploadDailyVideosDirect; } catch (_) {}
    }
  }

  window.v183CaptureProjectGps = captureProjectGpsV183;
  window.v183StartGpsDailyLog = startGpsDailyLogV183;
  window.v183OpenPhotoCamera = function(){ q('v183PhotoCaptureInput')?.click(); };
  window.v183OpenVideoCamera = openVideoCameraV183;
  window.v183StartRecording = startRecordingV183;
  window.v183CloseVideoCamera = closeVideoCameraV183;
  window.v183UseRecordedVideo = useRecordedVideoV183;
  window.v183PrepareVideoFiles = prepareVideoFilesV183;

  function boot(){
    injectProjectCreateGps();
    installProjectSaveGpsHook();
    injectProjectCameraUi();
    installVideoUploadWrappers();
    setTimeout(applyPendingProjectGps, 600);
    setTimeout(installProjectSaveGpsHook, 800);
    setTimeout(installVideoUploadWrappers, 900);
  }

  document.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
})();
