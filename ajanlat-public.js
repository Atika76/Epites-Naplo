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
  const huDate = (value, withTime = false) => {
    if (!value) return "nincs megadva";
    const date = new Date(value);
    return withTime ? date.toLocaleString("hu-HU") : date.toLocaleDateString("hu-HU");
  };
  const categoryLabel = (value) => ({ anyag: "Anyag", munkadij: "Munkadíj", egyeb: "Egyéb" }[value] || "Egyéb");
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
    result.innerHTML = "";
    const message = document.createElement("p");
    message.textContent = decision === "accepted"
      ? `Köszönjük, ${name || ""}! Az ajánlat elfogadását rögzítettük (${date}). A vállalkozó most már elindíthatja belőle az Építési Napló projektet.`
      : `Az ajánlat elutasítását rögzítettük (${date}). A megjegyzést a vállalkozó látni fogja.`;
    result.appendChild(message);
    if (decision === "accepted") {
      const actions = document.createElement("div");
      actions.className = "decisionResultActions";
      const acceptedQuote = () => ({
        ...quote,
        status: "accepted",
        decision_name: name || quote?.decision_name,
        decided_at: decidedAt || quote?.decided_at,
        accepted_at: decidedAt || quote?.accepted_at,
      });
      const download = document.createElement("button");
      download.type = "button";
      download.className = "btn primary";
      download.textContent = "Elfogadott PDF letöltése";
      download.addEventListener("click", async () => {
        const original = download.textContent;
        download.disabled = true;
        download.textContent = "PDF készül…";
        try {
          await window.EpitesiQuoteDocuments.downloadPdf(acceptedQuote());
        } catch (error) {
          statusMessage(`A PDF mentése nem sikerült: ${error.message || error}`, "error");
        } finally {
          download.disabled = false;
          download.textContent = original;
        }
      });
      const share = document.createElement("button");
      share.type = "button";
      share.className = "btn ghost";
      share.textContent = "PDF megosztása";
      share.addEventListener("click", async () => {
        const original = share.textContent;
        share.disabled = true;
        share.textContent = "PDF készül…";
        try {
          const result = await window.EpitesiQuoteDocuments.sharePdf(acceptedQuote());
          if (!result?.shared) statusMessage("A készülék nem támogatja a fájlmegosztást, ezért a PDF letöltődött.", "ok");
        } catch (error) {
          statusMessage(`A PDF megosztása nem sikerült: ${error.message || error}`, "error");
        } finally {
          share.disabled = false;
          share.textContent = original;
        }
      });
      actions.append(download, share);
      result.appendChild(actions);
    }
  }

  function render(data) {
    quote = data;
    setText("publicProjectName", data.project_name);
    setText("publicQuoteNumber", `${data.quote_number}${data.quote_type === "supplement" ? " · PÓTMUNKA / KIEGÉSZÍTŐ AJÁNLAT" : ""}`);
    setText("publicStatusBadge", labels[data.status] || data.status);
    $("publicStatusBadge").className = `quoteStatus ${data.status || ""}`.trim();
    setText("publicIntro", data.introduction || "");
    if (text(data.contractor_logo_data).startsWith("data:image/")) {
      const image = document.createElement("img");
      image.src = data.contractor_logo_data;
      image.alt = "Vállalkozói logó";
      $("publicContractorLogo").innerHTML = "";
      $("publicContractorLogo").appendChild(image);
      $("publicContractorLogo").classList.remove("hidden");
    }
    setText("publicContractor", [data.contractor_name, data.contractor_tax_number && `Adószám: ${data.contractor_tax_number}`, data.contractor_address, data.contractor_phone, data.contractor_email].filter(Boolean).join("\n") || "Nincs megadva.");
    setText("publicClient", [data.client_name, data.client_email].filter(Boolean).join("\n") || "Nincs megadva.");
    setText("publicIssueDate", huDate(data.issue_date));
    setText("publicValidUntil", huDate(data.valid_until));
    setText("publicDecisionDate", data.decided_at ? huDate(data.decided_at, true) : "—");
    setText("publicWorkAddress", data.work_address || "nincs megadva");
    setText("publicWorkStart", huDate(data.work_start_date));
    setText("publicWorkEnd", huDate(data.work_end_date));
    const body = $("publicItems");
    body.innerHTML = "";
    (Array.isArray(data.items) ? data.items : []).forEach((item) => {
      const row = document.createElement("tr");
      [
        categoryLabel(item.category),
        text(item.sku) || "—",
        [text(item.name), text(item.description)].filter(Boolean).join("\n"),
        `${numberValue(item.quantity).toLocaleString("hu-HU")} ${text(item.unit)}`,
        money(item.net_unit_price),
        `${numberValue(item.discount_percent).toLocaleString("hu-HU")}%`,
        money(item.net_total),
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    setText("publicBeforeDiscount", money(data.subtotal_before_discount));
    setText("publicDiscount", `− ${money(data.discount_amount)}`);
    setText("publicNet", money(data.subtotal_net));
    setText("publicVat", `${money(data.vat_amount)} (${numberValue(data.vat_rate)}%)`);
    setText("publicGross", money(data.total_gross));
    setText("publicPaymentTerms", data.payment_terms || "Nincs külön megadva.");
    setText("publicWarranty", data.warranty_terms || "Nincs külön megadva.");
    setText("publicExclusions", data.exclusions || "Nincs külön megadva.");
    setText("publicNotes", data.notes || "Nincs külön megjegyzés.");
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
      quote = {
        ...quote,
        status: finalDecision,
        decision_name: name,
        decision_email: email,
        decision_comment: text($("decisionComment").value),
        decided_at: data.decided_at,
        accepted_at: finalDecision === "accepted" ? data.decided_at : quote?.accepted_at,
      };
      statusMessage(finalDecision === "accepted" ? "Az ajánlat elfogadását sikeresen rögzítettük." : "Az elutasítást sikeresen rögzítettük.", "ok");
      showDecisionResult(finalDecision, name, data.decided_at);
      setText("publicStatusBadge", labels[finalDecision]);
      $("publicStatusBadge").className = `quoteStatus ${finalDecision}`;
      setText("publicDecisionDate", huDate(data.decided_at, true));
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
