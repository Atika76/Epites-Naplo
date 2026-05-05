-- V44 - Projekt videó mentés javítás
-- Futtasd le Supabase SQL Editorban, ha a projektbe feltöltött videó nem jelenik meg.

alter table if exists public.entries
  add column if not exists ai_json jsonb default '{}'::jsonb,
  add column if not exists video_urls jsonb default '[]'::jsonb;

create index if not exists entries_video_urls_idx
on public.entries using gin (video_urls);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-videos',
  'project-videos',
  false,
  83886080,
  array[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v',
    'video/mpeg',
    'video/3gpp',
    'video/x-msvideo'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project videos public read" on storage.objects;
drop policy if exists "project videos authenticated upload" on storage.objects;
drop policy if exists "project videos owner update" on storage.objects;
drop policy if exists "project videos owner delete" on storage.objects;
drop policy if exists "project videos owner read v31" on storage.objects;
drop policy if exists "project videos owner upload v31" on storage.objects;
drop policy if exists "project videos owner update v31" on storage.objects;
drop policy if exists "project videos owner delete v31" on storage.objects;
drop policy if exists "project videos owner read v44" on storage.objects;
drop policy if exists "project videos owner upload v44" on storage.objects;
drop policy if exists "project videos owner update v44" on storage.objects;
drop policy if exists "project videos owner delete v44" on storage.objects;

create policy "project videos owner read v44"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-videos'
  and owner = auth.uid()
);

create policy "project videos owner upload v44"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-videos'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "project videos owner update v44"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'project-videos'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'project-videos'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "project videos owner delete v44"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-videos'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);
