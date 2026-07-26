(() => {
  "use strict";

  const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = (value) => `${Math.round(numberValue(value)).toLocaleString("hu-HU")} Ft`;
  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  const huDate = (value, withTime = false) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return withTime ? date.toLocaleString("hu-HU") : date.toLocaleDateString("hu-HU");
  };
  const safeFileName = (value) => String(value || "ajanlat")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "ajanlat";
  const categoryLabel = (value) => ({ anyag: "Anyag", munkadij: "Munkadíj", egyeb: "Egyéb" }[value] || "Egyéb");
  const outcomeLabel = (value) => ({
    active: "Aktív",
    completed: "Munka befejezve",
    cancelled: "Munka meghiúsult",
  }[value] || "Aktív");

  function lockedQuote(quote) {
    const snapshot = quote?.accepted_snapshot;
    if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
      return {
        ...quote,
        ...snapshot,
        accepted_snapshot: snapshot,
        outcome: quote.outcome || "active",
        outcome_reason: quote.outcome_reason || "",
        outcome_at: quote.outcome_at || null,
        archived_at: quote.archived_at || null,
      };
    }
    return { ...(quote || {}) };
  }

  function buildBody(quoteInput) {
    const quote = lockedQuote(quoteInput);
    const items = Array.isArray(quote.items) ? quote.items : [];
    const decisionDate = quote.accepted_at || quote.decided_at || quote.accepted_snapshot_created_at;
    const logo = String(quote.contractor_logo_data || "").startsWith("data:image/")
      ? `<img class="logo" src="${escapeHtml(quote.contractor_logo_data)}" alt="Vállalkozói logó">`
      : "";
    const itemRows = items.map((item) => `<tr>
      <td>${escapeHtml(categoryLabel(item.category))}</td>
      <td>${escapeHtml(item.sku || "—")}</td>
      <td><b>${escapeHtml(item.name || "")}</b>${item.description ? `<br><small>${escapeHtml(item.description)}</small>` : ""}</td>
      <td>${escapeHtml(numberValue(item.quantity).toLocaleString("hu-HU"))} ${escapeHtml(item.unit || "")}</td>
      <td>${money(item.net_unit_price)}</td>
      <td>${escapeHtml(numberValue(item.discount_percent).toLocaleString("hu-HU"))}%</td>
      <td>${money(item.net_total)}</td>
    </tr>`).join("");
    const archive = quote.outcome && quote.outcome !== "active"
      ? `<section class="archive"><b>${escapeHtml(outcomeLabel(quote.outcome))}</b><br>
          Rögzítve: ${huDate(quote.outcome_at, true)}
          ${quote.outcome_reason ? `<br>Indoklás: ${escapeHtml(quote.outcome_reason)}` : ""}
        </section>`
      : "";

    return `<div class="quoteDocument">
      <header>
        <div class="headleft">${logo}<div>
          <small>${quote.quote_type === "supplement" ? "PÓTMUNKA / KIEGÉSZÍTŐ AJÁNLAT" : "ÁRAJÁNLAT"}</small>
          <h1>${escapeHtml(quote.project_name || "Árajánlat")}</h1>
          <b>${escapeHtml(quote.quote_number || "")}</b>
        </div></div>
        <div><b>${escapeHtml(quote.contractor_name || "")}</b><br>
          ${quote.contractor_tax_number ? `Adószám: ${escapeHtml(quote.contractor_tax_number)}<br>` : ""}
          ${escapeHtml(quote.contractor_address || "")}<br>
          ${escapeHtml(quote.contractor_phone || "")}<br>
          ${escapeHtml(quote.contractor_email || "")}
        </div>
      </header>
      <div class="acceptedStamp">
        <b>✓ ZÁROLT, ÜGYFÉL ÁLTAL ELFOGADOTT PÉLDÁNY</b><br>
        Elfogadás időpontja: ${huDate(decisionDate, true)}<br>
        Elfogadó: ${escapeHtml(quote.decision_name || "—")} ${quote.decision_email ? `(${escapeHtml(quote.decision_email)})` : ""}
      </div>
      ${archive}
      <div class="meta">
        <div class="box"><b>Kiállítás</b><br>${huDate(quote.issue_date)}</div>
        <div class="box"><b>Érvényes</b><br>${huDate(quote.valid_until)}</div>
        <div class="box"><b>Bruttó végösszeg</b><br>${money(quote.total_gross)}</div>
      </div>
      ${quote.introduction ? `<section class="copy">${escapeHtml(quote.introduction)}</section>` : ""}
      <div class="parties">
        <div class="box"><b>Megrendelő</b><br>${escapeHtml(quote.client_name || "—")}<br>${escapeHtml(quote.client_email || "")}<br>${escapeHtml(quote.client_phone || "")}<br>${escapeHtml([quote.client_city, quote.client_address].filter(Boolean).join(", "))}</div>
        <div class="box"><b>Munkavégzés helye</b><br>${escapeHtml(quote.work_address || "—")}</div>
        <div class="box"><b>Várható időszak</b><br>${huDate(quote.work_start_date)} – ${huDate(quote.work_end_date)}</div>
      </div>
      <table><thead><tr><th>Kategória</th><th>Cikkszám</th><th>Megnevezés</th><th>Mennyiség</th><th>Nettó egységár</th><th>Kedvezmény</th><th>Nettó összesen</th></tr></thead><tbody>${itemRows}</tbody></table>
      <div class="totals">
        <p><span>Kedvezmény előtti nettó</span><b>${money(quote.subtotal_before_discount)}</b></p>
        <p><span>Kedvezmény</span><b>− ${money(quote.discount_amount)}</b></p>
        <p><span>Nettó összesen</span><b>${money(quote.subtotal_net)}</b></p>
        <p><span>ÁFA (${numberValue(quote.vat_rate)}%)</span><b>${money(quote.vat_amount)}</b></p>
        <p class="gross"><span>Bruttó végösszeg</span><b>${money(quote.total_gross)}</b></p>
      </div>
      <div class="terms">
        <div class="box"><b>Fizetési feltételek</b><p>${escapeHtml(quote.payment_terms || "Nincs külön megadva.")}</p></div>
        <div class="box"><b>Garancia / jótállás</b><p>${escapeHtml(quote.warranty_terms || "Nincs külön megadva.")}</p></div>
        <div class="box"><b>Az ajánlat nem tartalmazza</b><p>${escapeHtml(quote.exclusions || "Nincs külön megadva.")}</p></div>
        <div class="box"><b>Megjegyzés</b><p>${escapeHtml(quote.notes || "Nincs külön megjegyzés.")}</p></div>
      </div>
      ${quote.decision_comment ? `<section class="decisionComment"><b>Ügyfél megjegyzése</b><p>${escapeHtml(quote.decision_comment)}</p></section>` : ""}
      <footer>A dokumentum az ÉpítésNapló rendszerben rögzített, utólag nem módosítható elfogadási példány alapján készült.</footer>
    </div>`;
  }

  function documentCss() {
    return `*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#152033;background:#fff;margin:0;padding:24px;line-height:1.45}.quoteDocument{max-width:1050px;margin:auto}header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #0ea5e9;padding-bottom:18px}.headleft{display:flex;gap:18px;align-items:center}.logo{max-width:170px;max-height:85px;object-fit:contain}h1{margin:.2em 0}.acceptedStamp{margin:18px 0;border:2px solid #16a34a;background:#ecfdf5;color:#14532d;border-radius:10px;padding:14px}.archive{margin:12px 0;border:1px solid #d97706;background:#fffbeb;border-radius:10px;padding:12px}.meta,.parties{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.box{border:1px solid #d7dee8;border-radius:8px;padding:10px;white-space:pre-line}.copy,.decisionComment{white-space:pre-wrap;margin:16px 0;padding:12px;background:#f8fafc;border-radius:8px}table{width:100%;border-collapse:collapse;margin:22px 0;font-size:12px}th,td{padding:9px 7px;border-bottom:1px solid #ccd5df;text-align:left}th:nth-child(n+4),td:nth-child(n+4){text-align:right}.totals{margin-left:auto;width:390px}.totals p{display:flex;justify-content:space-between}.gross{font-size:1.25em;border-top:2px solid #152033;padding-top:10px}.terms{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:20px}footer{margin-top:26px;border-top:1px solid #cbd5e1;padding-top:12px;color:#475569;font-size:12px}@media(max-width:720px){body{padding:14px}header{display:block}.meta,.parties,.terms{grid-template-columns:1fr}.totals{width:100%}table{font-size:10px}}`;
  }

  function buildHtml(quote) {
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Elfogadott árajánlat</title><style>${documentCss()}</style></head><body>${buildBody(quote)}</body></html>`;
  }

  async function createPdfBlob(quote) {
    if (typeof window.html2pdf !== "function") throw new Error("A PDF-készítő nem érhető el.");
    const stage = document.createElement("div");
    stage.style.position = "fixed";
    stage.style.left = "-99999px";
    stage.style.top = "0";
    stage.style.width = "1000px";
    stage.style.background = "#fff";
    stage.innerHTML = `<style>${documentCss()}</style>${buildBody(quote)}`;
    document.body.appendChild(stage);
    try {
      await Promise.all([...stage.querySelectorAll("img")].map((img) => img.complete
        ? Promise.resolve()
        : new Promise((resolve) => { img.onload = img.onerror = resolve; })));
      return await window.html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: `${safeFileName(quote.quote_number || quote.project_name)}-elfogadott.pdf`,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".acceptedStamp", ".box", "tr"] },
      }).from(stage).outputPdf("blob");
    } finally {
      stage.remove();
    }
  }

  function downloadBlob(filename, blob) {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(anchor.href);
      anchor.remove();
    }, 1500);
  }

  async function downloadPdf(quote) {
    const blob = await createPdfBlob(quote);
    downloadBlob(`${safeFileName(quote.quote_number || quote.project_name)}-elfogadott.pdf`, blob);
    return blob;
  }

  async function sharePdf(quote) {
    const blob = await createPdfBlob(quote);
    const filename = `${safeFileName(quote.quote_number || quote.project_name)}-elfogadott.pdf`;
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title: "Elfogadott árajánlat", text: quote.project_name || "Elfogadott árajánlat", files: [file] });
      return { shared: true, blob };
    }
    downloadBlob(filename, blob);
    return { shared: false, blob };
  }

  window.EpitesiQuoteDocuments = {
    lockedQuote,
    buildBody,
    buildHtml,
    createPdfBlob,
    downloadPdf,
    sharePdf,
    safeFileName,
  };
})();
