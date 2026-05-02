import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAYPAL_API = Deno.env.get("PAYPAL_ENV") === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

const PLAN_RULES: Record<string, { amount: number; days: number }> = {
  starter: { amount: 9900, days: 30 },
  pro: { amount: 19900, days: 30 },
  business: { amount: 19900, days: 30 }, // Business induló akció első hónap
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Hiányzó bejelentkezés." }, 401);

    const { orderId, requestedPlan } = await req.json();
    if (!orderId) return json({ error: "Hiányzó PayPal orderId." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID")!;
    const paypalClientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Érvénytelen bejelentkezés." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const tokenRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: "POST",
      headers: { "Authorization": "Basic " + btoa(`${paypalClientId}:${paypalClientSecret}`), "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!tokenRes.ok) return json({ error: "PayPal token hiba: " + await tokenRes.text() }, 500);
    const tokenData = await tokenRes.json();

    const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}`, { headers: { "Authorization": `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" } });
    if (!orderRes.ok) return json({ error: "PayPal rendelés ellenőrzési hiba: " + await orderRes.text() }, 400);
    const order = await orderRes.json();
    if (order.status !== "COMPLETED") return json({ error: "A PayPal fizetés még nem teljesült. Státusz: " + order.status }, 400);

    const purchase = order.purchase_units?.[0];
    const capture = purchase?.payments?.captures?.[0];
    const amount = Number(capture?.amount?.value || purchase?.amount?.value || 0);
    const currency = capture?.amount?.currency_code || purchase?.amount?.currency_code || "HUF";
    const captureId = capture?.id || null;
    const payerEmail = order.payer?.email_address || null;
    const customPlan = String(purchase?.custom_id || requestedPlan || "").toLowerCase();
    let paidPlan = PLAN_RULES[customPlan] ? customPlan : "";

    if (!paidPlan) {
      if (Math.round(amount) === 9900) paidPlan = "starter";
      else if (Math.round(amount) === 19900) paidPlan = "pro";
      else if (Math.round(amount) === 39900) paidPlan = "business";
    }

    const rule = PLAN_RULES[paidPlan];
    if (currency !== "HUF" || !rule || Math.round(amount) !== rule.amount) {
      return json({ error: "Érvénytelen fizetési összeg, pénznem vagy csomag." }, 400);
    }

    const userId = userData.user.id;
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + rule.days);

    await admin.from("payments").upsert({
      user_id: userId,
      paypal_order_id: orderId,
      paypal_capture_id: captureId,
      payer_email: payerEmail,
      amount,
      currency,
      status: "completed",
      plan: paidPlan,
      raw: order,
    }, { onConflict: "paypal_order_id" });

    const { data: subscription, error: subError } = await admin.from("subscriptions").upsert({
      user_id: userId,
      plan: paidPlan,
      status: "active",
      paypal_order_id: orderId,
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }).select().maybeSingle();

    if (subError) return json({ error: "Pro aktiválási adatbázis hiba: " + subError.message }, 500);
    try {
      await admin.from("profiles").update({
        plan: paidPlan,
        plan_status: "active",
        plan_expires_at: periodEnd.toISOString(),
        updated_at: new Date().toISOString()
      }).eq("id", userId);
    } catch (_) {}
    try { await admin.from("notifications").insert({ user_id: userId, type: "payment", title: "Sikeres PayPal fizetés", message: `Aktivált csomag: ${paidPlan}` }); } catch (_) {}
    return json({ ok: true, plan: paidPlan, subscription });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
