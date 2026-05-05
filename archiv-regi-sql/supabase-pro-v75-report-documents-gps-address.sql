-- V75/V76 PRO riport dokumentumkezelo javitas + GPS cim tamogatas
-- Futtathato tobbszor is, nem torol adatot.

create table if not exists public.report_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  approval_id uuid null,
  owner_user_id uuid null default auth.uid(),
  title text not null default 'Epitesi naplo riport',
  document_type text not null default 'approved_report',
  html_content text not null default '',
  text_content text not null default '',
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.report_documents enable row level security;

create index if not exists report_documents_project_id_created_at_idx
on public.report_documents(project_id, created_at desc);

-- GPS/cim kulon mezo opcionalisan, a fo adat tovabbra is gps_json-ban marad.
alter table public.entries add column if not exists location_address text;

drop policy if exists "Users see own report documents" on public.report_documents;
drop policy if exists "Users insert own report documents" on public.report_documents;
drop policy if exists "Users delete own report documents" on public.report_documents;

create policy "Users see own report documents"
on public.report_documents
for select
using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = report_documents.project_id
      and p.user_id = auth.uid()
  )
  or public.is_current_user_admin()
);

create policy "Users insert own report documents"
on public.report_documents
for insert
with check (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = report_documents.project_id
      and p.user_id = auth.uid()
  )
  or public.is_current_user_admin()
);

create policy "Users delete own report documents"
on public.report_documents
for delete
using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = report_documents.project_id
      and p.user_id = auth.uid()
  )
  or public.is_current_user_admin()
);
