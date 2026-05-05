-- V29 - Privát munkavideók támogatása
-- Ezt futtasd le Supabase SQL Editorban a V29 feltöltése után.
-- A videókat a rendszer elsősorban az ai_json mezőben is megőrzi,
-- de ez az oszlop külön, tisztább tárolást ad a későbbi fejlesztésekhez.

alter table public.entries
add column if not exists video_urls jsonb default '[]'::jsonb;

create index if not exists entries_video_urls_idx
on public.entries using gin (video_urls);

comment on column public.entries.video_urls is
'Privát munkavideók Data URL vagy későbbi Supabase Storage URL formában a napi bejegyzéshez.';
