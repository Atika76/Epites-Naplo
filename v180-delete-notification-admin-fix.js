/* V180 – célzott javítások V179/V175b alapra
   1) Projekt törlés után a notifications táblából is takarítja a projekthez tartozó ügyfél-link/riport értesítéseket.
   2) A fejlécben nem jelenik meg külön szerep-jelvény (Admin/Felhasználó), csak a valódi Admin menüpont marad adminnak.
   Nincs új Supabase SQL. */
(function(){
  'use strict';
  if (window.__epnV180DeleteNotificationFix) return;
  window.__epnV180DeleteNotificationFix = true;

  function missing(error){
    return /does not exist|schema cache|not found|relation .* does not exist|column .* does not exist|42P01|42703/i.test(String(error?.message || error || ''));
  }

  async function getCurrentUser(){
    try { return await window.EpitesNaploAPI?.getCurrentUser?.(); }
    catch(_) { return null; }
  }

  async function readProjectBeforeDelete(db, projectId, userId){
    if (!db || !projectId) return null;
    try {
      let q = db.from('projects').select('*').eq('id', projectId).limit(1);
      if (userId) q = q.eq('user_id', userId);
      const { data, error } = await q;
      if (error && !missing(error)) console.warn('V180 projekt adat olvasási figyelmeztetés:', error.message || error);
      return Array.isArray(data) ? (data[0] || null) : null;
    } catch (e) {
      if (!missing(e)) console.warn('V180 projekt adat olvasási figyelmeztetés:', e.message || e);
      return null;
    }
  }

  async function tryDeleteNotificationQuery(query){
    try {
      const { error } = await query;
      if (error && !missing(error)) console.warn('V180 értesítés törlési figyelmeztetés:', error.message || error);
    } catch (e) {
      if (!missing(e)) console.warn('V180 értesítés törlési figyelmeztetés:', e.message || e);
    }
  }

  async function cleanupProjectNotifications(projectId, project, userId){
    const db = window.supabaseDirect;
    if (!db || !projectId) return;

    const projectNames = [
      project?.name,
      project?.title,
      project?.project_name
    ].map(v => String(v || '').trim()).filter(Boolean);

    const types = [
      'client_link',
      'client_message',
      'extra_work',
      'report_created',
      'report_approval',
      'project_deleted'
    ];

    // Ha a notifications táblában van project_id oszlop, ez a legpontosabb törlés.
    await tryDeleteNotificationQuery(db.from('notifications').delete().eq('project_id', projectId));

    // Régebbi táblában a notifications sorok project_id nélkül jöhettek létre.
    // Ilyenkor csak az adott felhasználó, ismert projektnevével egyező projekt-értesítéseket takarítjuk.
    if (userId && projectNames.length) {
      for (const name of projectNames) {
        await tryDeleteNotificationQuery(
          db.from('notifications')
            .delete()
            .eq('user_id', userId)
            .in('type', types)
            .eq('message', name)
        );
      }
    }
  }

  function patchDeleteProject(){
    const api = window.EpitesNaploAPI;
    if (!api || typeof api.deleteProject !== 'function' || api.__v180DeleteProjectPatched) return false;
    const oldDeleteProject = api.deleteProject.bind(api);
    api.deleteProject = async function(projectId){
      const db = window.supabaseDirect;
      const user = await getCurrentUser();
      const project = await readProjectBeforeDelete(db, projectId, user?.id);
      const result = await oldDeleteProject(projectId);
      try { await cleanupProjectNotifications(projectId, project, user?.id); }
      catch (e) { console.warn('V180 notifications utótakarítás figyelmeztetés:', e.message || e); }
      return result;
    };
    api.__v180DeleteProjectPatched = true;
    return true;
  }

  function hideRolePill(){
    document.querySelectorAll('.adminPill').forEach(el => el.remove());
  }

  function boot(){
    patchDeleteProject();
    hideRolePill();
  }

  document.addEventListener('DOMContentLoaded', () => {
    boot();
    setTimeout(boot, 250);
    setTimeout(boot, 1000);
  });

  let ticks = 0;
  const timer = setInterval(() => {
    boot();
    ticks += 1;
    if (ticks > 10) clearInterval(timer);
  }, 700);
})();
