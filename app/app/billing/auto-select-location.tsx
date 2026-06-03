"use client";

import { useEffect, useRef } from "react";

/**
 * Fire-once client widget that runs after a successful checkout: POSTs the
 * just-paid location_id to /api/select-location (which sets the cookie the
 * sidebar reads), then strips the session_id query param and reloads so
 * the sidebar — rendered in the parent layout — picks up the new selection.
 *
 * Idempotent against StrictMode re-runs via the ran ref. Silent on failure
 * — the user can still pick the location manually from the dropdown.
 */
export function AutoSelectLocation({ locationId }: { locationId: string }) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        await fetch("/api/select-location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: locationId }),
        });
      } catch {
        // Non-fatal — fall through to reload so the user at least sees the
        // billing page without the lingering session_id in the URL.
      }
      // Replace (not push) so back-button doesn't re-trigger the success
      // banner; strip session_id but keep ?status=success.
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      window.location.replace(url.toString());
    })();
  }, [locationId]);

  return null;
}
