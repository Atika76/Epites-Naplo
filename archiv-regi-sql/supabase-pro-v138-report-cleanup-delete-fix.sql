-- V138 – Projekt törlés utáni riport-takarítás segéd SQL
-- Opcionális: a frontend is próbál takarítani, de ezt érdemes lefuttatni később SQL Editorban.

create or replace function public.delete_project_reports_v138(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.report_events
  where report_id in (select id from public.public_reports where project_id = p_project_id)
     or token in (select token from public.public_reports where project_id = p_project_id);

  delete from public.report_documents where project_id = p_project_id;
  delete from public.report_approvals where project_id = p_project_id;
  delete from public.public_reports where project_id = p_project_id;
  return true;
end;
$$;

grant execute on function public.delete_project_reports_v138(uuid) to authenticated;
