"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInternalContext } from "@/lib/auth/staff";

interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Guard: only internal users with a role of admin or sales may add or
 * remove account managers on a location. Returns ops context on success.
 * Account managers never modify assignments themselves.
 */
async function requireAssigner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/locations");
  const ctx = await getInternalContext(supabase, user.id);
  if (!ctx) {
    throw new Error("Only BAAM internal staff may change assignments");
  }
  if (ctx.opsRole !== "admin" && ctx.opsRole !== "sales") {
    throw new Error(
      "Only admins or sales may add account managers to a location",
    );
  }
  return { supabase, ctx };
}

/**
 * Authorize the current user to operate on the given location:
 *   • admin           — any location
 *   • sales           — only locations they personally connected
 *   • account_manager — never (filtered by requireAssigner above)
 */
async function authorizeOnLocation(
  service: ReturnType<typeof createServiceClient>,
  ctx: { userId: string; opsRole: string | null },
  locationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (ctx.opsRole === "admin") return { ok: true };

  const { data: loc } = await service
    .from("locations")
    .select("id, connected_by_user_id")
    .eq("id", locationId)
    .maybeSingle();
  if (!loc) return { ok: false, error: "Location not found" };
  if (loc.connected_by_user_id !== ctx.userId) {
    return {
      ok: false,
      error: "You can only assign managers to clients you connected",
    };
  }
  return { ok: true };
}

/**
 * Add an account-manager user to a location. Idempotent: re-adding the
 * same manager returns ok without creating a duplicate row (the UNIQUE
 * constraint on (location_id, user_id) handles the race).
 */
export async function assignManager(
  formData: FormData,
): Promise<ActionResult> {
  const { ctx } = await requireAssigner();

  const locationId = formData.get("location_id");
  const managerUserId = formData.get("manager_user_id");
  if (typeof locationId !== "string" || !locationId) {
    return { ok: false, error: "Missing location_id" };
  }
  if (typeof managerUserId !== "string" || !managerUserId) {
    return { ok: false, error: "Missing manager_user_id" };
  }

  const service = createServiceClient();

  const authz = await authorizeOnLocation(service, ctx, locationId);
  if (!authz.ok) return { ok: false, error: authz.error };

  // Verify the target is actually an account_manager (not a sales / admin
  // / customer). Prevents accidental assignments to the wrong role.
  const { data: target } = await service
    .from("users")
    .select("id, ops_role")
    .eq("id", managerUserId)
    .maybeSingle();
  if (!target) {
    return { ok: false, error: "Manager not found" };
  }
  if (target.ops_role !== "account_manager") {
    return {
      ok: false,
      error: "Selected user is not an account manager",
    };
  }

  const { error } = await service.from("location_assignments").insert({
    location_id: locationId,
    user_id: managerUserId,
    assigned_by_user_id: ctx.userId,
  });
  // 23505 = unique_violation. Already assigned — treat as success.
  if (error && error.code !== "23505") {
    return { ok: false, error: `Assign failed: ${error.message}` };
  }

  revalidatePath("/app/locations");
  return { ok: true };
}

/**
 * Remove an account-manager from a location. Authorization mirrors
 * assignManager: admin can remove anyone; sales can only act on their
 * own connected locations.
 */
export async function unassignManager(
  formData: FormData,
): Promise<ActionResult> {
  const { ctx } = await requireAssigner();

  const locationId = formData.get("location_id");
  const managerUserId = formData.get("manager_user_id");
  if (typeof locationId !== "string" || !locationId) {
    return { ok: false, error: "Missing location_id" };
  }
  if (typeof managerUserId !== "string" || !managerUserId) {
    return { ok: false, error: "Missing manager_user_id" };
  }

  const service = createServiceClient();

  const authz = await authorizeOnLocation(service, ctx, locationId);
  if (!authz.ok) return { ok: false, error: authz.error };

  const { error } = await service
    .from("location_assignments")
    .delete()
    .eq("location_id", locationId)
    .eq("user_id", managerUserId);
  if (error) {
    return { ok: false, error: `Remove failed: ${error.message}` };
  }

  revalidatePath("/app/locations");
  return { ok: true };
}
