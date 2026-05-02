-- ÉpítésNapló AI PRO v16
-- Admin üzenet törlés RLS rekurzió javítás + biztonságos admin helper

-- 1) Biztonságos admin ellenőrző függvény.
-- SECURITY DEFINER: nem akad be a profiles RLS saját magára hivatkozó policyjein.
create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() ->> 'email') = 'cegweb26@gmail.com'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    ),
    false
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;

-- 2) RPC törlés admin üzenetekhez.
-- Ez akkor is működik, ha egy régi DELETE policy rekurzióba futna.
create or replace function public.admin_delete_support_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Nincs admin jogosultság.';
  end if;

  delete from public.support_messages
  where id = p_message_id;

  return true;
end;
$$;

grant execute on function public.admin_delete_support_message(uuid) to authenticated;

-- 3) Régi support_messages DELETE policyk törlése, hogy ne maradjon bent hibás/rekurzív szabály.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'support_messages'
      and cmd in ('DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.support_messages', pol.policyname);
  end loop;
end $$;

-- 4) Tiszta, nem rekurzív DELETE policy.
alter table public.support_messages enable row level security;

create policy "Admin support message delete v16"
on public.support_messages
for delete
to authenticated
using (public.is_current_user_admin());

-- 5) SELECT policy adminnak, hogy biztosan lássa az üzeneteket.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='support_messages'
      and policyname='Admin support message select v16'
  ) then
    create policy "Admin support message select v16"
    on public.support_messages
    for select
    to authenticated
    using (public.is_current_user_admin());
  end if;
end $$;

-- 6) Státusz mező biztosítása az olvasott/új jelzéshez.
alter table public.support_messages
add column if not exists status text default 'new';

create index if not exists support_messages_created_idx
on public.support_messages(created_at desc);
