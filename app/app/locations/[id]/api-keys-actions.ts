"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInternalContext, canAccessLocation } from "@/lib/auth/staff";
import {
  createApiKey,
  revokeApiKey,
  setApiKeyDailyLimit,
  type CreatedApiKey,
} from "@/lib/integrations/api-keys";

/**
 * Authorize the current user to manage API keys for a location.
 *   • Internal staff → via canAccessLocation (admin any; sales connected/
 *     assigned; account_manager assigned).
 *   • Customer → only their OWN location (account match). canAccessLocation
 *     returns true for any non-internal user, so we MUST check ownership
 *     explicitly here before using the service client (which bypasses RLS).
 */
async function authorize(
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

  // Customer: the location must belong to their account.
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

export async function createKeyAction(
  locationId: string,
  name: string,
): Promise<
  { ok: true; created: CreatedApiKey } | { ok: false; error: string }
> {
  const authz = await authorize(locationId);
  if (!authz.ok) return { ok: false, error: authz.error };

  const created = await createApiKey(locationId, {
    name,
    createdByUserId: authz.userId,
  });
  revalidatePath(`/app/locations/${locationId}`);
  return { ok: true, created };
}

export async function revokeKeyAction(
  locationId: string,
  keyId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await authorize(locationId);
  if (!authz.ok) return { ok: false, error: authz.error };

  await revokeApiKey(locationId, keyId);
  revalidatePath(`/app/locations/${locationId}`);
  return { ok: true };
}

export async function updateKeyLimitAction(
  locationId: string,
  keyId: string,
  dailyLimit: number,
): Promise<{ ok: true; dailyLimit: number } | { ok: false; error: string }> {
  const authz = await authorize(locationId);
  if (!authz.ok) return { ok: false, error: authz.error };

  // Clamp to a sane range (1 … 1,000,000/day).
  const clamped = Math.max(1, Math.min(1_000_000, Math.round(dailyLimit)));
  if (!Number.isFinite(clamped)) {
    return { ok: false, error: "Invalid daily limit" };
  }
  await setApiKeyDailyLimit(locationId, keyId, clamped);
  revalidatePath(`/app/locations/${locationId}`);
  return { ok: true, dailyLimit: clamped };
}
