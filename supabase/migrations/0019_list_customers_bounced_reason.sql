-- 0019_list_customers_bounced_reason.sql
-- Session 14 · Phase Gate 2: webhook lifecycle tracking.
--
-- Plan §4.2 sets excluded_reason='bounced' when an email bounces. The 0018
-- CHECK only allowed import-time reasons. Extend it to include the
-- delivery-time 'bounced' reason so the schema supports the documented value
-- (clean schema evolution, not a workaround).

ALTER TABLE public.list_customers
  DROP CONSTRAINT IF EXISTS list_customers_excluded_reason_check;

ALTER TABLE public.list_customers
  ADD CONSTRAINT list_customers_excluded_reason_check
  CHECK (excluded_reason IS NULL OR excluded_reason IN (
    'duplicate_60d', 'opted_out', 'no_contact', 'manual', 'bounced'
  ));
