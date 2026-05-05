-- V118 egyszerű takarítás + gyorsabb projekt törlés
-- Ezt futtasd Supabase SQL Editorban. NINCS indexelés, ezért nem kellene timeoutolnia.

create or replace function public.cleanup_report_events_v118(p_days integer default 14)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if to_regclass('public.report_events') is null then
    return 0;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='report_events' and column_name='created_at'
  ) then
    delete from public.report_events
    where created_at < now() - (greatest(coalesce(p_days,14),1)::text || ' days')::interval;
    get diagnostics v_deleted = row_count;
  end if;

  return v_deleted;
end;
$$;

grant execute on function public.cleanup_report_events_v118(integer) to authenticated;

create or replace function public.delete_project_full_v118(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Nincs bejelentkezve.';
  end if;

  if not exists (select 1 from public.projects where id = p_project_id and user_id = v_uid) then
    raise exception 'A projekt nem található vagy nem a bejelentkezett felhasználóé.';
  end if;

  -- Kapcsolódó riport események
  if to_regclass('public.report_events') is not null then
    begin delete from public.report_events where project_id = p_project_id; exception when undefined_column then null; end;
    begin
      delete from public.report_events
      where report_id in (select id from public.public_reports where project_id = p_project_id);
    exception when undefined_column or undefined_table then null;
    end;
  end if;

  -- Kapcsolódó táblák, csak ha léteznek
  begin delete from public.report_documents where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;
  begin delete from public.report_approvals where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;
  begin delete from public.public_reports where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;
  begin delete from public.notifications where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;
  begin delete from public.media_files where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;
  begin delete from public.project_members where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;
  begin delete from public.project_materials where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;
  begin delete from public.project_invoices where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;
  begin delete from public.ai_photo_analyses where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;
  begin delete from public.tasks where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;
  begin delete from public.diary_entries where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;
  begin delete from public.entries where project_id = p_project_id; exception when undefined_table or undefined_column then null; end;

  -- Storage objektumok: csak a projekt saját mappája
  begin
    delete from storage.objects
    where bucket_id in ('project-videos','project-media','media-files','report-media')
      and name like (v_uid::text || '/' || p_project_id::text || '/%');
  exception when others then
    null;
  end;

  delete from public.projects where id = p_project_id and user_id = v_uid;
  perform public.cleanup_report_events_v118(14);
  return true;
end;
$$;

grant execute on function public.delete_project_full_v118(uuid) to authenticated;
