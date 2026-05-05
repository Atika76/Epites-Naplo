# V31 biztonsági javítás

## Mit javít?

- A felhasználó nem tudja kliensoldalról átírni a saját csomagját vagy admin státuszát.
- A publikus ügyfélriportok nem listázhatók anon kulccsal, csak tokenes RPC-n keresztül kérhetők le.
- A `project-videos` bucket privát lett, a videók csak bejelentkezett tulajdonosnak kapnak ideiglenes signed URL-t.
- A megrendelői riportlink nem jár le automatikusan, és a privát videókhoz megnyitáskor friss lejátszási linket kér.
- A publikus riport HTML mentés és megjelenítés előtt tisztítva van.
- Az AI Vision és értesítő Edge Functionök érvényes bejelentkezést kérnek.

## Telepítés

1. Töltsd fel a javított fájlokat GitHubra.
2. Supabase SQL Editorban futtasd:
   `supabase-pro-v31-security-hardening.sql`
3. Supabase Edge Functions alatt deployold újra:
   - `paypal-activate`
   - `ai-vision-analyze`
   - `notify-admin`
   - `notify-client`
   - `public-report-media`

## Fontos

A videók nem publikus, örök URL-lel kerülnek ki. A rendszer a tartós Storage útvonalat menti, a tulajdonosnak és a megrendelői riportlinknek pedig megnyitáskor friss, ideiglenes lejátszási URL-t ad. Így a videó nem tűnik el, de a bucket nem listázható nyilvánosan.
