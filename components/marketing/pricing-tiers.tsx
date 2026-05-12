"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "yearly";

interface TierFeatureGroup {
  groupLabel: string;
  features: { text: string; bold?: boolean }[];
}

interface Tier {
  name: string;
  tag: string;
  monthly: number;
  yearly: number;
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
  groups: TierFeatureGroup[];
  trialNote?: string;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    tag: "Try the wedge. See what your customers actually do.",
    monthly: 0,
    yearly: 0,
    ctaLabel: "Start for free",
    ctaHref: "/signup?plan=free",
    trialNote: "No card required",
    groups: [
      {
        groupLabel: "Stage 1 · Collect",
        features: [
          { text: "5 review requests / month", bold: true },
          { text: "1 location" },
          { text: "AI-assisted writing" },
          { text: "EN / 中文 / Español" },
          { text: "QR code generator" },
          { text: "“Powered by BAAM Review” branding" },
        ],
      },
    ],
  },
  {
    name: "Starter",
    tag: "Get more Google reviews.",
    monthly: 49,
    yearly: 39,
    ctaLabel: "Start free trial",
    ctaHref: "/signup?plan=starter",
    trialNote: "14-day free trial",
    groups: [
      {
        groupLabel: "Stages 1–2 · Collect + Publish",
        features: [
          { text: "150 review requests / month", bold: true },
          { text: "1 location, custom branding" },
          { text: "SMS + email sending" },
          { text: "“Leave a Review” embed script" },
          { text: "Private feedback inbox" },
          { text: "Post-review thank-you with Book / Refer / Follow" },
          { text: "Funnel analytics" },
          { text: "Email support" },
        ],
      },
    ],
  },
  {
    name: "Growth",
    tag: "Turn reviews into revenue.",
    monthly: 99,
    yearly: 79,
    ctaLabel: "Start free trial",
    ctaHref: "/signup?plan=growth",
    trialNote: "14-day free trial",
    featured: true,
    groups: [
      {
        groupLabel: "Stages 1–2 · Everything in Starter",
        features: [
          { text: "Unlimited review requests", bold: true },
          { text: "Up to 5 locations" },
        ],
      },
      {
        groupLabel: "Stages 3–4 · Display + Distribute",
        features: [
          { text: "Website review widgets (schema markup)" },
          { text: "First-party testimonials" },
          { text: "AI Reply Assistant" },
          { text: "Xiaohongshu + Instagram + Facebook graphics" },
          { text: "GBP post generator" },
        ],
      },
      {
        groupLabel: "Stages 5–6 · Convert + Refer",
        features: [
          { text: "Share-with-a-Friend referral links" },
          { text: "Service recovery for low-rating feedback" },
          { text: "Staff Mode (mobile front-desk app)" },
          { text: "Revenue attribution dashboard", bold: true },
          { text: "Priority support" },
        ],
      },
    ],
  },
  {
    name: "Agency",
    tag: "Reputation and referrals at scale.",
    monthly: 499,
    yearly: 399,
    ctaLabel: "Start free trial",
    ctaHref: "/signup?plan=agency",
    trialNote: "14-day free trial",
    groups: [
      {
        groupLabel: "Everything in Growth, plus",
        features: [
          { text: "Up to 25 locations", bold: true },
          { text: "White-label (your brand)" },
          { text: "Agency dashboard across clients" },
        ],
      },
      {
        groupLabel: "Stage 7 · Compound",
        features: [
          { text: "Review theme mining across portfolio" },
          { text: "Auto-published testimonial SEO pages" },
          { text: "Ad-copy generator from reviews" },
          { text: "B2B partner referral tracking" },
          { text: "Best Advocates CRM" },
          { text: "Dedicated account manager" },
        ],
      },
    ],
  },
];

export function PricingTiers() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-border-base bg-paper p-1.5">
          <ToggleBtn
            active={billing === "monthly"}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </ToggleBtn>
          <ToggleBtn
            active={billing === "yearly"}
            onClick={() => setBilling("yearly")}
          >
            Yearly
            <span
              className={cn(
                "ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] transition-colors",
                billing === "yearly"
                  ? "bg-gold text-ink"
                  : "bg-cream-deep text-text-soft",
              )}
            >
              Save 20%
            </span>
          </ToggleBtn>
        </div>
      </div>

      {/* Tier grid */}
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((t) => (
          <TierCard key={t.name} tier={t} billing={billing} />
        ))}
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-5 py-2 text-[13.5px] font-medium transition-all",
        active
          ? "bg-ink text-cream"
          : "bg-transparent text-text-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function TierCard({ tier, billing }: { tier: Tier; billing: Billing }) {
  const price = billing === "monthly" ? tier.monthly : tier.yearly;
  const yearlySaving = (tier.monthly - tier.yearly) * 12;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-3xl p-7 transition-all",
        tier.featured
          ? "scale-[1.02] bg-ink text-cream shadow-xl"
          : "border border-border-base bg-paper text-text hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      {tier.featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink">
          Most popular
        </span>
      )}

      <p
        className={cn(
          "mb-2 text-[12px] font-medium uppercase tracking-[0.14em]",
          tier.featured ? "text-gold" : "text-text-muted",
        )}
      >
        {tier.name}
      </p>
      <p
        className={cn(
          "mb-6 font-serif text-[15px] italic leading-snug",
          tier.featured ? "text-cream/85" : "text-text-soft",
        )}
      >
        {tier.tag}
      </p>

      <div className="mb-2 flex items-baseline gap-1">
        <span className="font-display text-[44px] font-light leading-none tracking-[-0.025em]">
          ${price}
        </span>
        <span
          className={cn(
            "font-sans text-[14px]",
            tier.featured ? "text-cream/55" : "text-text-muted",
          )}
        >
          /mo
        </span>
      </div>
      <p
        className={cn(
          "mb-6 text-[12.5px]",
          tier.featured ? "text-cream/55" : "text-text-muted",
        )}
      >
        {billing === "yearly" && yearlySaving > 0
          ? `Save $${yearlySaving}/yr · ${tier.trialNote}`
          : tier.trialNote}
      </p>

      <Link
        href={tier.ctaHref}
        className={cn(
          "mb-7 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-[14.5px] font-medium transition-all",
          tier.featured
            ? "bg-gold text-ink hover:bg-[#B8985A]"
            : tier.name === "Free"
              ? "border border-forest bg-transparent text-forest hover:bg-forest hover:text-cream"
              : tier.name === "Starter"
                ? "bg-ink text-cream hover:bg-forest-dark"
                : "border border-forest bg-transparent text-forest hover:bg-forest hover:text-cream",
        )}
      >
        {tier.ctaLabel}
      </Link>

      <div className="flex flex-col gap-6">
        {tier.groups.map((g) => (
          <div key={g.groupLabel}>
            <p
              className={cn(
                "mb-3 text-[11px] font-medium uppercase tracking-[0.14em]",
                tier.featured ? "text-cream/55" : "text-text-muted",
              )}
            >
              {g.groupLabel}
            </p>
            <ul className="space-y-2.5">
              {g.features.map((f) => (
                <li
                  key={f.text}
                  className="flex items-start gap-2.5 text-[13.5px] leading-snug"
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4 flex-shrink-0",
                      tier.featured ? "text-gold" : "text-forest",
                    )}
                  />
                  <span
                    className={cn(
                      f.bold && "font-semibold",
                      tier.featured ? "text-cream" : "text-text",
                    )}
                  >
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
