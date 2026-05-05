// ÉpítésNapló notify-client Edge Function alap
// Resend email küldéshez állítsd be: RESEND_API_KEY, RESEND_FROM_EMAIL
// SMS-hez később Twilio/egyéb szolgáltató beköthető.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ ok: false, error: "Hiányzó bejelentkezés." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Hiányzó Supabase beállítás." }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: "Érvénytelen bejelentkezés." }, 401);

    const { email, phone, projectName, link, message } = await req.json();
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "ÉpítésNapló <noreply@epitesi-naplo.eu>";

    const result: Record<string, unknown> = { ok: true, emailSent: false, smsPrepared: Boolean(phone) };

    if (email && resendKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: `Elkészült az építési napló jelentés: ${projectName || "projekt"}`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
              <h2>Elkészült az építési napló jelentés</h2>
              <p>${escapeHtml(message || "").replaceAll("\n", "<br>")}</p>
              <p><a href="${safeUrl(link)}" style="display:inline-block;background:#f59e0b;color:#111827;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Jelentés megnyitása</a></p>
            </div>
          `,
        }),
      });
      const data = await response.json().catch(() => ({}));
      result.emailSent = response.ok;
      result.emailResponse = data;
    }

    return json(result);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 400);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    status,
  });
}

function escapeHtml(value: unknown) {
  return String(value || "").replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[s] || s));
}

function safeUrl(value: unknown) {
  const url = String(value || "").trim();
  if (/^https?:\/\//i.test(url)) return escapeHtml(url);
  return "#";
}
