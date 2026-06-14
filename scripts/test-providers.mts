// Phase 4 — native connector adapters. Unit-tests the mappers + e2e through the
// live /api/integrations/<provider> route with sample vendor payloads.
//   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/test-providers.mts
import { createClient } from "@supabase/supabase-js";
import { createApiKey } from "../lib/integrations/api-keys";
import { shopifyAdapter } from "../lib/integrations/providers/shopify";
import { calendlyAdapter } from "../lib/integrations/providers/calendly";
import { mapAcuityAppointment } from "../lib/integrations/providers/acuity";
import { upsertConnection } from "../lib/integrations/connections";

const svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let pass = true;
const check = (l: string, c: boolean, e = "") => { pass &&= c; console.log(`  ${c ? "✅" : "❌"} ${l}${e ? ` — ${e}` : ""}`); };

// ---------- unit: mappers ----------
console.log("=== mappers (unit) ===");
const shopBody = {
  id: 998877, email: "shopper@ex.invalid", created_at: "2026-06-14T10:00:00Z",
  customer: { first_name: "Sam", last_name: "Shopper", phone: "5551112222" },
  line_items: [{ title: "Herbal tea" }],
};
const shopMapped = shopifyAdapter.map!(shopBody, new Headers({ "x-shopify-topic": "orders/fulfilled" }));
check("shopify maps order → contact",
  shopMapped?.email === "shopper@ex.invalid" && shopMapped?.name === "Sam Shopper" &&
  shopMapped?.externalId === "shopify-998877" && shopMapped?.service === "Herbal tea",
  JSON.stringify(shopMapped));
check("shopify ignores irrelevant topic",
  shopifyAdapter.map!(shopBody, new Headers({ "x-shopify-topic": "orders/cancelled" })) === null);

const calBody = {
  event: "invitee.created",
  payload: { email: "book@ex.invalid", name: "Booker B", uri: "https://api.calendly.com/x/invitees/abc",
    scheduled_event: { name: "Acupuncture 60", start_time: "2026-06-20T15:00:00Z" } },
};
const calMapped = calendlyAdapter.map!(calBody, new Headers());
check("calendly maps invitee.created → contact",
  calMapped?.email === "book@ex.invalid" && calMapped?.name === "Booker B" &&
  calMapped?.service === "Acupuncture 60" && calMapped?.externalId === "https://api.calendly.com/x/invitees/abc",
  JSON.stringify(calMapped));
check("calendly ignores invitee.canceled",
  calendlyAdapter.map!({ event: "invitee.canceled", payload: { email: "x@x.invalid" } }, new Headers()) === null);

const acuityAppt = { id: 555, firstName: "Aki", lastName: "Tan", email: "aki@ex.invalid", phone: "5553334444", type: "Acupuncture", datetime: "2026-06-21T14:00:00-0400" };
const acuityMapped = mapAcuityAppointment(acuityAppt);
check("acuity maps appointment → contact",
  acuityMapped?.email === "aki@ex.invalid" && acuityMapped?.name === "Aki Tan" &&
  acuityMapped?.service === "Acupuncture" && acuityMapped?.externalId === "acuity-555",
  JSON.stringify(acuityMapped));
check("acuity ignores no-contact appointment",
  mapAcuityAppointment({ id: 1, type: "x" }) === null);

// ---------- e2e: live route ----------
const stamp = Date.now();
let accountId: string | null = null;
const post = async (provider: string, key: string | null, body: unknown, headers: Record<string, string> = {}) => {
  const url = `http://localhost:4001/api/integrations/${provider}${key ? `?key=${encodeURIComponent(key)}` : ""}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  let json: { status?: string; reason?: string } = {};
  try { json = await res.json(); } catch {}
  return { code: res.status, json };
};

try {
  const { data: acct } = await svc.from("accounts").insert({ name: "Prov Test", primary_email: `prov-${stamp}@test.invalid` }).select("id").single();
  accountId = acct!.id;
  const { data: loc } = await svc.from("locations").insert({ account_id: accountId, slug: `prov-${stamp}`, display_name: "Prov Test Co", default_language: "en" }).select("id").single();
  const key = await createApiKey(loc!.id, { name: "prov" });

  console.log("=== route (e2e) ===");
  let r = await post("shopify", key.key, { id: stamp, email: `shop-${stamp}@ex.invalid`, customer: { first_name: "S", last_name: "P" }, created_at: "2026-06-14T10:00:00Z" }, { "x-shopify-topic": "orders/fulfilled" });
  check("shopify webhook → 201 queued", r.code === 201 && r.json.status === "queued", `${r.code}/${r.json.status}`);

  r = await post("calendly", key.key, { event: "invitee.created", payload: { email: `cal-${stamp}@ex.invalid`, name: "Cal B", uri: `cal-${stamp}`, scheduled_event: { name: "Visit" } } });
  check("calendly webhook → 201 queued", r.code === 201 && r.json.status === "queued", `${r.code}/${r.json.status}`);

  r = await post("calendly", key.key, { event: "invitee.canceled", payload: { email: "x@ex.invalid" } });
  check("calendly cancel → 200 ignored", r.code === 200 && r.json.status === "ignored", `${r.code}/${r.json.status}`);

  r = await post("shopify", "brk_bogus", { id: 1, email: "x@ex.invalid" }, { "x-shopify-topic": "orders/fulfilled" });
  check("bad key → 401", r.code === 401, String(r.code));

  r = await post("notreal", key.key, {});
  check("unknown provider → 404", r.code === 404, String(r.code));

  // Acuity needs a stored connection; without one the route acks "not_connected".
  r = await post("acuity", key.key, { action: "appointment.scheduled", id: "1" });
  check("acuity without connection → 200 not_connected", r.code === 200 && r.json.status === "not_connected", `${r.code}/${r.json.status}`);

  // With a (fake) connection the resolve branch runs: form parse → load creds →
  // call Acuity API (401 with fake creds) → null → "ignored". Confirms wiring.
  await upsertConnection(loc!.id, "acuity", { userId: "fake", apiKey: "fake" });
  const formRes = await fetch(`http://localhost:4001/api/integrations/acuity?key=${encodeURIComponent(key.key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "action=appointment.scheduled&id=1",
  });
  const formJson = await formRes.json().catch(() => ({}));
  check("acuity connected (bad creds) → 200 ignored", formRes.status === 200 && formJson.status === "ignored", `${formRes.status}/${formJson.status}`);

  const { data: custs } = await svc.from("list_customers").select("email,external_id").eq("location_id", loc!.id);
  check("2 contacts landed in queue", (custs ?? []).length === 2, `got ${(custs ?? []).length}`);
} catch (e) {
  console.error("Test error:", (e as Error).message || e); pass = false;
} finally {
  if (accountId) await svc.from("accounts").delete().eq("id", accountId);
  console.log("(cleanup) done");
}
console.log(`\n${pass ? "✅ ALL PASS" : "❌ FAILED"}`);
process.exit(pass ? 0 : 1);
