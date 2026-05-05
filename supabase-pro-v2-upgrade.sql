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
