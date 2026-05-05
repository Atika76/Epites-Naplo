-- ÉpítésNapló AI PRO v8 – Fiók törlése + GDPR alapok

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  reason text,
  status text default 'started',
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.account_deletions enable row level security;

drop policy if exists "Users can read own deletion log" on public.account_deletions;
create policy "Users can read own deletion log"
on public.account_deletions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admin can read deletion logs" on public.account_deletions;
create policy "Admin can read deletion logs"
on public.account_deletions
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'cegweb26@gmail.com');

create index if not exists account_deletions_user_idx on public.account_deletions(user_id);
create index if not exists account_deletions_created_idx on public.account_deletions(created_at desc);

-- Opcionális nézet adminnak
create or replace view public.admin_account_deletions_overview as
select id, user_id, email, reason, status, created_at, completed_at
from public.account_deletions
order by created_at desc;

grant select on public.admin_account_deletions_overview to authenticated;
