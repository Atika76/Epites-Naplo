-- Építési Napló önálló árajánlatkészítő és ügyfélelfogadás.
-- A SzakiPiac importfolyamattól külön táblákon működik.

create extension if not exists pgcrypto with schema extensions;

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
    );
$$;

revoke all on function public.epitesi_has_paid_access(uuid) from public;
grant execute on function public.epitesi_has_paid_access(uuid) to authenticated;

create table if not exists public.epitesi_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
  currency text not null default 'HUF',
  vat_rate numeric not null default 27,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, quote_number)
);

alter table public.epitesi_quotes
  add column if not exists valid_days integer not null default 30;

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
  currency,
  vat_rate,
  subtotal_net,
  vat_amount,
  total_gross,
  items,
  introduction,
  notes,
  payment_terms,
  valid_days,
  updated_at
) on table public.epitesi_quotes to authenticated;

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
  v_expires_at := now() + make_interval(days => greatest(1, least(coalesce(p_valid_days, 30), 90)));

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
    'quote_number', v_quote.quote_number,
    'project_name', v_quote.project_name,
    'client_name', v_quote.client_name,
    'client_email', v_quote.client_email,
    'contractor_name', v_quote.contractor_name,
    'contractor_tax_number', v_quote.contractor_tax_number,
    'contractor_address', v_quote.contractor_address,
    'currency', v_quote.currency,
    'vat_rate', v_quote.vat_rate,
    'subtotal_net', v_quote.subtotal_net,
    'vat_amount', v_quote.vat_amount,
    'total_gross', v_quote.total_gross,
    'items', v_quote.items,
    'introduction', v_quote.introduction,
    'notes', v_quote.notes,
    'payment_terms', v_quote.payment_terms,
    'valid_until', v_share.expires_at,
    'decision_name', v_share.decision_name,
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
      updated_at = now()
  where id = v_share.quote_id;

  return jsonb_build_object('ok', true, 'decision', v_decision, 'decided_at', now());
end;
$$;

revoke all on function public.epitesi_create_quote_share_v1(uuid, integer) from public;
revoke all on function public.epitesi_get_public_quote_v1(text) from public;
revoke all on function public.epitesi_decide_public_quote_v1(text, text, text, text, text, boolean, boolean) from public;

grant execute on function public.epitesi_create_quote_share_v1(uuid, integer) to authenticated;
grant execute on function public.epitesi_get_public_quote_v1(text) to anon, authenticated;
grant execute on function public.epitesi_decide_public_quote_v1(text, text, text, text, text, boolean, boolean) to anon, authenticated;
