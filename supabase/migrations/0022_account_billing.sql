-- 0022_account_billing.sql
-- BAAM Review billing on accounts. The init schema already has
-- stripe_customer_id / subscription_status / trial_ends_at (legacy generic
-- tiers). These add the columns the new two-plan model needs:
--
--   Self-service  $89/mo  ($890/yr) + extra store    $79/mo ($790/yr)
--   Full-service  $299/mo ($2990/yr) + extra location $199/mo ($1990/yr)
--
-- Plan A: 30-day trial, card required upfront. Plan B: no trial.
-- Annual = 10x monthly, paid once. All subscription items share one
-- interval. review_plan is NULL until the account subscribes.
--
-- subscription_status CHECK is intentionally left as-is; the Stripe webhook
-- maps Stripe's wider status set onto the allowed values (e.g.
-- incomplete_expired -> canceled, unpaid -> past_due) to avoid fragile
-- constraint surgery on a live table.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS review_plan text
    CHECK (review_plan IS NULL OR review_plan IN ('self_service', 'full_service')),
  ADD COLUMN IF NOT EXISTS billing_interval text
    CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year')),
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS included_locations int NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.accounts.stripe_subscription_id IS
  'Active Stripe subscription id for the BAAM Review plan (null until subscribed).';
COMMENT ON COLUMN public.accounts.review_plan IS
  'BAAM Review plan: self_service ($89/mo base) or full_service ($299/mo base). NULL until subscribed. Distinct from the legacy subscription_tier column.';
COMMENT ON COLUMN public.accounts.billing_interval IS
  'month or year. Annual = 10x monthly paid once; all subscription items share one interval.';
COMMENT ON COLUMN public.accounts.current_period_end IS
  'Stripe current_period_end — when the next renewal/charge occurs. Drives the "next charge" display and add-location proration math.';
COMMENT ON COLUMN public.accounts.included_locations IS
  'Locations covered by the base price before the per-location add-on applies. Default 1. Add-on quantity = max(0, locations - included_locations).';
