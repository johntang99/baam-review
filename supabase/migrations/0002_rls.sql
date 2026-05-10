-- 0002_rls.sql
-- Row-level security: every admin-facing table is scoped by the caller's account.
-- Public review page reads bypass these via the service-role server client.

-- =============================================================================
-- Helper: returns the current authenticated user's account_id, NULL if none.
-- SECURITY DEFINER avoids RLS recursion on public.users.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT account_id FROM public.users WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_account_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_account_id() TO authenticated;

-- =============================================================================
-- Enable RLS on every table.
-- =============================================================================
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embed_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- accounts: members can read and update their own account.
-- =============================================================================
DROP POLICY IF EXISTS "accounts_select_own" ON public.accounts;
CREATE POLICY "accounts_select_own" ON public.accounts
  FOR SELECT TO authenticated
  USING (id = public.current_account_id());

DROP POLICY IF EXISTS "accounts_update_own" ON public.accounts;
CREATE POLICY "accounts_update_own" ON public.accounts
  FOR UPDATE TO authenticated
  USING (id = public.current_account_id())
  WITH CHECK (id = public.current_account_id());

-- =============================================================================
-- users: see teammates in own account; update only self.
-- =============================================================================
DROP POLICY IF EXISTS "users_select_own_account" ON public.users;
CREATE POLICY "users_select_own_account" ON public.users
  FOR SELECT TO authenticated
  USING (account_id = public.current_account_id());

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================================
-- locations: full CRUD scoped to own account.
-- =============================================================================
DROP POLICY IF EXISTS "locations_all_own_account" ON public.locations;
CREATE POLICY "locations_all_own_account" ON public.locations
  FOR ALL TO authenticated
  USING (account_id = public.current_account_id())
  WITH CHECK (account_id = public.current_account_id());

-- =============================================================================
-- review_requests: scoped via location.account_id.
-- =============================================================================
DROP POLICY IF EXISTS "review_requests_all_own_account" ON public.review_requests;
CREATE POLICY "review_requests_all_own_account" ON public.review_requests
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

-- =============================================================================
-- landing_events: read-only for owners (writes happen via service role).
-- =============================================================================
DROP POLICY IF EXISTS "landing_events_select_own_account" ON public.landing_events;
CREATE POLICY "landing_events_select_own_account" ON public.landing_events
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );

-- =============================================================================
-- private_feedback: read-only for owners (writes via service role from /r/[slug]).
-- =============================================================================
DROP POLICY IF EXISTS "private_feedback_select_own_account" ON public.private_feedback;
CREATE POLICY "private_feedback_select_own_account" ON public.private_feedback
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );

DROP POLICY IF EXISTS "private_feedback_update_own_account" ON public.private_feedback;
CREATE POLICY "private_feedback_update_own_account" ON public.private_feedback
  FOR UPDATE TO authenticated
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

-- =============================================================================
-- embed_loads: read-only for owners.
-- =============================================================================
DROP POLICY IF EXISTS "embed_loads_select_own_account" ON public.embed_loads;
CREATE POLICY "embed_loads_select_own_account" ON public.embed_loads
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );

-- =============================================================================
-- subscription_events: read-only for owners.
-- =============================================================================
DROP POLICY IF EXISTS "subscription_events_select_own_account" ON public.subscription_events;
CREATE POLICY "subscription_events_select_own_account" ON public.subscription_events
  FOR SELECT TO authenticated
  USING (account_id = public.current_account_id());
