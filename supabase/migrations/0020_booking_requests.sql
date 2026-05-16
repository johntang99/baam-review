-- 0020_booking_requests.sql
-- Internal-test "Request a call" form behind the marketing intro-call CTAs.
-- Public visitors submit via /book; the server action inserts here using the
-- service client (bypasses RLS) and emails the team — same public-submission
-- pattern as private_feedback / landing_events.
--
-- Not account-scoped: these are inbound marketing leads, not per-location
-- data. RLS is on; only authenticated admins can read. Inserts never come
-- from an authenticated session, so no INSERT policy is needed (service role
-- bypasses RLS).

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  business text,
  preferred_time text,
  notes text,
  source text,                              -- originating CTA/page
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_created
  ON public.booking_requests (created_at DESC);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_requests_select_authenticated"
  ON public.booking_requests;
CREATE POLICY "booking_requests_select_authenticated"
  ON public.booking_requests
  FOR SELECT TO authenticated
  USING (true);
