-- Preset Gmail account for "Preview & Open in Gmail" flow on /app/send.
-- This is separate from sender_email (Resend from-domain) and separate
-- from connected_via_google_email (connection-time audit snapshot).

alter table public.locations
  add column if not exists gmail_sender_email text;

comment on column public.locations.gmail_sender_email is
  'Optional per-location Gmail account preset used by /app/send preview flow to open Gmail compose with authuser=<email>. Does not affect Resend sending.';
