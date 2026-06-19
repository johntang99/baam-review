import fs from "node:fs";
import { createServiceClient } from "@/lib/supabase/service";
import { runAuditPipeline } from "@/lib/audit/delivery/start-audit";

function loadEnvFromFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = rawLine.indexOf("=");
    if (idx <= 0) continue;
    const key = rawLine.slice(0, idx).trim();
    let value = rawLine.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  const auditId = process.argv[2];
  if (!auditId) {
    throw new Error("usage: NODE_OPTIONS='--conditions=react-server' npx tsx scripts/recover-audit-by-id.ts <audit-id>");
  }

  loadEnvFromFile(".env.local");
  loadEnvFromFile(".env");

  const svc = createServiceClient();
  const { data: row, error } = await (svc as any)
    .from("audits")
    .select("id,business_place_id,user_id,status")
    .eq("id", auditId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error(`audit not found: ${auditId}`);
  if (!row.business_place_id) throw new Error(`audit missing business_place_id: ${auditId}`);
  if (!row.user_id) throw new Error(`audit missing user_id: ${auditId}`);

  await (svc as any)
    .from("audits")
    .update({ status: "generating", failed_reason: null, progress_stage: 0 })
    .eq("id", auditId);

  console.log(`Re-running pipeline for audit ${auditId} (${row.business_place_id})...`);
  await runAuditPipeline(auditId, {
    business_ref: { placeId: row.business_place_id, forceRefresh: true },
    user_id: row.user_id,
    email: "",
  });

  const { data: updated, error: readErr } = await (svc as any)
    .from("audits")
    .select("id,status,google_data,total_score,grade,failed_reason")
    .eq("id", auditId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  const reviewsAggregate = updated?.google_data?.reviews_aggregate ?? null;
  console.log(
    JSON.stringify(
      {
        id: updated?.id,
        status: updated?.status,
        total_score: updated?.total_score,
        grade: updated?.grade,
        failed_reason: updated?.failed_reason,
        reviews_aggregate: reviewsAggregate,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
