-- ÉpítésNapló AI PRO – V153 CLEAN stabilizálás + admin takarítás SQLFIX
-- Javítva: nem hibázik, ha egy régi tábla létezik, de nincs benne project_id / user_id / created_at oszlop.
-- Futtasd Supabase SQL Editorban egyben.

create or replace function public.v153_has_column(p_table text, p_column text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table
      and column_name = p_column
  );
$$;

grant execute on function public.v153_has_column(text, text) to authenticated, anon;

create or replace function public.is_current_user_admin_v153()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ok boolean := false;
  sql_text text;
begin
  if uid is null then
    return false;
  end if;

  if to_regclass('public.profiles') is null then
    return false;
  end if;

  if public.v153_has_column('profiles','id') then
    if public.v153_has_column('profiles','is_admin') then
      execute 'select exists (select 1 from public.profiles where id = $1 and coalesce(is_admin,false) = true)'
      into ok using uid;
      if ok then return true; end if;
    end if;

    if public.v153_has_column('profiles','role') then
      execute 'select exists (select 1 from public.profiles where id = $1 and role = ''admin'')'
      into ok using uid;
      if ok then return true; end if;
    end if;

    if public.v153_has_column('profiles','email') then
      execute 'select exists (select 1 from public.profiles where id = $1 and lower(coalesce(email, '''')) in (''cegweb26@gmail.com'', ''atika.76@windowslive.com''))'
      into ok using uid;
      if ok then return true; end if;
    end if;
  end if;

  return false;
end;
$$;

grant execute on function public.is_current_user_admin_v153() to authenticated, anon;

create or replace function public.admin_cleanup_project_remainders_v153()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  before_counts jsonb := '{}'::jsonb;
  after_counts jsonb := '{}'::jsonb;
  deleted_counts jsonb := '{}'::jsonb;
  t text;
  c_before bigint;
  c_after bigint;
  tables text[] := array[
    'report_events',
    'report_approvals',
    'report_documents',
    'public_reports',
    'media_files',
    'ai_photo_analyses',
    'project_materials',
    'project_invoices',
    'tasks',
    'entries'
  ];
begin
  if not public.is_current_user_admin_v153() then
    raise exception 'Nincs admin jogosultság.' using errcode='42501';
  end if;

  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into c_before;
      before_counts := before_counts || jsonb_build_object(t, c_before);
    end if;
  end loop;

  -- 30 napnál régebbi riport események törlése, ha van created_at oszlop.
  if to_regclass('public.report_events') is not null and public.v153_has_column('report_events','created_at') then
    begin
      delete from public.report_events where created_at < now() - interval '30 days';
    exception when others then null;
    end;
  end if;

  -- Olyan rekordok törlése, amelyek projektje már nincs meg.
  -- Csak azoknál a tábláknál fut, ahol tényleg van project_id oszlop.
  foreach t in array tables loop
    if t <> 'report_events'
       and to_regclass('public.' || t) is not null
       and public.v153_has_column(t, 'project_id')
       and to_regclass('public.projects') is not null
       and public.v153_has_column('projects', 'id') then
      begin
        execute format(
          'delete from public.%I x where x.project_id is not null and not exists (select 1 from public.projects p where p.id = x.project_id)',
          t
        );
      exception when others then null;
      end;
    end if;
  end loop;

  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into c_after;
      after_counts := after_counts || jsonb_build_object(t, c_after);
      c_before := coalesce((before_counts ->> t)::bigint, c_after);
      deleted_counts := deleted_counts || jsonb_build_object(t, greatest(0, c_before - c_after));
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'before', before_counts,
    'after', after_counts,
    'deleted', deleted_counts,
    'cleaned_at', now()
  );
end;
$$;

grant execute on function public.admin_cleanup_project_remainders_v153() to authenticated;

-- Gyorsító indexek: csak akkor hozza létre, ha a tábla és az adott oszlopok is léteznek.
do $$
begin
  if to_regclass('public.entries') is not null
     and public.v153_has_column('entries','project_id')
     and public.v153_has_column('entries','user_id')
     and public.v153_has_column('entries','created_at') then
    create index if not exists entries_project_user_created_v153_idx
    on public.entries(project_id, user_id, created_at desc);
  end if;

  if to_regclass('public.public_reports') is not null then
    if public.v153_has_column('public_reports','project_id')
       and public.v153_has_column('public_reports','user_id')
       and public.v153_has_column('public_reports','created_at') then
      create index if not exists public_reports_project_user_v153_idx
      on public.public_reports(project_id, user_id, created_at desc);
    end if;

    if public.v153_has_column('public_reports','token') then
      create index if not exists public_reports_token_v153_idx
      on public.public_reports(token);
    end if;
  end if;

  if to_regclass('public.report_events') is not null then
    if public.v153_has_column('report_events','project_id')
       and public.v153_has_column('report_events','created_at') then
      create index if not exists report_events_project_created_v153_idx
      on public.report_events(project_id, created_at desc);
    end if;

    if public.v153_has_column('report_events','created_at') then
      create index if not exists report_events_created_v153_idx
      on public.report_events(created_at);
    end if;
  end if;

  if to_regclass('public.report_documents') is not null
     and public.v153_has_column('report_documents','project_id')
     and public.v153_has_column('report_documents','created_at') then
    create index if not exists report_documents_project_created_v153_idx
    on public.report_documents(project_id, created_at desc);
  end if;

  if to_regclass('public.report_approvals') is not null
     and public.v153_has_column('report_approvals','project_id')
     and public.v153_has_column('report_approvals','created_at') then
    create index if not exists report_approvals_project_created_v153_idx
    on public.report_approvals(project_id, created_at desc);
  end if;
end $$;

select 'V153 SQLFIX kész, az adatbázis stabilizáló SQL lefutott.' as status;
