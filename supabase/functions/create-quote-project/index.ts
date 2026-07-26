import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://epitesi-naplo.eu",
  "https://www.epitesi-naplo.eu",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://epitesi-naplo.eu",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

function money(value: unknown) {
  const number = Number(value || 0);
  return `${Math.round(Number.isFinite(number) ? number : 0).toLocaleString("hu-HU")} Ft`;
}

function text(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function isMissing(error: unknown) {
  const raw = String((error as { message?: string })?.message || error || "");
  return /does not exist|schema cache|column .* not found|relation .* does not exist|42P01|42703/i.test(raw);
}

async function optionalInsert(admin: any, table: string, rows: unknown, warnings: string[]) {
  const { error } = await admin.from(table).insert(rows);
  if (!error) return true;
  if (isMissing(error)) {
    warnings.push(`${table}: a kiegészítő tábla vagy valamelyik oszlopa nem érhető el.`);
    return false;
  }
  warnings.push(`${table}: ${error.message || error}`);
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Csak POST kérés engedélyezett." }, 405);

  const warnings: string[] = [];
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(req, { ok: false, error: "A projekt létrehozásához be kell jelentkezni." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(req, { ok: false, error: "Hiányzó Supabase-beállítás." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const quoteId = text(body?.quote_id);
    if (!/^[0-9a-f-]{36}$/i.test(quoteId)) {
      return json(req, { ok: false, error: "Érvénytelen ajánlatazonosító." }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return json(req, { ok: false, error: "A bejelentkezés lejárt. Lépj be újra." }, 401);
    }

    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: paid, error: paidError } = await admin.rpc("epitesi_has_paid_access", { p_user_id: userId });
    if (paidError || paid !== true) {
      return json(req, { ok: false, error: "Ehhez aktív fizetős Építési Napló csomag szükséges." }, 403);
    }

    const { data: quote, error: quoteError } = await admin
      .from("epitesi_quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("user_id", userId)
      .maybeSingle();
    if (quoteError || !quote) return json(req, { ok: false, error: "Az ajánlat nem található." }, 404);
    if (quote.project_id) {
      return json(req, { ok: true, already_created: true, project_id: quote.project_id, warnings });
    }
    if (quote.status !== "accepted" || !quote.accepted_at) {
      return json(req, { ok: false, error: "Projekt csak az ügyfél által elfogadott ajánlatból készíthető." }, 409);
    }

    const { data: acceptedShare } = await admin
      .from("epitesi_quote_shares")
      .select("id,decided_at,decision_name,decision_email")
      .eq("quote_id", quoteId)
      .eq("decision", "accepted")
      .not("decided_at", "is", null)
      .order("decided_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!acceptedShare) {
      return json(req, { ok: false, error: "Az ügyfél elfogadása nem igazolható." }, 409);
    }

    const location = text(quote.work_address) || [quote.client_city, quote.client_address].filter(Boolean).join(", ");
    const isSupplement = quote.quote_type === "supplement" && quote.parent_quote_id;
    let project: any = null;
    let createdNewProject = false;

    if (isSupplement) {
      const { data: parentQuote, error: parentError } = await admin
        .from("epitesi_quotes")
        .select("id,project_id,status")
        .eq("id", quote.parent_quote_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (parentError || !parentQuote) {
        return json(req, { ok: false, error: "Az eredeti ajánlat nem található." }, 404);
      }
      if (!parentQuote.project_id) {
        return json(req, { ok: false, error: "Előbb hozd létre a projektet az eredeti elfogadott ajánlatból." }, 409);
      }
      const { data: existingProject, error: existingProjectError } = await admin
        .from("projects")
        .select("*")
        .eq("id", parentQuote.project_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existingProjectError || !existingProject) {
        return json(req, { ok: false, error: "Az eredeti ajánlathoz tartozó projekt nem található." }, 404);
      }
      project = existingProject;
    } else {
      const { data: newProject, error: projectError } = await admin
        .from("projects")
        .insert({ user_id: userId, name: quote.project_name, location: location || null })
        .select("*")
        .single();
      if (projectError) return json(req, { ok: false, error: `Projekt létrehozási hiba: ${projectError.message}` }, 500);
      project = newProject;
      createdNewProject = true;
    }

    const { data: updated, error: updateError } = await admin
      .from("epitesi_quotes")
      .update({
        project_id: project.id,
        project_created_at: new Date().toISOString(),
        status: "project_created",
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .eq("user_id", userId)
      .is("project_id", null)
      .select("project_id");

    if (updateError || !updated?.length) {
      if (createdNewProject) await admin.from("projects").delete().eq("id", project.id).eq("user_id", userId);
      const { data: current } = await admin.from("epitesi_quotes").select("project_id").eq("id", quoteId).maybeSingle();
      if (current?.project_id) {
        return json(req, { ok: true, already_created: true, project_id: current.project_id, warnings });
      }
      return json(req, { ok: false, error: "A projektkapcsolat mentése nem sikerült. Próbáld újra." }, 500);
    }

    const items = Array.isArray(quote.items) ? quote.items : [];
    const note = [
      isSupplement
        ? "Elfogadott pótmunka / kiegészítő ajánlat a meglévő projekthez."
        : "Építési Napló saját ajánlatából létrehozott projekt.",
      "",
      `Ajánlat: ${quote.quote_number}`,
      `Projekt: ${quote.project_name}`,
      `Megrendelő: ${quote.client_name || "nincs megadva"}`,
      `E-mail: ${quote.client_email || "nincs megadva"}`,
      `Telefon: ${quote.client_phone || "nincs megadva"}`,
      `Helyszín: ${location || "nincs megadva"}`,
      `Várható kezdés: ${quote.work_start_date || "nincs megadva"}`,
      `Várható befejezés: ${quote.work_end_date || "nincs megadva"}`,
      `Elfogadta: ${acceptedShare.decision_name || "nincs megadva"}`,
      `Kedvezmény: ${money(quote.discount_amount)}`,
      `Bruttó végösszeg: ${money(quote.total_gross)}`,
      "",
      "Elfogadott tételek:",
      ...items.map((item: any, index: number) =>
        `${index + 1}. [${text(item.category, "egyéb")}] ${text(item.name, "Tétel")} – ${Number(item.quantity || 0)} ${text(item.unit, "db")} – ${money(item.net_total)} nettó`
      ),
    ].join("\n");

    await optionalInsert(admin, "project_imports", {
      project_id: project.id,
      source_app: isSupplement ? "epitesi_potmunka" : "epitesi_ajanlat",
      source_quote_id: quote.id,
      client_name: quote.client_name || null,
      client_email: quote.client_email || null,
      client_phone: quote.client_phone || null,
      client_city: quote.client_city || null,
      client_address: quote.client_address || null,
      quote_total_gross: quote.total_gross || null,
      payload: { quote, accepted_share_id: acceptedShare.id },
    }, warnings);

    await optionalInsert(admin, "diary_entries", {
      user_id: userId,
      project_id: project.id,
      description: note,
      work_type: isSupplement ? "Elfogadott pótmunka" : "Elfogadott árajánlat",
    }, warnings);

    return json(req, { ok: true, project_id: project.id, project, supplement: isSupplement, warnings });
  } catch (error) {
    return json(req, { ok: false, error: String((error as Error)?.message || error), warnings }, 500);
  }
});
