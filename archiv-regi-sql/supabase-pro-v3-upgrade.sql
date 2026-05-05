-- ÉpítésNapló AI PRO v2 bővítés
-- Ezt futtasd Supabase SQL Editorban a több fotó + teljes AI javaslat mentéséhez.

alter table public.entries
  add column if not exists image_urls jsonb default '[]'::jsonb,
  add column if not exists ai_json jsonb;

update public.entries
set image_urls = case
  when image_url is not null and image_url <> '' then jsonb_build_array(image_url)
  else '[]'::jsonb
end
where image_urls is null or image_urls = 'null'::jsonb;

create index if not exists entries_project_created_idx on public.entries(project_id, created_at desc);
create index if not exists entries_ai_level_idx on public.entries(ai_level);

-- Publikus riport linkek, ha még nem futott le a korábbi fájl.
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

create policy "public_reports_owner_all"
on public.public_reports
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "public_reports_public_read_active"
on public.public_reports
for select
using (is_active = true and (expires_at is null or expires_at > now()));

grant select on public.public_reports to anon;
grant select, insert, update, delete on public.public_reports to authenticated;

create index if not exists public_reports_token_idx on public.public_reports(token);

-- ÉpítésNapló AI PRO v3 kommunikáció + értesítés bővítés
-- Admin központi email: cegweb26@gmail.com

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  email text,
  subject text not null default 'Hibabejelentés',
  message text not null,
  status text not null default 'new',
  created_at timestamptz default now()
);

alter table public.support_messages enable row level security;

drop policy if exists "support_messages_user_insert" on public.support_messages;
drop policy if exists "support_messages_user_read_own" on public.support_messages;
drop policy if exists "support_messages_admin_read" on public.support_messages;

create policy "support_messages_user_insert"
on public.support_messages
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "support_messages_user_read_own"
on public.support_messages
for select
to authenticated
using (auth.uid() = user_id);

create policy "support_messages_admin_read"
on public.support_messages
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'cegweb26@gmail.com');

grant select, insert, update on public.support_messages to authenticated;

create or replace view public.admin_support_messages_overview as
select id, user_id, name, email, subject, message, status, created_at
from public.support_messages
order by created_at desc;

grant select on public.admin_support_messages_overview to authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  recipient_email text,
  recipient_phone text,
  subject text,
  message text,
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'prepared',
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notifications_owner_all" on public.notifications;
drop policy if exists "notifications_admin_read" on public.notifications;

create policy "notifications_owner_all"
on public.notifications
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "notifications_admin_read"
on public.notifications
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'cegweb26@gmail.com');

grant select, insert, update on public.notifications to authenticated;

create index if not exists support_messages_created_idx on public.support_messages(created_at desc);
create index if not exists notifications_created_idx on public.notifications(created_at desc);
