-- Idempotency marker for the per-location Self-Service billing welcome
-- email. Both the Stripe webhook AND the post-checkout reconcile path
-- can run for the same checkout session (one races the other in prod;
-- only reconcile fires in local dev without `stripe listen`), so we
-- need a durable "already sent" flag to prevent duplicate welcome
-- emails to the customer + duplicate team-notification mails to ops.
--
-- NULL = not yet sent. Set to NOW() right after the send succeeds.
-- The Stripe sub id is unique-ish (UNIQUE constraint on
-- location_subscriptions.stripe_subscription_id) so we can also fall
-- back to "row exists with welcome_email_sent_at NOT NULL" semantics.

ALTER TABLE public.location_subscriptions
ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ NULL;
