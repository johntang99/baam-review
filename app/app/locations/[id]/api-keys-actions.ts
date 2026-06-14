"use server";

import { revalidatePath } from "next/cache";
import { authorizeLocationManagement } from "@/lib/integrations/location-access";
import {
  createApiKey,
  revokeApiKey,
  setApiKeyDailyLimit,
  type CreatedApiKey,
} from "@/lib/integrations/api-keys";

const authorize = authorizeLocationManagement;

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
