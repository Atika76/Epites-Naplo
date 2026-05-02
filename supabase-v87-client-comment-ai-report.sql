-- V87 - Ügyfél kérdés/megjegyzés mező biztonságos hozzáadása
alter table public.report_approvals
add column if not exists client_comment text;

-- Gyorsító indexek a jóváhagyott riportokhoz
create index if not exists idx_report_approvals_project_created
on public.report_approvals(project_id, created_at desc);

create index if not exists idx_report_documents_approval_created
on public.report_documents(approval_id, created_at desc);
