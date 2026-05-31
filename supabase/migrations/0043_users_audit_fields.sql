-- Session 10 (no-Stripe) · audit-specific fields on public.users.
-- Spec's "profiles" table is implemented as columns on the existing
-- users table to avoid a parallel schema. Multi-tenant audit
-- attribution and quota tracking live here.
--
-- The existing handle_new_user trigger already creates a users row on
-- signup; the new columns default appropriately so existing signup
-- code keeps working unchanged.

alter table public.users
  add column if not exists preferred_language text not null default 'en'
    check (preferred_language in ('en', 'zh-tc', 'zh-sc')),
  add column if not exists signup_source text,
  add column if not exists signup_referrer_url text,

  -- Quota tracking (replaces Stripe gating)
  add column if not exists audits_used_this_month integer not null default 0,
  add column if not exists audits_used_lifetime integer not null default 0,
  add column if not exists monthly_quota_override integer,
  add column if not exists lifetime_quota_override integer,
  add column if not exists quota_reset_at timestamptz not null
    default (date_trunc('month', now()) + interval '1 month'),

  -- Email preferences for audit notifications
  add column if not exists email_marketing_opt_in boolean not null default true,
  add column if not exists email_audit_ready boolean not null default true,
  add column if not exists email_re_audit_reminder boolean not null default true,

  -- BAAM Review service interest signals (drives sales follow-up)
  add column if not exists expressed_service_interest boolean not null default false,
  add column if not exists expressed_service_interest_at timestamptz;

comment on column public.users.preferred_language is
  'Customer-chosen language for audit emails and dashboards. Default en. zh-tc / zh-sc supported.';
comment on column public.users.audits_used_this_month is
  'Rate-limit counter, resets at quota_reset_at. monthly_quota_override > NULL means user has admin-granted extra audits this month.';
comment on column public.users.audits_used_lifetime is
  'Hard cap defense against abuse. Default lifetime cap is 5; admin can raise via lifetime_quota_override.';
comment on column public.users.expressed_service_interest is
  'Set true when user clicks "Learn more" on BAAM Review service upsell. Used for sales pipeline targeting.';

-- Monthly quota reset function. Invoke from a cron or scheduled job
-- (e.g., Supabase pg_cron, Vercel Cron) at month boundaries.
create or replace function public.reset_monthly_audit_quotas()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  update public.users
  set
    audits_used_this_month = 0,
    quota_reset_at = date_trunc('month', now()) + interval '1 month'
  where quota_reset_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

comment on function public.reset_monthly_audit_quotas is
  'Resets per-user monthly audit counter. Schedule via cron at 00:01 on the 1st of each month, or call on-demand.';

-- Atomic counter helpers. runAudit increments before generation kicks
-- off; if generation fails, decrement to refund the attempt.

create or replace function public.increment_audit_count(user_id_in uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.users
  set
    audits_used_this_month = audits_used_this_month + 1,
    audits_used_lifetime = audits_used_lifetime + 1
  where id = user_id_in;
end;
$$;

create or replace function public.decrement_audit_count(user_id_in uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.users
  set
    audits_used_this_month = greatest(0, audits_used_this_month - 1),
    audits_used_lifetime = greatest(0, audits_used_lifetime - 1)
  where id = user_id_in;
end;
$$;
