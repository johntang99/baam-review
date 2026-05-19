-- 0021_review_videos.sql
-- Video Library: persisted, *accepted* review videos. The Video Studio
-- renders drafts ephemerally; only when an admin clicks "Accept & save"
-- does a row land here and the MP4(s) get uploaded to the review-videos
-- bucket. Discarded drafts are never stored. Account-scoped via the
-- locations join (same RLS shape as google_reviews). The Accept action
-- writes via the service client (service role bypasses RLS); authenticated
-- admins can read and delete from their own Library.

CREATE TABLE IF NOT EXISTS public.review_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  -- Source review. Nullable: a video may come from a manually-entered
  -- review, and we keep the video even if the synced review is later removed.
  review_id uuid REFERENCES public.google_reviews(id) ON DELETE SET NULL,

  template text NOT NULL DEFAULT 'spotlight',

  -- Snapshot of the review used — survives source deletion / manual entry,
  -- and lets the Library card render without re-joining google_reviews.
  reviewer_name text,
  rating int CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  review_text text,

  -- Brand palette + audio choices the video was rendered with, so the
  -- output is reproducible/auditable. brand = the resolved BrandColors.
  brand jsonb,
  has_music boolean NOT NULL DEFAULT false,
  has_voiceover boolean NOT NULL DEFAULT false,

  -- Storage object paths in the review-videos bucket. "Both" sets both;
  -- a single orientation sets one. At least one must be present.
  vertical_path text,
  landscape_path text,
  vertical_bytes bigint,
  landscape_bytes bigint,
  duration_seconds numeric(6,2),

  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT review_videos_has_a_file
    CHECK (vertical_path IS NOT NULL OR landscape_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_review_videos_location_created
  ON public.review_videos(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_videos_review
  ON public.review_videos(review_id);

ALTER TABLE public.review_videos ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated admin of the owning account.
DROP POLICY IF EXISTS "review_videos_select_own_account" ON public.review_videos;
CREATE POLICY "review_videos_select_own_account" ON public.review_videos
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );

-- Delete: admins can remove a video from their Library.
DROP POLICY IF EXISTS "review_videos_delete_own_account" ON public.review_videos;
CREATE POLICY "review_videos_delete_own_account" ON public.review_videos
  FOR DELETE TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );

-- INSERT/UPDATE intentionally have no authenticated policy: the Accept
-- action writes via the service client (service role bypasses RLS), the
-- same system-write pattern used by the google_reviews sync.

-- =============================================================================
-- Bucket: review-videos. PRIVATE — client marketing assets are served via
-- short-lived signed URLs, never world-public. Object path convention:
--   <account_id>/<location_id>/<video_id>-<orientation>.mp4
-- (first folder segment is the account id, used by the RLS policies below).
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-videos',
  'review-videos',
  false,
  100 * 1024 * 1024,
  ARRAY['video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS on storage.objects for the review-videos bucket.
-- Convention: every object lives at <account_id>/<location_id>/<file>.

DROP POLICY IF EXISTS "review_videos_obj_account_read" ON storage.objects;
CREATE POLICY "review_videos_obj_account_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'review-videos'
    AND (storage.foldername(name))[1] = (public.current_account_id())::text
  );

DROP POLICY IF EXISTS "review_videos_obj_account_delete" ON storage.objects;
CREATE POLICY "review_videos_obj_account_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'review-videos'
    AND (storage.foldername(name))[1] = (public.current_account_id())::text
  );

-- Uploads at Accept go through the service role (bypasses RLS), so there is
-- deliberately no INSERT/UPDATE policy for authenticated users — mirrors the
-- logos bucket pattern, but private and system-written.
