-- V57 - report_approvals torlesi jogosultsag javitas
-- Ezt futtasd le Supabase SQL Editorban, ha ezt latod:
-- permission denied for table report_approvals

grant usage on schema public to authenticated;

do $$
begin
  if to_regclass('public.projects') is not null then
    execute 'grant select, delete on public.projects to authenticated';
  end if;

  if to_regclass('public.entries') is not null then
    execute 'grant select, delete on public.entries to authenticated';
  end if;

  if to_regclass('public.tasks') is not null then
    execute 'grant select, delete on public.tasks to authenticated';
  end if;

  if to_regclass('public.public_reports') is not null then
    execute 'grant select, delete on public.public_reports to authenticated';
  end if;

  if to_regclass('public.report_approvals') is not null then
    execute 'grant select, delete on public.report_approvals to authenticated';
  end if;

  if to_regclass('public.project_members') is not null then
    execute 'grant select, delete on public.project_members to authenticated';
  end if;

  if to_regclass('public.project_materials') is not null then
    execute 'grant select, delete on public.project_materials to authenticated';
  end if;

  if to_regclass('public.project_invoices') is not null then
    execute 'grant select, delete on public.project_invoices to authenticated';
  end if;

  if to_regclass('public.ai_photo_analyses') is not null then
    execute 'grant select, delete on public.ai_photo_analyses to authenticated';
  end if;
end $$;

do $$
begin
  if to_regclass('public.report_approvals') is not null then
    alter table public.report_approvals enable row level security;

    drop policy if exists "report approvals owner select v57" on public.report_approvals;
    create policy "report approvals owner select v57"
    on public.report_approvals
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.projects p
        where p.id = report_approvals.project_id
          and p.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.public_reports pr
        where pr.id = report_approvals.report_id
          and pr.user_id = auth.uid()
      )
    );

    drop policy if exists "report approvals owner delete v57" on public.report_approvals;
    create policy "report approvals owner delete v57"
    on public.report_approvals
    for delete
    to authenticated
    using (
      exists (
        select 1
        from public.projects p
        where p.id = report_approvals.project_id
          and p.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.public_reports pr
        where pr.id = report_approvals.report_id
          and pr.user_id = auth.uid()
      )
    );
  end if;
end $$;
