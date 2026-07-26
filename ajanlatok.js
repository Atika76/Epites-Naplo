(() => {
  "use strict";

  const db = window.supabaseDirect;
  const $ = (id) => document.getElementById(id);
  const paidPlans = new Set(["starter", "pro", "business", "bundle"]);
  const statusLabels = {
    draft: "Piszkozat", sent: "Elküldve", viewed: "Megnyitva", accepted: "Elfogadva",
    rejected: "Elutasítva", expired: "Lejárt", project_created: "Projekt elkészült",
  };
  let currentUser = null;
  let currentProfile = null;
  let contractorLogoData = "";
  let canCreateQuote = false;
  let quotes = [];
  let toastTimer = null;
  let editingQuoteType = "base";
  let editingParentQuoteId = null;

  const asText = (value) => String(value ?? "").trim();
  const numberValue = (value) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const money = (value) => `${Math.round(numberValue(value)).toLocaleString("hu-HU")} Ft`;
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (dateText, days) => {
    const date = new Date(`${dateText || today()}T12:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const dateOnly = (value) => value ? String(value).slice(0, 10) : "";
  const huDate = (value) => value ? new Date(`${dateOnly(value)}T12:00:00`).toLocaleDateString("hu-HU") : "nincs megadva";
  const escapeHtml = (value) => asText(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));

  function message(text, type = "") {
    $("pageMessage").textContent = text;
    $("pageMessage").className = `quoteMessage ${type}`.trim();
  }

  function toast(text, type = "") {
    clearTimeout(toastTimer);
    const node = $("quoteToast");
    node.textContent = text;
    node.className = `quoteToast ${type}`.trim();
    toastTimer = setTimeout(() => node.classList.add("hidden"), 5200);
  }

  function setBusy(button, busy, busyText) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = busyText || "Folyamatban…";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  function newQuoteNumber() {
    const now = new Date();
    const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
    return `EPN-${day}-${String(Math.floor(1000 + Math.random() * 9000))}`;
  }

  function addItem(item = {}) {
    const row = document.createElement("div");
    row.className = "quoteItemRow";
    row.innerHTML = `
      <select class="itemCategory" aria-label="Kategória"><option value="anyag">Anyag</option><option value="munkadij">Munkadíj</option><option value="egyeb">Egyéb</option></select>
      <input class="itemSku" maxlength="80" placeholder="Opcionális" aria-label="Cikkszám">
      <div class="itemDescriptionCell"><input class="itemName" maxlength="240" placeholder="Pl. Falburkolás" aria-label="Tétel megnevezése"><textarea class="itemDescription" rows="2" maxlength="600" placeholder="Részletes leírás (opcionális)" aria-label="Tétel részletes leírása"></textarea></div>
      <input class="itemQuantity" type="number" min="0.01" step="0.01" value="1" aria-label="Mennyiség">
      <input class="itemUnit" maxlength="30" value="db" aria-label="Egység">
      <input class="itemPrice" type="number" min="0" step="1" value="0" aria-label="Nettó egységár">
      <input class="itemDiscount" type="number" min="0" max="100" step="0.1" value="0" aria-label="Kedvezmény százalék">
      <strong class="lineTotal">0 Ft</strong>
      <button class="removeItem" type="button" title="Tétel törlése" aria-label="Tétel törlése">×</button>`;
    row.querySelector(".itemCategory").value = asText(item.category) || "munkadij";
    row.querySelector(".itemSku").value = asText(item.sku);
    row.querySelector(".itemName").value = asText(item.name);
    row.querySelector(".itemDescription").value = asText(item.description);
    row.querySelector(".itemQuantity").value = numberValue(item.quantity) || 1;
    row.querySelector(".itemUnit").value = asText(item.unit) || "db";
    row.querySelector(".itemPrice").value = numberValue(item.net_unit_price);
    row.querySelector(".itemDiscount").value = numberValue(item.discount_percent);
    row.querySelectorAll("input,select,textarea").forEach((input) => input.addEventListener("input", recalculate));
    row.querySelector(".removeItem").addEventListener("click", () => {
      if ($("quoteItems").children.length === 1) return toast("Legalább egy tétel szükséges.", "error");
      row.remove();
      recalculate();
    });
    $("quoteItems").appendChild(row);
    recalculate();
  }

  function collectItems() {
    return [...document.querySelectorAll(".quoteItemRow")].map((row) => {
      const quantity = numberValue(row.querySelector(".itemQuantity").value);
      const netUnitPrice = numberValue(row.querySelector(".itemPrice").value);
      const discountPercent = Math.max(0, Math.min(100, numberValue(row.querySelector(".itemDiscount").value)));
      const baseNetTotal = Math.round(quantity * netUnitPrice * 100) / 100;
      const discountAmount = Math.round(baseNetTotal * discountPercent) / 100;
      return {
        category: asText(row.querySelector(".itemCategory").value) || "egyeb",
        sku: asText(row.querySelector(".itemSku").value),
        name: asText(row.querySelector(".itemName").value),
        description: asText(row.querySelector(".itemDescription").value),
        quantity,
        unit: asText(row.querySelector(".itemUnit").value) || "db",
        net_unit_price: netUnitPrice,
        discount_percent: discountPercent,
        base_net_total: baseNetTotal,
        discount_amount: discountAmount,
        net_total: Math.round((baseNetTotal - discountAmount) * 100) / 100,
      };
    });
  }

  function totals() {
    const items = collectItems();
    const beforeDiscount = items.reduce((sum, item) => sum + item.base_net_total, 0);
    const discount = items.reduce((sum, item) => sum + item.discount_amount, 0);
    const subtotal = beforeDiscount - discount;
    const vatRate = numberValue($("vatRate").value);
    const vat = Math.round(subtotal * vatRate) / 100;
    return { beforeDiscount, discount, subtotal, vatRate, vat, gross: subtotal + vat };
  }

  function recalculate() {
    document.querySelectorAll(".quoteItemRow").forEach((row) => {
      const quantity = numberValue(row.querySelector(".itemQuantity").value);
      const price = numberValue(row.querySelector(".itemPrice").value);
      const discount = Math.max(0, Math.min(100, numberValue(row.querySelector(".itemDiscount").value)));
      row.querySelector(".lineTotal").textContent = money(quantity * price * (1 - discount / 100));
    });
    const total = totals();
    $("subtotalBeforeDiscount").textContent = money(total.beforeDiscount);
    $("discountAmount").textContent = `− ${money(total.discount)}`;
    $("subtotalNet").textContent = money(total.subtotal);
    $("vatAmount").textContent = money(total.vat);
    $("totalGross").textContent = money(total.gross);
  }

  function renderLogoPreview() {
    const preview = $("contractorLogoPreview");
    preview.innerHTML = "";
    if (!contractorLogoData) {
      const text = document.createElement("span");
      text.textContent = "Nincs feltöltött logó";
      preview.appendChild(text);
      return;
    }
    const image = document.createElement("img");
    image.src = contractorLogoData;
    image.alt = "Vállalkozói logó előnézete";
    preview.appendChild(image);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "removeLogoBtn";
    remove.textContent = "Logó törlése";
    remove.addEventListener("click", () => {
      contractorLogoData = "";
      $("contractorLogoFile").value = "";
      renderLogoPreview();
    });
    preview.appendChild(remove);
  }

  function resizeLogo(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) return reject(new Error("PNG, JPG vagy WebP logót válassz."));
      if (file.size > 8 * 1024 * 1024) return reject(new Error("A logófájl legfeljebb 8 MB lehet."));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("A logófájl nem olvasható."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("A kiválasztott kép nem feldolgozható."));
        image.onload = () => {
          const scale = Math.min(1, 900 / image.width, 450 / image.height);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.86));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function validityDays() {
    const issue = new Date(`${$("issueDate").value}T12:00:00`);
    const valid = new Date(`${$("validUntilDate").value}T12:00:00`);
    return Math.max(1, Math.min(90, Math.ceil((valid - issue) / 86400000)));
  }

  function resetForm(quote = null) {
    $("quoteForm").reset();
    $("quoteId").value = quote?.id || "";
    $("quoteNumber").value = quote?.quote_number || newQuoteNumber();
    $("projectName").value = quote?.project_name || "";
    $("issueDate").value = dateOnly(quote?.issue_date) || today();
    $("validUntilDate").value = dateOnly(quote?.valid_until) || addDays($("issueDate").value, numberValue(quote?.valid_days) || 30);
    $("validDays").value = numberValue(quote?.valid_days) || 30;
    $("clientName").value = quote?.client_name || "";
    $("clientEmail").value = quote?.client_email || "";
    $("clientPhone").value = quote?.client_phone || "";
    $("clientCity").value = quote?.client_city || "";
    $("clientAddress").value = quote?.client_address || "";
    $("workAddress").value = quote?.work_address || [quote?.client_city, quote?.client_address].filter(Boolean).join(", ");
    $("workStartDate").value = dateOnly(quote?.work_start_date);
    $("workEndDate").value = dateOnly(quote?.work_end_date);
    $("contractorName").value = quote?.contractor_name || currentProfile?.company_name || currentProfile?.full_name || currentUser?.user_metadata?.full_name || "";
    $("contractorTaxNumber").value = quote?.contractor_tax_number || currentProfile?.company_tax_number || "";
    $("contractorAddress").value = quote?.contractor_address || currentProfile?.company_address || "";
    $("contractorPhone").value = quote?.contractor_phone || currentProfile?.company_phone || "";
    $("contractorEmail").value = quote?.contractor_email || currentProfile?.company_email || currentUser?.email || "";
    let localLogo = "";
    try { localLogo = localStorage.getItem("epitesnaplo_company_logo") || ""; } catch (_) {}
    contractorLogoData = quote?.contractor_logo_data || currentProfile?.company_logo_data || localLogo;
    renderLogoPreview();
    $("introduction").value = quote?.introduction || "";
    $("paymentTerms").value = quote?.payment_terms || "";
    $("warrantyTerms").value = quote?.warranty_terms || "";
    $("exclusions").value = quote?.exclusions || "";
    $("notes").value = quote?.notes || "";
    $("vatRate").value = String(numberValue(quote?.vat_rate ?? 27));
    $("quoteItems").innerHTML = "";
    const items = Array.isArray(quote?.items) && quote.items.length ? quote.items : [{}];
    items.forEach(addItem);
    editingQuoteType = quote?.quote_type === "supplement" ? "supplement" : "base";
    editingParentQuoteId = quote?.parent_quote_id || null;
    $("editorTitle").textContent = editingQuoteType === "supplement"
      ? (quote?.id ? "Pótmunka szerkesztése" : "Új pótmunka / kiegészítő ajánlat")
      : (quote ? "Árajánlat szerkesztése" : "Új árajánlat");
  }

  function openEditor(quote = null) {
    if (!canCreateQuote) {
      $("lockedPanel").classList.remove("hidden");
      $("guestPreviewPanel").classList.remove("hidden");
      $("lockedPanel").scrollIntoView({ behavior: "smooth", block: "center" });
      return toast("A mentéshez jelentkezz be, és válassz aktív fizetős csomagot.", "error");
    }
    if (quote && !["draft", "rejected", "expired"].includes(quote.status)) {
      return toast("Az elküldött vagy elfogadott ajánlat tartalma már nem módosítható.", "error");
    }
    resetForm(quote);
    $("editorPanel").classList.remove("hidden");
    $("editorPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeEditor() {
    $("editorPanel").classList.add("hidden");
  }

  function openSupplement(sourceQuote) {
    if (!canCreateQuote) return openEditor();
    const rootId = sourceQuote.parent_quote_id || sourceQuote.id;
    const rootQuote = quotes.find((item) => item.id === rootId) || sourceQuote;
    const sequence = quotes.filter((item) => item.parent_quote_id === rootId).length + 1;
    resetForm({
      quote_type: "supplement",
      parent_quote_id: rootId,
      quote_number: `${rootQuote.quote_number}-P${sequence}`,
      project_name: `${rootQuote.project_name} – Pótmunka ${sequence}`,
      client_name: rootQuote.client_name,
      client_email: rootQuote.client_email,
      client_phone: rootQuote.client_phone,
      client_city: rootQuote.client_city,
      client_address: rootQuote.client_address,
      contractor_name: rootQuote.contractor_name,
      contractor_tax_number: rootQuote.contractor_tax_number,
      contractor_address: rootQuote.contractor_address,
      contractor_phone: rootQuote.contractor_phone,
      contractor_email: rootQuote.contractor_email,
      contractor_logo_data: rootQuote.contractor_logo_data,
      work_address: rootQuote.work_address,
      warranty_terms: rootQuote.warranty_terms,
      exclusions: rootQuote.exclusions,
      payment_terms: rootQuote.payment_terms,
      vat_rate: rootQuote.vat_rate,
      introduction: `Kiegészítő ajánlat a(z) ${rootQuote.quote_number} számú elfogadott ajánlathoz. Az eredeti ajánlat tartalma változatlan marad.`,
      notes: "Pótmunka / az eredeti felméréskor nem látható, később feltárt feladat.",
      items: [{}],
    });
    $("quoteId").value = "";
    $("editorPanel").classList.remove("hidden");
    $("editorPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    toast("Külön pótmunka-ajánlat nyílt. Ezt az ügyfélnek ismét el kell fogadnia.", "ok");
  }

  function renderList() {
    const list = $("quoteList");
    list.innerHTML = "";
    if (!quotes.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Még nincs árajánlatod. Készítsd el az elsőt az „Új árajánlat” gombbal.";
      list.appendChild(empty);
      return;
    }
    quotes.forEach((quote) => {
      const card = document.createElement("article");
      card.className = "quoteCard";
      const created = quote.created_at ? new Date(quote.created_at).toLocaleDateString("hu-HU") : "";
      card.innerHTML = `
        <div class="quoteCardTop">
          <div><span class="quoteEyebrow">${escapeHtml(quote.quote_number)}${quote.quote_type === "supplement" ? " · PÓTMUNKA" : ""}</span><h3>${escapeHtml(quote.project_name)}</h3></div>
          <span class="quoteStatus ${escapeHtml(quote.status)}">${escapeHtml(statusLabels[quote.status] || quote.status)}</span>
        </div>
        <div class="quoteCardMeta">
          <span>Ügyfél: <b>${escapeHtml(quote.client_name || "nincs megadva")}</b></span>
          <span>Végösszeg: <b>${money(quote.total_gross)}</b></span>
          <span>Létrehozva: ${escapeHtml(created)}</span>
        </div>
        <div class="quoteActions"></div>`;
      const actions = card.querySelector(".quoteActions");
      const addButton = (label, handler, className = "btn ghost small") => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.addEventListener("click", () => handler(button));
        actions.appendChild(button);
      };
      if (["draft", "rejected", "expired"].includes(quote.status)) addButton("Szerkesztés", () => openEditor(quote));
      if (!["accepted", "project_created"].includes(quote.status)) addButton("Küldési link", (button) => shareQuote(quote, button), "btn primary small");
      addButton("Nyomtatás / PDF", () => printQuote(quote));
      if (quote.status === "accepted") addButton(
        quote.quote_type === "supplement" ? "Pótmunka hozzáadása a projekthez" : "Projekt létrehozása",
        (button) => createProject(quote, button),
        "btn primary small"
      );
      if (quote.project_id) addButton("Projekt megnyitása", () => { window.location.href = `project.html?id=${encodeURIComponent(quote.project_id)}`; });
      if (["accepted", "project_created"].includes(quote.status)) addButton("Pótmunka / kiegészítés", () => openSupplement(quote), "btn primary small");
      if (["draft", "rejected", "expired"].includes(quote.status)) addButton("Törlés", (button) => deleteQuote(quote, button));
      list.appendChild(card);
    });
  }

  async function loadQuotes(showSuccess = false) {
    const { data, error } = await db.from("epitesi_quotes").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false });
    if (error) throw error;
    quotes = data || [];
    renderList();
    if (showSuccess) toast("Az ajánlatlista frissült.", "ok");
  }

  async function saveQuote(event) {
    event.preventDefault();
    const button = $("saveQuoteBtn");
    const items = collectItems();
    if (!asText($("projectName").value)) return toast("Add meg a projekt vagy munka nevét.", "error");
    if (!items.length || items.some((item) => !item.name || item.quantity <= 0 || item.net_unit_price < 0)) {
      return toast("Minden tételnél adj meg nevet, pozitív mennyiséget és érvényes árat.", "error");
    }
    if (!$("issueDate").value || !$("validUntilDate").value) return toast("Add meg a kiállítás és az érvényesség dátumát.", "error");
    if (new Date($("validUntilDate").value) < new Date($("issueDate").value)) return toast("Az érvényességi dátum nem lehet korábbi a kiállításnál.", "error");
    if ($("workStartDate").value && $("workEndDate").value && new Date($("workEndDate").value) < new Date($("workStartDate").value)) {
      return toast("A várható befejezés nem lehet korábbi a munkakezdésnél.", "error");
    }
    const total = totals();
    $("validDays").value = validityDays();
    const payload = {
      quote_type: editingQuoteType,
      parent_quote_id: editingParentQuoteId,
      quote_number: asText($("quoteNumber").value),
      project_name: asText($("projectName").value),
      client_name: asText($("clientName").value) || null,
      client_email: asText($("clientEmail").value) || null,
      client_phone: asText($("clientPhone").value) || null,
      client_city: asText($("clientCity").value) || null,
      client_address: asText($("clientAddress").value) || null,
      contractor_name: asText($("contractorName").value) || null,
      contractor_tax_number: asText($("contractorTaxNumber").value) || null,
      contractor_address: asText($("contractorAddress").value) || null,
      contractor_phone: asText($("contractorPhone").value) || null,
      contractor_email: asText($("contractorEmail").value) || null,
      contractor_logo_data: contractorLogoData || null,
      issue_date: $("issueDate").value,
      valid_until: new Date(`${$("validUntilDate").value}T23:59:59`).toISOString(),
      work_address: asText($("workAddress").value) || null,
      work_start_date: $("workStartDate").value || null,
      work_end_date: $("workEndDate").value || null,
      warranty_terms: asText($("warrantyTerms").value) || null,
      exclusions: asText($("exclusions").value) || null,
      vat_rate: total.vatRate,
      subtotal_before_discount: total.beforeDiscount,
      discount_amount: total.discount,
      subtotal_net: total.subtotal,
      vat_amount: total.vat,
      total_gross: total.gross,
      items,
      introduction: asText($("introduction").value) || null,
      notes: asText($("notes").value) || null,
      payment_terms: asText($("paymentTerms").value) || null,
      valid_days: Math.max(1, Math.min(90, numberValue($("validDays").value) || 30)),
      updated_at: new Date().toISOString(),
    };
    setBusy(button, true, "Mentés…");
    try {
      const quoteId = $("quoteId").value;
      const query = quoteId
        ? db.from("epitesi_quotes").update(payload).eq("id", quoteId).eq("user_id", currentUser.id)
        : db.from("epitesi_quotes").insert({ ...payload, user_id: currentUser.id });
      const { error } = await query;
      if (error) throw error;
      const profileDefaults = {
        company_name: asText($("contractorName").value) || null,
        company_tax_number: asText($("contractorTaxNumber").value) || null,
        company_address: asText($("contractorAddress").value) || null,
        company_phone: asText($("contractorPhone").value) || null,
        company_email: asText($("contractorEmail").value) || null,
        company_logo_data: contractorLogoData || null,
      };
      const profileResult = await db.from("profiles").update(profileDefaults).eq("id", currentUser.id);
      if (profileResult.error) console.warn("A vállalkozói profiladatok mentése nem sikerült:", profileResult.error);
      currentProfile = { ...(currentProfile || {}), ...profileDefaults };
      try {
        if (contractorLogoData) localStorage.setItem("epitesnaplo_company_logo", contractorLogoData);
        else localStorage.removeItem("epitesnaplo_company_logo");
      } catch (_) {}
      closeEditor();
      await loadQuotes();
      toast("Az árajánlat mentése sikerült.", "ok");
    } catch (error) {
      toast(`Mentési hiba: ${error.message || error}`, "error");
    } finally {
      setBusy(button, false);
    }
  }

  async function shareQuote(quote, button) {
    setBusy(button, true, "Link készül…");
    try {
      const validDays = Math.max(1, Math.min(90, numberValue(quote.valid_days) || 30));
      const { data, error } = await db.rpc("epitesi_create_quote_share_v1", { p_quote_id: quote.id, p_valid_days: validDays });
      if (error) throw error;
      if (!data?.token) throw new Error("Nem érkezett megosztási token.");
      const link = `${window.location.origin}/ajanlat.html?token=${encodeURIComponent(data.token)}`;
      try {
        await navigator.clipboard.writeText(link);
        toast("A biztonságos ajánlati link a vágólapra került.", "ok");
      } catch (_) {
        window.prompt("Másold ki az ajánlati linket:", link);
      }
      await loadQuotes();
    } catch (error) {
      toast(`A link létrehozása nem sikerült: ${error.message || error}`, "error");
    } finally {
      setBusy(button, false);
    }
  }

  async function createProject(quote, button) {
    setBusy(button, true, "Projekt készül…");
    try {
      const session = await window.EpitesNaploAPI.getSession();
      if (!session?.access_token) throw new Error("A bejelentkezés lejárt. Lépj be újra.");
      const response = await fetch(`${window.EPITESNAPLO_CONFIG.supabaseUrl}/functions/v1/create-quote-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ quote_id: quote.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "A projekt létrehozása nem sikerült.");
      if (Array.isArray(result.warnings) && result.warnings.length) {
        toast(`A projekt elkészült. Megjegyzés: ${result.warnings.join(" ")}`, "ok");
      } else {
        toast(result.supplement
          ? "Az elfogadott pótmunka bekerült a meglévő projektbe."
          : "A projekt sikeresen elkészült az elfogadott ajánlatból.", "ok");
      }
      setTimeout(() => { window.location.href = `project.html?id=${encodeURIComponent(result.project_id)}`; }, 650);
    } catch (error) {
      toast(error.message || String(error), "error");
      setBusy(button, false);
    }
  }

  async function deleteQuote(quote, button) {
    if (!window.confirm(`Biztosan törlöd ezt az ajánlatot?\n${quote.quote_number} – ${quote.project_name}`)) return;
    setBusy(button, true, "Törlés…");
    try {
      const { error } = await db.from("epitesi_quotes").delete().eq("id", quote.id).eq("user_id", currentUser.id);
      if (error) throw error;
      await loadQuotes();
      toast("Az ajánlat törölve lett.", "ok");
    } catch (error) {
      toast(`Törlési hiba: ${error.message || error}`, "error");
      setBusy(button, false);
    }
  }

  function printQuote(quote) {
    const items = Array.isArray(quote.items) ? quote.items : [];
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return toast("A böngésző blokkolta a nyomtatási ablakot.", "error");
    const status = statusLabels[quote.status] || quote.status || "Piszkozat";
    const decisionDate = quote.accepted_at || quote.rejected_at;
    const category = (value) => ({ anyag: "Anyag", munkadij: "Munkadíj", egyeb: "Egyéb" }[value] || "Egyéb");
    popup.document.write(`<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8"><title>${escapeHtml(quote.quote_number)}</title>
      <style>body{font:14px Arial,sans-serif;color:#152033;max-width:1050px;margin:30px auto;padding:0 24px;line-height:1.45}header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #0ea5e9;padding-bottom:18px}.logo{max-width:170px;max-height:85px;object-fit:contain}.headleft{display:flex;gap:18px;align-items:center}h1{margin:.2em 0}.meta,.parties,.work{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.box{border:1px solid #d7dee8;border-radius:8px;padding:10px}.status{display:inline-block;border:1px solid #0f766e;background:#ecfdf5;color:#115e59;border-radius:999px;padding:5px 9px;font-weight:bold}table{width:100%;border-collapse:collapse;margin:22px 0;font-size:12px}th,td{padding:9px 7px;border-bottom:1px solid #ccd5df;text-align:left}th:nth-child(n+4),td:nth-child(n+4){text-align:right}.totals{margin-left:auto;width:390px}.totals p{display:flex;justify-content:space-between}.gross{font-size:1.25em;border-top:2px solid #152033;padding-top:10px}.copy{white-space:pre-wrap}.terms{display:grid;grid-template-columns:1fr 1fr;gap:14px}.actions{margin:25px 0}@media(max-width:720px){.meta,.parties,.work,.terms{grid-template-columns:1fr}}@media print{.actions{display:none}body{margin:0}}</style></head><body>
      <header><div class="headleft">${quote.contractor_logo_data ? `<img class="logo" src="${escapeHtml(quote.contractor_logo_data)}" alt="Vállalkozói logó">` : ""}<div><small>${quote.quote_type === "supplement" ? "PÓTMUNKA / KIEGÉSZÍTŐ AJÁNLAT" : "ÁRAJÁNLAT"}</small><h1>${escapeHtml(quote.project_name)}</h1><b>${escapeHtml(quote.quote_number)}</b></div></div><div><b>${escapeHtml(quote.contractor_name || "")}</b><br>${escapeHtml(quote.contractor_tax_number ? `Adószám: ${quote.contractor_tax_number}` : "")}<br>${escapeHtml(quote.contractor_address || "")}<br>${escapeHtml(quote.contractor_phone || "")}<br>${escapeHtml(quote.contractor_email || "")}</div></header>
      <div class="meta"><div class="box"><b>Kiállítás</b><br>${huDate(quote.issue_date)}</div><div class="box"><b>Érvényes</b><br>${huDate(quote.valid_until)}</div><div class="box"><b>Állapot</b><br><span class="status">${escapeHtml(status)}</span>${decisionDate ? `<br>${new Date(decisionDate).toLocaleString("hu-HU")}` : ""}</div></div>
      <div class="parties"><div class="box"><b>Megrendelő</b><br>${escapeHtml(quote.client_name || "nincs megadva")}<br>${escapeHtml(quote.client_email || "")}<br>${escapeHtml(quote.client_phone || "")}</div><div class="box"><b>Megrendelő címe</b><br>${escapeHtml([quote.client_city, quote.client_address].filter(Boolean).join(", ") || "nincs megadva")}</div><div class="box"><b>Munkavégzés címe</b><br>${escapeHtml(quote.work_address || "nincs megadva")}</div></div>
      <div class="work"><div class="box"><b>Várható kezdés</b><br>${huDate(quote.work_start_date)}</div><div class="box"><b>Várható befejezés</b><br>${huDate(quote.work_end_date)}</div><div class="box"><b>Elfogadó</b><br>${escapeHtml(quote.decision_name || "—")}<br>${escapeHtml(quote.decision_email || "")}</div></div>
      <p class="copy">${escapeHtml(quote.introduction || "")}</p>
      <table><thead><tr><th>Kategória</th><th>Cikkszám</th><th>Megnevezés / leírás</th><th>Mennyiség</th><th>Nettó egységár</th><th>Kedvezmény</th><th>Nettó összesen</th></tr></thead><tbody>
      ${items.map((item) => `<tr><td>${category(item.category)}</td><td>${escapeHtml(item.sku || "—")}</td><td><b>${escapeHtml(item.name)}</b>${item.description ? `<br>${escapeHtml(item.description)}` : ""}</td><td>${numberValue(item.quantity).toLocaleString("hu-HU")} ${escapeHtml(item.unit)}</td><td>${money(item.net_unit_price)}</td><td>${numberValue(item.discount_percent).toLocaleString("hu-HU")}%</td><td>${money(item.net_total)}</td></tr>`).join("")}
      </tbody></table><div class="totals"><p><span>Kedvezmény előtti nettó:</span><b>${money(quote.subtotal_before_discount)}</b></p><p><span>Kedvezmény:</span><b>− ${money(quote.discount_amount)}</b></p><p><span>Nettó:</span><b>${money(quote.subtotal_net)}</b></p><p><span>ÁFA (${numberValue(quote.vat_rate)}%):</span><b>${money(quote.vat_amount)}</b></p><p class="gross"><span>Bruttó:</span><b>${money(quote.total_gross)}</b></p></div>
      <div class="terms"><div class="box"><h3>Fizetési feltételek</h3><p class="copy">${escapeHtml(quote.payment_terms || "Nincs külön megadva.")}</p></div><div class="box"><h3>Garancia / jótállás</h3><p class="copy">${escapeHtml(quote.warranty_terms || "Nincs külön megadva.")}</p></div><div class="box"><h3>Az ajánlat nem tartalmazza</h3><p class="copy">${escapeHtml(quote.exclusions || "Nincs külön megadva.")}</p></div><div class="box"><h3>Megjegyzés</h3><p class="copy">${escapeHtml(quote.notes || "Nincs külön megjegyzés.")}</p></div></div>
      <div class="actions"><button onclick="window.print()">Nyomtatás / Mentés PDF-ként</button></div></body></html>`);
    popup.document.close();
  }

  async function hasPaidAccess(user, profile, subscription) {
    const admin = profile?.is_admin || profile?.role === "admin" || user.email === window.EPITESNAPLO_CONFIG.adminEmail;
    if (admin) return true;
    const plan = subscription?.plan || profile?.plan || "trial";
    const status = subscription?.status || profile?.plan_status || "active";
    const expiry = subscription?.current_period_end || profile?.plan_expires_at;
    return paidPlans.has(plan) && status === "active" && (!expiry || new Date(expiry).getTime() >= Date.now());
  }

  async function initialize() {
    try {
      currentUser = await window.EpitesNaploAPI.getCurrentUser();
      if (!currentUser) {
        message("Az ajánlatkészítő használatához jelentkezz be.", "error");
        $("lockedPanel").classList.remove("hidden");
        $("guestPreviewPanel").classList.remove("hidden");
        return;
      }
      const [profile, subscription] = await Promise.all([
        window.EpitesNaploAPI.getProfile(),
        window.EpitesNaploAPI.getSubscription(),
      ]);
      currentProfile = profile || {};
      if (!(await hasPaidAccess(currentUser, profile, subscription))) {
        message("A fiókod elérhető, de az ajánlatkészítő fizetős funkció.", "error");
        $("lockedPanel").classList.remove("hidden");
        $("guestPreviewPanel").classList.remove("hidden");
        $("lockedTitle").textContent = "Aktív fizetős csomag szükséges";
        $("lockedText").textContent = "A saját árajánlatkészítő a Starter, Pro és Business csomag része.";
        $("lockedAction").textContent = "Csomag választása";
        $("lockedAction").href = "index.html#subscription";
        return;
      }
      canCreateQuote = true;
      $("listPanel").classList.remove("hidden");
      message("Az ajánlatkészítő használatra kész.", "ok");
      await loadQuotes();
    } catch (error) {
      message(`Az ajánlatkészítő betöltése nem sikerült: ${error.message || error}`, "error");
    } finally {
      document.body.classList.remove("auth-loading");
    }
  }

  $("newQuoteBtn").addEventListener("click", () => openEditor());
  $("closeEditorBtn").addEventListener("click", closeEditor);
  $("cancelQuoteBtn").addEventListener("click", closeEditor);
  $("addItemBtn").addEventListener("click", () => addItem());
  $("vatRate").addEventListener("change", recalculate);
  $("issueDate").addEventListener("change", () => {
    if ($("issueDate").value) $("validUntilDate").value = addDays($("issueDate").value, 30);
  });
  $("contractorLogoFile").addEventListener("change", async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      contractorLogoData = await resizeLogo(file);
      renderLogoPreview();
      toast("A logó előkészítve. Az ajánlat mentésekor a profilodba is bekerül.", "ok");
    } catch (error) {
      event.currentTarget.value = "";
      toast(error.message || String(error), "error");
    }
  });
  $("quoteForm").addEventListener("submit", saveQuote);
  $("refreshBtn").addEventListener("click", async (event) => {
    setBusy(event.currentTarget, true, "Frissítés…");
    try { await loadQuotes(true); } catch (error) { toast(error.message || String(error), "error"); }
    finally { setBusy(event.currentTarget, false); }
  });
  window.addEventListener("DOMContentLoaded", initialize);
})();
