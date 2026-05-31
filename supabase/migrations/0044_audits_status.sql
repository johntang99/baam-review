-- Session 10 R4 · async audit generation status fields.
-- runAudit moves from synchronous block-the-page to background job +
-- polling. The audits row is created in 'generating' state at the
-- start; stages update as the pipeline progresses; final write sets
-- status='complete' with the real data.

alter table public.audits
  add column if not exists status text not null default 'complete'
    check (status in ('generating', 'complete', 'failed')),
  add column if not exists progress_stage smallint not null default 5,
  add column if not exists progress_started_at timestamptz,
  add column if not exists failed_reason text;

create index if not exists idx_audits_status on public.audits (status)
  where status = 'generating';

comment on column public.audits.status is
  'generating | complete | failed. Existing pre-Session-10 rows default to complete.';
comment on column public.audits.progress_stage is
  'Stage 1-5 of the pipeline: 1=Google, 2=Competitors, 3=Score, 4=Projection, 5=Render+Deliver. Defaults to 5 for backfill.';
comment on column public.audits.progress_started_at is
  'When generation kicked off. Used to detect stuck audits (>5 min in generating state).';

-- Drop NOT NULL on fields the placeholder row can't populate yet.
-- These get filled when the pipeline runs and writeAuditRecord upserts.
alter table public.audits
  alter column total_score drop not null,
  alter column grade drop not null,
  alter column benchmark_version drop not null,
  alter column vertical drop not null,
  alter column region drop not null,
  alter column tier drop not null;
