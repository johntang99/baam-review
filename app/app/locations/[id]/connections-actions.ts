"use server";

import { revalidatePath } from "next/cache";
import { authorizeLocationManagement } from "@/lib/integrations/location-access";
import { upsertConnection, deleteConnection } from "@/lib/integrations/connections";

/** Connect Acuity via the client's User ID + API Key (Account → Integrations →
 *  API in Acuity). Stored per location; used to resolve appointment contacts. */
export async function connectAcuityAction(
  locationId: string,
  userId: string,
  apiKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await authorizeLocationManagement(locationId);
  if (!authz.ok) return { ok: false, error: authz.error };

  const uid = userId.trim();
  const key = apiKey.trim();
  if (!uid || !key) return { ok: false, error: "Enter both User ID and API Key." };

  await upsertConnection(
    locationId,
    "acuity",
    { userId: uid, apiKey: key },
    authz.userId,
  );
  revalidatePath(`/app/locations/${locationId}`);
  return { ok: true };
}

export async function disconnectProviderAction(
  locationId: string,
  provider: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await authorizeLocationManagement(locationId);
  if (!authz.ok) return { ok: false, error: authz.error };

  await deleteConnection(locationId, provider);
  revalidatePath(`/app/locations/${locationId}`);
  return { ok: true };
}
