-- Native connector connections (Phase 4b) — stores per-location credentials
-- for vendors whose webhook returns only an id, so we can call their API to
-- resolve the customer (e.g. Acuity: User ID + API Key, Basic auth).
--
-- Locked down (RLS on, no policies): service-role server code only, with its
-- own per-location authorization (mirrors location_api_keys).

create table if not exists public.location_integrations (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  provider text not null,                       -- 'acuity'
  credentials jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists location_integrations_loc_provider_idx
  on public.location_integrations (location_id, provider);

alter table public.location_integrations enable row level security;
