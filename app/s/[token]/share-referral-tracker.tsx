"use client";

import { useEffect } from "react";

interface ShareReferralTrackerProps {
  locationId: string;
  advocateRequestId: string;
}

/**
 * Listens for clicks on anchors tagged with data-referral-event and posts a
 * referrals row to /api/referrals/track before the browser navigates away.
 * The page itself (server side) handles the share_view insert on render.
 */
export function ShareReferralTracker({
  locationId,
  advocateRequestId,
}: ShareReferralTrackerProps) {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>("[data-referral-event]");
      if (!el) return;
      const eventType = el.dataset.referralEvent;
      if (!eventType) return;

      try {
        const payload = JSON.stringify({
          location_id: locationId,
          advocate_request_id: advocateRequestId,
          event_type: eventType,
        });
        const blob = new Blob([payload], { type: "application/json" });
        // sendBeacon survives navigation; falls back to keepalive fetch.
        if (
          typeof navigator !== "undefined" &&
          typeof navigator.sendBeacon === "function" &&
          navigator.sendBeacon("/api/referrals/track", blob)
        ) {
          return;
        }
        void fetch("/api/referrals/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      } catch {
        // best-effort
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [advocateRequestId, locationId]);

  return null;
}
