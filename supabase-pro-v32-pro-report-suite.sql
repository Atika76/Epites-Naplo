-- V32 Profi ugyfelriport + media kategoriak
-- Biztonsagosan ujrafuttathato Supabase SQL Editorban.

alter table if exists public.entries
  add column if not exists before_images_json jsonb default '[]'::jsonb,
  add column if not exists after_images_json jsonb default '[]'::jsonb,
  add column if not exists general_images_json jsonb default '[]'::jsonb,
  add column if not exists video_urls jsonb default '[]'::jsonb,
  add column if not exists materials_json jsonb default '[]'::jsonb,
  add column if not exists weather_json jsonb,
  add column if not exists gps_json jsonb;

alter table if exists public.public_reports
  add column if not exists view_count integer default 0,
  add column if not exists status text default 'created',
  add column if not exists expires_at timestamptz;

update public.public_reports
set expires_at = null
where expires_at is not null;

do $$
begin
  if to_regclass('public.report_approvals') is not null then
    execute 'grant select on public.report_approvals to authenticated';
  end if;
end $$;
