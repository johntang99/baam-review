// Clean test: invite, generate fresh link, hit our /auth/callback directly
// with the unconsumed token_hash to see if the callback can establish a
// session and redirect correctly.

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

const BASE = "http://localhost:4001";
const testEmail = `john.tang2025+invite-test-${Date.now()}@gmail.com`;

console.log(`─── Test invite for ${testEmail} ───`);

const { data: invited, error: inviteErr } =
  await sb.auth.admin.inviteUserByEmail(testEmail, {
    redirectTo: `${BASE}/auth/callback?next=/reset-password`,
  });
if (inviteErr) {
  console.error("invite failed:", inviteErr.message);
  process.exit(1);
}
console.log(`✓ Created auth user ${invited.user.id}`);

console.log("\n─── Generate a separate fresh link to inspect ───");
const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
  type: "invite",
  email: testEmail,
  options: { redirectTo: `${BASE}/auth/callback?next=/reset-password` },
});
if (linkErr) {
  console.error("generateLink failed:", linkErr.message);
  process.exit(1);
}
console.log("Email-link (what's in inbox today):");
console.log("  ", linkData.properties.action_link);

console.log("\n─── Inspect Supabase's verify response ───");
const resp1 = await fetch(linkData.properties.action_link, {
  redirect: "manual",
});
console.log(`Status: ${resp1.status}`);
console.log(`Location: ${resp1.headers.get("location")}`);
const loc = new URL(resp1.headers.get("location"), BASE);
console.log(`  → path: ${loc.pathname}`);
console.log(`  → search: ${loc.search || "(none)"}`);
console.log(`  → hash:   ${loc.hash ? loc.hash.slice(0, 60) + "…" : "(none)"}`);
console.log(
  "\nIf the hash starts with #access_token=…, the project is in implicit flow.",
);
console.log(
  "Server-side /auth/callback can't read the hash → user lands wherever the page does",
);
console.log(
  "with no session → middleware bounces them to /login.",
);

console.log("\n─── Test the DIRECT path our callback can handle ───");
console.log(
  "Generating a fresh link (because the one above is now consumed),",
);
console.log("then hitting /auth/callback?token_hash=… on dev server:");

const { data: linkData2 } = await sb.auth.admin.generateLink({
  type: "invite",
  email: testEmail,
  options: { redirectTo: `${BASE}/auth/callback?next=/reset-password` },
});
const directUrl = `${BASE}/auth/callback?token_hash=${linkData2.properties.hashed_token}&type=invite&next=/reset-password`;
console.log("  GET", directUrl);
const resp2 = await fetch(directUrl, { redirect: "manual" });
console.log(`  Status: ${resp2.status}`);
const loc2 = resp2.headers.get("location");
console.log(`  Location: ${loc2}`);
if (loc2) {
  const u2 = new URL(loc2, BASE);
  if (u2.pathname === "/reset-password") {
    console.log(
      "\n  ✓✓ DIRECT path works — callback verified the token and redirected to /reset-password.",
    );
    console.log(
      "  So if the EMAIL link pointed here too, the flow would work.",
    );
  } else {
    console.log(`\n  ✗ Landed on ${u2.pathname} — ${u2.searchParams.get("error") ?? "unknown reason"}`);
  }
}

console.log("\n─── Cleanup ───");
await sb.auth.admin.deleteUser(invited.user.id);
console.log("✓ deleted", testEmail);
