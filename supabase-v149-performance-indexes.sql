-- V149 - Supabase gyorsítás indexek
-- Ezt egyszer futtasd le a Supabase SQL Editorban.
-- Nem töröl adatot, csak gyorsítja a gyakori lekérdezéseket.

create index if not exists idx_entries_user_project_created
on public.entries (user_id, project_id, created_at desc);

create index if not exists idx_projects_user_created
on public.projects (user_id, created_at desc);

create index if not exists idx_project_materials_project_user
on public.project_materials (project_id, user_id);

create index if not exists idx_project_invoices_project_user
on public.project_invoices (project_id, user_id);

create index if not exists idx_public_reports_project_user
on public.public_reports (project_id, user_id);

create index if not exists idx_public_reports_token
on public.public_reports (token);

create index if not exists idx_report_documents_project_created
on public.report_documents (project_id, created_at desc);

create index if not exists idx_report_events_report_created
on public.report_events (report_id, created_at desc);
