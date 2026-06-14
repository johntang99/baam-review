// Tests GET /api/integrations/ping (connection test for no-code setup).
//   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/test-ping.mts
import { createClient } from "@supabase/supabase-js";
import { createApiKey } from "../lib/integrations/api-keys";

const PING = "http://localhost:4001/api/integrations/ping";
const svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

let pass = true;
const check = (l: string, c: boolean, e = "") => { pass &&= c; console.log(`  ${c ? "✅" : "❌"} ${l}${e ? ` — ${e}` : ""}`); };
const get = async (key: string | null) => {
  const res = await fetch(PING, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
  let json: { ok?: boolean; location?: { id: string; name: string | null } } = {};
  try { json = await res.json(); } catch {}
  return { code: res.status, json };
};

const stamp = Date.now();
let accountId: string | null = null;
try {
  const { data: acct } = await svc.from("accounts").insert({ name: "Ping Test", primary_email: `ping-${stamp}@test.invalid` }).select("id").single();
  accountId = acct!.id;
  const { data: loc } = await svc.from("locations").insert({ account_id: accountId, slug: `ping-${stamp}`, display_name: "Ping Test Co", default_language: "en" }).select("id").single();
  const key = await createApiKey(loc!.id, { name: "ping" });

  console.log("=== ping ===");
  let r = await get(null);
  check("no key → 401", r.code === 401, String(r.code));
  r = await get("brk_bogus");
  check("bad key → 401", r.code === 401, String(r.code));
  r = await get(key.key);
  check("valid key → 200 + location name", r.code === 200 && r.json.ok === true && r.json.location?.name === "Ping Test Co", JSON.stringify(r.json));
} catch (e) {
  console.error("Test error:", (e as Error).message || e); pass = false;
} finally {
  if (accountId) await svc.from("accounts").delete().eq("id", accountId);
  console.log("(cleanup) done");
}
console.log(`\n${pass ? "✅ ALL PASS" : "❌ FAILED"}`);
process.exit(pass ? 0 : 1);
