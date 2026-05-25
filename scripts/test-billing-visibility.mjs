// Simulate the billing page + action gating per role against live data.
// Provisions a fresh sales user, assigns the existing account_manager
// (Baam Support) to a test location, then runs the same SQL queries and
// the same locationForUser() gate logic each billing surface uses.

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

const { data: ops } = await sb
  .from("accounts")
  .select("id")
  .eq("is_baam_internal", true)
  .single();
const opsId = ops.id;

const { data: users } = await sb
  .from("users")
  .select("id, full_name, ops_role")
  .eq("account_id", opsId);
const { data: authList } = await sb.auth.admin.listUsers({ perPage: 1000 });
const emailById = new Map(
  (authList?.users ?? []).map((u) => [u.id, u.email]),
);

const admin = users.find((u) => u.ops_role === "admin");
const salesExisting = users.find((u) => u.ops_role === "sales");
const am = users.find(
  (u) =>
    u.ops_role === "account_manager" &&
    emailById.get(u.id) === "support@baamplatform.com",
);
if (!admin || !am) {
  console.error("Need both an admin and Baam Support (account_manager).");
  process.exit(1);
}

// Pick two locations: one for the test sales "connector", one for the AM
// assignment.
const { data: locs } = await sb
  .from("locations")
  .select("id, display_name, connected_by_user_id")
  .eq("account_id", opsId)
  .order("display_name");
if (locs.length < 2) {
  console.error("Need at least 2 locations for this test.");
  process.exit(1);
}
const locForSales = locs[0];
const locForAm = locs[1];

console.log(`\nUsing locations:`);
console.log(`  sales-connected: "${locForSales.display_name}"`);
console.log(`  am-assigned:     "${locForAm.display_name}"`);

// Provision a fresh sales user, set them as connector of locForSales.
const salesEmail = `test-sales-billing-${Date.now()}@example.com`;
const { data: newSales } = await sb.auth.admin.createUser({
  email: salesEmail,
  password: "TestSales1234!",
  email_confirm: true,
});
await new Promise((r) => setTimeout(r, 300));
const { data: salesUserRow } = await sb
  .from("users")
  .select("id, account_id")
  .eq("id", newSales.user.id)
  .maybeSingle();
const oldAcc = salesUserRow.account_id;
await sb
  .from("users")
  .update({ account_id: opsId, ops_role: "sales" })
  .eq("id", newSales.user.id);
if (oldAcc !== opsId) await sb.from("accounts").delete().eq("id", oldAcc);
const originalConnector = locForSales.connected_by_user_id;
await sb
  .from("locations")
  .update({ connected_by_user_id: newSales.user.id })
  .eq("id", locForSales.id);

// Snapshot AM's existing assignments so the test isn't polluted by them
// (and we can restore at the end).
const { data: priorAssignments } = await sb
  .from("location_assignments")
  .select("location_id, assigned_by_user_id, assigned_at")
  .eq("user_id", am.id);
await sb.from("location_assignments").delete().eq("user_id", am.id);

// Insert ONLY the test assignment.
await sb.from("location_assignments").insert({
  location_id: locForAm.id,
  user_id: am.id,
  assigned_by_user_id: admin.id,
});

console.log("\n══ Billing visibility per role ══════════════════════════════");

// Mirror the page query for each role.
async function getVisible(role, userId) {
  if (role === "admin" || role === null) {
    const { data } = await sb
      .from("locations")
      .select("id, display_name")
      .eq("account_id", opsId);
    return data;
  }
  if (role === "sales") {
    const { data } = await sb
      .from("locations")
      .select("id, display_name")
      .eq("account_id", opsId)
      .eq("connected_by_user_id", userId);
    return data;
  }
  if (role === "account_manager") {
    const { data } = await sb
      .from("location_assignments")
      .select("locations(id, display_name)")
      .eq("user_id", userId);
    return (data ?? [])
      .map((r) => (Array.isArray(r.locations) ? r.locations[0] : r.locations))
      .filter(Boolean);
  }
  return [];
}

async function logVisibility(label, role, userId) {
  const visible = await getVisible(role, userId);
  console.log(
    `\n${label} (${role}) — ${emailById.get(userId)}`,
  );
  console.log(`  /app/billing rows visible: ${visible.length}`);
  for (const v of visible.slice(0, 4)) console.log(`    • ${v.display_name}`);
  if (visible.length > 4) console.log(`    … and ${visible.length - 4} more`);
}

await logVisibility("ADMIN", "admin", admin.id);
await logVisibility("SALES (test user)", "sales", newSales.user.id);
await logVisibility("ACCOUNT_MANAGER (Baam Support)", "account_manager", am.id);

console.log("\n══ Action gate (locationForUser) per role ══════════════════════");

// Mirror locationForUser: tenant check + role check.
async function canTouch(userId, role, locationId) {
  const { data: loc } = await sb
    .from("locations")
    .select("id, account_id")
    .eq("id", locationId)
    .maybeSingle();
  if (!loc || loc.account_id !== opsId) return false;
  // Internal role check
  if (role === "admin" || role === null) return true;
  if (role === "sales") return loc.connected_by_user_id === userId
    ? (await sb.from("locations").select("id").eq("id", locationId).eq("connected_by_user_id", userId).maybeSingle()).data !== null
    : (await sb.from("locations").select("id").eq("id", locationId).eq("connected_by_user_id", userId).maybeSingle()).data !== null;
  if (role === "account_manager") {
    const { data } = await sb
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", userId)
      .eq("location_id", locationId)
      .maybeSingle();
    return !!data;
  }
  return false;
}

const matrix = [
  {
    label: "admin → sales-connected loc",
    user: admin,
    role: "admin",
    loc: locForSales,
    expect: true,
  },
  {
    label: "admin → am-assigned loc",
    user: admin,
    role: "admin",
    loc: locForAm,
    expect: true,
  },
  {
    label: "sales → own connected loc",
    user: newSales.user,
    role: "sales",
    loc: locForSales,
    expect: true,
  },
  {
    label: "sales → some other loc",
    user: newSales.user,
    role: "sales",
    loc: locForAm,
    expect: false,
  },
  {
    label: "account_mgr → own assigned loc",
    user: am,
    role: "account_manager",
    loc: locForAm,
    expect: true,
  },
  {
    label: "account_mgr → some other loc",
    user: am,
    role: "account_manager",
    loc: locForSales,
    expect: false,
  },
];

let pass = 0;
let fail = 0;
for (const t of matrix) {
  const got = await canTouch(t.user.id, t.role, t.loc.id);
  const ok = got === t.expect;
  if (ok) pass++;
  else fail++;
  console.log(
    `  ${ok ? "✓" : "✗"} ${t.label.padEnd(40)} expect=${t.expect ? "allow" : "deny "} got=${got ? "allow" : "deny "}`,
  );
}

// Cleanup.
console.log("\n── Cleanup");
await sb
  .from("locations")
  .update({ connected_by_user_id: originalConnector })
  .eq("id", locForSales.id);
// Remove test assignment, then re-insert any prior assignments AM had.
await sb.from("location_assignments").delete().eq("user_id", am.id);
if ((priorAssignments ?? []).length > 0) {
  await sb.from("location_assignments").insert(
    priorAssignments.map((a) => ({
      location_id: a.location_id,
      user_id: am.id,
      assigned_by_user_id: a.assigned_by_user_id,
      assigned_at: a.assigned_at,
    })),
  );
}
await sb.auth.admin.deleteUser(newSales.user.id);
console.log(
  `  removed test sales user, reverted connector, restored ${(priorAssignments ?? []).length} prior assignment(s)`,
);

console.log(
  `\n══ Result: ${pass}/${matrix.length} action-gate checks passed ${fail === 0 ? "✓" : "✗"}\n`,
);
process.exit(fail === 0 ? 0 : 1);
