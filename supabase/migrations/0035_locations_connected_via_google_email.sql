-- Snapshot the Google account email that was used at the moment a staff
-- member connected this GBP via the picker. The live mapping in
-- google_oauth_tokens.google_email is per-user and gets overwritten every
-- time a staff re-auths with a different Google account, so without this
-- snapshot we lose the audit trail of which Google identity actually
-- pulled in each location.
--
-- Nullable: existing rows pre-dating this column stay NULL. Repair by
-- deleting and re-connecting the location (new connections will populate
-- it from the connector's current OAuth token).

alter table public.locations
  add column connected_via_google_email text;

comment on column public.locations.connected_via_google_email is
  'Snapshot of google_oauth_tokens.google_email at connection time. Set by the picker action and never updated thereafter, so it remains a true audit record even after the connecting staff re-auths with a different Google account.';
