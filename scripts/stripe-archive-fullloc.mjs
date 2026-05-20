#!/usr/bin/env node
/**
 * Archive the retired FULL_LOC prices ($199/mo, $1990/yr).
 *
 * The Full-service per-location subscription now bills the FULL_BASE
 * price ($299/$2990); FULL_LOC is dead and should not appear in any
 * price picker or be usable for new subscriptions. Archiving is
 * reversible (active=false) and does NOT affect any historical
 * subscription already on the price.
 *
 * Usage:
 *   # Local / test mode (idempotent; safe to re-run):
 *   node --env-file=.env.local scripts/stripe-archive-fullloc.mjs
 *
 *   # Live mode — pass the live key inline; require --live:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-archive-fullloc.mjs --live
 *
 * Targets are matched by lookup_key, so the same script archives the
 * right prices in either Stripe mode without hard-coded ids.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error(
    "STRIPE_SECRET_KEY not set. Pass it inline or use --env-file=.env.local",
  );
  process.exit(1);
}
const liveOk = process.argv.includes("--live");
if (key.startsWith("sk_live_") && !liveOk) {
  console.error(
    "Refusing to mutate LIVE Stripe without --live. Re-run:\n  STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-archive-fullloc.mjs --live",
  );
  process.exit(1);
}
if (key.startsWith("sk_live_")) {
  console.warn("⚠️  LIVE MODE — archiving FULL_LOC prices in LIVE Stripe.\n");
}

const stripe = new Stripe(key);
const LOOKUP_KEYS = [
  "baam_review_full_service_location_month",
  "baam_review_full_service_location_year",
];

let archivedCount = 0;
let alreadyCount = 0;
let missingCount = 0;

for (const lookupKey of LOOKUP_KEYS) {
  // Match active+inactive — once archived, the default list filters them out.
  const list = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = list.data[0];
  if (!price) {
    // Already inactive or never created — verify by querying without active filter.
    const all = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    if (all.data[0]) {
      console.log(`• ${lookupKey} — already archived (${all.data[0].id})`);
      alreadyCount++;
    } else {
      console.log(`• ${lookupKey} — not found (nothing to do)`);
      missingCount++;
    }
    continue;
  }
  const updated = await stripe.prices.update(price.id, { active: false });
  console.log(
    `✓ ${lookupKey} — archived ${updated.id} ($${(updated.unit_amount / 100).toFixed(2)}/${updated.recurring.interval})`,
  );
  archivedCount++;
}

console.log(
  `\nDone. archived=${archivedCount}, already-archived=${alreadyCount}, not-found=${missingCount}`,
);
