import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function collectVideoPaths(value: unknown, output: Set<string>) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectVideoPaths(item, output);
    return;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const path = typeof obj.path === "string" ? obj.path : "";
    if (path && !path.includes("..")) output.add(path);
    collectVideoPaths(obj.videos, output);
    collectVideoPaths(obj.videoUrls, output);
    return;
  }
  if (typeof value === "string" && value && !value.startsWith("http") && !value.includes("..")) {
    output.add(value);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Only POST allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Hiányzó Supabase secret." }, 500);

    const { token, paths } = await req.json().catch(() => ({}));
    const cleanToken = String(token || "").trim();
    const requested = Array.isArray(paths)
      ? [...new Set(paths.map((p) => String(p || "").trim()).filter((p) => p && !p.includes("..")))]
      : [];

    if (!cleanToken || !requested.length) return json({ ok: true, urls: {} });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: report, error: reportError } = await admin
      .from("public_reports")
      .select("id,user_id,project_id,is_active,expires_at")
      .eq("token", cleanToken)
      .eq("is_active", true)
      .maybeSingle();

    if (reportError || !report) return json({ ok: false, error: "A riport nem található." }, 404);
    if (report.expires_at && new Date(report.expires_at).getTime() <= Date.now()) {
      return json({ ok: false, error: "A riport lejárt." }, 410);
    }

    const { data: entries, error: entriesError } = await admin
      .from("entries")
      .select("video_urls,ai_json")
      .eq("user_id", report.user_id)
      .eq("project_id", report.project_id);

    if (entriesError) return json({ ok: false, error: entriesError.message }, 500);

    const allowed = new Set<string>();
    for (const entry of entries || []) {
      collectVideoPaths(entry.video_urls, allowed);
      collectVideoPaths(entry.ai_json?.videos, allowed);
      collectVideoPaths(entry.ai_json?.videoUrls, allowed);
    }

    const urls: Record<string, string> = {};
    for (const path of requested) {
      if (!allowed.has(path)) continue;
      const { data, error } = await admin.storage.from("project-videos").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (!error && data?.signedUrl) urls[path] = data.signedUrl;
    }

    return json({ ok: true, urls });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
