-- 0001_init.sql
-- Core schema for BAAM Review v1.
-- Mirrors §8 of docs/BAAM_REVIEW_MASTER_PLAN.md.

-- =============================================================================
-- accounts: one row per business or organization.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  primary_email text NOT NULL,
  stripe_customer_id text UNIQUE,
  subscription_tier text NOT NULL DEFAULT 'trial'
    CHECK (subscription_tier IN ('trial', 'free', 'starter', 'growth', 'agency')),
  subscription_status text NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- users: profile rows, one-to-one with auth.users.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'admin', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- locations: one per Google Place; multiple per account allowed on Growth+.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  google_place_id text,
  google_review_url text,
  display_name text NOT NULL,
  address text,
  business_type text,
  brand_color text DEFAULT '#1F4D3F',
  logo_url text,
  default_language text NOT NULL DEFAULT 'en'
    CHECK (default_language IN ('en', 'zh', 'es')),
  supported_languages text[] NOT NULL DEFAULT ARRAY['en']::text[],
  welcome_message jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_questions jsonb,
  yelp_url text,
  custom_url text,
  custom_url_label jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- review_requests: one row per ask sent to a customer.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  recipient_phone text,
  recipient_email text,
  language text NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'zh', 'es')),
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  tracking_token text UNIQUE NOT NULL,
  message_sent text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  draft_generated_at timestamptz,
  completed_platform text
    CHECK (completed_platform IS NULL OR completed_platform IN ('google', 'yelp', 'custom', 'private_feedback')),
  completed_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- landing_events: analytics on the public review page.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.landing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.review_requests(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'page_view',
      'language_selected',
      'question_answered',
      'draft_generated',
      'draft_regenerated',
      'draft_edited',
      'platform_clicked',
      'private_feedback_submitted'
    )),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  language text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- private_feedback: compliance-safe alternative to public reviews.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.private_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.review_requests(id) ON DELETE SET NULL,
  rating int CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  message text NOT NULL,
  contact_email text,
  contact_phone text,
  language text NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'zh', 'es')),
  read_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- embed_loads: which sites have the embed script live.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.embed_loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  origin_url text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- subscription_events: audit log for billing.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  stripe_event_id text UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Indexes (per master plan §8).
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_users_account ON public.users(account_id);
CREATE INDEX IF NOT EXISTS idx_locations_account ON public.locations(account_id);
CREATE INDEX IF NOT EXISTS idx_locations_slug ON public.locations(slug);
CREATE INDEX IF NOT EXISTS idx_review_requests_location ON public.review_requests(location_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_token ON public.review_requests(tracking_token);
CREATE INDEX IF NOT EXISTS idx_landing_events_location ON public.landing_events(location_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_events_request ON public.landing_events(request_id);
CREATE INDEX IF NOT EXISTS idx_private_feedback_location ON public.private_feedback(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_embed_loads_location ON public.embed_loads(location_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_account ON public.subscription_events(account_id, occurred_at DESC);

-- =============================================================================
-- updated_at triggers.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_touch_updated_at ON public.accounts;
CREATE TRIGGER accounts_touch_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS locations_touch_updated_at ON public.locations;
CREATE TRIGGER locations_touch_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
