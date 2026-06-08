import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function num(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function ft(value: unknown) {
  return `${Math.round(num(value)).toLocaleString("hu-HU")} Ft`;
}

function text(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeType(value: unknown) {
  const t = text(value).toLowerCase();
  if (t.includes("munka")) return "munka";
  if (t.includes("anyag")) return "anyag";
  if (t.includes("egy")) return "egyéb";
  return t || "tétel";
}

function normalizeImportedItem(item: any, index: number) {
  const qty = num(item?.qty ?? item?.quantity ?? item?.mennyiseg ?? item?.amount ?? 0);
  const matUnit = num(item?.mat_unit_price ?? item?.material_unit_price ?? item?.anyag_egysegar ?? item?.anyagEgységár ?? 0);
  const labUnit = num(item?.lab_unit_price ?? item?.labor_unit_price ?? item?.munka_egysegar ?? item?.munkaEgységár ?? 0);
  const explicitTotal = num(item?.total ?? item?.subtotal ?? item?.reszosszeg ?? item?.line_total ?? item?.gross ?? 0);
  const materialTotal = qty * matUnit;
  const laborTotal = qty * labUnit;
  const total = explicitTotal || materialTotal + laborTotal;
  return {
    name: text(item?.name ?? item?.megnevezes ?? item?.title ?? item?.label, `Tétel ${index + 1}`),
    type: normalizeType(item?.type ?? item?.tipus),
    quantity: qty,
    unit: text(item?.unit ?? item?.egyseg ?? "db"),
    hours: num(item?.hours ?? item?.ora ?? 0),
    mat_unit_price: matUnit,
    lab_unit_price: labUnit,
    material_total: materialTotal,
    labor_total: laborTotal,
    total,
    selected: Boolean(item?.selected || false),
  };
}

function buildItemsText(items: any[]) {
  if (!items.length) return "Tétellista nem érkezett át.";
  return items.map((item) => {
    const qty = item.quantity ? ` – ${item.quantity} ${item.unit}` : "";
    const prices = [];
    if (item.material_total) prices.push(`anyag: ${ft(item.material_total)}`);
    if (item.labor_total) prices.push(`munka: ${ft(item.labor_total)}`);
    if (item.total && !prices.length) prices.push(`összesen: ${ft(item.total)}`);
    return `- ${item.name} (${item.type})${qty}${prices.length ? ` – ${prices.join(" + ")}` : ""}`;
  }).join("\n");
}

function buildInvoiceNote(reqRow: any, payload: any, items: any[]) {
  const totals = payload?.totals || {};
  return [
    "SzakiPiac ajánlat automatikus importból.",
    `Forrás ajánlat ID: ${reqRow.source_quote_id || "nincs"}`,
    `Nettó összesen: ${ft(totals.netTotal || 0)}`,
    `Anyag nettó: ${ft(totals.sumMat || 0)}`,
    `Munkadíj nettó: ${ft(totals.sumLab || 0)}`,
    `ÁFA: ${ft(totals.vatAmount || 0)}`,
    `Bruttó összesen: ${ft(reqRow.quote_total_gross || totals.grossTotal || 0)}`,
    "",
    "Tételek:",
    buildItemsText(items),
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Az importáláshoz előbb be kell jelentkezni az Építési Naplóba." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Hiányzó Supabase secret." }, 500);

    const { token } = await req.json().catch(() => ({}));
    if (!token) return json({ ok: false, error: "Hiányzó import token." }, 400);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ ok: false, error: "Érvénytelen bejelentkezés." }, 401);

    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: reqRow, error: reqError } = await admin
      .from("project_import_requests")
      .select("*")
      .eq("token", String(token))
      .maybeSingle();

    if (reqError) return json({ ok: false, error: "Import lekérési hiba: " + reqError.message }, 500);
    if (!reqRow) return json({ ok: false, error: "Nem található ilyen import link." }, 404);

    if (reqRow.claimed_project_id) {
      return json({ ok: true, already_claimed: true, project_id: reqRow.claimed_project_id });
    }

    if (reqRow.expires_at && new Date(reqRow.expires_at).getTime() < Date.now()) {
      return json({ ok: false, error: "Ez az import link lejárt." }, 410);
    }

    const payload = reqRow.payload || {};
    const items = Array.isArray(payload?.items) ? payload.items.map(normalizeImportedItem).filter((x: any) => x.name) : [];
    const totals = payload?.totals || {};
    const client = payload?.client || {};
    const location = [reqRow.client_city || client.city, reqRow.client_address || client.address].filter(Boolean).join(", ");
    const projectName = text(reqRow.project_name || payload?.project_name || "SzakiPiac ajánlat");
    const grossTotal = num(reqRow.quote_total_gross || totals.grossTotal || 0);
    const totalHours = num(totals.totalHours || items.reduce((s: number, item: any) => s + num(item.hours), 0));

    const projectInsert: Record<string, unknown> = {
      user_id: userId,
      name: projectName,
      location: location || null,
      status: "folyamatban",
      progress: 10,
      updated_at: new Date().toISOString(),
    };

    let { data: project, error: projectError } = await admin
      .from("projects")
      .insert(projectInsert)
      .select("*")
      .single();

    if (projectError && /progress|updated_at|status|location|column/i.test(String(projectError.message || ""))) {
      const fallback = { user_id: userId, name: projectName, location: location || null };
      const retry = await admin.from("projects").insert(fallback).select("*").single();
      project = retry.data;
      projectError = retry.error;
    }

    if (projectError) return json({ ok: false, error: "Projekt létrehozási hiba: " + projectError.message }, 500);

    const { error: importError } = await admin.from("project_imports").insert({
      project_id: project.id,
      source_app: "szakipiac",
      source_quote_id: reqRow.source_quote_id,
      client_name: reqRow.client_name || client.name || null,
      client_email: reqRow.client_email || client.email || null,
      client_phone: reqRow.client_phone || client.phone || null,
      client_city: reqRow.client_city || client.city || null,
      client_address: reqRow.client_address || client.address || null,
      quote_total_gross: grossTotal || null,
      payload,
    });
    if (importError) return json({ ok: false, error: "Import adat mentési hiba: " + importError.message }, 500);

    const materialsForEntry = items.map((item: any) => ({
      name: item.name,
      type: item.type,
      quantity: item.quantity,
      unit: item.unit,
      mat_unit_price: item.mat_unit_price,
      lab_unit_price: item.lab_unit_price,
      material_total: item.material_total,
      labor_total: item.labor_total,
      total: item.total,
      hours: item.hours,
    }));

    const mainWork = items.find((item: any) => item.type === "munka") || items.find((item: any) => item.lab_unit_price > 0) || items[0];
    const note = [
      "SzakiPiac ajánlat importálva.",
      "",
      `Projekt: ${projectName}`,
      `Megrendelő: ${reqRow.client_name || client.name || "nincs megadva"}`,
      `E-mail: ${reqRow.client_email || client.email || "nincs megadva"}`,
      `Telefon: ${reqRow.client_phone || client.phone || "nincs megadva"}`,
      `Helyszín: ${location || "nincs megadva"}`,
      `Bruttó ajánlati összeg: ${ft(grossTotal)}`,
      `Anyag nettó: ${ft(totals.sumMat || 0)}`,
      `Munkadíj nettó: ${ft(totals.sumLab || 0)}`,
      `ÁFA: ${ft(totals.vatAmount || 0)}`,
      `Becsült munkaóra: ${totalHours || 0} óra`,
      "",
      "Átvett tételek:",
      buildItemsText(items),
    ].join("\n");

    const { data: entry, error: entryError } = await admin.from("entries").insert({
      user_id: userId,
      project_id: project.id,
      phase: mainWork?.name || "SzakiPiac import",
      status: "folyamatban",
      priority: "normál",
      responsible: reqRow.client_name || client.name || null,
      weather: null,
      note,
      ai_level: "Alacsony",
      ai_score: 0,
      ai_title: "SzakiPiac ajánlat importálva",
      ai_advice: [],
      ai_json: {
        source: "szakipiac",
        quote_total_gross: grossTotal,
        totals,
        client: {
          name: reqRow.client_name || client.name || null,
          email: reqRow.client_email || client.email || null,
          phone: reqRow.client_phone || client.phone || null,
          city: reqRow.client_city || client.city || null,
          address: reqRow.client_address || client.address || null,
        },
        items,
      },
      materials_json: materialsForEntry,
      location_address: location || null,
    }).select("id").single();

    if (entryError) return json({ ok: false, error: "Naplóbejegyzés mentési hiba: " + entryError.message }, 500);

    const warnings: string[] = [];

    const materialRows = items
      .filter((item: any) => item.type === "anyag" || item.mat_unit_price > 0)
      .map((item: any) => ({
        user_id: userId,
        project_id: project.id,
        entry_id: entry?.id || null,
        name: item.name,
        quantity: item.quantity || 1,
        unit: item.unit || "db",
        note: [
          "SzakiPiac import",
          item.mat_unit_price ? `Anyag egységár: ${ft(item.mat_unit_price)}` : "",
          item.material_total ? `Anyag összesen: ${ft(item.material_total)}` : "",
          item.lab_unit_price ? `Kapcsolódó munkadíj egységár: ${ft(item.lab_unit_price)}` : "",
        ].filter(Boolean).join(" • "),
      }));

    if (materialRows.length) {
      const { error } = await admin.from("project_materials").insert(materialRows);
      if (error) warnings.push("Anyaglista mentési hiba: " + error.message);
    }

    const taskRows = items
      .filter((item: any) => item.type === "munka" || item.lab_unit_price > 0)
      .map((item: any) => ({
        user_id: userId,
        project_id: project.id,
        source_entry_id: entry?.id || null,
        title: `${item.name}${item.quantity ? ` – ${item.quantity} ${item.unit}` : ""}${item.labor_total ? ` – ${ft(item.labor_total)}` : ""}`,
        owner: reqRow.client_name || client.name || "",
        deadline: null,
        priority: "normál",
        done: false,
      }));

    if (taskRows.length) {
      const { error } = await admin.from("tasks").insert(taskRows);
      if (error) warnings.push("Munkafázis / teendő mentési hiba: " + error.message);
    }

    if (grossTotal) {
      const { error } = await admin.from("project_invoices").insert({
        user_id: userId,
        project_id: project.id,
        title: "SzakiPiac importált ajánlat",
        amount: grossTotal,
        note: buildInvoiceNote(reqRow, payload, items),
        file_name: "",
        file_type: "",
        file_data: null,
      });
      if (error) warnings.push("Költség / ajánlatösszeg mentési hiba: " + error.message);
    }

    await admin.from("project_import_requests").update({
      claimed_by: userId,
      claimed_project_id: project.id,
      claimed_at: new Date().toISOString(),
    }).eq("id", reqRow.id);

    return json({ ok: true, project_id: project.id, project, entry_id: entry?.id || null, warnings });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err) }, 500);
  }
});
