-- ÉpítésNapló AI PRO – 100% automatikus PayPal Pro aktiválás

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company_name text,
  role text default 'user',
  created_at timestamp with time zone default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  plan text default 'trial',
  status text default 'active',
  trial_ends_at timestamp with time zone default (now() + interval '7 days'),
  current_period_end timestamp with time zone,
  paypal_order_id text,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  paypal_order_id text unique,
  paypal_capture_id text,
  payer_email text,
  amount numeric,
  currency text default 'HUF',
  status text,
  raw jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  location text,
  status text default 'active',
  created_at timestamp with time zone default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  phase text,
  status text,
  priority text,
  responsible text,
  weather text,
  note text,
  image_url text,
  ai_level text,
  ai_score integer,
  ai_title text,
  ai_advice jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  source_entry_id uuid references public.entries(id) on delete set null,
  title text not null,
  owner text,
  deadline date,
  priority text,
  done boolean default false,
  created_at timestamp with time zone default now()
);

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Felhasználó'),
    case when new.email = 'atika.76@windowslive.com' then 'admin' else 'user' end
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
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.projects enable row level security;
alter table public.entries enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "subscriptions_select_own" on public.subscriptions;
drop policy if exists "subscriptions_update_own" on public.subscriptions;
drop policy if exists "subscriptions_insert_own" on public.subscriptions;
drop policy if exists "payments_select_own_or_admin" on public.payments;
drop policy if exists "projects_all_own" on public.projects;
drop policy if exists "entries_all_own" on public.entries;
drop policy if exists "tasks_all_own" on public.tasks;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

create policy "subscriptions_select_own" on public.subscriptions
for select using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "subscriptions_update_own" on public.subscriptions
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "subscriptions_insert_own" on public.subscriptions
for insert with check (auth.uid() = user_id);

create policy "payments_select_own_or_admin" on public.payments
for select using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "projects_all_own" on public.projects
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "entries_all_own" on public.entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tasks_all_own" on public.tasks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace view public.admin_users_overview as
select
  p.id,
  p.email,
  p.full_name,
  p.company_name,
  p.role,
  p.created_at,
  s.plan,
  s.status,
  s.trial_ends_at,
  s.current_period_end,
  coalesce(count(pr.id), 0) as project_count
from public.profiles p
left join public.subscriptions s on s.user_id = p.id
left join public.projects pr on pr.user_id = p.id
group by p.id, s.plan, s.status, s.trial_ends_at, s.current_period_end;

create or replace view public.admin_payments_overview as
select
  pay.id,
  pay.user_id,
  prof.email,
  prof.full_name,
  pay.paypal_order_id,
  pay.paypal_capture_id,
  pay.payer_email,
  pay.amount,
  pay.currency,
  pay.status,
  pay.created_at
from public.payments pay
left join public.profiles prof on prof.id = pay.user_id;

grant select on public.admin_users_overview to authenticated;
grant select on public.admin_payments_overview to authenticated;
