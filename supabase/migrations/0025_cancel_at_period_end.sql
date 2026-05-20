-- 0025_cancel_at_period_end.sql
-- Track Stripe's cancel_at_period_end so the admin can distinguish a
-- normal renewal from a scheduled cancellation. When true, the
-- subscription stays trialing/active until current_period_end and then
-- Stripe fires customer.subscription.deleted (status → canceled). The
-- admin shows "Canceling — ends <date>" instead of "next <date>", and
-- staff can un-cancel from the Customer Portal ("Don't cancel").
--
-- Stripe is the source of truth (subscription.cancel_at_period_end);
-- this column is mirrored for the billing UI without a Stripe round-trip.

ALTER TABLE public.location_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.location_subscriptions.cancel_at_period_end IS
  'Mirrors Stripe subscription.cancel_at_period_end. true = scheduled to cancel at current_period_end (still active until then).';
COMMENT ON COLUMN public.accounts.cancel_at_period_end IS
  'Mirrors Stripe subscription.cancel_at_period_end for the Self-service account base.';
