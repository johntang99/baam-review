// Probe PRODUCTION (baamreview.com) to see which integration endpoints are
// deployed. Creates a throwaway location+key in the shared DB, hits the live
// endpoints, reports each, then cleans up.
//   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/test-prod.mts
import { createClient } from "@supabase/supabase-js";
import { createApiKey } from "../lib/integrations/api-keys";

const BASE = "https://baamreview.com";
const svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const stamp = Date.now();
let accountId: string | null = null;

const line = (label: string, code: number, note: string) =>
  console.log(`  ${code === 404 ? "❌ NOT DEPLOYED" : "✅ live"}  [${code}] ${label}${note ? ` — ${note}` : ""}`);

try {
  const { data: acct } = await svc.from("accounts").insert({ name: "Prod Probe", primary_email: `prodprobe-${stamp}@test.invalid` }).select("id").single();
  accountId = acct!.id;
  const { data: loc } = await svc.from("locations").insert({ account_id: accountId, slug: `prodprobe-${stamp}`, display_name: "Prod Probe Co", default_language: "en" }).select("id").single();
  const key = await createApiKey(loc!.id, { name: "probe" });
  const H = { Authorization: `Bearer ${key.key}`, "Content-Type": "application/json" };

  console.log(`=== Probing ${BASE} ===`);

  // Phase 3: ping
  let res = await fetch(`${BASE}/api/integrations/ping`, { headers: { Authorization: `Bearer ${key.key}` } });
  let j = await res.json().catch(() => ({}));
  line("GET /api/integrations/ping (Phase 3)", res.status, j?.location?.name ? `location="${j.location.name}"` : "");

  // Phase 2: generic enqueue
  res = await fetch(`${BASE}/api/integrations/review-request`, { method: "POST", headers: H, body: JSON.stringify({ email: `p1-${stamp}@probe.invalid`, name: "Probe One", external_id: `p1-${stamp}` }) });
  j = await res.json().catch(() => ({}));
  line("POST /api/integrations/review-request (Phase 2)", res.status, j?.status ?? "");

  // Phase 4a: shopify adapter
  res = await fetch(`${BASE}/api/integrations/shopify?key=${encodeURIComponent(key.key)}`, { method: "POST", headers: { "Content-Type": "application/json", "x-shopify-topic": "orders/fulfilled" }, body: JSON.stringify({ id: stamp, email: `p2-${stamp}@probe.invalid`, customer: { first_name: "Pr", last_name: "Obe" } }) });
  j = await res.json().catch(() => ({}));
  line("POST /api/integrations/shopify (Phase 4a)", res.status, j?.status ?? "");

  // Phase 4a: calendly adapter
  res = await fetch(`${BASE}/api/integrations/calendly?key=${encodeURIComponent(key.key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "invitee.created", payload: { email: `p3-${stamp}@probe.invalid`, name: "Cal Probe", uri: `p3-${stamp}` } }) });
  j = await res.json().catch(() => ({}));
  line("POST /api/integrations/calendly (Phase 4a)", res.status, j?.status ?? "");

  // Phase 4b: acuity (no connection → not_connected if deployed)
  res = await fetch(`${BASE}/api/integrations/acuity?key=${encodeURIComponent(key.key)}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "action=appointment.scheduled&id=1" });
  j = await res.json().catch(() => ({}));
  line("POST /api/integrations/acuity (Phase 4b)", res.status, j?.status ?? "");
} catch (e) {
  console.error("Probe error:", (e as Error).message || e);
} finally {
  if (accountId) await svc.from("accounts").delete().eq("id", accountId);
  console.log("(cleanup) probe location removed");
}
