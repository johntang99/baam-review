// Send (and print) a password-recovery link that goes DIRECTLY to our
// /auth/callback?token_hash=… — bypassing Supabase's /auth/v1/verify
// endpoint, which on PKCE projects emits ?code=… and requires a
// code_verifier cookie that doesn't exist when the flow was initiated
// from a script instead of the user's browser.
//
// Uses auth.admin.generateLink to obtain the hashed token, then builds
// the final URL the user can click.
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

console.log(`Generating recovery link for ${email}`);
const { data, error } = await sb.auth.admin.generateLink({
  type: "recovery",
  email,
  options: { redirectTo: `${base}/reset-password` },
});

if (error || !data?.properties) {
  console.error("✗ generateLink failed:", error?.message ?? "no properties");
  process.exit(1);
}

// hashed_token + verification_type are the inputs to verifyOtp.
const { hashed_token, verification_type } = data.properties;
const directUrl = `${base}/auth/callback?token_hash=${hashed_token}&type=${verification_type}&next=/reset-password`;

console.log("\n✓ Link generated.");
console.log(
  "\nUser will receive a 'Reset Your Password' email shortly (Supabase auto-sends).",
);
console.log(
  "If the email link still bounces (because Supabase's verify endpoint uses PKCE),",
);
console.log("paste the URL below into a browser instead:\n");
console.log(directUrl);
console.log(
  "\nThis URL goes straight to /auth/callback, no Supabase /verify step, no PKCE cookie required.",
);
