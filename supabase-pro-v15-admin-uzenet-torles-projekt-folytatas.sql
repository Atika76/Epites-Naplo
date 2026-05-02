-- ÉpítésNapló AI PRO v15
-- Csomag logika, kilépés UX, admin üzenet törlés és napi projektfolytatás támogatás

alter table public.support_messages enable row level security;

-- Admin törölheti az adminnak küldött üzeneteket.
drop policy if exists "Admin delete support messages" on public.support_messages;
create policy "Admin delete support messages"
on public.support_messages
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_admin, false) = true
  )
  or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com'
);

-- Admin olvasás/frissítés biztosítása akkor is, ha korábbi policy hiányos volt.
drop policy if exists "Admin select support messages" on public.support_messages;
create policy "Admin select support messages"
on public.support_messages
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_admin, false) = true
  )
  or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com'
);

drop policy if exists "Admin update support messages" on public.support_messages;
create policy "Admin update support messages"
on public.support_messages
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_admin, false) = true
  )
  or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com'
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_admin, false) = true
  )
  or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com'
);

-- Napi folytatásnál az entries táblába mindig új bejegyzés kerül, a régi adatok megmaradnak.
create index if not exists entries_project_created_idx on public.entries(project_id, created_at desc);
create index if not exists support_messages_created_idx on public.support_messages(created_at desc);
