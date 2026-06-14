import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/database.types";

/**
 * Per-location native-connector connections (Phase 4b). Stores the credentials
 * a fetch-based provider needs to call the vendor's API (e.g. Acuity's User ID
 * + API Key). Service-role only; callers authorize per-location themselves.
 */
export interface ProviderConnection {
  provider: string;
  credentials: Record<string, unknown>;
  status: string;
}

export async function getConnection(
  locationId: string,
  provider: string,
): Promise<ProviderConnection | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("location_integrations")
    .select("provider, credentials, status")
    .eq("location_id", locationId)
    .eq("provider", provider)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  return {
    provider: data.provider,
    credentials: (data.credentials as Record<string, unknown>) ?? {},
    status: data.status,
  };
}

export async function upsertConnection(
  locationId: string,
  provider: string,
  credentials: Record<string, unknown>,
  createdByUserId?: string | null,
): Promise<void> {
  const svc = createServiceClient();
  await svc.from("location_integrations").upsert(
    {
      location_id: locationId,
      provider,
      credentials: credentials as Json,
      status: "active",
      created_by: createdByUserId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "location_id,provider" },
  );
}

export async function deleteConnection(
  locationId: string,
  provider: string,
): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from("location_integrations")
    .delete()
    .eq("location_id", locationId)
    .eq("provider", provider);
}

/** Which native connectors are connected (no secrets — provider names only). */
export async function listConnectedProviders(
  locationId: string,
): Promise<string[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("location_integrations")
    .select("provider")
    .eq("location_id", locationId)
    .eq("status", "active");
  return (data ?? []).map((r) => r.provider);
}
