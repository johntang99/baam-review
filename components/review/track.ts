"use client";

import type { Database } from "@/lib/database.types";

type EventType = Database["public"]["Tables"]["landing_events"]["Insert"]["event_type"];

export interface TrackContext {
  locationId: string;
  requestId: string | null;
  language: string;
}

export function track(
  ctx: TrackContext,
  event_type: EventType,
  metadata?: Record<string, unknown>,
) {
  const body = JSON.stringify({
    location_id: ctx.locationId,
    request_id: ctx.requestId,
    event_type,
    language: ctx.language,
    metadata: metadata ?? {},
  });

  // Prefer fetch with keepalive so events survive page navigation.
  // Fall back to sendBeacon, which can't set Content-Type properly but works on bfcache.
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* swallow — analytics is best-effort */
    });
  } catch {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/track",
        new Blob([body], { type: "application/json" }),
      );
    }
  }
}
