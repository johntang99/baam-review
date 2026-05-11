-- 0008_location_sender.sql
-- Moves sender_email / sender_name / sender_verified_at from accounts to
-- locations. A single BAAM Review account can own multiple distinct
-- businesses (e.g., a clinic and a restaurant) — each needs its own
-- sender identity for inbox recognition and deliverability.
--
-- 0007 added these columns to accounts but they hadn't been filled in
-- by any customer yet, so dropping is safe.

ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS sender_email,
  DROP COLUMN IF EXISTS sender_name,
  DROP COLUMN IF EXISTS sender_verified_at;

DROP INDEX IF EXISTS idx_accounts_sender_email;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_locations_sender_email
  ON public.locations(sender_email)
  WHERE sender_email IS NOT NULL;
