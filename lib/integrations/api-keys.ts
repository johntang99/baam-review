import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Per-location API keys for the universal intake endpoint
 * (POST /api/integrations/review-request). A key is bound to one location.
 *
 * Storage: only the SHA-256 hash is persisted; the plaintext is returned once
 * at creation and never again. Management and verification both run with the
 * service-role client (the table is RLS-locked); callers must do their own
 * authorization (see assignments/actions.ts for the management pattern).
 */

const KEY_PREFIX = "brk_"; // BAAM Review Key

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface CreatedApiKey {
  id: string;
  /** Plaintext key — shown ONCE. Not recoverable later. */
  key: string;
  prefix: string;
}

/** Generate + store a new key for a location. Returns the plaintext once. */
export async function createApiKey(
  locationId: string,
  opts?: { name?: string; createdByUserId?: string | null },
): Promise<CreatedApiKey> {
  const raw = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  const prefix = raw.slice(0, 12); // e.g. "brk_AbC1234"
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("location_api_keys")
    .insert({
      location_id: locationId,
      name: opts?.name?.trim() || "Integration key",
      key_prefix: prefix,
      key_hash: hashKey(raw),
      created_by: opts?.createdByUserId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`createApiKey failed: ${error?.message ?? "no row"}`);
  }
  return { id: data.id, key: raw, prefix };
}

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

/** List a location's keys (no secrets — prefix + metadata only). */
export async function listApiKeys(locationId: string): Promise<ApiKeyRow[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("location_api_keys")
    .select("id, name, key_prefix, last_used_at, created_at, revoked_at")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Revoke a key (soft — keeps the audit row). Scoped to the location. */
export async function revokeApiKey(
  locationId: string,
  keyId: string,
): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from("location_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("location_id", locationId)
    .is("revoked_at", null);
}

/**
 * Verify a presented key. Returns the bound location id, or null if the key is
 * unknown/revoked. Updates last_used_at best-effort. Constant-ish work: we look
 * up by hash (indexed), no plaintext comparison.
 */
export async function verifyApiKey(
  raw: string | null | undefined,
): Promise<{ locationId: string; keyId: string } | null> {
  if (!raw || !raw.startsWith(KEY_PREFIX)) return null;
  const svc = createServiceClient();
  const { data } = await svc
    .from("location_api_keys")
    .select("id, location_id, revoked_at")
    .eq("key_hash", hashKey(raw))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  // Best-effort usage stamp; don't block the request on it.
  void svc
    .from("location_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});
  return { locationId: data.location_id, keyId: data.id };
}
