-- ÉpítésNapló AI PRO v5 - mobil app / push / AI fotó előkészítés

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  user_agent text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
on public.push_subscriptions
for all
to authenticated
using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com')
with check (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com');

create table if not exists public.photo_ai_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  entry_id uuid,
  project_id uuid,
  result jsonb default '{}'::jsonb,
  risk_level text,
  created_at timestamp with time zone default now()
);

alter table public.photo_ai_results enable row level security;

drop policy if exists "Users manage own photo ai results" on public.photo_ai_results;
create policy "Users manage own photo ai results"
on public.photo_ai_results
for all
to authenticated
using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com')
with check (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com');

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
create index if not exists photo_ai_results_entry_idx on public.photo_ai_results(entry_id);
create index if not exists photo_ai_results_project_idx on public.photo_ai_results(project_id);
