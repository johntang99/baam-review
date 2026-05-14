-- 0016_location_website.sql
-- Add the location's primary website URL — used as the click target on the
-- recommendation card footer on /s/<advocate_id>. Currently the friend
-- clicks the business name and lands on the BAAM review form, which is the
-- wrong framing — they just got a recommendation, the natural next step is
-- to learn about the business, not to leave their own review.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS website_url text;

COMMENT ON COLUMN public.locations.website_url IS
  'Optional clinic / business homepage URL. Used as the destination when a recommended customer clicks the business name on a share-card landing page.';
