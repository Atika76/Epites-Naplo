(function(){
  if(window.__epnPermissionsV187) return;
  window.__epnPermissionsV187 = true;

  const STATUS = {
    granted: { label: 'Engedélyezve', cls: 'ok' },
    denied: { label: 'Blokkolva', cls: 'bad' },
    prompt: { label: 'Még nincs megkérdezve', cls: 'warn' },
    unsupported: { label: 'Nem támogatott', cls: 'bad' },
    unknown: { label: 'Ismeretlen', cls: 'warn' }
  };

  function byId(id){ return document.getElementById(id); }

  function toast(message){
    if(typeof window.showToast === 'function'){
      window.showToast(message);
      return;
    }
    const box = byId('toast');
    if(box){
      box.textContent = message;
      box.classList.remove('hidden');
      setTimeout(() => box.classList.add('hidden'), 3400);
      return;
    }
    console.log(message);
  }

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  function openNativeAppSettings(){
    toast('Ha blokkolva marad, nyisd meg a telefon beállításait: Alkalmazások / Építési Napló / Engedélyek.');
  }

  function setCard(key, state, detail){
    const card = byId('permissionCard-' + key);
    const pill = byId('permissionState-' + key);
    const text = byId('permissionDetail-' + key);
    const meta = STATUS[state] || STATUS.unknown;
    if(card){
      card.dataset.state = meta.cls;
      card.classList.remove('ok','warn','bad');
      card.classList.add(meta.cls);
    }
    if(pill){
      pill.className = 'permissionState ' + meta.cls;
      pill.textContent = meta.label;
    }
    if(text) text.textContent = detail || '';
  }

  async function queryPermission(name){
    if(!navigator.permissions || typeof navigator.permissions.query !== 'function') return 'unknown';
    try{
      const res = await navigator.permissions.query({ name });
      return res && res.state ? res.state : 'unknown';
    }catch(_){
      return 'unknown';
    }
  }

  async function refreshPermissionStatus(){
    if('Notification' in window){
      const permission = Notification.permission || 'default';
      if(permission === 'granted') setCard('notifications', 'granted', 'Az app küldhet helyi értesítéseket ezen az eszközön.');
      else if(permission === 'denied') setCard('notifications', 'denied', 'A böngésző vagy az Android blokkolja. Ezt csak az eszköz beállításaiban lehet visszaengedni.');
      else setCard('notifications', 'prompt', 'Még nincs engedélyezve. Nyomd meg az engedélyezés gombot.');
    }else{
      setCard('notifications', 'unsupported', 'Ez a böngésző nem támogatja a webes értesítéseket.');
    }

    const geo = navigator.geolocation ? await queryPermission('geolocation') : 'unsupported';
    if(geo === 'granted') setCard('gps', 'granted', 'A GPS/helyadat elérhető.');
    else if(geo === 'denied') setCard('gps', 'denied', 'A helyadat blokkolva van. Telefonon az app engedélyei között lehet visszakapcsolni.');
    else if(geo === 'prompt') setCard('gps', 'prompt', 'Még nincs engedélyezve. Kérd le egyszer gombnyomással.');
    else if(geo === 'unsupported') setCard('gps', 'unsupported', 'Ez az eszköz vagy böngésző nem ad GPS hozzáférést.');
    else setCard('gps', 'unknown', 'A böngésző nem ad pontos állapotot. A próba gomb megmutatja, működik-e.');

    const hasMedia = !!navigator.mediaDevices?.getUserMedia;
    const camera = hasMedia ? await queryPermission('camera') : 'unsupported';
    const mic = hasMedia ? await queryPermission('microphone') : 'unsupported';
    if(camera === 'granted' && mic === 'granted') setCard('camera', 'granted', 'A kamera és a mikrofon elérhető a rövid munkavideókhoz.');
    else if(camera === 'denied' || mic === 'denied') setCard('camera', 'denied', 'A kamera vagy mikrofon blokkolva van. Ezt az eszköz/app beállításaiban kell engedélyezni.');
    else if(camera === 'unsupported' || mic === 'unsupported') setCard('camera', 'unsupported', 'Ez a böngésző nem támogatja a kamerát vagy mikrofont.');
    else setCard('camera', 'prompt', 'Még nincs biztos engedély. Gombnyomással lehet kérni.');

    localStorage.setItem('epitesnaplo_permission_status_checked_at', new Date().toISOString());
  }

  async function requestNotificationPermission(){
    if(!('Notification' in window)){
      setCard('notifications', 'unsupported', 'Ez a böngésző nem támogatja a webes értesítéseket.');
      return;
    }
    if(Notification.permission === 'denied'){
      setCard('notifications', 'denied', 'Már blokkolva van. Nyisd meg a böngésző vagy az app beállításait, és ott engedélyezd.');
      openNativeAppSettings();
      return;
    }
    try{
      const result = await Notification.requestPermission();
      if(result === 'granted'){
        setCard('notifications', 'granted', 'Kész, az értesítés engedélyezve van.');
        toast('Értesítés engedélyezve.');
      }else if(result === 'denied'){
        setCard('notifications', 'denied', 'Az értesítés blokkolva lett. Beállításokban tudod visszaengedni.');
      }else{
        setCard('notifications', 'prompt', 'Most nem lett engedélyezve. Később újra megpróbálhatod.');
      }
    }catch(err){
      setCard('notifications', 'unknown', 'Nem sikerült kérni: ' + friendlyError(err));
    }
  }

  function friendlyError(err){
    const name = err && err.name ? err.name : '';
    if(name === 'NotAllowedError' || name === 'SecurityError') return 'az engedély blokkolva vagy nem biztonságos kapcsolat.';
    if(name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'nem talált kamerát vagy mikrofont.';
    if(name === 'NotReadableError') return 'a kamera vagy mikrofon másik alkalmazásban foglalt.';
    if(name === 'AbortError') return 'az eszköz megszakította a műveletet.';
    return (err && err.message) ? err.message : 'ismeretlen hiba.';
  }

  async function requestCameraMicPermission(){
    if(!navigator.mediaDevices?.getUserMedia){
      setCard('camera', 'unsupported', 'Ez a böngésző nem támogatja a kamera/mikrofon kérést.');
      return;
    }
    try{
      setCard('camera', 'prompt', 'Engedélykérés folyamatban...');
      const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
      stream.getTracks().forEach(track => track.stop());
      setCard('camera', 'granted', 'Kész, a kamera és mikrofon engedélyezve van.');
      toast('Kamera és mikrofon engedélyezve.');
    }catch(err){
      setCard('camera', 'denied', 'Nem sikerült elérni: ' + friendlyError(err));
      openNativeAppSettings();
    }
  }

  async function requestGpsPermission(){
    if(!navigator.geolocation){
      setCard('gps', 'unsupported', 'Ez az eszköz vagy böngésző nem ad GPS hozzáférést.');
      return;
    }
    setCard('gps', 'prompt', 'GPS engedélykérés folyamatban...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const acc = Math.round(pos.coords.accuracy || 0);
        const lat = Number(pos.coords.latitude || 0).toFixed(5);
        const lon = Number(pos.coords.longitude || 0).toFixed(5);
        setCard('gps', 'granted', `Kész, GPS működik. Pontosság: kb. ${acc} m. Koordináta: ${lat}, ${lon}.`);
        toast('GPS/helyadat engedélyezve.');
      },
      (err) => {
        let msg = 'Nem sikerült lekérni a helyadatot.';
        if(err && err.code === err.PERMISSION_DENIED) msg = 'A GPS/helyadat blokkolva van. Beállításokban kell engedélyezni.';
        if(err && err.code === err.POSITION_UNAVAILABLE) msg = 'A telefon most nem tud pontos helyadatot adni.';
        if(err && err.code === err.TIMEOUT) msg = 'A GPS keresés túl sokáig tartott. Próbáld meg szabad ég alatt.';
        setCard('gps', err && err.code === err.PERMISSION_DENIED ? 'denied' : 'unknown', msg);
        if(err && err.code === err.PERMISSION_DENIED) openNativeAppSettings();
      },
      { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
    );
  }

  function ensureModal(){
    if(byId('permissionSettingsModal')) return;
    const modal = document.createElement('div');
    modal.id = 'permissionSettingsModal';
    modal.className = 'modal hidden permissionSettingsModal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','permissionSettingsTitle');
    modal.innerHTML = `
      <div class="modalContent permissionSettingsContent">
        <button class="closeBtn" type="button" onclick="window.closePermissionSettingsV187()" aria-label="Bezárás">×</button>
        <p class="badge">Beállítások</p>
        <h2 id="permissionSettingsTitle">Engedélyek</h2>
        <p class="muted">Itt tudod ellenőrizni és kérni azokat az engedélyeket, amik a gyors mobilos naplózáshoz kellenek.</p>
        <div class="permissionGrid">
          <section id="permissionCard-notifications" class="permissionCard warn">
            <div class="permissionCardHead"><h3>Értesítések</h3><span id="permissionState-notifications" class="permissionState warn">Ellenőrzés...</span></div>
            <p id="permissionDetail-notifications">Állapot ellenőrzése folyamatban.</p>
            <button class="btn primary full" type="button" onclick="window.requestNotificationPermissionV187()">Értesítés engedélyezése</button>
          </section>
          <section id="permissionCard-camera" class="permissionCard warn">
            <div class="permissionCardHead"><h3>Kamera és mikrofon</h3><span id="permissionState-camera" class="permissionState warn">Ellenőrzés...</span></div>
            <p id="permissionDetail-camera">Állapot ellenőrzése folyamatban.</p>
            <button class="btn primary full" type="button" onclick="window.requestCameraMicPermissionV187()">Kamera/video engedélyezése</button>
          </section>
          <section id="permissionCard-gps" class="permissionCard warn">
            <div class="permissionCardHead"><h3>GPS/helyadat</h3><span id="permissionState-gps" class="permissionState warn">Ellenőrzés...</span></div>
            <p id="permissionDetail-gps">Állapot ellenőrzése folyamatban.</p>
            <button class="btn primary full" type="button" onclick="window.requestGpsPermissionV187()">GPS engedélyezése</button>
          </section>
        </div>
        <div class="permissionHelp">
          <b>Ha valami blokkolva marad:</b>
          <span>Telefonon: Beállítások / Alkalmazások / Építési Napló / Engedélyek. Böngészőben: lakat ikon / Webhelybeállítások.</span>
        </div>
        <button class="btn ghost full" type="button" onclick="window.refreshPermissionStatusV187()">Állapot frissítése</button>
      </div>
    `;
    modal.addEventListener('click', (event) => {
      if(event.target === modal) closePermissionSettings();
    });
    document.body.appendChild(modal);
  }

  function openPermissionSettings(){
    ensureModal();
    const modal = byId('permissionSettingsModal');
    if(modal) modal.classList.remove('hidden');
    refreshPermissionStatus();
  }

  function closePermissionSettings(){
    const modal = byId('permissionSettingsModal');
    if(modal) modal.classList.add('hidden');
  }

  window.openPermissionSettingsV187 = openPermissionSettings;
  window.closePermissionSettingsV187 = closePermissionSettings;
  window.refreshPermissionStatusV187 = refreshPermissionStatus;
  window.requestNotificationPermissionV187 = requestNotificationPermission;
  window.requestCameraMicPermissionV187 = requestCameraMicPermission;
  window.requestGpsPermissionV187 = requestGpsPermission;

  ready(function(){
    ensureModal();
    setTimeout(refreshPermissionStatus, 300);
  });
})();
