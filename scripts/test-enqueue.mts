// Verifies enqueueReviewRequest (Phase 1 queue feeder) end-to-end against a
// throwaway location. Requires migration 0052 applied.
//   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/test-enqueue.mts
import { createClient } from "@supabase/supabase-js";
import { enqueueReviewRequest } from "../lib/integrations/enqueue";

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

const stamp = Date.now();
const slug = `enqtest-${stamp}`;
let accountId: string | null = null;

try {
  const { data: acct } = await svc
    .from("accounts")
    .insert({ name: "Enqueue Test", primary_email: `enq-${stamp}@test.invalid` })
    .select("id")
    .single();
  accountId = acct!.id;
  const { data: loc } = await svc
    .from("locations")
    .insert({
      account_id: accountId,
      slug,
      display_name: "Enqueue Test Co",
      default_language: "en",
    })
    .select("id")
    .single();
  const locationId = loc!.id;

  console.log("=== enqueue branches ===");

  const r1 = await enqueueReviewRequest({
    location: slug,
    name: "Test A",
    email: "a@enq-test.invalid",
    service: "Acupuncture",
    externalId: "txn-1",
  });
  check("new contact → queued", r1.status === "queued", r1.status);

  const r2 = await enqueueReviewRequest({
    location: slug,
    email: "a@enq-test.invalid",
    externalId: "txn-1",
  });
  check(
    "same external_id → duplicate",
    r2.status === "skipped" && r2.reason === "duplicate",
    `${r2.status}/${"reason" in r2 ? r2.reason : ""}`,
  );

  const r3 = await enqueueReviewRequest({
    location: slug,
    email: "a@enq-test.invalid",
    externalId: "txn-2",
  });
  check(
    "same email within 60d → duplicate",
    r3.status === "skipped" && r3.reason === "duplicate",
    `${r3.status}/${"reason" in r3 ? r3.reason : ""}`,
  );

  const r4 = await enqueueReviewRequest({ location: slug, name: "No contact" });
  check(
    "no email/phone → no_contact",
    r4.status === "skipped" && r4.reason === "no_contact",
    r4.status,
  );

  const r5 = await enqueueReviewRequest({
    location: "definitely-not-a-real-slug",
    email: "x@enq-test.invalid",
  });
  check(
    "unknown location → location_not_found",
    r5.status === "skipped" && r5.reason === "location_not_found",
    r5.status,
  );

  await svc.from("opt_outs").insert({
    location_id: locationId,
    contact: "b@enq-test.invalid",
    channel: "email",
  });
  const r6 = await enqueueReviewRequest({
    location: slug,
    email: "b@enq-test.invalid",
    externalId: "txn-3",
  });
  check(
    "opted-out contact → opted_out",
    r6.status === "skipped" && r6.reason === "opted_out",
    `${r6.status}/${"reason" in r6 ? r6.reason : ""}`,
  );

  // Verify the rolling integration list + the one queued customer.
  const { data: list } = await svc
    .from("lists")
    .select("id, source, status, customer_count")
    .eq("location_id", locationId)
    .eq("source", "integration")
    .maybeSingle();
  check("integration list created", !!list, list ? `count=${list.customer_count}` : "missing");

  const { data: custs } = await svc
    .from("list_customers")
    .select("name, email, status, channel, notes, external_id")
    .eq("location_id", locationId);
  const queued = (custs ?? []).filter((c) => c.status === "pending");
  check("exactly one pending customer queued", queued.length === 1, `got ${queued.length}`);
  check(
    "queued customer has expected fields",
    queued[0]?.email === "a@enq-test.invalid" &&
      queued[0]?.channel === "email" &&
      queued[0]?.notes === "Acupuncture" &&
      queued[0]?.external_id === "txn-1",
    JSON.stringify(queued[0] ?? {}),
  );

  // Fix 2: a rolling list must never stay "completed". Force-complete it, feed
  // a new contact, and confirm it's revived to "active".
  await svc.from("lists").update({ status: "completed" }).eq("id", list!.id);
  const r7 = await enqueueReviewRequest({
    location: slug,
    name: "Test C",
    email: "c@enq-test.invalid",
    externalId: "txn-4",
  });
  const { data: revived } = await svc
    .from("lists")
    .select("status")
    .eq("id", list!.id)
    .maybeSingle();
  check(
    "completed integration list revived to active on new contact",
    r7.status === "queued" && revived?.status === "active",
    `enqueue=${r7.status} list=${revived?.status}`,
  );
} catch (e) {
  console.error("\nTest error:", (e as Error).message || e);
  pass = false;
} finally {
  if (accountId) await svc.from("accounts").delete().eq("id", accountId);
  console.log("(cleanup) temp account + location removed");
}

console.log(`\n${pass ? "✅ ALL PASS" : "❌ FAILED"}`);
process.exit(pass ? 0 : 1);
