(function(){
  if(window.__epnImportantNotificationsV188) return;
  window.__epnImportantNotificationsV188 = true;

  function nativeNotify(title, body){
    try{
      if(window.EpitesNaploNative && typeof window.EpitesNaploNative.notify === 'function'){
        window.EpitesNaploNative.notify(String(title || 'ÉpítésNapló AI PRO'), String(body || 'Fontos esemény történt.'));
        return true;
      }
    }catch(err){
      console.warn('Native notification failed:', err);
    }
    return false;
  }

  async function webNotify(title, body){
    if(!('Notification' in window)) return false;
    try{
      let permission = Notification.permission;
      if(permission === 'default') permission = await Notification.requestPermission();
      if(permission !== 'granted') return false;
      if(navigator.serviceWorker?.ready){
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title || 'ÉpítésNapló AI PRO', {
          body: body || 'Fontos esemény történt.',
          icon: './favicon.png',
          badge: './favicon.png'
        });
        return true;
      }
      new Notification(title || 'ÉpítésNapló AI PRO', { body: body || 'Fontos esemény történt.', icon: './favicon.png' });
      return true;
    }catch(err){
      console.warn('Web notification failed:', err);
      return false;
    }
  }

  window.epnNotifyImportantV188 = async function(title, body){
    if(nativeNotify(title, body)) return true;
    return webNotify(title, body);
  };

  function projectNameFromMain(){
    try{
      const select = document.getElementById('clientReportProject');
      if(select && select.selectedOptions && select.selectedOptions[0]) return select.selectedOptions[0].textContent.trim();
    }catch(_){}
    return 'projekt';
  }

  function detailProjectName(){
    try{
      return window.detailState?.project?.name || document.querySelector('h1')?.textContent?.trim() || 'projekt';
    }catch(_){
      return 'projekt';
    }
  }

  function wrapWhenReady(){
    if(typeof window.generateClientReport === 'function' && !window.generateClientReport.__epnNotifyWrapped){
      const original = window.generateClientReport;
      window.generateClientReport = function(){
        const result = original.apply(this, arguments);
        setTimeout(() => {
          const preview = document.getElementById('clientReportPreview');
          if(preview && preview.innerText && !preview.innerText.includes('Még nincs előkészített')){
            window.epnNotifyImportantV188('Ügyfélriport elkészült', `${projectNameFromMain()}: a riport előkészítve.`);
          }
        }, 250);
        return result;
      };
      window.generateClientReport.__epnNotifyWrapped = true;
    }

    if(typeof window.createAndCopyClientLink === 'function' && !window.createAndCopyClientLink.__epnNotifyWrapped){
      const original = window.createAndCopyClientLink;
      window.createAndCopyClientLink = async function(){
        const result = await original.apply(this, arguments);
        if(window.state?.lastClientReportLink){
          window.epnNotifyImportantV188('Ügyfélriport link elkészült', `${projectNameFromMain()}: a megosztható link elkészült.`);
        }
        return result;
      };
      window.createAndCopyClientLink.__epnNotifyWrapped = true;
    }

    if(typeof window.createProjectClientLinkV25 === 'function' && !window.createProjectClientLinkV25.__epnNotifyWrapped){
      const original = window.createProjectClientLinkV25;
      window.createProjectClientLinkV25 = async function(){
        const result = await original.apply(this, arguments);
        window.epnNotifyImportantV188('Ügyfélriport link elkészült', `${detailProjectName()}: a megosztható link elkészült.`);
        return result;
      };
      window.createProjectClientLinkV25.__epnNotifyWrapped = true;
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    wrapWhenReady();
    setTimeout(wrapWhenReady, 700);
    setTimeout(wrapWhenReady, 1800);
  });
})();
