
-- V26 PÉNZTERMELŐ VERZIÓ
-- Ezt futtasd Supabase SQL Editorban a V26 feltöltése után.
-- Cél: fizetés után Starter/Pro/Business csomag aktiválás, free korlátozás, admin teszt.

alter table if exists public.profiles
  add column if not exists plan text default 'trial',
  add column if not exists plan_status text default 'active',
  add column if not exists plan_expires_at timestamptz,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.subscriptions
  add column if not exists plan text default 'trial',
  add column if not exists status text default 'active',
  add column if not exists paypal_order_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists updated_at timestamptz default now();

-- Biztonságos profiles policy tisztítás a végtelen recursion ellen.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles simple access" on public.profiles;
drop policy if exists "profiles read own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;

alter table public.profiles enable row level security;

create policy "profiles read own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles update own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles insert own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

-- Subscriptions: a felhasználó láthassa a saját csomagját.
alter table if exists public.subscriptions enable row level security;

drop policy if exists "subscriptions read own" on public.subscriptions;
create policy "subscriptions read own"
on public.subscriptions
for select
to authenticated
using (user_id = auth.uid());

-- Fizetések lekérdezése saját felhasználónak.
alter table if exists public.payments enable row level security;

drop policy if exists "payments read own" on public.payments;
create policy "payments read own"
on public.payments
for select
to authenticated
using (user_id = auth.uid());

create index if not exists profiles_plan_idx on public.profiles(plan);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists payments_user_plan_idx on public.payments(user_id, plan);

-- Saját admin fiókod kézi Business aktiválása, ha kell:
-- update public.profiles set plan='business', plan_status='active', plan_expires_at=now()+interval '365 days' where email='cegweb26@gmail.com';
-- update public.profiles set plan='business', plan_status='active', plan_expires_at=now()+interval '365 days' where email='atika.76@windowslive.com';
