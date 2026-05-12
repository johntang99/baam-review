-- 0012_widget.sql
-- Session B1: Display widget — embedded review carousel on customer websites.
-- Covers stage iii (Display) of the Review-to-Revenue Loop.

-- =============================================================================
-- locations.widget_config — per-location widget shape.
-- Shape (mirrored in TypeScript via WidgetConfig):
--   {
--     layout: 'cards' | 'compact',
--     min_rating: 4 | 5,
--     max_count: int (3–20),
--     accent_color: '#RRGGBB' | null (null => use brand_color),
--     show_aggregate: bool,
--     show_leave_own: bool,
--     show_reply: bool
--   }
-- Defaults applied in server code when fields are absent.
-- =============================================================================
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS widget_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.locations.widget_config IS
  'Display-widget shape: layout, min_rating, max_count, accent_color, show_aggregate, show_leave_own, show_reply. Empty object means use defaults.';

-- =============================================================================
-- widget_events — impression + click telemetry.
-- Anonymous insert via service-role client (no PII beyond origin URL).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.widget_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'view',
    'review_click',
    'leave_own_click',
    'cta_click'
  )),
  google_review_id text,  -- present when event_type = 'review_click'
  origin text,            -- referer host of the embedding site
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_widget_events_loc_created
  ON public.widget_events (location_id, created_at DESC);

-- RLS: anonymous inserts via service-role client; authenticated owners read
-- only their account's events.
ALTER TABLE public.widget_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "widget_events_select_own_account" ON public.widget_events;
CREATE POLICY "widget_events_select_own_account" ON public.widget_events
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );
