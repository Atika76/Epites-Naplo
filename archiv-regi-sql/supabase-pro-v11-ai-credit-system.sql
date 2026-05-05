-- ÉpítésNapló AI PRO v11 – AI riport kredit rendszer
-- Supabase SQL Editorban futtasd le egyszer.

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

drop policy if exists "Users can read own AI credit account" on public.ai_credit_accounts;
create policy "Users can read own AI credit account"
on public.ai_credit_accounts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own AI credit transactions" on public.ai_credit_transactions;
create policy "Users can read own AI credit transactions"
on public.ai_credit_transactions
for select
to authenticated
using (user_id = auth.uid());

-- Admin olvasás cegweb26@gmail.com fiókkal
drop policy if exists "Admin can read all AI credit accounts" on public.ai_credit_accounts;
create policy "Admin can read all AI credit accounts"
on public.ai_credit_accounts
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'cegweb26@gmail.com');

drop policy if exists "Admin can read all AI credit transactions" on public.ai_credit_transactions;
create policy "Admin can read all AI credit transactions"
on public.ai_credit_transactions
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'cegweb26@gmail.com');

create index if not exists ai_credit_transactions_user_created_idx on public.ai_credit_transactions(user_id, created_at desc);
create index if not exists ai_credit_transactions_order_idx on public.ai_credit_transactions(paypal_order_id);

-- Biztonságos kredit levonás: a user csak saját kreditjét tudja fogyasztani.
create or replace function public.spend_ai_credit(p_reason text default 'paid_ai_report', p_project_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_credits integer;
begin
  if v_user is null then
    raise exception 'Nincs bejelentkezve.';
  end if;

  insert into public.ai_credit_accounts(user_id, credits)
  values (v_user, 0)
  on conflict (user_id) do nothing;

  select credits into v_credits
  from public.ai_credit_accounts
  where user_id = v_user
  for update;

  if coalesce(v_credits, 0) <= 0 then
    raise exception 'Nincs elérhető AI riport kredit.';
  end if;

  update public.ai_credit_accounts
  set credits = credits - 1, updated_at = now()
  where user_id = v_user
  returning credits into v_credits;

  insert into public.ai_credit_transactions(user_id, change, reason, project_id)
  values (v_user, -1, coalesce(p_reason, 'paid_ai_report'), p_project_id);

  return jsonb_build_object('credits', v_credits, 'spent', 1);
end;
$$;

grant execute on function public.spend_ai_credit(text, uuid) to authenticated;

-- Edge Function service role ezt használja PayPal siker után.
create or replace function public.grant_ai_credits_admin(
  p_user_id uuid,
  p_credits integer,
  p_reason text default 'paypal_ai_credit_purchase',
  p_paypal_order_id text default null,
  p_amount_huf integer default null,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_existing uuid;
begin
  if p_user_id is null then
    raise exception 'Hiányzó user_id.';
  end if;
  if coalesce(p_credits, 0) <= 0 then
    raise exception 'Hibás kredit mennyiség.';
  end if;

  if p_paypal_order_id is not null then
    select id into v_existing
    from public.ai_credit_transactions
    where paypal_order_id = p_paypal_order_id
    limit 1;

    if v_existing is not null then
      select credits into v_credits from public.ai_credit_accounts where user_id = p_user_id;
      return jsonb_build_object('credits', coalesce(v_credits, 0), 'duplicate', true);
    end if;
  end if;

  insert into public.ai_credit_accounts(user_id, credits)
  values (p_user_id, p_credits)
  on conflict (user_id) do update
  set credits = public.ai_credit_accounts.credits + excluded.credits,
      updated_at = now()
  returning credits into v_credits;

  insert into public.ai_credit_transactions(user_id, change, reason, paypal_order_id, amount_huf, meta)
  values (p_user_id, p_credits, coalesce(p_reason, 'paypal_ai_credit_purchase'), p_paypal_order_id, p_amount_huf, coalesce(p_meta, '{}'::jsonb));

  return jsonb_build_object('credits', v_credits, 'added', p_credits);
end;
$$;

-- service_role tudja hívni Edge Functionből; authenticatednek direktben NEM adunk grantot.

-- Opcionális: meglévő bejelentkezett felhasználónál létrehozza az account sort első olvasás után is.
