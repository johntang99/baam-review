-- Session 2 (Yelp-only) · cache for business → Yelp URL resolution.
-- Resolving via Google SERP costs ~$0.005 per query so we cache the
-- URL (or the "not found" verdict) for 30 days. The reviews data
-- itself caches in audit_platform_data (existing migration 0038).
--
-- Service-role only — no RLS needed.

create table public.yelp_url_cache (
  business_place_id text primary key,
  yelp_url text,
  resolution_confidence text not null check (resolution_confidence in ('high', 'medium', 'low', 'not_found')),
  resolution_method text not null default 'google_site_search',
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index idx_yuc_expires on public.yelp_url_cache (expires_at);

comment on table public.yelp_url_cache is
  'Session 2 cache · business_place_id → Yelp URL. Stores "not_found" verdicts too (NULL url + confidence=not_found). 30-day TTL.';
comment on column public.yelp_url_cache.resolution_confidence is
  'high = name matched with strong signals; medium = partial; low = single weak match; not_found = no plausible Yelp URL in SERP.';
