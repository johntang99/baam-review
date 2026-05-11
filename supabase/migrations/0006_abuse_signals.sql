-- 0006_abuse_signals.sql
-- Infrastructure for the fake-review-prevention policy (master plan §11).
-- These columns aren't wired to enforcement yet — that lands in Session 7
-- (velocity checks on send) and Session 10 (admin abuse dashboard).
-- Adding them now so later migrations are additive, not data-corrupting.

-- =============================================================================
-- review_requests: per-send flag for suspicious activity.
-- Examples of what flag_reason will eventually hold: 'velocity:hourly',
-- 'velocity:daily', 'token_reuse', 'duplicate_recipient', 'manual'.
-- =============================================================================
ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS flag_reason text;

CREATE INDEX IF NOT EXISTS idx_review_requests_flagged
  ON public.review_requests(location_id, flagged_at DESC)
  WHERE flagged_at IS NOT NULL;

-- =============================================================================
-- accounts: account-level suspension. Used when a customer is found to be
-- systematically violating Google's policies (fake reviews, incentives,
-- mass-sharing). Suspended accounts can't send new requests or accept new
-- public review submissions.
-- =============================================================================
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

CREATE INDEX IF NOT EXISTS idx_accounts_suspended
  ON public.accounts(suspended_at)
  WHERE suspended_at IS NOT NULL;
