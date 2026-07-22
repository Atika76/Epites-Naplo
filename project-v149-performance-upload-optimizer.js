// V149 - Supabase gyorsítás + kép/videó feltöltés optimalizálás
// Csak ráépülő javítás: nem írja felül a riport/képnéző logikát.
(function(){
  'use strict';
  if (window.__EPITESNAPLO_V149_OPTIMIZER__) return;
  window.__EPITESNAPLO_V149_OPTIMIZER__ = true;

  const MB = 1024 * 1024;
  const IMAGE_MAX_SIDE = 1000;
  const IMAGE_QUALITY = 0.58;
  const IMAGE_STRONG_QUALITY = 0.48;
  const VIDEO_DIRECT_MB = 18;     // ez alatt közvetlen feltöltés
  const VIDEO_MAX_UPLOAD_MB = 45;  // efölött csak sikeres böngészős tömörítés után mehet
  const VIDEO_MAX_SECONDS = 30;
  const VIDEO_TARGET_WIDTH = 960;
  const VIDEO_TARGET_HEIGHT = 540;
  const VIDEO_FPS = 24;

  const cache = window.__EPITESNAPLO_FAST_CACHE__ || (window.__EPITESNAPLO_FAST_CACHE__ = new Map());
  function cacheGet(key, ttlMs){
    try{
      const item = cache.get(key);
      if(!item || (Date.now() - item.t) > ttlMs) return null;
      return item.v;
    }catch(_){ return null; }
  }
  function cacheSet(key, value){ try{ cache.set(key, { t: Date.now(), v: value }); }catch(_){} return value; }
  function cacheDelPrefix(prefix){
    try{ [...cache.keys()].forEach(k => { if(String(k).startsWith(prefix)) cache.delete(k); }); }catch(_){}
  }
  window.epitesNaploClearFastCache = function(){ try{ cache.clear(); }catch(_){} };

  function toDataUrl(file){
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
  function dataUrlBytes(dataUrl){
    const s = String(dataUrl || '');
    const comma = s.indexOf(',');
    const b64 = comma >= 0 ? s.slice(comma + 1) : s;
    return Math.round((b64.length * 3) / 4);
  }
  async function imageFromDataUrl(src){
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    try{ await img.decode(); }catch(_){ await new Promise((res, rej)=>{ img.onload=res; img.onerror=rej; }); }
    return img;
  }

  async function compressImageFileV149(file, maxSide = IMAGE_MAX_SIDE, quality = IMAGE_QUALITY){
    if(!String(file?.type || '').startsWith('image/')) return '';
    const original = await toDataUrl(file);
    if(!original) return '';
    try{
      const img = await imageFromDataUrl(original);
      let q = file.size > 3 * MB ? IMAGE_STRONG_QUALITY : quality;
      let side = file.size > 3 * MB ? 850 : maxSide;
      const scale = Math.min(1, side / Math.max(img.width || 1, img.height || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
      canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      if(!ctx) return original;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let compressed = canvas.toDataURL('image/jpeg', q);
      // Extra védelem: ha még mindig nagy, menjünk lejjebb.
      if(dataUrlBytes(compressed) > 850 * 1024 && Math.max(canvas.width, canvas.height) > 720){
        const ratio = 720 / Math.max(canvas.width, canvas.height);
        const c2 = document.createElement('canvas');
        c2.width = Math.max(1, Math.round(canvas.width * ratio));
        c2.height = Math.max(1, Math.round(canvas.height * ratio));
        const x2 = c2.getContext('2d', { alpha:false });
        x2.fillStyle = '#ffffff';
        x2.fillRect(0,0,c2.width,c2.height);
        x2.drawImage(canvas,0,0,c2.width,c2.height);
        compressed = c2.toDataURL('image/jpeg', 0.48);
      }
      return compressed && compressed.length < original.length ? compressed : original;
    }catch(err){
      console.warn('V149 képtömörítés hiba, eredeti kép használata:', err);
      return original;
    }
  }

  window.compressImageFile = compressImageFileV149;
  window.readFilesAsDataUrls = function(fileList, max = 10){
    const files = Array.from(fileList || []).filter(file => String(file.type || '').startsWith('image/')).slice(0, max);
    return Promise.all(files.map(file => compressImageFileV149(file))).then(items => items.filter(Boolean));
  };

  function canRecordVideo(){
    return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
  }
  function preferredRecorderType(){
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }

  async function compressVideoFileV149(file){
    if(!file || !String(file.type || '').startsWith('video/')) return file;
    if(file.size <= VIDEO_DIRECT_MB * MB) return file;
    if(!canRecordVideo()){
      // iPhone Safari alatt ez előfordulhat. Ilyenkor nem hazudunk tömörítést.
      if(file.size > VIDEO_MAX_UPLOAD_MB * MB){
        alert(`Ez a videó túl nagy és ezen a böngészőn nem tömöríthető automatikusan: ${file.name}\nKérlek vágd 10–30 mp-re vagy küldd kisebb méretben.`);
        return null;
      }
      return file;
    }
    const recType = preferredRecorderType();
    if(!recType) return file.size <= VIDEO_MAX_UPLOAD_MB * MB ? file : null;

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;

    try{
      await new Promise((resolve, reject)=>{ video.onloadedmetadata = resolve; video.onerror = reject; });
      const duration = Math.min(Number(video.duration || VIDEO_MAX_SECONDS), VIDEO_MAX_SECONDS);
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const scale = Math.min(1, VIDEO_TARGET_WIDTH / w, VIDEO_TARGET_HEIGHT / h);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, Math.round(w * scale));
      canvas.height = Math.max(2, Math.round(h * scale));
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(VIDEO_FPS);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: recType, videoBitsPerSecond: 900000 });
      recorder.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
      const done = new Promise(resolve => { recorder.onstop = resolve; });

      function draw(){
        if(video.paused || video.ended) return;
        try{ ctx.drawImage(video, 0, 0, canvas.width, canvas.height); }catch(_){ }
        requestAnimationFrame(draw);
      }
      recorder.start(750);
      video.currentTime = 0;
      await video.play();
      draw();
      await new Promise(resolve => setTimeout(resolve, Math.max(1200, duration * 1000)));
      video.pause();
      if(recorder.state !== 'inactive') recorder.stop();
      await done;
      const blob = new Blob(chunks, { type: 'video/webm' });
      URL.revokeObjectURL(url);
      if(blob.size && blob.size < file.size){
        const name = file.name.replace(/\.[^.]+$/, '') + '-tomoritett.webm';
        return new File([blob], name, { type: 'video/webm', lastModified: Date.now() });
      }
      return file.size <= VIDEO_MAX_UPLOAD_MB * MB ? file : null;
    }catch(err){
      URL.revokeObjectURL(url);
      console.warn('V149 videó tömörítés hiba:', err);
      return file.size <= VIDEO_MAX_UPLOAD_MB * MB ? file : null;
    }
  }

  window.uploadVideoFilesToStorage = async function(fileList, max = 2){
    const files = Array.from(fileList || []).slice(0, max);
    if(!files.length) return [];
    const client = window.supabaseDirect;
    if(!client){ alert('Videó feltöltés nem érhető el: Supabase kapcsolat nem található.'); return []; }
    const uploaded = [];
    for(let i = 0; i < files.length; i++){
      const original = files[i];
      if(!original || !(String(original.type || '').startsWith('video/') || /\.(mp4|m4v|mov|webm|3gp|3gpp|mpeg|mpg|avi)$/i.test(String(original.name || '')))){ alert(`Ez nem videófájl, kihagyva: ${original?.name || ''}`); continue; }
      const optimized = await compressVideoFileV149(original);
      if(!optimized){ alert(`A videó kimaradt, mert túl nagy volt vagy nem sikerült tömöríteni: ${original.name}`); continue; }
      if(optimized.size > VIDEO_MAX_UPLOAD_MB * MB){ alert(`Túl nagy videó kimarad: ${optimized.name}\nMaximum kb. ${VIDEO_MAX_UPLOAD_MB} MB / videó.`); continue; }
      const ext = (optimized.name.split('.').pop() || 'webm').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webm';
      const safeName = optimized.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(-80) || `video.${ext}`;
      let userId = (window.detailState?.user?.id) || (typeof detailState !== 'undefined' ? detailState?.user?.id : '') || '';
      if(!userId){
        try{
          const authResult = await client.auth.getUser();
          userId = authResult?.data?.user?.id || '';
        }catch(_){}
      }
      const projectId = (window.detailState?.project?.id) || (typeof detailState !== 'undefined' ? detailState?.project?.id : '') || new URLSearchParams(location.search).get('id') || 'project';
      if(!userId){
        alert('Videó feltöltés nem érhető el: nem találom a bejelentkezett felhasználó azonosítóját. Jelentkezz ki és be újra.');
        continue;
      }
      const storagePath = `${userId}/${projectId}/${Date.now()}-${i}-${safeName}`;
      const contentType = optimized.type || (typeof videoContentType === 'function' ? videoContentType(optimized) : (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4')); 
      const { error } = await client.storage.from('project-videos').upload(storagePath, optimized, {
        cacheControl: '604800',
        upsert: false,
        contentType
      });
      if(error){
        console.warn('Videó feltöltési probléma:', error);
        alert('Videó feltöltési probléma: ' + (error.message || error));
        continue;
      }
      const signed = await getSignedVideoUrl(storagePath, 3600);
      uploaded.push({
        path: storagePath,
        src: signed || '',
        name: original.name,
        type: contentType,
        size: optimized.size,
        originalSize: original.size,
        compressed: optimized.size < original.size,
        private: true
      });
    }
    return uploaded;
  };

  async function getSignedVideoUrl(path, seconds = 3600){
    const client = window.supabaseDirect;
    if(!client || !path) return '';
    const key = `v149_signed_video_${path}`;
    try{
      const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
      if(cached?.url && cached?.exp > Date.now() + 60000) return cached.url;
    }catch(_){}
    const { data, error } = await client.storage.from('project-videos').createSignedUrl(path, seconds);
    if(!error && data?.signedUrl){
      try{ sessionStorage.setItem(key, JSON.stringify({ url: data.signedUrl, exp: Date.now() + (seconds - 120) * 1000 })); }catch(_){}
      return data.signedUrl;
    }
    return '';
  }

  window.hydratePrivateVideoUrls = async function(entries){
    if(!Array.isArray(entries)) return entries || [];
    await Promise.all(entries.map(async entry => {
      const videos = (typeof window.getEntryVideos === 'function') ? window.getEntryVideos(entry) : (entry?.videos || entry?.videoUrls || entry?.video_urls || []);
      await Promise.all((videos || []).map(async video => {
        if(!video || typeof video !== 'object' || !video.path) return;
        const url = await getSignedVideoUrl(video.path, 3600);
        if(url) video.src = url;
      }));
    }));
    return entries;
  };

  function normalizeEntry(entry){
    return {
      ...entry,
      projectId: entry.project_id,
      image: entry.image_url,
      images: Array.isArray(entry.image_urls) ? entry.image_urls : (entry.image_url ? [entry.image_url] : []),
      beforeImages: Array.isArray(entry.before_images_json) ? entry.before_images_json : (Array.isArray(entry.ai_json?.beforeImages) ? entry.ai_json.beforeImages : []),
      afterImages: Array.isArray(entry.after_images_json) ? entry.after_images_json : (Array.isArray(entry.ai_json?.afterImages) ? entry.ai_json.afterImages : []),
      generalImages: Array.isArray(entry.general_images_json) ? entry.general_images_json : (Array.isArray(entry.ai_json?.generalImages) ? entry.ai_json.generalImages : []),
      videos: Array.isArray(entry.video_urls) ? entry.video_urls : (Array.isArray(entry.ai_json?.videos) ? entry.ai_json.videos : []),
      videoUrls: Array.isArray(entry.video_urls) ? entry.video_urls : (Array.isArray(entry.ai_json?.videoUrls) ? entry.ai_json.videoUrls : []),
      analysis: entry.ai_json || {
        level: entry.ai_level || 'Alacsony',
        score: entry.ai_score || 0,
        title: entry.ai_title || 'Elemzés',
        advice: Array.isArray(entry.ai_advice) ? entry.ai_advice : [],
        repairs: [],
        materials: []
      }
    };
  }

  const api = window.EpitesNaploAPI;
  if(api && !api.__v149PerformancePatched){
    api.__v149PerformancePatched = true;
    const oldGetProjects = api.getProjects?.bind(api);
    const oldGetEntries = api.getEntries?.bind(api);
    const oldSaveEntry = api.saveEntry?.bind(api);
    const oldSaveProject = api.saveProject?.bind(api);
    const oldUpdateProject = api.updateProject?.bind(api);
    const oldDeleteProject = api.deleteProject?.bind(api);
    const oldGetProjectCloseData = api.getProjectCloseData?.bind(api);

    api.getProjects = async function(){
      const user = await this.getCurrentUser();
      if(!user) return [];
      const key = `projects_${user.id}`;
      const c = cacheGet(key, 20000);
      if(c) return c;
      const data = oldGetProjects ? await oldGetProjects() : [];
      return cacheSet(key, data || []);
    };

    api.getProjectEntries = async function(projectId){
      const user = await this.getCurrentUser();
      if(!user || !projectId) return [];
      const key = `entries_${user.id}_${projectId}`;
      const c = cacheGet(key, 12000);
      if(c) return c;
      const db = window.supabaseDirect;
      let result = null;
      try{
        result = await db.from('entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('project_id', projectId)
          .order('created_at', { ascending:false });
      }catch(e){ console.warn('V149 projekt bejegyzések lekérés hiba:', e); }
      if(result?.error){ console.warn('V149 projekt bejegyzések hiba:', result.error); return []; }
      const rows = (result?.data || []).map(normalizeEntry);
      return cacheSet(key, rows);
    };

    api.getEntries = async function(){
      const user = await this.getCurrentUser();
      if(!user) return [];
      const key = `entries_all_${user.id}`;
      const c = cacheGet(key, 10000);
      if(c) return c;
      const data = oldGetEntries ? await oldGetEntries() : [];
      return cacheSet(key, data || []);
    };

    if(oldGetProjectCloseData){
      api.getProjectCloseData = async function(projectId){
        const user = await this.getCurrentUser();
        const key = user && projectId ? `close_${user.id}_${projectId}` : '';
        const c = key ? cacheGet(key, 8000) : null;
        if(c) return c;
        let entries = [];
        try{ entries = await this.getProjectEntries(projectId); }catch(_){ entries = []; }
        const [materials, invoices] = await Promise.all([
          this.getProjectMaterials ? this.getProjectMaterials(projectId) : [],
          this.getProjectInvoices ? this.getProjectInvoices(projectId) : []
        ]);
        const data = { entries, materials, invoices };
        return key ? cacheSet(key, data) : data;
      };
    }

    api.saveEntry = async function(entry){
      const result = await oldSaveEntry(entry);
      const pid = entry?.projectId || entry?.project_id || result?.project_id || result?.projectId;
      cacheDelPrefix('entries_'); cacheDelPrefix('close_');
      if(pid) cacheDelPrefix(`entries_`);
      return result;
    };
    api.saveProject = async function(project){ const r = await oldSaveProject(project); cacheDelPrefix('projects_'); return r; };
    api.updateProject = async function(projectId, name){ const r = await oldUpdateProject(projectId, name); cacheDelPrefix('projects_'); return r; };
    api.deleteProject = async function(projectId){ const r = await oldDeleteProject(projectId); cacheDelPrefix('projects_'); cacheDelPrefix('entries_'); cacheDelPrefix('close_'); return r; };
  }

  // Projektoldali gyorsítás: ne töltse le minden projekt összes bejegyzését, ha csak egy projektet nézünk.
  window.epitesNaploReloadProjectEntriesFastV149 = async function(){
    if(!window.EpitesNaploAPI?.getProjectEntries || !window.detailState) return false;
    const id = (typeof window.getProjectId === 'function') ? window.getProjectId() : new URLSearchParams(location.search).get('id');
    if(!id) return false;
    const entries = await window.EpitesNaploAPI.getProjectEntries(id);
    window.detailState.entries = entries || [];
    if(typeof window.hydratePrivateVideoUrls === 'function') await window.hydratePrivateVideoUrls(window.detailState.entries);
    if(typeof window.renderProjectSummary === 'function') window.renderProjectSummary();
    if(typeof window.renderProjectTimeline === 'function') window.renderProjectTimeline();
    return true;
  };

  console.info('V149 optimalizáló betöltve: kép/videó tömörítés + Supabase gyorsítás.');
})();
