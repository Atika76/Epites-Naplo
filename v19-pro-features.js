// ÉpítésNapló AI PRO v19 – projekt státusz, jóváhagyás, időjárás, anyag, számla
(function(){
  const api = window.EpitesNaploAPI;
  const db = window.supabaseDirect;
  if(!api || !db) return;

  function weatherCodeText(code){
    const n = Number(code);
    if([0].includes(n)) return 'derült';
    if([1,2,3].includes(n)) return 'felhős';
    if([45,48].includes(n)) return 'köd';
    if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(n)) return 'eső';
    if([71,73,75,77,85,86].includes(n)) return 'hó';
    if([95,96,99].includes(n)) return 'zivatar';
    return 'ismeretlen';
  }

  api.getBrowserLocation = function(){
    return new Promise(resolve => {
      if(!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, captured_at: new Date().toISOString() }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 15*60*1000 }
      );
    });
  };

  api.getWeatherForLocation = async function(lat, lon){
    if(!lat || !lon) return null;
    try{
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&timezone=auto`;
      const res = await fetch(url);
      const json = await res.json();
      const c = json.current || {};
      return { temperature: c.temperature_2m ?? null, precipitation: c.precipitation ?? null, wind: c.wind_speed_10m ?? null, code: c.weather_code ?? null, text: weatherCodeText(c.weather_code), captured_at: new Date().toISOString(), source: 'Open-Meteo' };
    }catch(e){ console.warn('Időjárás lekérés hiba:', e); return null; }
  };

  const oldSaveEntry = api.saveEntry ? api.saveEntry.bind(api) : null;
  api.saveEntry = async function(entry){
    const user = await this.getCurrentUser();
    if(!user) return entry;
    const images = Array.isArray(entry.images) ? entry.images : (entry.image ? [entry.image] : []);
    const base = { user_id:user.id, project_id:entry.projectId, phase:entry.phase, status:entry.status, priority:entry.priority, responsible:entry.responsible, weather:entry.weather, note:entry.note, image_url:images[0]||null, ai_level:entry.analysis?.level||null, ai_score:entry.analysis?.score||null, ai_title:entry.analysis?.title||null, ai_advice:entry.analysis?.advice||[] };
    const full = { ...base, image_urls:images, before_images_json:entry.beforeImages||[], after_images_json:entry.afterImages||[], general_images_json:entry.generalImages||[], ai_json:entry.analysis||null, weather_json:entry.weatherJson||null, gps_json:entry.gpsJson||null, materials_json:entry.materials||[] };
    let result = await db.from('entries').insert(full).select().single();
    if(result.error && /weather_json|gps_json|materials_json|image_urls|ai_json|column/i.test(String(result.error.message||''))){
      result = await db.from('entries').insert({...base, image_urls:images, ai_json:entry.analysis||null}).select().single();
      if(result.error && /image_urls|ai_json|column/i.test(String(result.error.message||''))){ result = await db.from('entries').insert(base).select().single(); }
    }
    if(result.error){ if(oldSaveEntry) return oldSaveEntry(entry); alert('Napló mentési hiba: '+result.error.message); return entry; }
    if(Array.isArray(entry.materials) && entry.materials.length){ try{ await this.saveProjectMaterials(entry.projectId, result.data.id, entry.materials); }catch(e){ console.warn(e); } }
    return result.data;
  };

  api.updateProjectStatus = async function(projectId, {status, progress}){
    const user = await this.getCurrentUser();
    if(!user) throw new Error('Nincs bejelentkezve.');
    const patch = { status: status || 'folyamatban', progress: Number(progress || 0), updated_at: new Date().toISOString() };
    let { data, error } = await db.from('projects').update(patch).eq('id', projectId).eq('user_id', user.id).select().single();
    if(error && /status|progress|updated_at|column/i.test(String(error.message||''))){
      const r = await db.from('projects').update({ status: status || 'folyamatban' }).eq('id', projectId).eq('user_id', user.id).select().single();
      data = r.data; error = r.error;
    }
    if(error) throw error;
    return data;
  };

  api.saveProjectMaterials = async function(projectId, entryId, materials){
    const user = await this.getCurrentUser();
    if(!user || !Array.isArray(materials) || !materials.length) return false;
    const rows = materials.filter(m => m && m.name).map(m => ({ user_id:user.id, project_id:projectId, entry_id:entryId||null, name:m.name, quantity:Number(m.quantity||0), unit:m.unit||'db', note:m.note||'' }));
    if(!rows.length) return false;
    const { error } = await db.from('project_materials').insert(rows);
    if(error){ console.warn('Anyag mentési hiba:', error.message); return false; }
    return true;
  };

  api.getProjectMaterials = async function(projectId){
    const user = await this.getCurrentUser();
    if(!user) return [];
    const { data, error } = await db.from('project_materials').select('*').eq('project_id', projectId).eq('user_id', user.id).order('created_at',{ascending:false});
    if(error){ console.warn('Anyaglista betöltési hiba:', error.message); return []; }
    return data || [];
  };

  api.saveProjectInvoice = async function(projectId, invoice){
    const user = await this.getCurrentUser();
    if(!user) throw new Error('Nincs bejelentkezve.');
    const row = { user_id:user.id, project_id:projectId, title:invoice.title||'Számla / bizonylat', amount:Number(invoice.amount||0), note:invoice.note||'', file_name:invoice.fileName||'', file_type:invoice.fileType||'', file_data:invoice.fileData||null };
    if(invoice.id){
      const patch = { title:row.title, amount:row.amount, note:row.note };
      if(row.file_data){ patch.file_name=row.file_name; patch.file_type=row.file_type; patch.file_data=row.file_data; }
      const { data, error } = await db.from('project_invoices').update(patch).eq('id', invoice.id).eq('project_id', projectId).eq('user_id', user.id).select().single();
      if(error){ alert('Számla módosítási hiba: '+error.message); throw error; }
      return data;
    }
    const { data, error } = await db.from('project_invoices').insert(row).select().single();
    if(error){ alert('Számla mentési hiba: '+error.message); throw error; }
    return data;
  };

  api.deleteProjectInvoice = async function(projectId, invoiceId){
    const user = await this.getCurrentUser();
    if(!user) throw new Error('Nincs bejelentkezve.');
    const { error } = await db.from('project_invoices').delete().eq('id', invoiceId).eq('project_id', projectId).eq('user_id', user.id);
    if(error){ alert('Számla törlési hiba: '+error.message); throw error; }
    return true;
  };

  api.getProjectInvoices = async function(projectId){
    const user = await this.getCurrentUser();
    if(!user) return [];
    const { data, error } = await db.from('project_invoices').select('*').eq('project_id', projectId).eq('user_id', user.id).order('created_at',{ascending:false});
    if(error){ console.warn('Számla lista hiba:', error.message); return []; }
    return data || [];
  };

  api.approvePublicReport = async function(token, approval){
    if(!token) throw new Error('Hiányzó riport token.');
    const payload = {
      p_token: token,
      p_client_name: approval?.name || '',
      p_client_email: approval?.email || '',
      p_decision: approval?.decision || 'accepted',
      p_message: approval?.clientComment || approval?.message || '',
      p_user_agent: navigator.userAgent || '',
      p_approved_report_html: approval?.reportHtml || '',
      p_approved_report_text: approval?.reportText || ''
    };

    // V92: először az új, teljes mentő RPC-t használja. Ha a Supabase cache még nem látja,
    // visszaesik a régi stabil mentésre, majd külön rámenti az ügyfél kérdését.
    let data = null;
    let error = null;
    try{
      ({ data, error } = await db.rpc('approve_public_report_v92', payload));
    }catch(e){ error = e; }

    const errText = String(error?.message || error || '');
    if(error && /function .* does not exist|schema cache|Could not find/i.test(errText)){
      try{
        ({ data, error } = await db.rpc('approve_public_report_by_token', {
          p_token: token,
          p_client_name: payload.p_client_name,
          p_client_email: payload.p_client_email,
          p_user_agent: payload.p_user_agent
        }));
      }catch(e){ error = e; }
    }

    if(error && /function .* does not exist|schema cache|Could not find/i.test(String(error?.message || error || ''))){
      try{
        ({ data, error } = await db.rpc('approve_public_report_v71', payload));
      }catch(e){ error = e; }
    }

    if(error) throw error;

    try{
      await db.rpc('patch_report_approval_comment_v92', payload);
    }catch(e){
      console.warn('V92 ügyfél kérdés / saját példány utómentés hiba:', e?.message || e);
    }
    return data;
  };


  api.getProjectCloseData = async function(projectId){
    const [entries, materials, invoices] = await Promise.all([
      this.getEntries().then(items => items.filter(e => String(e.project_id || e.projectId) === String(projectId))),
      this.getProjectMaterials(projectId),
      this.getProjectInvoices(projectId)
    ]);
    return { entries, materials, invoices };
  };
})();
