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
    <div
      className="inline-flex rounded-lg border-2 border-border-base bg-cream p-0.5 text-[12.5px]"
      role="radiogroup"
      aria-label="Billing interval"
    >
      {(["month", "year"] as const).map((i) => {
        const selected = value === i;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(i)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-semibold transition-all ${
              selected
                ? "bg-forest text-cream shadow-sm"
                : "text-text-soft hover:text-ink hover:bg-paper"
            }`}
          >
            {selected && (
              <span
                aria-hidden
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cream/95"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-forest" />
              </span>
            )}
            {i === "month" ? "Monthly" : "Annual"}
            {i === "year" && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  selected
                    ? "bg-cream/20 text-cream"
                    : "bg-gold/20 text-gold-dark"
                }`}
              >
                2 mo free
              </span>
            )}
          </button>
        );
      })}
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
      {/* Invoice/check payment is internal-only — BAAM staff sets these
          up via Stripe Dashboard or a dedicated admin route, not from
          the customer's billing page. The createLocationInvoiceSubscription
          server action still exists for that path. */}
      {error && (
        <p className="w-full text-[12px] text-red-600">{error}</p>
      )}
    </div>
  );
}

/**
 * Full Service trial launcher — shown to signed-in customers whose account
 * is review_plan=full_service but has no Stripe customer yet. Lets the
 * customer pick Monthly vs Annual BEFORE Stripe Checkout opens, then POSTs
 * to /api/billing/start-fullservice with the chosen interval. The endpoint
 * pre-fills customer_email and tags the session with account_id so the
 * webhook can link the resulting customer_records row to this account.
 */
export function StartFullServiceTrialButton({
  defaultInterval = "month",
}: {
  defaultInterval?: BillingInterval;
}) {
  const [interval, setInterval] =
    useState<BillingInterval>(defaultInterval);
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

  // Per-location Full Service prices in cents. Annual is the per-month
  // equivalent (annual price ÷ 12) — same framing as Stripe Pricing tables.
  const monthlyCents = firstLocationCents("full_service", "month");
  const annualPerMoCents = firstLocationCents("full_service", "year");
  const annualTotalCents = annualPerMoCents * 12;
  // "2 months free" framing: monthly × 12 vs annual total.
  const savings = monthlyCents * 12 - annualTotalCents;
  const savingsPct = Math.round((savings / (monthlyCents * 12)) * 100);

  const cards: Array<{
    id: BillingInterval;
    title: string;
    pricePrimary: string;
    priceUnit: string;
    detail: string;
    badge?: string;
  }> = [
    {
      id: "month",
      title: "Monthly",
      pricePrimary: formatUsd(monthlyCents),
      priceUnit: "/mo per location",
      detail: "Billed monthly · cancel anytime",
    },
    {
      id: "year",
      title: "Annual",
      pricePrimary: formatUsd(annualPerMoCents),
      priceUnit: "/mo per location",
      detail: `${formatUsd(annualTotalCents)} billed yearly · 2 months free`,
      badge: savingsPct > 0 ? `Save ${savingsPct}%` : undefined,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">
          Billing cycle
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          {cards.map((c) => {
            const selected = interval === c.id;
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => setInterval(c.id)}
                aria-pressed={selected}
                className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                  selected
                    ? "border-forest bg-forest/[0.05] shadow-sm"
                    : "border-border-base bg-paper hover:border-border-soft hover:bg-cream-deep/30"
                }`}
              >
                {c.badge && (
                  <span
                    className={`absolute -top-2 right-3 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                      selected
                        ? "bg-forest text-cream"
                        : "bg-gold text-ink"
                    }`}
                  >
                    {c.badge}
                  </span>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[13px] font-semibold ${
                      selected ? "text-ink" : "text-text"
                    }`}
                  >
                    {c.title}
                  </span>
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                      selected
                        ? "border-forest bg-forest"
                        : "border-border-base bg-paper"
                    }`}
                    aria-hidden
                  >
                    {selected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-cream" />
                    )}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-[26px] leading-none text-ink">
                    {c.pricePrimary}
                  </span>
                  <span className="text-[12px] text-text-soft">
                    {c.priceUnit}
                  </span>
                </div>
                <p className="mt-2 text-[12px] text-text-soft leading-snug">
                  {c.detail}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={start}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-5 py-3 text-[14px] font-medium text-cream hover:bg-forest-dark disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {pending
            ? "Opening Stripe…"
            : `Start ${interval === "month" ? "monthly" : "annual"} trial →`}
        </button>
        {error && <p className="mt-2 text-[12px] text-alert">{error}</p>}
        <p className="mt-2 text-[11.5px] text-text-muted">
          30-day free trial · card saved at checkout · not charged until day 31
        </p>
      </div>
    </div>
  );
}
