# V14 javítások

- A `Csomag` mezőből kikerült az `expired`, mert az nem csomag, hanem státusz.
- Helyes logika: csomag = `trial/starter/pro/business`, státusz = `active/expired/cancelled`.
- A régi `plan = expired` rekordokat az SQL átállítja `plan = trial`, `status = expired` értékre.
- A kilépés most azonnal frissíti a felületet, nem kell kézzel újratölteni.

Teendő: töltsd fel a ZIP-et GitHubra, majd Supabase SQL Editorban futtasd a `supabase-pro-v14-csomag-logika-kilepes-fix.sql` fájlt.
