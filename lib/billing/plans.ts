/**
 * Canonical BAAM Review pricing model (pure data — no Stripe/env import;
 * safe in server actions and UI).
 *
 * Two subscription kinds:
 *   • Account base — Self-service ONLY: $89/mo ($890/yr), the owner's own
 *     business, owner's card, 30-day trial (card upfront).
 *   • Per-location — its own independent subscription, own card, own
 *     interval, NO proration:
 *        Self-service added location: $79/mo ($790/yr), 30-day trial.
 *        Full-service location:       $299/mo ($2990/yr), 30-day trial.
 *
 * Full-service has NO account base. Every plan gets a 30-day (first month)
 * free trial — self-service base + locations, and full-service locations
 * (card AND invoice/check). Annual = 10×
 * monthly, paid once. Stripe Price IDs live in env (STRIPE_PRICE_ENV).
 * The full-service per-location price reuses the FULL "base" price slot;
 * the old FULL "location" ($199) prices are retired.
 */

export type ReviewPlan = "self_service" | "full_service";
export type BillingInterval = "month" | "year";
/** Stripe price slots (kept for the env map / resolver). */
export type PriceComponent = "base" | "location";

/** Monthly price in cents per Stripe slot. Annual = × ANNUAL_MONTHS. */
const MONTHLY_CENTS: Record<ReviewPlan, Record<PriceComponent, number>> = {
  self_service: { base: 8900, location: 7900 },
  // full_service.base ($299) is the per-location price; .location ($199)
  // is retired (unused).
  full_service: { base: 29900, location: 19900 },
};

export const ANNUAL_MONTHS = 10;
export const TRIAL_DAYS = 30;

/** First month free: 30-day trial on every plan (base + locations). */
export const PLAN_HAS_TRIAL: Record<ReviewPlan, boolean> = {
  self_service: true,
  full_service: true,
};

/** Only Self-service has an account-level base subscription. */
export function accountHasBase(plan: ReviewPlan): boolean {
  return plan === "self_service";
}

function amount(
  plan: ReviewPlan,
  component: PriceComponent,
  interval: BillingInterval,
): number {
  const m = MONTHLY_CENTS[plan][component];
  return interval === "year" ? m * ANNUAL_MONTHS : m;
}

/** Account-base price (Self-service only): $89/mo, $890/yr. */
export function accountBaseCents(interval: BillingInterval): number {
  return amount("self_service", "base", interval);
}

/**
 * Which Stripe price slot a per-location subscription uses:
 *   self_service → SELF "location" ($79)
 *   full_service → FULL "base"     ($299)  (FULL "location" is retired)
 */
export function locationPriceRef(plan: ReviewPlan): {
  plan: ReviewPlan;
  component: PriceComponent;
} {
  return plan === "self_service"
    ? { plan: "self_service", component: "location" }
    : { plan: "full_service", component: "base" };
}

/** Per-location price for an account on `plan`. */
export function locationCents(
  plan: ReviewPlan,
  interval: BillingInterval,
): number {
  const r = locationPriceRef(plan);
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
