"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  firstLocationCents,
  additionalLocationCents,
  formatUsd,
  type BillingInterval,
  type ReviewPlan,
} from "@/lib/billing/plans";
import {
  setSelfServiceAccount,
  setFullServiceAccount,
  createLocationCheckoutSession,
  createLocationInvoiceSubscription,
  createLocationPortalSession,
  type ActionResult,
} from "./actions";

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<ActionResult>, onOk?: () => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok && r.url) window.location.assign(r.url);
      else if (r.ok) (onOk ?? (() => window.location.reload()))();
      else setError(r.error ?? "Something went wrong.");
    });
  }
  return { pending, error, run };
}

function IntervalToggle({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border-base bg-cream p-1 text-[12.5px]">
      {(["month", "year"] as const).map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`rounded-md px-3 py-1.5 font-medium ${
            value === i ? "bg-white text-ink shadow-sm" : "text-text-soft"
          }`}
        >
          {i === "month" ? "Monthly" : "Annual (2 mo free)"}
        </button>
      ))}
    </div>
  );
}

const btn =
  "rounded-lg bg-forest px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-forest-dark disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-border-base bg-white px-4 py-2 text-[13px] font-medium text-ink hover:border-forest disabled:opacity-50";

/** No plan chosen yet → pick Self-service or Full-service. Neither creates
 *  a Stripe subscription; both just designate the plan. Locations are
 *  subscribed individually after. */
export function PlanChooser() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const { pending, error, run } = useRun();
  const suffix = interval === "year" ? "/yr" : "/mo";
  return (
    <div className="space-y-5">
      <IntervalToggle value={interval} onChange={setInterval} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border-base bg-white p-5">
          <div className="font-display text-[18px] text-ink">Self-service</div>
          <p className="mt-1 text-[13px] text-text-soft">
            You run it. First location{" "}
            {formatUsd(firstLocationCents("self_service", interval))}
            {suffix} · each additional{" "}
            {formatUsd(additionalLocationCents("self_service", interval))}
            {suffix} · 30-day free trial (card required).
          </p>
          <button
            disabled={pending}
            onClick={() => run(() => setSelfServiceAccount())}
            className={`mt-4 w-full ${btn}`}
          >
            {pending ? "…" : "Use Self-service →"}
          </button>
        </div>
        <div className="rounded-xl border border-border-base bg-white p-5">
          <div className="font-display text-[18px] text-ink">Full-service</div>
          <p className="mt-1 text-[13px] text-text-soft">
            We run it for your clients. Each business is its own{" "}
            {formatUsd(firstLocationCents("full_service", "month"))}/mo
            subscription · 30-day free trial (card or pay-by-check).
          </p>
          <button
            disabled={pending}
            onClick={() => run(() => setFullServiceAccount())}
            className={`mt-4 w-full ${btnGhost}`}
          >
            {pending ? "…" : "Use Full-service →"}
          </button>
        </div>
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

/** Per-location billing controls. */
export function LocationActions({
  locationId,
  accountPlan,
  hasSub,
}: {
  locationId: string;
  accountPlan: ReviewPlan;
  hasSub: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [discountCode, setDiscountCode] = useState("");
  const { pending, error, run } = useRun();

  if (hasSub) {
    return (
      <div>
        <button
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("location_id", locationId);
            run(() => createLocationPortalSession(fd));
          }}
          className={btnGhost}
        >
          {pending ? "Opening…" : "Manage"}
        </button>
        {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
      </div>
    );
  }

  const fd = () => {
    const f = new FormData();
    f.set("location_id", locationId);
    f.set("interval", interval);
    if (accountPlan === "full_service" && discountCode.trim())
      f.set("discount_code", discountCode.trim());
    return f;
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <IntervalToggle value={interval} onChange={setInterval} />
      {accountPlan === "full_service" && (
        <input
          type="text"
          value={discountCode}
          onChange={(e) => setDiscountCode(e.target.value)}
          placeholder="Discount code (optional)"
          className="h-9 w-[180px] rounded-lg border border-border-base bg-white px-3 text-[13px] text-ink placeholder:text-text-muted focus:border-forest focus:outline-none"
        />
      )}
      <button
        disabled={pending}
        onClick={() => run(() => createLocationCheckoutSession(fd()))}
        className={btn}
      >
        {pending ? "…" : "Set up billing (card)"}
      </button>
      {accountPlan === "full_service" && (
        <button
          disabled={pending}
          onClick={() =>
            run(() => createLocationInvoiceSubscription(fd()))
          }
          className={btnGhost}
        >
          {pending ? "…" : "By invoice (check)"}
        </button>
      )}
      {error && (
        <p className="w-full text-[12px] text-red-600">{error}</p>
      )}
    </div>
  );
}

/**
 * Full Service trial launcher — shown to signed-in customers whose account
 * is review_plan=full_service but has no Stripe customer yet. POSTs to
 * /api/billing/start-fullservice which creates a Checkout session with the
 * user's email pre-filled and the account_id tagged in metadata so the
 * webhook can link the resulting customer_records row to this account.
 */
export function StartFullServiceTrialButton({
  interval = "month",
}: {
  interval?: "month" | "year";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/billing/start-fullservice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout.");
      }
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2.5 text-[13.5px] font-medium text-cream hover:bg-forest-dark disabled:opacity-50"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {pending ? "Opening Stripe…" : "Start Full Service trial →"}
      </button>
      {error && <p className="text-[12px] text-alert">{error}</p>}
    </div>
  );
}
