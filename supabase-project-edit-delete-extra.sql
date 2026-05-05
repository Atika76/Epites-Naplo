-- Projekt módosítás/törlés ellenőrzés
-- A meglévő RLS szabály miatt minden felhasználó csak a saját projektjét tudja módosítani/törölni:
-- create policy "projects_all_own" on public.projects
-- for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ha a projects_all_own policy már létezik, nincs további teendő.
-- Ellenőrzés:
select policyname, tablename
from pg_policies
where schemaname = 'public'
and tablename in ('projects', 'entries', 'tasks');
