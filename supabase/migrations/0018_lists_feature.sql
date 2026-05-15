-- 0018_lists_feature.sql
-- Sessions 13 & 14: Lists feature — batch review-request workflow for the
-- managed service. See docs/updated-plan/SESSIONS_13_14_LISTS_FEATURE.md §2.1.
--
-- Schema-name reconciliation vs. the (generically-worded) plan:
--   plan `sites`/`site_id`   -> this codebase's `locations`/`location_id`
--   plan `send_requests`     -> `review_requests`
--   plan `reviews`           -> `google_reviews`
--   plan `auth.users`        -> `public.users` (matches review_requests.created_by)
-- RLS is account-scoped through the locations join, exactly like
-- review_requests/referrals in earlier migrations.

-- =============================================================================
-- opt_outs: per-location permanent suppression list. Did not exist in v1.
-- Future list imports filter against this.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  contact text NOT NULL,                 -- normalized email (lowercased) or E.164 phone
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS opt_outs_loc_contact_idx
  ON public.opt_outs (location_id, contact);

-- =============================================================================
-- lists: one row per batch.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,                        -- "Week of May 12 · Patients"
  default_language text NOT NULL DEFAULT 'en'
    CHECK (default_language IN ('en', 'zh', 'es')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'active', 'completed', 'archived')),
  customer_count integer NOT NULL DEFAULT 0, -- denormalized for fast list rendering
  sent_at timestamptz,                       -- null until first send fires
  completed_at timestamptz,                  -- null until complete / auto-completed
  max_touches integer NOT NULL DEFAULT 2,    -- soft per-customer send limit
  notes text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lists_location_id_idx ON public.lists (location_id);
CREATE INDEX IF NOT EXISTS lists_status_idx ON public.lists (status);
CREATE INDEX IF NOT EXISTS lists_sent_at_idx
  ON public.lists (sent_at DESC NULLS LAST);

-- =============================================================================
-- list_customers: one row per customer per list. `status` is the single
-- source of truth for current state; list_events is the append-only history.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.list_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,                                -- E.164 after normalization
  language text NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'zh', 'es')),
  channel text NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'sms')),
  visit_date date,
  notes text,                                -- per-customer; flows to AI reply prompt
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'sent', 'delivered', 'opened', 'clicked',
      'reviewed', 'bounced', 'optout', 'excluded'
    )),
  touches integer NOT NULL DEFAULT 0,        -- send attempts (max = lists.max_touches)
  selected boolean NOT NULL DEFAULT true,    -- false if unchecked in pre-send
  excluded_reason text
    CHECK (excluded_reason IS NULL OR excluded_reason IN (
      'duplicate_60d', 'opted_out', 'no_contact', 'manual'
    )),
  send_request_id uuid REFERENCES public.review_requests(id) ON DELETE SET NULL,
  review_id uuid REFERENCES public.google_reviews(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS list_customers_list_id_idx
  ON public.list_customers (list_id);
CREATE INDEX IF NOT EXISTS list_customers_location_id_idx
  ON public.list_customers (location_id);
CREATE INDEX IF NOT EXISTS list_customers_status_idx
  ON public.list_customers (status);
-- Supports the 60-day duplicate check (queried with a created_at date filter).
CREATE INDEX IF NOT EXISTS list_customers_dedupe_idx
  ON public.list_customers (location_id, email)
  WHERE email IS NOT NULL;

-- =============================================================================
-- list_events: append-only timeline of state transitions per customer.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.list_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_customer_id uuid NOT NULL
    REFERENCES public.list_customers(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'sent', 'delivered', 'opened', 'clicked',
    'reviewed', 'bounced', 'optout', 'resent'
  )),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS list_events_customer_id_idx
  ON public.list_events (list_customer_id);
CREATE INDEX IF NOT EXISTS list_events_list_occurred_idx
  ON public.list_events (list_id, occurred_at DESC);

-- =============================================================================
-- updated_at triggers (reuse public.touch_updated_at from 0001_init).
-- =============================================================================
DROP TRIGGER IF EXISTS lists_touch_updated_at ON public.lists;
CREATE TRIGGER lists_touch_updated_at
  BEFORE UPDATE ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS list_customers_touch_updated_at ON public.list_customers;
CREATE TRIGGER list_customers_touch_updated_at
  BEFORE UPDATE ON public.list_customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- RLS — account-scoped through the locations join, matching the v1 pattern
-- used by review_requests / referrals.
-- =============================================================================
ALTER TABLE public.opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opt_outs_all_own_account" ON public.opt_outs;
CREATE POLICY "opt_outs_all_own_account" ON public.opt_outs
  FOR ALL TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  )
  WITH CHECK (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );

DROP POLICY IF EXISTS "lists_all_own_account" ON public.lists;
CREATE POLICY "lists_all_own_account" ON public.lists
  FOR ALL TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  )
  WITH CHECK (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );

DROP POLICY IF EXISTS "list_customers_all_own_account" ON public.list_customers;
CREATE POLICY "list_customers_all_own_account" ON public.list_customers
  FOR ALL TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  )
  WITH CHECK (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );

DROP POLICY IF EXISTS "list_events_all_own_account" ON public.list_events;
CREATE POLICY "list_events_all_own_account" ON public.list_events
  FOR ALL TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  )
  WITH CHECK (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );
