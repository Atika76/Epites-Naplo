# ÉpítésNapló AI PRO v16

Javítások:
- admin üzenet törlés nem akad be többé `profiles` RLS rekurzióba
- új `admin_delete_support_message` RPC függvény
- stabilabb admin jogosultság ellenőrzés
- Kilépés gomb automatikus teljes újratöltéssel léptet ki, nem kell kézzel frissíteni

Teendő:
1. ZIP feltöltése GitHubra felülírással.
2. Supabase SQL Editorban futtasd:
   `supabase-pro-v16-admin-uzenet-torles-kilepes-final.sql`
3. Próbáld ki az admin üzenet törlését és a Kilépés gombot.
