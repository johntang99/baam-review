-- Track admin-reviewed unknown services that should be added to taxonomy.

create table if not exists public.audit_service_taxonomy_promotions (
  id uuid primary key default gen_random_uuid(),
  unknown_candidate_id uuid references public.audit_service_unknown_candidates(id) on delete set null,
  promoted_by uuid not null references auth.users(id) on delete cascade,
  candidate_service text not null,
  canonical_service text not null,
  suggested_vertical text,
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_audit_service_taxonomy_promotions_created
  on public.audit_service_taxonomy_promotions(created_at desc);

create index if not exists idx_audit_service_taxonomy_promotions_status
  on public.audit_service_taxonomy_promotions(status);

create unique index if not exists idx_audit_service_taxonomy_promotions_unknown_unique
  on public.audit_service_taxonomy_promotions(unknown_candidate_id)
  where unknown_candidate_id is not null;

alter table public.audit_service_taxonomy_promotions enable row level security;

drop policy if exists "audit_service_taxonomy_promotions_select_own" on public.audit_service_taxonomy_promotions;
create policy "audit_service_taxonomy_promotions_select_own"
on public.audit_service_taxonomy_promotions
for select
to authenticated
using (promoted_by = (select auth.uid()));

drop policy if exists "audit_service_taxonomy_promotions_insert_own" on public.audit_service_taxonomy_promotions;
create policy "audit_service_taxonomy_promotions_insert_own"
on public.audit_service_taxonomy_promotions
for insert
to authenticated
with check (promoted_by = (select auth.uid()));

drop policy if exists "audit_service_taxonomy_promotions_update_own" on public.audit_service_taxonomy_promotions;
create policy "audit_service_taxonomy_promotions_update_own"
on public.audit_service_taxonomy_promotions
for update
to authenticated
using (promoted_by = (select auth.uid()))
with check (promoted_by = (select auth.uid()));
