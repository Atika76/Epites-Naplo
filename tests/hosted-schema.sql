-- Derived from a read-only hosted catalog, 2026-10-19. Synthetic tests ONLY.
-- No production rows, credentials, role passwords or storage objects.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
-- Scope: affected public tables, their ACL/RLS/functions/triggers. Not a full platform dump.
CREATE TABLE public."diary_entries" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "project_id" uuid,
 "user_id" uuid,
 "description" text,
 "work_type" text,
 "created_at" timestamp without time zone DEFAULT now()
);
CREATE TABLE public."entries" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "user_id" uuid,
 "project_id" uuid,
 "phase" text,
 "status" text,
 "priority" text,
 "responsible" text,
 "weather" text,
 "note" text,
 "image_url" text,
 "ai_level" text,
 "ai_score" integer,
 "ai_title" text,
 "ai_advice" jsonb,
 "created_at" timestamp with time zone DEFAULT now(),
 "image_urls" jsonb DEFAULT '[]'::jsonb,
 "ai_json" jsonb,
 "weather_json" jsonb,
 "gps_json" jsonb,
 "materials_json" jsonb DEFAULT '[]'::jsonb,
 "before_images_json" jsonb DEFAULT '[]'::jsonb,
 "after_images_json" jsonb DEFAULT '[]'::jsonb,
 "general_images_json" jsonb DEFAULT '[]'::jsonb,
 "video_urls" jsonb DEFAULT '[]'::jsonb,
 "location_address" text
);
CREATE TABLE public."profiles" (
 "id" uuid NOT NULL,
 "email" text,
 "full_name" text,
 "company_name" text,
 "role" text DEFAULT 'user'::text,
 "created_at" timestamp with time zone DEFAULT now(),
 "is_admin" boolean DEFAULT false,
 "plan" text DEFAULT 'trial'::text,
 "plan_status" text DEFAULT 'active'::text,
 "plan_expires_at" timestamp with time zone,
 "updated_at" timestamp with time zone DEFAULT now(),
 "company_phone" text,
 "company_email" text,
 "company_tax_number" text,
 "company_address" text,
 "company_logo_data" text
);
CREATE TABLE public."project_import_requests" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "token" text NOT NULL,
 "source_app" text DEFAULT 'szakipiac'::text NOT NULL,
 "source_quote_id" text,
 "project_name" text,
 "client_name" text,
 "client_email" text,
 "client_phone" text,
 "client_city" text,
 "client_address" text,
 "quote_total_gross" numeric,
 "payload" jsonb DEFAULT '{}'::jsonb,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "expires_at" timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
 "claimed_by" uuid,
 "claimed_project_id" uuid,
 "claimed_at" timestamp with time zone
);
CREATE TABLE public."project_imports" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "project_id" uuid,
 "source_app" text DEFAULT 'szakipiac'::text NOT NULL,
 "source_quote_id" text,
 "client_name" text,
 "client_email" text,
 "client_phone" text,
 "client_city" text,
 "client_address" text,
 "quote_total_gross" numeric,
 "payload" jsonb DEFAULT '{}'::jsonb,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."project_materials" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "user_id" uuid NOT NULL,
 "project_id" uuid NOT NULL,
 "entry_id" uuid,
 "name" text NOT NULL,
 "quantity" numeric DEFAULT 0,
 "unit" text DEFAULT 'db'::text,
 "note" text,
 "created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."projects" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "user_id" uuid,
 "name" text NOT NULL,
 "location" text,
 "status" text DEFAULT 'active'::text,
 "created_at" timestamp with time zone DEFAULT now(),
 "progress" integer DEFAULT 0,
 "updated_at" timestamp with time zone DEFAULT now(),
 "archived_at" timestamp with time zone,
 "archived_by" uuid
);
CREATE TABLE public."shared_bundle_entitlements" (
 "user_id" uuid NOT NULL,
 "source_app" text DEFAULT 'szakipiac'::text NOT NULL,
 "source_email" text NOT NULL,
 "plan" text DEFAULT 'bundle'::text NOT NULL,
 "expires_at" timestamp with time zone,
 "verified_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."subscriptions" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "user_id" uuid,
 "plan" text DEFAULT 'trial'::text,
 "status" text DEFAULT 'active'::text,
 "trial_ends_at" timestamp with time zone,
 "current_period_end" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT now(),
 "updated_at" timestamp with time zone DEFAULT now(),
 "paypal_order_id" text
);
CREATE TABLE public."tasks" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "user_id" uuid,
 "project_id" uuid,
 "source_entry_id" uuid,
 "title" text NOT NULL,
 "owner" text,
 "deadline" date,
 "priority" text,
 "done" boolean DEFAULT false,
 "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE public."diary_entries" ADD CONSTRAINT "diary_entries_pkey" PRIMARY KEY (id);
ALTER TABLE public."entries" ADD CONSTRAINT "entries_pkey" PRIMARY KEY (id);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."project_import_requests" ADD CONSTRAINT "project_import_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."project_import_requests" ADD CONSTRAINT "project_import_requests_token_key" UNIQUE (token);
ALTER TABLE public."project_imports" ADD CONSTRAINT "project_imports_pkey" PRIMARY KEY (id);
ALTER TABLE public."project_materials" ADD CONSTRAINT "project_materials_pkey" PRIMARY KEY (id);
ALTER TABLE public."projects" ADD CONSTRAINT "projects_pkey" PRIMARY KEY (id);
ALTER TABLE public."shared_bundle_entitlements" ADD CONSTRAINT "shared_bundle_entitlements_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."shared_bundle_entitlements" ADD CONSTRAINT "shared_bundle_entitlements_plan_check" CHECK ((plan = 'bundle'::text));
ALTER TABLE public."subscriptions" ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_pkey" PRIMARY KEY (id);
ALTER TABLE public."entries" ADD CONSTRAINT "entries_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public."entries" ADD CONSTRAINT "entries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."project_import_requests" ADD CONSTRAINT "project_import_requests_claimed_by_fkey" FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."project_import_requests" ADD CONSTRAINT "project_import_requests_claimed_project_id_fkey" FOREIGN KEY (claimed_project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE public."project_imports" ADD CONSTRAINT "project_imports_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public."projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."shared_bundle_entitlements" ADD CONSTRAINT "shared_bundle_entitlements_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_source_entry_id_fkey" FOREIGN KEY (source_entry_id) REFERENCES entries(id) ON DELETE SET NULL;
ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_diary_entries_project_id_v110 ON public.diary_entries USING btree (project_id);
CREATE INDEX idx_diary_entries_user_id_v110 ON public.diary_entries USING btree (user_id);
CREATE INDEX idx_project_imports_project_id ON public.project_imports USING btree (project_id);
CREATE INDEX idx_project_imports_source_quote_id ON public.project_imports USING btree (source_quote_id);
CREATE INDEX profiles_plan_idx ON public.profiles USING btree (plan);
CREATE INDEX entries_project_created_idx ON public.entries USING btree (project_id, created_at DESC);
CREATE INDEX entries_ai_level_idx ON public.entries USING btree (ai_level);
CREATE INDEX entries_video_urls_idx ON public.entries USING gin (video_urls);
CREATE INDEX idx_entries_project_id_v110 ON public.entries USING btree (project_id);
CREATE INDEX idx_entries_user_id_v110 ON public.entries USING btree (user_id);
CREATE INDEX idx_entries_user_project_created ON public.entries USING btree (user_id, project_id, created_at DESC);
CREATE INDEX entries_project_user_created_v153_idx ON public.entries USING btree (project_id, user_id, created_at DESC);
CREATE INDEX project_materials_project_idx ON public.project_materials USING btree (project_id, created_at DESC);
CREATE INDEX idx_project_materials_project_id_v110 ON public.project_materials USING btree (project_id);
CREATE INDEX idx_project_materials_user_id_v110 ON public.project_materials USING btree (user_id);
CREATE INDEX idx_project_materials_project_user ON public.project_materials USING btree (project_id, user_id);
CREATE INDEX idx_projects_user_created ON public.projects USING btree (user_id, created_at DESC);
CREATE INDEX idx_project_import_requests_token ON public.project_import_requests USING btree (token);
CREATE INDEX idx_project_import_requests_claimed_by ON public.project_import_requests USING btree (claimed_by);
CREATE INDEX idx_tasks_project_id_v110 ON public.tasks USING btree (project_id);
CREATE INDEX idx_tasks_user_id_v110 ON public.tasks USING btree (user_id);
CREATE UNIQUE INDEX subscriptions_user_id_unique ON public.subscriptions USING btree (user_id);
CREATE INDEX subscriptions_user_id_idx ON public.subscriptions USING btree (user_id);
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

begin

  insert into public.profiles (id, email, full_name, role)

  values (

    new.id,

    new.email,

    coalesce(new.raw_user_meta_data->>'full_name', 'Felhasználó'),

    case when new.email = 'admin@example.test' then 'admin' else 'user' end

  )

  on conflict (id) do update set

    email = excluded.email,

    full_name = coalesce(public.profiles.full_name, excluded.full_name),

    role = excluded.role;



  insert into public.subscriptions (user_id, plan, status, trial_ends_at)

  values (new.id, 'trial', 'active', now() + interval '7 days')

  on conflict (user_id) do nothing;



  return new;

end;

$function$;
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  select exists (

    select 1

    from profiles

    where id = auth.uid()

      and (

        is_admin = true

        or role = 'admin'

        or email = 'admin@example.test'

      )

  );

$function$;
ALTER TABLE public."diary_entries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."diary_entries" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public."entries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."entries" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."profiles" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public."project_import_requests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."project_import_requests" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public."project_imports" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."project_imports" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public."project_materials" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."project_materials" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public."projects" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."projects" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public."shared_bundle_entitlements" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."shared_bundle_entitlements" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public."subscriptions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."subscriptions" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public."tasks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."tasks" FROM PUBLIC,anon,authenticated,service_role;
GRANT DELETE ON public."diary_entries" TO "anon";
GRANT INSERT ON public."diary_entries" TO "anon";
GRANT MAINTAIN ON public."diary_entries" TO "anon";
GRANT REFERENCES ON public."diary_entries" TO "anon";
GRANT SELECT ON public."diary_entries" TO "anon";
GRANT TRIGGER ON public."diary_entries" TO "anon";
GRANT TRUNCATE ON public."diary_entries" TO "anon";
GRANT UPDATE ON public."diary_entries" TO "anon";
GRANT DELETE ON public."diary_entries" TO "authenticated";
GRANT INSERT ON public."diary_entries" TO "authenticated";
GRANT MAINTAIN ON public."diary_entries" TO "authenticated";
GRANT REFERENCES ON public."diary_entries" TO "authenticated";
GRANT SELECT ON public."diary_entries" TO "authenticated";
GRANT TRIGGER ON public."diary_entries" TO "authenticated";
GRANT TRUNCATE ON public."diary_entries" TO "authenticated";
GRANT UPDATE ON public."diary_entries" TO "authenticated";
GRANT DELETE ON public."diary_entries" TO "service_role";
GRANT INSERT ON public."diary_entries" TO "service_role";
GRANT MAINTAIN ON public."diary_entries" TO "service_role";
GRANT REFERENCES ON public."diary_entries" TO "service_role";
GRANT SELECT ON public."diary_entries" TO "service_role";
GRANT TRIGGER ON public."diary_entries" TO "service_role";
GRANT TRUNCATE ON public."diary_entries" TO "service_role";
GRANT UPDATE ON public."diary_entries" TO "service_role";
GRANT DELETE ON public."entries" TO "anon";
GRANT INSERT ON public."entries" TO "anon";
GRANT MAINTAIN ON public."entries" TO "anon";
GRANT REFERENCES ON public."entries" TO "anon";
GRANT SELECT ON public."entries" TO "anon";
GRANT TRIGGER ON public."entries" TO "anon";
GRANT TRUNCATE ON public."entries" TO "anon";
GRANT UPDATE ON public."entries" TO "anon";
GRANT DELETE ON public."entries" TO "authenticated";
GRANT INSERT ON public."entries" TO "authenticated";
GRANT MAINTAIN ON public."entries" TO "authenticated";
GRANT REFERENCES ON public."entries" TO "authenticated";
GRANT SELECT ON public."entries" TO "authenticated";
GRANT TRIGGER ON public."entries" TO "authenticated";
GRANT TRUNCATE ON public."entries" TO "authenticated";
GRANT UPDATE ON public."entries" TO "authenticated";
GRANT DELETE ON public."entries" TO "service_role";
GRANT INSERT ON public."entries" TO "service_role";
GRANT MAINTAIN ON public."entries" TO "service_role";
GRANT REFERENCES ON public."entries" TO "service_role";
GRANT SELECT ON public."entries" TO "service_role";
GRANT TRIGGER ON public."entries" TO "service_role";
GRANT TRUNCATE ON public."entries" TO "service_role";
GRANT UPDATE ON public."entries" TO "service_role";
GRANT DELETE ON public."profiles" TO "anon";
GRANT INSERT ON public."profiles" TO "anon";
GRANT MAINTAIN ON public."profiles" TO "anon";
GRANT REFERENCES ON public."profiles" TO "anon";
GRANT SELECT ON public."profiles" TO "anon";
GRANT TRIGGER ON public."profiles" TO "anon";
GRANT TRUNCATE ON public."profiles" TO "anon";
GRANT UPDATE ON public."profiles" TO "anon";
GRANT MAINTAIN ON public."profiles" TO "authenticated";
GRANT REFERENCES ON public."profiles" TO "authenticated";
GRANT SELECT ON public."profiles" TO "authenticated";
GRANT TRIGGER ON public."profiles" TO "authenticated";
GRANT TRUNCATE ON public."profiles" TO "authenticated";
GRANT DELETE ON public."profiles" TO "service_role";
GRANT INSERT ON public."profiles" TO "service_role";
GRANT MAINTAIN ON public."profiles" TO "service_role";
GRANT REFERENCES ON public."profiles" TO "service_role";
GRANT SELECT ON public."profiles" TO "service_role";
GRANT TRIGGER ON public."profiles" TO "service_role";
GRANT TRUNCATE ON public."profiles" TO "service_role";
GRANT UPDATE ON public."profiles" TO "service_role";
GRANT DELETE ON public."project_import_requests" TO "anon";
GRANT INSERT ON public."project_import_requests" TO "anon";
GRANT MAINTAIN ON public."project_import_requests" TO "anon";
GRANT REFERENCES ON public."project_import_requests" TO "anon";
GRANT SELECT ON public."project_import_requests" TO "anon";
GRANT TRIGGER ON public."project_import_requests" TO "anon";
GRANT TRUNCATE ON public."project_import_requests" TO "anon";
GRANT UPDATE ON public."project_import_requests" TO "anon";
GRANT DELETE ON public."project_import_requests" TO "authenticated";
GRANT INSERT ON public."project_import_requests" TO "authenticated";
GRANT MAINTAIN ON public."project_import_requests" TO "authenticated";
GRANT REFERENCES ON public."project_import_requests" TO "authenticated";
GRANT SELECT ON public."project_import_requests" TO "authenticated";
GRANT TRIGGER ON public."project_import_requests" TO "authenticated";
GRANT TRUNCATE ON public."project_import_requests" TO "authenticated";
GRANT UPDATE ON public."project_import_requests" TO "authenticated";
GRANT DELETE ON public."project_import_requests" TO "service_role";
GRANT INSERT ON public."project_import_requests" TO "service_role";
GRANT MAINTAIN ON public."project_import_requests" TO "service_role";
GRANT REFERENCES ON public."project_import_requests" TO "service_role";
GRANT SELECT ON public."project_import_requests" TO "service_role";
GRANT TRIGGER ON public."project_import_requests" TO "service_role";
GRANT TRUNCATE ON public."project_import_requests" TO "service_role";
GRANT UPDATE ON public."project_import_requests" TO "service_role";
GRANT DELETE ON public."project_imports" TO "anon";
GRANT INSERT ON public."project_imports" TO "anon";
GRANT MAINTAIN ON public."project_imports" TO "anon";
GRANT REFERENCES ON public."project_imports" TO "anon";
GRANT SELECT ON public."project_imports" TO "anon";
GRANT TRIGGER ON public."project_imports" TO "anon";
GRANT TRUNCATE ON public."project_imports" TO "anon";
GRANT UPDATE ON public."project_imports" TO "anon";
GRANT DELETE ON public."project_imports" TO "authenticated";
GRANT INSERT ON public."project_imports" TO "authenticated";
GRANT MAINTAIN ON public."project_imports" TO "authenticated";
GRANT REFERENCES ON public."project_imports" TO "authenticated";
GRANT SELECT ON public."project_imports" TO "authenticated";
GRANT TRIGGER ON public."project_imports" TO "authenticated";
GRANT TRUNCATE ON public."project_imports" TO "authenticated";
GRANT UPDATE ON public."project_imports" TO "authenticated";
GRANT DELETE ON public."project_imports" TO "service_role";
GRANT INSERT ON public."project_imports" TO "service_role";
GRANT MAINTAIN ON public."project_imports" TO "service_role";
GRANT REFERENCES ON public."project_imports" TO "service_role";
GRANT SELECT ON public."project_imports" TO "service_role";
GRANT TRIGGER ON public."project_imports" TO "service_role";
GRANT TRUNCATE ON public."project_imports" TO "service_role";
GRANT UPDATE ON public."project_imports" TO "service_role";
GRANT DELETE ON public."project_materials" TO "anon";
GRANT INSERT ON public."project_materials" TO "anon";
GRANT MAINTAIN ON public."project_materials" TO "anon";
GRANT REFERENCES ON public."project_materials" TO "anon";
GRANT SELECT ON public."project_materials" TO "anon";
GRANT TRIGGER ON public."project_materials" TO "anon";
GRANT TRUNCATE ON public."project_materials" TO "anon";
GRANT UPDATE ON public."project_materials" TO "anon";
GRANT DELETE ON public."project_materials" TO "authenticated";
GRANT INSERT ON public."project_materials" TO "authenticated";
GRANT MAINTAIN ON public."project_materials" TO "authenticated";
GRANT REFERENCES ON public."project_materials" TO "authenticated";
GRANT SELECT ON public."project_materials" TO "authenticated";
GRANT TRIGGER ON public."project_materials" TO "authenticated";
GRANT TRUNCATE ON public."project_materials" TO "authenticated";
GRANT UPDATE ON public."project_materials" TO "authenticated";
GRANT DELETE ON public."project_materials" TO "service_role";
GRANT INSERT ON public."project_materials" TO "service_role";
GRANT MAINTAIN ON public."project_materials" TO "service_role";
GRANT REFERENCES ON public."project_materials" TO "service_role";
GRANT SELECT ON public."project_materials" TO "service_role";
GRANT TRIGGER ON public."project_materials" TO "service_role";
GRANT TRUNCATE ON public."project_materials" TO "service_role";
GRANT UPDATE ON public."project_materials" TO "service_role";
GRANT DELETE ON public."projects" TO "anon";
GRANT INSERT ON public."projects" TO "anon";
GRANT MAINTAIN ON public."projects" TO "anon";
GRANT REFERENCES ON public."projects" TO "anon";
GRANT SELECT ON public."projects" TO "anon";
GRANT TRIGGER ON public."projects" TO "anon";
GRANT TRUNCATE ON public."projects" TO "anon";
GRANT UPDATE ON public."projects" TO "anon";
GRANT DELETE ON public."projects" TO "authenticated";
GRANT INSERT ON public."projects" TO "authenticated";
GRANT MAINTAIN ON public."projects" TO "authenticated";
GRANT REFERENCES ON public."projects" TO "authenticated";
GRANT SELECT ON public."projects" TO "authenticated";
GRANT TRIGGER ON public."projects" TO "authenticated";
GRANT TRUNCATE ON public."projects" TO "authenticated";
GRANT UPDATE ON public."projects" TO "authenticated";
GRANT DELETE ON public."projects" TO "service_role";
GRANT INSERT ON public."projects" TO "service_role";
GRANT MAINTAIN ON public."projects" TO "service_role";
GRANT REFERENCES ON public."projects" TO "service_role";
GRANT SELECT ON public."projects" TO "service_role";
GRANT TRIGGER ON public."projects" TO "service_role";
GRANT TRUNCATE ON public."projects" TO "service_role";
GRANT UPDATE ON public."projects" TO "service_role";
GRANT DELETE ON public."shared_bundle_entitlements" TO "authenticated";
GRANT INSERT ON public."shared_bundle_entitlements" TO "authenticated";
GRANT MAINTAIN ON public."shared_bundle_entitlements" TO "authenticated";
GRANT REFERENCES ON public."shared_bundle_entitlements" TO "authenticated";
GRANT SELECT ON public."shared_bundle_entitlements" TO "authenticated";
GRANT TRIGGER ON public."shared_bundle_entitlements" TO "authenticated";
GRANT TRUNCATE ON public."shared_bundle_entitlements" TO "authenticated";
GRANT UPDATE ON public."shared_bundle_entitlements" TO "authenticated";
GRANT DELETE ON public."shared_bundle_entitlements" TO "service_role";
GRANT INSERT ON public."shared_bundle_entitlements" TO "service_role";
GRANT MAINTAIN ON public."shared_bundle_entitlements" TO "service_role";
GRANT REFERENCES ON public."shared_bundle_entitlements" TO "service_role";
GRANT SELECT ON public."shared_bundle_entitlements" TO "service_role";
GRANT TRIGGER ON public."shared_bundle_entitlements" TO "service_role";
GRANT TRUNCATE ON public."shared_bundle_entitlements" TO "service_role";
GRANT UPDATE ON public."shared_bundle_entitlements" TO "service_role";
GRANT DELETE ON public."subscriptions" TO "anon";
GRANT INSERT ON public."subscriptions" TO "anon";
GRANT MAINTAIN ON public."subscriptions" TO "anon";
GRANT REFERENCES ON public."subscriptions" TO "anon";
GRANT SELECT ON public."subscriptions" TO "anon";
GRANT TRIGGER ON public."subscriptions" TO "anon";
GRANT TRUNCATE ON public."subscriptions" TO "anon";
GRANT UPDATE ON public."subscriptions" TO "anon";
GRANT MAINTAIN ON public."subscriptions" TO "authenticated";
GRANT REFERENCES ON public."subscriptions" TO "authenticated";
GRANT SELECT ON public."subscriptions" TO "authenticated";
GRANT TRIGGER ON public."subscriptions" TO "authenticated";
GRANT TRUNCATE ON public."subscriptions" TO "authenticated";
GRANT DELETE ON public."subscriptions" TO "service_role";
GRANT INSERT ON public."subscriptions" TO "service_role";
GRANT MAINTAIN ON public."subscriptions" TO "service_role";
GRANT REFERENCES ON public."subscriptions" TO "service_role";
GRANT SELECT ON public."subscriptions" TO "service_role";
GRANT TRIGGER ON public."subscriptions" TO "service_role";
GRANT TRUNCATE ON public."subscriptions" TO "service_role";
GRANT UPDATE ON public."subscriptions" TO "service_role";
GRANT DELETE ON public."tasks" TO "anon";
GRANT INSERT ON public."tasks" TO "anon";
GRANT MAINTAIN ON public."tasks" TO "anon";
GRANT REFERENCES ON public."tasks" TO "anon";
GRANT SELECT ON public."tasks" TO "anon";
GRANT TRIGGER ON public."tasks" TO "anon";
GRANT TRUNCATE ON public."tasks" TO "anon";
GRANT UPDATE ON public."tasks" TO "anon";
GRANT DELETE ON public."tasks" TO "authenticated";
GRANT INSERT ON public."tasks" TO "authenticated";
GRANT MAINTAIN ON public."tasks" TO "authenticated";
GRANT REFERENCES ON public."tasks" TO "authenticated";
GRANT SELECT ON public."tasks" TO "authenticated";
GRANT TRIGGER ON public."tasks" TO "authenticated";
GRANT TRUNCATE ON public."tasks" TO "authenticated";
GRANT UPDATE ON public."tasks" TO "authenticated";
GRANT DELETE ON public."tasks" TO "service_role";
GRANT INSERT ON public."tasks" TO "service_role";
GRANT MAINTAIN ON public."tasks" TO "service_role";
GRANT REFERENCES ON public."tasks" TO "service_role";
GRANT SELECT ON public."tasks" TO "service_role";
GRANT TRIGGER ON public."tasks" TO "service_role";
GRANT TRUNCATE ON public."tasks" TO "service_role";
GRANT UPDATE ON public."tasks" TO "service_role";
GRANT UPDATE ("company_address") ON public."profiles" TO "authenticated";
GRANT UPDATE ("company_email") ON public."profiles" TO "authenticated";
GRANT UPDATE ("company_logo_data") ON public."profiles" TO "authenticated";
GRANT UPDATE ("company_name") ON public."profiles" TO "authenticated";
GRANT UPDATE ("company_phone") ON public."profiles" TO "authenticated";
GRANT UPDATE ("company_tax_number") ON public."profiles" TO "authenticated";
GRANT UPDATE ("full_name") ON public."profiles" TO "authenticated";
GRANT UPDATE ("updated_at") ON public."profiles" TO "authenticated";
REVOKE ALL ON FUNCTION public."handle_new_user"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO "anon";
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO "service_role";
REVOKE ALL ON FUNCTION public."is_current_user_admin"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."is_current_user_admin"() TO "anon";
GRANT EXECUTE ON FUNCTION public."is_current_user_admin"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."is_current_user_admin"() TO "service_role";
CREATE POLICY "Admin see all projects" ON "public"."projects" AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_current_user_admin());
CREATE POLICY "Admin update all projects" ON "public"."projects" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (is_current_user_admin());
CREATE POLICY "Users insert own projects" ON "public"."projects" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users see own projects" ON "public"."projects" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Users update own projects" ON "public"."projects" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "admin_select_all_projects" ON "public"."projects" AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_current_user_admin());
CREATE POLICY "projects owner delete v56" ON "public"."projects" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "projects_all_own" ON "public"."projects" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "admin_select_all_tasks" ON "public"."tasks" AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_current_user_admin());
CREATE POLICY "tasks owner delete v56" ON "public"."tasks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "tasks_all_own" ON "public"."tasks" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "admin_select_all_entries" ON "public"."entries" AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_current_user_admin());
CREATE POLICY "entries owner delete v56" ON "public"."entries" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "entries_all_own" ON "public"."entries" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Admin see all subscriptions" ON "public"."subscriptions" AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_current_user_admin());
CREATE POLICY "Admin update subscriptions" ON "public"."subscriptions" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (is_current_user_admin());
CREATE POLICY "admin_select_all_subscriptions" ON "public"."subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_current_user_admin() OR (auth.uid() = user_id)));
CREATE POLICY "subscriptions read own or admin v31" ON "public"."subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR is_current_user_admin()));
CREATE POLICY "Admin see all diary" ON "public"."diary_entries" AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_current_user_admin());
CREATE POLICY "Users insert diary" ON "public"."diary_entries" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users see own diary" ON "public"."diary_entries" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Users can read claimed import requests" ON "public"."project_import_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((claimed_by = auth.uid()));
CREATE POLICY "Users can read their own project imports" ON "public"."project_imports" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM projects
  WHERE ((projects.id = project_imports.project_id) AND (projects.user_id = auth.uid())))));
CREATE POLICY "project materials owner delete v48" ON "public"."project_materials" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_current_user_admin()));
CREATE POLICY "project materials owner delete v56" ON "public"."project_materials" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "project materials owner insert v48" ON "public"."project_materials" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR is_current_user_admin()));
CREATE POLICY "project materials owner select v48" ON "public"."project_materials" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_current_user_admin()));
CREATE POLICY "project materials owner update v48" ON "public"."project_materials" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_current_user_admin())) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR is_current_user_admin()));
CREATE POLICY "Admin törölhet mindent" ON "public"."profiles" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((auth.jwt() ->> 'email'::text) = 'admin@example.test'::text));
CREATE POLICY "admin_select_all_profiles" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_current_user_admin() OR (auth.uid() = id)));
CREATE POLICY "profiles read own or admin v31" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((id = auth.uid()) OR is_current_user_admin()));
CREATE POLICY "profiles update safe own v31" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY "profiles_self_update_quote_defaults" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY "shared_bundle_entitlements_read_own" ON "public"."shared_bundle_entitlements" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
