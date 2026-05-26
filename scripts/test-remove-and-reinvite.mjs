// Live end-to-end test of the Remove → Re-invite flow.
// Mirrors what the /app/admin/staff action does, so if this passes the
// production flow passes (same SDK calls, same DB).

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

const ok = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const testEmail = `john.tang2025+remove-test-${Date.now()}@gmail.com`;
console.log(`\nTest target: ${testEmail}\n`);

// ── Setup ─────────────────────────────────────────────────────────────
console.log("── Step 1: provision a fresh user into the ops tenant ──");
const { data: ops } = await sb
  .from("accounts")
  .select("id")
  .eq("is_baam_internal", true)
  .single();
const { data: admin } = await sb
  .from("users")
  .select("id")
  .eq("account_id", ops.id)
  .eq("ops_role", "admin")
  .limit(1)
  .single();

const { data: created, error: createErr } = await sb.auth.admin.createUser({
  email: testEmail,
  password: "Test1234!",
  email_confirm: true,
});
if (createErr) fail(`createUser: ${createErr.message}`);
const testUserId = created.user.id;
ok(`auth user created (id ${testUserId.slice(0, 8)}…)`);

// Wait for handle_new_user trigger.
await new Promise((r) => setTimeout(r, 300));

// Move into ops tenant as account_manager.
const { data: userRow } = await sb
  .from("users")
  .select("account_id")
  .eq("id", testUserId)
  .maybeSingle();
const personalAccountId = userRow?.account_id;
await sb
  .from("users")
  .update({ account_id: ops.id, ops_role: "account_manager" })
  .eq("id", testUserId);
if (personalAccountId && personalAccountId !== ops.id) {
  await sb.from("accounts").delete().eq("id", personalAccountId);
}
ok(`moved into ops tenant as account_manager`);

// Add a test location_assignment so we can verify cascade.
const { data: someLocation } = await sb
  .from("locations")
  .select("id, display_name")
  .eq("account_id", ops.id)
  .limit(1)
  .maybeSingle();
if (someLocation) {
  await sb.from("location_assignments").insert({
    location_id: someLocation.id,
    user_id: testUserId,
    assigned_by_user_id: admin.id,
  });
  ok(`assigned to "${someLocation.display_name}" for cascade-check`);
}

// ── Step 2: pre-delete sanity ─────────────────────────────────────────
console.log("\n── Step 2: pre-delete state ──");
const before = await preDeleteSnapshot(testUserId);
console.log(JSON.stringify(before, null, 2));

// ── Step 3: simulate Remove action ────────────────────────────────────
console.log("\n── Step 3: call auth.admin.deleteUser (the new Remove action) ──");
const { error: deleteErr } = await sb.auth.admin.deleteUser(testUserId);
if (deleteErr) fail(`deleteUser: ${deleteErr.message}`);
ok(`auth.users row deleted`);

// ── Step 4: verify cascade ────────────────────────────────────────────
console.log("\n── Step 4: post-delete state ──");
const after = await preDeleteSnapshot(testUserId);
console.log(JSON.stringify(after, null, 2));

if (after.authUser) fail(`auth.users still present`);
ok(`auth.users gone`);
if (after.publicUser) fail(`public.users still present (cascade FK missing?)`);
ok(`public.users gone via cascade`);
if (after.assignmentsAsUser > 0)
  fail(`location_assignments still has rows (cascade not working)`);
ok(`location_assignments rows gone via cascade`);

// ── Step 5: re-invite ─────────────────────────────────────────────────
console.log("\n── Step 5: re-invite the same email ──");
const { data: invited, error: inviteErr } =
  await sb.auth.admin.inviteUserByEmail(testEmail, {
    redirectTo: "https://review.baamplatform.com/auth/callback?next=/reset-password",
  });
if (inviteErr) fail(`re-invite failed: ${inviteErr.message}`);
ok(`re-invite created new auth.users row (id ${invited.user.id.slice(0, 8)}…)`);
console.log(
  `  confirmed_at: ${invited.user.confirmed_at ?? "null (correct — needs to confirm via email)"}`,
);

// ── Cleanup ───────────────────────────────────────────────────────────
console.log("\n── Cleanup ──");
await sb.auth.admin.deleteUser(invited.user.id);
ok(`removed re-invited test user`);

console.log(
  "\n══════════════════════════════════════════════════════\n" +
    "  REMOVE → RE-INVITE FLOW WORKS  \n" +
    "══════════════════════════════════════════════════════\n",
);

async function preDeleteSnapshot(userId) {
  const [{ data: au }, { data: pu }, { count: asgn }] = await Promise.all([
    sb.auth.admin.getUserById(userId).catch(() => ({ data: null })),
    sb.from("users").select("id, account_id, ops_role").eq("id", userId).maybeSingle(),
    sb
      .from("location_assignments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);
  return {
    authUser: au?.user
      ? { id: au.user.id.slice(0, 8) + "…", email: au.user.email }
      : null,
    publicUser: pu
      ? { account_id: pu.account_id.slice(0, 8) + "…", ops_role: pu.ops_role }
      : null,
    assignmentsAsUser: asgn ?? 0,
  };
}
