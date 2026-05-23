-- 0029_customer_records.sql
-- Bridge table for the Full Service "Start Now" signup flow.
--
-- A Start Now customer pays via Stripe Checkout BEFORE any location is
-- connected and BEFORE any user account exists in our system. The webhook
-- creates a customer_records row holding their Stripe customer + subscription
-- ID + the business info they entered in Checkout (custom_fields).
--
-- Staff later connects the customer's Google Business Profile from the
-- /app/onboarding queue. At that point a location row is created (under the
-- staff member's own account) and linked back to the customer_record via
-- locations.customer_record_id (added at the bottom of this migration).
--
-- Subscription wiring: customer_records.stripe_subscription_id becomes the
-- subscription_id on the new location_subscriptions row, so the location's
-- "is paid?" check reads the same way regardless of which flow created it.
--
-- Self-serve and consultation-driven Full Service signups DO NOT use this
-- table — they continue to create user accounts + locations the existing
-- way, with customer_record_id = NULL on the locations row.

CREATE TABLE IF NOT EXISTS public.customer_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity from Stripe Checkout
  email text NOT NULL,
  business_name text,
  business_address text,

  -- Stripe linkage — both are guaranteed non-null because we only insert
  -- this row after a successful Checkout session.
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,

  -- Onboarding state machine — see the comment block at top.
  onboarding_status text NOT NULL DEFAULT 'pending_gbp_connect'
    CHECK (onboarding_status IN (
      'pending_gbp_connect', -- paid, waiting for customer to add manager email
      'gbp_connected',       -- staff has connected GBP, service running
      'active',              -- past trial, billing active, service running
      'cancelled'            -- subscription cancelled before location went live
    )),

  -- Filled when staff connects the GBP. Nullable until then.
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,

  -- Channel that produced the record. Today only 'start_now'; could later
  -- add 'callback_form' or other paid-up-front variants.
  source text NOT NULL DEFAULT 'start_now',

  -- Highest day-bucket the stalled-onboarding cron has fired for this row.
  -- 0/null = nothing sent yet. 5 = customer nudge sent. 7 = team alert sent.
  -- Lets the cron be idempotent across daily reruns.
  last_alert_sent_day smallint,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_records_status_created
  ON public.customer_records (onboarding_status, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_records_stripe_subscription
  ON public.customer_records (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_customer_records_email
  ON public.customer_records (email);

-- RLS: any authenticated staff can read/write. There's no tenant separation
-- on this table because it's an internal-ops queue — only BAAM staff should
-- ever query it, and we won't expose it through the customer-facing app.
-- Public submission via Stripe webhook uses the service-role client, which
-- bypasses RLS.
ALTER TABLE public.customer_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_records_select_authenticated"
  ON public.customer_records;
CREATE POLICY "customer_records_select_authenticated"
  ON public.customer_records
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "customer_records_update_authenticated"
  ON public.customer_records;
CREATE POLICY "customer_records_update_authenticated"
  ON public.customer_records
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- New FK on locations: pointer back to the customer_record that paid for
-- this location, if any. NULL for self-serve and consultation-driven Full
-- Service locations.
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS customer_record_id uuid
    REFERENCES public.customer_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_locations_customer_record
  ON public.locations (customer_record_id);
