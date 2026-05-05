// ÉpítésNapló AI PRO v50 - Vision + naplószöveg intelligencia
// Supabase Secrets: GEMINI_API_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type VisionPayload = {
  entryId?: string;
  projectId?: string;
  note?: string;
  phase?: string;
  status?: string;
  priority?: string;
  imageCount?: number;
  videoCount?: number;
  images?: string[];
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function splitDataUrl(dataUrl: string) {
  const match = String(dataUrl || "").match(/^data:(.*?);base64,(.*)$/);
  if (!match) return null;
  return { mimeType: match[1] || "image/jpeg", data: match[2] || "" };
}

function contains(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function fallbackFromText(payload: VisionPayload) {
  const text = `${payload.note || ""} ${payload.phase || ""} ${payload.status || ""} ${payload.priority || ""}`.toLowerCase();
  const imageCount = Number(payload.imageCount || payload.images?.length || 0);
  const videoCount = Number(payload.videoCount || 0);
  const wet = contains(text, ["nedves", "vizes", "beáz", "penész", "salétrom", "ázik"]);
  const crack = contains(text, ["reped", "hajszál", "süllyed", "mozog", "szerkezeti"]);
  const loose = contains(text, ["omlik", "levál", "potyog", "vakolat", "burkolat", "csempe", "üreges"]);
  const precise = contains(text, ["ferde", "szint", "vízszint", "függő", "eltérés", "egyenetlen", "lejt"]);
  const level = wet || crack ? "Közepes" : loose || precise ? "Közepes" : "Alacsony";
  const title = wet
    ? "Nedvesség / beázás gyanú"
    : crack
      ? "Repedés vagy szerkezeti mozgás gyanú"
      : loose
        ? "Vakolat vagy burkolat leválás gyanú"
        : precise
          ? "Pontossági eltérés ellenőrzése"
          : "Nem látható egyértelmű hiba";
  const evidenceScore = Math.max(15, Math.min(100, imageCount * 28 + videoCount * 18 + (payload.note ? 22 : 0) + (payload.phase ? 10 : 0) + (level === "Közepes" ? 12 : 0)));
  const confidence = level === "Közepes" ? Math.max(70, evidenceScore) : Math.max(45, Math.min(72, evidenceScore));
  const certain = [
    payload.note ? "Van naplószöveg." : "Nincs naplószöveg.",
    imageCount ? `${imageCount} fotó érkezett elemzésre.` : "Nem érkezett fotó elemzésre.",
    videoCount ? `${videoCount} videó szerepel a bejegyzésben.` : "Videó nem szerepel a bejegyzésben.",
    payload.phase ? `Munkafázis: ${payload.phase}.` : "Munkafázis nincs megadva."
  ];
  const assumptions = [
    wet ? "A szöveg nedvességre vagy beázásra utal, de fotó/mérés nélkül a pontos ok nem állapítható meg." : "",
    crack ? "A szöveg repedésre utal, de statikai ok csak helyszíni vizsgálattal dönthető el." : "",
    precise ? "A szöveg méret vagy lejtés eltérést jelezhet, mérés nélkül ez csak ellenőrzési javaslat." : ""
  ].filter(Boolean);
  const missingData = [
    !imageCount ? "Fotó hiányzik, ezért képi állapot nem bizonyítható." : "",
    imageCount && !payload.note ? "A fotó mellé hiányzik a pontos szöveges magyarázat." : "",
    !payload.phase ? "Munkafázis nincs megadva." : "",
    /kész|elkészült|átadás|lezárva|befejezve/i.test(text) && !/készítés|készítése|elkészítés/i.test(text) ? "Kész/átadás jelzésnél kell áttekintő és közeli készállapot fotó." : ""
  ].filter(Boolean);
  const photoTextCheck = !imageCount
    ? "A naplószöveg alapján csak szöveges előszűrés készült. Fotó nélkül a bizonyíték gyenge."
    : payload.note
      ? "A fotó és a naplószöveg együtt értelmezhető. A végső döntéshez mérés vagy előtte-utána fotó ajánlott."
      : "Fotó van, de kevés a szöveges magyarázat. Írd mellé, mi készült el és mit kell ellenőrizni.";
  const fix = wet
    ? ["Vízforrás keresése és megszüntetése.", "Kiszáradás után laza rétegek eltávolítása.", "Javítási fotó készítése átadás előtt."]
    : crack
      ? ["Repedés szélesség és hossz rögzítése.", "Ok vizsgálata felületi javítás előtt.", "Szükség esetén hálózás és rugalmas javítás."]
      : loose
        ? ["Üreges vagy leváló rész feltárása.", "Visszabontás stabil alapig.", "Alapozás után javítóhabarcs vagy újraragasztás."]
        : ["Közelkép és távoli fotó készítése.", "Mérés rögzítése vízmértékkel vagy mérőszalaggal.", "Felelős és határidő megadása, ha javítás kell."];
  const materials = wet
    ? ["Mapei Primer G", "Mapei Mapelastic", "Baumit Sanova"]
    : crack
      ? ["Mapei Mapenet háló", "Baumit Grund", "Rigips Rimano"]
      : loose
        ? ["Baumit javítóhabarcs", "Mapei Primer G", "flexibilis ragasztó"]
        : ["mérőszalag", "vízmérték", "fotódokumentáció"];

  return {
    title,
    level,
    confidence,
    score: Math.round(evidenceScore / 12),
    evidenceScore,
    icon: wet ? "💧" : crack ? "🧱" : loose ? "🧰" : precise ? "📐" : "📸",
    findings: [{ title, confidence }],
    fix,
    materials,
    estimatedCost: level === "Közepes" ? 65000 : 18000,
    estimatedHours: level === "Közepes" ? 5 : 2,
    professionalSummary: `${level} kockázati szint. ${title}. Bizonyíték-erősség: ${evidenceScore}%.`,
    customerSummary: level === "Közepes"
      ? "Ezt a részt érdemes átadás előtt külön ellenőrizni, majd javítási vagy lezáró fotóval dokumentálni."
      : "A bejegyzés alapján nincs kiemelt probléma, de a pontos fotó és rövid leírás tovább erősíti a dokumentációt.",
    photoTextCheck,
    checklist: [
      imageCount ? "Fotódokumentáció elérhető." : "Fotódokumentáció pótlása szükséges.",
      videoCount ? "Videós bizonyíték is elérhető." : "Videó ajánlott, ha mozgás, lejtés vagy átadási állapot a kérdés.",
      evidenceScore >= 70 ? "A bizonyíték erőssége jó." : "A bizonyíték erőssége még javítható.",
      "Átadás előtt felelős és határidő rögzítése, ha javítás kell."
    ],
    nextStep: fix[0],
    certain,
    assumptions,
    missingData,
    confidenceReason: imageCount ? "A biztonságot a fotók száma, a naplószöveg és a kulcsszavas egyezés adja." : "Fotó nélkül csak szöveges előszűrés történt.",
    warning: "Automatikus műszaki előszűrés, nem helyettesít statikus vagy műszaki ellenőri szakvéleményt."
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Only POST allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return jsonResponse({ ok: false, error: "Hiányzó bejelentkezés." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return jsonResponse({ ok: false, error: "Hiányzó Supabase beállítás." }, 500);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ ok: false, error: "Érvénytelen bejelentkezés." }, 401);

  let payload: VisionPayload;
  try {
    payload = await req.json();
  } catch (_) {
    return jsonResponse({ ok: false, error: "Hibás JSON kérés." }, 400);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const images = Array.isArray(payload.images) ? payload.images.slice(0, 3) : [];

  if (!apiKey || !images.length) {
    return jsonResponse({ ok: true, source: "V50 fallback", analysis: fallbackFromText(payload) });
  }

  const parts: any[] = [{
    text: `Te egy magyar építőipari műszaki AI asszisztens vagy. Közösen értelmezd a fotókat és a naplószöveget. Adj vissza kizárólag JSON-t ezzel a sémával: {"title":"...","level":"Alacsony|Közepes|Magas","confidence":0-100,"score":1-10,"evidenceScore":0-100,"icon":"emoji","findings":[{"title":"...","confidence":0-100,"evidence":"mit látsz biztosan vagy mi utal rá"}],"fix":["konkrét javítási vagy ellenőrzési lépés"],"materials":["anyag vagy eszköz"],"estimatedCost":forint_szam,"estimatedHours":ora_szam,"professionalSummary":"belső szakmai összegzés","customerSummary":"ügyfélbarát, nem ijesztgető összegzés","photoTextCheck":"egyezik-e a fotó és a szöveg, mi hiányzik","certain":["csak biztosan látható vagy adatból ismert tény"],"assumptions":["óvatos következtetés, ha van"],"missingData":["ami nem bizonyítható vagy hiányzik"],"confidenceReason":"miért ennyi a biztonság","checklist":["átadás előtti ellenőrzési pont"],"nextStep":"legfontosabb következő lépés","warning":"rövid felelősségi megjegyzés"}.

Szigorú szabályok:
- Ne hallucinálj: ha a fotóból nem látszik valami, írd a missingData mezőbe.
- A "készítése / elkészítése" folyamatot jelent, nem kész vagy átadás állapotot.
- Különítsd el: certain = amit tényleg látsz vagy a napló ír; assumptions = lehetséges következtetés; missingData = amit ellenőrizni/pótolni kell.
- Ha a fotó nem elég közeli, sötét, részleges vagy nem mutat mérőeszközt, csökkentsd a confidence értéket.
- Térkő/viakolor/murva/tükör/ágyazat/szegély esetén az alépítményt, tömörítést, lejtést és vízelvezetést ellenőrizd.

Napló: ${payload.note || ""}. Fázis: ${payload.phase || ""}. Státusz: ${payload.status || ""}. Prioritás: ${payload.priority || ""}. Fotók száma: ${images.length}. Videók száma: ${payload.videoCount || 0}.`
  }];

  for (const img of images) {
    const parsed = splitDataUrl(img);
    if (parsed?.data) parts.push({ inline_data: { mime_type: parsed.mimeType, data: parsed.data } });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.15, response_mime_type: "application/json" } }),
    });
    const data = await response.json();
    if (!response.ok) return jsonResponse({ ok: true, source: "V50 fallback", analysis: fallbackFromText(payload), apiError: data?.error?.message || "Gemini hiba" });
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let analysis;
    try { analysis = JSON.parse(text); } catch { analysis = fallbackFromText(payload); }
    return jsonResponse({ ok: true, source: "Gemini Vision", analysis: { ...fallbackFromText(payload), ...analysis } });
  } catch (err) {
    return jsonResponse({ ok: true, source: "V50 fallback", analysis: fallbackFromText(payload), apiError: String(err) });
  }
});
