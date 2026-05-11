import "server-only";
import { cookies } from "next/headers";

const COOKIE_NAME = "baam_selected_location_id";

/**
 * Read the selected-location cookie. Returns null when:
 *  - the cookie isn't set
 *  - the value is the literal "all" (aggregate view across locations)
 *
 * The cookie's value is treated as the location UUID. Caller is responsible
 * for validating it belongs to the user's account before using in a query
 * (RLS handles this for select queries, but the page should hide / fallback
 * if the cookie points to a location the user no longer has).
 */
export async function getSelectedLocationId(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(COOKIE_NAME)?.value;
  if (!v || v === "all") return null;
  return v;
}

export const SELECTED_LOCATION_COOKIE = COOKIE_NAME;
