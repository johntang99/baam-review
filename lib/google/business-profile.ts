import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { refreshAccessToken } from "./oauth";

const ACCOUNTS_URL =
  "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const LOCATIONS_BASE_URL =
  "https://mybusinessbusinessinformation.googleapis.com/v1";

const LOCATION_READ_MASK = [
  "name",
  "title",
  "storefrontAddress",
  "websiteUri",
  "metadata",
  "phoneNumbers",
  "categories",
].join(",");

export interface GoogleAccount {
  name: string; // "accounts/12345"
  accountName: string;
  type?: string;
  role?: string;
}

export interface GoogleLocation {
  name: string; // "locations/12345"
  title: string;
  placeId: string | null;
  formattedAddress: string | null;
  websiteUri: string | null;
  primaryCategory: string | null;
}

interface AccountsResponse {
  accounts?: Array<{
    name: string;
    accountName: string;
    type?: string;
    role?: string;
  }>;
}

interface LocationsResponse {
  locations?: Array<{
    name: string;
    title: string;
    storefrontAddress?: {
      addressLines?: string[];
      locality?: string;
      administrativeArea?: string;
      postalCode?: string;
      regionCode?: string;
    };
    websiteUri?: string;
    metadata?: { placeId?: string };
    categories?: { primaryCategory?: { displayName?: string } };
  }>;
  nextPageToken?: string;
}

/**
 * Returns a valid access token for the given user, refreshing it if it
 * expired or is within 60 seconds of expiry. Persists any refreshed token.
 *
 * Tokens are per-user (see migration 0032) because multiple staff share
 * the BAAM Operations tenant but each authorizes Google with their own
 * gmail. The picker / sync / reply path must lookup by the user that
 * connected the location, not the tenant.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const supabase = createServiceClient();

  const { data: row, error } = await supabase
    .from("google_oauth_tokens")
    .select("access_token, refresh_token, expiry")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Token lookup failed: ${error.message}`);
  if (!row) throw new Error("No Google connection for this user");

  const expiresAt = new Date(row.expiry).getTime();
  const fresh = expiresAt - Date.now() > 60_000;
  if (fresh) return row.access_token;

  const refreshed = await refreshAccessToken(row.refresh_token);

  await supabase
    .from("google_oauth_tokens")
    .update({
      access_token: refreshed.access_token,
      expiry: refreshed.expiry.toISOString(),
    })
    .eq("user_id", userId);

  return refreshed.access_token;
}

/**
 * Google's My Business APIs are well-known for transient 503/UNAVAILABLE
 * responses even when your project has plenty of quota — backend hiccups
 * are routine. Retry once after a short delay before giving up. 502/504
 * are also treated as retryable for the same reason.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 1, backoffMs = 800 }: { retries?: number; backoffMs?: number } = {},
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, init);
    const retryable = res.status === 503 || res.status === 502 || res.status === 504;
    if (res.ok || !retryable || attempt === retries) return res;
    await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
  }
  // Unreachable — the loop always returns or hits the last iteration.
  throw new Error("fetchWithRetry: exhausted");
}

export async function listGoogleAccounts(
  accessToken: string,
): Promise<GoogleAccount[]> {
  const res = await fetchWithRetry(ACCOUNTS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GBP accounts list failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as AccountsResponse;
  return (json.accounts ?? []).map((a) => ({
    name: a.name,
    accountName: a.accountName,
    type: a.type,
    role: a.role,
  }));
}

export async function listGoogleLocations(
  accessToken: string,
  accountResourceName: string,
): Promise<GoogleLocation[]> {
  const url = `${LOCATIONS_BASE_URL}/${accountResourceName}/locations?readMask=${encodeURIComponent(LOCATION_READ_MASK)}&pageSize=100`;
  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GBP locations list failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as LocationsResponse;
  return (json.locations ?? []).map((loc) => ({
    name: loc.name,
    title: loc.title,
    placeId: loc.metadata?.placeId ?? null,
    formattedAddress: formatAddress(loc.storefrontAddress),
    websiteUri: loc.websiteUri ?? null,
    primaryCategory: loc.categories?.primaryCategory?.displayName ?? null,
  }));
}

interface StorefrontAddress {
  addressLines?: string[];
  locality?: string;
  administrativeArea?: string;
  postalCode?: string;
  regionCode?: string;
}

function formatAddress(addr?: StorefrontAddress): string | null {
  if (!addr) return null;
  const cityLine = [addr.locality, addr.administrativeArea, addr.postalCode]
    .filter(Boolean)
    .join(", ");
  const lines = [...(addr.addressLines ?? []), cityLine].filter(Boolean);
  return lines.length ? lines.join(", ") : null;
}

export function googleReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}
