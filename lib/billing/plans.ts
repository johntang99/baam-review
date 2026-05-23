/**
 * Canonical BAAM Review pricing model (pure data — no Stripe/env import;
 * safe in server actions and UI).
 *
 * Both plans bill PER LOCATION as independent subscriptions (own card, own
 * interval, no proration, 30-day free trial). There is NO account-level
 * base subscription. Per-location pricing is now UNIFORM in both plans:
 * every location costs the same regardless of count. Discounts go through
 * Stripe Coupons / Promotion Codes rather than a "first vs. additional"
 * price split.
 *
 *   Self-service tier (the owner runs it themselves):
 *     • Every location:        $99/mo ($990/yr) flat
 *
 *   Full-service tier (BAAM runs it for the customer):
 *     • Every location:        $399/mo ($3990/yr) flat
 *
 * Annual = 10 × monthly, paid once. Every plan gets a 30-day free trial
 * (card on file collected upfront for card flow; no charge until day 30).
 * Stripe Price IDs live in env (STRIPE_PRICE_ENV).
 *
 * Stripe price-slot naming is legacy — `base` and `location` slots are kept
 * to preserve the env map shape, but both now resolve to the same price
 * per plan (uniform). The naming may be collapsed in a future migration.
 */

export type ReviewPlan = "self_service" | "full_service";
export type BillingInterval = "month" | "year";
/** Stripe price slots (kept for the env map / resolver). */
export type PriceComponent = "base" | "location";

/** Monthly price in cents per Stripe slot. Annual = × ANNUAL_MONTHS. */
const MONTHLY_CENTS: Record<ReviewPlan, Record<PriceComponent, number>> = {
  // Uniform $99/mo per self-service location (base and location slots both
  // resolve to this — the slot split is preserved only for env compatibility).
  self_service: { base: 9900, location: 9900 },
  // Uniform $399/mo per full-service location. FULL "location" slot is
  // retained for env compatibility but bills the same as base.
  full_service: { base: 39900, location: 39900 },
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
 *   self_service (any) → "base"  ($99)  uniform
 *   full_service (any) → "base"  ($399) uniform
 *
 * The `isFirst` parameter is kept for callsite stability but is now
 * ignored — both plans use uniform per-location pricing. Discounts are
 * applied via Stripe Coupons / Promotion Codes at checkout, not via a
 * separate price tier.
 */
export function locationPriceRef(
  plan: ReviewPlan,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isFirst: boolean,
): { plan: ReviewPlan; component: PriceComponent } {
  return { plan, component: "base" };
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
 * Per-location price for an ADDITIONAL location. Both plans are now uniform
 * (self $99, full $399), so this returns the same as firstLocationCents.
 * Kept as a separate export so callers don't need to change.
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
