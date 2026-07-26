(() => {
  "use strict";
  const db = window.supabaseDirect;
  const $ = (id) => document.getElementById(id);
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const labels = {
    sent: "Elküldve", viewed: "Megnyitva", accepted: "Elfogadva", rejected: "Elutasítva",
    expired: "Lejárt", project_created: "Elfogadva",
  };
  let quote = null;

  const text = (value) => String(value ?? "").trim();
  const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = (value) => `${Math.round(numberValue(value)).toLocaleString("hu-HU")} Ft`;
  function setText(id, value) { $(id).textContent = text(value); }

  function statusMessage(message, type = "") {
    $("publicStatus").textContent = message;
    $("publicStatus").className = `quoteMessage ${type}`.trim();
  }

  function showDecisionResult(decision, name, decidedAt) {
    $("decisionPanel").classList.add("hidden");
    const result = $("decisionResult");
    result.className = `decisionResult ${decision === "rejected" ? "rejected" : ""}`.trim();
    const date = decidedAt ? new Date(decidedAt).toLocaleString("hu-HU") : new Date().toLocaleString("hu-HU");
    result.textContent = decision === "accepted"
      ? `Köszönjük, ${name || ""}! Az ajánlat elfogadását rögzítettük (${date}). A vállalkozó most már elindíthatja belőle az Építési Napló projektet.`
      : `Az ajánlat elutasítását rögzítettük (${date}). A megjegyzést a vállalkozó látni fogja.`;
  }

  function render(data) {
    quote = data;
    setText("publicProjectName", data.project_name);
    setText("publicQuoteNumber", data.quote_number);
    setText("publicStatusBadge", labels[data.status] || data.status);
    $("publicStatusBadge").className = `quoteStatus ${data.status || ""}`.trim();
    setText("publicIntro", data.introduction || "");
    setText("publicContractor", [data.contractor_name, data.contractor_tax_number && `Adószám: ${data.contractor_tax_number}`, data.contractor_address].filter(Boolean).join("\n") || "Nincs megadva.");
    setText("publicClient", [data.client_name, data.client_email].filter(Boolean).join("\n") || "Nincs megadva.");
    const body = $("publicItems");
    body.innerHTML = "";
    (Array.isArray(data.items) ? data.items : []).forEach((item) => {
      const row = document.createElement("tr");
      [text(item.name), `${numberValue(item.quantity).toLocaleString("hu-HU")} ${text(item.unit)}`, money(item.net_unit_price), money(item.net_total)].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    setText("publicNet", money(data.subtotal_net));
    setText("publicVat", `${money(data.vat_amount)} (${numberValue(data.vat_rate)}%)`);
    setText("publicGross", money(data.total_gross));
    setText("publicPaymentTerms", data.payment_terms || "Nincs külön megadva.");
    setText("publicNotes", data.notes || "");
    setText("publicValidUntil", data.valid_until ? new Date(data.valid_until).toLocaleString("hu-HU") : "nincs megadva");
    $("decisionName").value = data.client_name || "";
    $("decisionEmail").value = data.client_email || "";
    $("publicQuote").classList.remove("hidden");
    if (["accepted", "project_created", "rejected"].includes(data.status)) {
      showDecisionResult(data.status === "rejected" ? "rejected" : "accepted", data.decision_name, data.decided_at);
    } else if (data.status === "expired") {
      $("decisionPanel").classList.add("hidden");
      $("decisionResult").className = "decisionResult rejected";
      $("decisionResult").textContent = "Az ajánlati link érvényessége lejárt. Kérj új linket a vállalkozótól.";
    }
  }

  async function decide(decision, button) {
    const name = text($("decisionName").value);
    const email = text($("decisionEmail").value);
    const privacy = $("privacyAccepted").checked;
    const terms = $("termsAccepted").checked;
    if (name.length < 2) return statusMessage("Add meg a neved.", "error");
    if (!email.includes("@")) return statusMessage("Adj meg érvényes e-mail-címet.", "error");
    if (!privacy) return statusMessage("Az adatkezelési tudomásulvétel szükséges.", "error");
    if (decision === "accepted" && !terms) return statusMessage("Elfogadáshoz jelöld be az ajánlati feltételek elfogadását.", "error");
    const buttons = [$("acceptBtn"), $("rejectBtn")];
    buttons.forEach((item) => { item.disabled = true; });
    const original = button.textContent;
    button.textContent = "Rögzítés…";
    try {
      const { data, error } = await db.rpc("epitesi_decide_public_quote_v1", {
        p_token: token,
        p_decision: decision,
        p_name: name,
        p_email: email,
        p_comment: text($("decisionComment").value),
        p_terms_accepted: terms,
        p_privacy_accepted: privacy,
      });
      if (error) throw error;
      if (!data?.ok) {
        if (data?.error === "expired") throw new Error("Az ajánlati link érvényessége lejárt.");
        throw new Error("A döntést nem sikerült rögzíteni.");
      }
      const finalDecision = data.decision || decision;
      statusMessage(finalDecision === "accepted" ? "Az ajánlat elfogadását sikeresen rögzítettük." : "Az elutasítást sikeresen rögzítettük.", "ok");
      showDecisionResult(finalDecision, name, data.decided_at);
      setText("publicStatusBadge", labels[finalDecision]);
      $("publicStatusBadge").className = `quoteStatus ${finalDecision}`;
    } catch (error) {
      statusMessage(error.message || String(error), "error");
      buttons.forEach((item) => { item.disabled = false; });
      button.textContent = original;
    }
  }

  async function initialize() {
    if (!token || token.length < 32) return statusMessage("Az ajánlati link hiányos vagy érvénytelen.", "error");
    try {
      const { data, error } = await db.rpc("epitesi_get_public_quote_v1", { p_token: token });
      if (error) throw error;
      if (!data?.ok) {
        const label = data?.error === "invalid_link" ? "Az ajánlati link érvénytelen vagy visszavonták." : "Az ajánlat nem található.";
        throw new Error(label);
      }
      render(data);
      statusMessage("Az árajánlat biztonságosan betöltődött.", "ok");
    } catch (error) {
      statusMessage(error.message || String(error), "error");
    }
  }

  $("acceptBtn").addEventListener("click", (event) => decide("accepted", event.currentTarget));
  $("rejectBtn").addEventListener("click", (event) => decide("rejected", event.currentTarget));
  window.addEventListener("DOMContentLoaded", initialize);
})();
