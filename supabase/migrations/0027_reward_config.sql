-- 0027_reward_config.sql
-- Add reward_config JSONB column to locations for the reviewer's reward card
-- shown on the /r/[slug]/thank-you page.
--
-- This is the reviewer's personal "thank-you" reward, distinct from
-- referral_config which is the friend's offer on /s/[token] share landings.
-- The two can carry different discount amounts and different coupon codes
-- (e.g. THANKS20 for the reviewer, FRIEND20 for their friend).
--
-- Schema mirrors referral_config but adds three fields specific to the
-- reward card design discussed with the user:
--   - booking_enabled (bool)   — when false, the reward card omits the
--                                 "Book now & apply this code" CTA. For
--                                 retail, walk-in services, etc.
--   - image_url (text)         — optional hero image on the reward card
--   - description (text)       — markdown-lite description body, shown
--                                 below the image
--
-- Same per-location single-string approach as referral_config (no
-- per-language JSONB). i18n will come in a follow-up.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS reward_config jsonb NOT NULL DEFAULT '{}'::jsonb;
