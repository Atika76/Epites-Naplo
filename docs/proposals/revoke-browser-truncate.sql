-- PROPOSAL ONLY: owner approval and backup required. NOT a deployment migration.
-- Exact public-table inventory from 2026-10-19; preserve CRUD, RLS and service_role.
-- TRUNCATE is unnecessary for the inspected application and bypasses RLS.
BEGIN;
REVOKE TRUNCATE ON TABLE public."account_deletions" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."ai_credit_accounts" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."ai_credit_transactions" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."ai_photo_analyses" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."analytics_events" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."client_project_links" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."client_project_messages" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."diary_entries" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."entries" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."epitesi_quote_shares" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."epitesi_quotes" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."media_files" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."notifications" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."payments" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."photo_ai_results" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."profiles" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."project_extra_works" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."project_import_requests" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."project_imports" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."project_invoices" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."project_materials" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."project_members" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."projects" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."public_reports" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."push_subscriptions" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."report_approvals" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."report_documents" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."report_events" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."shared_bundle_entitlements" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."subscriptions" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."support_messages" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."tasks" FROM anon,authenticated;
-- Execute each creator-role default change only with authorized role membership.
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon,authenticated;
COMMIT;
