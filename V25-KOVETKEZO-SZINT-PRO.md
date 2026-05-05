# V25 – Következő szint PRO

Ebben a csomagban a V24 stabil alap megmaradt, és ezek kerültek rá:

- PayPal csomagazonosítás javítva: Starter / Pro / Business külön plan kulccsal megy az Edge Function felé.
- PayPal Edge Function live/sandbox módban ellenőrzi a rendelést, majd a megfelelő csomagot aktiválja.
- Valódi AI napi jelentés Edge Function: `supabase/functions/ai-report-generate/index.ts`.
- Ha nincs `GEMINI_API_KEY`, az AI nem töri el a rendszert, hanem stabil fallback szöveget ad.
- Projekt oldalon a heti és lezáró PDF már html2pdf alapú profi PDF exportot használ, ha a CDN elérhető.
- Projekt oldalról közvetlen ügyfél link készíthető.
- Ügyfél nézetben PDF letöltés + jóváhagyás megmaradt.
- Új SQL: `supabase-pro-v25-kovetkezo-szint-pro.sql`.

## Supabase Secrets az Edge Functionökhöz

PayPal:
- `PAYPAL_ENV` = `live` vagy `sandbox`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

AI:
- `GEMINI_API_KEY`

## Fontos

A login/admin részt nem lett átírva. A V25 a stabil V24-re épül.
