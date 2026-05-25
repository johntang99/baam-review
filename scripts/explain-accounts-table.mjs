// Show that the consolidation moved people, didn't delete them.
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

console.log("\n── accounts table (tenants) ──");
const { data: accounts } = await sb
  .from("accounts")
  .select("id, name, primary_email, is_baam_internal");
console.table(
  accounts.map((a) => ({
    name: a.name,
    email: a.primary_email,
    is_baam_internal: a.is_baam_internal,
  })),
);

console.log("\n── users table (logins) ──");
const { data: users } = await sb
  .from("users")
  .select("id, full_name, account_id, ops_role");
const { data: authList } = await sb.auth.admin.listUsers({ perPage: 1000 });
const emailById = new Map(
  (authList?.users ?? []).map((u) => [u.id, u.email]),
);
const acctById = new Map(accounts.map((a) => [a.id, a.name]));
console.table(
  users.map((u) => ({
    full_name: u.full_name,
    email: emailById.get(u.id),
    account: acctById.get(u.account_id),
    ops_role: u.ops_role ?? "—",
  })),
);

console.log("\nTotal accounts:", accounts.length);
console.log("Total users:  ", users.length);
console.log(
  "\nAll your staff are still in users — they just point at one shared account now.",
);
