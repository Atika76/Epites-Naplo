-- ÉpítésNapló AI PRO v24 – Full PRO bekötés
-- Biztonságos bővítés: a meglévő V19/V23 táblákat nem törli, csak új oszlopokat ad hozzá.

alter table public.entries add column if not exists before_images_json jsonb default '[]'::jsonb;
alter table public.entries add column if not exists after_images_json jsonb default '[]'::jsonb;
alter table public.entries add column if not exists general_images_json jsonb default '[]'::jsonb;
alter table public.entries add column if not exists weather_json jsonb;
alter table public.entries add column if not exists gps_json jsonb;
alter table public.entries add column if not exists materials_json jsonb default '[]'::jsonb;

alter table public.projects add column if not exists status text default 'folyamatban';
alter table public.projects add column if not exists progress integer default 0;
alter table public.projects add column if not exists updated_at timestamp with time zone default now();

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

alter table public.project_materials enable row level security;
alter table public.project_invoices enable row level security;

drop policy if exists "materials owner select" on public.project_materials;
create policy "materials owner select" on public.project_materials for select to authenticated using (auth.uid() = user_id);
drop policy if exists "materials owner insert" on public.project_materials;
create policy "materials owner insert" on public.project_materials for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "invoices owner select" on public.project_invoices;
create policy "invoices owner select" on public.project_invoices for select to authenticated using (auth.uid() = user_id);
drop policy if exists "invoices owner insert" on public.project_invoices;
create policy "invoices owner insert" on public.project_invoices for insert to authenticated with check (auth.uid() = user_id);

create index if not exists project_materials_project_idx on public.project_materials(project_id, created_at desc);
create index if not exists project_invoices_project_idx on public.project_invoices(project_id, created_at desc);
