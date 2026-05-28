"use client";

import { useState, useTransition } from "react";
import { createLocationCheckoutSession } from "@/app/app/billing/actions";

interface Props {
  locationId: string;
  label: string;
  className: string;
}

/**
 * Inline button that turns the "Billing required" pill in the Locations
 * table into a one-click path to Stripe Checkout for THIS specific
 * location. The full /app/billing page still works as an alternative
 * (this is just the shortcut for the most common action).
 *
 * On click → calls the existing createLocationCheckoutSession server
 * action → receives a hosted Checkout URL → navigates the tab there.
 * Errors render inline as a small red tooltip-style note below.
 */
export function BillingRequiredButton({ locationId, label, className }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("location_id", locationId);
      // Tell the action where to send Stripe's success/cancel redirects.
      // Without this, both routes default to /app/billing — which is
      // wrong for staff who started the flow from /app/locations.
      const here = window.location.pathname + window.location.search;
      fd.set("return_url", here);
      const res = await createLocationCheckoutSession(fd);
      if (!res.ok || !res.url) {
        setError(res.error ?? "Couldn't start billing setup.");
        return;
      }
      // Hand off to Stripe Checkout. Use top-level assignment (not
      // router.push) — Stripe is on a different origin.
      window.location.href = res.url;
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title="Set up billing for this location"
        className={`${className} cursor-pointer hover:brightness-95 disabled:opacity-50`}
      >
        {pending ? "Opening…" : label}
      </button>
      {error && (
        <span className="text-[10.5px] text-alert max-w-[180px]">{error}</span>
      )}
    </div>
  );
}
