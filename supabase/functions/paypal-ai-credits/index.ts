// ÉpítésNapló AI PRO v11 – PayPal AI kredit jóváírás Edge Function
// Supabase Secrets szükséges:
// PAYPAL_CLIENT_ID
// PAYPAL_CLIENT_SECRET
// SUPABASE_SERVICE_ROLE_KEY
// opcionális: PAYPAL_MODE = sandbox vagy live

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getPayPalAccessToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  const mode = Deno.env.get("PAYPAL_MODE") || "live";
  if (!clientId || !secret) throw new Error("Hiányzó PAYPAL_CLIENT_ID vagy PAYPAL_CLIENT_SECRET Supabase Secret.");

  const base = mode === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${clientId}:${secret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("PayPal token kérés sikertelen.");
  const data = await res.json();
  return { token: data.access_token as string, base };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Nincs bejelentkezve." }, 401);

    const { orderId, credits, amount } = await req.json();
    const creditCount = Number(credits);
    const amountHuf = Number(amount);
    if (!orderId || ![1, 10].includes(creditCount)) return json({ error: "Hibás AI kredit csomag." }, 400);
    if ((creditCount === 1 && amountHuf !== 990) || (creditCount === 10 && amountHuf !== 4990)) return json({ error: "Hibás összeg." }, 400);

    const { token, base } = await getPayPalAccessToken();
    const verify = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!verify.ok) return json({ error: "PayPal rendelés ellenőrzése sikertelen." }, 400);
    const order = await verify.json();

    if (order.status !== "COMPLETED") return json({ error: "A PayPal fizetés még nem lezárt." }, 400);
    const paidValue = Number(order.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || 0);
    const currency = order.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code;
    if (currency !== "HUF" || paidValue !== amountHuf) return json({ error: "PayPal összeg vagy pénznem nem egyezik." }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin.rpc("grant_ai_credits_admin", {
      p_user_id: user.id,
      p_credits: creditCount,
      p_reason: "paypal_ai_credit_purchase",
      p_paypal_order_id: orderId,
      p_amount_huf: amountHuf,
      p_meta: { paypal_status: order.status, payer_email: order.payer?.email_address || null },
    });
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true, credits: data?.credits ?? 0, added: data?.added ?? creditCount, duplicate: data?.duplicate || false });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Ismeretlen hiba" }, 500);
  }
});
