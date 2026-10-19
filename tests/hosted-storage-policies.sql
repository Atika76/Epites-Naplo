-- Hosted storage policies; requires genuine Supabase Storage schema.
CREATE POLICY "project videos owner delete v44" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'project-videos'::text) AND (owner = auth.uid()) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "project videos owner delete v46" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'project-videos'::text) AND (owner = auth.uid()) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "project videos owner delete v56" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'project-videos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "project videos owner read v44" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'project-videos'::text) AND (owner = auth.uid())));
CREATE POLICY "project videos owner select v56" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'project-videos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "project videos owner update v44" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'project-videos'::text) AND (owner = auth.uid()) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'project-videos'::text) AND (owner = auth.uid()) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "project videos owner upload v44" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'project-videos'::text) AND (owner = auth.uid()) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "project_videos_delete_own" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'project-videos'::text) AND ((split_part(name, '/'::text, 1) = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))));
CREATE POLICY "project_videos_insert_own" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'project-videos'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
CREATE POLICY "project_videos_select_own" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'project-videos'::text) AND ((split_part(name, '/'::text, 1) = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))));
CREATE POLICY "project_videos_update_own" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'project-videos'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))) WITH CHECK (((bucket_id = 'project-videos'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
