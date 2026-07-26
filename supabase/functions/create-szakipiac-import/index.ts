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

async function importToken(secret: string, sourceQuoteId: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(sourceQuoteId));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
    const siteUrl = (Deno.env.get("EPITESNAPLO_SITE_URL") || "https://epites-naplo.eu").replace(/\/+$/, "");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Hiányzó Supabase secret." }, 500);

    const body = await req.json().catch(() => ({}));
    const sourceQuoteId = body.source_quote_id ? text(body.source_quote_id, 180) : "";
    const sourceStatus = text(body.source_status, 40).toLowerCase();
    const isKivitelezesPro = sourceQuoteId.startsWith("kivitelezes_projektek:") || sourceStatus === "kivitelezes_pro";
    if (!sourceQuoteId) return json({ ok: false, error: "Hiányzó forrásajánlat-azonosító." }, 400);
    if (!isKivitelezesPro && sourceStatus !== "accepted") {
      return json({ ok: false, error: "Csak az ügyfél által elfogadott ajánlat importálható." }, 409);
    }

    const projectName = text(body.project_name || body.projectName || "SzakiPiac projekt", 180);
    const token = await importToken(expectedSecret, sourceQuoteId);
    const admin = createClient(supabaseUrl, serviceKey);

    const row = {
      token,
      source_app: "szakipiac",
      source_quote_id: sourceQuoteId,
      project_name: projectName,
      client_name: text(body.client_name, 180) || null,
      client_email: text(body.client_email, 240) || null,
      client_phone: text(body.client_phone, 100) || null,
      client_city: text(body.client_city, 180) || null,
      client_address: text(body.client_address, 500) || null,
      quote_total_gross: Number(body.quote_total_gross || 0) || null,
      payload: body.payload && typeof body.payload === "object" ? body.payload : {},
    };

    const { data: existing, error: existingError } = await admin
      .from("project_import_requests")
      .select("id, token, project_name, created_at, claimed_project_id")
      .eq("source_app", "szakipiac")
      .eq("source_quote_id", sourceQuoteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) return json({ ok: false, error: "Korábbi importkérés ellenőrzési hiba: " + existingError.message }, 500);

    if (existing) {
      if (existing.claimed_project_id) {
        return json({
          ok: true,
          already_claimed: true,
          request_id: existing.id,
          project_id: existing.claimed_project_id,
          import_url: `${siteUrl}/import-szakipiac.html?token=${encodeURIComponent(existing.token)}`,
        });
      }
      const { data: refreshed, error: refreshError } = await admin
        .from("project_import_requests")
        .update({ ...row, token, created_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("id, token, project_name, created_at")
        .single();
      if (refreshError) return json({ ok: false, error: "Importkérés frissítési hiba: " + refreshError.message }, 500);
      return json({
        ok: true,
        reused: true,
        request_id: refreshed.id,
        token: refreshed.token,
        import_url: `${siteUrl}/import-szakipiac.html?token=${encodeURIComponent(refreshed.token)}`,
      });
    }

    const { data, error } = await admin
      .from("project_import_requests")
      .insert(row)
      .select("id, token, project_name, created_at")
      .single();

    if (error) {
      const { data: concurrent } = await admin
        .from("project_import_requests")
        .select("id, token, claimed_project_id")
        .eq("token", token)
        .maybeSingle();
      if (concurrent) {
        return json({
          ok: true,
          reused: true,
          already_claimed: Boolean(concurrent.claimed_project_id),
          request_id: concurrent.id,
          project_id: concurrent.claimed_project_id || undefined,
          token: concurrent.token,
          import_url: `${siteUrl}/import-szakipiac.html?token=${encodeURIComponent(concurrent.token)}`,
        });
      }
      return json({ ok: false, error: "Import kérés mentési hiba: " + error.message }, 500);
    }

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
