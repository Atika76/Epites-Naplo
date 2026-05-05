# ÉpítésNapló AI PRO v7 - AI képfelismerés bekötés

## 1. SQL
Supabase SQL Editorban futtasd:

`supabase-pro-v7-ai-vision-upgrade.sql`

## 2. Edge Function
Supabase CLI-vel telepíthető:

```bash
supabase functions deploy ai-vision-analyze
```

## 3. Secret
Supabase Dashboard → Project Settings → Edge Functions / Secrets:

`GEMINI_API_KEY = a saját Gemini API kulcsod`

Ha nincs még kulcs beállítva, a rendszer akkor sem áll meg: helyi építőipari előszűrésre vált.

## 4. Mit tud?
- repedés / szerkezeti mozgás gyanú
- nedvesség / penész / beázás gyanú
- vakolat vagy burkolat leválás
- síkpontossági, lejtési és mérési eltérések
- javítási lépések
- anyagjavaslat
- költség és munkaidő előbecslés
