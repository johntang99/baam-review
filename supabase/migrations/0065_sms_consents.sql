-- Session 12 · SMS consent evidence ledger.
-- Stores auditable proof that a recipient explicitly opted in before SMS.

create table if not exists public.sms_consents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  business_name text,
  first_name text,
  phone_e164 text not null
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  consent_status text not null default 'opted_in'
    check (consent_status in ('opted_in', 'opted_out')),
  consent_method text not null default 'web_form_checkbox',
  consent_text text not null,
  form_version text not null default 'sms-consent-v1',
  source_url text not null,
  source_path text not null,
  source_label text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  consented_at timestamptz not null default now(),
  opted_out_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sms_consents_phone_time
  on public.sms_consents (phone_e164, consented_at desc);

create index if not exists idx_sms_consents_location_time
  on public.sms_consents (location_id, consented_at desc);

create index if not exists idx_sms_consents_account_time
  on public.sms_consents (account_id, consented_at desc);

create index if not exists idx_sms_consents_status_time
  on public.sms_consents (consent_status, consented_at desc);

comment on table public.sms_consents is
  'Auditable SMS opt-in / opt-out proof (consent text, source URL, timestamp, and request metadata).';

comment on column public.sms_consents.form_version is
  'Versioned consent form template identifier shown to end users at opt-in.';

comment on column public.sms_consents.metadata is
  'Additional evidence payload (e.g., referer, header snapshot, importer notes).';

alter table public.sms_consents enable row level security;

drop policy if exists "sms_consents_all_own_account" on public.sms_consents;
create policy "sms_consents_all_own_account" on public.sms_consents
  for all to authenticated
  using (
    (account_id is not null and account_id = public.current_account_id())
    or (
      location_id in (
        select id
        from public.locations
        where account_id = public.current_account_id()
      )
    )
  )
  with check (
    (account_id is not null and account_id = public.current_account_id())
    or (
      location_id in (
        select id
        from public.locations
        where account_id = public.current_account_id()
      )
    )
  );
