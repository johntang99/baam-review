// End-to-end test of POST /api/integrations/review-request against the running
// dev server. Creates a throwaway location + API key, hits the live endpoint,
// asserts auth + enqueue behavior, then cleans up.
//   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/test-intake-endpoint.mts
import { createClient } from "@supabase/supabase-js";
import { createApiKey } from "../lib/integrations/api-keys";

const BASE = process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
  ? "http://localhost:4001"
  : "http://localhost:4001";
const ENDPOINT = `${BASE}/api/integrations/review-request`;

const svc = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

let pass = true;
const check = (label: string, cond: boolean, extra = "") => {
  pass &&= cond;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
};

const post = async (key: string | null, body: unknown) => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  let json: { ok?: boolean; status?: string; reason?: string; id?: string } = {};
  try { json = await res.json(); } catch { /* non-json */ }
  return { code: res.status, json };
};

const stamp = Date.now();
let accountId: string | null = null;

try {
  const { data: acct } = await svc
    .from("accounts")
    .insert({ name: "Intake EP Test", primary_email: `ep-${stamp}@test.invalid` })
    .select("id").single();
  accountId = acct!.id;
  const { data: loc } = await svc
    .from("locations")
    .insert({ account_id: accountId, slug: `ep-test-${stamp}`, display_name: "EP Test Co", default_language: "en" })
    .select("id").single();
  const locationId = loc!.id;

  const created = await createApiKey(locationId, { name: "test key" });
  console.log("=== endpoint behavior ===");

  // 1. No key → 401
  let r = await post(null, { email: "x@ep-test.invalid" });
  check("no key → 401", r.code === 401, String(r.code));

  // 2. Bad key → 401
  r = await post("brk_totally-bogus-key", { email: "x@ep-test.invalid" });
  check("bad key → 401", r.code === 401, String(r.code));

  // 3. Bad JSON → 400
  r = await post(created.key, "{not json");
  check("malformed JSON → 400", r.code === 400, String(r.code));

  // 4. Valid → 201 queued
  r = await post(created.key, {
    name: "EP Jane", email: "jane@ep-test.invalid", service: "Demo", external_id: "ep-1",
  });
  check("valid contact → 201 queued", r.code === 201 && r.json.status === "queued", `${r.code}/${r.json.status}`);

  // 5. Duplicate external_id → 200 skipped duplicate
  r = await post(created.key, { email: "jane@ep-test.invalid", external_id: "ep-1" });
  check("dup external_id → 200 skipped", r.code === 200 && r.json.reason === "duplicate", `${r.code}/${r.json.reason}`);

  // 6. No contact → 200 skipped no_contact
  r = await post(created.key, { name: "no contact" });
  check("no contact → 200 skipped", r.code === 200 && r.json.reason === "no_contact", `${r.code}/${r.json.reason}`);

  // 7. Revoked key → 401
  const list = await svc.from("location_api_keys").select("id").eq("location_id", locationId).single();
  await svc.from("location_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", list.data!.id);
  r = await post(created.key, { email: "y@ep-test.invalid", external_id: "ep-2" });
  check("revoked key → 401", r.code === 401, String(r.code));

  // 8. Landed in the integration queue
  const { data: custs } = await svc
    .from("list_customers").select("name, email, status, external_id, list_id")
    .eq("location_id", locationId);
  const q = (custs ?? []).filter((c) => c.status === "pending");
  check("one pending contact queued via endpoint", q.length === 1, `got ${q.length}`);
  check("queued contact correct", q[0]?.email === "jane@ep-test.invalid" && q[0]?.external_id === "ep-1", JSON.stringify(q[0] ?? {}));
} catch (e) {
  console.error("\nTest error:", (e as Error).message || e);
  pass = false;
} finally {
  if (accountId) await svc.from("accounts").delete().eq("id", accountId);
  console.log("(cleanup) temp account + location + key removed");
}

console.log(`\n${pass ? "✅ ALL PASS" : "❌ FAILED"}`);
process.exit(pass ? 0 : 1);
