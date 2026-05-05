-- ÉpítésNapló AI PRO v7 - AI képfelismerés eredmények tárolása
create table if not exists public.ai_photo_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  project_id uuid,
  entry_id uuid,
  analysis jsonb default '{}'::jsonb,
  risk_level text,
  confidence numeric,
  source text default 'AI képfelismerés',
  created_at timestamptz default now()
);

alter table public.ai_photo_analyses enable row level security;

do $$ begin
  create policy "Users manage own ai photo analyses"
  on public.ai_photo_analyses
  for all to authenticated
  using (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com')
  with check (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com');
exception when duplicate_object then null;
end $$;

create index if not exists ai_photo_analyses_user_created_idx on public.ai_photo_analyses(user_id, created_at desc);
create index if not exists ai_photo_analyses_project_idx on public.ai_photo_analyses(project_id, created_at desc);
create index if not exists ai_photo_analyses_entry_idx on public.ai_photo_analyses(entry_id);
