-- V31 SECURITY HARDENING
-- Futtasd Supabase SQL Editorban a v31 javított fájlok feltöltése után.
-- Cél:
-- 1) a csomag/admin mezőket ne írhassa a kliens,
-- 2) a publikus riport csak tokenes RPC-n át legyen olvasható,
-- 3) a munkavideók privát Supabase Storage bucketben legyenek,
-- 4) a publikus riport megnyitás/jóváhagyás kontrollált RPC-n menjen.

alter table if exists public.profiles
  add column if not exists is_admin boolean default false,
  add column if not exists plan text default 'trial',
  add column if not exists plan_status text default 'active',
  add column if not exists plan_expires_at timestamptz,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.entries
  add column if not exists video_urls jsonb default '[]'::jsonb;

create table if not exists public.public_reports (
  id uuid primary key default gen_random_uuid()
);

alter table if exists public.public_reports
  add column if not exists token text,
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists project_name text,
  add column if not exists report_html text,
  add column if not exists report_text text,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists expires_at timestamptz,
  add column if not exists status text default 'created',
  add column if not exists opened_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists view_count integer default 0;

update public.public_reports
set expires_at = null
where expires_at is not null;

create unique index if not exists public_reports_token_unique_idx
on public.public_reports(token)
where token is not null;

create table if not exists public.report_events (
  id uuid primary key default gen_random_uuid()
);

alter table if exists public.report_events
  add column if not exists report_id uuid references public.public_reports(id) on delete cascade,
  add column if not exists token text,
  add column if not exists event_type text,
  add column if not exists user_agent text,
  add column if not exists created_at timestamptz default now();

create table if not exists public.report_approvals (
  id uuid primary key default gen_random_uuid()
);

alter table if exists public.report_approvals
  add column if not exists report_id uuid references public.public_reports(id) on delete cascade,
  add column if not exists token text,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists client_name text,
  add column if not exists client_email text,
  add column if not exists approved boolean default true,
  add column if not exists approved_at timestamptz default now(),
  add column if not exists user_agent text;

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.public_reports enable row level security;
alter table public.report_events enable row level security;
alter table public.report_approvals enable row level security;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        coalesce(p.is_admin, false) = true
        or p.role = 'admin'
        or lower(coalesce(p.email, '')) in ('cegweb26@gmail.com', 'atika.76@windowslive.com')
      )
  );
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

-- Profiles: a felhasználó olvashatja és a biztonságos profilmezőket módosíthatja,
-- de plan / role / is_admin mezőket csak service role vagy admin RPC állíthat.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles simple access" on public.profiles;
drop policy if exists "profiles read own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles read own or admin v31" on public.profiles;
drop policy if exists "profiles update safe own v31" on public.profiles;

revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, company_name, updated_at) on public.profiles to authenticated;

create policy "profiles read own or admin v31"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_current_user_admin());

create policy "profiles update safe own v31"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Subscriptions: kliens csak olvassa, fizetés/admin módosítás kizárólag Edge Function/RPC.
drop policy if exists "subscriptions_update_own" on public.subscriptions;
drop policy if exists "subscriptions_insert_own" on public.subscriptions;
drop policy if exists "subscriptions_select_own" on public.subscriptions;
drop policy if exists "subscriptions read own" on public.subscriptions;
drop policy if exists "subscriptions update own" on public.subscriptions;
drop policy if exists "subscriptions insert own" on public.subscriptions;
drop policy if exists "subscriptions read own or admin v31" on public.subscriptions;

revoke insert, update, delete on public.subscriptions from authenticated;
grant select on public.subscriptions to authenticated;

create policy "subscriptions read own or admin v31"
on public.subscriptions
for select
to authenticated
using (user_id = auth.uid() or public.is_current_user_admin());

-- Publikus riportok: nincs direkt anon SELECT, csak tokenes RPC.
drop policy if exists "public_reports_public_read_active" on public.public_reports;
drop policy if exists "public_reports_owner_all" on public.public_reports;
drop policy if exists "public_reports_admin_read" on public.public_reports;
drop policy if exists "public_reports owner manage v31" on public.public_reports;
drop policy if exists "public_reports admin read v31" on public.public_reports;

revoke select, insert, update, delete on public.public_reports from anon;
grant select, insert, update, delete on public.public_reports to authenticated;

create policy "public_reports owner manage v31"
on public.public_reports
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "public_reports admin read v31"
on public.public_reports
for select
to authenticated
using (public.is_current_user_admin());

create or replace function public.get_public_report_by_token(p_token text)
returns table (
  id uuid,
  token text,
  user_id uuid,
  project_id uuid,
  project_name text,
  report_html text,
  report_text text,
  is_active boolean,
  status text,
  opened_at timestamptz,
  approved_at timestamptz,
  view_count integer,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.id,
    pr.token,
    pr.user_id,
    pr.project_id,
    pr.project_name,
    pr.report_html,
    pr.report_text,
    pr.is_active,
    pr.status,
    pr.opened_at,
    pr.approved_at,
    pr.view_count,
    pr.created_at,
    pr.expires_at
  from public.public_reports pr
  where pr.token = p_token
    and pr.is_active = true
    and (pr.expires_at is null or pr.expires_at > now())
  limit 1;
$$;

revoke all on function public.get_public_report_by_token(text) from public;
grant execute on function public.get_public_report_by_token(text) to anon, authenticated;

create or replace function public.mark_public_report_opened(p_token text, p_user_agent text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.public_reports%rowtype;
begin
  select *
  into v_report
  from public.public_reports pr
  where pr.token = p_token
    and pr.is_active = true
    and (pr.expires_at is null or pr.expires_at > now())
  limit 1;

  if not found then
    return false;
  end if;

  update public.public_reports
  set status = case when status = 'approved' then status else 'opened' end,
      opened_at = coalesce(opened_at, now()),
      view_count = coalesce(view_count, 0) + 1
  where id = v_report.id;

  insert into public.report_events (report_id, token, event_type, user_agent)
  values (v_report.id, p_token, 'opened', left(coalesce(p_user_agent, ''), 500));

  return true;
end;
$$;

revoke all on function public.mark_public_report_opened(text, text) from public;
grant execute on function public.mark_public_report_opened(text, text) to anon, authenticated;

create or replace function public.approve_public_report_by_token(
  p_token text,
  p_client_name text default '',
  p_client_email text default '',
  p_user_agent text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.public_reports%rowtype;
  v_approval public.report_approvals%rowtype;
begin
  select *
  into v_report
  from public.public_reports pr
  where pr.token = p_token
    and pr.is_active = true
    and (pr.expires_at is null or pr.expires_at > now())
  limit 1;

  if not found then
    raise exception 'A riport nem található vagy lejárt.';
  end if;

  insert into public.report_approvals (
    report_id,
    token,
    project_id,
    client_name,
    client_email,
    approved,
    approved_at,
    user_agent
  )
  values (
    v_report.id,
    p_token,
    v_report.project_id,
    left(coalesce(p_client_name, ''), 200),
    left(coalesce(p_client_email, ''), 200),
    true,
    now(),
    left(coalesce(p_user_agent, ''), 500)
  )
  returning * into v_approval;

  update public.public_reports
  set status = 'approved',
      approved_at = v_approval.approved_at
  where id = v_report.id;

  return to_jsonb(v_approval);
end;
$$;

revoke all on function public.approve_public_report_by_token(text, text, text, text) from public;
grant execute on function public.approve_public_report_by_token(text, text, text, text) to anon, authenticated;

-- Report event/approval direkt jogok lezárása.
revoke insert, update, delete on public.report_events from anon, authenticated;
revoke insert, update, delete on public.report_approvals from anon, authenticated;
grant select on public.report_approvals to authenticated;

drop policy if exists "public can insert report open events" on public.report_events;
drop policy if exists "public report approvals insert" on public.report_approvals;
drop policy if exists "public can insert report approvals" on public.report_approvals;
drop policy if exists "owner report approvals select" on public.report_approvals;
drop policy if exists "owner can read report approvals" on public.report_approvals;
drop policy if exists "report approvals owner read v31" on public.report_approvals;

create policy "report approvals owner read v31"
on public.report_approvals
for select
to authenticated
using (
  public.is_current_user_admin()
  or exists (
    select 1
    from public.public_reports pr
    where pr.id = report_approvals.report_id
      and pr.user_id = auth.uid()
  )
);

-- Privát munkavideó storage: csak saját userId/ alá tölthető és olvasható.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-videos',
  'project-videos',
  false,
  83886080,
  array['video/mp4','video/webm','video/quicktime','video/x-m4v','video/mpeg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project videos public read" on storage.objects;
drop policy if exists "project videos authenticated upload" on storage.objects;
drop policy if exists "project videos owner update" on storage.objects;
drop policy if exists "project videos owner delete" on storage.objects;
drop policy if exists "project videos owner read v31" on storage.objects;
drop policy if exists "project videos owner upload v31" on storage.objects;
drop policy if exists "project videos owner update v31" on storage.objects;
drop policy if exists "project videos owner delete v31" on storage.objects;

create policy "project videos owner read v31"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-videos'
  and (owner = auth.uid() or public.is_current_user_admin())
);

create policy "project videos owner upload v31"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-videos'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "project videos owner update v31"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'project-videos'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'project-videos'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "project videos owner delete v31"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-videos'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);
