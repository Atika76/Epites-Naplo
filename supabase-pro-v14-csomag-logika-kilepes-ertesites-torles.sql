-- ÉpítésNapló AI PRO v14
-- Csomag logika fix + kilépés UI fixhez tartozó DB rész + értesítés törlés

alter table public.subscriptions
add column if not exists created_at timestamp with time zone default now();

alter table public.subscriptions
add column if not exists updated_at timestamp with time zone default now();

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own_or_admin" on public.notifications;
create policy "notifications_select_own_or_admin"
on public.notifications
for select
to authenticated
using (user_id = auth.uid() or user_id is null or public.is_current_user_admin());

drop policy if exists "notifications_update_own_or_admin" on public.notifications;
create policy "notifications_update_own_or_admin"
on public.notifications
for update
to authenticated
using (user_id = auth.uid() or public.is_current_user_admin())
with check (user_id = auth.uid() or public.is_current_user_admin());

drop policy if exists "notifications_delete_own_or_admin" on public.notifications;
create policy "notifications_delete_own_or_admin"
on public.notifications
for delete
to authenticated
using (user_id = auth.uid() or public.is_current_user_admin());

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
  v_plan text := lower(coalesce(p_plan, 'trial'));
  v_status text := lower(coalesce(p_status, 'active'));
begin
  if not public.is_current_user_admin() then
    raise exception 'Nincs admin jogosultság.';
  end if;

  if v_plan not in ('trial','starter','pro','business') then
    raise exception 'Érvénytelen csomag. Használható: trial, starter, pro, business.';
  end if;

  if v_status not in ('active','expired','cancelled') then
    raise exception 'Érvénytelen státusz. Használható: active, expired, cancelled.';
  end if;

  if v_status in ('expired','cancelled') then
    v_period_end := now() - interval '1 day';
  else
    v_period_end := now() + (greatest(coalesce(p_days, 30), 1) || ' days')::interval;
  end if;

  insert into public.subscriptions(user_id, plan, status, current_period_end, created_at, updated_at)
  values (p_user_id, v_plan, v_status, v_period_end, now(), now())
  on conflict (user_id) do update
  set plan = excluded.plan,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      updated_at = now();

  insert into public.notifications(user_id, type, title, message)
  values (p_user_id, 'admin_plan_update', 'Csomagod frissítve', 'Az admin frissítette a csomagodat: ' || v_plan || ' / ' || v_status);

  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'plan', v_plan, 'status', v_status, 'current_period_end', v_period_end);
end;
$$;

grant execute on function public.admin_set_user_plan(uuid, text, text, integer) to authenticated;
