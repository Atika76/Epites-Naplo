-- PROPOSAL ONLY: owner approval and backup required. NOT a deployment migration.
-- Exact public-table inventory from 2026-10-19; preserve CRUD, RLS and service_role.
-- TRUNCATE is unnecessary for the inspected application and bypasses RLS.
BEGIN;
-- Per-schema REVOKE cannot subtract a global default grant. The captured live
-- catalogs have no global table defaults for this creator. Fail closed on drift;
-- do not broaden this public-schema proposal to other schemas automatically.
DO $defaults$
BEGIN
 IF EXISTS (
  SELECT 1 FROM pg_catalog.pg_default_acl d
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
  WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace=0
   AND d.defaclobjtype='r' AND a.privilege_type='TRUNCATE'
   AND CASE WHEN a.grantee=0 THEN true ELSE
    pg_catalog.pg_has_role('anon',a.grantee,'USAGE') OR pg_catalog.pg_has_role('authenticated',a.grantee,'USAGE') END
 ) THEN
  RAISE EXCEPTION 'Global TRUNCATE default requires separate review for postgres' USING ERRCODE='P0001';
 END IF;
END;
$defaults$;
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
