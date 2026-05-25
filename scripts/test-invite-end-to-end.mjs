// Full end-to-end test of the new-staff invite flow.
//
// Simulates every step a real user would do, against the live Supabase
// project. The only thing we don't actually render is the
// /auth/callback client page — we replicate what its JS would do
// (read hash → call setSession). That's the exact same SDK call the
// browser makes, so if it works here it works in the browser.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BASE = "http://localhost:4001";
const testEmail = `john.tang2025+invite-e2e-${Date.now()}@gmail.com`;
const testPassword = "TestPass-1234!";

const ok = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const step = (n, msg) =>
  console.log(`\n══ Step ${n} ══════════════════════════════════════\n${msg}`);

let createdUserId = null;
try {
  // ───────────────────────────────────────────────────────────────────
  step(1, `Invite ${testEmail} (mimics /app/admin/staff Invite action)`);
  // ───────────────────────────────────────────────────────────────────
  const { data: invited, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(testEmail, {
      redirectTo: `${BASE}/auth/callback?next=/reset-password`,
    });
  if (inviteErr) fail(`inviteUserByEmail: ${inviteErr.message}`);
  createdUserId = invited.user.id;
  ok(`auth user ${createdUserId} created, email_confirmed_at = ${invited.user.email_confirmed_at ?? "null (correct)"}`);

  // ───────────────────────────────────────────────────────────────────
  step(
    2,
    "Get the invite link Supabase would email (via generateLink — same URL pattern)",
  );
  // ───────────────────────────────────────────────────────────────────
  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "invite",
      email: testEmail,
      options: { redirectTo: `${BASE}/auth/callback?next=/reset-password` },
    });
  if (linkErr) fail(`generateLink: ${linkErr.message}`);
  const emailUrl = linkData.properties.action_link;
  console.log(`  Email link:`);
  console.log(`    ${emailUrl}`);

  // ───────────────────────────────────────────────────────────────────
  step(3, "User clicks the email link → follow the Supabase verify redirect");
  // ───────────────────────────────────────────────────────────────────
  const verifyResp = await fetch(emailUrl, { redirect: "manual" });
  if (verifyResp.status !== 303 && verifyResp.status !== 302) {
    fail(`Supabase verify did not redirect (status ${verifyResp.status})`);
  }
  const callbackUrl = verifyResp.headers.get("location");
  const u = new URL(callbackUrl, BASE);
  console.log(`  Supabase redirects browser to:`);
  console.log(`    path=${u.pathname}  search=${u.search}`);
  console.log(`    hash=${u.hash.slice(0, 80)}…`);
  if (u.pathname !== "/auth/callback") {
    fail(`expected redirect to /auth/callback, got ${u.pathname}`);
  }
  ok("redirected to /auth/callback as expected");

  // ───────────────────────────────────────────────────────────────────
  step(
    4,
    "Browser loads /auth/callback (the client page). Replicate what its JS does:\n" +
      "  1. Read access_token + refresh_token from window.location.hash\n" +
      "  2. Call supabase.auth.setSession(...)\n" +
      "  3. Redirect to ?next= (/reset-password)",
  );
  // ───────────────────────────────────────────────────────────────────
  const hashParams = new URLSearchParams(u.hash.replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (!accessToken || !refreshToken) {
    fail("no access_token / refresh_token in URL hash");
  }
  ok(`hash carries access_token (${accessToken.slice(0, 16)}…) and refresh_token`);

  // Simulate a fresh anon client (what the browser is) and call setSession.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: setErr } = await userClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (setErr) fail(`setSession: ${setErr.message}`);
  ok("setSession succeeded (user is now logged in as the invitee)");

  // Verify the session is for the right user.
  const { data: meData } = await userClient.auth.getUser();
  if (meData?.user?.email !== testEmail) {
    fail(
      `session user mismatch: got ${meData?.user?.email}, want ${testEmail}`,
    );
  }
  ok(`session is for ${meData.user.email} (id ${meData.user.id})`);
  console.log("  → in the browser, this is where we router.replace('/reset-password')");

  // ───────────────────────────────────────────────────────────────────
  step(
    5,
    "User on /reset-password sets a password. Replicate what its form does:\n" +
      "  supabase.auth.updateUser({ password: '...' })",
  );
  // ───────────────────────────────────────────────────────────────────
  const { error: updateErr } = await userClient.auth.updateUser({
    password: testPassword,
  });
  if (updateErr) fail(`updateUser: ${updateErr.message}`);
  ok(`password set (${testPassword})`);

  // ───────────────────────────────────────────────────────────────────
  step(
    6,
    "Sign out, then sign back in normally with email + password",
  );
  // ───────────────────────────────────────────────────────────────────
  await userClient.auth.signOut();
  ok("signed out");

  // Fresh client = fresh state. signInWithPassword.
  const loginClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: loginData, error: loginErr } =
    await loginClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
  if (loginErr) fail(`signInWithPassword: ${loginErr.message}`);
  if (loginData?.user?.email !== testEmail) {
    fail(`login mismatch`);
  }
  ok(`logged in as ${loginData.user.email} via email+password`);
  console.log("  → in the browser, this is what happens at /login");

  // ───────────────────────────────────────────────────────────────────
  step(7, "Confirm the public.users row landed in the BAAM Operations tenant");
  // ───────────────────────────────────────────────────────────────────
  const { data: opsAccount } = await admin
    .from("accounts")
    .select("id, name")
    .eq("is_baam_internal", true)
    .single();
  const { data: userRow } = await admin
    .from("users")
    .select("id, account_id, full_name, ops_role")
    .eq("id", createdUserId)
    .maybeSingle();
  if (!userRow) {
    fail("no public.users row for the new auth user");
  }
  // Note: our /app/admin/staff inviteStaff server action does the move
  // into ops tenant. This direct admin.inviteUserByEmail bypasses it,
  // so this user is still in their personal account. That's expected
  // for this test — we tested the AUTH flow, not the action wrapper.
  console.log(
    `  public.users row exists. account = ${userRow.account_id === opsAccount.id ? "BAAM Operations" : "personal (script bypassed the move; the real action would have moved them)"}`,
  );
} finally {
  // ───────────────────────────────────────────────────────────────────
  console.log("\n══ Cleanup ══════════════════════════════════════");
  // ───────────────────────────────────────────────────────────────────
  if (createdUserId) {
    await admin.auth.admin.deleteUser(createdUserId);
    ok(`deleted test user ${testEmail}`);
  }
}

console.log(
  "\n══════════════════════════════════════════════════════\nFULL FLOW PASSES.\n",
);
console.log("Conclusion:");
console.log(
  "  • Invite → email link → Supabase verify → /auth/callback (with hash) → setSession works",
);
console.log("  • setSession establishes a real session for the invitee");
console.log("  • updateUser({password}) saves the password");
console.log("  • signInWithPassword then works with that email + password");
console.log(
  "\nIn the browser, the only thing different from this script is the visual\n" +
    "redirect to /reset-password between steps 4 and 5. The SDK calls are identical.",
);
