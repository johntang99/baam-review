-- Audit engine · Session 8 customer-facing audit record.
-- One row per renderAndDeliverAudit() call. Stores snapshots of all
-- upstream data so a Day-90 re-audit can show before/after without
-- re-fetching, and a customer can re-download a past PDF anytime.
--
-- Service-role only — RLS will be layered in Session 10 when auth
-- ships (per-user access).

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,

  business_place_id text not null,
  vertical text not null,
  region text not null,
  tier text not null check (tier in ('free', 'paid')),

  total_score integer not null,
  grade char(1) not null,
  benchmark_version text not null,

  languages_rendered text[] not null,
  pdf_urls jsonb not null,
  email_sent boolean not null default false,
  email_message_id text,
  email_sent_at timestamptz,

  google_data jsonb not null,
  competitors_data jsonb not null,
  score_data jsonb not null,
  projection_data jsonb not null,

  generated_at timestamptz not null default now(),
  generation_time_ms integer
);

create index idx_audits_user on public.audits (user_id);
create index idx_audits_business on public.audits (business_place_id);
create index idx_audits_generated on public.audits (generated_at);

comment on table public.audits is
  'Session 8 audit deliveries. One row per rendered + delivered audit. Stores full data snapshots in JSONB for Day-90 re-audit comparison and re-download.';
