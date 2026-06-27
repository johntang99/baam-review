-- Session 12 · List upload consent attestation.
-- Records proof that each uploaded batch was sourced from a client
-- who collected recipient consent before sharing contacts with BAAM.

alter table public.lists
  add column if not exists consent_attested boolean not null default false,
  add column if not exists consent_attested_at timestamptz,
  add column if not exists consent_source_url text,
  add column if not exists consent_attestation_method text
    check (
      consent_attestation_method is null
      or consent_attestation_method in (
        'client_collected',
        'first_party_form',
        'api_import',
        'other'
      )
    ),
  add column if not exists consent_attested_by uuid
    references public.users(id) on delete set null;

alter table public.lists
  drop constraint if exists lists_consent_attested_requires_fields;

alter table public.lists
  add constraint lists_consent_attested_requires_fields
  check (
    consent_attested = false
    or (
      consent_attested_at is not null
      and consent_source_url is not null
    )
  );

create index if not exists lists_consent_attested_at_idx
  on public.lists (consent_attested_at desc nulls last);

comment on column public.lists.consent_attested is
  'Whether the uploader attested that recipient consent was collected before import.';

comment on column public.lists.consent_source_url is
  'URL of the client form/page/process where consent is collected.';

comment on column public.lists.consent_attested_by is
  'public.users id of the BAAM user who made the attestation for this batch.';
