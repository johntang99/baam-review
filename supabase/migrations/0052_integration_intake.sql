-- Integration intake (Phase 1 of the Integrations & Contact Intake SOP).
--
-- Outside systems (POS / CRM / checkout) feed customer contacts into the
-- existing Bulk Review Requests pipeline. Rather than a separate surface, an
-- integration-sourced contact is appended to a single rolling "integration"
-- list per location (lists.source = 'integration'), so it shows up in the
-- normal /app/lists flow: staff generate variations and "Send in Gmail" by
-- hand (email), while SMS may auto-send. See
-- docs/operations/INTEGRATIONS_AND_INTAKE_SOP.md.

-- 1) Mark where a list came from. Existing lists are all manual.
alter table public.lists
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'integration'));

-- Exactly one rolling integration list per location (the queue feeder finds
-- it or creates it; this guarantees no duplicate under concurrent webhooks).
create unique index if not exists lists_one_integration_per_location
  on public.lists (location_id)
  where source = 'integration';

-- 2) Idempotency key for inbound contacts (e.g. a POS transaction id), so a
-- webhook retry or duplicate event can't enqueue the same person twice.
alter table public.list_customers
  add column if not exists external_id text;

create unique index if not exists list_customers_loc_external_idx
  on public.list_customers (location_id, external_id)
  where external_id is not null;
