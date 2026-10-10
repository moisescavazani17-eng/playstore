-- Play Store: nuvem opcional para o app local-first
-- Tabela isolada das versões pessoal/comercial.

create table if not exists public.playstore_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.playstore_snapshots enable row level security;

drop policy if exists "playstore snapshot select owner" on public.playstore_snapshots;
create policy "playstore snapshot select owner" on public.playstore_snapshots for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "playstore snapshot insert owner" on public.playstore_snapshots;
create policy "playstore snapshot insert owner" on public.playstore_snapshots for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "playstore snapshot update owner" on public.playstore_snapshots;
create policy "playstore snapshot update owner" on public.playstore_snapshots for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "playstore snapshot delete owner" on public.playstore_snapshots;
create policy "playstore snapshot delete owner" on public.playstore_snapshots for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.playstore_snapshots to authenticated;
