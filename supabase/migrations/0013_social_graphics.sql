-- 0013_social_graphics.sql
-- Session B3: Share cards for any review (Distribute stage of the loop).
-- Tracks generated/downloaded social graphics for analytics and to power the
-- attribution dashboard later.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS default_share_theme text;

COMMENT ON COLUMN public.locations.default_share_theme IS
  'Preferred share-card theme key (see lib/share/themes.ts). NULL falls back to "warm-clinic".';

CREATE TABLE IF NOT EXISTS public.social_graphics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  google_review_id text,                          -- nullable: ad-hoc/empty cards allowed
  size text NOT NULL CHECK (size IN ('og', 'square', 'story')),
  theme text NOT NULL,
  action text NOT NULL CHECK (action IN ('view', 'copy_url', 'download', 'open')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_graphics_loc_created
  ON public.social_graphics (location_id, created_at DESC);

ALTER TABLE public.social_graphics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_graphics_select_own_account" ON public.social_graphics;
CREATE POLICY "social_graphics_select_own_account" ON public.social_graphics
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations
      WHERE account_id = public.current_account_id()
    )
  );
