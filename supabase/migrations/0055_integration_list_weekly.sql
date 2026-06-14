-- Roll the integration intake list WEEKLY so it never grows unbounded.
--
-- Phase 1 created one integration list per location forever. With a broad,
-- high-volume client base that single list would balloon. Instead, each ISO
-- week gets its own "Incoming · week of <Mon>" list (window_key = that
-- Monday's date). Each week is a bounded, sendable batch; past weeks complete
-- on their own; the queue feeder always writes to the current week's list.

alter table public.lists
  add column if not exists window_key text;

-- Was: one integration list per location. Now: one per (location, week).
drop index if exists lists_one_integration_per_location;

create unique index if not exists lists_one_integration_per_window
  on public.lists (location_id, window_key)
  where source = 'integration';
