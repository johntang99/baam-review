-- Audit engine · Session 4 · per-vertical benchmark configuration.
-- Stored as configuration (not constants) so recalibration after
-- empirical data is a SQL UPDATE, not a deploy.
--
-- Lookup logic (in app code):
--   1. (vertical, region, is_active=true) — exact match
--   2. (vertical, 'national', is_active=true) — regional fallback
--   3. throw BenchmarkNotFoundError
--
-- Versioning: when v1.1 ships, the v1.0 row stays in the table with
-- is_active=false for analytical traceability. The unique index is
-- deferrable so a single transaction can flip is_active across two
-- rows atomically.
--
-- Service-role only — no RLS needed.

create table public.vertical_benchmarks (
  id uuid primary key default gen_random_uuid(),
  vertical text not null,
  region text not null default 'national',
  version text not null,
  source text not null,
  effective_from timestamptz not null default now(),
  is_active boolean not null default true,
  data jsonb not null,
  created_at timestamptz default now()
);

create unique index unique_active_benchmark
  on public.vertical_benchmarks (vertical, region)
  where is_active = true;

create index idx_vb_lookup on public.vertical_benchmarks (vertical, region, is_active);

comment on table public.vertical_benchmarks is
  'Session 4 benchmark configuration. Per-vertical rating/volume/velocity rubrics, weights, per-review dollar values, healthy-velocity bands. Seed via scripts/seed-benchmarks.ts.';
