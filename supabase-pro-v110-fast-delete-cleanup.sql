-- V110 ÉpítésNapló: gyors projekt törlés + indexek + tényleges Supabase takarítás
-- Futtatás: Supabase SQL Editor -> Run
-- Cél: ha a projektoldalon törölsz, ne maradjanak bent riportok, dokumentumok, fotó sorok, értesítések.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'report_documents','report_approvals','public_reports','notifications','media_files',
    'project_members','project_materials','project_invoices','ai_photo_analyses','tasks','diary_entries','entries'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='project_id') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (project_id)', 'idx_'||t||'_project_id_v110', t);
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='user_id') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id)', 'idx_'||t||'_user_id_v110', t);
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='uid') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (uid)', 'idx_'||t||'_uid_v110', t);
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.delete_project_full_v110(p_project_id uuid)
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

  -- Storage takarítás: videók/fájlok mappái, ahol a név user_id/project_id/... alakú.
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

  -- Értesítések: ha van project_id, pontosan töröl. Ha nincs, legalább a projekt nevére vonatkozó saját értesítéseket szedi ki.
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
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_project_full_v110(uuid) TO authenticated;
