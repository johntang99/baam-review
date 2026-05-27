// Diagnostic: who actually connected each location in BAAM Operations?
// Reads locations.connected_by_user_id directly and joins to users + auth.
// No dev server, no UI — pure DB truth.

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
  .select("id, name")
  .eq("is_baam_internal", true)
  .single();

const { data: locations } = await sb
  .from("locations")
  .select("id, display_name, connected_by_user_id, created_at, google_place_id")
  .eq("account_id", ops.id)
  .order("created_at", { ascending: true });

const { data: staff } = await sb
  .from("users")
  .select("id, full_name, ops_role")
  .eq("account_id", ops.id);

const { data: auth } = await sb.auth.admin.listUsers({ perPage: 1000 });
const emailById = new Map(auth.users.map((u) => [u.id, u.email]));
const staffById = new Map(staff.map((u) => [u.id, u]));

console.log(`\n══ Staff in ${ops.name} (${staff.length} users) ══\n`);
for (const u of staff) {
  console.log(
    `  • ${u.full_name?.padEnd(24) ?? "(no name)".padEnd(24)} ${(u.ops_role ?? "no role").padEnd(18)} ${emailById.get(u.id) ?? "(no email)"}`,
  );
}

console.log(`\n══ Locations and connector (${locations.length}) ══\n`);
const connectorCounts = new Map();
for (const l of locations) {
  const u = l.connected_by_user_id ? staffById.get(l.connected_by_user_id) : null;
  const name = u?.full_name ?? "(unassigned)";
  const email = l.connected_by_user_id ? emailById.get(l.connected_by_user_id) ?? "(orphan id)" : "—";
  console.log(
    `  • ${l.display_name?.slice(0, 50).padEnd(52) ?? "".padEnd(52)} → ${name.padEnd(20)} ${email}`,
  );
  connectorCounts.set(
    l.connected_by_user_id ?? "null",
    (connectorCounts.get(l.connected_by_user_id ?? "null") ?? 0) + 1,
  );
}

console.log(`\n══ Distinct connectors ══\n`);
for (const [uid, count] of [...connectorCounts.entries()].sort(
  (a, b) => b[1] - a[1],
)) {
  if (uid === "null") {
    console.log(`  • (unassigned)            ${count} location(s)`);
    continue;
  }
  const u = staffById.get(uid);
  const name = u?.full_name ?? "(orphan — user no longer exists)";
  const email = emailById.get(uid) ?? "(unknown)";
  console.log(`  • ${name.padEnd(24)} ${email.padEnd(38)} ${count} location(s)`);
}

console.log(`\n══ google_oauth_tokens (who connected with whose Google account) ══\n`);
const { data: tokens } = await sb
  .from("google_oauth_tokens")
  .select("user_id, google_email, created_at, updated_at");

if (!tokens || tokens.length === 0) {
  console.log("  (no rows)");
} else {
  for (const t of tokens) {
    const u = staffById.get(t.user_id);
    console.log(
      `  • ${(u?.full_name ?? "(unknown user)").padEnd(24)} ops email: ${(emailById.get(t.user_id) ?? "?").padEnd(34)} → google: ${t.google_email ?? "(none)"}`,
    );
  }
}

console.log("\nDone.\n");
