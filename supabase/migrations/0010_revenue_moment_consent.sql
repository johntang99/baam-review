-- 0010_revenue_moment_consent.sql
-- Phase A / Session A1: turn the thank-you page into the Convert + Refer stage
-- of the 7-step Review-to-Revenue loop and add explicit display-consent so we
-- can republish review text on the public widget (Phase B1).

-- =============================================================================
-- locations: revenue context + post-review action targets.
-- =============================================================================
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS avg_customer_value_cents int,
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS social_handles jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS consent_display_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.locations.avg_customer_value_cents IS
  'Average customer lifetime value in cents. Powers ROI calculator and post-review revenue strip.';
COMMENT ON COLUMN public.locations.booking_url IS
  'External booking URL used by the post-review "Book your next visit" CTA. NULL hides the CTA.';
COMMENT ON COLUMN public.locations.social_handles IS
  'Per-platform handles: { xhs, ig, wechat_mp, tiktok, fb }. Empty object hides the Follow strip.';
COMMENT ON COLUMN public.locations.consent_display_enabled IS
  'When true, the public review flow shows the consent-to-display checkbox before Google handoff.';

-- =============================================================================
-- review_requests: track per-request display consent.
-- Default false (opt-in). Reviews submitted before this migration remain
-- ineligible for republishing on the widget, which is the safe default.
-- =============================================================================
ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS consent_display boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.review_requests.consent_display IS
  'Customer opted in to having their review text republished on the location''s public widget.';

-- =============================================================================
-- post_review_actions: anonymous interaction log on the thank-you page.
-- Powers the "Convert" + "Refer" stages of the loop and feeds analytics.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.post_review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.review_requests(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'view',
    'book_click',
    'refer_click',
    'share_click',
    'follow_click',
    'done_click'
  )),
  share_destination text CHECK (
    share_destination IS NULL
    OR share_destination IN ('wechat', 'sms', 'copy', 'more', 'whatsapp', 'email')
  ),
  share_token text,
  language text CHECK (language IS NULL OR language IN ('en', 'zh', 'es')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pra_loc_created
  ON public.post_review_actions (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pra_share_token
  ON public.post_review_actions (share_token)
  WHERE share_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pra_request
  ON public.post_review_actions (request_id)
  WHERE request_id IS NOT NULL;

-- RLS: anonymous inserts happen via the service-role server client.
-- Authenticated owners can read their own location's rows.
ALTER TABLE public.post_review_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_review_actions_select_own_account" ON public.post_review_actions;
CREATE POLICY "post_review_actions_select_own_account" ON public.post_review_actions
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );
