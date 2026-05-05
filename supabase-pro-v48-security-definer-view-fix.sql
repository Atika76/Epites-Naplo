-- V48 - Supabase security linter javitas
-- Futtasd le a Supabase SQL Editorban az epitesi-naplo.eu adatbazisan.
-- Javitasok:
-- 1. Admin overview view-k security_invoker modban futnak, igy eltunik a Critical "Security Definer View" jelzes.
-- 2. A view-k csak admin felhasznalonak adnak vissza sort.
-- 3. project_members es project_materials RLS policy-k optimalizalt (select auth.uid()) formara valtva.

do $$
declare
  has_is_admin boolean := false;
  has_ai_credit_accounts boolean := false;
  has_support_status boolean := false;
begin
  -- Eloszor a mar letezo view-ket is biztonsagos modba allitjuk, akkor is, ha valamelyik alaptabla hianyozna.
  if to_regclass('public.admin_users_overview') is not null then
    execute 'alter view public.admin_users_overview set (security_invoker = true)';
  end if;

  if to_regclass('public.admin_payments_overview') is not null then
    execute 'alter view public.admin_payments_overview set (security_invoker = true)';
  end if;

  if to_regclass('public.admin_support_messages_overview') is not null then
    execute 'alter view public.admin_support_messages_overview set (security_invoker = true)';
  end if;

  if to_regclass('public.admin_account_deletions_overview') is not null then
    execute 'alter view public.admin_account_deletions_overview set (security_invoker = true)';
  end if;

  -- Admin felhasznalok attekintese.
  if to_regclass('public.profiles') is not null
     and to_regclass('public.subscriptions') is not null
     and to_regclass('public.projects') is not null
     and to_regprocedure('public.is_current_user_admin()') is not null then

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'is_admin'
    ) into has_is_admin;

    has_ai_credit_accounts := to_regclass('public.ai_credit_accounts') is not null;

    execute 'drop view if exists public.admin_users_overview';

    if has_ai_credit_accounts then
      execute
        'create view public.admin_users_overview
         with (security_invoker = true)
         as
         select
           p.id,
           p.email,
           p.full_name,
           p.company_name,
           p.role,
           ' || case when has_is_admin then 'coalesce(p.is_admin, false)' else 'false' end || ' as is_admin,
           p.created_at,
           coalesce(s.plan, ''trial'') as plan,
           coalesce(s.status, ''active'') as status,
           s.trial_ends_at,
           s.current_period_end,
           coalesce(ac.credits, 0) as ai_credits,
           coalesce(count(pr.id), 0) as project_count
         from public.profiles p
         left join public.subscriptions s on s.user_id = p.id
         left join public.ai_credit_accounts ac on ac.user_id = p.id
         left join public.projects pr on pr.user_id = p.id
         where public.is_current_user_admin()
         group by p.id, s.plan, s.status, s.trial_ends_at, s.current_period_end, ac.credits';
    else
      execute
        'create view public.admin_users_overview
         with (security_invoker = true)
         as
         select
           p.id,
           p.email,
           p.full_name,
           p.company_name,
           p.role,
           ' || case when has_is_admin then 'coalesce(p.is_admin, false)' else 'false' end || ' as is_admin,
           p.created_at,
           coalesce(s.plan, ''trial'') as plan,
           coalesce(s.status, ''active'') as status,
           s.trial_ends_at,
           s.current_period_end,
           0::integer as ai_credits,
           coalesce(count(pr.id), 0) as project_count
         from public.profiles p
         left join public.subscriptions s on s.user_id = p.id
         left join public.projects pr on pr.user_id = p.id
         where public.is_current_user_admin()
         group by p.id, s.plan, s.status, s.trial_ends_at, s.current_period_end';
    end if;
  end if;

  -- Fizetesek admin nezet.
  if to_regclass('public.payments') is not null
     and to_regclass('public.profiles') is not null
     and to_regprocedure('public.is_current_user_admin()') is not null then
    execute 'drop view if exists public.admin_payments_overview';
    execute
      'create view public.admin_payments_overview
       with (security_invoker = true)
       as
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
       left join public.profiles prof on prof.id = pay.user_id
       where public.is_current_user_admin()';
  end if;

  -- Admin support uzenetek.
  if to_regclass('public.support_messages') is not null
     and to_regprocedure('public.is_current_user_admin()') is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'support_messages'
        and column_name = 'status'
    ) into has_support_status;

    execute 'drop view if exists public.admin_support_messages_overview';

    if to_regclass('public.profiles') is not null then
      execute
        'create view public.admin_support_messages_overview
         with (security_invoker = true)
         as
         select
           sm.id,
           sm.user_id,
           coalesce(sm.email, p.email) as email,
           coalesce(sm.name, p.full_name) as name,
           sm.subject,
           sm.message,
           ' || case when has_support_status then 'sm.status' else '''new''::text' end || ' as status,
           sm.created_at
         from public.support_messages sm
         left join public.profiles p on p.id = sm.user_id
         where public.is_current_user_admin()
         order by sm.created_at desc';
    else
      execute
        'create view public.admin_support_messages_overview
         with (security_invoker = true)
         as
         select
           sm.id,
           sm.user_id,
           sm.email,
           sm.name,
           sm.subject,
           sm.message,
           ' || case when has_support_status then 'sm.status' else '''new''::text' end || ' as status,
           sm.created_at
         from public.support_messages sm
         where public.is_current_user_admin()
         order by sm.created_at desc';
    end if;
  end if;

  -- Fioktorlesi kerelmek admin nezet.
  if to_regclass('public.account_deletions') is not null
     and to_regprocedure('public.is_current_user_admin()') is not null then
    execute 'drop view if exists public.admin_account_deletions_overview';
    execute
      'create view public.admin_account_deletions_overview
       with (security_invoker = true)
       as
       select id, user_id, email, reason, status, created_at, completed_at
       from public.account_deletions
       where public.is_current_user_admin()
       order by created_at desc';
  end if;

  -- Jogosultsagok: anon/public ne kapjon kozvetlen olvasast ezekre az admin view-kre.
  if to_regclass('public.admin_users_overview') is not null then
    execute 'revoke all on public.admin_users_overview from anon';
    execute 'revoke all on public.admin_users_overview from public';
    execute 'grant select on public.admin_users_overview to authenticated';
  end if;

  if to_regclass('public.admin_payments_overview') is not null then
    execute 'revoke all on public.admin_payments_overview from anon';
    execute 'revoke all on public.admin_payments_overview from public';
    execute 'grant select on public.admin_payments_overview to authenticated';
  end if;

  if to_regclass('public.admin_support_messages_overview') is not null then
    execute 'revoke all on public.admin_support_messages_overview from anon';
    execute 'revoke all on public.admin_support_messages_overview from public';
    execute 'grant select on public.admin_support_messages_overview to authenticated';
  end if;

  if to_regclass('public.admin_account_deletions_overview') is not null then
    execute 'revoke all on public.admin_account_deletions_overview from anon';
    execute 'revoke all on public.admin_account_deletions_overview from public';
    execute 'grant select on public.admin_account_deletions_overview to authenticated';
  end if;
end $$;

-- RLS optimalizalas: Supabase sarga "Auth RLS Initialization Plan" figyelmeztetes javitasa.
do $$
begin
  if to_regclass('public.project_materials') is not null then
    alter table public.project_materials enable row level security;

    drop policy if exists "materials owner select" on public.project_materials;
    drop policy if exists "materials owner insert" on public.project_materials;
    drop policy if exists "materials owner delete" on public.project_materials;
    drop policy if exists "project materials owner delete v46" on public.project_materials;
    drop policy if exists "project materials owner select v48" on public.project_materials;
    drop policy if exists "project materials owner insert v48" on public.project_materials;
    drop policy if exists "project materials owner update v48" on public.project_materials;
    drop policy if exists "project materials owner delete v48" on public.project_materials;

    create policy "project materials owner select v48"
    on public.project_materials
    for select
    to authenticated
    using (user_id = (select auth.uid()) or public.is_current_user_admin());

    create policy "project materials owner insert v48"
    on public.project_materials
    for insert
    to authenticated
    with check (user_id = (select auth.uid()) or public.is_current_user_admin());

    create policy "project materials owner update v48"
    on public.project_materials
    for update
    to authenticated
    using (user_id = (select auth.uid()) or public.is_current_user_admin())
    with check (user_id = (select auth.uid()) or public.is_current_user_admin());

    create policy "project materials owner delete v48"
    on public.project_materials
    for delete
    to authenticated
    using (user_id = (select auth.uid()) or public.is_current_user_admin());
  end if;

  if to_regclass('public.project_members') is not null then
    alter table public.project_members enable row level security;

    drop policy if exists "project members owner read v33" on public.project_members;
    drop policy if exists "project members owner insert v33" on public.project_members;
    drop policy if exists "project members owner update v33" on public.project_members;
    drop policy if exists "project members owner delete v33" on public.project_members;
    drop policy if exists "project members owner delete v46" on public.project_members;
    drop policy if exists "project members owner read v48" on public.project_members;
    drop policy if exists "project members owner insert v48" on public.project_members;
    drop policy if exists "project members owner update v48" on public.project_members;
    drop policy if exists "project members owner delete v48" on public.project_members;

    create policy "project members owner read v48"
    on public.project_members
    for select
    to authenticated
    using (
      owner_user_id = (select auth.uid())
      or exists (
        select 1
        from public.projects p
        where p.id = project_members.project_id
          and p.user_id = (select auth.uid())
      )
      or public.is_current_user_admin()
    );

    create policy "project members owner insert v48"
    on public.project_members
    for insert
    to authenticated
    with check (
      owner_user_id = (select auth.uid())
      and exists (
        select 1
        from public.projects p
        where p.id = project_members.project_id
          and p.user_id = (select auth.uid())
      )
    );

    create policy "project members owner update v48"
    on public.project_members
    for update
    to authenticated
    using (owner_user_id = (select auth.uid()) or public.is_current_user_admin())
    with check (owner_user_id = (select auth.uid()) or public.is_current_user_admin());

    create policy "project members owner delete v48"
    on public.project_members
    for delete
    to authenticated
    using (owner_user_id = (select auth.uid()) or public.is_current_user_admin());
  end if;
end $$;
