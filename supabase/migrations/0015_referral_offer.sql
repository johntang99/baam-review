-- 0015_referral_offer.sql
-- Phase B / Session B4 follow-on: add a configurable referral offer per
-- location and extend the referrals.event_type CHECK to record
-- offer-specific interactions.

-- =============================================================================
-- locations.referral_config — per-location promotional offer attached to
-- every share-card landing (`/s/<advocate_id>`).
-- =============================================================================
-- Shape (mirrored in TypeScript ReferralConfig):
-- {
--   enabled:        bool   (default true; falsey hides the offer block),
--   offer_title:    string ("$20 off your first visit"),
--   offer_subtitle: string ("Use this code at booking..."),
--   offer_code:     string ("FRIEND10"),
--   offer_image_url: string|null,        -- optional hero image
--   cta_label:      string ("Book with this offer"),
--   cta_url:        string|null,         -- falls back to locations.booking_url
--   expires_at:     timestamptz|null     -- ISO; null = no expiry
-- }
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS referral_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.locations.referral_config IS
  'Per-location referral offer config rendered on /s/<advocate_id> and on the customer-facing thank-you share card.';

-- =============================================================================
-- referrals.event_type — allow new offer-specific event types.
-- =============================================================================
ALTER TABLE public.referrals
  DROP CONSTRAINT IF EXISTS referrals_event_type_check;

ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_event_type_check
  CHECK (event_type IN (
    'share_view',
    'booking_click',
    'open_in_maps_click',
    'leave_own_click',
    'review_started',
    'review_submitted',
    'offer_view',
    'offer_book_click',
    'code_copied'
  ));
