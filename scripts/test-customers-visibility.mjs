// Mirror the customers page query for each role against live data,
// without going through the dev server. Reports what each role sees.

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

const { data: users } = await sb
  .from("users")
  .select("id, full_name, ops_role")
  .eq("account_id", ops.id);

const { data: auth } = await sb.auth.admin.listUsers({ perPage: 1000 });
const emailById = new Map(auth.users.map((u) => [u.id, u.email]));

async function visibleForRole(user) {
  // BAAM Ops locations the user can see
  let opsLocs;
  if (user.ops_role === "admin" || user.ops_role === null) {
    const { data } = await sb
      .from("locations")
      .select("id, display_name, customer_record_id, connected_by_user_id")
      .eq("account_id", ops.id);
    opsLocs = data;
  } else if (user.ops_role === "sales") {
    const { data } = await sb
      .from("locations")
      .select("id, display_name, customer_record_id, connected_by_user_id")
      .eq("account_id", ops.id)
      .eq("connected_by_user_id", user.id);
    opsLocs = data;
  } else if (user.ops_role === "account_manager") {
    const { data } = await sb
      .from("location_assignments")
      .select(
        "location_id, locations(id, display_name, customer_record_id, connected_by_user_id)",
      )
      .eq("user_id", user.id);
    opsLocs = (data ?? [])
      .map((r) => (Array.isArray(r.locations) ? r.locations[0] : r.locations))
      .filter(Boolean);
  } else {
    opsLocs = [];
  }

  // Pending Start Now (admin only)
  let pending = [];
  if (user.ops_role === "admin" || user.ops_role === null) {
    const { data } = await sb
      .from("customer_records")
      .select("id, business_name")
      .eq("onboarding_status", "pending_gbp_connect");
    pending = data;
  }

  // Self-service accounts (admin only)
  let selfServe = [];
  if (user.ops_role === "admin" || user.ops_role === null) {
    const { data } = await sb
      .from("accounts")
      .select("id, name")
      .eq("is_baam_internal", false);
    selfServe = data;
  }

  return { opsLocs, pending, selfServe };
}

console.log("\n══ /app/customers visibility per role ══\n");
for (const u of users) {
  const v = await visibleForRole(u);
  const total = v.opsLocs.length + v.pending.length + v.selfServe.length;
  console.log(
    `── ${u.full_name} (${u.ops_role ?? "no role"}) — ${emailById.get(u.id)}`,
  );
  console.log(
    `   ${total} customer(s):  ${v.opsLocs.length} ops · ${v.pending.length} pending Start Now · ${v.selfServe.length} self-service`,
  );
  const startNowCount = v.opsLocs.filter((l) => l.customer_record_id).length;
  const regularSalesCount = v.opsLocs.filter(
    (l) => !l.customer_record_id,
  ).length;
  if (v.opsLocs.length > 0) {
    console.log(
      `     → of which: ${startNowCount} Start Now-connected, ${regularSalesCount} Regular Sales`,
    );
  }
  console.log("");
}
