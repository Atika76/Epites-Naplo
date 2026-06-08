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

function ft(value: unknown) {
  const n = Number(value || 0);
  return n ? `${Math.round(n).toLocaleString("hu-HU")} Ft` : "0 Ft";
}

function normalizeItem(item: any = {}) {
  const qty = Number(item.qty || item.quantity || item.mennyiseg || item.amount || 0) || 0;
  const matUnit = Number(item.mat_unit_price || item.material_unit_price || item.anyag_egysegar || 0) || 0;
  const labUnit = Number(item.lab_unit_price || item.labor_unit_price || item.munka_egysegar || 0) || 0;
  const explicitTotal = Number(item.total || item.subtotal || item.reszosszeg || item.line_total || 0) || 0;
  return {
    name: String(item.name || item.megnevezes || item.title || item.label || "Tétel"),
    type: String(item.type || item.tipus || ""),
    quantity: qty,
    qty,
    unit: String(item.unit || item.egyseg || ""),
    mat_unit_price: matUnit,
    lab_unit_price: labUnit,
    total: explicitTotal || (qty * matUnit) + (qty * labUnit),
  };
}

function getPayloadItems(payload: any) {
  const raw = payload?.items || payload?.tetel_lista || payload?.tetelList || payload?.lines || [];
  return Array.isArray(raw) ? raw.map(normalizeItem) : [];
}

function buildItemsText(items: any[]) {
  if (!Array.isArray(items) || !items.length) return "Tétellista nem érkezett át.";
  return items.map((item) => {
    const totalText = item.total ? ` – ${ft(item.total)}` : "";
    const typeText = item.type ? ` (${item.type})` : "";
    const qtyText = item.quantity ? ` – ${item.quantity} ${item.unit || ""}` : "";
    return `- ${item.name}${typeText}${qtyText}${totalText}`;
  }).join("\n");
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
    if (reqRow.claimed_project_id) return json({ ok: true, already_claimed: true, project_id: reqRow.claimed_project_id });
    if (reqRow.expires_at && new Date(reqRow.expires_at).getTime() < Date.now()) return json({ ok: false, error: "Ez az import link lejárt." }, 410);

    const payload = reqRow.payload || {};
    const items = getPayloadItems(payload);
    const location = [reqRow.client_city, reqRow.client_address].filter(Boolean).join(", ");
    const projectName = reqRow.project_name || payload.project_name || payload.projectName || "SzakiPiac ajánlat";

    const projectInsert: Record<string, unknown> = {
      user_id: userId,
      name: projectName,
    };
    if (location) projectInsert.location = location;

    const { data: project, error: projectError } = await admin
      .from("projects")
      .insert(projectInsert)
      .select("*")
      .single();

    if (projectError) return json({ ok: false, error: "Projekt létrehozási hiba: " + projectError.message }, 500);

    const { error: importError } = await admin.from("project_imports").insert({
      project_id: project.id,
      source_app: "szakipiac",
      source_quote_id: reqRow.source_quote_id,
      client_name: reqRow.client_name,
      client_email: reqRow.client_email,
      client_phone: reqRow.client_phone,
      client_city: reqRow.client_city,
      client_address: reqRow.client_address,
      quote_total_gross: reqRow.quote_total_gross,
      payload,
    });
    if (importError) return json({ ok: false, error: "Import adat mentési hiba: " + importError.message }, 500);

    const note = [
      "SzakiPiac ajánlat importálva.",
      "",
      `Projekt: ${projectName}`,
      `Megrendelő: ${reqRow.client_name || "nincs megadva"}`,
      `E-mail: ${reqRow.client_email || "nincs megadva"}`,
      `Telefon: ${reqRow.client_phone || "nincs megadva"}`,
      `Helyszín: ${location || "nincs megadva"}`,
      `Bruttó ajánlati összeg: ${ft(reqRow.quote_total_gross)}`,
      "",
      "Átvett tételek:",
      buildItemsText(items),
    ].join("\n");

    const { error: entryError } = await admin.from("entries").insert({
      user_id: userId,
      project_id: project.id,
      phase: "SzakiPiac import",
      status: "importált ajánlat",
      priority: "normál",
      responsible: reqRow.client_name || null,
      weather: null,
      note,
      ai_level: "Alacsony",
      ai_score: 0,
      ai_title: "SzakiPiac ajánlat importálva",
      ai_advice: ["Az ajánlat adatai automatikusan a SzakiPiacból kerültek át."],
      ai_json: {
        level: "Alacsony",
        score: 0,
        title: "SzakiPiac ajánlat importálva",
        quote_total_gross: reqRow.quote_total_gross,
        source_app: "szakipiac",
        client: {
          name: reqRow.client_name,
          email: reqRow.client_email,
          phone: reqRow.client_phone,
          city: reqRow.client_city,
          address: reqRow.client_address,
        },
        materials: items,
        payload,
      },
      materials_json: items,
      location_address: location || null,
    });
    if (entryError) return json({ ok: false, error: "Naplóbejegyzés mentési hiba: " + entryError.message }, 500);

    await admin.from("project_import_requests").update({
      claimed_by: userId,
      claimed_project_id: project.id,
      claimed_at: new Date().toISOString(),
    }).eq("id", reqRow.id);

    return json({ ok: true, project_id: project.id, project });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err) }, 500);
  }
});
