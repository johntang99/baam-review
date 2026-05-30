-- Audit engine · Session 5 · score-run log for empirical calibration.
-- Every computeAuditScore call writes one row. After 50+ audits, real
-- distributions emerge in this table and inform v1.1 benchmark
-- thresholds via UPDATE on vertical_benchmarks.
--
-- No PII stored. business_place_id is the public Google identifier.
-- Service-role only — no RLS needed.

create table public.audit_score_runs (
  id uuid primary key default gen_random_uuid(),
  computed_at timestamptz not null default now(),

  business_place_id text not null,
  vertical text not null,
  region text not null,
  tier text not null,
  benchmark_version text not null,

  composite_rating numeric,
  total_count integer,
  velocity_30d numeric,
  velocity_180d numeric,
  velocity_365d numeric,

  total_score integer not null,
  grade char(1) not null,
  critical_floor_applied boolean not null,

  rating_quality_score integer,
  review_volume_score integer,
  velocity_30d_score integer,
  velocity_180d_score integer,
  velocity_365d_score integer
);

create index idx_asr_vertical on public.audit_score_runs (vertical, region);
create index idx_asr_computed on public.audit_score_runs (computed_at);
create index idx_asr_place on public.audit_score_runs (business_place_id);

comment on table public.audit_score_runs is
  'Session 5 score log. One row per computeAuditScore call. Fuels empirical recalibration of vertical_benchmarks. business_place_id is public Google data, no PII.';
