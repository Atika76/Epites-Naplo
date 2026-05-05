-- V92 - ügyfél kérdés tényleges mentése stabilan, a működő régi jóváhagyás megtartásával
-- Ezt futtasd Supabase SQL Editorban.

alter table public.report_approvals
  add column if not exists client_comment text,
  add column if not exists approved_report_html text,
  add column if not exists approved_report_text text;

-- A publikus jóváhagyás teljes mentése egyetlen biztonságos RPC-ben.
create or replace function public.approve_public_report_v92(
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
  v_approval_id uuid;
  v_decision text;
  v_message text;
  v_html text;
  v_text text;
begin
  v_decision := lower(left(coalesce(p_decision, 'accepted'), 40));
  if v_decision not in ('viewed', 'accepted', 'question') then
    v_decision := 'viewed';
  end if;

  v_message := left(coalesce(p_message, ''), 2500);

  select * into v_report
  from public.public_reports pr
  where pr.token = p_token
    and coalesce(pr.is_active, true) = true
    and (pr.expires_at is null or pr.expires_at > now())
  limit 1;

  if not found then
    raise exception 'A riport nem talalhato vagy lejart.';
  end if;

  v_html := coalesce(nullif(p_approved_report_html, ''), v_report.report_html, '');
  v_text := coalesce(nullif(p_approved_report_text, ''), v_report.report_text, '');

  insert into public.report_approvals (
    report_id, token, project_id, client_name, client_email,
    approved, approved_at, user_agent, decision, message, client_comment,
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
    nullif(v_message, ''),
    nullif(v_message, ''),
    v_html,
    v_text
  ) returning id into v_approval_id;

  update public.public_reports
  set status = case
      when v_decision = 'accepted' then 'accepted'
      when v_decision = 'question' then 'question'
      else 'viewed'
    end,
    approved_at = case when v_decision = 'accepted' then now() else approved_at end
  where id = v_report.id;

  return jsonb_build_object(
    'ok', true,
    'id', v_approval_id,
    'approval_id', v_approval_id,
    'decision', v_decision,
    'client_comment', v_message,
    'approved_at', now()
  );
end;
$$;

revoke all on function public.approve_public_report_v92(text,text,text,text,text,text,text,text) from public;
grant execute on function public.approve_public_report_v92(text,text,text,text,text,text,text,text) to anon, authenticated;

-- Utólagos javító: ha egy régi RPC mentette a jóváhagyást, ez ráírja a kérdést és a teljes riportpéldányt.
create or replace function public.patch_report_approval_comment_v92(
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
  v_id uuid;
  v_decision text;
  v_message text;
  v_html text;
  v_text text;
begin
  v_decision := lower(left(coalesce(p_decision, 'accepted'), 40));
  if v_decision not in ('viewed', 'accepted', 'question') then
    v_decision := 'viewed';
  end if;
  v_message := left(coalesce(p_message, ''), 2500);

  select * into v_report
  from public.public_reports pr
  where pr.token = p_token
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'report_not_found');
  end if;

  v_html := coalesce(nullif(p_approved_report_html, ''), v_report.report_html, '');
  v_text := coalesce(nullif(p_approved_report_text, ''), v_report.report_text, '');

  select id into v_id
  from public.report_approvals
  where token = p_token
  order by approved_at desc nulls last, created_at desc nulls last
  limit 1;

  if v_id is null then
    insert into public.report_approvals (
      report_id, token, project_id, client_name, client_email,
      approved, approved_at, user_agent, decision, message, client_comment,
      approved_report_html, approved_report_text
    ) values (
      v_report.id, p_token, v_report.project_id,
      left(coalesce(p_client_name, ''), 200),
      left(coalesce(p_client_email, ''), 200),
      v_decision = 'accepted', now(), left(coalesce(p_user_agent, ''), 500),
      v_decision, nullif(v_message, ''), nullif(v_message, ''), v_html, v_text
    ) returning id into v_id;
  else
    update public.report_approvals
    set
      client_name = coalesce(nullif(left(coalesce(p_client_name, ''), 200), ''), client_name),
      client_email = coalesce(nullif(left(coalesce(p_client_email, ''), 200), ''), client_email),
      decision = v_decision,
      approved = v_decision = 'accepted',
      approved_at = coalesce(approved_at, now()),
      user_agent = coalesce(nullif(left(coalesce(p_user_agent, ''), 500), ''), user_agent),
      client_comment = coalesce(nullif(v_message, ''), client_comment),
      message = coalesce(nullif(v_message, ''), message),
      approved_report_html = coalesce(nullif(v_html, ''), approved_report_html),
      approved_report_text = coalesce(nullif(v_text, ''), approved_report_text)
    where id = v_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'client_comment', v_message);
end;
$$;

revoke all on function public.patch_report_approval_comment_v92(text,text,text,text,text,text,text,text) from public;
grant execute on function public.patch_report_approval_comment_v92(text,text,text,text,text,text,text,text) to anon, authenticated;

create index if not exists idx_report_approvals_token_created_v92
on public.report_approvals(token, approved_at desc, created_at desc);

-- Számla módosítás/törlés jogosultság, ha a project_invoices tábla létezik.
alter table if exists public.project_invoices enable row level security;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='project_invoices') then
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_invoices' and policyname='project_invoices_owner_update_v92') then
      create policy project_invoices_owner_update_v92 on public.project_invoices
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_invoices' and policyname='project_invoices_owner_delete_v92') then
      create policy project_invoices_owner_delete_v92 on public.project_invoices
      for delete using (auth.uid() = user_id);
    end if;
  end if;
end $$;
