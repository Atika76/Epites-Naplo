let profileUser = null;
let profileData = null;
let profileSubscription = null;
let profileLogoData = "";

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
function showCompanyResult(message, isError = false) {
  const box = byId("companyProfileResult");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("hidden");
  box.style.borderColor = isError ? "rgba(239,68,68,.45)" : "rgba(34,197,94,.35)";
}
function renderCompanyLogo() {
  const preview = byId("companyLogoPreview");
  if (!preview) return;
  preview.innerHTML = "";
  if (!profileLogoData) {
    const text = document.createElement("span");
    text.textContent = "Nincs feltöltött vállalkozói logó.";
    preview.appendChild(text);
    return;
  }
  const image = document.createElement("img");
  image.src = profileLogoData;
  image.alt = "Vállalkozói logó";
  preview.appendChild(image);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn ghost small";
  remove.textContent = "Logó törlése";
  remove.onclick = () => { profileLogoData = ""; byId("companyLogoFile").value = ""; renderCompanyLogo(); };
  preview.appendChild(remove);
}
function resizeProfileLogo(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) return reject(new Error("PNG, JPG vagy WebP logót válassz."));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("A logófájl legfeljebb 8 MB lehet."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("A logófájl nem olvasható."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("A kép nem feldolgozható."));
      image.onload = () => {
        const scale = Math.min(1, 900 / image.width, 450 / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .86));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
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
  byId("companyName").value = profileData?.company_name || profileData?.full_name || "";
  byId("companyTaxNumber").value = profileData?.company_tax_number || "";
  byId("companyAddress").value = profileData?.company_address || "";
  byId("companyPhone").value = profileData?.company_phone || "";
  byId("companyEmail").value = profileData?.company_email || profileUser.email || "";
  profileLogoData = profileData?.company_logo_data || "";
  renderCompanyLogo();
}
async function saveCompanyProfile() {
  if (!profileUser) return showCompanyResult("Előbb jelentkezz be.", true);
  const button = byId("saveCompanyProfileBtn");
  button.disabled = true;
  button.textContent = "Mentés…";
  try {
    const values = {
      company_name: byId("companyName").value.trim() || null,
      company_tax_number: byId("companyTaxNumber").value.trim() || null,
      company_address: byId("companyAddress").value.trim() || null,
      company_phone: byId("companyPhone").value.trim() || null,
      company_email: byId("companyEmail").value.trim() || null,
      company_logo_data: profileLogoData || null
    };
    const { error } = await window.supabaseDirect.from("profiles").update(values).eq("id", profileUser.id);
    if (error) throw error;
    profileData = { ...(profileData || {}), ...values };
    try {
      if (profileLogoData) localStorage.setItem("epitesnaplo_company_logo", profileLogoData);
      else localStorage.removeItem("epitesnaplo_company_logo");
    } catch (_) {}
    showCompanyResult("A vállalkozói adatok és a logó mentése sikerült.");
  } catch (error) {
    showCompanyResult("A mentés nem sikerült: " + (error.message || error), true);
  } finally {
    button.disabled = false;
    button.textContent = "Vállalkozói adatok mentése";
  }
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
byId("companyLogoFile")?.addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  try {
    profileLogoData = await resizeProfileLogo(file);
    renderCompanyLogo();
    showCompanyResult("A logó előkészítve. Nyomd meg a mentés gombot.");
  } catch (error) {
    event.currentTarget.value = "";
    showCompanyResult(error.message || String(error), true);
  }
});
loadProfilePage();
