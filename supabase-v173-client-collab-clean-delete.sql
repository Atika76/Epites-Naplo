-- V173 – Megrendelői együttműködés + teljes projekt törlés javítás
-- Futtasd Supabase SQL Editorban egyszer. Ez hozza létre az ügyfél/megrendelői napló, pluszmunka-jóváhagyás
-- és a végleges projekt-törlő RPC hátterét.

create extension if not exists pgcrypto;

-- 1) Megrendelői hozzáférési linkek
create table if not exists public.client_project_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  client_name text,
  client_email text,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_project_links_project on public.client_project_links(project_id);
create index if not exists idx_client_project_links_token on public.client_project_links(token);
create index if not exists idx_client_project_links_user on public.client_project_links(user_id);

-- 2) Megrendelői megjegyzések / kérdések / hibajelzések
create table if not exists public.client_project_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  link_id uuid references public.client_project_links(id) on delete set null,
  author_name text,
  author_email text,
  message_type text not null default 'note',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_project_messages_project on public.client_project_messages(project_id, created_at desc);
create index if not exists idx_client_project_messages_user on public.client_project_messages(user_id);

-- 3) Pluszmunka jóváhagyások
create table if not exists public.project_extra_works (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  client_name text,
  client_email text,
  client_message text,
  client_decision_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_extra_works_project on public.project_extra_works(project_id, created_at desc);
create index if not exists idx_project_extra_works_user on public.project_extra_works(user_id);

-- Explicit GRANT-ok a Data API miatt.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.client_project_links to authenticated;
grant select, insert, update, delete on public.client_project_messages to authenticated;
grant select, insert, update, delete on public.project_extra_works to authenticated;

alter table public.client_project_links enable row level security;
alter table public.client_project_messages enable row level security;
alter table public.project_extra_works enable row level security;

-- Régi policy-k takarítása, hogy ne akadjanak össze.
drop policy if exists client_project_links_owner_all_v173 on public.client_project_links;
drop policy if exists client_project_messages_owner_all_v173 on public.client_project_messages;
drop policy if exists project_extra_works_owner_all_v173 on public.project_extra_works;

create policy client_project_links_owner_all_v173
on public.client_project_links
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy client_project_messages_owner_all_v173
on public.client_project_messages
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy project_extra_works_owner_all_v173
on public.project_extra_works
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Segédfüggvény: tokenből projektet keres. Elfogad megrendelői link tokent vagy riport tokent is.
create or replace function public.resolve_client_project_v173(p_token text default '', p_report_token text default '')
returns table(project_id uuid, user_id uuid, link_id uuid, project_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select l.project_id, l.user_id, l.id, coalesce(p.name, '')::text
  from public.client_project_links l
  left join public.projects p on p.id = l.project_id
  where l.is_active = true
    and length(coalesce(p_token,'')) > 0
    and l.token = p_token
  limit 1;

  if found then
    return;
  end if;

  return query
  select r.project_id, r.user_id, null::uuid, coalesce(r.project_name, p.name, '')::text
  from public.public_reports r
  left join public.projects p on p.id = r.project_id
  where coalesce(r.is_active, true) = true
    and length(coalesce(p_report_token,'')) > 0
    and r.token = p_report_token
    and r.project_id is not null
  limit 1;
end;
$$;

grant execute on function public.resolve_client_project_v173(text, text) to anon, authenticated;

-- Kivitelező: megrendelői link létrehozása / frissítése
create or replace function public.create_client_project_link_v173(p_project_id uuid, p_client_name text default '', p_client_email text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.client_project_links%rowtype;
  v_email text := nullif(trim(coalesce(p_client_email,'')), '');
begin
  if v_uid is null then
    raise exception 'Nincs bejelentkezve.';
  end if;

  if not exists(select 1 from public.projects where id = p_project_id and user_id = v_uid) then
    raise exception 'Nincs jogosultság ehhez a projekthez.';
  end if;

  if v_email is not null then
    select * into v_row
    from public.client_project_links
    where project_id = p_project_id and user_id = v_uid and lower(coalesce(client_email,'')) = lower(v_email)
    order by created_at desc
    limit 1;
  end if;

  if v_row.id is not null then
    update public.client_project_links
    set client_name = nullif(trim(coalesce(p_client_name,'')), ''),
        client_email = v_email,
        is_active = true,
        updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.client_project_links(user_id, project_id, client_name, client_email, token, is_active)
    values(v_uid, p_project_id, nullif(trim(coalesce(p_client_name,'')), ''), v_email, encode(gen_random_bytes(24), 'hex'), true)
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.create_client_project_link_v173(uuid, text, text) to authenticated;

-- Kivitelező: projekt együttműködési adatok betöltése
create or replace function public.get_project_client_collab_v173(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Nincs bejelentkezve.';
  end if;

  if not exists(select 1 from public.projects where id = p_project_id and user_id = v_uid) then
    raise exception 'Nincs jogosultság ehhez a projekthez.';
  end if;

  return jsonb_build_object(
    'links', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select id, project_id, client_name, client_email, token, is_active, created_at, updated_at
        from public.client_project_links
        where project_id = p_project_id and user_id = v_uid
        order by created_at desc
        limit 20
      ) x
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select id, project_id, link_id, author_name, author_email, message_type, message, created_at
        from public.client_project_messages
        where project_id = p_project_id and user_id = v_uid
        order by created_at desc
        limit 80
      ) x
    ), '[]'::jsonb),
    'extra_works', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select id, project_id, title, description, amount, status, client_name, client_email, client_message, client_decision_at, created_at, updated_at
        from public.project_extra_works
        where project_id = p_project_id and user_id = v_uid
        order by created_at desc
        limit 80
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_project_client_collab_v173(uuid) to authenticated;

-- Megrendelő: publikus felület adatai
create or replace function public.client_get_project_collab_v173(p_token text default '', p_report_token text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  select * into v from public.resolve_client_project_v173(p_token, p_report_token) limit 1;
  if v.project_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'messages', '[]'::jsonb, 'extra_works', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'project_id', v.project_id,
    'project_name', v.project_name,
    'messages', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select author_name, author_email, message_type, message, created_at
        from public.client_project_messages
        where project_id = v.project_id
        order by created_at desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'extra_works', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select id, title, description, amount, status, client_name, client_email, client_message, client_decision_at, created_at
        from public.project_extra_works
        where project_id = v.project_id
        order by created_at desc
        limit 50
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.client_get_project_collab_v173(text, text) to anon, authenticated;

-- Megrendelő: külön napló/megjegyzés mentése
create or replace function public.client_add_project_note_v173(
  p_token text default '',
  p_report_token text default '',
  p_name text default '',
  p_email text default '',
  p_message text default '',
  p_type text default 'note'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_id uuid;
  v_type text := lower(trim(coalesce(p_type, 'note')));
begin
  select * into v from public.resolve_client_project_v173(p_token, p_report_token) limit 1;
  if v.project_id is null then
    raise exception 'A megrendelői link nem található vagy nem aktív.';
  end if;

  if length(trim(coalesce(p_message,''))) < 2 then
    raise exception 'Az üzenet túl rövid.';
  end if;

  if v_type not in ('note','question','issue','approval') then
    v_type := 'note';
  end if;

  insert into public.client_project_messages(user_id, project_id, link_id, author_name, author_email, message_type, message)
  values(v.user_id, v.project_id, v.link_id, nullif(trim(coalesce(p_name,'')), ''), nullif(trim(coalesce(p_email,'')), ''), v_type, left(trim(p_message), 5000))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.client_add_project_note_v173(text, text, text, text, text, text) to anon, authenticated;

-- Megrendelő: pluszmunka elfogadás / kérdés / elutasítás
create or replace function public.client_decide_extra_work_v173(
  p_token text default '',
  p_report_token text default '',
  p_extra_work_id uuid default null,
  p_decision text default 'accepted',
  p_name text default '',
  p_email text default '',
  p_message text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_decision text := lower(trim(coalesce(p_decision, 'accepted')));
begin
  select * into v from public.resolve_client_project_v173(p_token, p_report_token) limit 1;
  if v.project_id is null then
    raise exception 'A megrendelői link nem található vagy nem aktív.';
  end if;

  if v_decision not in ('accepted','question','rejected') then
    v_decision := 'question';
  end if;

  update public.project_extra_works
  set status = v_decision,
      client_name = nullif(trim(coalesce(p_name,'')), ''),
      client_email = nullif(trim(coalesce(p_email,'')), ''),
      client_message = nullif(trim(coalesce(p_message,'')), ''),
      client_decision_at = now(),
      updated_at = now()
  where id = p_extra_work_id and project_id = v.project_id;

  if not found then
    raise exception 'A pluszmunka tétel nem található ennél a projektnél.';
  end if;

  insert into public.client_project_messages(user_id, project_id, link_id, author_name, author_email, message_type, message)
  values(v.user_id, v.project_id, v.link_id, nullif(trim(coalesce(p_name,'')), ''), nullif(trim(coalesce(p_email,'')), ''), 'approval',
    case v_decision
      when 'accepted' then 'Pluszmunka elfogadva.'
      when 'rejected' then 'Pluszmunka elutasítva.'
      else 'Kérdés érkezett pluszmunkához.'
    end || case when length(trim(coalesce(p_message,''))) > 0 then E'\n\n' || left(trim(p_message), 4000) else '' end
  );

  return jsonb_build_object('ok', true, 'status', v_decision);
end;
$$;

grant execute on function public.client_decide_extra_work_v173(text, text, uuid, text, text, text, text) to anon, authenticated;

-- Teljes projekt törlés: DB oldali gyors takarítás. A storage fájlokat a webes kliens is próbálja takarítani.
create or replace function public.delete_project_full_v173(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_table text;
  v_project_name text;
begin
  if v_uid is null then
    raise exception 'Nincs bejelentkezve.';
  end if;

  select name into v_project_name from public.projects where id = p_project_id and user_id = v_uid;
  if not found then
    raise exception 'Nincs jogosultság ehhez a projekthez vagy a projekt már nem létezik.';
  end if;

  -- Régi riport események, amelyek néha token/report_id alapján maradhatnak. Ezt még a public_reports törlése előtt kell megtenni.
  if to_regclass('public.report_events') is not null and to_regclass('public.public_reports') is not null then
    begin
      delete from public.report_events e
      using public.public_reports r
      where r.project_id = p_project_id and (e.report_id::text = r.id::text or e.token = r.token);
    exception when others then
      null;
    end;
  end if;

  -- Projektazonosítóval kapcsolt táblák törlése. Ha egy tábla/oszlop nincs meg, átugorja.
  foreach v_table in array array[
    'client_project_messages','project_extra_works','client_project_links',
    'report_events','report_documents','report_approvals','public_reports','notifications','media_files',
    'project_members','project_materials','project_invoices','ai_photo_analyses','tasks','diary_entries','entries'
  ] loop
    if to_regclass('public.' || v_table) is not null and exists (
      select 1 from information_schema.columns where table_schema = 'public' and table_name = v_table and column_name = 'project_id'
    ) then
      execute format('delete from public.%I where project_id = $1', v_table) using p_project_id;
    end if;
  end loop;

  -- Projekt törlése legvégén.
  delete from public.projects where id = p_project_id and user_id = v_uid;
  return true;
end;
$$;

grant execute on function public.delete_project_full_v173(uuid) to authenticated;

-- Régi/árva sorok kézi takarítása a saját fiókban, ha korábbi verzióból maradt valami.
create or replace function public.cleanup_my_orphan_project_data_v173()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_table text;
  v_count integer := 0;
  v_total integer := 0;
begin
  if v_uid is null then
    raise exception 'Nincs bejelentkezve.';
  end if;

  foreach v_table in array array[
    'client_project_messages','project_extra_works','client_project_links',
    'report_documents','report_approvals','public_reports','notifications','media_files',
    'project_members','project_materials','project_invoices','ai_photo_analyses','tasks','diary_entries','entries'
  ] loop
    if to_regclass('public.' || v_table) is not null and exists (
      select 1 from information_schema.columns where table_schema = 'public' and table_name = v_table and column_name = 'project_id'
    ) and exists (
      select 1 from information_schema.columns where table_schema = 'public' and table_name = v_table and column_name = 'user_id'
    ) then
      execute format('delete from public.%I x where x.user_id = $1 and x.project_id is not null and not exists (select 1 from public.projects p where p.id = x.project_id) ', v_table) using v_uid;
      get diagnostics v_count = row_count;
      v_total := v_total + coalesce(v_count,0);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'deleted_rows', v_total);
end;
$$;

grant execute on function public.cleanup_my_orphan_project_data_v173() to authenticated;
