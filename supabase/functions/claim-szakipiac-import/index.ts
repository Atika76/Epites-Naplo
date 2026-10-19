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
  const quantity = num(pick(item, ["qty", "quantity", "mennyiseg", "amountQty", "db"], 1));
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

    const { token, restore_deleted_project } = await req.json().catch(() => ({}));
    if (!token) return json({ ok: false, error: "Hiányzó import token." }, 400);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ ok: false, error: "Érvénytelen bejelentkezés." }, 401);

    const userId = userData.user.id;
    const userEmail = lower(userData.user.email);
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: reqRow, error: reqError } = await admin
      .from("project_import_requests")
      .select("*")
      .eq("token", String(token))
      .maybeSingle();

    if (reqError) return json({ ok: false, error: "Import lekérési hiba: " + reqError.message }, 500);
    if (!reqRow) return json({ ok: false, error: "Nem található import link." }, 404);
    const payload = reqRow.payload || {};
    // Token possession alone cannot move a quote into an unrelated account.
    if (reqRow.protocol_version === 2 && String(reqRow.verified_owner_email).toLowerCase() !== userEmail) {
      return json({ ok: false, error: "Az ajánlat tulajdonosának Építési Napló fiókjával jelentkezz be." }, 403);
    }
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

    const { data: result, error: importError } = await admin.rpc("claim_szakipiac_import_v2", {
      p_token: String(token), p_user_id: userId,
      p_plan: { restore_deleted: restore_deleted_project === true, location, phase: mainWork?.name || "SzakiPiac import", note, items, ai: { source: "szakipiac", totals, client, items } },
    });
    if (importError) return json({ ok: false, error: importError.message }, 409);
    if (!result?.ok) return json(result, 409);
    const bundle = payload.bundle_entitlement || {};
    const expiry = text(bundle.expires_at);
    if (bundle.plan === "bundle" && lower(bundle.user_email) === userEmail
      && (!expiry || new Date(expiry).getTime() >= Date.now())) {
      const { error: bundleError } = await admin.from("shared_bundle_entitlements").upsert({
        user_id: userId, source_app: "szakipiac", source_email: userEmail, plan: "bundle",
        expires_at: expiry || null, verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (bundleError) {
        result.warnings = [...(result.warnings || []), "A közös csomag jogosultságának átvétele nem sikerült: " + bundleError.message];
        // Keep auxiliary warnings durable too. Core import status/counts remain authoritative.
        await admin.from("project_import_requests").update({ import_warnings: result.warnings }).eq("id", reqRow.id);
      }
    }
    return json(result);
  } catch (error) {
    return json({ ok: false, error: String((error as Error)?.message || error), warnings }, 500);
  }
});
