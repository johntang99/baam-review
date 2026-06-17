-- Queue unknown/non-taxonomy service suggestions for review.

create table if not exists public.audit_service_unknown_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_place_id text,
  business_name text,
  inferred_vertical text,
  candidate_service text not null,
  source_tag text not null,
  confidence numeric(4, 3),
  rationale text,
  evidence_excerpt text,
  reviewed boolean not null default false,
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_service_unknown_candidates_created
  on public.audit_service_unknown_candidates(created_at desc);

create index if not exists idx_audit_service_unknown_candidates_service
  on public.audit_service_unknown_candidates(candidate_service);

create unique index if not exists idx_audit_service_unknown_candidates_unique
  on public.audit_service_unknown_candidates(
    user_id,
    business_place_id,
    candidate_service,
    source_tag
  );

alter table public.audit_service_unknown_candidates enable row level security;

drop policy if exists "audit_service_unknown_candidates_select_own" on public.audit_service_unknown_candidates;
create policy "audit_service_unknown_candidates_select_own"
on public.audit_service_unknown_candidates
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "audit_service_unknown_candidates_insert_own" on public.audit_service_unknown_candidates;
create policy "audit_service_unknown_candidates_insert_own"
on public.audit_service_unknown_candidates
for insert
to authenticated
with check (user_id = (select auth.uid()));
