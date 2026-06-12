-- Shared audits are for the audited business's CLIENTS (via the share link),
-- not for other platform users. A shared audit must be, for users, exactly as
-- private as any other: visible only to its owner or an admin.
--
-- The detail/embed/download routes now fetch with the service role and
-- authorize explicitly on is_public (see lib/audit/audit-access.ts), so the
-- broad "anyone can read an is_public row" RLS policy is no longer needed —
-- and removing it guarantees no RLS-backed query can leak a shared audit to
-- another logged-in user.
--
-- Remaining SELECT policies: audits_select_own (owner) + audits_select_admin
-- (admin). The owner's is_public UPDATE policy (audits_update_own_public_flag)
-- is unaffected, so toggling "Share Report" still works.

drop policy if exists "audits_select_public" on public.audits;
