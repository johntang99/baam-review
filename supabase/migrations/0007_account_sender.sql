-- 0007_account_sender.sql
-- Per-account email sender configuration. Each account can set their own
-- "From" address so emails come from reviews@theirdomain.com instead of
-- the shared no-reply@baamplatform.com. Major deliverability win — Gmail
-- treats domain-aligned senders very differently from generic ones.
--
-- The domain itself must be added + verified in the Resend dashboard
-- (manual for v1). Once verified there, the BAAM Studio admin sets
-- sender_verified_at here to unlock sending from that address.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_accounts_sender_email
  ON public.accounts(sender_email)
  WHERE sender_email IS NOT NULL;
