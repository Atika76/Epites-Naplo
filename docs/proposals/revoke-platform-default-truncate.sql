-- PLATFORM-AUTHORIZED OPERATOR ONLY. Requires separate approval.
-- The hosted postgres role is not a member of supabase_admin.
-- Do not change role membership to bypass this boundary.
BEGIN;
-- Per-schema REVOKE cannot subtract a global default grant. The captured live
-- catalogs have no global table defaults for this creator. Fail closed on drift;
-- do not broaden this public-schema proposal to other schemas automatically.
DO $defaults$
BEGIN
 IF EXISTS (
  SELECT 1 FROM pg_catalog.pg_default_acl d
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
  WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace=0
   AND d.defaclobjtype='r' AND a.privilege_type='TRUNCATE'
   AND CASE WHEN a.grantee=0 THEN true ELSE
    pg_catalog.pg_has_role('anon',a.grantee,'USAGE') OR pg_catalog.pg_has_role('authenticated',a.grantee,'USAGE') END
 ) THEN
  RAISE EXCEPTION 'Global TRUNCATE default requires separate review for supabase_admin' USING ERRCODE='P0001';
 END IF;
END;
$defaults$;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon,authenticated;
COMMIT;
