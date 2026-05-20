/**
 * Canonical BAAM Review pricing model (pure data — no Stripe/env import;
 * safe in server actions and UI).
 *
 * Both plans bill PER LOCATION as independent subscriptions (own card, own
 * interval, no proration, 30-day free trial). There is NO account-level
 * base subscription.
 *
 *   Self-service tier (the owner runs it themselves):
 *     • First location:        $89/mo ($890/yr)   ← promotional rate
 *     • Each additional:       $79/mo ($790/yr)
 *
 *   Full-service tier (BAAM runs it for the customer):
 *     • Every location:        $299/mo ($2990/yr) flat
 *
 * Annual = 10 × monthly, paid once. Every plan gets a 30-day free trial
 * (card on file collected upfront for card flow; no charge until day 30).
 * Stripe Price IDs live in env (STRIPE_PRICE_ENV).
 *
 * Stripe price-slot naming is legacy — `base` = "first" tier ($89 self /
 * $299 full); `location` = "additional" tier ($79 self / unused full,
 * FULL_LOC archived).
 */

export type ReviewPlan = "self_service" | "full_service";
export type BillingInterval = "month" | "year";
/** Stripe price slots (kept for the env map / resolver). */
export type PriceComponent = "base" | "location";

/** Monthly price in cents per Stripe slot. Annual = × ANNUAL_MONTHS. */
const MONTHLY_CENTS: Record<ReviewPlan, Record<PriceComponent, number>> = {
  // base = first self-service location ($89), location = additional ($79).
  self_service: { base: 8900, location: 7900 },
  // base = every full-service location ($299); FULL "location" ($199) retired.
  full_service: { base: 29900, location: 19900 },
};

export const ANNUAL_MONTHS = 10;
export const TRIAL_DAYS = 30;

/** First month free: 30-day trial on every per-location subscription. */
export const PLAN_HAS_TRIAL: Record<ReviewPlan, boolean> = {
  self_service: true,
  full_service: true,
};

function amount(
  plan: ReviewPlan,
  component: PriceComponent,
  interval: BillingInterval,
): number {
  const m = MONTHLY_CENTS[plan][component];
  return interval === "year" ? m * ANNUAL_MONTHS : m;
}

/**
 * Which Stripe price slot a per-location subscription uses.
 *
 *   self_service + isFirst=true  → "base"     ($89)  promo rate
 *   self_service + isFirst=false → "location" ($79)  additional
 *   full_service (any)           → "base"     ($299) flat
 */
export function locationPriceRef(
  plan: ReviewPlan,
  isFirst: boolean,
): { plan: ReviewPlan; component: PriceComponent } {
  if (plan === "self_service") {
    return {
      plan: "self_service",
      component: isFirst ? "base" : "location",
    };
  }
  return { plan: "full_service", component: "base" };
}

/** Per-location price an account would be charged for its FIRST location. */
export function firstLocationCents(
  plan: ReviewPlan,
  interval: BillingInterval,
): number {
  const r = locationPriceRef(plan, true);
  return amount(r.plan, r.component, interval);
}

/**
 * Per-location price for an ADDITIONAL location. For full_service this is
 * the same as the first (flat $299); for self_service it's the lower $79.
 */
export function additionalLocationCents(
  plan: ReviewPlan,
  interval: BillingInterval,
): number {
  const r = locationPriceRef(plan, false);
  return amount(r.plan, r.component, interval);
}

/** Env var name holding each Stripe Price ID (filled in .env.local). */
export const STRIPE_PRICE_ENV: Record<
  ReviewPlan,
  Record<PriceComponent, Record<BillingInterval, string>>
> = {
  self_service: {
    base: { month: "STRIPE_PRICE_SELF_BASE_M", year: "STRIPE_PRICE_SELF_BASE_Y" },
    location: { month: "STRIPE_PRICE_SELF_LOC_M", year: "STRIPE_PRICE_SELF_LOC_Y" },
  },
  full_service: {
    base: { month: "STRIPE_PRICE_FULL_BASE_M", year: "STRIPE_PRICE_FULL_BASE_Y" },
    location: { month: "STRIPE_PRICE_FULL_LOC_M", year: "STRIPE_PRICE_FULL_LOC_Y" },
  },
};

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
