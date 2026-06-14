// Verifies the intake endpoint's rate limiting (Phase 2 hardening).
// Requires migration 0054 applied + the dev server running.
//   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/test-rate-limit.mts
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createApiKey } from "../lib/integrations/api-keys";

const ENDPOINT = "http://localhost:4001/api/integrations/review-request";
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

const post = async (key: string, i: number) => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ email: `rl-${i}@rl-test.invalid`, external_id: `rl-${i}` }),
  });
  return res.status;
};

const stamp = Date.now();
let accountId: string | null = null;

try {
  const { data: acct } = await svc
    .from("accounts").insert({ name: "RL Test", primary_email: `rl-${stamp}@test.invalid` })
    .select("id").single();
  accountId = acct!.id;
  const { data: loc } = await svc
    .from("locations").insert({ account_id: accountId, slug: `rl-test-${stamp}`, display_name: "RL Test Co", default_language: "en" })
    .select("id").single();
  const locationId = loc!.id;

  // --- Per-minute window (deterministic: exercise the consume function with a
  //     small limit so we don't need 120 slow HTTP calls / risk crossing a
  //     minute boundary). This is the exact logic the endpoint runs; the
  //     endpoint just passes RATE_LIMIT_PER_MINUTE instead of 5. ---
  const burstKey = await createApiKey(locationId, { name: "burst" });
  const burstHash = createHash("sha256").update(burstKey.key).digest("hex");
  const verdicts: boolean[] = [];
  for (let i = 0; i < 6; i++) {
    const { data } = await svc.rpc("api_key_consume", {
      p_key_hash: burstHash,
      p_minute_limit: 5,
    });
    verdicts.push(!!data?.[0]?.allowed);
  }
  console.log("=== per-minute window (limit=5) ===");
  check(
    "first 5 allowed, 6th blocked",
    verdicts.slice(0, 5).every(Boolean) && verdicts[5] === false,
    verdicts.join(","),
  );

  // --- Endpoint integration sanity: a valid key returns 201 through HTTP. ---
  const epKey = await createApiKey(locationId, { name: "ep" });
  const epCode = await post(epKey.key, 9999);
  console.log("=== endpoint integration ===");
  check("valid key via HTTP → 201", epCode === 201, `code=${epCode}`);

  // --- Per-location daily cap (configurable) ---
  const dayKey = await createApiKey(locationId, { name: "daily" });
  // find that key row and set a tiny daily_limit
  const { data: keyRow } = await svc
    .from("location_api_keys").select("id").eq("location_id", locationId).eq("name", "daily").single();
  await svc.from("location_api_keys").update({ daily_limit: 2 }).eq("id", keyRow!.id);
  const dayCodes = [await post(dayKey.key, 1000), await post(dayKey.key, 1001), await post(dayKey.key, 1002)];
  console.log("=== per-location daily cap (set to 2) ===");
  check("first two under cap allowed", dayCodes[0] !== 429 && dayCodes[1] !== 429, dayCodes.join(","));
  check("third over daily cap → 429", dayCodes[2] === 429, dayCodes.join(","));
} catch (e) {
  console.error("\nTest error:", (e as Error).message || e);
  pass = false;
} finally {
  if (accountId) await svc.from("accounts").delete().eq("id", accountId);
  console.log("(cleanup) temp account + location + keys removed");
}

console.log(`\n${pass ? "✅ ALL PASS" : "❌ FAILED"}`);
process.exit(pass ? 0 : 1);
