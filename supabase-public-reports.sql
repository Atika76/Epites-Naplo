-- ÉpítésNapló – publikus ügyfélriport linkek + admin hibabejelentés
-- Ezt futtasd Supabase SQL Editorban.

create table if not exists public.public_reports (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  project_name text,
  report_html text not null,
  report_text text,
  is_active boolean default true,
  created_at timestamptz default now(),
  expires_at timestamptz
);

alter table public.public_reports enable row level security;

drop policy if exists "public_reports_owner_all" on public.public_reports;
drop policy if exists "public_reports_public_read_active" on public.public_reports;
drop policy if exists "public_reports_admin_read" on public.public_reports;

create policy "public_reports_owner_all"
on public.public_reports
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "public_reports_public_read_active"
on public.public_reports
for select
using (
  is_active = true
  and (expires_at is null or expires_at > now())
);

create policy "public_reports_admin_read"
on public.public_reports
for select
using (public.is_current_user_admin());

grant select on public.public_reports to anon;
grant select, insert, update, delete on public.public_reports to authenticated;

create index if not exists public_reports_token_idx on public.public_reports(token);
create index if not exists public_reports_user_id_idx on public.public_reports(user_id);
create index if not exists public_reports_project_id_idx on public.public_reports(project_id);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  name text,
  subject text,
  message text not null,
  status text default 'new',
  created_at timestamptz default now()
);

alter table public.support_messages enable row level security;

drop policy if exists "support_insert_own" on public.support_messages;
drop policy if exists "support_select_own" on public.support_messages;
drop policy if exists "support_admin_select_all" on public.support_messages;
drop policy if exists "support_admin_update_all" on public.support_messages;

create policy "support_insert_own"
on public.support_messages
for insert
with check (auth.uid() = user_id or auth.uid() is not null);

create policy "support_select_own"
on public.support_messages
for select
using (auth.uid() = user_id);

create policy "support_admin_select_all"
on public.support_messages
for select
using (public.is_current_user_admin());

create policy "support_admin_update_all"
on public.support_messages
for update
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

grant insert, select on public.support_messages to authenticated;
grant update on public.support_messages to authenticated;

create index if not exists support_messages_user_id_idx on public.support_messages(user_id);
create index if not exists support_messages_created_at_idx on public.support_messages(created_at);

create or replace view public.admin_support_messages_overview as
select
  sm.id,
  sm.user_id,
  coalesce(sm.email, p.email) as email,
  coalesce(sm.name, p.full_name) as name,
  sm.subject,
  sm.message,
  sm.status,
  sm.created_at
from public.support_messages sm
left join public.profiles p on p.id = sm.user_id
order by sm.created_at desc;

grant select on public.admin_support_messages_overview to authenticated;
