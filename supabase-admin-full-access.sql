-- ÉpítésNapló – admin teljes olvasási hozzáférés teszteléshez
-- Ezt futtasd Supabase SQL Editorban.

alter table public.profiles add column if not exists is_admin boolean default false;

update public.profiles
set role = 'admin', is_admin = true
where lower(email) = lower('atika.76@windowslive.com');

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
    and (role = 'admin' or is_admin = true)
  );
$$;

drop policy if exists "admin_select_all_profiles" on public.profiles;
drop policy if exists "admin_select_all_subscriptions" on public.subscriptions;
drop policy if exists "admin_select_all_payments" on public.payments;
drop policy if exists "admin_select_all_projects" on public.projects;
drop policy if exists "admin_select_all_entries" on public.entries;
drop policy if exists "admin_select_all_tasks" on public.tasks;

create policy "admin_select_all_profiles"
on public.profiles
for select
using (public.is_current_user_admin());

create policy "admin_select_all_subscriptions"
on public.subscriptions
for select
using (public.is_current_user_admin());

create policy "admin_select_all_payments"
on public.payments
for select
using (public.is_current_user_admin());

create policy "admin_select_all_projects"
on public.projects
for select
using (public.is_current_user_admin());

create policy "admin_select_all_entries"
on public.entries
for select
using (public.is_current_user_admin());

create policy "admin_select_all_tasks"
on public.tasks
for select
using (public.is_current_user_admin());

drop view if exists public.admin_users_overview;
drop view if exists public.admin_payments_overview;

create or replace view public.admin_users_overview as
select
  p.id,
  p.email,
  p.full_name,
  p.company_name,
  p.role,
  p.is_admin,
  p.created_at,
  coalesce(s.plan, 'trial') as plan,
  coalesce(s.status, 'active') as status,
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
grant execute on function public.is_current_user_admin() to authenticated;
