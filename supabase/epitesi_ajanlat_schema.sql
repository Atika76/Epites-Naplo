-- Az Építési Napló beépített árajánlatkészítője és ügyfélelfogadása.
-- A SzakiPiac importfolyamattól külön táblákon működik.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.shared_bundle_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source_app text not null default 'szakipiac',
  source_email text not null,
  plan text not null default 'bundle' check (plan = 'bundle'),
  expires_at timestamptz,
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_bundle_entitlements enable row level security;
revoke all on table public.shared_bundle_entitlements from anon;
grant select on table public.shared_bundle_entitlements to authenticated;
drop policy if exists "shared_bundle_entitlements_read_own" on public.shared_bundle_entitlements;
create policy "shared_bundle_entitlements_read_own"
on public.shared_bundle_entitlements for select to authenticated
using (user_id = auth.uid());

create or replace function public.epitesi_has_paid_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = p_user_id
        and lower(coalesce(to_jsonb(p) ->> 'is_admin', 'false')) = 'true'
    )
    or exists (
      select 1
      from public.subscriptions s
      where s.user_id = p_user_id
        and s.plan in ('starter', 'pro', 'business')
        and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end >= now())
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = p_user_id
        and coalesce(to_jsonb(p) ->> 'plan', '') in ('starter', 'pro', 'business')
        and coalesce(to_jsonb(p) ->> 'plan_status', 'active') = 'active'
        and (
          nullif(to_jsonb(p) ->> 'plan_expires_at', '') is null
          or (to_jsonb(p) ->> 'plan_expires_at')::timestamptz >= now()
        )
    )
    or exists (
      select 1
      from public.shared_bundle_entitlements b
      where b.user_id = p_user_id
        and b.plan = 'bundle'
        and (b.expires_at is null or b.expires_at >= now())
    );
$$;

revoke all on function public.epitesi_has_paid_access(uuid) from public;
grant execute on function public.epitesi_has_paid_access(uuid) to authenticated;

create table if not exists public.epitesi_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_type text not null default 'base'
    check (quote_type in ('base','supplement')),
  parent_quote_id uuid references public.epitesi_quotes(id) on delete restrict,
  quote_number text not null,
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','accepted','rejected','expired','project_created')),
  project_name text not null,
  client_name text,
  client_email text,
  client_phone text,
  client_city text,
  client_address text,
  contractor_name text,
  contractor_tax_number text,
  contractor_address text,
  contractor_phone text,
  contractor_email text,
  contractor_logo_data text,
  issue_date date not null default current_date,
  work_address text,
  work_start_date date,
  work_end_date date,
  warranty_terms text,
  exclusions text,
  currency text not null default 'HUF',
  vat_rate numeric not null default 27,
  subtotal_before_discount numeric not null default 0,
  discount_amount numeric not null default 0,
  subtotal_net numeric not null default 0,
  vat_amount numeric not null default 0,
  total_gross numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  introduction text,
  notes text,
  payment_terms text,
  valid_days integer not null default 30 check (valid_days between 1 and 90),
  valid_until timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  decision_name text,
  decision_email text,
  decision_comment text,
  terms_version text,
  project_id uuid references public.projects(id) on delete set null,
  project_created_at timestamptz,
  accepted_snapshot jsonb,
  accepted_snapshot_created_at timestamptz,
  outcome text not null default 'active'
    check (outcome in ('active','completed','cancelled')),
  outcome_reason text,
  outcome_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, quote_number)
);

alter table public.epitesi_quotes
  add column if not exists valid_days integer not null default 30;
alter table public.epitesi_quotes add column if not exists quote_type text not null default 'base';
alter table public.epitesi_quotes add column if not exists parent_quote_id uuid references public.epitesi_quotes(id) on delete restrict;
alter table public.epitesi_quotes drop constraint if exists epitesi_quotes_quote_type_check;
alter table public.epitesi_quotes
  add constraint epitesi_quotes_quote_type_check
  check (
    (quote_type = 'base' and parent_quote_id is null)
    or (quote_type = 'supplement' and parent_quote_id is not null)
  );
alter table public.epitesi_quotes add column if not exists contractor_phone text;
alter table public.epitesi_quotes add column if not exists contractor_email text;
alter table public.epitesi_quotes add column if not exists contractor_logo_data text;
alter table public.epitesi_quotes add column if not exists issue_date date not null default current_date;
alter table public.epitesi_quotes add column if not exists work_address text;
alter table public.epitesi_quotes add column if not exists work_start_date date;
alter table public.epitesi_quotes add column if not exists work_end_date date;
alter table public.epitesi_quotes add column if not exists warranty_terms text;
alter table public.epitesi_quotes add column if not exists exclusions text;
alter table public.epitesi_quotes add column if not exists accepted_snapshot jsonb;
alter table public.epitesi_quotes add column if not exists accepted_snapshot_created_at timestamptz;
alter table public.epitesi_quotes add column if not exists outcome text not null default 'active';
alter table public.epitesi_quotes add column if not exists outcome_reason text;
alter table public.epitesi_quotes add column if not exists outcome_at timestamptz;
alter table public.epitesi_quotes add column if not exists archived_at timestamptz;
alter table public.epitesi_quotes drop constraint if exists epitesi_quotes_outcome_check;
alter table public.epitesi_quotes
  add constraint epitesi_quotes_outcome_check
  check (outcome in ('active','completed','cancelled'));
alter table public.epitesi_quotes add column if not exists subtotal_before_discount numeric not null default 0;
alter table public.epitesi_quotes add column if not exists discount_amount numeric not null default 0;

-- A profil ezeket az alapértelmezett vállalkozói adatokat adja az új ajánlatokhoz.
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists company_phone text;
alter table public.profiles add column if not exists company_email text;
alter table public.profiles add column if not exists company_tax_number text;
alter table public.profiles add column if not exists company_address text;
alter table public.profiles add column if not exists company_logo_data text;
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_update_quote_defaults" on public.profiles;
create policy "profiles_self_update_quote_defaults"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

grant update (
  company_name,
  company_phone,
  company_email,
  company_tax_number,
  company_address,
  company_logo_data
) on table public.profiles to authenticated;

create table if not exists public.epitesi_quote_shares (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.epitesi_quotes(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  opened_at timestamptz,
  decided_at timestamptz,
  decision text check (decision is null or decision in ('accepted','rejected')),
  decision_name text,
  decision_email text,
  decision_comment text,
  terms_accepted boolean not null default false,
  privacy_accepted boolean not null default false,
  terms_version text not null default '2026-07-26-v1',
  revoked_at timestamptz
);

create index if not exists epitesi_quotes_owner_idx
  on public.epitesi_quotes(user_id, created_at desc);
create index if not exists epitesi_quotes_status_idx
  on public.epitesi_quotes(user_id, status, created_at desc);
create index if not exists epitesi_quotes_parent_idx
  on public.epitesi_quotes(parent_quote_id, created_at);
create index if not exists epitesi_quote_shares_quote_idx
  on public.epitesi_quote_shares(quote_id, created_at desc);

alter table public.epitesi_quotes enable row level security;
alter table public.epitesi_quote_shares enable row level security;

drop policy if exists "epitesi_quotes_owner_select" on public.epitesi_quotes;
create policy "epitesi_quotes_owner_select"
on public.epitesi_quotes for select to authenticated
using (user_id = auth.uid());

drop policy if exists "epitesi_quotes_paid_insert" on public.epitesi_quotes;
create policy "epitesi_quotes_paid_insert"
on public.epitesi_quotes for insert to authenticated
with check (user_id = auth.uid() and public.epitesi_has_paid_access(auth.uid()));

drop policy if exists "epitesi_quotes_paid_update" on public.epitesi_quotes;
create policy "epitesi_quotes_paid_update"
on public.epitesi_quotes for update to authenticated
using (user_id = auth.uid() and public.epitesi_has_paid_access(auth.uid()))
with check (user_id = auth.uid() and public.epitesi_has_paid_access(auth.uid()));

drop policy if exists "epitesi_quotes_paid_delete" on public.epitesi_quotes;
create policy "epitesi_quotes_paid_delete"
on public.epitesi_quotes for delete to authenticated
using (user_id = auth.uid() and public.epitesi_has_paid_access(auth.uid()));

-- Az ügyfél döntését és a projektkapcsolatot csak a védett RPC/Edge Function írhatja.
-- A bejelentkezett tulajdonos kizárólag az ajánlat szerkeszthető mezőit módosíthatja.
revoke update on table public.epitesi_quotes from authenticated;
grant select, insert, delete on table public.epitesi_quotes to authenticated;
grant update (
  quote_type,
  parent_quote_id,
  quote_number,
  project_name,
  client_name,
  client_email,
  client_phone,
  client_city,
  client_address,
  contractor_name,
  contractor_tax_number,
  contractor_address,
  contractor_phone,
  contractor_email,
  contractor_logo_data,
  issue_date,
  work_address,
  work_start_date,
  work_end_date,
  warranty_terms,
  exclusions,
  currency,
  vat_rate,
  subtotal_before_discount,
  discount_amount,
  subtotal_net,
  vat_amount,
  total_gross,
  items,
  introduction,
  notes,
  payment_terms,
  valid_days,
  valid_until,
  updated_at
) on table public.epitesi_quotes to authenticated;

create or replace function public.epitesi_validate_quote_parent_v1()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent public.epitesi_quotes%rowtype;
begin
  if new.quote_type = 'base' then
    new.parent_quote_id := null;
    return new;
  end if;

  select * into v_parent
  from public.epitesi_quotes
  where id = new.parent_quote_id;

  if not found
     or v_parent.user_id <> new.user_id
     or v_parent.quote_type <> 'base'
     or v_parent.status not in ('accepted','project_created') then
    raise exception 'Pótmunka csak a saját, elfogadott eredeti ajánlathoz készíthető.';
  end if;

  return new;
end;
$$;

drop trigger if exists epitesi_validate_quote_parent_trigger on public.epitesi_quotes;
create trigger epitesi_validate_quote_parent_trigger
before insert or update of quote_type, parent_quote_id on public.epitesi_quotes
for each row execute function public.epitesi_validate_quote_parent_v1();

-- Az ügyfélnek elküldött tartalom nem írható át utólag. A védett RPC-k és az
-- Edge Function kizárólag az állapotot, a döntési adatokat és a projektkapcsolatot
-- módosíthatják. Elfogadott vagy elküldött ajánlat nem törölhető.
create or replace function public.epitesi_lock_issued_quote_v1()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('sent','viewed','accepted','project_created') then
      raise exception 'Az elküldött vagy elfogadott ajánlat nem törölhető.';
    end if;
    return old;
  end if;

  if old.accepted_snapshot is not null
     and new.accepted_snapshot is distinct from old.accepted_snapshot then
    raise exception 'A zárolt elfogadási példány nem módosítható.';
  end if;

  if old.status in ('sent','viewed','accepted','project_created')
     and (
       to_jsonb(new) - array[
         'status','valid_until','sent_at','viewed_at','accepted_at','rejected_at',
         'decision_name','decision_email','decision_comment','terms_version',
         'project_id','project_created_at','accepted_snapshot','accepted_snapshot_created_at',
         'outcome','outcome_reason','outcome_at','archived_at','updated_at'
       ]::text[]
       <>
       to_jsonb(old) - array[
         'status','valid_until','sent_at','viewed_at','accepted_at','rejected_at',
         'decision_name','decision_email','decision_comment','terms_version',
         'project_id','project_created_at','accepted_snapshot','accepted_snapshot_created_at',
         'outcome','outcome_reason','outcome_at','archived_at','updated_at'
       ]::text[]
     ) then
    raise exception 'Az ügyfélnek elküldött ajánlat tartalma már nem módosítható. Készíts külön pótmunkát vagy kiegészítő ajánlatot.';
  end if;

  return new;
end;
$$;

drop trigger if exists epitesi_lock_issued_quote_trigger on public.epitesi_quotes;
create trigger epitesi_lock_issued_quote_trigger
before update or delete on public.epitesi_quotes
for each row execute function public.epitesi_lock_issued_quote_v1();

drop policy if exists "epitesi_quote_shares_owner_select" on public.epitesi_quote_shares;
create policy "epitesi_quote_shares_owner_select"
on public.epitesi_quote_shares for select to authenticated
using (owner_user_id = auth.uid());

revoke all on table public.epitesi_quote_shares from anon;
grant select on table public.epitesi_quote_shares to authenticated;

create or replace function public.epitesi_create_quote_share_v1(
  p_quote_id uuid,
  p_valid_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_quote public.epitesi_quotes%rowtype;
  v_token text;
  v_expires_at timestamptz;
begin
  if auth.uid() is null or not public.epitesi_has_paid_access(auth.uid()) then
    raise exception 'Az ajánlatküldéshez aktív fizetős Építési Napló csomag szükséges.';
  end if;

  select * into v_quote
  from public.epitesi_quotes
  where id = p_quote_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Az ajánlat nem található vagy nincs hozzá jogosultságod.';
  end if;
  if v_quote.status in ('accepted','project_created') then
    raise exception 'Az elfogadott ajánlathoz nem készíthető új döntési link.';
  end if;

  update public.epitesi_quote_shares
  set revoked_at = now()
  where quote_id = p_quote_id and revoked_at is null and decision is null;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := coalesce(
    v_quote.valid_until,
    now() + make_interval(days => greatest(1, least(coalesce(p_valid_days, 30), 90)))
  );
  if v_expires_at <= now() then
    raise exception 'Az ajánlat érvényességi dátuma már lejárt. Módosítsd a dátumot a küldés előtt.';
  end if;

  insert into public.epitesi_quote_shares(quote_id, owner_user_id, token_hash, expires_at)
  values (
    p_quote_id,
    auth.uid(),
    encode(digest(v_token, 'sha256'), 'hex'),
    v_expires_at
  );

  update public.epitesi_quotes
  set status = 'sent',
      valid_until = v_expires_at,
      sent_at = now(),
      viewed_at = null,
      accepted_at = null,
      rejected_at = null,
      decision_name = null,
      decision_email = null,
      decision_comment = null,
      terms_version = null,
      updated_at = now()
  where id = p_quote_id;

  return jsonb_build_object('ok', true, 'token', v_token, 'expires_at', v_expires_at);
end;
$$;

create or replace function public.epitesi_get_public_quote_v1(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_share public.epitesi_quote_shares%rowtype;
  v_quote public.epitesi_quotes%rowtype;
  v_status text;
begin
  select * into v_share
  from public.epitesi_quote_shares
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and revoked_at is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_link');
  end if;

  select * into v_quote from public.epitesi_quotes where id = v_share.quote_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'quote_not_found');
  end if;

  if v_share.decision is null and v_share.expires_at < now() then
    update public.epitesi_quotes
    set status = 'expired', updated_at = now()
    where id = v_quote.id and status in ('sent','viewed');
    v_status := 'expired';
  else
    v_status := coalesce(v_share.decision, v_quote.status, 'sent');
    if v_share.opened_at is null then
      update public.epitesi_quote_shares set opened_at = now() where id = v_share.id;
      update public.epitesi_quotes
      set viewed_at = coalesce(viewed_at, now()),
          status = case when status = 'sent' then 'viewed' else status end,
          updated_at = now()
      where id = v_quote.id;
      if v_status = 'sent' then v_status := 'viewed'; end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'quote_type', v_quote.quote_type,
    'parent_quote_id', v_quote.parent_quote_id,
    'quote_number', v_quote.quote_number,
    'project_name', v_quote.project_name,
    'client_name', v_quote.client_name,
    'client_email', v_quote.client_email,
    'client_phone', v_quote.client_phone,
    'client_city', v_quote.client_city,
    'client_address', v_quote.client_address,
    'contractor_name', v_quote.contractor_name,
    'contractor_tax_number', v_quote.contractor_tax_number,
    'contractor_address', v_quote.contractor_address,
    'contractor_phone', v_quote.contractor_phone,
    'contractor_email', v_quote.contractor_email,
    'contractor_logo_data', v_quote.contractor_logo_data,
    'issue_date', v_quote.issue_date,
    'work_address', v_quote.work_address,
    'work_start_date', v_quote.work_start_date,
    'work_end_date', v_quote.work_end_date,
    'warranty_terms', v_quote.warranty_terms,
    'exclusions', v_quote.exclusions,
    'currency', v_quote.currency,
    'vat_rate', v_quote.vat_rate,
    'subtotal_before_discount', v_quote.subtotal_before_discount,
    'discount_amount', v_quote.discount_amount,
    'subtotal_net', v_quote.subtotal_net,
    'vat_amount', v_quote.vat_amount,
    'total_gross', v_quote.total_gross,
    'items', v_quote.items,
    'introduction', v_quote.introduction,
    'notes', v_quote.notes,
    'payment_terms', v_quote.payment_terms,
    'valid_until', v_share.expires_at,
    'accepted_at', v_quote.accepted_at,
    'accepted_snapshot', v_quote.accepted_snapshot,
    'accepted_snapshot_created_at', v_quote.accepted_snapshot_created_at,
    'decision_name', v_share.decision_name,
    'decision_email', v_share.decision_email,
    'decision_comment', v_share.decision_comment,
    'decided_at', v_share.decided_at
  );
end;
$$;

create or replace function public.epitesi_decide_public_quote_v1(
  p_token text,
  p_decision text,
  p_name text,
  p_email text,
  p_comment text default '',
  p_terms_accepted boolean default false,
  p_privacy_accepted boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_share public.epitesi_quote_shares%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_name text := left(trim(coalesce(p_name, '')), 180);
  v_email text := left(lower(trim(coalesce(p_email, ''))), 240);
  v_comment text := left(trim(coalesce(p_comment, '')), 2000);
begin
  if v_decision not in ('accepted','rejected') then raise exception 'Érvénytelen döntés.'; end if;
  if length(v_name) < 2 then raise exception 'Add meg a neved.'; end if;
  if position('@' in v_email) < 2 then raise exception 'Adj meg érvényes e-mail-címet.'; end if;
  if not coalesce(p_privacy_accepted, false) then raise exception 'Az adatkezelési tudomásulvétel szükséges.'; end if;
  if v_decision = 'accepted' and not coalesce(p_terms_accepted, false) then
    raise exception 'Az ajánlati feltételek elfogadása szükséges.';
  end if;

  select * into v_share
  from public.epitesi_quote_shares
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and revoked_at is null
  for update;

  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_link'); end if;
  if v_share.decision is not null then
    return jsonb_build_object('ok', true, 'already_decided', true, 'decision', v_share.decision, 'decided_at', v_share.decided_at);
  end if;
  if v_share.expires_at < now() then
    update public.epitesi_quotes set status = 'expired', updated_at = now()
    where id = v_share.quote_id and status in ('sent','viewed');
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  update public.epitesi_quote_shares
  set decision = v_decision,
      decision_name = v_name,
      decision_email = v_email,
      decision_comment = nullif(v_comment, ''),
      terms_accepted = coalesce(p_terms_accepted, false),
      privacy_accepted = true,
      decided_at = now()
  where id = v_share.id;

  update public.epitesi_quotes
  set status = v_decision,
      accepted_at = case when v_decision = 'accepted' then now() else null end,
      rejected_at = case when v_decision = 'rejected' then now() else null end,
      decision_name = v_name,
      decision_email = v_email,
      decision_comment = nullif(v_comment, ''),
      terms_version = v_share.terms_version,
      accepted_snapshot = case when v_decision = 'accepted' then
        (
          select
            (to_jsonb(q) - array[
              'accepted_snapshot','accepted_snapshot_created_at',
              'outcome','outcome_reason','outcome_at','archived_at'
            ]::text[])
            || jsonb_build_object(
              'status', 'accepted',
              'accepted_at', now(),
              'decision_name', v_name,
              'decision_email', v_email,
              'decision_comment', nullif(v_comment, ''),
              'terms_version', v_share.terms_version,
              'terms_accepted', coalesce(p_terms_accepted, false),
              'privacy_accepted', true,
              'share_id', v_share.id
            )
          from public.epitesi_quotes q
          where q.id = v_share.quote_id
        )
        else accepted_snapshot
      end,
      accepted_snapshot_created_at = case when v_decision = 'accepted' then now() else accepted_snapshot_created_at end,
      updated_at = now()
  where id = v_share.quote_id;

  return jsonb_build_object('ok', true, 'decision', v_decision, 'decided_at', now());
end;
$$;

create or replace function public.epitesi_set_quote_lifecycle_v1(
  p_quote_id uuid,
  p_outcome text default 'active',
  p_reason text default '',
  p_archived boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.epitesi_quotes%rowtype;
  v_outcome text := lower(trim(coalesce(p_outcome, 'active')));
  v_reason text := left(trim(coalesce(p_reason, '')), 2000);
begin
  if auth.uid() is null then raise exception 'Bejelentkezés szükséges.'; end if;
  if v_outcome not in ('active','completed','cancelled') then raise exception 'Érvénytelen munkaállapot.'; end if;

  select * into v_quote
  from public.epitesi_quotes
  where id = p_quote_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Az ajánlat nem található.'; end if;
  if v_quote.status not in ('accepted','project_created') then
    raise exception 'Csak elfogadott ajánlat zárható le vagy archiválható.';
  end if;
  if v_outcome = 'cancelled' and length(v_reason) < 3 then
    raise exception 'A meghiúsulás rövid indoklása szükséges.';
  end if;

  update public.epitesi_quotes
  set outcome = v_outcome,
      outcome_reason = case when v_outcome = 'active' then null else nullif(v_reason, '') end,
      outcome_at = case
        when v_outcome = 'active' then null
        when v_quote.outcome = v_outcome and v_quote.outcome_at is not null then v_quote.outcome_at
        else now()
      end,
      archived_at = case
        when not coalesce(p_archived, true) then null
        when v_quote.archived_at is not null then v_quote.archived_at
        else now()
      end,
      updated_at = now()
  where id = p_quote_id;

  return jsonb_build_object(
    'ok', true,
    'quote_id', p_quote_id,
    'outcome', v_outcome,
    'outcome_reason', case when v_outcome = 'active' then null else nullif(v_reason, '') end,
    'outcome_at', case
      when v_outcome = 'active' then null
      when v_quote.outcome = v_outcome and v_quote.outcome_at is not null then v_quote.outcome_at
      else now()
    end,
    'archived_at', case
      when not coalesce(p_archived, true) then null
      when v_quote.archived_at is not null then v_quote.archived_at
      else now()
    end
  );
end;
$$;

update public.epitesi_quotes q
set accepted_snapshot =
      (to_jsonb(q) - array[
        'accepted_snapshot','accepted_snapshot_created_at',
        'outcome','outcome_reason','outcome_at','archived_at'
      ]::text[]),
    accepted_snapshot_created_at = coalesce(q.accepted_at, q.project_created_at, q.updated_at, now())
where q.status in ('accepted','project_created')
  and q.accepted_snapshot is null;

revoke all on function public.epitesi_create_quote_share_v1(uuid, integer) from public;
revoke all on function public.epitesi_get_public_quote_v1(text) from public;
revoke all on function public.epitesi_decide_public_quote_v1(text, text, text, text, text, boolean, boolean) from public;
revoke all on function public.epitesi_set_quote_lifecycle_v1(uuid, text, text, boolean) from public;

grant execute on function public.epitesi_create_quote_share_v1(uuid, integer) to authenticated;
grant execute on function public.epitesi_get_public_quote_v1(text) to anon, authenticated;
grant execute on function public.epitesi_decide_public_quote_v1(text, text, text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.epitesi_set_quote_lifecycle_v1(uuid, text, text, boolean) to authenticated;
