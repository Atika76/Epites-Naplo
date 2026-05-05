-- V71/V76 - ugyfel jovahagyas PRO + jovahagyott riport sajat peldany
-- Futtasd Supabase SQL Editorban, ha meg nincs letrehozva a report_approvals tabla/RPC.

create table if not exists public.report_approvals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid,
  token text,
  project_id uuid,
  client_name text,
  client_email text,
  approved boolean default true,
  approved_at timestamptz default now(),
  user_agent text,
  decision text default 'accepted',
  message text,
  approved_report_html text,
  approved_report_text text,
  created_at timestamptz default now()
);

alter table public.report_approvals
  add column if not exists report_id uuid,
  add column if not exists token text,
  add column if not exists project_id uuid,
  add column if not exists client_name text,
  add column if not exists client_email text,
  add column if not exists approved boolean default true,
  add column if not exists approved_at timestamptz default now(),
  add column if not exists user_agent text,
  add column if not exists decision text default 'accepted',
  add column if not exists message text,
  add column if not exists approved_report_html text,
  add column if not exists approved_report_text text,
  add column if not exists created_at timestamptz default now();

alter table public.public_reports
  add column if not exists status text default 'created',
  add column if not exists view_count integer default 0,
  add column if not exists opened_at timestamptz,
  add column if not exists approved_at timestamptz;

alter table public.report_approvals enable row level security;

drop policy if exists "report approvals public insert v71" on public.report_approvals;
drop policy if exists "report approvals owner select v71" on public.report_approvals;
drop policy if exists "report approvals owner delete v71" on public.report_approvals;

create policy "report approvals public insert v71"
on public.report_approvals
for insert
to anon, authenticated
with check (true);

create policy "report approvals owner select v71"
on public.report_approvals
for select
to authenticated
using (
  public.is_current_user_admin()
  or exists (
    select 1 from public.public_reports pr
    where pr.id = report_approvals.report_id
      and pr.user_id = auth.uid()
  )
  or exists (
    select 1 from public.projects p
    where p.id = report_approvals.project_id
      and p.user_id = auth.uid()
  )
);

create policy "report approvals owner delete v71"
on public.report_approvals
for delete
to authenticated
using (
  public.is_current_user_admin()
  or exists (
    select 1 from public.public_reports pr
    where pr.id = report_approvals.report_id
      and pr.user_id = auth.uid()
  )
  or exists (
    select 1 from public.projects p
    where p.id = report_approvals.project_id
      and p.user_id = auth.uid()
  )
);

grant select, insert, delete on public.report_approvals to authenticated;
grant insert on public.report_approvals to anon;

create index if not exists report_approvals_project_v71_idx on public.report_approvals(project_id, approved_at desc);
create index if not exists report_approvals_report_v71_idx on public.report_approvals(report_id, approved_at desc);
create index if not exists report_approvals_token_v71_idx on public.report_approvals(token, approved_at desc);

create or replace function public.approve_public_report_v71(
  p_token text,
  p_client_name text default '',
  p_client_email text default '',
  p_decision text default 'accepted',
  p_message text default '',
  p_user_agent text default '',
  p_approved_report_html text default '',
  p_approved_report_text text default ''
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
  v_html text;
  v_text text;
begin
  v_decision := lower(left(coalesce(p_decision, 'accepted'), 40));
  if v_decision not in ('viewed', 'accepted', 'question') then
    v_decision := 'viewed';
  end if;

  select * into v_report
  from public.public_reports pr
  where pr.token = p_token
    and pr.is_active = true
    and (pr.expires_at is null or pr.expires_at > now())
  limit 1;

  if not found then
    raise exception 'A riport nem talalhato vagy lejart.';
  end if;

  v_html := coalesce(nullif(p_approved_report_html, ''), v_report.report_html, '');
  v_text := coalesce(nullif(p_approved_report_text, ''), v_report.report_text, '');

  insert into public.report_approvals (
    report_id, token, project_id, client_name, client_email,
    approved, approved_at, user_agent, decision, message,
    approved_report_html, approved_report_text
  ) values (
    v_report.id,
    p_token,
    v_report.project_id,
    left(coalesce(p_client_name, ''), 200),
    left(coalesce(p_client_email, ''), 200),
    v_decision = 'accepted',
    now(),
    left(coalesce(p_user_agent, ''), 500),
    v_decision,
    left(coalesce(p_message, ''), 1500),
    v_html,
    v_text
  ) returning * into v_approval;

  update public.public_reports
  set status = case
      when v_decision = 'accepted' then 'accepted'
      when v_decision = 'question' then 'question'
      else 'viewed'
    end,
    approved_at = case when v_decision = 'accepted' then v_approval.approved_at else approved_at end
  where id = v_report.id;

  return jsonb_build_object(
    'ok', true,
    'id', v_approval.id,
    'decision', v_decision,
    'approved_at', v_approval.approved_at
  );
end;
$$;

revoke all on function public.approve_public_report_v71(text,text,text,text,text,text,text,text) from public;
grant execute on function public.approve_public_report_v71(text,text,text,text,text,text,text,text) to anon, authenticated;
