-- Audit engine · Session 2 cache for non-Google platforms (Yelp,
-- Zocdoc, Healthgrades, Facebook). Keyed by (Google place_id, platform,
-- tier) — Google's place_id is the canonical anchor since secondary
-- platform IDs are not stable across lookups.
--
-- TTL strategy mirrors Session 1: free tier = 7 days, paid = 24 hours.
-- Service-role only — no RLS needed.

create table public.audit_platform_data (
  id uuid primary key default gen_random_uuid(),
  business_place_id text not null,
  platform text not null check (platform in ('yelp', 'zocdoc', 'healthgrades', 'facebook')),
  tier text not null check (tier in ('free', 'paid')),
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint unique_business_platform_tier unique (business_place_id, platform, tier)
);

create index idx_apd_place_platform on public.audit_platform_data (business_place_id, platform);
create index idx_apd_expires on public.audit_platform_data (expires_at);

comment on table public.audit_platform_data is
  'Session 2 cache for getAllPlatformsData. Stores per-platform AuditPlatformData JSON, keyed by Google place_id + platform + tier. Replaced on conflict. Null platforms (not-found lookups) also cached to avoid repeat lookup costs.';
