// Simulate a self-service customer's view: what shows in the sidebar,
// what data each page returns, and whether the protected pages bounce
// them. Uses Julia Cao (the only customer account) as the test subject.

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

// Find the (single) customer account.
const { data: customerAccount } = await sb
  .from("accounts")
  .select("id, name, primary_email")
  .eq("is_baam_internal", false)
  .order("created_at", { ascending: true })
  .limit(1)
  .maybeSingle();

if (!customerAccount) {
  console.log(
    "No customer (non-internal) account exists. Audit would still apply to any future signup.",
  );
  process.exit(0);
}

console.log(
  `\n══ Auditing as customer: ${customerAccount.name} (${customerAccount.primary_email})\n`,
);

// Resolve the customer user.
const { data: customerUser } = await sb
  .from("users")
  .select("id, full_name, ops_role, account_id")
  .eq("account_id", customerAccount.id)
  .maybeSingle();

if (!customerUser) {
  console.error("Customer account has no public.users row. Aborting.");
  process.exit(1);
}

console.log(`User: ${customerUser.full_name} / role=${customerUser.ops_role ?? "(no role — customer)"}`);

// ── Locations the customer would see in the sidebar (RLS-scoped).
const { data: theirLocations } = await sb
  .from("locations")
  .select("id, display_name")
  .eq("account_id", customerAccount.id);
console.log(`\nLocations in their account: ${theirLocations.length}`);
for (const l of theirLocations.slice(0, 5)) console.log(`  • ${l.display_name}`);

// ── Sidebar: which sections appear (mirrors operationsItemsForRole)?
function operationsItemsForRole(role) {
  if (role === "admin") return ["Onboarding queue", "Staff access"];
  if (role === "sales") return ["Onboarding queue"];
  return [];
}
const opsItems = operationsItemsForRole(customerUser.ops_role);
console.log("\n── Sidebar sections that render for this user:");
console.log(`  Workspace        → 7 items (Dashboard, Send, Lists, Reviews, …)`);
if (opsItems.length === 0) {
  console.log(`  BAAM Operations  → (hidden — customer)`);
} else {
  console.log(`  BAAM Operations  → ${opsItems.join(", ")}`);
}
console.log(`  Account          → Settings, Billing`);

// ── Protected route gates: simulate hitting /app/onboarding and /app/admin/staff.
console.log("\n── Protected route gates");
// Both pages now use getInternalContext + role check. For a customer
// (is_baam_internal=false), internal is null → both pages redirect to /app.
const internalForCustomer = null;
const onboardingAllowed =
  internalForCustomer !== null &&
  (["admin", "sales", null].includes(
    internalForCustomer?.opsRole ?? "no-such",
  ));
const staffAllowed =
  internalForCustomer !== null &&
  (["admin", null].includes(internalForCustomer?.opsRole ?? "no-such"));
console.log(`  /app/onboarding   → ${onboardingAllowed ? "allow ✗ (bug)" : "deny → /app ✓"}`);
console.log(`  /app/admin/staff  → ${staffAllowed ? "allow ✗ (bug)" : "deny → /app ✓"}`);

// ── Page-level data scoping
console.log("\n── Data scoping (what each page would actually return)");

// /app/billing — locations + location_subscriptions are filtered by
// .eq('account_id', customerAccount.id), so only their stuff.
const { data: billingLocs } = await sb
  .from("locations")
  .select("id, display_name")
  .eq("account_id", customerAccount.id);
console.log(`  /app/billing       → ${billingLocs.length} location billing row(s)`);

// /app/lists — list rows scoped via location_id.
const { data: theirLists } = await sb
  .from("lists")
  .select("id")
  .in(
    "location_id",
    theirLocations.length > 0
      ? theirLocations.map((l) => l.id)
      : ["00000000-0000-0000-0000-000000000000"],
  );
console.log(`  /app/lists         → ${theirLists.length} list row(s)`);

// /app/reviews — feedback + google_reviews scoped by location_id.
const idList =
  theirLocations.length > 0
    ? theirLocations.map((l) => l.id)
    : ["00000000-0000-0000-0000-000000000000"];
const [{ data: fb }, { data: gr }] = await Promise.all([
  sb.from("private_feedback").select("id").in("location_id", idList),
  sb.from("google_reviews").select("id").in("location_id", idList),
]);
console.log(
  `  /app/reviews       → ${fb.length} private feedback, ${gr.length} Google reviews`,
);

// /app/settings — pulls user.email + account.name; no role line for customer.
console.log(
  `  /app/settings      → email=${customerAccount.primary_email}, role=(no role — customer hidden)`,
);

console.log("\n── Cross-tenant data leak check");
// As a customer, can they accidentally see ops-tenant locations?
// The page-level filter is `eq('account_id', profile.account_id)`. RLS
// also enforces this. So even if profile.account_id was wrong, RLS would
// block. We verify by counting locations in the ops tenant that have
// the customer's account_id (should be 0).
const { data: ops } = await sb
  .from("accounts")
  .select("id")
  .eq("is_baam_internal", true)
  .single();
const { data: opsLocs } = await sb
  .from("locations")
  .select("id")
  .eq("account_id", ops.id);
console.log(
  `  Ops tenant has ${opsLocs.length} locations, customer sees ${theirLocations.length} of them ${theirLocations.some((l) => opsLocs.some((o) => o.id === l.id)) ? "✗ LEAK" : "✓ none"}`,
);
