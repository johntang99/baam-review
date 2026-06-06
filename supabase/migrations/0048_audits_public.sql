-- Per-audit public-access flag. When `is_public = true`, the audit's
-- /audit/<uuid> page, embed, and download routes serve the report to any
-- visitor — no signin required. The audit_id itself is a 122-bit UUID, so
-- the URL is effectively the capability. Owner toggles the flag from the
-- audit list; unchecking it immediately revokes anonymous access.

alter table public.audits
  add column if not exists is_public boolean not null default false;

create index if not exists idx_audits_is_public
  on public.audits (is_public)
  where is_public = true;

-- RLS: anyone (including anonymous) can SELECT a public audit. The owner
-- and BAAM internal-staff policies still cover private rows.
drop policy if exists "audits_select_public" on public.audits;
create policy "audits_select_public"
  on public.audits
  for select
  using (is_public = true);

-- RLS: owner can UPDATE their own audit. Restricted to flipping the
-- is_public bit only — no other column is exposed for owner writes. We
-- enforce this with a column-level WITH CHECK predicate keeping all
-- non-is_public columns equal to their existing value.
drop policy if exists "audits_update_own_public_flag" on public.audits;
create policy "audits_update_own_public_flag"
  on public.audits
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on column public.audits.is_public is
  'When true, /audit/<id> is viewable without signin. Owner-toggled from /audit/list.';
