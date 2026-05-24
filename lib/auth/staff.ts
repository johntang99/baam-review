import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OpsRole } from "@/lib/database.types";

/**
 * Returns true if the currently-authenticated user belongs to an account
 * marked `accounts.is_baam_internal = true` (BAAM ops staff).
 *
 * Drives UI gates only — RLS still scopes business data by account_id.
 * Promoting/demoting accounts happens in /app/admin/staff and writes
 * straight to `accounts.is_baam_internal` via the service-role client.
 */
export async function isUserBaamInternal(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("accounts(is_baam_internal)")
    .eq("id", userId)
    .maybeSingle();
  const accountRel = data?.accounts;
  const account = Array.isArray(accountRel) ? accountRel[0] : accountRel;
  return account?.is_baam_internal === true;
}

export interface InternalUserContext {
  /** users.id */
  userId: string;
  /** users.account_id */
  accountId: string;
  /** Role inside the ops tenant. Null means internal but unassigned a role. */
  opsRole: OpsRole | null;
}

/**
 * Returns the ops context for the current user (role + account), or null
 * if they aren't an internal user. Use this to gate UI and to filter
 * the /app/locations page by visibility.
 */
export async function getInternalContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<InternalUserContext | null> {
  const { data } = await supabase
    .from("users")
    .select("id, account_id, ops_role, accounts(is_baam_internal)")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  const accountRel = data.accounts;
  const account = Array.isArray(accountRel) ? accountRel[0] : accountRel;
  if (account?.is_baam_internal !== true) return null;
  return {
    userId: data.id,
    accountId: data.account_id,
    opsRole: data.ops_role ?? null,
  };
}
