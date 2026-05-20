-- 0023_location_subscriptions.sql
-- Per-location billing. In the new model, each location can carry its own
-- independent Stripe subscription with its own customer/card and interval:
--
--   Self-service account: $89/mo base on the ACCOUNT (see 0022) + each
--     ADDED location is its own $79/mo ($790/yr) subscription (own card,
--     30-day trial like the base).
--   Full-service account: NO account base — EVERY location is its own
--     $299/mo ($2990/yr) subscription (own card, no trial).
--
-- One billing row per location. Independent subscriptions => no proration
-- (each has its own cycle). Written by Checkout / the Stripe webhook via
-- the service client; authenticated admins of the owning account read +
-- delete. Account-scoped RLS via the locations join, same as 0021.

CREATE TABLE IF NOT EXISTS public.location_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One subscription record per location.
  location_id uuid NOT NULL UNIQUE
    REFERENCES public.locations(id) ON DELETE CASCADE,
  -- Managing account (the agency/staff account that onboarded it) —
  -- denormalized for the "all my locations & billing" view.
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  -- Plan context the location is billed under (sets the price tier/trial).
  plan text NOT NULL CHECK (plan IN ('self_service', 'full_service')),

  -- This location's OWN Stripe customer (its own card) + subscription.
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  billing_interval text
    CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year')),
  subscription_status text,
  current_period_end timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_subscriptions_account
  ON public.location_subscriptions(account_id, created_at DESC);

ALTER TABLE public.location_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "location_subscriptions_select_own_account"
  ON public.location_subscriptions;
CREATE POLICY "location_subscriptions_select_own_account"
  ON public.location_subscriptions
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );

DROP POLICY IF EXISTS "location_subscriptions_delete_own_account"
  ON public.location_subscriptions;
CREATE POLICY "location_subscriptions_delete_own_account"
  ON public.location_subscriptions
  FOR DELETE TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );

-- INSERT/UPDATE only via the service client (Checkout + Stripe webhook),
-- same system-write pattern as review_videos / the accounts billing fields.
