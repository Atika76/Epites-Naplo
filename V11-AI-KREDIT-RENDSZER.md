# ÉpítésNapló AI PRO v11 – AI kredit rendszer

## Mit tud?

- 1 AI riport kredit: 390 Ft
- 10 AI riport kredit: 2 990 Ft
- PayPal fizetés után automatikus kredit jóváírás
- Fizetős AI riport indításakor 1 kredit levonás
- A fiók kártyán és a PRO eszközöknél látszik a kredit darabszám

## Supabase SQL

Futtasd le az SQL Editorban:

`supabase-pro-v11-ai-credit-system.sql`

## Edge Function

Telepítendő function:

`supabase/functions/paypal-ai-credits/index.ts`

Szükséges Supabase Secrets:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- opcionális: `PAYPAL_MODE` = `live` vagy `sandbox`

## Fontos

A kredit jóváírást nem a frontend végzi közvetlenül, hanem az Edge Function PayPal ellenőrzés után. Ez biztonságosabb, mint ha bárki a böngészőből írhatná a krediteket.
