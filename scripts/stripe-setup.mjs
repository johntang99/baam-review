#!/usr/bin/env node
/**
 * Create or migrate the BAAM Review Stripe Products + Prices (idempotent).
 *
 *   node --env-file=.env.local scripts/stripe-setup.mjs
 *
 * - Refuses to run on a LIVE key without --live (safety).
 * - Idempotent on amount: products matched by metadata, prices by
 *   lookup_key. If a lookup_key exists at the SAME amount, it's reused.
 *   If it exists at a DIFFERENT amount, the old price is archived (and its
 *   lookup_key transferred) and a new price is created at the new amount.
 * - Prints STRIPE_PRICE_* env lines to paste into .env.local (test) or
 *   your hosting provider's env (live).
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

// plan -> product spec; component monthly amounts (cents).
// Per-location pricing is uniform within each plan now: base == location.
// Discounts go through Stripe Coupons / Promotion Codes at checkout, not via
// a separate "first vs. additional" price tier. Keep slot structure for env
// compatibility — the resolver in lib/billing/plans.ts collapses to base.
const PLANS = {
  self_service: {
    productName: "BAAM Review — Self-service",
    productDesc: "Self-serve review-to-revenue plan. Flat per-location pricing.",
    monthly: { base: 9900, location: 9900 },
  },
  full_service: {
    productName: "BAAM Review — Full-service",
    productDesc: "Done-for-you review management. Flat per-location pricing.",
    monthly: { base: 39900, location: 39900 },
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
  const existing = found.data[0];

  // Same amount already on this lookup_key — reuse, no-op.
  if (existing && existing.unit_amount === amount && existing.active) {
    return existing;
  }

  // Amount changed (or old price archived) — create a new Price and transfer
  // the lookup_key from the old one. Stripe handles the transfer atomically
  // when transfer_lookup_key=true; the old Price keeps its ID and historical
  // subscriptions but loses the lookup_key (so checkout always resolves to
  // the new Price).
  const newPrice = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: !!existing,
    nickname,
    metadata: { baam_review: "true" },
  });

  if (existing) {
    // Archive the old Price so it disappears from pickers / dashboard lists.
    // It stays accessible by ID for historical subscription reporting.
    await stripe.prices.update(existing.id, {
      active: false,
      nickname:
        (existing.nickname || `archived-${lookupKey}`) + " (replaced)",
    });
    console.log(
      `  ↻ migrated ${lookupKey}: $${(existing.unit_amount / 100).toFixed(2)} → $${(amount / 100).toFixed(2)}`,
    );
  }

  return newPrice;
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
