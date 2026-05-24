-- 0032_unify_ops_tenant.sql
-- Two coupled changes, run together because the second depends on the first:
--
--   1. Consolidate every account marked is_baam_internal=true into a single
--      "BAAM Operations" tenant. Every internal user becomes a user under
--      that one account; every location they connected moves with them.
--
--   2. Switch google_oauth_tokens from per-account to per-user. Required by
--      step 1 — multiple staff now share one tenant, but each authorizes
--      Google with their own gmail, so the token lookup key has to be the
--      user, not the tenant.
--
-- Order matters: we add+backfill user_id on google_oauth_tokens BEFORE
-- moving users around, otherwise the (account → user) join we use to
-- derive user_id would point everyone at the same ops user.
--
-- Customer accounts (is_baam_internal=false) are untouched.

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 1 — Add user_id to google_oauth_tokens and backfill from the
-- current account_id, while it still uniquely identifies a single user.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.google_oauth_tokens
  ADD COLUMN IF NOT EXISTS user_id uuid
    REFERENCES public.users(id) ON DELETE CASCADE;

UPDATE public.google_oauth_tokens t
SET user_id = (
  SELECT u.id
  FROM public.users u
  WHERE u.account_id = t.account_id
  ORDER BY u.created_at ASC
  LIMIT 1
)
WHERE t.user_id IS NULL;

-- Tokens whose account had no user at all are unreachable orphans. Drop.
DELETE FROM public.google_oauth_tokens WHERE user_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 2 — Drop the old (account_id PRIMARY KEY) shape and rebuild keys
-- around an opaque id + UNIQUE(user_id). After consolidation, multiple
-- tokens will share one account_id, so account_id as PK can't continue.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.google_oauth_tokens
  DROP CONSTRAINT IF EXISTS google_oauth_tokens_pkey;

ALTER TABLE public.google_oauth_tokens
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;

ALTER TABLE public.google_oauth_tokens
  ADD CONSTRAINT google_oauth_tokens_pkey PRIMARY KEY (id);

ALTER TABLE public.google_oauth_tokens
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.google_oauth_tokens
  ADD CONSTRAINT google_oauth_tokens_user_id_unique UNIQUE (user_id);

CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_account_id
  ON public.google_oauth_tokens (account_id);

COMMENT ON COLUMN public.google_oauth_tokens.user_id IS
  'The staff user whose Google identity authorized this token. Picker, sync, and reply use this to scope GBP API calls per-staff.';
COMMENT ON COLUMN public.google_oauth_tokens.account_id IS
  'Tenant where the user lives. Retained for cross-reference and the indexed lookup; user_id is the natural key.';

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 3 — Consolidate every is_baam_internal account into one canonical
-- ops tenant. Prefer john.tang2025@gmail.com (the founding account); if
-- that account doesn't exist for some reason, fall back to the oldest
-- internal account.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  ops_id uuid;
  moved_users int;
  moved_locations int;
  moved_subs int;
  moved_events int;
  moved_tokens int;
  removed_accounts int;
BEGIN
  SELECT id INTO ops_id
  FROM public.accounts
  WHERE is_baam_internal = true
  ORDER BY
    CASE WHEN primary_email = 'john.tang2025@gmail.com' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;

  IF ops_id IS NULL THEN
    RAISE NOTICE
      'No is_baam_internal account exists. Skipping consolidation. Run 0030_baam_internal.sql first.';
    RETURN;
  END IF;

  -- A descriptive name helps when scanning the dashboard.
  UPDATE public.accounts
  SET name = 'BAAM Operations',
      updated_at = now()
  WHERE id = ops_id;

  -- Move users.
  UPDATE public.users
  SET account_id = ops_id
  WHERE account_id IN (
    SELECT id FROM public.accounts
    WHERE is_baam_internal = true AND id <> ops_id
  );
  GET DIAGNOSTICS moved_users = ROW_COUNT;

  -- Move locations. Dependent rows (reviews, lists, list_customers, etc.)
  -- are joined to locations via location_id and resolve to the new
  -- account_id transitively, so no separate move is needed for them.
  UPDATE public.locations
  SET account_id = ops_id
  WHERE account_id IN (
    SELECT id FROM public.accounts
    WHERE is_baam_internal = true AND id <> ops_id
  );
  GET DIAGNOSTICS moved_locations = ROW_COUNT;

  -- Move directly account-scoped rows.
  UPDATE public.location_subscriptions
  SET account_id = ops_id
  WHERE account_id IN (
    SELECT id FROM public.accounts
    WHERE is_baam_internal = true AND id <> ops_id
  );
  GET DIAGNOSTICS moved_subs = ROW_COUNT;

  UPDATE public.subscription_events
  SET account_id = ops_id
  WHERE account_id IN (
    SELECT id FROM public.accounts
    WHERE is_baam_internal = true AND id <> ops_id
  );
  GET DIAGNOSTICS moved_events = ROW_COUNT;

  UPDATE public.google_oauth_tokens
  SET account_id = ops_id
  WHERE account_id IN (
    SELECT id FROM public.accounts
    WHERE is_baam_internal = true AND id <> ops_id
  );
  GET DIAGNOSTICS moved_tokens = ROW_COUNT;

  -- Now safe to drop the leftover internal accounts. Nothing references
  -- them after the moves above.
  DELETE FROM public.accounts
  WHERE is_baam_internal = true AND id <> ops_id;
  GET DIAGNOSTICS removed_accounts = ROW_COUNT;

  RAISE NOTICE
    'Consolidated into ops tenant %: users=%, locations=%, subs=%, events=%, tokens=%, removed_accounts=%',
    ops_id, moved_users, moved_locations, moved_subs, moved_events,
    moved_tokens, removed_accounts;
END $$;
