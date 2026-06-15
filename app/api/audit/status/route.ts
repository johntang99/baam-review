import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decrementAuditCount } from "@/lib/audit/quotas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A run is killed by Vercel at maxDuration (300s). Anything still "generating"
// well past that — we allow a generous buffer — can only be a dead run whose
// catch block never executed (the function was hard-killed). The poll itself
// flips it to "failed" so the processing page shows an error + retry instead of
// spinning forever, and refunds the consumed audit credit.
const WATCHDOG_STALE_MS = 6 * 60 * 1000; // 6 minutes

interface StatusRow {
  id: string;
  user_id: string;
  status: "generating" | "complete" | "failed";
  progress_stage: number;
  failed_reason: string | null;
  progress_started_at: string | null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("audits")
    .select("id,user_id,status,progress_stage,failed_reason,progress_started_at")
    .eq("id", id)
    .maybeSingle<StatusRow>();

  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let status = data.status;
  let failed_reason = data.failed_reason;

  // Watchdog: rescue a zombie "generating" row whose pipeline was hard-killed.
  if (status === "generating" && data.progress_started_at) {
    const ageMs = Date.now() - new Date(data.progress_started_at).getTime();
    if (ageMs > WATCHDOG_STALE_MS) {
      status = "failed";
      failed_reason =
        "Generation timed out. This can happen when Google's data is slow to respond — please try again.";
      const svc = createServiceClient();
      await (svc as unknown as {
        from: (t: string) => {
          update: (row: Record<string, unknown>) => {
            eq: (
              c: string,
              v: string,
            ) => { eq: (c2: string, v2: string) => Promise<unknown> };
          };
        };
      })
        .from("audits")
        .update({ status: "failed", failed_reason })
        .eq("id", id)
        // Only flip it if it's still generating — never clobber a row that
        // completed between our read and this write.
        .eq("status", "generating");
      // Refund the consumed audit credit (mirrors the pipeline's own catch).
      await decrementAuditCount(data.user_id).catch(() => {});
    }
  }

  return NextResponse.json({
    audit_id: data.id,
    status,
    stage: data.progress_stage,
    failed_reason,
  });
}
