-- V33 Business Suite
-- Ujrafuttathato Supabase SQL: ugyfel dontesek, szerepkor alapok, archivum mezok.

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
  add column if not exists user_agent text,
  add column if not exists decision text default 'accepted',
  add column if not exists message text;

alter table if exists public.projects
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  owner_user_id uuid not null,
  email text not null,
  role text not null default 'worker',
  status text not null default 'invited',
  created_at timestamptz not null default now()
);

alter table public.project_members enable row level security;

drop policy if exists "project members owner read v33" on public.project_members;
drop policy if exists "project members owner insert v33" on public.project_members;
drop policy if exists "project members owner update v33" on public.project_members;
drop policy if exists "project members owner delete v33" on public.project_members;

create policy "project members owner read v33"
on public.project_members
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = project_members.project_id
      and p.user_id = auth.uid()
  )
  or public.is_current_user_admin()
);

create policy "project members owner insert v33"
on public.project_members
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_members.project_id
      and p.user_id = auth.uid()
  )
);

create policy "project members owner update v33"
on public.project_members
for update
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_current_user_admin()
)
with check (
  owner_user_id = auth.uid()
  or public.is_current_user_admin()
);

create policy "project members owner delete v33"
on public.project_members
for delete
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_current_user_admin()
);

grant select, insert, update, delete on public.project_members to authenticated;

create or replace function public.approve_public_report_v33(
  p_token text,
  p_client_name text default '',
  p_client_email text default '',
  p_decision text default 'accepted',
  p_message text default '',
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
  v_decision text;
begin
  v_decision := lower(left(coalesce(p_decision, 'accepted'), 40));
  if v_decision not in ('viewed', 'accepted', 'question') then
    v_decision := 'viewed';
  end if;

  select *
  into v_report
  from public.public_reports pr
  where pr.token = p_token
    and pr.is_active = true
    and (pr.expires_at is null or pr.expires_at > now())
  limit 1;

  if not found then
    raise exception 'A riport nem talalhato vagy lejart.';
  end if;

  insert into public.report_approvals (
    report_id,
    token,
    project_id,
    client_name,
    client_email,
    approved,
    approved_at,
    user_agent,
    decision,
    message
  )
  values (
    v_report.id,
    p_token,
    v_report.project_id,
    left(coalesce(p_client_name, ''), 200),
    left(coalesce(p_client_email, ''), 200),
    v_decision = 'accepted',
    now(),
    left(coalesce(p_user_agent, ''), 500),
    v_decision,
    left(coalesce(p_message, ''), 1000)
  )
  returning * into v_approval;

  update public.public_reports
  set status = case
    when v_decision = 'accepted' then 'accepted'
    when v_decision = 'question' then 'question'
    else 'viewed'
  end
  where id = v_report.id;

  return jsonb_build_object(
    'ok', true,
    'id', v_approval.id,
    'decision', v_decision,
    'approved_at', v_approval.approved_at
  );
end;
$$;

revoke all on function public.approve_public_report_v33(text, text, text, text, text, text) from public;
grant execute on function public.approve_public_report_v33(text, text, text, text, text, text) to anon, authenticated;
