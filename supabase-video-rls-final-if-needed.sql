-- ÉpítésNapló AI PRO V180 – project-videos Storage RLS végleges alap
-- Ezt csak akkor kell újra futtatni, ha a videó feltöltés továbbra is RLS hibát ad.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-videos', 'project-videos', false, 104857600, null)
on conflict (id) do update set
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = null;

drop policy if exists "project_videos_select_own" on storage.objects;
drop policy if exists "project_videos_insert_own" on storage.objects;
drop policy if exists "project_videos_update_own" on storage.objects;
drop policy if exists "project_videos_delete_own" on storage.objects;
drop policy if exists "project-videos select own" on storage.objects;
drop policy if exists "project-videos insert own" on storage.objects;
drop policy if exists "project-videos update own" on storage.objects;
drop policy if exists "project-videos delete own" on storage.objects;

create policy "project_videos_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'project-videos' and split_part(name, '/', 1) = auth.uid()::text);

create policy "project_videos_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'project-videos' and split_part(name, '/', 1) = auth.uid()::text);

create policy "project_videos_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'project-videos' and split_part(name, '/', 1) = auth.uid()::text)
with check (bucket_id = 'project-videos' and split_part(name, '/', 1) = auth.uid()::text);

create policy "project_videos_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'project-videos' and split_part(name, '/', 1) = auth.uid()::text);
