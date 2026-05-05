-- ÉpítésNapló AI PRO v19
-- Projekt státusz + ügyfél jóváhagyás + automatikus időjárás/GPS + anyagfelhasználás + számla csatolás

alter table public.projects add column if not exists status text default 'folyamatban';
alter table public.projects add column if not exists progress integer default 0;
alter table public.projects add column if not exists updated_at timestamp with time zone default now();

alter table public.entries add column if not exists weather_json jsonb;
alter table public.entries add column if not exists gps_json jsonb;
alter table public.entries add column if not exists materials_json jsonb default '[]'::jsonb;

alter table public.public_reports add column if not exists approved_at timestamp with time zone;

create table if not exists public.project_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null,
  entry_id uuid,
  name text not null,
  quantity numeric default 0,
  unit text default 'db',
  note text,
  created_at timestamp with time zone default now()
);

create table if not exists public.project_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null,
  title text not null,
  amount numeric default 0,
  note text,
  file_name text,
  file_type text,
  file_data text,
  created_at timestamp with time zone default now()
);

create table if not exists public.report_approvals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid,
  token text not null,
  project_id uuid,
  client_name text,
  client_email text,
  approved boolean default true,
  approved_at timestamp with time zone default now(),
  user_agent text,
  created_at timestamp with time zone default now()
);

alter table public.project_materials enable row level security;
alter table public.project_invoices enable row level security;
alter table public.report_approvals enable row level security;

drop policy if exists "materials owner select" on public.project_materials;
create policy "materials owner select" on public.project_materials for select to authenticated using (auth.uid() = user_id);
drop policy if exists "materials owner insert" on public.project_materials;
create policy "materials owner insert" on public.project_materials for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "materials owner delete" on public.project_materials;
create policy "materials owner delete" on public.project_materials for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "invoices owner select" on public.project_invoices;
create policy "invoices owner select" on public.project_invoices for select to authenticated using (auth.uid() = user_id);
drop policy if exists "invoices owner insert" on public.project_invoices;
create policy "invoices owner insert" on public.project_invoices for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "invoices owner delete" on public.project_invoices;
create policy "invoices owner delete" on public.project_invoices for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "public report approvals insert" on public.report_approvals;
create policy "public report approvals insert" on public.report_approvals for insert to anon, authenticated with check (true);
drop policy if exists "owner report approvals select" on public.report_approvals;
create policy "owner report approvals select" on public.report_approvals for select to authenticated using (
  exists (select 1 from public.public_reports pr where pr.id = report_id and pr.user_id = auth.uid())
  or (auth.jwt() ->> 'email') = 'cegweb26@gmail.com'
);

create index if not exists project_materials_project_idx on public.project_materials(project_id, created_at desc);
create index if not exists project_invoices_project_idx on public.project_invoices(project_id, created_at desc);
create index if not exists report_approvals_token_idx on public.report_approvals(token, created_at desc);

-- Ha korábbi policy-k miatt a support message törlés még mindig akad, ez a biztonságos admin RPC megmarad.
create or replace function public.admin_delete_support_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'email') <> 'cegweb26@gmail.com' then
    raise exception 'Nincs admin jogosultság';
  end if;
  delete from public.support_messages where id = p_message_id;
  return true;
end;
$$;

grant execute on function public.admin_delete_support_message(uuid) to authenticated;
