-- ÉpítésNapló AI PRO v6 üzleti okosítások
create table if not exists public.ai_report_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  project_id uuid,
  package_type text default 'single',
  amount_huf integer default 990,
  status text default 'draft',
  created_at timestamptz default now()
);
create table if not exists public.invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  project_id uuid,
  title text,
  amount_huf integer default 0,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.ai_report_orders enable row level security;
alter table public.invoice_drafts enable row level security;
create policy if not exists "Users manage own ai report orders" on public.ai_report_orders for all to authenticated using (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com') with check (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com');
create policy if not exists "Users manage own invoice drafts" on public.invoice_drafts for all to authenticated using (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com') with check (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com');
create index if not exists ai_report_orders_user_idx on public.ai_report_orders(user_id, created_at desc);
create index if not exists invoice_drafts_user_idx on public.invoice_drafts(user_id, created_at desc);
