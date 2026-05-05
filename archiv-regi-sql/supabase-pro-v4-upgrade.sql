-- ÉpítésNapló AI PRO v4 upgrade
-- Admin inbox + értesítések + ügyfélriport megnyitás követése
-- Biztonságosan többször is futtatható.

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  type text default 'info',
  title text,
  message text,
  read boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notifications owner read" on public.notifications;
create policy "notifications owner read"
on public.notifications
for select
to authenticated
using (user_id = auth.uid() or user_id is null or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com');

drop policy if exists "notifications owner insert" on public.notifications;
create policy "notifications owner insert"
on public.notifications
for insert
to authenticated
with check (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com');

drop policy if exists "notifications owner update" on public.notifications;
create policy "notifications owner update"
on public.notifications
for update
to authenticated
using (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com')
with check (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com');

create table if not exists public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid,
  token text,
  event_type text default 'opened',
  user_agent text,
  created_at timestamp with time zone default now()
);

alter table public.report_events enable row level security;

drop policy if exists "public can insert report open events" on public.report_events;
create policy "public can insert report open events"
on public.report_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "admin can read report events" on public.report_events;
create policy "admin can read report events"
on public.report_events
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'cegweb26@gmail.com');

alter table public.public_reports add column if not exists status text default 'created';
alter table public.public_reports add column if not exists sent_at timestamp with time zone;
alter table public.public_reports add column if not exists opened_at timestamp with time zone;
alter table public.public_reports add column if not exists view_count integer default 0;

alter table public.support_messages add column if not exists status text default 'new';

drop view if exists public.admin_support_messages_overview;
create view public.admin_support_messages_overview as
select
  id,
  user_id,
  name,
  email,
  subject,
  message,
  coalesce(status, 'new') as status,
  created_at
from public.support_messages
order by created_at desc;

grant select on public.admin_support_messages_overview to authenticated;

create index if not exists support_messages_created_idx on public.support_messages(created_at desc);
create index if not exists notifications_created_idx on public.notifications(created_at desc);
create index if not exists public_reports_token_idx on public.public_reports(token);
create index if not exists report_events_token_idx on public.report_events(token);
