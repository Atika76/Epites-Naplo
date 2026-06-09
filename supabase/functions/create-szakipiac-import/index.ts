import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function text(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Csak POST kérés engedélyezett." }, 405);

  try {
    const expectedSecret = Deno.env.get("EPITESNAPLO_IMPORT_SECRET") || "";
    const authHeader = req.headers.get("Authorization") || "";
    const suppliedSecret = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!expectedSecret || suppliedSecret !== expectedSecret) {
      return json({ ok: false, error: "Érvénytelen import hitelesítés." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const siteUrl = (Deno.env.get("EPITESNAPLO_SITE_URL") || "https://epitesi-naplo.eu").replace(/\/+$/, "");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Hiányzó Supabase secret." }, 500);

    const body = await req.json().catch(() => ({}));
    const projectName = text(body.project_name || body.projectName || "SzakiPiac projekt", 180);
    const token = randomToken();
    const admin = createClient(supabaseUrl, serviceKey);

    const row = {
      token,
      source_app: "szakipiac",
      source_quote_id: body.source_quote_id ? text(body.source_quote_id, 180) : null,
      project_name: projectName,
      client_name: text(body.client_name, 180) || null,
      client_email: text(body.client_email, 240) || null,
      client_phone: text(body.client_phone, 100) || null,
      client_city: text(body.client_city, 180) || null,
      client_address: text(body.client_address, 500) || null,
      quote_total_gross: Number(body.quote_total_gross || 0) || null,
      payload: body.payload && typeof body.payload === "object" ? body.payload : {},
    };

    const { data, error } = await admin
      .from("project_import_requests")
      .insert(row)
      .select("id, token, project_name, created_at")
      .single();

    if (error) return json({ ok: false, error: "Import kérés mentési hiba: " + error.message }, 500);

    return json({
      ok: true,
      request_id: data.id,
      token,
      import_url: `${siteUrl}/import-szakipiac.html?token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    return json({ ok: false, error: String((error as Error)?.message || error) }, 500);
  }
});
