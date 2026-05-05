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
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function list(items: string[] = []) {
  return items.filter(Boolean).slice(0, 6).map((item) => `- ${item}`).join("\n");
}

function dataStatus(label: string, value: unknown) {
  const text = Array.isArray(value) ? `${value.length} db` : String(value || "").trim();
  return text ? `- ${label}: ${text}` : `- ${label}: nincs megadva`;
}

function fallback(payload: any) {
  const mats = Array.isArray(payload.materials) && payload.materials.length
    ? `\nFelhasznált anyagok: ${payload.materials.map((m: any) => `${m.name || "anyag"} ${m.quantity || ""} ${m.unit || ""}`.trim()).join(", ")}.`
    : "";
  const memory = payload.projectMemory || {};
  const risks = Array.isArray(memory.openRisks) ? memory.openRisks : [];
  const weakEvidence = Array.isArray(memory.weakEvidence) ? memory.weakEvidence : [];
  const imageCount = Number(payload.imageCount || payload.media?.imageCount || 0);
  const videoCount = Number(payload.videoCount || payload.media?.videoCount || 0);
  const beforeCount = Number(payload.beforeImageCount || payload.media?.beforeImageCount || 0);
  const afterCount = Number(payload.afterImageCount || payload.media?.afterImageCount || 0);
  const hasCompletionClaim = /\b(kész|elkészült|átadás|lezárva|befejezve)\b/i.test(String(payload.note || "")) && !/készítés|készítése|elkészítés/i.test(String(payload.note || ""));
  const certain = [
    dataStatus("Munkafázis", payload.phase),
    dataStatus("Státusz", payload.status),
    dataStatus("Prioritás", payload.priority),
    dataStatus("Felelős", payload.responsible),
    `- Fotó/videó: ${imageCount} fotó, ${videoCount} videó`,
    beforeCount || afterCount ? `- Előtte/utána: ${beforeCount} előtte, ${afterCount} utána fotó` : "- Előtte/utána kategória: nincs külön megadva"
  ];
  const missing = [
    !payload.note ? "Hiányzik a napi szöveges leírás." : "",
    !imageCount ? "Nincs fotó, ezért képi állapot nem bizonyítható." : "",
    hasCompletionClaim && !afterCount ? "Kész/átadás állapotnál nincs külön készállapot vagy utána fotó." : "",
    !payload.weather ? "Nincs időjárási/helyszíni körülmény megadva." : ""
  ].filter(Boolean);
  const checklist = [
    "Legyen legalább egy távoli és egy közeli fotó.",
    "Eltérés esetén legyen javítási felelős és következő lépés.",
    "Takarásba kerülő munkánál legyen előtte fotó.",
    "Ügyfélnek szánt szöveg legyen rövid és tényszerű.",
  ];

  return `AI napi munkanapló - ${payload.phase || "munkafázis"}

Biztosan ismert adatok:
${list(certain)}

Belső szakmai összegzés:
A bejegyzés a(z) ${payload.phase || "munkafázis"} munkafázishoz kapcsolódik. Státusz: ${payload.status || "nincs megadva"}, prioritás: ${payload.priority || "nincs megadva"}. Projektmemória alapján eddig ${memory.entries || 0} bejegyzés, ${memory.photos || 0} fotó és ${memory.videos || 0} videó tartozik a projekthez. ${risks.length ? "Nyitott AI figyelmeztetés: " + risks.slice(0, 2).join("; ") + "." : "Nincs nyitott magas AI figyelmeztetés."}

Ügyfélbarát összegzés:
A munka állapota dokumentálva lett. A bejegyzés célja, hogy a megrendelő áttekinthetően lássa a napi előrehaladást, a rögzített fotókat/videókat és az esetleges ellenőrzési pontokat.

Munkavégzés:
Felelős: ${payload.responsible || "kivitelező csapat"}. Helyszíni körülmény / időjárás: ${payload.weather || "nincs külön adat"}.${mats}

Fotó/szöveg kontroll:
${weakEvidence.length ? list(weakEvidence) : "- A projektmemória alapján nincs kiemelt fotó/szöveg ellentmondás."}

Nem bizonyítható / hiányzó adat:
${missing.length ? list(missing) : "- Nincs kiemelt hiányzó adat a megadott mezők alapján."}

Szakmai ellenőrző lista:
${list(checklist)}

Következő javasolt lépés:
${risks.length ? "A nyitott AI jelzést külön fotóval, javítási megjegyzéssel vagy lezárással kell kezelni." : "Folytasd a napi fotó + rövid szakmai leírás ritmust, és hetente készíts ügyfélriportot."}`;
}

function buildPrompt(payload: any) {
  return `Te egy magyar építőipari műszaki napló AI vagy. A cél nem sablonszöveg, hanem bizonyíték-alapú projektintelligencia.

Készíts napi bejegyzést magyarul, ezekkel a kötelező blokkokkal:
1. Biztosan ismert adatok
2. Belső szakmai összegzés
3. Ügyfélbarát összegzés
4. Fotó/szöveg kontroll
5. Nem bizonyítható / hiányzó adat
6. Szakmai ellenőrző lista
7. Következő javasolt lépés

Elvárások:
- Minden állítást sorolj be: biztos adat, következtetés vagy hiányzó adat.
- Használd a projektmemóriát: előző bejegyzések száma, fotó/videó mennyiség, ismétlődő kockázatok, gyenge bizonyítékú pontok.
- Ne találj ki tényt, amit az adatok nem tartalmaznak.
- A "készítése / elkészítése" folyamatot jelent, nem kész vagy átadás állapotot.
- Ha kevés a fotó, nincs előtte/utána kép, vagy valódi átadás/kész állapot szerepel utána fotó nélkül, jelezd.
- Ha fotót nem kaptál a kérésben, ne írd azt, hogy "a képen látszik"; csak azt írd, hogy a naplóadatok alapján.
- Adj szakmai építőipari ellenőrzési pontokat a munkafázishoz.
- Írj külön ügyfélbarát, nyugodt, érthető szöveget.
- A szöveg legyen tömör, de valóban hasznos.

Adatok JSON-ban:
${JSON.stringify(payload, null, 2)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Only POST allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Hiányzó bejelentkezés." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Hiányzó Supabase beállítás." }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: "Érvénytelen bejelentkezés." }, 401);

    const payload = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ ok: true, source: "fallback", text: fallback(payload) });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(payload) }] }],
        generationConfig: { temperature: 0.28, maxOutputTokens: 1100 },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return json({ ok: true, source: "fallback", text: fallback(payload), apiError: data?.error?.message || "Gemini hiba" });
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || fallback(payload);
    return json({ ok: true, source: "Gemini", text });
  } catch (err) {
    return json({ ok: true, source: "fallback", text: fallback({}), error: String((err as Error)?.message || err) });
  }
});
