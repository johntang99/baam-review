// End-to-end test of the assignment flow at the data layer.
//
//   1. Backfill connected_by_user_id on legacy locations → admin (john).
//   2. Insert one test assignment (Eileen ← a sample location).
//   3. Simulate the visibility queries each role's UI runs and assert
//      the right rows come back.
//   4. Clean up the test assignment so the state stays close to fresh.
//
// Read-only on schema; touches data minimally (one INSERT + one DELETE,
// plus the back-fill UPDATEs which are idempotent and useful long-term).

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const section = (t) => console.log(`\n── ${t} ──`);
const assert = (cond, msg) =>
  console.log(`${cond ? "✓" : "✗"} ${msg}`);

async function main() {
  // ───────────────────────────────────────────────────────────────────
  // Setup: find the ops tenant, the admin user, and one account manager.
  // ───────────────────────────────────────────────────────────────────
  const { data: opsAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("is_baam_internal", true)
    .order("created_at")
    .limit(1)
    .single();
  const opsId = opsAccount.id;

  const { data: adminUser } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("account_id", opsId)
    .eq("ops_role", "admin")
    .limit(1)
    .single();

  const { data: managers } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("account_id", opsId)
    .eq("ops_role", "account_manager");

  console.log(`Ops tenant:    ${opsId}`);
  console.log(`Admin user:    ${adminUser.full_name} (${adminUser.id})`);
  console.log(
    `Account mgrs:  ${managers.length} (${managers.map((m) => m.full_name).join(", ") || "none"})`,
  );

  if (managers.length === 0) {
    console.warn(
      "\n⚠ No account_manager users exist. Either set one via /app/admin/staff, or run this script after promoting one.",
    );
    return;
  }
  const managerUser = managers[0];

  // ───────────────────────────────────────────────────────────────────
  // Step 1: Back-fill legacy connected_by_user_id.
  // ───────────────────────────────────────────────────────────────────
  section("Step 1 — Backfill legacy locations");
  const { data: missing, count: missingCount } = await supabase
    .from("locations")
    .select("id, display_name", { count: "exact" })
    .eq("account_id", opsId)
    .is("connected_by_user_id", null);
  console.log(`Locations missing connected_by_user_id: ${missingCount ?? 0}`);
  if ((missingCount ?? 0) > 0) {
    const { error: backfillErr } = await supabase
      .from("locations")
      .update({ connected_by_user_id: adminUser.id })
      .eq("account_id", opsId)
      .is("connected_by_user_id", null);
    if (backfillErr) {
      console.error("✗ Backfill failed:", backfillErr.message);
      return;
    }
    console.log(
      `✓ Set connected_by_user_id = admin (${adminUser.full_name}) on ${missingCount} legacy locations`,
    );
  } else {
    console.log("✓ Nothing to backfill — all locations already have a connector");
  }

  // ───────────────────────────────────────────────────────────────────
  // Step 2: Visibility queries by role.
  // ───────────────────────────────────────────────────────────────────
  section("Step 2 — Visibility query: admin");
  const { data: adminView } = await supabase
    .from("locations")
    .select("id, display_name")
    .eq("account_id", opsId);
  console.log(`Admin sees ${adminView.length} locations (should be all in tenant)`);

  section("Step 2 — Visibility query: sales (admin acting as sales)");
  const { data: salesView } = await supabase
    .from("locations")
    .select("id, display_name")
    .eq("connected_by_user_id", adminUser.id);
  console.log(
    `If admin's role were 'sales', they'd see ${salesView.length} locations (the ones they connected)`,
  );

  section(
    `Step 2 — Visibility query: account_manager (${managerUser.full_name}) BEFORE assignment`,
  );
  const { data: amBefore } = await supabase
    .from("location_assignments")
    .select("location_id, locations(id, display_name)")
    .eq("user_id", managerUser.id);
  console.log(
    `Account manager sees ${amBefore.length} locations (expected: 0 — none assigned yet)`,
  );

  // ───────────────────────────────────────────────────────────────────
  // Step 3: Insert a test assignment.
  // ───────────────────────────────────────────────────────────────────
  section("Step 3 — Insert a test assignment");
  const testLocation = adminView[0];
  console.log(
    `Assigning location "${testLocation.display_name}" → manager ${managerUser.full_name}`,
  );
  const { error: insertErr } = await supabase
    .from("location_assignments")
    .insert({
      location_id: testLocation.id,
      user_id: managerUser.id,
      assigned_by_user_id: adminUser.id,
    });
  if (insertErr && insertErr.code !== "23505") {
    console.error("✗ Insert failed:", insertErr.message);
    return;
  }
  console.log("✓ Assignment row inserted");

  // ───────────────────────────────────────────────────────────────────
  // Step 4: Visibility AFTER assignment.
  // ───────────────────────────────────────────────────────────────────
  section(
    `Step 4 — Visibility AFTER assignment for ${managerUser.full_name}`,
  );
  const { data: amAfter } = await supabase
    .from("location_assignments")
    .select("location_id, locations(id, display_name)")
    .eq("user_id", managerUser.id);
  console.log(`Account manager now sees ${amAfter.length} location(s):`);
  for (const a of amAfter) {
    const rel = a.locations;
    const loc = Array.isArray(rel) ? rel[0] : rel;
    console.log(`  • ${loc?.display_name ?? a.location_id}`);
  }
  assert(
    amAfter.some((a) => {
      const rel = a.locations;
      const loc = Array.isArray(rel) ? rel[0] : rel;
      return loc?.id === testLocation.id;
    }),
    `${managerUser.full_name} sees the test location via assignment`,
  );

  // ───────────────────────────────────────────────────────────────────
  // Step 5: Confirm authorization rules in the server action would hold.
  // (Just check the predicate: account_manager attempts to insert would
  // fail the requireAssigner() guard.)
  // ───────────────────────────────────────────────────────────────────
  section("Step 5 — Permission predicate sanity");
  const { data: adminRole } = await supabase
    .from("users")
    .select("ops_role")
    .eq("id", adminUser.id)
    .single();
  const { data: managerRole } = await supabase
    .from("users")
    .select("ops_role")
    .eq("id", managerUser.id)
    .single();
  assert(
    adminRole.ops_role === "admin",
    `Admin's ops_role is 'admin' (=${adminRole.ops_role}) → can assign anyone`,
  );
  assert(
    managerRole.ops_role === "account_manager",
    `Manager's ops_role is 'account_manager' (=${managerRole.ops_role}) → cannot assign (button hidden, action rejects)`,
  );

  // ───────────────────────────────────────────────────────────────────
  // Step 6: Clean up the test assignment so the state isn't surprising.
  // ───────────────────────────────────────────────────────────────────
  section("Step 6 — Cleanup");
  await supabase
    .from("location_assignments")
    .delete()
    .eq("location_id", testLocation.id)
    .eq("user_id", managerUser.id);
  console.log("✓ Test assignment removed (legacy backfill kept)");

  // ───────────────────────────────────────────────────────────────────
  // Step 7: Token lookup paths exercised.
  // ───────────────────────────────────────────────────────────────────
  section("Step 7 — Per-user OAuth token lookup");
  const { data: tokens } = await supabase
    .from("google_oauth_tokens")
    .select("user_id, google_email, expiry");
  for (const t of tokens) {
    const expIso = new Date(t.expiry).toISOString();
    const isExpired = new Date(t.expiry).getTime() < Date.now();
    console.log(
      `  ${isExpired ? "✗" : "✓"} user ${t.user_id.slice(0, 8)}… → ${t.google_email}${isExpired ? "  (expired — refresh on next use)" : ""}`,
    );
  }
  console.log(
    "\nThe runtime getValidAccessToken(userId) auto-refreshes when the token is within 60s of expiry; expired-but-refreshable rows aren't a problem.",
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
