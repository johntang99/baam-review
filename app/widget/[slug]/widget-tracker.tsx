"use client";

import { useEffect } from "react";

interface WidgetTrackerProps {
  locationId: string;
  origin: string | null;
  isPreview: boolean;
}

/**
 * Mounts inside /widget/[slug] (iframe content). Fires a single view event on
 * mount, intercepts anchor clicks to log review_click / leave_own_click /
 * cta_click, and resizes the parent iframe via postMessage so the embed
 * snippet can adopt the content height.
 */
export function WidgetTracker({
  locationId,
  origin,
  isPreview,
}: WidgetTrackerProps) {
  useEffect(() => {
    // Don't pollute analytics when admin is previewing the widget.
    if (isPreview) return;

    void postEvent({ locationId, eventType: "view", origin });

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest<HTMLAnchorElement>("a[data-action]");
      if (!anchor) return;
      const action = anchor.dataset.action;
      if (
        action !== "review_click" &&
        action !== "leave_own_click" &&
        action !== "cta_click"
      )
        return;

      void postEvent({
        locationId,
        eventType: action,
        origin,
        googleReviewId: anchor.dataset.reviewId ?? null,
      });
      // Don't await — let the navigation proceed; sendBeacon-style fetch.
    }

    document.addEventListener("click", onClick);

    // Resize parent iframe to fit content. We post on a few cadences to
    // handle font/asset loading and layout settling. Without these extras
    // the iframe sometimes locks in a height before the final paint and
    // the bottom of the widget (CTA) gets clipped.
    function postSize() {
      if (window.parent === window) return;
      const h = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
      );
      window.parent.postMessage(
        { type: "baam-widget-resize", height: h },
        "*",
      );
    }
    postSize();
    const timeouts = [50, 200, 600, 1500].map((ms) =>
      window.setTimeout(postSize, ms),
    );
    window.addEventListener("load", postSize);
    const ro = new ResizeObserver(postSize);
    ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("load", postSize);
      timeouts.forEach((id) => window.clearTimeout(id));
      ro.disconnect();
    };
  }, [isPreview, locationId, origin]);

  return null;
}

async function postEvent(payload: {
  locationId: string;
  eventType: string;
  origin: string | null;
  googleReviewId?: string | null;
}): Promise<void> {
  try {
    await fetch("/api/widget/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: payload.locationId,
        event_type: payload.eventType,
        origin: payload.origin,
        google_review_id: payload.googleReviewId ?? null,
      }),
      keepalive: true,
    });
  } catch {
    // best-effort
  }
}
