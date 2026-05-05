-- V30 - Privát munkavideó tényleges mentése Supabase Storage-ba + szövegfix
-- Ezt futtasd le Supabase SQL Editorban a V30 feltöltése után.

alter table public.entries
add column if not exists video_urls jsonb default '[]'::jsonb;

create index if not exists entries_video_urls_idx
on public.entries using gin (video_urls);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-videos',
  'project-videos',
  true,
  83886080,
  array['video/mp4','video/webm','video/quicktime','video/x-m4v','video/mpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project videos public read" on storage.objects;
drop policy if exists "project videos authenticated upload" on storage.objects;
drop policy if exists "project videos owner update" on storage.objects;
drop policy if exists "project videos owner delete" on storage.objects;

create policy "project videos public read"
on storage.objects for select
to public
using (bucket_id = 'project-videos');

create policy "project videos authenticated upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'project-videos');

create policy "project videos owner update"
on storage.objects for update
to authenticated
using (bucket_id = 'project-videos' and owner = auth.uid())
with check (bucket_id = 'project-videos' and owner = auth.uid());

create policy "project videos owner delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'project-videos' and owner = auth.uid());
