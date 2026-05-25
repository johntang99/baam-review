// Detect locations duplicated by (account_id, google_place_id) and
// report what data is attached to each copy. Doesn't delete anything
// — the user decides which to keep.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: allLocs } = await sb
  .from("locations")
  .select(
    "id, account_id, slug, display_name, google_place_id, created_at, reviews_synced_at, connected_by_user_id, customer_record_id",
  )
  .order("created_at", { ascending: true });

// Group by (account_id, google_place_id). Locations without a place_id
// can't be deduped by it — skip.
const groups = new Map();
for (const l of allLocs ?? []) {
  if (!l.google_place_id) continue;
  const key = `${l.account_id}:${l.google_place_id}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(l);
}

const dups = [...groups.entries()].filter(([_, list]) => list.length > 1);
console.log(`\nFound ${dups.length} duplicate group(s).\n`);
if (dups.length === 0) {
  console.log("No duplicates to clean up. ✓");
  process.exit(0);
}

// For each duplicate copy, count attached rows so the user can tell
// which one to keep.
async function activityFor(locationId) {
  const [{ count: reviews }, { count: lists }, { count: assignments }, sub, requestsRes] = await Promise.all([
    sb
      .from("google_reviews")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId),
    sb
      .from("lists")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId),
    sb
      .from("location_assignments")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId),
    sb
      .from("location_subscriptions")
      .select("subscription_status")
      .eq("location_id", locationId)
      .maybeSingle(),
    sb
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId),
  ]);
  return {
    reviews: reviews ?? 0,
    lists: lists ?? 0,
    assignments: assignments ?? 0,
    sub: sub?.data?.subscription_status ?? "none",
    requests: requestsRes.count ?? 0,
  };
}

for (const [key, list] of dups) {
  const name = list[0].display_name;
  console.log("─".repeat(78));
  console.log(`${name}`);
  console.log(`  place_id: ${key.split(":")[1]}`);
  console.log(`  account:  ${list[0].account_id}`);
  console.log(`  ${list.length} copies:`);
  let bestScore = -1;
  let bestId = null;
  for (const loc of list) {
    const a = await activityFor(loc.id);
    const score =
      a.reviews * 10 +
      a.lists * 5 +
      a.assignments * 5 +
      a.requests * 1 +
      (a.sub !== "none" ? 100 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestId = loc.id;
    }
    console.log(
      `\n    id:        ${loc.id}`,
    );
    console.log(`    slug:      ${loc.slug}`);
    console.log(`    created:   ${loc.created_at}`);
    console.log(`    activity:  reviews=${a.reviews} lists=${a.lists} requests=${a.requests} assignments=${a.assignments} sub=${a.sub}`);
    console.log(`    connected_by: ${loc.connected_by_user_id ?? "—"}`);
    console.log(`    customer_record: ${loc.customer_record_id ?? "—"}`);
  }
  console.log(`\n  → Recommend KEEP: ${bestId} (highest activity score)`);
  for (const loc of list) {
    if (loc.id === bestId) continue;
    console.log(`  → Recommend DELETE: ${loc.id}`);
  }
}

console.log("\n" + "─".repeat(78));
console.log("\nTo delete a specific duplicate, run in Supabase SQL editor:");
console.log("  DELETE FROM public.locations WHERE id = '<id-to-delete>';");
console.log("\nForeign-key cascades will handle dependent rows on these tables:");
console.log(
  "  google_reviews, lists+list_customers, review_requests, location_assignments,",
);
console.log(
  "  location_subscriptions, landing_events, embed_loads, social_graphics, opt_outs",
);
console.log(
  "\nIf any duplicate has billing (sub=trialing/active), pause the Stripe sub FIRST",
);
console.log("(refund if pre-paid) before deleting that row to avoid orphan charges.");
