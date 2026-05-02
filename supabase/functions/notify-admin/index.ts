import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ ok: false, error: "Hiányzó bejelentkezés." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Hiányzó Supabase beállítás." }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: "Érvénytelen bejelentkezés." }, 401);

    const body = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "cegweb26@gmail.com";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "ÉpítésNapló <noreply@epitesi-naplo.eu>";

    if (!resendApiKey) {
      return json({
        ok: false,
        warning: "RESEND_API_KEY nincs beállítva. Az üzenet Supabase-be mentve van, email nem ment ki."
      });
    }

    const subject = body.subject || "Új ÉpítésNapló hibabejelentés";
    const name = body.name || "Felhasználó";
    const email = body.email || "nincs email";
    const message = body.message || "";

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Új ÉpítésNapló üzenet</h2>
        <p><b>Név:</b> ${escapeHtml(name)}</p>
        <p><b>Email:</b> ${escapeHtml(email)}</p>
        <p><b>Tárgy:</b> ${escapeHtml(subject)}</p>
        <p><b>Üzenet:</b></p>
        <div style="white-space:pre-wrap;background:#f3f4f6;padding:12px;border-radius:8px">${escapeHtml(message)}</div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: adminEmail,
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return json({ ok: false, error: data }, 500);
    }

    return json({ ok: true, data });
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[s] || s));
}
