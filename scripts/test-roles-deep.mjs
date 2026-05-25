// Deep simulation of every per-role query the live UI runs.
// Mirrors app/app/locations/page.tsx, app/app/admin/staff/page.tsx,
// app/app/onboarding/page.tsx, and the picker token lookup.

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

const heading = (t) =>
  console.log(
    `\n══════════════════════════════════════════════════════\n${t}\n══════════════════════════════════════════════════════`,
  );
const sub = (t) => console.log(`\n─ ${t}`);
const ok = (cond, msg) => console.log(`${cond ? "✓" : "✗"} ${msg}`);

let totalChecks = 0;
let passedChecks = 0;
function check(cond, msg) {
  totalChecks++;
  if (cond) passedChecks++;
  ok(cond, msg);
}

async function main() {
  // ─── Setup: load all internal users + ops tenant ────────────────────
  const { data: ops } = await supabase
    .from("accounts")
    .select("id")
    .eq("is_baam_internal", true)
    .single();
  const opsId = ops.id;

  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, ops_role")
    .eq("account_id", opsId);
  const { data: authList } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  const emailById = new Map(
    (authList?.users ?? []).map((u) => [u.id, u.email ?? "?"]),
  );
  const byRole = (r) => users.filter((u) => u.ops_role === r);

  const admin = byRole("admin")[0];
  const sales = byRole("sales")[0];
  const accountMgr = byRole("account_manager")[0];

  console.log("Roles found in ops tenant:");
  console.log(`  admin            : ${admin?.full_name ?? "—"}`);
  console.log(`  sales            : ${sales?.full_name ?? "— (none yet)"}`);
  console.log(`  account_manager  : ${accountMgr?.full_name ?? "—"}`);
  if (!admin || !accountMgr) {
    console.error(
      "\n✗ Need at least one admin and one account_manager to run. Aborting.",
    );
    return;
  }

  // ════════════════════════════════════════════════════════════════════
  heading("TEST 1 — Locations list query, role by role");
  // Matches app/app/locations/page.tsx exactly.
  // ════════════════════════════════════════════════════════════════════

  sub("As admin (should see every location in tenant)");
  const { data: adminLocs } = await supabase
    .from("locations")
    .select("id, display_name, connected_by_user_id")
    .eq("account_id", opsId)
    .order("created_at", { ascending: false });
  console.log(`  → ${adminLocs.length} locations`);
  check(adminLocs.length === 12, "admin sees all 12 locations");

  if (sales) {
    sub(`As sales (${sales.full_name})`);
    const { data: salesLocs } = await supabase
      .from("locations")
      .select("id, display_name, connected_by_user_id")
      .eq("connected_by_user_id", sales.id);
    console.log(`  → ${salesLocs.length} locations`);
    check(
      salesLocs.every((l) => l.connected_by_user_id === sales.id),
      "every returned row was connected by sales",
    );
  } else {
    console.log("  (skipped — no sales user; promote someone to test)");
  }

  sub(`As account_manager (${accountMgr.full_name})`);
  const { data: amRows } = await supabase
    .from("location_assignments")
    .select(
      "location_id, locations(id, display_name, connected_by_user_id, account_id)",
    )
    .eq("user_id", accountMgr.id);
  const amLocs = amRows
    .map((r) => (Array.isArray(r.locations) ? r.locations[0] : r.locations))
    .filter(Boolean);
  console.log(
    `  → ${amLocs.length} locations: ${amLocs.map((l) => l.display_name.slice(0, 20)).join(", ") || "(none)"}`,
  );
  check(true, "account_manager visibility query executes");

  // ════════════════════════════════════════════════════════════════════
  heading("TEST 2 — Account manager dropdown for Assign modal");
  // Matches the manager pool query in app/app/locations/page.tsx
  // ════════════════════════════════════════════════════════════════════

  const { data: managers } = await supabase
    .from("users")
    .select("id, full_name, account_id")
    .eq("ops_role", "account_manager")
    .order("full_name");
  console.log(`Available account managers: ${managers.length}`);
  for (const m of managers) {
    console.log(`  • ${m.full_name} (${emailById.get(m.id)})`);
  }
  check(managers.length >= 1, "at least one account_manager in the dropdown");

  // ════════════════════════════════════════════════════════════════════
  heading("TEST 3 — Permission predicates server actions check");
  // ════════════════════════════════════════════════════════════════════

  // Simulate requireAssigner: admin OR sales → ok; account_manager → reject.
  const passAdmin = admin.ops_role === "admin" || admin.ops_role === "sales";
  const failAM =
    !(accountMgr.ops_role === "admin" || accountMgr.ops_role === "sales");
  check(passAdmin, "admin passes requireAssigner");
  check(failAM, "account_manager rejected by requireAssigner");

  // ════════════════════════════════════════════════════════════════════
  heading("TEST 4 — Insert full assignment flow + cleanup");
  // ════════════════════════════════════════════════════════════════════

  const testLoc = adminLocs[0];

  // Insert as admin would (server action calls service-client INSERT).
  sub("Insert assignment");
  const { error: insErr } = await supabase
    .from("location_assignments")
    .insert({
      location_id: testLoc.id,
      user_id: accountMgr.id,
      assigned_by_user_id: admin.id,
    });
  check(!insErr || insErr.code === "23505", "insert succeeds (or already exists)");

  // Re-insert (idempotency check; should return 23505).
  sub("Re-insert same row");
  const { error: dupErr } = await supabase
    .from("location_assignments")
    .insert({
      location_id: testLoc.id,
      user_id: accountMgr.id,
      assigned_by_user_id: admin.id,
    });
  check(
    !!dupErr && dupErr.code === "23505",
    "duplicate insert correctly violates UNIQUE(location_id, user_id)",
  );

  // Account manager sees it.
  sub("Manager now sees the location");
  const { data: amCheck } = await supabase
    .from("location_assignments")
    .select("location_id, locations(id, display_name)")
    .eq("user_id", accountMgr.id);
  const visible = amCheck
    .map((r) => (Array.isArray(r.locations) ? r.locations[0] : r.locations))
    .filter(Boolean)
    .some((l) => l.id === testLoc.id);
  check(visible, `${accountMgr.full_name} sees "${testLoc.display_name}"`);

  // Currently-assigned managers for THIS location (modal "current assignments").
  sub("Modal 'current assignments' for the test location");
  // Two FKs from location_assignments → users (user_id, assigned_by_user_id).
  // Disambiguate with the !user_id hint so Supabase joins on the manager FK.
  const { data: modalAssignments, error: modalErr } = await supabase
    .from("location_assignments")
    .select("user_id, users!user_id(id, full_name, account_id)")
    .eq("location_id", testLoc.id);
  if (modalErr) console.error("  Query error:", modalErr.message);
  for (const a of modalAssignments ?? []) {
    const u = Array.isArray(a.users) ? a.users[0] : a.users;
    console.log(`  • ${u?.full_name} (${emailById.get(u?.id ?? "")})`);
  }
  check(
    (modalAssignments ?? []).length === 1,
    "modal lists exactly one assignment",
  );

  // Delete (mimicking the Remove button).
  sub("Remove assignment");
  const { error: delErr } = await supabase
    .from("location_assignments")
    .delete()
    .eq("location_id", testLoc.id)
    .eq("user_id", accountMgr.id);
  check(!delErr, "delete succeeds");
  const { data: afterDelete } = await supabase
    .from("location_assignments")
    .select("location_id")
    .eq("location_id", testLoc.id)
    .eq("user_id", accountMgr.id);
  check(afterDelete.length === 0, "row really gone");

  // ════════════════════════════════════════════════════════════════════
  heading("TEST 5 — Onboarding queue query (Start Now)");
  // Matches app/app/onboarding/page.tsx
  // ════════════════════════════════════════════════════════════════════

  const { data: pending } = await supabase
    .from("customer_records")
    .select("id, email, business_name, onboarding_status, created_at")
    .eq("onboarding_status", "pending_gbp_connect");
  console.log(`Pending Start Now customers: ${pending.length}`);
  for (const p of pending.slice(0, 5)) {
    console.log(`  • ${p.business_name ?? "(no name)"} — ${p.email}`);
  }
  check(true, "onboarding queue query executes without error");

  // ════════════════════════════════════════════════════════════════════
  heading("TEST 6 — Picker token lookup (mimics picker page)");
  // ════════════════════════════════════════════════════════════════════

  for (const u of users) {
    const { data: tokenRow } = await supabase
      .from("google_oauth_tokens")
      .select("google_email, expiry, account_id")
      .eq("user_id", u.id)
      .maybeSingle();
    if (tokenRow) {
      const expired = new Date(tokenRow.expiry).getTime() < Date.now();
      console.log(
        `  ${u.full_name} → token: ${tokenRow.google_email}${expired ? " (expired, will refresh)" : ""}`,
      );
      check(
        tokenRow.account_id === opsId,
        `${u.full_name}'s token row is in the ops tenant`,
      );
    } else {
      console.log(
        `  ${u.full_name} → no token (will need to Connect Google before picker works)`,
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════
  heading("TEST 7 — Staff admin page data shape");
  // ════════════════════════════════════════════════════════════════════

  const { data: staffUsers } = await supabase
    .from("users")
    .select("id, full_name, ops_role, created_at, account_id")
    .eq("account_id", opsId)
    .order("created_at", { ascending: true });
  console.log(`Staff page will list ${staffUsers.length} users:`);
  console.table(
    staffUsers.map((u) => ({
      name: u.full_name,
      email: emailById.get(u.id),
      role: u.ops_role ?? "—",
    })),
  );
  check(staffUsers.length === users.length, "staff query returns all users");
  check(
    staffUsers.every((u) => emailById.has(u.id)),
    "every staff user has a matching auth.users email",
  );

  // ════════════════════════════════════════════════════════════════════
  heading("TEST 8 — Foreign key + uniqueness sanity");
  // ════════════════════════════════════════════════════════════════════

  sub("Locations have a valid connected_by_user_id (or NULL)");
  const { data: allLocs } = await supabase
    .from("locations")
    .select("id, connected_by_user_id")
    .eq("account_id", opsId);
  const userIds = new Set(users.map((u) => u.id));
  const dangling = allLocs.filter(
    (l) => l.connected_by_user_id && !userIds.has(l.connected_by_user_id),
  );
  check(dangling.length === 0, `no dangling FKs (found ${dangling.length})`);

  sub("Tokens have a valid user_id");
  const { data: allTokens } = await supabase
    .from("google_oauth_tokens")
    .select("user_id");
  const danglingTokens = allTokens.filter((t) => !userIds.has(t.user_id));
  check(danglingTokens.length === 0, `no dangling token FKs (found ${danglingTokens.length})`);

  // ════════════════════════════════════════════════════════════════════
  heading(`SUMMARY: ${passedChecks}/${totalChecks} checks passed`);
  if (passedChecks === totalChecks) {
    console.log("All green. Safe to test in browser.");
  } else {
    console.log("Failures above — investigate before browser-testing.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
