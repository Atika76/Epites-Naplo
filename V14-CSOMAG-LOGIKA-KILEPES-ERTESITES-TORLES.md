# V14 – csomag logika + kilépés + értesítés törlés

Javítások:
- A csomag mezőben már csak valódi csomag lehet: trial, starter, pro, business.
- A lejárás külön státusz: active, expired, cancelled.
- A Kilépés gomb azonnal reagál, nem kell frissíteni.
- Az értesítések panelből egyenként törölhetők.
- Van Mind olvasott és Összes törlése gomb.

Feltöltés után Supabase SQL Editorban futtasd:
`supabase-pro-v14-csomag-logika-kilepes-ertesites-torles.sql`
