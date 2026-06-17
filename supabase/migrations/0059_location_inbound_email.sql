-- Email-in bridge: a per-location inbound token. The business forwards its
-- order/booking confirmation emails to  r-<token>@<INBOUND_EMAIL_DOMAIN>  and
-- the inbound provider posts them to /api/integrations/inbound-email, which
-- resolves the location by this token, parses the customer contact, and
-- enqueues it. See docs/operations/INTEGRATION_BRIDGES_PLAN.md (Item 1).
alter table public.locations
  add column if not exists inbound_email_token text;

create unique index if not exists idx_locations_inbound_email_token
  on public.locations (inbound_email_token)
  where inbound_email_token is not null;
