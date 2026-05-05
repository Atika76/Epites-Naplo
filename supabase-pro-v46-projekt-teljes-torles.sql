-- V46 - Projekt teljes törlés jogosultságok
-- Futtasd le Supabase SQL Editorban, hogy a weboldalról törölt projekt a kapcsolódó adatokkal együtt törölhető legyen.

drop policy if exists "project videos owner delete v46" on storage.objects;
create policy "project videos owner delete v46"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-videos'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

do $$
begin
  if to_regclass('public.project_materials') is not null then
    alter table public.project_materials enable row level security;
    drop policy if exists "project materials owner delete v46" on public.project_materials;
    create policy "project materials owner delete v46"
    on public.project_materials
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if to_regclass('public.project_invoices') is not null then
    alter table public.project_invoices enable row level security;
    drop policy if exists "project invoices owner delete v46" on public.project_invoices;
    create policy "project invoices owner delete v46"
    on public.project_invoices
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if to_regclass('public.ai_photo_analyses') is not null then
    alter table public.ai_photo_analyses enable row level security;
    drop policy if exists "ai photo analyses owner delete v46" on public.ai_photo_analyses;
    create policy "ai photo analyses owner delete v46"
    on public.ai_photo_analyses
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if to_regclass('public.project_members') is not null then
    alter table public.project_members enable row level security;
    drop policy if exists "project members owner delete v46" on public.project_members;
    create policy "project members owner delete v46"
    on public.project_members
    for delete
    to authenticated
    using (owner_user_id = auth.uid());
  end if;

  if to_regclass('public.public_reports') is not null then
    alter table public.public_reports enable row level security;
    drop policy if exists "public reports owner delete v46" on public.public_reports;
    create policy "public reports owner delete v46"
    on public.public_reports
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if to_regclass('public.report_approvals') is not null then
    alter table public.report_approvals enable row level security;
    drop policy if exists "report approvals project owner delete v46" on public.report_approvals;
    create policy "report approvals project owner delete v46"
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
