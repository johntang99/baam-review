"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeRevenue, fmtUSD } from "@/lib/analytics/revenue";
import { saveRevenueInputs } from "./actions";

interface RevenueInputsProps {
  locationId: string;
  initial: {
    ticket: number;          // dollars
    ltv: number;             // dollars
    closeRatePct: number;    // 0-100
    attributionPct: number;  // 0-100
  };
  data: {
    bookClicks: number;
    newReviewsAtLeast4Star: number;
    profileViewLift: number | null;
  };
}

const SAVE_DEBOUNCE_MS = 800;

/**
 * Live-editing inputs + live recalc of the hero numbers and bucket footers.
 * Everything that depends on these inputs is rendered here on the client so the
 * page feels immediate. The server-rendered values seed the initial state.
 */
export function RevenueInputs({ locationId, initial, data }: RevenueInputsProps) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initial.ticket);
  const [ltv, setLtv] = useState(initial.ltv);
  const [closePct, setClosePct] = useState(initial.closeRatePct);
  const [attrPct, setAttrPct] = useState(initial.attributionPct);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startSave] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const result = useMemo(
    () =>
      computeRevenue(
        {
          ticketCents: ticket * 100,
          ltvCents: ltv * 100,
          closeRate: closePct / 100,
          attributionShare: attrPct / 100,
        },
        data,
      ),
    [ticket, ltv, closePct, attrPct, data],
  );

  useEffect(() => {
    // Skip the very first effect run — that's just hydration matching the
    // server-rendered values. Saving on hydrate would be pointless writes.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      startSave(async () => {
        const res = await saveRevenueInputs({
          locationId,
          ticketDollars: ticket,
          ltvDollars: ltv,
          closeRatePct: closePct,
          attributionSharePct: attrPct,
        });
        if (res.ok) {
          setSaveState("saved");
          router.refresh();
        } else {
          setSaveState("error");
        }
      });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [ticket, ltv, closePct, attrPct, locationId, router]);

  const refCustomersRounded = Math.round(result.referrals.customers);
  const revCustomersRounded = Math.round(result.reviews.customers);
  const totalCustomersRounded = refCustomersRounded + revCustomersRounded;

  return (
    <>
      {/* HERO — two big numbers */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_1px_1fr] gap-6 lg:gap-8 rounded-3xl bg-gradient-to-br from-forest to-forest-dark text-cream p-8 lg:p-10 shadow-lg relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-gold/15 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gold-soft font-medium mb-2">
            Revenue this period · 30d
          </p>
          <p className="font-display text-[48px] font-medium leading-none tracking-tight">
            {fmtUSD(result.periodRevenue)}
          </p>
          <div className="mt-3 flex gap-2.5 text-[13px] text-cream/75 flex-wrap">
            <span className="bg-cream/12 px-3 py-1 rounded-full text-[12px]">
              Conservative {fmtUSD(result.periodRevenueLow)}
            </span>
            <span className="bg-cream/12 px-3 py-1 rounded-full text-[12px]">
              Optimistic {fmtUSD(result.periodRevenueHigh)}
            </span>
          </div>
          <p className="mt-4 text-[13px] text-cream/85 leading-snug">
            What new customers from BAAM Review spent on their{" "}
            <b className="text-cream font-medium">first visit</b> this period.
          </p>
        </div>
        <div className="hidden lg:block bg-cream/20" />
        <div className="relative z-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gold-soft font-medium mb-2">
            Lifetime value of these customers
          </p>
          <p className="font-display text-[48px] font-medium leading-none tracking-tight text-gold-soft">
            {fmtUSD(result.totalLifetimeValue)}
          </p>
          <div className="mt-3 flex gap-2.5 text-[13px] text-cream/75 flex-wrap">
            <span className="bg-cream/12 px-3 py-1 rounded-full text-[12px]">
              {totalCustomersRounded} new customers × {fmtUSD(ltv)} LTV
            </span>
          </div>
          <p className="mt-4 text-[13px] text-cream/85 leading-snug">
            What those same customers will spend with you{" "}
            <b className="text-cream font-medium">across 12 months</b> of
            repeat visits.
          </p>
        </div>
      </section>

      {/* INPUTS PANEL */}
      <section className="rounded-2xl border border-border-base bg-paper p-6 shadow-sm">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-[18px] text-ink">Your business numbers</h2>
            <p className="text-[12.5px] text-text-soft mt-1">
              Used in both calculations. Saved per location.
            </p>
          </div>
          <span className="text-[12px] text-text-muted">{saveLabel(saveState)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DollarField
            label="Avg ticket"
            value={ticket}
            onChange={setTicket}
            hint="What a customer spends on their first visit."
          />
          <DollarField
            label="LTV per customer"
            value={ltv}
            onChange={setLtv}
            hint="12-month total revenue per customer (see below)."
          />
          <PercentField
            label="Referral close rate"
            value={closePct}
            onChange={setClosePct}
            hint="Of friends who click Book, % who actually show up. Default 50%."
          />
          <PercentField
            label="Review attribution"
            value={attrPct}
            onChange={setAttrPct}
            hint="% of GBP view-lift we credit to new reviews. Default 50%."
          />
        </div>

        {/* LTV explainer */}
        <div className="mt-5 rounded-xl bg-cream border-l-[3px] border-gold p-4 text-[12.5px] text-text-soft leading-relaxed">
          <p className="font-display text-[14px] text-ink mb-1">
            What is &ldquo;LTV per customer&rdquo;?
          </p>
          <p>
            <b className="text-ink font-medium">Lifetime value (LTV)</b> is the
            total revenue you expect to earn from one customer across{" "}
            <b className="text-ink font-medium">all the visits</b> they&apos;ll
            make over a 12-month window — not just their first visit. The
            ticket revenue above shows what BAAM Review earned you{" "}
            <em>this month</em>. LTV shows what those same customers will be
            worth across the year.
          </p>
          <p className="mt-2 font-mono text-[11.5px] bg-paper border border-border-base rounded-lg px-3 py-2 inline-block">
            Example: ${ticket || 150} ticket × ~6.5 visits/year ≈{" "}
            <b className="text-ink font-medium">
              ${Math.round((ticket || 150) * 6.5).toLocaleString()} LTV
            </b>
          </p>
        </div>
      </section>

      {/* BUCKET CARDS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Referrals (Direct) */}
        <article className="rounded-2xl border border-border-base bg-paper p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 font-display text-[17px] text-ink">
              <span className="h-9 w-9 rounded-lg bg-cream-deep flex items-center justify-center">👥</span>
              Referral revenue
            </div>
            <span className="text-[10.5px] uppercase tracking-[0.1em] font-semibold px-2.5 py-1 rounded-full bg-forest/10 text-forest">
              Direct
            </span>
          </div>

          <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-muted font-semibold">
            Data this period
          </p>
          <div className="rounded-xl bg-cream p-4 space-y-2.5">
            <DataRow label="Friends who clicked &ldquo;Book&rdquo;" value={data.bookClicks.toString()} />
            <DataRow
              label={`Estimated to convert (${closePct}% close rate)`}
              value={`≈ ${refCustomersRounded}`}
            />
          </div>

          <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-muted font-semibold">
            Calculation
          </p>
          <div className="rounded-xl bg-gradient-to-b from-forest/5 to-forest/10 p-4">
            <p className="font-mono text-[12px] text-text-soft leading-relaxed">
              <b className="text-ink font-semibold">{data.bookClicks} book clicks</b> ×{" "}
              <b className="text-ink font-semibold">{closePct}% close rate</b> ×{" "}
              <b className="text-ink font-semibold">${ticket} ticket</b>
            </p>
            <div className="mt-2.5 pt-2.5 border-t border-dashed border-forest/20 flex items-baseline gap-3">
              <span className="text-[12px] text-text-soft">Referral revenue</span>
              <span className="font-display text-[28px] text-forest-dark font-medium tracking-tight">
                {fmtUSD(result.referrals.revenue)}
              </span>
              <span className="ml-auto text-[11.5px] text-text-muted">tracked, no modeling</span>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-b from-gold/8 to-gold/14 border border-dashed border-gold/40 p-3.5 flex items-center gap-3">
            <span className="text-gold-dark text-[14px]">↳</span>
            <span className="text-[12px] text-text-soft flex-1">
              <b className="text-ink font-medium">≈ {refCustomersRounded}</b>{" "}
              new customers ×{" "}
              <b className="text-ink font-medium">{fmtUSD(ltv)}</b> LTV
            </span>
            <span className="font-display text-[22px] text-gold-dark font-medium tracking-tight">
              {fmtUSD(result.referrals.lifetimeValue)}
            </span>
          </div>
        </article>

        {/* Card 2: New review revenue (Modeled) */}
        <article className="rounded-2xl border border-border-base bg-paper p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 font-display text-[17px] text-ink">
              <span className="h-9 w-9 rounded-lg bg-cream-deep flex items-center justify-center">⭐</span>
              New review revenue
            </div>
            <span className="text-[10.5px] uppercase tracking-[0.1em] font-semibold px-2.5 py-1 rounded-full bg-gold/18 text-[#8a721d]">
              Modeled
            </span>
          </div>

          <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-muted font-semibold">
            Data this period
          </p>
          <div className="rounded-xl bg-cream p-4 space-y-2.5">
            <DataRow label="New 4★+ reviews" value={data.newReviewsAtLeast4Star.toString()} />
            <DataRow
              label={
                result.viewLiftIsTracked
                  ? "GBP profile-view lift (vs prior period)"
                  : "Estimated profile-view lift (40/review)"
              }
              value={`+${Math.round(result.resolvedViewLift).toLocaleString()}`}
            />
            <DataRow
              label={`Attributed to new reviews (${attrPct}%)`}
              value={`${Math.round(result.attributedViews).toLocaleString()} views`}
            />
          </div>

          <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-muted font-semibold">
            Calculation
          </p>
          <div className="rounded-xl bg-gradient-to-b from-forest/5 to-forest/10 p-4">
            <p className="font-mono text-[12px] text-text-soft leading-relaxed">
              <b className="text-ink font-semibold">
                {Math.round(result.attributedViews).toLocaleString()} attributed views
              </b>{" "}
              × <b className="text-ink font-semibold">1% profile→booking</b> ×{" "}
              <b className="text-ink font-semibold">${ticket} ticket</b>
            </p>
            <div className="mt-2.5 pt-2.5 border-t border-dashed border-forest/20 flex items-baseline gap-3">
              <span className="text-[12px] text-text-soft">New review revenue</span>
              <span className="font-display text-[28px] text-forest-dark font-medium tracking-tight">
                {fmtUSD(result.reviews.revenue)}
              </span>
              <span className="ml-auto text-[11.5px] text-text-muted">
                {fmtUSD(result.reviews.revenueLow)} – {fmtUSD(result.reviews.revenueHigh)}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-b from-gold/8 to-gold/14 border border-dashed border-gold/40 p-3.5 flex items-center gap-3">
            <span className="text-gold-dark text-[14px]">↳</span>
            <span className="text-[12px] text-text-soft flex-1">
              <b className="text-ink font-medium">≈ {revCustomersRounded}</b>{" "}
              new customers ×{" "}
              <b className="text-ink font-medium">{fmtUSD(ltv)}</b> LTV
            </span>
            <span className="font-display text-[22px] text-gold-dark font-medium tracking-tight">
              {fmtUSD(result.reviews.lifetimeValue)}
            </span>
          </div>
        </article>
      </section>

      {/* Assumptions */}
      <details className="rounded-2xl border border-border-base bg-cream p-6" open>
        <summary className="cursor-pointer list-none flex items-center justify-between font-display text-[16px] font-medium text-ink">
          <span>Show assumptions behind the numbers</span>
          <span className="text-text-muted text-[12px]">▾</span>
        </summary>
        <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-7 gap-y-3 text-[12.5px] text-text-soft leading-relaxed list-none">
          <li>
            <b className="text-ink font-medium">Avg ticket</b> — your input.
            Drives &ldquo;Revenue this period&rdquo;.
          </li>
          <li>
            <b className="text-ink font-medium">LTV per customer</b> — your
            input. Drives &ldquo;Lifetime value&rdquo;. Equals avg ticket ×
            visits/year over a 12-month window.
          </li>
          <li>
            <b className="text-ink font-medium">Close rate</b> — your input.
            Not every friend who clicks Book converts; 50% is a conservative
            default.
          </li>
          <li>
            <b className="text-ink font-medium">Profile-view → booking</b> —
            fixed at 1%. BrightLocal 2024 shows 1–3% for local services; we use
            the floor.
          </li>
          <li>
            <b className="text-ink font-medium">Review attribution share</b> —
            your input. View lift comes from many things; we credit half to new
            reviews by default.
          </li>
          <li>
            <b className="text-ink font-medium">Profile views</b> —{" "}
            {result.viewLiftIsTracked
              ? "pulled from Google Business Profile Performance API, period-over-period."
              : "GBP Performance API not yet connected. Using 40 estimated views per new 4★+ review (BrightLocal median) as a placeholder."}
          </li>
          <li>
            <b className="text-ink font-medium">Conservative / optimistic</b> —
            ±35% range, applied only to the modeled (review) bucket.
          </li>
          <li>
            <b className="text-ink font-medium">What we don&apos;t count</b> —
            ranking lift, brand equity, widget impressions. Too speculative to
            defend.
          </li>
        </ul>
      </details>
    </>
  );
}

function DollarField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint: string;
}) {
  return (
    <div>
      <label className="block text-[11.5px] font-medium text-text-soft uppercase tracking-[0.08em] mb-1.5">
        {label}
      </label>
      <div className="relative border border-border-base rounded-lg bg-cream focus-within:border-forest focus-within:bg-paper">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-[15px] text-text-muted pointer-events-none">
          $
        </span>
        <input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full bg-transparent border-none font-display text-[22px] font-medium text-ink py-3 pl-7 pr-4 outline-none"
        />
      </div>
      <p className="mt-1.5 text-[11.5px] text-text-muted leading-snug">{hint}</p>
    </div>
  );
}

function PercentField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint: string;
}) {
  return (
    <div>
      <label className="block text-[11.5px] font-medium text-text-soft uppercase tracking-[0.08em] mb-1.5">
        {label}
      </label>
      <div className="relative border border-border-base rounded-lg bg-cream focus-within:border-forest focus-within:bg-paper">
        <input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full bg-transparent border-none font-display text-[22px] font-medium text-ink py-3 pl-4 pr-9 outline-none"
        />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-text-muted pointer-events-none">
          %
        </span>
      </div>
      <p className="mt-1.5 text-[11.5px] text-text-muted leading-snug">{hint}</p>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline text-[13px] text-text-soft">
      <span dangerouslySetInnerHTML={{ __html: label }} />
      <b className="text-ink font-medium font-display text-[15px]">{value}</b>
    </div>
  );
}

function saveLabel(s: "idle" | "saving" | "saved" | "error"): string {
  if (s === "saving") return "Saving…";
  if (s === "saved") return "✓ Saved";
  if (s === "error") return "Save failed";
  return "";
}
