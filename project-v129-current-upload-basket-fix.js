// V129 - Aktuális napi fotók javítása
// Cél: új napi bejegyzés után a feltöltési kosár biztosan ürüljön,
// hogy a következő bejegyzés ne vigye magával az előző nap fotóit.
(function(){
  const UPLOAD_IDS = ['beforeFiles','afterFiles','detailFiles','detailVideos'];

  function byId(id){ return document.getElementById(id); }

  function safeEsc(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function setUploadStatus(message, type){
    try{
      let box = byId('v32UploadStatus');
      if(!box){
        const anchor = document.querySelector('.videoUploadBox') || byId('detailFiles') || byId('dailyFormCard');
        if(anchor && anchor.parentNode){
          box = document.createElement('div');
          box.id = 'v32UploadStatus';
          box.className = 'v32UploadStatus';
          anchor.parentNode.insertBefore(box, anchor.nextSibling);
        }
      }
      if(box){
        box.className = 'v32UploadStatus ' + (type || 'info');
        box.innerHTML = message;
      }
    }catch(_){}
  }

  function setEmptyFiles(input){
    if(!input) return;
    try { input.value = ''; } catch(_){}
    try {
      const dt = new DataTransfer();
      input.files = dt.files;
    } catch(_){}
  }

  function syncBasketToInput(id){
    try{
      const input = byId(id);
      const basket = (window.v37FileBaskets && Array.isArray(window.v37FileBaskets[id])) ? window.v37FileBaskets[id] : null;
      if(!input || !basket) return;
      const dt = new DataTransfer();
      basket.forEach(file => {
        try { dt.items.add(file); } catch(_){}
      });
      input.files = dt.files;
    }catch(_){}
  }

  function countSelectedUploads(){
    return UPLOAD_IDS.reduce((sum, id) => sum + (byId(id)?.files?.length || 0), 0);
  }

  function clearOneUpload(id){
    try{
      if(window.v37FileBaskets) window.v37FileBaskets[id] = [];
      setEmptyFiles(byId(id));
      const preview = byId(id + 'BasketPreview');
      if(preview) preview.innerHTML = '';
    }catch(_){}
  }

  window.v129ClearCurrentEntryUploads = function(){
    UPLOAD_IDS.forEach(clearOneUpload);
    try { if(typeof window.v37InitProjectBaskets === 'function') window.v37InitProjectBaskets(); } catch(_){}
  };

  // A régi v37 tisztítót is megerősítjük, mert csak value='' nem minden böngészőn üríti a FileList-et.
  const oldClear = window.v37ClearBasket;
  window.v37ClearBasket = function(id){
    try { if(typeof oldClear === 'function') oldClear(id); } catch(_){}
    clearOneUpload(id);
  };

  function installWrapper(){
    const original = window.saveDailyEntry || (typeof saveDailyEntry === 'function' ? saveDailyEntry : null);
    if(!original || original.__v129CurrentUploadFix) return false;

    const wrapped = async function(){
      try { if(typeof window.v37InitProjectBaskets === 'function') window.v37InitProjectBaskets(); } catch(_){}
      UPLOAD_IDS.forEach(syncBasketToInput);

      const beforeCount = byId('beforeFiles')?.files?.length || 0;
      const afterCount = byId('afterFiles')?.files?.length || 0;
      const generalCount = byId('detailFiles')?.files?.length || 0;
      const videoCount = byId('detailVideos')?.files?.length || 0;
      const photoCount = beforeCount + afterCount + generalCount;

      if(photoCount || videoCount){
        setUploadStatus(
          `<b>Aktuális napi mentés folyamatban...</b><br>Ehhez a bejegyzéshez ${photoCount} fotó és ${videoCount} videó kerül mentésre. A régi képek nem kerülnek hozzá újra.`,
          'info'
        );
      }

      let result;
      try{
        result = await original.apply(this, arguments);
      } finally {
        // Szándékosan minden lefutás után ürítjük a kosarat, mert a beragadt FileList okozta,
        // hogy az új napi riport az előző 7 képet is hozzáadta.
        window.v129ClearCurrentEntryUploads();
      }

      if(photoCount || videoCount){
        setUploadStatus(
          `<b>Mentés után a feltöltési kosár kiürítve.</b><br>A következő napi bejegyzés már csak az akkor kiválasztott új képeket fogja tartalmazni.`,
          'ok'
        );
      }
      return result;
    };

    wrapped.__v129CurrentUploadFix = true;
    window.saveDailyEntry = wrapped;
    try { saveDailyEntry = wrapped; } catch(_){}
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(installWrapper, 300);
    setTimeout(installWrapper, 1200);
  });

  // Ha minden script már betöltődött, azonnal is telepítjük.
  setTimeout(installWrapper, 0);
  setTimeout(installWrapper, 1800);
})();
