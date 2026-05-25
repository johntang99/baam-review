// Simulate the visibility filter as each role and report what they see.
// Tests against live data without changing any of it.

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

const { data: opsAccount } = await sb
  .from("accounts")
  .select("id")
  .eq("is_baam_internal", true)
  .single();
const opsId = opsAccount.id;

const { data: users } = await sb
  .from("users")
  .select("id, full_name, ops_role")
  .eq("account_id", opsId)
  .order("ops_role", { ascending: true });
const { data: authList } = await sb.auth.admin.listUsers({ perPage: 1000 });
const emailById = new Map(
  (authList?.users ?? []).map((u) => [u.id, u.email]),
);

const { data: allLocs } = await sb
  .from("locations")
  .select("id, display_name")
  .eq("account_id", opsId)
  .order("display_name");
const allIds = allLocs.map((l) => l.id);

console.log(
  `\n══ Ops tenant has ${allLocs.length} locations and ${users.length} staff users.\n`,
);

// Mirror the helper exactly.
async function getVisibleIds(user) {
  if (user.ops_role === "admin" || user.ops_role === null) return null;
  if (user.ops_role === "sales") {
    const { data } = await sb
      .from("locations")
      .select("id")
      .eq("connected_by_user_id", user.id);
    return (data ?? []).map((r) => r.id);
  }
  if (user.ops_role === "account_manager") {
    const { data } = await sb
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", user.id);
    return (data ?? []).map((r) => r.location_id);
  }
  return [];
}

for (const u of users) {
  const visible = await getVisibleIds(u);
  const visibleSet = visible === null ? null : new Set(visible);
  const count =
    visible === null ? allLocs.length : visible.length;
  console.log(
    `── ${u.full_name} (${u.ops_role ?? "no role"}) — ${emailById.get(u.id)}`,
  );
  console.log(
    `   Sees ${count} of ${allLocs.length} locations` +
      (visible === null ? "  [= all, no filter]" : ""),
  );
  if (visibleSet) {
    for (const loc of allLocs) {
      const mark = visibleSet.has(loc.id) ? "✓" : "·";
      console.log(`     ${mark} ${loc.display_name}`);
    }
  } else {
    for (const loc of allLocs.slice(0, 3)) {
      console.log(`     ✓ ${loc.display_name}`);
    }
    if (allLocs.length > 3) console.log(`     ✓ … and ${allLocs.length - 3} more`);
  }
  console.log("");
}

// Spot-check: pick the account_manager and verify visibility quickly.
const accountMgrs = users.filter((u) => u.ops_role === "account_manager");
if (accountMgrs.length > 0) {
  console.log("══ Per-account_manager assignments");
  const { data: allAssignments } = await sb
    .from("location_assignments")
    .select("location_id, user_id");
  for (const am of accountMgrs) {
    const mine = (allAssignments ?? []).filter((a) => a.user_id === am.id);
    console.log(`  ${am.full_name}: ${mine.length} assignment(s)`);
  }
}
