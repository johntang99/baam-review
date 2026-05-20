import "server-only";
import Stripe from "stripe";
import {
  STRIPE_PRICE_ENV,
  type ReviewPlan,
  type BillingInterval,
  type PriceComponent,
} from "./plans";

/**
 * Stripe client for BAAM Review billing. Uses the shared baamplatform.com
 * Stripe account (same account that bills website-services). BAAM Review
 * Products/Prices are namespaced "BAAM Review — …" and referenced only by
 * the STRIPE_PRICE_SELF_… / FULL_… env vars, so this code never touches the
 * other products' subscriptions.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** True when the configured key is a LIVE key — used to guard dev/test paths. */
export function isStripeLiveMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
}

/**
 * Resolve the Stripe Price ID for one plan line from env. Throws a clear
 * error until the Prices are created in Stripe and the env vars are filled.
 */
export function resolvePriceId(
  plan: ReviewPlan,
  component: PriceComponent,
  interval: BillingInterval,
): string {
  const envName = STRIPE_PRICE_ENV[plan][component][interval];
  const id = process.env[envName];
  if (!id) {
    throw new Error(
      `Stripe price not configured: ${envName} (create the Price in Stripe and set this env var)`,
    );
  }
  return id;
}
