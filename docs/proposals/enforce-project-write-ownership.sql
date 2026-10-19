-- PROPOSAL ONLY. Separate owner approval required; not a deployment migration.
-- Keep existing permissive policies and legacy unassigned daily entries.
-- A user's own user_id must not authorize writing under another user's project.
BEGIN;
DO $proposal$
DECLARE target text; operation text; policy_name text; expression text;
BEGIN
 FOREACH target IN ARRAY ARRAY['entries','tasks','project_materials','diary_entries'] LOOP
  expression := format('project_id IS NULL OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = %I.project_id AND p.user_id = auth.uid()) OR public.is_current_user_admin()', target);
  FOREACH operation IN ARRAY ARRAY['INSERT','UPDATE'] LOOP
   policy_name := 'project_write_owner_review_' || lower(operation);
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',policy_name,target);
   EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated WITH CHECK (%s)',policy_name,target,operation,expression);
  END LOOP;
 END LOOP;
END;
$proposal$;
COMMIT;
