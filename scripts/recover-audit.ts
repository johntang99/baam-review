import { runAuditPipeline } from "@/lib/audit/delivery/start-audit";
import { createServiceClient } from "@/lib/supabase/service";

// Recover a zombie/failed audit by re-running the pipeline into the SAME row.
// Usage: tsx scripts/recover-audit.ts <audit_id> <place_id> <user_id> <email> [name]
const [, , auditId, placeId, userId, email, ...nameParts] = process.argv;
const name = nameParts.join(" ") || undefined;

if (!auditId || !placeId || !userId) {
  console.error("need: <audit_id> <place_id> <user_id> <email> [name]");
  process.exit(1);
}

(async () => {
  const svc = createServiceClient();
  // Reset the row to a clean generating state so progress + status are sane.
  await (svc as any)
    .from("audits")
    .update({ status: "generating", failed_reason: null, progress_stage: 0 })
    .eq("id", auditId);

  console.log(`re-running pipeline for ${auditId} (place ${placeId})...`);
  await runAuditPipeline(auditId, {
    business_ref: { placeId },
    user_id: userId,
    email: email || "", // empty -> send_email false (no re-send from localhost)
    name,
  });

  const { data } = await (svc as any)
    .from("audits")
    .select("status,total_score,grade,languages_rendered,pdf_urls,failed_reason")
    .eq("id", auditId)
    .maybeSingle();
  console.log("RESULT:", JSON.stringify(data, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
