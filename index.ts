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

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/\s/g, "").replace("Ft", "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function ft(v: unknown): string {
  return `${Math.round(num(v)).toLocaleString("hu-HU")} Ft`;
}

function txt(v: unknown, fallback = ""): string {
  return String(v ?? fallback).trim();
}

function lower(v: unknown): string {
  return txt(v).toLowerCase();
}

function pick(obj: any, keys: string[], fallback: unknown = ""): unknown {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return fallback;
}

function classifyItem(item: any): "anyag" | "munka" | "egyéb" {
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
    raw.includes("fugáz") ||
    raw.includes("fuga") ||
    raw.includes("laminált") ||
    raw.includes("szegély") ||
    raw.includes("sziló") ||
    raw.includes("szilikon")
  ) return "anyag";

  if (
    raw.includes("munka") ||
    raw.includes("burkol") ||
    raw.includes("fest") ||
    raw.includes("vakol") ||
    raw.includes("szerkezet") ||
    raw.includes("villany") ||
    raw.includes("víz") ||
    raw.includes("homlokzat")
  ) return "munka";

  return "egyéb";
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

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function normalizeItem(item: any, index: number) {
  const quantity =
    num(pick(item, ["qty", "quantity", "mennyiseg", "amountQty", "db"], 1)) || 1;

  const matUnit = num(pick(item, [
    "mat_unit_price",
    "material_unit_price",
    "anyag_egysegar",
    "anyagEgysegar",
    "materialUnit",
    "material_price",
    "anyagAr",
  ], 0));

  const labUnit = num(pick(item, [
    "lab_unit_price",
    "labor_unit_price",
    "munka_egysegar",
    "munkaEgysegar",
    "laborUnit",
    "labor_price",
    "munkaAr",
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

  const name = txt(pick(item, ["name", "megnevezes", "title", "label"], `Tétel ${index + 1}`));
  const unit = txt(pick(item, ["unit", "egyseg"], "db"));
  const forcedType = lower(pick(item, ["type", "tipus"], ""));
  let type = classifyItem({ ...item, name });
  if (forcedType.includes("anyag")) type = "anyag";
  if (forcedType.includes("munka")) type = "munka";
  if (forcedType.includes("egy")) type = "egyéb";

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
  return items.map((i) => {
    const parts = [`- ${i.name}`, `típus: ${i.type}`, `mennyiség: ${i.quantity} ${i.unit}`];
    if (i.material_total) parts.push(`anyag: ${ft(i.material_total)}`);
    if (i.labor_total) parts.push(`munka: ${ft(i.labor_total)}`);
    if (i.total) parts.push(`összesen: ${ft(i.total)}`);
    return parts.join(" | ");
  }).join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    if (userError || !userData?.user) {
      return json({ ok: false, error: "Érvénytelen bejelentkezés." }, 401);
    }

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
      return json({ ok: true, already_claimed: true, project_id: reqRow.claimed_project_id });
    }

    const payload = reqRow.payload || {};
    const client = payload.client || {};
    const totals = payload.totals || {};
    const items = getItems(payload).map(normalizeItem).filter((i: any) => i.name);

    const projectName = txt(reqRow.project_name || payload.project_name || payload.projectName || "SzakiPiac ajánlat");
    const clientName = txt(reqRow.client_name || client.name || payload.client_name || "");
    const clientEmail = txt(reqRow.client_email || client.email || payload.client_email || "");
    const clientPhone = txt(reqRow.client_phone || client.phone || payload.client_phone || "");
    const clientCity = txt(reqRow.client_city || client.city || payload.client_city || "");
    const clientAddress = txt(reqRow.client_address || client.address || payload.client_address || "");
    const location = [clientCity, clientAddress].filter(Boolean).join(", ");

    const grossTotal =
      num(reqRow.quote_total_gross) ||
      num(totals.grossTotal) ||
      num(totals.gross_total) ||
      num(totals.brutto) ||
      num(totals.totalGross) ||
      items.reduce((s: number, i: any) => s + num(i.total), 0);

    const sumMat =
      num(totals.sumMat) ||
      num(totals.materialTotal) ||
      items.reduce((s: number, i: any) => s + num(i.material_total), 0);

    const sumLab =
      num(totals.sumLab) ||
      num(totals.laborTotal) ||
      items.reduce((s: number, i: any) => s + num(i.labor_total), 0);

    const vatAmount = num(totals.vatAmount) || Math.max(0, grossTotal - sumMat - sumLab);
    const mainWork = items.find((i: any) => i.type === "munka") || items[0];

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

    const { error: importError } = await admin.from("project_imports").insert({
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
    });

    if (importError) return json({ ok: false, error: "Import adat mentési hiba: " + importError.message }, 500);

    const note = [
      "SzakiPiac ajánlat importálva.",
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

    const { data: entry, error: entryError } = await admin
      .from("entries")
      .insert({
        user_id: userId,
        project_id: project.id,
        phase: mainWork?.name || "SzakiPiac import",
        status: "folyamatban",
        priority: "normál",
        responsible: clientName || null,
        note,
        ai_title: "SzakiPiac ajánlat importálva",
        ai_json: { source: "szakipiac", totals, client, items },
        materials_json: items,
        location_address: location || null,
      })
      .select("id")
      .single();

    if (entryError) return json({ ok: false, error: "Naplóbejegyzés mentési hiba: " + entryError.message }, 500);

    const materialRows = items
      .filter((i: any) => i.type === "anyag")
      .map((i: any) => ({
        user_id: userId,
        project_id: project.id,
        entry_id: entry.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        note: `SzakiPiac import • egységár: ${ft(i.mat_unit_price)} • összesen: ${ft(i.material_total || i.total)}`,
      }));

    if (materialRows.length > 0) {
      const { error } = await admin.from("project_materials").insert(materialRows);
      if (error) return json({ ok: false, error: "project_materials mentési hiba: " + error.message, materialRows }, 500);
    }

    const taskRows = items
      .filter((i: any) => i.type === "munka" || i.type === "egyéb")
      .map((i: any) => ({
        user_id: userId,
        project_id: project.id,
        source_entry_id: entry.id,
        title: `${i.name} – ${i.quantity} ${i.unit} – ${ft(i.labor_total || i.total)}`,
        owner: clientName || "",
        deadline: null,
        priority: "normál",
        done: false,
      }));

    if (taskRows.length > 0) {
      const { error } = await admin.from("tasks").insert(taskRows);
      if (error) return json({ ok: false, error: "tasks mentési hiba: " + error.message, taskRows }, 500);
    }

    if (grossTotal > 0) {
      const { error } = await admin.from("project_invoices").insert({
        user_id: userId,
        project_id: project.id,
        title: "SzakiPiac importált ajánlat",
        amount: grossTotal,
        note,
        file_name: "",
        file_type: "",
        file_data: null,
      });

      if (error) return json({ ok: false, error: "project_invoices mentési hiba: " + error.message }, 500);
    }

    const { error: diaryError } = await admin.from("diary_entries").insert({
      project_id: project.id,
      description: note,
      work_type: mainWork?.name || "SzakiPiac import",
    });

    if (diaryError) return json({ ok: false, error: "diary_entries mentési hiba: " + diaryError.message }, 500);

    await admin.from("project_import_requests").update({
      claimed_by: userId,
      claimed_project_id: project.id,
      claimed_at: new Date().toISOString(),
    }).eq("id", reqRow.id);

    return json({
      ok: true,
      project_id: project.id,
      project,
      entry_id: entry.id,
      inserted: {
        materials: materialRows.length,
        tasks: taskRows.length,
        invoice: grossTotal > 0 ? 1 : 0,
        diary: 1,
      },
    });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err) }, 500);
  }
});
