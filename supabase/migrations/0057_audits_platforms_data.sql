-- Persist secondary-platform data (Yelp, etc.) as part of the audit snapshot.
--
-- Previously platforms were never stored on the audits row; the report view
-- re-fetched them from the short-lived audit_platform_data cache (24h TTL for
-- paid). Once that cache expired, a report view had to fetch live — which blew
-- the route timeout and rendered the report blank. Storing the data on the row
-- makes the audit fully self-contained: every later view/download reads it off
-- the record, with no external dependency on the view path.
alter table public.audits
  add column if not exists platforms_data jsonb;
