-- ÉpítésNapló AI PRO v12 – Admin panel, csomagállítás és AI kredit jóváírás
-- Supabase SQL Editorban futtasd le egyszer.

alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists company_name text;

-- A Cégweb26 admin fiók teljes admin jogot kap.
update public.profiles
set role = 'admin', is_admin = true
where lower(email) = lower('cegweb26@gmail.com');

create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and (role = 'admin' or is_admin = true or lower(email) = lower('cegweb26@gmail.com'))
  ) or ((auth.jwt() ->> 'email') = 'cegweb26@gmail.com');
$$;

grant execute on function public.is_current_user_admin() to authenticated;

-- AI kredit táblák biztosítása, ha a v11 SQL még nem futott volna le.
create table if not exists public.ai_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  change integer not null,
  reason text not null,
  paypal_order_id text,
  project_id uuid,
  amount_huf integer,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_credit_accounts enable row level security;
alter table public.ai_credit_transactions enable row level security;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text,
  title text,
  message text,
  read boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;


-- Admin olvasási szabályok.
drop policy if exists "admin_select_all_profiles" on public.profiles;
create policy "admin_select_all_profiles"
on public.profiles
for select
to authenticated
using (public.is_current_user_admin() or auth.uid() = id);

drop policy if exists "admin_select_all_subscriptions" on public.subscriptions;
create policy "admin_select_all_subscriptions"
on public.subscriptions
for select
to authenticated
using (public.is_current_user_admin() or auth.uid() = user_id);

drop policy if exists "admin_select_all_payments" on public.payments;
create policy "admin_select_all_payments"
on public.payments
for select
to authenticated
using (public.is_current_user_admin() or auth.uid() = user_id);

drop policy if exists "Admin can read all AI credit accounts" on public.ai_credit_accounts;
create policy "Admin can read all AI credit accounts"
on public.ai_credit_accounts
for select
to authenticated
using (public.is_current_user_admin() or user_id = auth.uid());

drop policy if exists "Admin can read all AI credit transactions" on public.ai_credit_transactions;
create policy "Admin can read all AI credit transactions"
on public.ai_credit_transactions
for select
to authenticated
using (public.is_current_user_admin() or user_id = auth.uid());

-- Admin csomagállítás: nem kell PayPal, ügyfélszolgálati / teszt célra.
create or replace function public.admin_set_user_plan(
  p_user_id uuid,
  p_plan text,
  p_status text default 'active',
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_end timestamptz;
begin
  if not public.is_current_user_admin() then
    raise exception 'Nincs admin jogosultság.';
  end if;

  if p_user_id is null then
    raise exception 'Hiányzó felhasználó.';
  end if;

  if p_plan not in ('trial','starter','pro','business','expired') then
    raise exception 'Érvénytelen csomag.';
  end if;

  if p_plan = 'expired' or p_status = 'expired' then
    v_period_end := now() - interval '1 day';
    p_status := 'expired';
  else
    v_period_end := now() + (greatest(coalesce(p_days, 30), 1) || ' days')::interval;
    p_status := coalesce(p_status, 'active');
  end if;

  insert into public.subscriptions(user_id, plan, status, current_period_end, updated_at)
  values (p_user_id, p_plan, p_status, v_period_end, now())
  on conflict (user_id) do update
  set plan = excluded.plan,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      updated_at = now();

  insert into public.notifications(user_id, type, title, message)
  values (p_user_id, 'admin_plan_update', 'Csomagod frissítve', 'Az admin frissítette a csomagodat: ' || p_plan)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'plan', p_plan, 'status', p_status, 'current_period_end', v_period_end);
end;
$$;

grant execute on function public.admin_set_user_plan(uuid, text, text, integer) to authenticated;

-- Admin AI kredit jóváírás.
create or replace function public.admin_grant_ai_credits(
  p_user_id uuid,
  p_credits integer,
  p_reason text default 'admin_manual_grant'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
begin
  if not public.is_current_user_admin() then
    raise exception 'Nincs admin jogosultság.';
  end if;

  if p_user_id is null then
    raise exception 'Hiányzó felhasználó.';
  end if;

  if coalesce(p_credits, 0) <= 0 then
    raise exception 'Legalább 1 kreditet adj meg.';
  end if;

  insert into public.ai_credit_accounts(user_id, credits)
  values (p_user_id, p_credits)
  on conflict (user_id) do update
  set credits = public.ai_credit_accounts.credits + excluded.credits,
      updated_at = now()
  returning credits into v_credits;

  insert into public.ai_credit_transactions(user_id, change, reason, meta)
  values (p_user_id, p_credits, coalesce(p_reason, 'admin_manual_grant'), jsonb_build_object('source','admin_panel'));

  insert into public.notifications(user_id, type, title, message)
  values (p_user_id, 'admin_ai_credit_grant', 'AI kredit jóváírva', p_credits::text || ' db AI riport kredit jóváírva.')
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'credits', v_credits, 'added', p_credits);
end;
$$;

grant execute on function public.admin_grant_ai_credits(uuid, integer, text) to authenticated;

-- Admin jog adása / elvétele.
create or replace function public.admin_set_user_admin(
  p_user_id uuid,
  p_is_admin boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Nincs admin jogosultság.';
  end if;

  update public.profiles
  set is_admin = coalesce(p_is_admin, false),
      role = case when coalesce(p_is_admin, false) then 'admin' else 'user' end
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'is_admin', p_is_admin);
end;
$$;

grant execute on function public.admin_set_user_admin(uuid, boolean) to authenticated;

-- View újraépítés: stabil oszlopsorrend, AI kredit mezővel.
drop view if exists public.admin_users_overview;
create view public.admin_users_overview as
select
  p.id,
  p.email,
  p.full_name,
  p.company_name,
  p.role,
  coalesce(p.is_admin, false) as is_admin,
  p.created_at,
  coalesce(s.plan, 'trial') as plan,
  coalesce(s.status, 'active') as status,
  s.trial_ends_at,
  s.current_period_end,
  coalesce(ac.credits, 0) as ai_credits,
  coalesce(count(pr.id), 0) as project_count
from public.profiles p
left join public.subscriptions s on s.user_id = p.id
left join public.ai_credit_accounts ac on ac.user_id = p.id
left join public.projects pr on pr.user_id = p.id
group by p.id, s.plan, s.status, s.trial_ends_at, s.current_period_end, ac.credits;

grant select on public.admin_users_overview to authenticated;

create index if not exists ai_credit_transactions_user_created_idx on public.ai_credit_transactions(user_id, created_at desc);
