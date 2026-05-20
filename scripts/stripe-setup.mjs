#!/usr/bin/env node
/**
 * Create the BAAM Review Stripe Products + Prices (idempotent).
 *
 *   node --env-file=.env.local scripts/stripe-setup.mjs
 *
 * - Refuses to run on a LIVE key (safety: test mode only here).
 * - Idempotent: products matched by metadata, prices by lookup_key —
 *   safe to re-run; existing objects are reused, not duplicated.
 * - Prints the 8 STRIPE_PRICE_* env lines to paste into .env.local
 *   (or, at launch, run again against the live key for live IDs).
 *
 * Amounts mirror lib/billing/plans.ts (keep in sync). USD cents.
 * Annual = 10x monthly (pay 10 months once).
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY not set. Run with: node --env-file=.env.local scripts/stripe-setup.mjs");
  process.exit(1);
}
const liveOk = process.argv.includes("--live");
if (key.startsWith("sk_live_") && !liveOk) {
  console.error(
    "Refusing to run against a LIVE key without --live. To create LIVE products + prices, re-run with --live:\n  STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs --live",
  );
  process.exit(1);
}
if (key.startsWith("sk_live_")) {
  console.warn(
    "⚠️  LIVE MODE — creating products + prices in LIVE Stripe. Idempotent: safe to re-run.\n",
  );
}

const stripe = new Stripe(key);
const ANNUAL_MONTHS = 10;

// plan -> product spec; component monthly amounts (cents)
const PLANS = {
  self_service: {
    productName: "BAAM Review — Self-service",
    productDesc: "Self-serve review-to-revenue plan. Base + per extra store.",
    monthly: { base: 8900, location: 7900 },
  },
  full_service: {
    productName: "BAAM Review — Full-service",
    productDesc: "Done-for-you review management. Base + per extra location.",
    monthly: { base: 29900, location: 19900 },
  },
};
// component -> env-name suffix
const COMP = { base: "BASE", location: "LOC" };
const PLAN_ENV = { self_service: "SELF", full_service: "FULL" };

async function ensureProduct(planKey) {
  const p = PLANS[planKey];
  const found = await stripe.products.search({
    query: `metadata['baam_review_plan']:'${planKey}'`,
  });
  if (found.data[0]) return found.data[0];
  return stripe.products.create({
    name: p.productName,
    description: p.productDesc,
    metadata: { baam_review: "true", baam_review_plan: planKey },
  });
}

async function ensurePrice(productId, lookupKey, amount, interval, nickname) {
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (found.data[0]) return found.data[0];
  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookupKey,
    nickname,
    metadata: { baam_review: "true" },
  });
}

const out = [];
for (const planKey of Object.keys(PLANS)) {
  const spec = PLANS[planKey];
  const product = await ensureProduct(planKey);
  for (const comp of ["base", "location"]) {
    // FULL_LOC ($199/$1990) is retired — full-service locations bill the
    // FULL_BASE price ($299/$2990). Skip so re-running the script doesn't
    // resurrect the legacy SKU. Test + live FULL_LOC prices are archived.
    if (planKey === "full_service" && comp === "location") continue;
    const monthly = spec.monthly[comp];
    for (const [interval, mult, suffix] of [
      ["month", 1, "M"],
      ["year", ANNUAL_MONTHS, "Y"],
    ]) {
      const amount = monthly * mult;
      const lookupKey = `baam_review_${planKey}_${comp}_${interval}`;
      const nickname = `${spec.productName} — ${comp} (${interval === "year" ? "annual" : "monthly"})`;
      const price = await ensurePrice(product.id, lookupKey, amount, interval, nickname);
      const envName = `STRIPE_PRICE_${PLAN_ENV[planKey]}_${COMP[comp]}_${suffix}`;
      out.push(`${envName}=${price.id}`);
      console.log(`✓ ${envName}  ${nickname}  $${(amount / 100).toFixed(2)}/${interval}  (${price.id})`);
    }
  }
}

console.log("\n--- paste these into .env.local ---\n" + out.join("\n") + "\n");
