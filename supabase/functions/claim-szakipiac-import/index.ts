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
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function num(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/\s/g, "").replace(/Ft|HUF/gi, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ft(value: unknown): string {
  return `${Math.round(num(value)).toLocaleString("hu-HU")} Ft`;
}

function text(value: unknown, fallback = ""): string {
  return String(value ?? fallback).trim();
}

function lower(value: unknown): string {
  return text(value).toLowerCase();
}

function pick(obj: any, keys: string[], fallback: unknown = ""): unknown {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  return fallback;
}

function isMissingObject(error: any) {
  const raw = String(error?.message || error || "");
  return /does not exist|schema cache|column .* not found|relation .* does not exist|42P01|42703/i.test(raw);
}

function classifyItem(item: any): "anyag" | "munka" | "egyeb" {
  const raw = [
    item?.type,
    item?.tipus,
    item?.category,
    item?.kategoria,
    item?.kind,
    item?.name,
    item?.megnevezes,
    item?.title,
  ].map(lower).join(" ");

  if (
    raw.includes("anyag") ||
    raw.includes("csemperagaszt") ||
    raw.includes("fugaz") ||
    raw.includes("fuga") ||
    raw.includes("laminalt") ||
    raw.includes("szegely") ||
    raw.includes("szilo") ||
    raw.includes("szilikon")
  ) return "anyag";

  if (
    raw.includes("munka") ||
    raw.includes("burkol") ||
    raw.includes("fest") ||
    raw.includes("vakol") ||
    raw.includes("szerkezet") ||
    raw.includes("villany") ||
    raw.includes("viz") ||
    raw.includes("homlokzat")
  ) return "munka";

  return "egyeb";
}

function getItems(payload: any): any[] {
  const candidates = [
    payload?.items,
    payload?.tetels,
    payload?.tetelek,
    payload?.quote?.items,
    payload?.quote?.tetels,
    payload?.data?.items,
    payload?.data?.tetels,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function normalizeItem(item: any, index: number) {
  const quantity = num(pick(item, ["qty", "quantity", "mennyiseg", "amountQty", "db"], 1)) || 1;
  const matUnit = num(pick(item, [
    "mat_unit_price",
    "material_unit_price",
    "anyag_egysegar",
    "anyagEgysegar",
    "materialUnit",
    "material_price",
    "anyagAr",
    "material",
    "anyag",
  ], 0));
  const labUnit = num(pick(item, [
    "lab_unit_price",
    "labor_unit_price",
    "munka_egysegar",
    "munkaEgysegar",
    "laborUnit",
    "labor_price",
    "munkaAr",
    "labor",
    "munka",
  ], 0));
  const materialTotal = num(pick(item, [
    "material_total",
    "materialTotal",
    "anyag_osszesen",
    "anyagOsszesen",
    "matTotal",
  ], 0)) || quantity * matUnit;
  const laborTotal = num(pick(item, [
    "labor_total",
    "laborTotal",
    "munka_osszesen",
    "munkaOsszesen",
    "labTotal",
  ], 0)) || quantity * labUnit;
  const total = num(pick(item, [
    "total",
    "subtotal",
    "reszosszeg",
    "line_total",
    "lineTotal",
    "sum",
    "osszesen",
  ], 0)) || materialTotal + laborTotal;

  const name = text(pick(item, ["name", "megnevezes", "title", "label"], `Tétel ${index + 1}`));
  const unit = text(pick(item, ["unit", "egyseg"], "db"));
  const forcedType = lower(pick(item, ["type", "tipus"], ""));
  let type = classifyItem({ ...item, name });
  if (forcedType.includes("anyag")) type = "anyag";
  if (forcedType.includes("munka")) type = "munka";
  if (forcedType.includes("egy")) type = "egyeb";

  return {
    name,
    type,
    quantity,
    unit,
    mat_unit_price: matUnit,
    lab_unit_price: labUnit,
    material_total: materialTotal,
    labor_total: laborTotal,
    total,
  };
}

function itemsText(items: any[]): string {
  if (!items.length) return "Nincs átvett tétel.";
  return items.map((item) => {
    const parts = [`- ${item.name}`, `típus: ${item.type}`, `mennyiség: ${item.quantity} ${item.unit}`];
    if (item.material_total) parts.push(`anyag: ${ft(item.material_total)}`);
    if (item.labor_total) parts.push(`munka: ${ft(item.labor_total)}`);
    if (item.total) parts.push(`összesen: ${ft(item.total)}`);
    return parts.join(" | ");
  }).join("\n");
}

async function optionalInsert(admin: any, table: string, rowOrRows: any, warnings: string[]) {
  const { error } = await admin.from(table).insert(rowOrRows);
  if (!error) return true;
  if (isMissingObject(error)) {
    warnings.push(`${table}: hiányzó tábla/oszlop, az alap projekt ettől még létrejött.`);
    return false;
  }
  warnings.push(`${table}: ${error.message || error}`);
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Csak POST kérés engedélyezett." }, 405);

  const warnings: string[] = [];

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Az importáláshoz előbb be kell jelentkezni." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "Hiányzó Supabase secret." }, 500);
    }

    const { token } = await req.json().catch(() => ({}));
    if (!token) return json({ ok: false, error: "Hiányzó import token." }, 400);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
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
    if (!reqRow) return json({ ok: false, error: "Nem található import link." }, 404);
    if (reqRow.claimed_project_id) {
      return json({ ok: true, already_claimed: true, project_id: reqRow.claimed_project_id, warnings });
    }

    const payload = reqRow.payload || {};
    const client = payload.client || {};
    const totals = payload.totals || {};
    const items = getItems(payload).map(normalizeItem).filter((item: any) => item.name);

    const projectName = text(reqRow.project_name || payload.project_name || payload.projectName || "SzakiPiac ajánlat");
    const clientName = text(reqRow.client_name || client.name || payload.client_name || "");
    const clientEmail = text(reqRow.client_email || client.email || payload.client_email || "");
    const clientPhone = text(reqRow.client_phone || client.phone || payload.client_phone || "");
    const clientCity = text(reqRow.client_city || client.city || payload.client_city || "");
    const clientAddress = text(reqRow.client_address || client.address || payload.client_address || "");
    const location = [clientCity, clientAddress].filter(Boolean).join(", ");

    const grossTotal =
      num(reqRow.quote_total_gross) ||
      num(totals.grossTotal) ||
      num(totals.gross_total) ||
      num(totals.brutto) ||
      num(totals.totalGross) ||
      num(totals.gross) ||
      num(totals.brutto) ||
      items.reduce((sum: number, item: any) => sum + num(item.total), 0);

    const sumMat =
      num(totals.sumMat) ||
      num(totals.materialTotal) ||
      num(totals.material_total) ||
      num(totals.sumMaterial) ||
      items.reduce((sum: number, item: any) => sum + num(item.material_total), 0);

    const sumLab =
      num(totals.sumLab) ||
      num(totals.laborTotal) ||
      num(totals.labor_total) ||
      num(totals.sumLabor) ||
      items.reduce((sum: number, item: any) => sum + num(item.labor_total), 0);

    const vatAmount = num(totals.vatAmount) || Math.max(0, grossTotal - sumMat - sumLab);
    const mainWork = items.find((item: any) => item.type === "munka") || items[0];

    const { data: project, error: projectError } = await admin
      .from("projects")
      .insert({
        user_id: userId,
        name: projectName,
        location: location || null,
      })
      .select("*")
      .single();

    if (projectError) return json({ ok: false, error: "Projekt létrehozási hiba: " + projectError.message }, 500);

    await optionalInsert(admin, "project_imports", {
      project_id: project.id,
      source_app: "szakipiac",
      source_quote_id: reqRow.source_quote_id,
      client_name: clientName || null,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      client_city: clientCity || null,
      client_address: clientAddress || null,
      quote_total_gross: grossTotal || null,
      payload,
    }, warnings);

    const note = [
      payload?.source_type === "kivitelezes_pro" ? "SzakiPiac KivitelezésPRO projekt importálva." : "SzakiPiac ajánlat importálva.",
      "",
      `Projekt: ${projectName}`,
      `Megrendelő: ${clientName || "nincs megadva"}`,
      `E-mail: ${clientEmail || "nincs megadva"}`,
      `Telefon: ${clientPhone || "nincs megadva"}`,
      `Helyszín: ${location || "nincs megadva"}`,
      `Bruttó ajánlati összeg: ${ft(grossTotal)}`,
      `Anyag nettó: ${ft(sumMat)}`,
      `Munkadíj nettó: ${ft(sumLab)}`,
      `ÁFA: ${ft(vatAmount)}`,
      "",
      "Átvett tételek:",
      itemsText(items),
    ].join("\n");

    const baseEntry = {
      user_id: userId,
      project_id: project.id,
      phase: mainWork?.name || "SzakiPiac import",
      status: "folyamatban",
      priority: "normál",
      responsible: clientName || null,
      note,
      ai_title: payload?.source_type === "kivitelezes_pro" ? "SzakiPiac KivitelezésPRO projekt importálva" : "SzakiPiac ajánlat importálva",
      ai_advice: { source: "szakipiac", totals, client, items },
    };

    let entryResult = await admin
      .from("entries")
      .insert({
        ...baseEntry,
        ai_json: { source: "szakipiac", totals, client, items },
        materials_json: items,
        location_address: location || null,
      })
      .select("id")
      .single();

    if (entryResult.error && isMissingObject(entryResult.error)) {
      entryResult = await admin.from("entries").insert(baseEntry).select("id").single();
    }

    if (entryResult.error) {
      return json({ ok: false, error: "Naplóbejegyzés mentési hiba: " + entryResult.error.message }, 500);
    }

    const entry = entryResult.data;

    const materialRows = items
      .filter((item: any) => item.type === "anyag")
      .map((item: any) => ({
        user_id: userId,
        project_id: project.id,
        entry_id: entry.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        note: `SzakiPiac import - egységár: ${ft(item.mat_unit_price)} - összesen: ${ft(item.material_total || item.total)}`,
      }));
    if (materialRows.length) await optionalInsert(admin, "project_materials", materialRows, warnings);

    const taskRows = items
      .filter((item: any) => item.type === "munka" || item.type === "egyeb")
      .map((item: any) => ({
        user_id: userId,
        project_id: project.id,
        source_entry_id: entry.id,
        title: `${item.name} - ${item.quantity} ${item.unit} - ${ft(item.labor_total || item.total)}`,
        owner: clientName || "",
        deadline: null,
        priority: "normál",
        done: false,
      }));
    if (taskRows.length) await optionalInsert(admin, "tasks", taskRows, warnings);

    if (grossTotal > 0) {
      await optionalInsert(admin, "project_invoices", {
        user_id: userId,
        project_id: project.id,
        entry_id: entry.id,
        title: "SzakiPiac importált ajánlat",
        amount: grossTotal,
        note,
        file_name: "",
        file_type: "",
        file_data: null,
      }, warnings);
    }

    await optionalInsert(admin, "diary_entries", {
      user_id: userId,
      project_id: project.id,
      description: note,
      work_type: mainWork?.name || "SzakiPiac import",
    }, warnings);

    const { error: updateError } = await admin.from("project_import_requests").update({
      claimed_by: userId,
      claimed_project_id: project.id,
      claimed_at: new Date().toISOString(),
    }).eq("id", reqRow.id);
    if (updateError) warnings.push("project_import_requests frissítési hiba: " + updateError.message);

    return json({
      ok: true,
      project_id: project.id,
      project,
      entry_id: entry.id,
      inserted: {
        materials: materialRows.length,
        tasks: taskRows.length,
        invoice: grossTotal > 0 ? 1 : 0,
      },
      warnings,
    });
  } catch (error) {
    return json({ ok: false, error: String((error as Error)?.message || error), warnings }, 500);
  }
});
