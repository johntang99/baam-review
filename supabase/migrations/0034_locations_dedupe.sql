-- 0034_locations_dedupe.sql
-- Prevent the same Google Business Profile from being connected twice
-- under the same account. Before this, double-clicking "Use this
-- location" in the picker silently created two rows pointing at the
-- same place_id; users got confused by duplicate cards in their
-- locations list.
--
-- The app-side picker action now does an idempotent pre-check too
-- (returns the existing row instead of inserting), but this constraint
-- is the belt to the picker's suspenders — any future code path that
-- inserts into locations also can't create a duplicate.
--
-- Partial index because google_place_id is nullable (e.g. test rows
-- without a real GBP yet); we only want uniqueness when the column is
-- actually populated.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_locations_account_place
  ON public.locations (account_id, google_place_id)
  WHERE google_place_id IS NOT NULL;
