import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInternalContext, canAccessLocation } from "@/lib/auth/staff";

/**
 * Authorize the current user to manage a location's integration settings
 * (API keys, native connections).
 *   • Internal staff → canAccessLocation (admin any; sales connected/assigned;
 *     account_manager assigned).
 *   • Customer → only their OWN location. canAccessLocation returns true for
 *     any non-internal user, so ownership MUST be checked explicitly before
 *     using the service client (which bypasses RLS).
 *
 * Shared by api-keys-actions and connections-actions (kept out of the
 * "use server" files so it can be a plain exported helper).
 */
export async function authorizeLocationManagement(
  locationId: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const internal = await getInternalContext(supabase, user.id);
  if (internal) {
    const allowed = await canAccessLocation(supabase, internal, locationId);
    return allowed
      ? { ok: true, userId: user.id }
      : { ok: false, error: "No access to this location" };
  }

  const svc = createServiceClient();
  const [{ data: profile }, { data: loc }] = await Promise.all([
    supabase.from("users").select("account_id").eq("id", user.id).maybeSingle(),
    svc.from("locations").select("account_id").eq("id", locationId).maybeSingle(),
  ]);
  if (!profile || !loc || profile.account_id !== loc.account_id) {
    return { ok: false, error: "No access to this location" };
  }
  return { ok: true, userId: user.id };
}
