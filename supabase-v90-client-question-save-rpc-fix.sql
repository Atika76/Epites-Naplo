-- V90 - Ügyfél kérdés / észrevétel tényleges mentése javítás
-- Ezt futtasd Supabase SQL Editorban a ZIP feltöltése után vagy előtt.

alter table public.report_approvals
  add column if not exists client_comment text,
  add column if not exists approved_report_html text,
  add column if not exists approved_report_text text;

-- A publikus jóváhagyás RPC mostantól a message mező mellett a client_comment mezőbe is ment.
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
    v_message,
    v_message,
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
    'approval_id', v_approval.id,
    'decision', v_decision,
    'client_comment', v_message,
    'approved_at', v_approval.approved_at
  );
end;
$$;

revoke all on function public.approve_public_report_v71(text,text,text,text,text,text,text,text) from public;
grant execute on function public.approve_public_report_v71(text,text,text,text,text,text,text,text) to anon, authenticated;

-- Utólagos biztonsági javító RPC: ha a böngészős update RLS miatt nem megy, ez a legutóbbi tokenes sort javítja.
create or replace function public.patch_report_approval_comment_v90(
  p_token text,
  p_client_comment text default '',
  p_approved_report_html text default '',
  p_approved_report_text text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_comment text;
begin
  v_comment := left(coalesce(p_client_comment, ''), 2500);

  select id into v_id
  from public.report_approvals
  where token = p_token
  order by approved_at desc nulls last, created_at desc nulls last
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'approval_not_found');
  end if;

  update public.report_approvals
  set
    client_comment = nullif(v_comment, ''),
    message = coalesce(nullif(message, ''), nullif(v_comment, '')),
    approved_report_html = coalesce(nullif(p_approved_report_html, ''), approved_report_html),
    approved_report_text = coalesce(nullif(p_approved_report_text, ''), approved_report_text)
  where id = v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.patch_report_approval_comment_v90(text,text,text,text) from public;
grant execute on function public.patch_report_approval_comment_v90(text,text,text,text) to anon, authenticated;

create index if not exists idx_report_approvals_token_created_v90
on public.report_approvals(token, approved_at desc, created_at desc);
