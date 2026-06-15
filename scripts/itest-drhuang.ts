/**
 * Integration smoke-test fixture for "connect Dr. Huang clinic via API key".
 *
 *   tsx scripts/itest-drhuang.ts setup     -> creates test account+location+key, prints key
 *   tsx scripts/itest-drhuang.ts teardown  -> deletes everything the test created
 *
 * All test rows are tagged with the slug below so teardown is exact.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { createApiKey } from "@/lib/integrations/api-keys";

const SLUG = "dr-huang-tcm-test";
const svc = createServiceClient() as any;

async function setup() {
  await teardown(true); // start clean

  const { data: acct, error: aErr } = await svc
    .from("accounts")
    .insert({
      name: "Dr. Huang TCM Clinic (TEST)",
      primary_email: "drhuang-itest@example.com",
      subscription_tier: "trial",
      subscription_status: "trialing",
      review_plan: "self_service",
      is_baam_internal: true,
    })
    .select("id")
    .single();
  if (aErr) throw new Error("account insert: " + aErr.message);

  const { data: loc, error: lErr } = await svc
    .from("locations")
    .insert({
      account_id: acct.id,
      slug: SLUG,
      display_name: "Dr. Huang TCM Clinic (TEST)",
      address: "Flushing, NY 11355",
      business_type: "tcm_clinic",
      default_language: "zh",
      supported_languages: ["en", "zh"],
    })
    .select("id,slug")
    .single();
  if (lErr) throw new Error("location insert: " + lErr.message);

  const key = await createApiKey(loc.id, { name: "Dr. Huang booking system" });

  console.log("SETUP OK");
  console.log("account_id  =", acct.id);
  console.log("location_id =", loc.id);
  console.log("slug        =", loc.slug);
  console.log("API_KEY     =", key.key);
}

async function teardown(quiet = false) {
  const { data: loc } = await svc
    .from("locations")
    .select("id,account_id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (loc) {
    const { data: lists } = await svc
      .from("lists")
      .select("id")
      .eq("location_id", loc.id);
    for (const l of lists || []) {
      await svc.from("list_customers").delete().eq("list_id", l.id);
    }
    await svc.from("lists").delete().eq("location_id", loc.id);
    await svc.from("location_api_keys").delete().eq("location_id", loc.id);
    await svc.from("opt_outs").delete().eq("location_id", loc.id);
    await svc.from("locations").delete().eq("id", loc.id);
    await svc.from("accounts").delete().eq("id", loc.account_id);
    if (!quiet) console.log("TEARDOWN OK — removed test account/location/key/lists");
  } else if (!quiet) {
    console.log("TEARDOWN: nothing to remove");
  }
}

const cmd = process.argv[2];
(cmd === "setup" ? setup() : teardown())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
