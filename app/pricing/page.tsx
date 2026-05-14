import Link from "next/link";
import type { Metadata } from "next";
import { Check, Star } from "lucide-react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { RoiCalculator } from "@/components/marketing/roi-calculator";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing — BAAM Review",
  description:
    "Self-serve. Transparent. No sales calls. Start free, upgrade when reviews start working for you. From $49/month, with founding-customer pricing for the first 50 signups.",
};

const FOUNDING_OPEN = process.env.FOUNDING_50_OPEN === "true";
const FOUNDING_SPOTS_LEFT = parseInt(
  process.env.FOUNDING_50_SPOTS_LEFT ?? "50",
  10,
);

interface CompareRow {
  feature: string;
  baam: string;
  birdeye: string;
  podium: string;
  nicejob: string;
  baamCheck?: boolean;
}

const COMPARE: CompareRow[] = [
  {
    feature: "Starting price",
    baam: "$49 / mo",
    birdeye: "$299–599 / mo",
    podium: "$399+ / mo",
    nicejob: "$125 / mo",
  },
  {
    feature: "Setup fees",
    baam: "None",
    baamCheck: true,
    birdeye: "$500–1,500",
    podium: "$500+",
    nicejob: "None",
  },
  {
    feature: "Self-serve signup, no sales call",
    baam: "Yes",
    baamCheck: true,
    birdeye: "—",
    podium: "—",
    nicejob: "Yes",
  },
  {
    feature: "AI-assisted writing for the customer",
    baam: "Yes",
    baamCheck: true,
    birdeye: "—",
    podium: "—",
    nicejob: "—",
  },
  {
    feature: "English / Chinese / Spanish first-class",
    baam: "All three",
    baamCheck: true,
    birdeye: "EN only",
    podium: "EN + basic ES",
    nicejob: "EN only",
  },
  {
    feature: "Website review widget with schema markup",
    baam: "Yes",
    baamCheck: true,
    birdeye: "Basic widget",
    podium: "Basic",
    nicejob: "Basic",
  },
  {
    feature: "AI Reply Assistant (multilingual)",
    baam: "Yes",
    baamCheck: true,
    birdeye: "EN only",
    podium: "EN only",
    nicejob: "—",
  },
  {
    feature: "Xiaohongshu auto-distribution",
    baam: "Yes",
    baamCheck: true,
    birdeye: "—",
    podium: "—",
    nicejob: "—",
  },
  {
    feature: "Share-with-a-Friend referral links",
    baam: "Yes",
    baamCheck: true,
    birdeye: "—",
    podium: "—",
    nicejob: "—",
  },
  {
    feature: "Revenue attribution dashboard",
    baam: "Yes",
    baamCheck: true,
    birdeye: "Custom",
    podium: "—",
    nicejob: "—",
  },
  {
    feature: "Staff Mode (front-desk mobile app)",
    baam: "Yes",
    baamCheck: true,
    birdeye: "—",
    podium: "—",
    nicejob: "—",
  },
  {
    feature: "Compliance-safe (no review gating)",
    baam: "Yes",
    baamCheck: true,
    birdeye: "Configurable",
    podium: "Configurable",
    nicejob: "Yes",
  },
];

export default function PricingPage() {
  return (
    <>
      <MarketingNav />

      {/* ============ PAGE HEADER ============ */}
      <section className="px-6 pt-16 pb-12 sm:pt-20">
        <div className="mx-auto max-w-[1100px] text-center">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-text-muted">
            Pricing
          </p>
          <h1 className="mx-auto max-w-[820px] font-display text-[44px] font-normal leading-[1.02] tracking-[-0.03em] text-ink sm:text-[60px]">
            Self-serve. Transparent.{" "}
            <em className="italic text-forest">No sales calls.</em>
          </h1>
          <p className="mx-auto mt-6 max-w-[620px] font-serif text-[19px] leading-relaxed text-text-soft">
            Start free. Upgrade when reviews start working for you. Cancel
            anytime in one click. Save 20% with annual billing.
          </p>

          {FOUNDING_OPEN && (
            <div className="relative mx-auto mt-10 max-w-[820px] overflow-hidden rounded-2xl bg-gradient-to-br from-ink to-[#1B2E27] p-7 text-cream">
              <div className="pointer-events-none absolute right-[-10%] top-[-30%] h-[280px] w-[280px] rounded-full bg-gold/[0.16] blur-3xl" />
              <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8 sm:text-left">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gold/20 text-gold">
                  <Star className="h-6 w-6 fill-gold" />
                </span>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-display text-[19px] font-medium leading-snug tracking-[-0.01em] text-cream sm:text-[22px]">
                    First 50{" "}
                    <em className="italic text-gold">founding customers</em> —
                    lock in launch pricing forever
                  </h3>
                  <p className="mt-1.5 font-serif text-[14.5px] italic leading-snug text-cream/75">
                    $39 Starter / $89 Growth / $249 Agency monthly, locked as
                    long as your subscription stays active. Once we hit 50
                    founders, list prices apply.
                  </p>
                </div>
                <div className="flex flex-col items-center sm:items-end">
                  <p className="font-mono text-[36px] font-medium leading-none text-gold">
                    {FOUNDING_SPOTS_LEFT}
                  </p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-cream/55">
                    spots left
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ============ PRICING TIERS ============ */}
      <section className="px-6 pb-24 sm:pb-28">
        <div className="mx-auto max-w-[1240px]">
          <PricingTiers />
        </div>
      </section>

      {/* ============ HONEST COMPARISON ============ */}
      <section className="bg-cream-deep px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-[1100px]">
          <div className="text-center">
            <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-text-muted">
              Honest comparison
            </p>
            <h2 className="font-display text-[36px] font-normal leading-[1.05] tracking-[-0.025em] text-ink sm:text-[44px]">
              $99 buys you{" "}
              <em className="italic text-forest">the whole loop.</em>
            </h2>
            <p className="mx-auto mt-5 max-w-[680px] font-serif text-[17px] leading-relaxed text-text-soft sm:text-[18px]">
              Most review tools price like Birdeye ($299+ with sales calls) or
              stop at collection like NiceJob. BAAM Review at $99 includes
              everything below — at sub-$100 with no sales call.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-2xl border border-border-base bg-paper shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-border-soft bg-cream-deep">
                    <th className="px-5 py-4 font-display text-[12.5px] font-medium uppercase tracking-[0.14em] text-text-muted">
                      Feature
                    </th>
                    <th className="bg-ink px-5 py-4 font-display text-[13.5px] font-medium tracking-[-0.01em] text-cream">
                      BAAM Review Growth
                    </th>
                    <th className="px-5 py-4 font-display text-[13.5px] font-medium tracking-[-0.01em] text-text-soft">
                      Birdeye
                    </th>
                    <th className="px-5 py-4 font-display text-[13.5px] font-medium tracking-[-0.01em] text-text-soft">
                      Podium
                    </th>
                    <th className="px-5 py-4 font-display text-[13.5px] font-medium tracking-[-0.01em] text-text-soft">
                      NiceJob Pro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={cn(
                        "border-b border-border-soft last:border-0",
                        i % 2 === 1 && "bg-cream-deep/40",
                      )}
                    >
                      <td className="px-5 py-4 text-[14px] text-text">
                        {row.feature}
                      </td>
                      <td className="bg-forest/[0.04] px-5 py-4 text-[14px] font-medium text-ink">
                        <span className="inline-flex items-center gap-2">
                          {row.baamCheck && (
                            <Check className="h-4 w-4 text-forest" />
                          )}
                          {row.baam}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[13.5px] text-text-soft">
                        {row.birdeye}
                      </td>
                      <td className="px-5 py-4 text-[13.5px] text-text-soft">
                        {row.podium}
                      </td>
                      <td className="px-5 py-4 text-[13.5px] text-text-soft">
                        {row.nicejob}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ROI CALCULATOR ============ */}
      <section className="px-6 py-24 sm:py-28">
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-start gap-14 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p
              className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em]"
              style={{ color: "#836A30" }}
            >
              Does the $99 pay back?
            </p>
            <h2 className="font-display text-[36px] font-normal leading-[1.05] tracking-[-0.025em] text-ink sm:text-[44px]">
              Reviews are <em className="italic text-forest">worth</em>{" "}
              something. Let&apos;s calculate.
            </h2>
            <p className="mt-6 max-w-[520px] font-serif text-[18px] leading-relaxed text-text-soft">
              A Google review is worth $50–200 in lifetime customer value for
              most local businesses. More reviews mean better SEO, better
              trust, more bookings. Adjust the sliders and see what your number
              actually looks like.
            </p>
            <p className="mt-5 max-w-[520px] font-serif text-[15px] leading-relaxed text-text-soft">
              The math assumes a conservative 5% lift in monthly customers from
              going from 3 reviews/month to 15 reviews/month — well below what
              most BAAM Review customers see in practice.
            </p>
          </div>
          <RoiCalculator />
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-paper px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-[920px]">
          <div className="mb-12 text-center">
            <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-text-muted">
              FAQ
            </p>
            <h2 className="font-display text-[36px] font-normal leading-[1.05] tracking-[-0.025em] text-ink sm:text-[44px]">
              Questions, <em className="italic text-forest">answered.</em>
            </h2>
            <p className="mx-auto mt-5 max-w-[600px] font-serif text-[17px] leading-relaxed text-text-soft">
              Most of what people ask before signing up. If your question
              isn&apos;t here, email us — we answer the same day.
            </p>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* ============ BOTTOM CTA ============ */}
      <div className="relative overflow-hidden bg-forest px-6 py-24 text-cream sm:py-28">
        <div className="pointer-events-none absolute right-[-5%] top-[-15%] h-[500px] w-[500px] rounded-full bg-gold/15 blur-3xl" />
        <div className="relative mx-auto max-w-[760px] text-center">
          <h2 className="font-display text-[40px] font-normal leading-[1.05] tracking-[-0.025em] text-cream sm:text-[56px]">
            Start free. <em className="italic text-gold">See if it fits.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-[560px] font-serif text-[19px] leading-relaxed text-cream/80">
            Fourteen days. No credit card. The full Starter feature set. If
            BAAM Review doesn&apos;t earn its place in your week, you walk
            away with nothing lost.
          </p>
          <a
            href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/signup`}
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-gold px-8 py-4 text-[16px] font-medium text-ink transition-all hover:-translate-y-px hover:bg-[#B8985A] hover:shadow-md"
          >
            Start free trial →
          </a>
        </div>
      </div>

      <MarketingFooter />
    </>
  );
}
