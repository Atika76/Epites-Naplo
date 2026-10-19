-- PLATFORM-AUTHORIZED OPERATOR ONLY. Requires separate approval.
-- The hosted postgres role is not a member of supabase_admin.
-- Do not change role membership to bypass this boundary.
BEGIN;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon,authenticated;
COMMIT;
