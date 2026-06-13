-- Per-location API keys (Phase 2 of the Integrations & Contact Intake SOP).
--
-- A key authenticates the universal intake endpoint
-- (POST /api/integrations/review-request). The key is bound to ONE location,
-- so a caller can only enqueue contacts for that location — the request body
-- never specifies the location.
--
-- Only the SHA-256 hash of the key is stored; the plaintext is shown once at
-- creation. The table is locked down (RLS on, no policies) — all access goes
-- through service-role server code that does its own authz: management via
-- server actions (getInternalContext + per-location authorization), and
-- verification at the endpoint via the hash. This mirrors how
-- location_assignments management already works.

create table if not exists public.location_api_keys (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null default 'Integration key',
  key_prefix text not null,            -- display only, e.g. "brk_AbC123…"
  key_hash text not null unique,       -- sha-256 hex of the full key
  last_used_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz               -- null = active
);

create index if not exists location_api_keys_location_idx
  on public.location_api_keys (location_id);

-- Fast active-key lookup at verification time.
create index if not exists location_api_keys_active_hash_idx
  on public.location_api_keys (key_hash)
  where revoked_at is null;

-- Locked down: no policies → no anon/auth access. Service role bypasses RLS;
-- all reads/writes happen in trusted server code with explicit authorization.
alter table public.location_api_keys enable row level security;
