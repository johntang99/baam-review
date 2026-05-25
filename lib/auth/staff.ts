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
 * Resolve which location ids an internal user is allowed to see.
 *
 * Returns null to mean "every location RLS would let through" — that's
 * the right answer for admin (sees everything in the ops tenant) and for
 * customer logins (RLS scopes by account_id naturally).
 *
 *   • admin              → null
 *   • null ops_role      → null (treated like admin; backward-compat)
 *   • sales              → ids of locations where connected_by_user_id = me
 *   • account_manager    → ids of locations in location_assignments for me
 *
 * Returns [] if the role implies access but the user has no matching rows.
 * Returns null for customers (no internal context). Pages then skip
 * filtering and let RLS handle scoping.
 */
export async function getVisibleLocationIds(
  supabase: SupabaseClient<Database>,
  internal: InternalUserContext | null,
): Promise<string[] | null> {
  if (!internal) return null;
  if (internal.opsRole === "admin" || internal.opsRole === null) return null;

  if (internal.opsRole === "sales") {
    const { data } = await supabase
      .from("locations")
      .select("id")
      .eq("connected_by_user_id", internal.userId);
    return (data ?? []).map((r) => r.id);
  }
  if (internal.opsRole === "account_manager") {
    const { data } = await supabase
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", internal.userId);
    return (data ?? []).map((r) => r.location_id);
  }
  return [];
}

/**
 * Convenience guard for /app/locations/[id]/* routes. Returns true if
 * the current user may access the given location. Customers fall back
 * to RLS (always true here because caller already verified via .select).
 */
export async function canAccessLocation(
  supabase: SupabaseClient<Database>,
  internal: InternalUserContext | null,
  locationId: string,
): Promise<boolean> {
  if (!internal) return true;
  if (internal.opsRole === "admin" || internal.opsRole === null) return true;

  if (internal.opsRole === "sales") {
    const { data } = await supabase
      .from("locations")
      .select("id")
      .eq("id", locationId)
      .eq("connected_by_user_id", internal.userId)
      .maybeSingle();
    return !!data;
  }
  if (internal.opsRole === "account_manager") {
    const { data } = await supabase
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", internal.userId)
      .eq("location_id", locationId)
      .maybeSingle();
    return !!data;
  }
  return false;
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
