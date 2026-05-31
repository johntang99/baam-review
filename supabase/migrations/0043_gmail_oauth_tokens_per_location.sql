-- 0043_gmail_oauth_tokens_per_location.sql
-- Gmail OAuth tokens should be location-scoped, not staff-scoped.
-- A staff user can manage multiple locations, each with a different Gmail.

ALTER TABLE public.gmail_oauth_tokens
  ADD COLUMN IF NOT EXISTS location_id uuid
  REFERENCES public.locations(id) ON DELETE CASCADE;

-- Backward-compat cleanup for early test rows created before location_id existed.
-- They cannot be safely mapped to a location, so force re-connect per location.
DELETE FROM public.gmail_oauth_tokens
WHERE location_id IS NULL;

ALTER TABLE public.gmail_oauth_tokens
  ALTER COLUMN location_id SET NOT NULL;

-- Old shape: UNIQUE(user_id). New shape: UNIQUE(location_id).
ALTER TABLE public.gmail_oauth_tokens
  DROP CONSTRAINT IF EXISTS gmail_oauth_tokens_user_id_key;

ALTER TABLE public.gmail_oauth_tokens
  ADD CONSTRAINT gmail_oauth_tokens_location_id_unique UNIQUE (location_id);

CREATE INDEX IF NOT EXISTS idx_gmail_oauth_tokens_user_id
  ON public.gmail_oauth_tokens(user_id);
