# V48 - Supabase security javitas

Futtasd le a `supabase-pro-v48-security-definer-view-fix.sql` fajlt a Supabase SQL Editorban.

Mit javit:
- `admin_users_overview`, `admin_payments_overview`, `admin_support_messages_overview`, `admin_account_deletions_overview` view-k `security_invoker` modra valtva.
- Az admin view-k csak admin felhasznalonak adnak vissza adatot.
- `anon` es `public` kozvetlen olvasasi jog visszavonva az admin view-krol.
- `project_members` es `project_materials` RLS policy-k optimalizalva, hogy a Supabase sarga `Auth RLS Initialization Plan` figyelmeztetese megszunjon.

Fontos: ha a Supabase dashboard nem frissul azonnal, futtas utan nyisd ujra a Security Advisor oldalt, vagy indits uj lint ellenorzest.
