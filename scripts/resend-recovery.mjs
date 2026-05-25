// Send a fresh password-recovery email to a user who got an invite link
// with a bad redirect_to and is now stuck on /login.
//
// Usage:  node scripts/resend-recovery.mjs <email> [<base-url>]
// Example: node scripts/resend-recovery.mjs support@baamplatform.com http://localhost:4001

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const email = process.argv[2];
const base = process.argv[3] ?? "https://review.baamplatform.com";
if (!email) {
  console.error("Usage: node scripts/resend-recovery.mjs <email> [<base-url>]");
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Find the user first so we can report a clear error if they don't exist.
const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
const user = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user with email ${email}`);
  process.exit(1);
}

const redirectTo = `${base}/auth/callback?next=/reset-password`;
console.log(`Sending recovery to ${email}`);
console.log(`  redirect_to: ${redirectTo}`);

const { data, error } = await sb.auth.admin.generateLink({
  type: "recovery",
  email,
  options: { redirectTo },
});
if (error) {
  console.error("✗ generateLink failed:", error.message);
  process.exit(1);
}

console.log("\n✓ Recovery email sent.");
console.log(
  "  The user should receive a 'Reset your password' email shortly.",
);
console.log(
  "  Clicking the link → /auth/callback exchanges the code → /reset-password lets them set a password.",
);
if (data?.properties?.action_link) {
  console.log("\n  Direct link (for copy-paste if email is slow):");
  console.log(`  ${data.properties.action_link}`);
}
