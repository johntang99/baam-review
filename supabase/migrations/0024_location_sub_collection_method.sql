-- 0024_location_sub_collection_method.sql
-- How a location's subscription is paid:
--   'card'    → Stripe Checkout collects that business's card, auto-charged.
--   'invoice' → Full-service only. collection_method=send_invoice in Stripe
--               (net-30); the business pays by check, BAAM marks the Stripe
--               invoice paid (paid_out_of_band) when it clears. No card.
--
-- Stripe is the source of truth (subscription.collection_method); this
-- column is stored for the admin per-location billing list so it can show
-- "Card on file" vs "Invoiced — pay by check" without a Stripe round-trip.
-- Default 'card' (self-service added locations are always card; full-service
-- card is the common case). Webhook/data model are otherwise identical.

ALTER TABLE public.location_subscriptions
  ADD COLUMN IF NOT EXISTS collection_method text NOT NULL DEFAULT 'card'
    CHECK (collection_method IN ('card', 'invoice'));

COMMENT ON COLUMN public.location_subscriptions.collection_method IS
  'card = Checkout card auto-charge; invoice = Full-service send_invoice (pay by check, marked paid out of band). Mirrors Stripe subscription.collection_method.';
