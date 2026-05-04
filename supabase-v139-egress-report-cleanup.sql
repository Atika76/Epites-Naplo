-- V139 – régi/árva ügyfélriportok és megnyitási események takarítása
-- Ezt egyszer futtasd le Supabase SQL Editorban, ha a régi teszt riportok bent maradtak.

create or replace function public.cleanup_my_orphan_reports_v139()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_report_ids uuid[] := array[]::uuid[];
  v_tokens text[] := array[]::text[];
  v_public_deleted integer := 0;
  v_doc_deleted integer := 0;
  v_approval_deleted integer := 0;
  v_event_deleted integer := 0;
begin
  if v_uid is null then
    raise exception 'Nincs bejelentkezett felhasználó.';
  end if;

  if to_regclass('public.public_reports') is not null then
    select coalesce(array_agg(id), array[]::uuid[]), coalesce(array_agg(token), array[]::text[])
      into v_report_ids, v_tokens
    from public.public_reports pr
    where pr.user_id = v_uid
      and (
        pr.project_id is null
        or not exists (select 1 from public.projects p where p.id = pr.project_id)
      );
  end if;

  if to_regclass('public.report_events') is not null then
    delete from public.report_events re
    where (array_length(v_report_ids,1) is not null and re.report_id = any(v_report_ids))
       or (array_length(v_tokens,1) is not null and re.token = any(v_tokens))
       or (re.created_at is not null and re.created_at < now() - interval '14 days');
    get diagnostics v_event_deleted = row_count;
  end if;

  if to_regclass('public.report_approvals') is not null then
    delete from public.report_approvals ra
    where (ra.project_id is null or not exists (select 1 from public.projects p where p.id = ra.project_id))
       or (array_length(v_report_ids,1) is not null and ra.report_id = any(v_report_ids))
       or (array_length(v_tokens,1) is not null and ra.token = any(v_tokens));
    get diagnostics v_approval_deleted = row_count;
  end if;

  if to_regclass('public.report_documents') is not null then
    delete from public.report_documents rd
    where (rd.owner_user_id = v_uid or rd.owner_user_id is null)
      and (rd.project_id is null or not exists (select 1 from public.projects p where p.id = rd.project_id));
    get diagnostics v_doc_deleted = row_count;
  end if;

  if to_regclass('public.public_reports') is not null then
    delete from public.public_reports pr
    where pr.user_id = v_uid
      and (
        pr.project_id is null
        or not exists (select 1 from public.projects p where p.id = pr.project_id)
      );
    get diagnostics v_public_deleted = row_count;
  end if;

  return jsonb_build_object(
    'public_reports_deleted', v_public_deleted,
    'report_documents_deleted', v_doc_deleted,
    'report_approvals_deleted', v_approval_deleted,
    'report_events_deleted', v_event_deleted
  );
end;
$$;

grant execute on function public.cleanup_my_orphan_reports_v139() to authenticated;
