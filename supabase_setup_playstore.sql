-- Backend da versão Google Play.
-- Os dados principais do aplicativo continuam locais; a nuvem é exclusiva do plano Pro + Nuvem.

create table if not exists public.playstore_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.playstore_entitlements (
  id uuid primary key default gen_random_uuid(),
  purchase_token_hash text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  package_name text not null,
  product_id text not null,
  base_plan_id text,
  tier text not null check (tier in ('professional','pro_cloud')),
  subscription_state text not null,
  expires_at timestamptz,
  auto_renew boolean not null default false,
  order_id text,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.playstore_snapshots enable row level security;
alter table public.playstore_entitlements enable row level security;

grant select, insert, update, delete on table public.playstore_snapshots to authenticated;
revoke all on table public.playstore_entitlements from anon, authenticated;
grant select on table public.playstore_entitlements to authenticated;

drop policy if exists "playstore entitlement select own" on public.playstore_entitlements;
create policy "playstore entitlement select own"
on public.playstore_entitlements for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "playstore snapshot select owner" on public.playstore_snapshots;
drop policy if exists "playstore snapshot insert owner" on public.playstore_snapshots;
drop policy if exists "playstore snapshot update owner" on public.playstore_snapshots;
drop policy if exists "playstore snapshot delete owner" on public.playstore_snapshots;
drop policy if exists "playstore snapshot select paid owner" on public.playstore_snapshots;
drop policy if exists "playstore snapshot insert paid owner" on public.playstore_snapshots;
drop policy if exists "playstore snapshot update paid owner" on public.playstore_snapshots;
drop policy if exists "playstore snapshot delete paid owner" on public.playstore_snapshots;

create policy "playstore snapshot select paid owner"
on public.playstore_snapshots for select
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
);

create policy "playstore snapshot insert paid owner"
on public.playstore_snapshots for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
);

create policy "playstore snapshot update paid owner"
on public.playstore_snapshots for update
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
);

create policy "playstore snapshot delete paid owner"
on public.playstore_snapshots for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
);

create index if not exists idx_playstore_entitlements_user_active
on public.playstore_entitlements(user_id, tier, expires_at);


-- Usuário local do plano Básico fica somente no aparelho.
-- Usuários adicionais e histórico são exclusivos do Pro + Nuvem.

create table if not exists public.playstore_internal_users (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  usuario text not null,
  password_salt text not null,
  password_hash text not null,
  role text not null default 'operador'
    check (role in ('admin','operador','visualizador','colaborador')),
  permissions jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  is_master boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_playstore_internal_users_owner_login
on public.playstore_internal_users(owner_user_id, lower(usuario));

create index if not exists idx_playstore_internal_users_owner
on public.playstore_internal_users(owner_user_id);

create table if not exists public.playstore_user_audit_log (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  app_user_id uuid references public.playstore_internal_users(id) on delete set null,
  app_user_name text not null,
  acao text not null,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_playstore_user_audit_owner_created
on public.playstore_user_audit_log(owner_user_id, created_at desc);

alter table public.playstore_internal_users enable row level security;
alter table public.playstore_user_audit_log enable row level security;

grant select, insert, update, delete on public.playstore_internal_users to authenticated;
grant select, insert on public.playstore_user_audit_log to authenticated;

drop policy if exists "playstore users select paid owner" on public.playstore_internal_users;
drop policy if exists "playstore users insert paid owner" on public.playstore_internal_users;
drop policy if exists "playstore users update paid owner" on public.playstore_internal_users;
drop policy if exists "playstore users delete paid owner" on public.playstore_internal_users;
drop policy if exists "playstore audit select paid owner" on public.playstore_user_audit_log;
drop policy if exists "playstore audit insert paid owner" on public.playstore_user_audit_log;

create policy "playstore users select paid owner"
on public.playstore_internal_users for select
to authenticated
using (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
);

create policy "playstore users insert paid owner"
on public.playstore_internal_users for insert
to authenticated
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
);

create policy "playstore users update paid owner"
on public.playstore_internal_users for update
to authenticated
using (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
)
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
);

create policy "playstore users delete paid owner"
on public.playstore_internal_users for delete
to authenticated
using (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
);

create policy "playstore audit select paid owner"
on public.playstore_user_audit_log for select
to authenticated
using (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
);

create policy "playstore audit insert paid owner"
on public.playstore_user_audit_log for insert
to authenticated
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.playstore_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'pro_cloud'
      and e.subscription_state in (
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED'
      )
      and (e.expires_at is null or e.expires_at > now())
  )
);
