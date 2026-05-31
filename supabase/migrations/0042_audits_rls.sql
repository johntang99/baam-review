-- Audit engine · Session 10 · RLS for audits table.
-- Customers can read their own audits; BAAM internal staff can read all.
-- Inserts/updates happen via service role (renderAndDeliverAudit), so no
-- INSERT/UPDATE policies are needed.

alter table public.audits
  add constraint audits_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

alter table public.audits enable row level security;

drop policy if exists "audits_select_own" on public.audits;
create policy "audits_select_own"
  on public.audits
  for select
  using (user_id = auth.uid());

drop policy if exists "audits_select_internal" on public.audits;
create policy "audits_select_internal"
  on public.audits
  for select
  using (
    exists (
      select 1 from public.users u
      join public.accounts a on a.id = u.account_id
      where u.id = auth.uid() and a.is_baam_internal = true
    )
  );
