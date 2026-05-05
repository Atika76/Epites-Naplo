
-- ÉpítésNapló AI PRO – V153 CLEAN stabilizálás + admin takarítás
-- Futtasd Supabase SQL Editorban. Biztonságos: ha tábla nincs, átugorja.

create or replace function public.is_current_user_admin_v153()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (coalesce(p.is_admin,false) = true or p.role = 'admin' or lower(coalesce(p.email,'')) in ('cegweb26@gmail.com','atika.76@windowslive.com'))
  );
$$;

grant execute on function public.is_current_user_admin_v153() to authenticated;

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
  tables text[] := array['report_events','report_approvals','report_documents','public_reports','media_files','ai_photo_analyses','project_materials','project_invoices','tasks','entries'];
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

  -- Régi, árva riport események: 30 napnál régebbi események törlése.
  if to_regclass('public.report_events') is not null then
    begin
      delete from public.report_events where created_at < now() - interval '30 days';
    exception when others then null;
    end;
  end if;

  -- Olyan rekordok törlése, amelyek projektje már nincs meg.
  if to_regclass('public.report_approvals') is not null then
    begin
      delete from public.report_approvals ra
      where ra.project_id is not null
        and not exists (select 1 from public.projects p where p.id = ra.project_id);
    exception when others then null;
    end;
  end if;

  if to_regclass('public.report_documents') is not null then
    begin
      delete from public.report_documents rd
      where rd.project_id is not null
        and not exists (select 1 from public.projects p where p.id = rd.project_id);
    exception when others then null;
    end;
  end if;

  if to_regclass('public.public_reports') is not null then
    begin
      delete from public.public_reports pr
      where pr.project_id is not null
        and not exists (select 1 from public.projects p where p.id = pr.project_id);
    exception when others then null;
    end;
  end if;

  if to_regclass('public.media_files') is not null then
    begin
      delete from public.media_files mf
      where mf.project_id is not null
        and not exists (select 1 from public.projects p where p.id = mf.project_id);
    exception when others then null;
    end;
  end if;

  if to_regclass('public.ai_photo_analyses') is not null then
    begin
      delete from public.ai_photo_analyses a
      where a.project_id is not null
        and not exists (select 1 from public.projects p where p.id = a.project_id);
    exception when others then null;
    end;
  end if;

  if to_regclass('public.project_materials') is not null then
    begin
      delete from public.project_materials m
      where m.project_id is not null
        and not exists (select 1 from public.projects p where p.id = m.project_id);
    exception when others then null;
    end;
  end if;

  if to_regclass('public.project_invoices') is not null then
    begin
      delete from public.project_invoices i
      where i.project_id is not null
        and not exists (select 1 from public.projects p where p.id = i.project_id);
    exception when others then null;
    end;
  end if;

  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into c_after;
      after_counts := after_counts || jsonb_build_object(t, c_after);
      c_before := coalesce((before_counts ->> t)::bigint, c_after);
      deleted_counts := deleted_counts || jsonb_build_object(t, greatest(0, c_before - c_after));
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'before', before_counts, 'after', after_counts, 'deleted', deleted_counts, 'cleaned_at', now());
end;
$$;

grant execute on function public.admin_cleanup_project_remainders_v153() to authenticated;

-- Gyorsító indexek, ha a táblák léteznek.
do $$
begin
  if to_regclass('public.entries') is not null then
    create index if not exists entries_project_user_created_v153_idx on public.entries(project_id, user_id, created_at desc);
  end if;
  if to_regclass('public.public_reports') is not null then
    create index if not exists public_reports_project_user_v153_idx on public.public_reports(project_id, user_id, created_at desc);
    create index if not exists public_reports_token_v153_idx on public.public_reports(token);
  end if;
  if to_regclass('public.report_events') is not null then
    create index if not exists report_events_project_created_v153_idx on public.report_events(project_id, created_at desc);
    create index if not exists report_events_created_v153_idx on public.report_events(created_at);
  end if;
  if to_regclass('public.report_documents') is not null then
    create index if not exists report_documents_project_created_v153_idx on public.report_documents(project_id, created_at desc);
  end if;
  if to_regclass('public.report_approvals') is not null then
    create index if not exists report_approvals_project_created_v153_idx on public.report_approvals(project_id, created_at desc);
  end if;
end $$;
