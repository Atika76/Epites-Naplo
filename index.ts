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

function num(v: unknown) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function ft(v: unknown) {
  return `${Math.round(num(v)).toLocaleString("hu-HU")} Ft`;
}

function txt(v: unknown, fallback = "") {
  return String(v ?? fallback).trim();
}

function typeOfItem(v: unknown) {
  const t = txt(v).toLowerCase();
  if (t.includes("anyag")) return "anyag";
  if (t.includes("munka")) return "munka";
  if (t.includes("egy")) return "egyéb";
  return t || "tétel";
}

function normalizeItem(item: any, index: number) {
  const quantity = num(item?.qty ?? item?.quantity ?? item?.mennyiseg ?? 1) || 1;
  const matUnit = num(item?.mat_unit_price ?? item?.material_unit_price ?? item?.anyag_egysegar ?? 0);
  const labUnit = num(item?.lab_unit_price ?? item?.labor_unit_price ?? item?.munka_egysegar ?? 0);
  const total = num(item?.total ?? item?.subtotal ?? item?.reszosszeg ?? item?.line_total ?? 0) || quantity * (matUnit + labUnit);

  return {
    name: txt(item?.name ?? item?.megnevezes ?? item?.title ?? item?.label, `Tétel ${index + 1}`),
    type: typeOfItem(item?.type ?? item?.tipus),
    quantity,
    unit: txt(item?.unit ?? item?.egyseg ?? "db"),
    hours: num(item?.hours ?? item?.ora ?? 0),
    mat_unit_price: matUnit,
    lab_unit_price: labUnit,
    material_total: quantity * matUnit,
    labor_total: quantity * labUnit,
    total,
  };
}

function itemsText(items: any[]) {
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
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Hiányzó Supabase secret." }, 500);

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
    if (reqRow.claimed_project_id) return json({ ok: true, already_claimed: true, project_id: reqRow.claimed_project_id });

    const payload = reqRow.payload || {};
    const client = payload.client || {};
    const totals = payload.totals || {};
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items = rawItems.map(normalizeItem).filter((i: any) => i.name);

    const projectName = txt(reqRow.project_name || payload.project_name || "SzakiPiac ajánlat");
    const clientName = txt(reqRow.client_name || client.name || "");
    const clientEmail = txt(reqRow.client_email || client.email || "");
    const clientPhone = txt(reqRow.client_phone || client.phone || "");
    const clientCity = txt(reqRow.client_city || client.city || "");
    const clientAddress = txt(reqRow.client_address || client.address || "");
    const location = [clientCity, clientAddress].filter(Boolean).join(", ");
    const grossTotal = num(reqRow.quote_total_gross || totals.grossTotal || totals.gross || 0);
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

    const warnings: string[] = [];

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
      `Anyag nettó: ${ft(totals.sumMat || 0)}`,
      `Munkadíj nettó: ${ft(totals.sumLab || 0)}`,
      `ÁFA: ${ft(totals.vatAmount || 0)}`,
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
      .filter((i: any) => i.type === "anyag" || i.mat_unit_price > 0)
      .map((i: any) => ({
        user_id: userId,
        project_id: project.id,
        entry_id: entry.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        note: `SzakiPiac import • Anyag egységár: ${ft(i.mat_unit_price)} • Anyag összesen: ${ft(i.material_total)}`,
      }));

    if (materialRows.length) {
      const { error } = await admin.from("project_materials").insert(materialRows);
      if (error) warnings.push("project_materials hiba: " + error.message);
    }

    const taskRows = items
      .filter((i: any) => i.type === "munka" || i.lab_unit_price > 0)
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

    if (taskRows.length) {
      const { error } = await admin.from("tasks").insert(taskRows);
      if (error) warnings.push("tasks hiba: " + error.message);
    }

    if (grossTotal) {
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
      if (error) warnings.push("project_invoices hiba: " + error.message);
    }

    await admin.from("diary_entries").insert({
      project_id: project.id,
      description: note,
      work_type: mainWork?.name || "SzakiPiac import",
    }).then(({ error }) => {
      if (error) warnings.push("diary_entries hiba: " + error.message);
    });

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
        invoice: grossTotal ? 1 : 0,
      },
      warnings,
    });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err) }, 500);
  }
});