-- V56 - Projekt teljes torles + storage jogosultsag javitas
-- Futtasd Supabase SQL Editorban, ha a weboldali projekt torles hibaval megall.

drop policy if exists "project videos owner select v56" on storage.objects;
create policy "project videos owner select v56"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "project videos owner delete v56" on storage.objects;
create policy "project videos owner delete v56"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

do $$
begin
  if to_regclass('public.projects') is not null then
    alter table public.projects enable row level security;
    drop policy if exists "projects owner delete v56" on public.projects;
    create policy "projects owner delete v56"
    on public.projects
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if to_regclass('public.entries') is not null then
    alter table public.entries enable row level security;
    drop policy if exists "entries owner delete v56" on public.entries;
    create policy "entries owner delete v56"
    on public.entries
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if to_regclass('public.tasks') is not null then
    alter table public.tasks enable row level security;
    drop policy if exists "tasks owner delete v56" on public.tasks;
    create policy "tasks owner delete v56"
    on public.tasks
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if to_regclass('public.project_materials') is not null then
    alter table public.project_materials enable row level security;
    drop policy if exists "project materials owner delete v56" on public.project_materials;
    create policy "project materials owner delete v56"
    on public.project_materials
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if to_regclass('public.project_invoices') is not null then
    alter table public.project_invoices enable row level security;
    drop policy if exists "project invoices owner delete v56" on public.project_invoices;
    create policy "project invoices owner delete v56"
    on public.project_invoices
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if to_regclass('public.ai_photo_analyses') is not null then
    alter table public.ai_photo_analyses enable row level security;
    drop policy if exists "ai photo analyses owner delete v56" on public.ai_photo_analyses;
    create policy "ai photo analyses owner delete v56"
    on public.ai_photo_analyses
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if to_regclass('public.project_members') is not null then
    alter table public.project_members enable row level security;
    drop policy if exists "project members owner delete v56" on public.project_members;
    create policy "project members owner delete v56"
    on public.project_members
    for delete
    to authenticated
    using (owner_user_id = auth.uid());
  end if;

  if to_regclass('public.public_reports') is not null then
    alter table public.public_reports enable row level security;
    drop policy if exists "public reports owner delete v56" on public.public_reports;
    create policy "public reports owner delete v56"
    on public.public_reports
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if to_regclass('public.report_approvals') is not null then
    alter table public.report_approvals enable row level security;
    drop policy if exists "report approvals project owner delete v56" on public.report_approvals;
    create policy "report approvals project owner delete v56"
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
    );
  end if;
end $$;
