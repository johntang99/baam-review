-- 0014_referrals.sql
-- Session B4: Referral tracking (Refer stage of the Review-to-Revenue Loop).
--
-- The share landing at /s/<advocate_request_id> already exists from A1.
-- This migration adds the table that records each interaction so admins can
-- see which reviewers actually drive click-throughs and conversions.

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  -- The reviewer who shared the link. Null only if the originating
  -- review_request has been hard-deleted (we keep the row for aggregate
  -- counts but lose advocate identity).
  advocate_request_id uuid REFERENCES public.review_requests(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'share_view',
    'booking_click',
    'open_in_maps_click',
    'leave_own_click',
    'review_started',
    'review_submitted'
  )),
  -- review_request created during this referral chain — populated when the
  -- referred visitor lands on /r/<slug>?ref=<advocate> via the public flow.
  conversion_request_id uuid REFERENCES public.review_requests(id) ON DELETE SET NULL,
  referrer_host text,   -- HTTP referer hostname when available
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_loc_created
  ON public.referrals (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_advocate_event
  ON public.referrals (advocate_request_id, event_type);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_select_own_account" ON public.referrals;
CREATE POLICY "referrals_select_own_account" ON public.referrals
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );
