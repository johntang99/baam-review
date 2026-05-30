-- Audit engine · Session 1 cache for Google Place Details + Outscraper
-- review history. Keyed by (place_id, tier) so the free and paid versions
-- of the same business cache independently — they have different review
-- depths and different freshness budgets.
--
-- TTL strategy: free tier = 7 days, paid tier = 24 hours. Confirmed in plan.
-- Service-role only — no RLS needed.

create table public.audit_business_data (
  id uuid primary key default gen_random_uuid(),
  place_id text not null,
  tier text not null check (tier in ('free', 'paid')),
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  data_source text not null,
  constraint unique_place_tier unique (place_id, tier)
);

create index idx_audit_business_data_place_id on public.audit_business_data (place_id);
create index idx_audit_business_data_expires on public.audit_business_data (expires_at);

comment on table public.audit_business_data is
  'Session 1 cache for getGoogleBusinessData. Stores the normalized AuditGoogleData JSON per (place_id, tier). Free tier TTL = 7d, paid = 24h. Replaced on conflict.';
comment on column public.audit_business_data.data_source is
  'Either ''place_details'' (Google only) or ''place_details_plus_outscraper'' (paid with full review history). Lets us detect degraded paid-tier fetches.';
