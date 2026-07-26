(() => {
  "use strict";

  const db = window.supabaseDirect;
  const $ = (id) => document.getElementById(id);
  const paidPlans = new Set(["starter", "pro", "business"]);
  const statusLabels = {
    draft: "Piszkozat", sent: "Elküldve", viewed: "Megnyitva", accepted: "Elfogadva",
    rejected: "Elutasítva", expired: "Lejárt", project_created: "Projekt elkészült",
  };
  let currentUser = null;
  let quotes = [];
  let toastTimer = null;

  const asText = (value) => String(value ?? "").trim();
  const numberValue = (value) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const money = (value) => `${Math.round(numberValue(value)).toLocaleString("hu-HU")} Ft`;
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
      <input class="itemName" maxlength="240" placeholder="Pl. Falburkolás" aria-label="Tétel megnevezése">
      <input class="itemQuantity" type="number" min="0.01" step="0.01" value="1" aria-label="Mennyiség">
      <input class="itemUnit" maxlength="30" value="db" aria-label="Egység">
      <input class="itemPrice" type="number" min="0" step="1" value="0" aria-label="Nettó egységár">
      <strong class="lineTotal">0 Ft</strong>
      <button class="removeItem" type="button" title="Tétel törlése" aria-label="Tétel törlése">×</button>`;
    row.querySelector(".itemName").value = asText(item.name);
    row.querySelector(".itemQuantity").value = numberValue(item.quantity) || 1;
    row.querySelector(".itemUnit").value = asText(item.unit) || "db";
    row.querySelector(".itemPrice").value = numberValue(item.net_unit_price);
    row.querySelectorAll("input").forEach((input) => input.addEventListener("input", recalculate));
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
      return {
        name: asText(row.querySelector(".itemName").value),
        quantity,
        unit: asText(row.querySelector(".itemUnit").value) || "db",
        net_unit_price: netUnitPrice,
        net_total: Math.round(quantity * netUnitPrice * 100) / 100,
      };
    });
  }

  function totals() {
    const subtotal = collectItems().reduce((sum, item) => sum + item.net_total, 0);
    const vatRate = numberValue($("vatRate").value);
    const vat = Math.round(subtotal * vatRate) / 100;
    return { subtotal, vatRate, vat, gross: subtotal + vat };
  }

  function recalculate() {
    document.querySelectorAll(".quoteItemRow").forEach((row) => {
      const quantity = numberValue(row.querySelector(".itemQuantity").value);
      const price = numberValue(row.querySelector(".itemPrice").value);
      row.querySelector(".lineTotal").textContent = money(quantity * price);
    });
    const total = totals();
    $("subtotalNet").textContent = money(total.subtotal);
    $("vatAmount").textContent = money(total.vat);
    $("totalGross").textContent = money(total.gross);
  }

  function resetForm(quote = null) {
    $("quoteForm").reset();
    $("quoteId").value = quote?.id || "";
    $("quoteNumber").value = quote?.quote_number || newQuoteNumber();
    $("projectName").value = quote?.project_name || "";
    $("validDays").value = numberValue(quote?.valid_days) || 30;
    $("clientName").value = quote?.client_name || "";
    $("clientEmail").value = quote?.client_email || "";
    $("clientPhone").value = quote?.client_phone || "";
    $("clientCity").value = quote?.client_city || "";
    $("clientAddress").value = quote?.client_address || "";
    $("contractorName").value = quote?.contractor_name || "";
    $("contractorTaxNumber").value = quote?.contractor_tax_number || "";
    $("contractorAddress").value = quote?.contractor_address || "";
    $("introduction").value = quote?.introduction || "";
    $("paymentTerms").value = quote?.payment_terms || "";
    $("notes").value = quote?.notes || "";
    $("vatRate").value = String(numberValue(quote?.vat_rate ?? 27));
    $("quoteItems").innerHTML = "";
    const items = Array.isArray(quote?.items) && quote.items.length ? quote.items : [{}];
    items.forEach(addItem);
    $("editorTitle").textContent = quote ? "Árajánlat szerkesztése" : "Új árajánlat";
  }

  function openEditor(quote = null) {
    if (quote && ["accepted", "project_created"].includes(quote.status)) {
      return toast("Az elfogadott ajánlat tartalma már nem módosítható.", "error");
    }
    resetForm(quote);
    $("editorPanel").classList.remove("hidden");
    $("editorPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeEditor() {
    $("editorPanel").classList.add("hidden");
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
          <div><span class="quoteEyebrow">${escapeHtml(quote.quote_number)}</span><h3>${escapeHtml(quote.project_name)}</h3></div>
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
      if (!["accepted", "project_created"].includes(quote.status)) addButton("Szerkesztés", () => openEditor(quote));
      if (!["accepted", "project_created"].includes(quote.status)) addButton("Küldési link", (button) => shareQuote(quote, button), "btn primary small");
      addButton("Nyomtatás / PDF", () => printQuote(quote));
      if (quote.status === "accepted") addButton("Projekt létrehozása", (button) => createProject(quote, button), "btn primary small");
      if (quote.project_id) addButton("Projekt megnyitása", () => { window.location.href = `project.html?id=${encodeURIComponent(quote.project_id)}`; });
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
    const total = totals();
    const payload = {
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
      vat_rate: total.vatRate,
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
        toast("A projekt sikeresen elkészült az elfogadott ajánlatból.", "ok");
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
    popup.document.write(`<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${escapeHtml(quote.quote_number)}</title>
      <style>body{font:15px Arial,sans-serif;color:#152033;max-width:900px;margin:35px auto;padding:0 24px}header{display:flex;justify-content:space-between;border-bottom:3px solid #0ea5e9;padding-bottom:18px}h1{margin:.2em 0}table{width:100%;border-collapse:collapse;margin:28px 0}th,td{padding:10px;border-bottom:1px solid #ccd5df;text-align:left}th:nth-child(n+2),td:nth-child(n+2){text-align:right}.totals{margin-left:auto;width:360px}.totals p{display:flex;justify-content:space-between}.gross{font-size:1.25em;border-top:2px solid #152033;padding-top:10px}.copy{white-space:pre-wrap}.actions{margin:25px 0}@media print{.actions{display:none}}</style></head><body>
      <header><div><small>ÁRAJÁNLAT</small><h1>${escapeHtml(quote.project_name)}</h1><b>${escapeHtml(quote.quote_number)}</b></div><div>${escapeHtml(quote.contractor_name || "")}<br>${escapeHtml(quote.contractor_tax_number || "")}<br>${escapeHtml(quote.contractor_address || "")}</div></header>
      <p><b>Megrendelő:</b> ${escapeHtml(quote.client_name || "nincs megadva")}<br>${escapeHtml([quote.client_city, quote.client_address].filter(Boolean).join(", "))}</p>
      <p class="copy">${escapeHtml(quote.introduction || "")}</p>
      <table><thead><tr><th>Megnevezés</th><th>Mennyiség</th><th>Nettó egységár</th><th>Nettó összesen</th></tr></thead><tbody>
      ${items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${numberValue(item.quantity).toLocaleString("hu-HU")} ${escapeHtml(item.unit)}</td><td>${money(item.net_unit_price)}</td><td>${money(item.net_total)}</td></tr>`).join("")}
      </tbody></table><div class="totals"><p><span>Nettó:</span><b>${money(quote.subtotal_net)}</b></p><p><span>ÁFA (${numberValue(quote.vat_rate)}%):</span><b>${money(quote.vat_amount)}</b></p><p class="gross"><span>Bruttó:</span><b>${money(quote.total_gross)}</b></p></div>
      <h3>Fizetési feltételek</h3><p class="copy">${escapeHtml(quote.payment_terms || "Nincs külön megadva.")}</p><h3>Megjegyzés</h3><p class="copy">${escapeHtml(quote.notes || "Nincs külön megjegyzés.")}</p>
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
        return;
      }
      const [profile, subscription] = await Promise.all([
        window.EpitesNaploAPI.getProfile(),
        window.EpitesNaploAPI.getSubscription(),
      ]);
      if (!(await hasPaidAccess(currentUser, profile, subscription))) {
        message("A fiókod elérhető, de az ajánlatkészítő fizetős funkció.", "error");
        $("lockedPanel").classList.remove("hidden");
        $("lockedTitle").textContent = "Aktív fizetős csomag szükséges";
        $("lockedText").textContent = "A saját árajánlatkészítő a Starter, Pro és Business csomag része.";
        $("lockedAction").textContent = "Csomag választása";
        $("lockedAction").href = "index.html#arak";
        return;
      }
      $("newQuoteBtn").disabled = false;
      $("listPanel").classList.remove("hidden");
      message("Az ajánlatkészítő használatra kész.", "ok");
      await loadQuotes();
    } catch (error) {
      message(`Az ajánlatkészítő betöltése nem sikerült: ${error.message || error}`, "error");
    } finally {
      document.body.classList.remove("auth-loading");
    }
  }

  $("newQuoteBtn").disabled = true;
  $("newQuoteBtn").addEventListener("click", () => openEditor());
  $("closeEditorBtn").addEventListener("click", closeEditor);
  $("cancelQuoteBtn").addEventListener("click", closeEditor);
  $("addItemBtn").addEventListener("click", () => addItem());
  $("vatRate").addEventListener("change", recalculate);
  $("quoteForm").addEventListener("submit", saveQuote);
  $("refreshBtn").addEventListener("click", async (event) => {
    setBusy(event.currentTarget, true, "Frissítés…");
    try { await loadQuotes(true); } catch (error) { toast(error.message || String(error), "error"); }
    finally { setBusy(event.currentTarget, false); }
  });
  window.addEventListener("DOMContentLoaded", initialize);
})();
