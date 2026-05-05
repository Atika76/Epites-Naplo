-- V117 ÉpítésNapló: automatikus report_events takarítás + gyors teljes projekt törlés
-- Futtatás: Supabase -> SQL Editor -> New query -> Run
-- Nem töröl felhasználót. Csak régi eseménylogokat és törölt projekthez tartozó adatokat takarít.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'report_events','report_documents','report_approvals','public_reports','notifications','media_files',
    'project_members','project_materials','project_invoices','ai_photo_analyses','tasks','diary_entries','entries'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='project_id') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (project_id)', 'idx_'||t||'_project_id_v117', t);
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='user_id') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id)', 'idx_'||t||'_user_id_v117', t);
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='uid') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (uid)', 'idx_'||t||'_uid_v117', t);
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='report_id') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (report_id)', 'idx_'||t||'_report_id_v117', t);
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='created_at') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (created_at)', 'idx_'||t||'_created_at_v117', t);
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_report_events_v117(p_days integer DEFAULT 14)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF to_regclass('public.report_events') IS NULL THEN
    RETURN 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='report_events' AND column_name='created_at') THEN
    EXECUTE 'DELETE FROM public.report_events WHERE created_at < now() - ($1::int || '' days'')::interval' USING greatest(coalesce(p_days,14),1);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_report_events_v117(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_project_full_v117(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_name text := '';
  v_table text;
  v_sql text;
  has_project_id boolean;
  has_user_id boolean;
  has_owner_user_id boolean;
  has_uid boolean;
  has_message boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nincs bejelentkezve.';
  END IF;

  SELECT name INTO v_project_name
  FROM public.projects
  WHERE id = p_project_id AND user_id = v_uid
  LIMIT 1;

  IF v_project_name IS NULL THEN
    RAISE EXCEPTION 'A projekt nem található vagy nem a bejelentkezett felhasználóé.';
  END IF;

  -- report_events először: sok kis log, ez lassíthatja a törlést.
  IF to_regclass('public.report_events') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='report_events' AND column_name='project_id') THEN
      DELETE FROM public.report_events WHERE project_id = p_project_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='report_events' AND column_name='report_id')
       AND to_regclass('public.public_reports') IS NOT NULL THEN
      DELETE FROM public.report_events
      WHERE report_id IN (SELECT id FROM public.public_reports WHERE project_id = p_project_id);
    END IF;
  END IF;

  -- Storage takarítás: user_id/project_id/... mappák.
  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id IN ('project-videos','project-media','media-files','report-media')
      AND name LIKE (v_uid::text || '/' || p_project_id::text || '/%');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Storage takarítás kihagyva: %', SQLERRM;
  END;

  FOREACH v_table IN ARRAY ARRAY[
    'report_documents','report_approvals','public_reports','media_files','project_members',
    'project_materials','project_invoices','ai_photo_analyses','tasks','diary_entries','entries'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=v_table AND column_name='project_id') INTO has_project_id;
      SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=v_table AND column_name='user_id') INTO has_user_id;
      SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=v_table AND column_name='owner_user_id') INTO has_owner_user_id;
      SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=v_table AND column_name='uid') INTO has_uid;

      IF has_project_id THEN
        v_sql := format('DELETE FROM public.%I WHERE project_id = $1', v_table);
        IF has_user_id THEN v_sql := v_sql || ' AND user_id = $2';
        ELSIF has_owner_user_id THEN v_sql := v_sql || ' AND owner_user_id = $2';
        ELSIF has_uid THEN v_sql := v_sql || ' AND uid = $2';
        END IF;

        IF has_user_id OR has_owner_user_id OR has_uid THEN
          EXECUTE v_sql USING p_project_id, v_uid;
        ELSE
          EXECUTE v_sql USING p_project_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Értesítések takarítása.
  IF to_regclass('public.notifications') IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='project_id') INTO has_project_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='user_id') INTO has_user_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='uid') INTO has_uid;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='message') INTO has_message;

    IF has_project_id THEN
      IF has_user_id THEN EXECUTE 'DELETE FROM public.notifications WHERE project_id = $1 AND user_id = $2' USING p_project_id, v_uid;
      ELSIF has_uid THEN EXECUTE 'DELETE FROM public.notifications WHERE project_id = $1 AND uid = $2' USING p_project_id, v_uid;
      ELSE EXECUTE 'DELETE FROM public.notifications WHERE project_id = $1' USING p_project_id;
      END IF;
    ELSIF has_message AND coalesce(v_project_name,'') <> '' THEN
      IF has_user_id THEN EXECUTE 'DELETE FROM public.notifications WHERE user_id = $1 AND message ILIKE $2' USING v_uid, '%' || v_project_name || '%';
      ELSIF has_uid THEN EXECUTE 'DELETE FROM public.notifications WHERE uid = $1 AND message ILIKE $2' USING v_uid, '%' || v_project_name || '%';
      END IF;
    END IF;
  END IF;

  DELETE FROM public.projects WHERE id = p_project_id AND user_id = v_uid;
  PERFORM public.cleanup_report_events_v117(14);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_project_full_v117(uuid) TO authenticated;
