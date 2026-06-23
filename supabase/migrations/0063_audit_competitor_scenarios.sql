-- Session 11 · Competitor scenario snapshots.
-- Stores paid competitor sets generated during intake Step 3 so final
-- generation can reuse them directly (no second Outscraper pass).

create table if not exists public.audit_competitor_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  primary_place_id text not null,
  service_override text not null,
  service_override_canonical text,
  selected_place_ids text[] not null default '{}',
  competitors_data jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_audit_competitor_scenarios_user
  on public.audit_competitor_scenarios (user_id, created_at desc);

create index if not exists idx_audit_competitor_scenarios_primary
  on public.audit_competitor_scenarios (primary_place_id, created_at desc);

create index if not exists idx_audit_competitor_scenarios_expires
  on public.audit_competitor_scenarios (expires_at);

comment on table public.audit_competitor_scenarios is
  'Paid competitor snapshots generated from intake Step 3 and reused by final audit generation to avoid duplicate competitor re-fetch.';
