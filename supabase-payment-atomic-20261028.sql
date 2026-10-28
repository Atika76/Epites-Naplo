-- B LÉPÉS: a sürgős jogosultságjavítás UTÁN, külön jóváhagyással.
-- Nem javít és nem töröl korábbi duplikátumot. Eltérésnél teljesen visszagördül.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.ai_credit_transactions in share row exclusive mode;
do $$
begin
  if exists (select 1 from public.ai_credit_transactions where paypal_order_id is not null
      group by paypal_order_id having count(*) > 1) then
    raise exception 'Korábbi duplikált PayPal-rendelés: nincs automatikus adatmódosítás.';
  end if;
  if exists (select 1 from public.ai_credit_transactions where paypal_order_id is not null
      and (btrim(paypal_order_id) = '' or paypal_order_id <> btrim(paypal_order_id))) then
    raise exception 'Üres vagy szóközös PayPal-azonosító: kézi ellenőrzés szükséges.';
  end if;
end;
$$;
create unique index if not exists ai_credit_transactions_paypal_order_uidx
on public.ai_credit_transactions (paypal_order_id) where paypal_order_id is not null;
do $$
begin
  if not exists (
    select 1 from pg_index i join pg_class c on c.oid=i.indexrelid
    join pg_attribute a on a.attrelid=i.indrelid and a.attnum=i.indkey[0]
    where c.oid='public.ai_credit_transactions_paypal_order_uidx'::regclass
      and i.indrelid='public.ai_credit_transactions'::regclass
      and i.indisunique and i.indisvalid and i.indisready and i.indimmediate
      and i.indnkeyatts=1 and i.indexprs is null and a.attname='paypal_order_id'
      and (i.indpred is null or pg_get_expr(i.indpred,i.indrelid)='(paypal_order_id IS NOT NULL)')
  ) then
    raise exception 'Az azonos nevű index nem megfelelő egyediségi védelem.';
  end if;
end;
$$;

create or replace function public.grant_ai_credits_admin(
  p_user_id uuid, p_credits integer,
  p_reason text default 'paypal_ai_credit_purchase',
  p_paypal_order_id text default null, p_amount_huf integer default null,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_claim uuid;
  v_order text := nullif(btrim(p_paypal_order_id), '');
  v_reason text := coalesce(p_reason, 'paypal_ai_credit_purchase');
  v_existing public.ai_credit_transactions%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Kizárólag szerveroldali kreditjóváírás engedélyezett.' using errcode='42501';
  end if;
  if p_user_id is null then raise exception 'Hiányzó user_id.'; end if;
  if coalesce(p_credits,0)<=0 then raise exception 'Hibás kredit mennyiség.'; end if;
  if (p_paypal_order_id is not null or v_reason='paypal_ai_credit_purchase') and v_order is null then
    raise exception 'Hiányzó vagy üres PayPal-rendelési azonosító.';
  end if;

  -- Először az egyedi rendelési kulcsot foglaljuk le. A vesztes kérés itt vár,
  -- és nem jut el a kreditnövelésig. NULL kulcsú, nem PayPal jóváírás továbbra is lehetséges.
  insert into public.ai_credit_transactions(user_id,change,reason,paypal_order_id,amount_huf,meta)
  values(p_user_id,p_credits,v_reason,v_order,p_amount_huf,coalesce(p_meta,'{}'::jsonb))
  on conflict (paypal_order_id) where paypal_order_id is not null do nothing
  returning id into v_claim;

  if v_claim is null then
    select * into v_existing from public.ai_credit_transactions where paypal_order_id=v_order;
    if not found then
      raise exception 'Párhuzamos feldolgozás: a kérés újrapróbálható.' using errcode='40001';
    end if;
    if v_existing.user_id is distinct from p_user_id
        or v_existing.change is distinct from p_credits
        or v_existing.reason is distinct from v_reason
        or v_existing.amount_huf is distinct from p_amount_huf then
      raise exception 'A rendelés már eltérő jóváíráshoz tartozik.' using errcode='22023';
    end if;
    select credits into v_credits from public.ai_credit_accounts where user_id=p_user_id;
    return jsonb_build_object('credits',coalesce(v_credits,0),'added',0,'duplicate',true);
  end if;

  insert into public.ai_credit_accounts(user_id,credits) values(p_user_id,p_credits)
  on conflict (user_id) do update
  set credits=public.ai_credit_accounts.credits+excluded.credits,updated_at=now()
  returning credits into v_credits;
  -- A naplósor és az egyenleg egy tranzakcióban változik: hiba esetén egyik sem marad meg.
  return jsonb_build_object('credits',v_credits,'added',p_credits,'duplicate',false);
end;
$$;
revoke all on function public.grant_ai_credits_admin(uuid,integer,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.grant_ai_credits_admin(uuid,integer,text,text,integer,jsonb) to service_role;
commit;
