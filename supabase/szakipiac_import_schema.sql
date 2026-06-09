-- SzakiPiac -> Építési Napló import
-- Futtasd az Építési Napló Supabase SQL Editorában.
-- Biztonságos kiegészítés: meglévő táblát nem töröl, csak hozzáadja ami kell az importhoz.

create table if not exists public.project_import_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  token text not null unique,
  source_app text not null default 'szakipiac',
  source_quote_id text,
  project_name text,
  client_name text,
  client_email text,
  client_phone text,
  client_city text,
  client_address text,
  quote_total_gross numeric,
  payload jsonb not null default '{}'::jsonb,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_project_id uuid references public.projects(id) on delete set null,
  claimed_at timestamptz
);

create table if not exists public.project_imports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid references public.projects(id) on delete cascade,
  source_app text not null default 'szakipiac',
  source_quote_id text,
  client_name text,
  client_email text,
  client_phone text,
  client_city text,
  client_address text,
  quote_total_gross numeric,
  payload jsonb not null default '{}'::jsonb
);

alter table public.project_import_requests enable row level security;
alter table public.project_imports enable row level security;

drop policy if exists "project_import_requests_service_only" on public.project_import_requests;
create policy "project_import_requests_service_only"
on public.project_import_requests
for all
using (false)
with check (false);

drop policy if exists "project_imports_select_own" on public.project_imports;
create policy "project_imports_select_own"
on public.project_imports
for select
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_imports.project_id
      and p.user_id = auth.uid()
  )
);

-- A régebbi Építési Napló sémákban ezek az oszlopok nem mindig vannak benne.
alter table public.entries add column if not exists ai_json jsonb;
alter table public.entries add column if not exists materials_json jsonb;
alter table public.entries add column if not exists location_address text;

-- Opcionális pénzügyi/anyag táblák. Ha már léteznek, oszloponként is kiegészítjük.
create table if not exists public.project_materials (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  entry_id uuid references public.entries(id) on delete set null,
  name text not null,
  quantity numeric default 0,
  unit text,
  note text
);

alter table public.project_materials add column if not exists user_id uuid;
alter table public.project_materials add column if not exists project_id uuid;
alter table public.project_materials add column if not exists entry_id uuid;
alter table public.project_materials add column if not exists name text;
alter table public.project_materials add column if not exists quantity numeric default 0;
alter table public.project_materials add column if not exists unit text;
alter table public.project_materials add column if not exists note text;

create table if not exists public.project_invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  entry_id uuid references public.entries(id) on delete set null,
  title text not null,
  amount numeric default 0,
  note text,
  file_name text,
  file_type text,
  file_data text
);

alter table public.project_invoices add column if not exists user_id uuid;
alter table public.project_invoices add column if not exists project_id uuid;
alter table public.project_invoices add column if not exists entry_id uuid;
alter table public.project_invoices add column if not exists title text;
alter table public.project_invoices add column if not exists amount numeric default 0;
alter table public.project_invoices add column if not exists note text;
alter table public.project_invoices add column if not exists file_name text;
alter table public.project_invoices add column if not exists file_type text;
alter table public.project_invoices add column if not exists file_data text;

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  description text,
  work_type text
);

alter table public.diary_entries add column if not exists user_id uuid;
alter table public.diary_entries add column if not exists project_id uuid;
alter table public.diary_entries add column if not exists description text;
alter table public.diary_entries add column if not exists work_type text;

alter table public.project_materials enable row level security;
alter table public.project_invoices enable row level security;
alter table public.diary_entries enable row level security;

drop policy if exists "project_materials_all_own" on public.project_materials;
create policy "project_materials_all_own"
on public.project_materials
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "project_invoices_all_own" on public.project_invoices;
create policy "project_invoices_all_own"
on public.project_invoices
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "diary_entries_all_own" on public.diary_entries;
create policy "diary_entries_all_own"
on public.diary_entries
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists project_import_requests_token_idx on public.project_import_requests(token);
create index if not exists project_imports_project_id_idx on public.project_imports(project_id);
create index if not exists project_materials_project_id_idx on public.project_materials(project_id);
create index if not exists project_invoices_project_id_idx on public.project_invoices(project_id);
create index if not exists diary_entries_project_id_idx on public.diary_entries(project_id);
