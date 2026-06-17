-- Phase 2 shadow-mode logging:
-- Persist "current reconciler vs analyst" recommendations for later QA.

create table if not exists public.audit_service_shadow_logs (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_place_id text,
  user_final_vertical text,
  user_final_service text,
  system_recommended_service text,
  system_confidence numeric(4, 3),
  system_reason_codes text[] not null default '{}',
  analyst_mode text,
  analyst_recommended_service text,
  analyst_confidence numeric(4, 3),
  agrees_with_system boolean,
  matches_user_final_system boolean,
  matches_user_final_analyst boolean,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_service_shadow_logs_user_created
  on public.audit_service_shadow_logs(user_id, created_at desc);

create index if not exists idx_audit_service_shadow_logs_audit
  on public.audit_service_shadow_logs(audit_id);

create index if not exists idx_audit_service_shadow_logs_created
  on public.audit_service_shadow_logs(created_at desc);

alter table public.audit_service_shadow_logs enable row level security;

drop policy if exists "audit_service_shadow_logs_select_own" on public.audit_service_shadow_logs;
create policy "audit_service_shadow_logs_select_own"
on public.audit_service_shadow_logs
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "audit_service_shadow_logs_insert_own" on public.audit_service_shadow_logs;
create policy "audit_service_shadow_logs_insert_own"
on public.audit_service_shadow_logs
for insert
to authenticated
with check (user_id = (select auth.uid()));
