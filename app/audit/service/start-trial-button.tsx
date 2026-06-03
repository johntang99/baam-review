"use client";

import { useState } from "react";

interface StartTrialButtonProps {
  plan: "self" | "full";
  className?: string;
  children: React.ReactNode;
}

/**
 * Client component for "Start Self-Serve / Full Service trial" CTAs.
 * Calls the matching /api/billing/start-* endpoint, gets back the Stripe
 * Checkout URL, and redirects. Only used when the visitor is signed in —
 * logged-out flows still route through `/signup?next=...` so the user
 * authenticates first.
 */
export function StartTrialButton({
  plan,
  className,
  children,
}: StartTrialButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setPending(true);
    try {
      const endpoint =
        plan === "full"
          ? "/api/billing/start-fullservice"
          : "/api/billing/start-selfservice";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: "month" }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? `Checkout failed (${res.status})`);
      }
      window.location.assign(data.url);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not start checkout. Try again.";
      setError(msg);
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className={className}
        style={{
          border: "none",
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.7 : 1,
          font: "inherit",
        }}
      >
        {pending ? "Loading…" : children}
      </button>
      {error && (
        <div
          role="alert"
          style={{
            color: "var(--warn, #B85A38)",
            fontSize: 12.5,
            marginTop: 8,
            fontFamily: "'Onest', sans-serif",
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}
