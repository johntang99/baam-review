-- 0033_backfill_legacy_connected_by.sql
-- Locations connected before migration 0031 (which added
-- locations.connected_by_user_id) have NULL in that column. After
-- 0032 consolidated everything into the BAAM Operations tenant, these
-- legacy rows have no owner of record, which means:
--
--   • Sales-role users can't see them (visibility filter is
--     connected_by_user_id = me).
--   • Account managers can still see them via location_assignments.
--   • Admin sees them regardless.
--
-- Backfill the connector to the ops-tenant admin (the de-facto historical
-- owner — every connection before 0031 went through the shared admin
-- account). Admin can then reassign on a case-by-case basis through the
-- Assign modal.
--
-- Idempotent: only touches rows where connected_by_user_id IS NULL.

DO $$
DECLARE
  ops_id uuid;
  admin_id uuid;
  updated_count int;
BEGIN
  SELECT id INTO ops_id
  FROM public.accounts
  WHERE is_baam_internal = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF ops_id IS NULL THEN
    RAISE NOTICE 'No ops tenant — skipping legacy connector backfill.';
    RETURN;
  END IF;

  SELECT id INTO admin_id
  FROM public.users
  WHERE account_id = ops_id AND ops_role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Fall back to any user in the ops tenant if no admin role is set.
  IF admin_id IS NULL THEN
    SELECT id INTO admin_id
    FROM public.users
    WHERE account_id = ops_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF admin_id IS NULL THEN
    RAISE NOTICE 'No user in ops tenant — skipping legacy connector backfill.';
    RETURN;
  END IF;

  UPDATE public.locations
  SET connected_by_user_id = admin_id
  WHERE account_id = ops_id
    AND connected_by_user_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RAISE NOTICE 'Backfilled connected_by_user_id on % legacy locations (→ %)',
    updated_count, admin_id;
END $$;
