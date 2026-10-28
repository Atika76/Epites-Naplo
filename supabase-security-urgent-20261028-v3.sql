-- A LÉPÉS: sürgős jogosultságjavítás, nincs indexépítés vagy adattisztítás.
-- Jóváhagyás nélkül NEM futtatható élesben. A B fizetési lépéstől független tranzakció.
-- V2: az eredeti javítás és az éles katalógusexport alapján készült kiegészítés.
-- Ez a teljes fájl helyettesíti a korábbi javító SQL-t; élesben még nincs lefuttatva.
-- Célzott javítás a forrásban és NULL célazonosítós élő próbával igazolt RPC hibákra.
-- NEM futott le az éles adatbázison. Csak séma-/jogosultságellenőrzés és jóváhagyás után.
-- Nem töröl adatot vagy táblát; célzott jogosultság- és RLS-javítást tartalmaz.
-- Függőségek és objektumnevek: a felhasználó éles katalógusexportjával egyeztetve.
begin;

create or replace function public.admin_delete_support_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_current_user_admin() is not true then
    raise exception 'Nincs admin jogosultság' using errcode = '42501';
  end if;
  delete from public.support_messages where id = p_message_id;
  return true;
end;
$$;
revoke all on function public.admin_delete_support_message(uuid) from public, anon;
grant execute on function public.admin_delete_support_message(uuid) to authenticated;

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
  if auth.role() is distinct from 'service_role' then
    raise exception 'Kizárólag szerveroldali kreditjóváírás engedélyezett.' using errcode = '42501';
  end if;
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
revoke all on function public.grant_ai_credits_admin(uuid, integer, text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.grant_ai_credits_admin(uuid, integer, text, text, integer, jsonb) to service_role;

-- A panelműveletek belső adminellenőrzése megmarad; névtelenül már meg sem hívhatók.
revoke all on function public.admin_set_user_plan(uuid, text, text, integer) from public, anon;
revoke all on function public.admin_grant_ai_credits(uuid, integer, text) from public, anon;
revoke all on function public.admin_set_user_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_plan(uuid, text, text, integer) to authenticated;
grant execute on function public.admin_grant_ai_credits(uuid, integer, text) to authenticated;
grant execute on function public.admin_set_user_admin(uuid, boolean) to authenticated;

-- A felhasználó által átadott éles katalógusexport alapján készült kiegészítés.
-- Csak a teljes V2 javítófájl részeként alkalmazandó. Nincs adat- vagy táblatörlés.

-- A régi admin RPC-k neve, paraméterei, visszatérési értéke és művelete megmarad.
-- Az export nem tartalmazza az is_admin_user() segédfüggvényt, ezért ezek is
-- a már ellenőrzött központi is_current_user_admin() döntését használják.
create or replace function public.admin_list_users()
returns table(id uuid, email text, name text, role text, plan text, status text, projects bigint, expires text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_current_user_admin() is not true then
    raise exception 'Nincs admin jogosultság' using errcode = '42501';
  end if;
  return query
  select p.id, p.email, coalesce(p.full_name, p.company_name, p.email) as name,
    p.role, coalesce(s.plan, 'trial') as plan, coalesce(s.status, 'active') as status,
    count(pr.id) as projects,
    coalesce(to_char(s.current_period_end, 'YYYY-MM-DD'), to_char(s.trial_ends_at, 'YYYY-MM-DD'), '') as expires
  from public.profiles p
  left join public.subscriptions s on s.user_id = p.id
  left join public.projects pr on pr.user_id = p.id
  group by p.id, p.email, p.full_name, p.company_name, p.role,
    s.plan, s.status, s.current_period_end, s.trial_ends_at
  order by p.created_at desc;
end;
$$;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_set_user_plan(target_user_id uuid, new_plan text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_current_user_admin() is not true then
    raise exception 'Nincs admin jogosultság' using errcode = '42501';
  end if;
  insert into public.subscriptions (user_id, plan, status, trial_ends_at, current_period_end)
  values (target_user_id, new_plan,
    case when new_plan = 'expired' then 'expired' else 'active' end,
    now() + interval '7 days',
    case when new_plan = 'pro' then now() + interval '30 days' else null end)
  on conflict (user_id) do update set
    plan = excluded.plan, status = excluded.status,
    trial_ends_at = excluded.trial_ends_at, current_period_end = excluded.current_period_end;
  update public.subscriptions set plan = new_plan,
    status = case when new_plan = 'expired' then 'expired' else 'active' end,
    current_period_end = case when new_plan = 'pro' then now() + interval '30 days' else current_period_end end
  where user_id = target_user_id;
  return true;
end;
$$;
revoke all on function public.admin_set_user_plan(uuid, text) from public, anon;
grant execute on function public.admin_set_user_plan(uuid, text) to authenticated;

-- A takarító RPC belső v153 adminellenőrzése változatlan; anon hívás lezárva.
revoke all on function public.admin_cleanup_project_remainders_v153() from public, anon;
grant execute on function public.admin_cleanup_project_remainders_v153() to authenticated;

-- Az éles exportban több PERMISSIVE INSERT szabály van, köztük WITH CHECK true.
-- Újabb PERMISSIVE szabály nem szűkítené ezeket; ez a RESTRICTIVE feltétel ÉS-ként hat.
drop policy if exists "support insert requires owner 20261028" on public.support_messages;
create policy "support insert requires owner 20261028"
on public.support_messages as restrictive for insert to public
with check (auth.uid() is not null and user_id = auth.uid());
revoke insert on public.support_messages from public, anon;
grant insert on public.support_messages to authenticated;

-- Az éles support overview-ból hiányzik a másik három view-n meglévő adminfeltétel.
-- Az oszlopnevek és sorrend az exporttal azonosak.
create or replace view public.admin_support_messages_overview
with (security_invoker = true) as
select sm.id, sm.user_id, coalesce(sm.email, p.email) as email,
  coalesce(sm.name, p.full_name) as name, sm.subject, sm.message, sm.status, sm.created_at
from public.support_messages sm
left join public.profiles p on p.id = sm.user_id
where public.is_current_user_admin();

-- Az overview-k listázásra szolgálnak; a kliens a mögöttes táblán/RPC-n keresztül módosít.
revoke all on public.admin_account_deletions_overview, public.admin_payments_overview,
  public.admin_support_messages_overview, public.admin_users_overview from public, anon;
revoke insert, update, delete, truncate, references, trigger
on public.admin_account_deletions_overview, public.admin_payments_overview,
  public.admin_support_messages_overview, public.admin_users_overview from authenticated;
grant select on public.admin_account_deletions_overview, public.admin_payments_overview,
  public.admin_support_messages_overview, public.admin_users_overview to authenticated;

-- Az exportban megmaradt TRUNCATE jogot az RLS nem korlátozza.
-- Csak a szükségtelen teljes-tábla-ürítési jog szűnik meg, a normál CRUD nem változik.
revoke truncate on public.profiles, public.subscriptions, public.payments, public.projects,
  public.entries, public.tasks, public.ai_credit_accounts, public.ai_credit_transactions,
  public.support_messages from public, anon, authenticated;


-- A friss exportban igazolt túl tág értesítési szabály célzott lezárása.
-- A többi saját/admin/broadcast szabály változatlanul megmarad.
drop policy if exists "Allow all for authenticated" on public.notifications;
revoke truncate on public.notifications, public.account_deletions from public, anon, authenticated;

commit;
