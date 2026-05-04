import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://epitesi-naplo.eu";
const FALLBACK_IMAGE = `${SITE_URL}/og-ugyfelriport-card.png`;

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function repairMojibake(value: unknown) {
  const text = String(value ?? "");
  if (!/[ÃÂÅÄÐ]/.test(text)) return text;
  try {
    const bytes = new Uint8Array([...text].map((ch) => ch.charCodeAt(0) & 255));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (decoded && decoded.length >= Math.min(8, text.length)) return decoded;
  } catch (_) {}
  return text
    .replaceAll("Ã¡", "á").replaceAll("Ã©", "é").replaceAll("Ã­", "í").replaceAll("Ã³", "ó").replaceAll("Ã¶", "ö").replaceAll("Ãµ", "ő").replaceAll("Å‘", "ő").replaceAll("Ãº", "ú").replaceAll("Ã¼", "ü").replaceAll("Å±", "ű")
    .replaceAll("Ã", "Á").replaceAll("Ã‰", "É").replaceAll("Ã", "Í").replaceAll("Ã“", "Ó").replaceAll("Ã–", "Ö").replaceAll("Å", "Ő").replaceAll("Ãš", "Ú").replaceAll("Ãœ", "Ü").replaceAll("Å°", "Ű");
}

function cleanText(value: unknown, max = 180) {
  const text = repairMojibake(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "Fotókkal igazolt, csak olvasható építési ügyfélriport.";
  return text.length > max ? text.slice(0, max - 1).trim() + "…" : text;
}

function firstImageSrc(html: unknown) {
  const source = String(html || "");
  const imgs = [...source.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]).filter(Boolean);
  const good = imgs.find((src) => !/favicon|logo|icon|og-/i.test(src));
  return good || imgs[0] || "";
}

function toAbsoluteImage(src: string) {
  if (!src) return FALLBACK_IMAGE;
  if (/^data:image\//i.test(src)) return "";
  try { return new URL(src, SITE_URL).href; } catch (_) { return FALLBACK_IMAGE; }
}

function decodeDataImage(src: string) {
  const m = src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1] || "image/jpeg";
  const b64 = m[2] || "";
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, bytes };
  } catch (_) {
    return null;
  }
}

function isShareBot(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  return /facebookexternalhit|facebot|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|viber|pinterest|googlebot|bingbot/i.test(ua);
}

async function loadReport(token: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const key = serviceKey || anonKey;
  if (!supabaseUrl || !key) throw new Error("Hiányzik a SUPABASE_URL vagy a kulcs.");

  const supabase = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rpc = await supabase.rpc("get_public_report_by_token", { p_token: token });
  if (!rpc.error) {
    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    if (row) return row;
  }

  const { data, error } = await supabase
    .from("public_reports")
    .select("id, token, project_name, report_html, report_text, is_active, expires_at, created_at")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

serve(async (req) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get("riport") || url.searchParams.get("report") || url.searchParams.get("token") || "").trim();

  if (!token) {
    return new Response("Hiányzó riport token.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  let report: any = null;
  try { report = await loadReport(token); } catch (err) { console.error(err); }

  if (!report) {
    return new Response("Riport nem található vagy lejárt.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const imgSrc = firstImageSrc(report.report_html);

  if (url.searchParams.get("img") === "1") {
    if (/^data:image\//i.test(imgSrc)) {
      const decoded = decodeDataImage(imgSrc);
      if (decoded) {
        return new Response(decoded.bytes, {
          headers: {
            "Content-Type": decoded.mime,
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }
    const abs = toAbsoluteImage(imgSrc) || FALLBACK_IMAGE;
    return Response.redirect(abs || FALLBACK_IMAGE, 302);
  }

  const titleBase = cleanText(report.project_name || "Ügyfélriport", 80);
  const title = `${titleBase} – ügyfélriport`;
  const description = cleanText(report.report_text || report.report_html, 190);
  const imageUrl = new URL(req.url);
  imageUrl.searchParams.set("img", "1");
  const viewUrl = new URL(`${SITE_URL}/view.html`);
  viewUrl.searchParams.set("riport", token);
  const shareUrl = new URL(req.url);
  shareUrl.searchParams.delete("img");

  // Ha ember nyitja meg a Supabase share-linket, ne ezt a technikai oldalt lássa, hanem rögtön a valódi ügyfélriportot.
  // A Facebook/Messenger/WhatsApp robot viszont HTML-t kap OG meta adatokkal.
  if (!isShareBot(req) && url.searchParams.get("preview") !== "1") {
    return Response.redirect(viewUrl.href, 302);
  }

  const html = `<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(shareUrl.href)}" />
  <link rel="icon" type="image/png" sizes="192x192" href="${SITE_URL}/favicon.png" />

  <meta property="og:locale" content="hu_HU" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="ÉpítésNapló AI PRO" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(shareUrl.href)}" />
  <meta property="og:image" content="${esc(imageUrl.href)}" />
  <meta property="og:image:secure_url" content="${esc(imageUrl.href)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(title)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(imageUrl.href)}" />
  <meta name="theme-color" content="#0f172a" />
  <meta http-equiv="refresh" content="1;url=${esc(viewUrl.href)}" />
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07111f;color:#0f172a;font-family:Arial,Helvetica,sans-serif;padding:22px}.card{max-width:680px;background:white;border-radius:28px;padding:28px;box-shadow:0 22px 80px rgba(0,0,0,.42)}img{width:100%;max-height:340px;object-fit:cover;border-radius:20px;background:#e5e7eb}h1{font-size:clamp(26px,5vw,42px);line-height:1.05;margin:18px 0 8px}.muted{color:#64748b;line-height:1.55}.btn{display:inline-block;background:#fbbf24;color:#111827;text-decoration:none;font-weight:900;border-radius:16px;padding:15px 20px;margin-top:12px}.badge{display:inline-flex;background:#dcfce7;color:#166534;border-radius:999px;padding:8px 12px;font-weight:900}
  </style>
</head>
<body>
  <main class="card">
    <div class="badge">✅ Ügyfélriport megnyitása</div>
    <h1>${esc(title)}</h1>
    <p class="muted">${esc(description)}</p>
    <img src="${esc(imageUrl.href)}" alt="${esc(title)}" />
    <p><a class="btn" href="${esc(viewUrl.href)}">Riport megnyitása</a></p>
  </main>
  <script>setTimeout(function(){ location.replace(${JSON.stringify(viewUrl.href)}); }, 900);</script>
</body>
</html>`;

  return new Response(new TextEncoder().encode(html), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
