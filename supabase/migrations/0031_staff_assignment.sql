-- 0031_staff_assignment.sql
-- Internal staff roles + per-location manager assignment.
--
-- Three roles inside the BAAM Operations tenant:
--   • admin            — you. Sees every location regardless of who connected.
--                        Can assign any manager to any location.
--   • sales            — connects GBPs (their own gmail for Case B, or shared
--                        baamplatform@gmail.com for Case A). Sees locations
--                        they personally connected, forever. Can add account
--                        managers to help with daily work.
--   • account_manager  — handles daily ops only. Sees locations they've been
--                        assigned to. Cannot connect GBP, cannot reassign.
--
-- Assignment is additive — "add a manager" not "transfer ownership". A sales
-- always retains visibility on what they connected. A single location can
-- have 0, 1, or many account managers added over time.
--
-- Customer logins (Self-Service / Full-Service end users) are unaffected:
-- they don't have ops_role and continue to see only their own account's
-- data via the existing account_id RLS.

-- ─────────────────────────────────────────────────────────────────────────
-- users.ops_role — null for customers, set for internal staff.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ops_role text
    CHECK (ops_role IN ('admin', 'sales', 'account_manager'));

CREATE INDEX IF NOT EXISTS idx_users_ops_role
  ON public.users (ops_role)
  WHERE ops_role IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- locations.connected_by_user_id — immutable audit + sales' permanent view.
-- Nullable for backward-compat: locations created before this migration
-- have no recorded connector and only stay visible via account_id RLS.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS connected_by_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_locations_connected_by
  ON public.locations (connected_by_user_id)
  WHERE connected_by_user_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- location_assignments — join table for "sales added account-manager M-6
-- to handle this client". UNIQUE prevents the same manager being added
-- twice; deletion cascades when either side is removed.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.location_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL
    REFERENCES public.locations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  -- Who clicked the Assign button (audit). Null if the assigner has been
  -- removed since.
  assigned_by_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_location_assignments_user
  ON public.location_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_location_assignments_location
  ON public.location_assignments (location_id);

-- ─────────────────────────────────────────────────────────────────────────
-- RLS for location_assignments — only internal users can see/write rows.
-- The page-level visibility filter (admin/sales/account_manager) is
-- enforced in query code, not in RLS, because the visibility rule pivots
-- on the current user's ops_role.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.location_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "location_assignments_select_internal"
  ON public.location_assignments;
CREATE POLICY "location_assignments_select_internal"
  ON public.location_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.accounts a ON a.id = u.account_id
      WHERE u.id = auth.uid() AND a.is_baam_internal = true
    )
  );

DROP POLICY IF EXISTS "location_assignments_insert_internal"
  ON public.location_assignments;
CREATE POLICY "location_assignments_insert_internal"
  ON public.location_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.accounts a ON a.id = u.account_id
      WHERE u.id = auth.uid() AND a.is_baam_internal = true
    )
  );

DROP POLICY IF EXISTS "location_assignments_delete_internal"
  ON public.location_assignments;
CREATE POLICY "location_assignments_delete_internal"
  ON public.location_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.accounts a ON a.id = u.account_id
      WHERE u.id = auth.uid() AND a.is_baam_internal = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Bootstrap: john gets 'admin'. The rest of the internal team will be
-- assigned roles via /app/admin/staff (or a manual UPDATE).
-- ─────────────────────────────────────────────────────────────────────────
UPDATE public.users
SET ops_role = 'admin'
WHERE id IN (
  SELECT u.id
  FROM public.users u
  JOIN public.accounts a ON a.id = u.account_id
  WHERE a.primary_email = 'john.tang2025@gmail.com'
);
