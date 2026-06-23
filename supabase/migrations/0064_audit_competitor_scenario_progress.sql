-- Session 12 · Fast competitor preview progress fields.
-- Enables explicit hydration status/progress so the UI can show loading
-- and block final generation until paid competitor histories are ready.

alter table public.audit_competitor_scenarios
  add column if not exists status text not null default 'ready'
    check (status in ('ready', 'hydrating', 'failed')),
  add column if not exists total_competitors integer not null default 0,
  add column if not exists hydrated_competitors integer not null default 0,
  add column if not exists failed_competitors integer not null default 0,
  add column if not exists hydrated_place_ids text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

update public.audit_competitor_scenarios
set total_competitors = coalesce(total_competitors, 0)
where total_competitors is null;

update public.audit_competitor_scenarios
set hydrated_competitors = coalesce(hydrated_competitors, 0)
where hydrated_competitors is null;

update public.audit_competitor_scenarios
set failed_competitors = coalesce(failed_competitors, 0)
where failed_competitors is null;

create index if not exists idx_audit_competitor_scenarios_status
  on public.audit_competitor_scenarios (status, updated_at desc);
