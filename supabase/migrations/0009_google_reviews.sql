-- 0009_google_reviews.sql
-- Adds review monitoring (Phase 2 promoted to v1).
-- Pulls actual Google reviews into our DB so the owner sees them in /app,
-- gets alerted on 1-2 star reviews, and (in Session R2) can reply.

-- Store the full GBP resource path on locations so we can call the
-- reviews endpoint: accounts/{accountId}/locations/{locationId}/reviews
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS google_resource_name text,
  ADD COLUMN IF NOT EXISTS reviews_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_locations_resource_name
  ON public.locations(google_resource_name)
  WHERE google_resource_name IS NOT NULL;

-- =============================================================================
-- google_reviews: snapshot of each review fetched from GBP.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.google_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  google_review_id text NOT NULL,
  reviewer_display_name text,
  reviewer_profile_photo_url text,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  review_create_time timestamptz NOT NULL,
  review_update_time timestamptz NOT NULL,
  reply_comment text,
  reply_update_time timestamptz,
  alerted_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, google_review_id)
);

CREATE INDEX IF NOT EXISTS idx_google_reviews_location_recent
  ON public.google_reviews(location_id, review_create_time DESC);
CREATE INDEX IF NOT EXISTS idx_google_reviews_low_rating
  ON public.google_reviews(location_id, rating)
  WHERE rating <= 2;
CREATE INDEX IF NOT EXISTS idx_google_reviews_unalerted_low
  ON public.google_reviews(rating, alerted_at)
  WHERE rating <= 2 AND alerted_at IS NULL;

-- =============================================================================
-- RLS: read-only for owners. Writes happen via service role from the sync job.
-- =============================================================================
ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_reviews_select_own_account" ON public.google_reviews;
CREATE POLICY "google_reviews_select_own_account" ON public.google_reviews
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );
