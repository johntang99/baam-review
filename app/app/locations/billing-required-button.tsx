"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createLocationCheckoutSession,
  createLocationInvoiceSubscription,
} from "@/app/app/billing/actions";
import {
  firstLocationCents,
  formatUsd,
  type BillingInterval,
  type ReviewPlan,
} from "@/lib/billing/plans";

interface Props {
  locationId: string;
  /** Plan of the owning account — drives whether check payment is offered. */
  plan: ReviewPlan | null;
  label: string;
  className: string;
}

type PaymentMethod = "card" | "check";

/**
 * "Billing required" pill that opens a modal letting staff pick:
 *   • Billing cycle (Monthly / Annual)
 *   • Payment method (Card via Stripe / Check by invoice — Full-service only)
 *
 * Card path bounces to Stripe Checkout. Check path creates the invoice
 * subscription server-side and reloads the page so the new state shows.
 */
export function BillingRequiredButton({
  locationId,
  plan,
  label,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allowCheck = plan === "full_service";

  function submit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("location_id", locationId);
      fd.set("interval", interval);
      const here = window.location.pathname + window.location.search;
      fd.set("return_url", here);
      const res =
        method === "check"
          ? await createLocationInvoiceSubscription(fd)
          : await createLocationCheckoutSession(fd);
      if (!res.ok) {
        setError(res.error ?? "Couldn't start billing setup.");
        return;
      }
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      // Invoice path returns ok with no URL — reload so the row reflects it.
      window.location.reload();
    });
  }

  // Resolve effective plan for pricing display — fall back to full_service
  // since this dialog is most commonly used on the BAAM ops side.
  const pricingPlan: ReviewPlan = plan ?? "full_service";
  const monthlyCents = firstLocationCents(pricingPlan, "month");
  const annualPerMoCents = firstLocationCents(pricingPlan, "year");
  const annualTotalCents = annualPerMoCents * 12;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="Set up billing for this location"
        className={`${className} cursor-pointer hover:brightness-95`}
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Set up billing"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-paper shadow-2xl">
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border-base">
              <h2 className="font-display text-[19px] text-ink leading-tight">
                Set up billing
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-text-muted hover:text-ink p-1 -m-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Billing cycle */}
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">
                  Billing cycle
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      {
                        id: "month" as BillingInterval,
                        title: "Monthly",
                        price: formatUsd(monthlyCents),
                        unit: "/mo per location",
                        detail: "Billed monthly · cancel anytime",
                        badge: undefined as string | undefined,
                      },
                      {
                        id: "year" as BillingInterval,
                        title: "Annual",
                        price: formatUsd(annualPerMoCents),
                        unit: "/mo per location",
                        detail: `${formatUsd(annualTotalCents)} billed yearly · 2 months free`,
                        badge: "2 mo free" as string | undefined,
                      },
                    ]
                  ).map((c) => {
                    const selected = interval === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setInterval(c.id)}
                        aria-pressed={selected}
                        className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                          selected
                            ? "border-forest bg-forest/[0.05] shadow-sm"
                            : "border-border-base bg-paper hover:border-border-soft"
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
                          <span className="text-[13px] font-semibold text-ink">
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
                          <span className="font-display text-[22px] leading-none text-ink">
                            {c.price}
                          </span>
                          <span className="text-[11.5px] text-text-soft">
                            {c.unit}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11.5px] text-text-soft leading-snug">
                          {c.detail}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment method */}
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">
                  Payment method
                </p>
                <div className="space-y-2">
                  <PaymentOption
                    selected={method === "card"}
                    onSelect={() => setMethod("card")}
                    title="Card (via Stripe)"
                    detail="Saved at checkout · auto-charged each cycle"
                  />
                  {allowCheck && (
                    <PaymentOption
                      selected={method === "check"}
                      onSelect={() => setMethod("check")}
                      title="Check (pay by invoice)"
                      detail="Net-30 · invoice marked paid manually when check clears"
                    />
                  )}
                </div>
              </div>

              {error && (
                <p className="rounded-md bg-alert/10 px-3 py-2 text-[13px] text-alert">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={submit}
                disabled={pending}
              >
                {pending
                  ? "Opening…"
                  : method === "card"
                    ? "Continue to Stripe →"
                    : "Create invoice subscription →"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PaymentOption({
  selected,
  onSelect,
  title,
  detail,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
        selected
          ? "border-forest bg-forest/[0.05] shadow-sm"
          : "border-border-base bg-paper hover:border-border-soft"
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-forest bg-forest" : "border-border-base bg-paper"
        }`}
        aria-hidden
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-cream" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-ink leading-tight">
          {title}
        </span>
        <span className="block text-[11.5px] text-text-soft leading-snug mt-0.5">
          {detail}
        </span>
      </span>
    </button>
  );
}
