-- Restrict the "see all audits" privilege to admins only.
--
-- Previously `audits_select_internal` let ANY BAAM internal staff member
-- (accounts.is_baam_internal = true) read every audit. New rule: only
-- users with ops_role = 'admin' can see all reports. Everyone else —
-- non-admin internal staff (sales, account_manager) AND external signups —
-- can only see audits they generated (covered by audits_select_own).
--
-- Link-sharing (audits_select_public, is_public = true) is unchanged.
-- Audit inserts/updates run via the service role (bypasses RLS), so
-- generation is unaffected.

drop policy if exists "audits_select_internal" on public.audits;
drop policy if exists "audits_select_admin" on public.audits;

create policy "audits_select_admin"
  on public.audits
  for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.ops_role = 'admin'
    )
  );
