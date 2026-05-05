let profileUser = null;
let profileData = null;
let profileSubscription = null;

function byId(id) { return document.getElementById(id); }
function showDeleteResult(html, isError = false) {
  const box = byId("deleteResult");
  box.classList.remove("hidden");
  box.innerHTML = html;
  box.style.borderColor = isError ? "rgba(239,68,68,.45)" : "rgba(34,197,94,.35)";
}
function displayProfileName() {
  return profileData?.company_name || profileData?.full_name || profileUser?.user_metadata?.full_name || profileUser?.email || "Felhasználó";
}
async function loadProfilePage() {
  profileUser = await window.EpitesNaploAPI.getCurrentUser();
  if (!profileUser) {
    byId("profileName").textContent = "Nincs bejelentkezve";
    byId("profileEmail").textContent = "A fiók törléséhez előbb jelentkezz be.";
    byId("profilePlan").textContent = "Csomag: vendég";
    return;
  }
  byId("logoutBtn").classList.remove("hidden");
  profileData = await window.EpitesNaploAPI.getProfile();
  profileSubscription = await window.EpitesNaploAPI.getSubscription();
  byId("profileName").textContent = displayProfileName();
  byId("profileEmail").textContent = profileUser.email || "";
  byId("profilePlan").textContent = "Csomag: " + (profileSubscription?.plan || "próba / nincs aktív előfizetés");
}
async function logoutFromProfile() {
  await window.EpitesNaploAPI.signOut();
  window.location.href = "index.html";
}
async function requestAccountDelete() {
  if (!profileUser) return showDeleteResult("Előbb jelentkezz be a törléshez.", true);
  const confirmText = byId("deleteConfirm").value.trim();
  const agreed = byId("deleteAgreement").checked;
  if (confirmText !== "TÖRLÉS") return showDeleteResult("A biztonsági mezőbe pontosan ezt írd: <b>TÖRLÉS</b>", true);
  if (!agreed) return showDeleteResult("Pipáld be, hogy megértetted a végleges törlést.", true);
  if (!confirm("Biztosan végleg törlöd a fiókodat és az összes kapcsolódó adatot?")) return;
  showDeleteResult("Fiók törlése folyamatban...");
  try {
    const result = await window.EpitesNaploAPI.deleteAccount({ confirmText, reason: "Felhasználó saját kérésére törölte a fiókját." });
    if (!result?.ok) return showDeleteResult("A törlés nem sikerült: " + (result?.error || "ismeretlen hiba"), true);
    showDeleteResult("<b>A fiók törlése elkészült.</b><br>Kijelentkeztetünk, és visszairányítunk a főoldalra.");
    setTimeout(() => { window.location.href = "index.html?account_deleted=1"; }, 1800);
  } catch (err) {
    console.error(err);
    showDeleteResult("Hiba történt: " + (err.message || err), true);
  }
}
loadProfilePage();
