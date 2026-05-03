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

function cleanPath(value: unknown) {
  const s = String(value || "").trim();
  if (!s || s.includes("..") || /^https?:\/\//i.test(s) || /^data:/i.test(s) || /^blob:/i.test(s)) return "";
  return s.replace(/^\/+/, "");
}

function collectPaths(value: unknown, output: Set<string>) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectPaths(item, output);
    return;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["path", "storage_path", "file_path", "image_path", "video_path", "src", "url"]) {
      const p = cleanPath(obj[key]);
      if (p) output.add(p);
    }
    for (const key of ["images", "imageUrls", "image_urls", "photos", "videos", "videoUrls", "video_urls", "media"]) {
      collectPaths(obj[key], output);
    }
    return;
  }
  if (typeof value === "string") {
    const p = cleanPath(value);
    if (p) output.add(p);
  }
}

async function signed(admin: any, bucket: string, path: string) {
  const p = cleanPath(path);
  if (!p) return "";
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(p, 60 * 60 * 24 * 7);
  if (!error && data?.signedUrl) return data.signedUrl;
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Only POST allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Hiányzó Supabase secret." }, 500);

    const body = await req.json().catch(() => ({}));
    const cleanToken = String(body.token || "").trim();
    const requested = Array.isArray(body.paths)
      ? [...new Set(body.paths.map((p: unknown) => cleanPath(p)).filter(Boolean))]
      : [];
    const all = body.all === true;

    if (!cleanToken) return json({ ok: true, urls: {}, media: [] });

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

    const [entriesRes, mediaRes] = await Promise.all([
      admin.from("entries").select("image_url,image_urls,video_url,video_urls,ai_json").eq("user_id", report.user_id).eq("project_id", report.project_id),
      admin.from("media_files").select("*").eq("project_id", report.project_id).limit(300),
    ]);

    const allowed = new Set<string>();
    const imageCandidates: string[] = [];
    const videoCandidates: string[] = [];

    for (const entry of entriesRes.data || []) {
      const before = new Set<string>();
      collectPaths(entry.image_url, before); collectPaths(entry.image_urls, before); collectPaths(entry.ai_json?.images, before); collectPaths(entry.ai_json?.imageUrls, before); collectPaths(entry.ai_json?.photos, before);
      for (const p of before) { allowed.add(p); imageCandidates.push(p); }
      const vids = new Set<string>();
      collectPaths(entry.video_url, vids); collectPaths(entry.video_urls, vids); collectPaths(entry.ai_json?.videos, vids); collectPaths(entry.ai_json?.videoUrls, vids);
      for (const p of vids) { allowed.add(p); videoCandidates.push(p); }
    }

    for (const row of mediaRes.data || []) {
      const obj = row as Record<string, unknown>;
      const p = cleanPath(obj.path || obj.storage_path || obj.file_path || obj.url || obj.src);
      if (!p) continue;
      allowed.add(p);
      const type = String(obj.type || obj.mime_type || obj.file_type || obj.kind || "").toLowerCase();
      if (type.includes("video") || /\.(mp4|mov|webm|m4v|3gp)$/i.test(p)) videoCandidates.push(p);
      else imageCandidates.push(p);
    }

    const buckets = ["project-images", "project-media", "media-files", "entry-images", "hirdetes-kepek", "project-videos"];
    const urls: Record<string, string> = {};
    const want = requested.length ? requested : [...new Set([...imageCandidates, ...videoCandidates])];
    for (const path of want) {
      if (!allowed.has(path) && requested.length) continue;
      for (const bucket of buckets) {
        const url = await signed(admin, bucket, path);
        if (url) { urls[path] = url; break; }
      }
    }

    const media = all ? [...new Set(imageCandidates)].map((path) => ({ type: "image", path, url: urls[path] })).filter(x => x.url)
      .concat([...new Set(videoCandidates)].map((path) => ({ type: "video", path, url: urls[path] })).filter(x => x.url)) : [];

    return json({ ok: true, urls, media });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
