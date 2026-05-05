import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "cegweb26@gmail.com";

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "Hiányzik a SUPABASE_URL vagy SUPABASE_SERVICE_ROLE_KEY secret." }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ ok: false, error: "Nincs érvényes bejelentkezés." }, 401);

    const body = await req.json().catch(() => ({}));
    if (body?.confirmText !== "TÖRLÉS") return json({ ok: false, error: "Hibás megerősítés." }, 400);

    const user = userData.user;
    const userId = user.id;
    const email = user.email || "";

    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      return json({ ok: false, error: "Az admin fiók nem törölhető innen." }, 403);
    }

    try {
      await adminClient.from("account_deletions").insert({
        user_id: userId,
        email,
        reason: body?.reason || "Felhasználói fióktörlés",
        status: "started"
      });
    } catch (_) {}

    const tables = [
      "ai_photo_analyses",
      "photo_ai_results",
      "push_subscriptions",
      "report_events",
      "public_reports",
      "notifications",
      "support_messages",
      "tasks",
      "entries",
      "projects",
      "subscriptions",
      "profiles"
    ];

    for (const table of tables) {
      try {
        await adminClient.from(table).delete().eq("user_id", userId);
      } catch (_) {
        // Ha egy tábla még nincs létrehozva vagy nincs user_id oszlopa, továbbmegyünk.
      }
    }

    try {
      await adminClient.from("payments").update({ user_email: "deleted-user", user_id: null }).eq("user_id", userId);
    } catch (_) {}

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) return json({ ok: false, error: deleteError.message }, 500);

    try {
      await adminClient.from("account_deletions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("user_id", userId);
    } catch (_) {}

    try {
      await adminClient.from("notifications").insert({
        user_id: null,
        type: "account_deleted",
        title: "Felhasználó törölte a fiókját",
        message: email || userId
      });
    } catch (_) {}

    return json({ ok: true, deleted: true });
  } catch (err) {
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}
