-- 0030_baam_internal.sql
-- Mark which accounts belong to BAAM staff (internal ops) vs paying customers.
--
-- Why on accounts (not users): an "account" is the tenant. Several users
-- can share one account. Staff sometimes share one ops account, sometimes
-- have their own. Marking the account keeps a single source of truth.
--
-- This flag drives UI gates only (e.g. the staff-only Onboarding tab and
-- the Staff admin page). RLS still scopes data by account_id like before,
-- so flipping the flag does NOT expose customer data to staff — staff only
-- see customers via internal-ops tables (customer_records, etc.) that are
-- explicitly meant for staff visibility.
--
-- Bootstrap: john.tang2025@gmail.com is promoted by this migration so the
-- admin page is reachable on first deploy. From there, internal users can
-- promote the rest of the team via /app/admin/staff.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_baam_internal boolean NOT NULL DEFAULT false;

-- Partial index — we only ever query "show me the internal accounts",
-- never "give me all the non-internal". Partial keeps it tiny.
CREATE INDEX IF NOT EXISTS idx_accounts_is_baam_internal
  ON public.accounts (id)
  WHERE is_baam_internal = true;

-- Bootstrap the founding account so /app/admin/staff is reachable.
UPDATE public.accounts
SET is_baam_internal = true
WHERE primary_email = 'john.tang2025@gmail.com';
