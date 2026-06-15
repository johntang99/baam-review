-- V2 learning loop for intake service reconciliation (GS vs BS vs CS).
-- Stores what the system recommended and what the user confirmed.

create table if not exists public.audit_service_resolutions (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_place_id text,
  gs_service text,
  bs_service text,
  cs_recommended_service text,
  cs_confidence numeric(4, 3),
  cs_reason_codes text[] not null default '{}',
  user_final_service text,
  user_final_vertical text,
  changed_from_recommended boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_service_resolutions_user_created
  on public.audit_service_resolutions(user_id, created_at desc);

create index if not exists idx_audit_service_resolutions_audit
  on public.audit_service_resolutions(audit_id);

alter table public.audit_service_resolutions enable row level security;

drop policy if exists "audit_service_resolutions_select_own" on public.audit_service_resolutions;
create policy "audit_service_resolutions_select_own"
on public.audit_service_resolutions
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "audit_service_resolutions_insert_own" on public.audit_service_resolutions;
create policy "audit_service_resolutions_insert_own"
on public.audit_service_resolutions
for insert
to authenticated
with check (user_id = (select auth.uid()));
