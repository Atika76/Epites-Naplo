-- ÉpítésNapló AI PRO v25 – Következő szint PRO bekötés
-- PayPal élő csomagazonosítás, AI riport edge előkészítés, profi PDF, ügyfél link + jóváhagyás.
-- Biztonságos bővítés: meglévő adatot nem töröl.

alter table public.payments add column if not exists plan text;
alter table public.payments add column if not exists raw jsonb;

alter table public.public_reports add column if not exists status text default 'created';
alter table public.public_reports add column if not exists sent_at timestamp with time zone;
alter table public.public_reports add column if not exists opened_at timestamp with time zone;
alter table public.public_reports add column if not exists approved_at timestamp with time zone;
alter table public.public_reports add column if not exists view_count integer default 0;
alter table public.public_reports add column if not exists is_active boolean default true;
alter table public.public_reports add column if not exists expires_at timestamp with time zone default (now() + interval '30 days');

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

alter table public.report_approvals enable row level security;

drop policy if exists "public can insert report approvals" on public.report_approvals;
create policy "public can insert report approvals"
on public.report_approvals
for insert
to anon, authenticated
with check (true);

drop policy if exists "owner can read report approvals" on public.report_approvals;
create policy "owner can read report approvals"
on public.report_approvals
for select
to authenticated
using (
  exists (
    select 1 from public.public_reports pr
    where pr.id = report_approvals.report_id
    and pr.user_id = auth.uid()
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_admin,false) = true)
);

create index if not exists report_approvals_token_idx on public.report_approvals(token);
create index if not exists report_approvals_project_idx on public.report_approvals(project_id, approved_at desc);
create index if not exists payments_plan_idx on public.payments(plan);
