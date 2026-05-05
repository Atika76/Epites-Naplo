-- V86 minimalis Supabase javitas: report_documents jogosultsag + torles + gyorsabb lista
-- Ezt SQL Editorban futtasd le.

alter table if exists public.report_documents enable row level security;

drop policy if exists report_documents_owner_all on public.report_documents;
create policy report_documents_owner_all
on public.report_documents
for all
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create index if not exists idx_report_documents_project_created
on public.report_documents(project_id, created_at desc);

create index if not exists idx_report_documents_approval_created
on public.report_documents(approval_id, created_at desc);

-- Ha vannak régi, üres/jelentéktelen jóváhagyott példányok, ezzel később törölhetők.
-- Egyelőre kommentben hagytam, nehogy véletlenül fontos adatot töröljön.
-- delete from public.report_documents
-- where document_type in ('client_approval_copy','client_approval_pdf')
-- and length(coalesce(html_content,'')) < 500;
