import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInternalContext } from "@/lib/auth/staff";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Service learning QA — BAAM Review" };
export const dynamic = "force-dynamic";

interface ServiceResolutionRow {
  audit_id: string;
  gs_service: string | null;
  bs_service: string | null;
  cs_recommended_service: string | null;
  user_final_service: string | null;
  user_final_vertical: string | null;
  changed_from_recommended: boolean;
  cs_confidence: number | null;
  cs_reason_codes: string[] | null;
  created_at: string;
}

export default async function ServiceLearningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/admin/service-learning");

  const internal = await getInternalContext(supabase, user.id);
  if (!internal) redirect("/app");

  const service = createServiceClient();
  const { data, error } = await (service as unknown as {
    from: (table: string) => {
      select: (query: string) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => {
          limit: (value: number) => Promise<{
            data: ServiceResolutionRow[] | null;
            error: { code?: string; message: string } | null;
          }>;
        };
      };
    };
  })
    .from("audit_service_resolutions")
    .select(
      "audit_id, gs_service, bs_service, cs_recommended_service, user_final_service, user_final_vertical, changed_from_recommended, cs_confidence, cs_reason_codes, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = data ?? [];
  const tableMissing = error?.code === "42P01";

  const total = rows.length;
  const changedRows = rows.filter((row) => row.changed_from_recommended);
  const changedCount = changedRows.length;
  const changedRate = total > 0 ? (changedCount / total) * 100 : 0;

  const byVertical = new Map<
    string,
    { total: number; changed: number; avgConfidenceSum: number; avgConfidenceCount: number }
  >();
  const reasonCounts = new Map<string, number>();
  for (const row of rows) {
    const vertical = row.user_final_vertical?.trim() || "unknown";
    const bucket = byVertical.get(vertical) ?? {
      total: 0,
      changed: 0,
      avgConfidenceSum: 0,
      avgConfidenceCount: 0,
    };
    bucket.total += 1;
    if (row.changed_from_recommended) bucket.changed += 1;
    if (typeof row.cs_confidence === "number") {
      bucket.avgConfidenceSum += row.cs_confidence;
      bucket.avgConfidenceCount += 1;
    }
    byVertical.set(vertical, bucket);

    for (const reason of row.cs_reason_codes ?? []) {
      const normalizedReason = reason.trim();
      if (!normalizedReason) continue;
      reasonCounts.set(normalizedReason, (reasonCounts.get(normalizedReason) ?? 0) + 1);
    }
  }

  const verticalRows = Array.from(byVertical.entries())
    .map(([vertical, stats]) => ({
      vertical,
      total: stats.total,
      changed: stats.changed,
      changedRate: stats.total > 0 ? (stats.changed / stats.total) * 100 : 0,
      avgConfidence:
        stats.avgConfidenceCount > 0
          ? stats.avgConfidenceSum / stats.avgConfidenceCount
          : null,
    }))
    .sort((a, b) => b.total - a.total);

  const topReasons = Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <main className="px-10 py-10 space-y-6">
      <PageHeader
        eyebrow="BAAM Operations"
        title="Service learning QA"
        description="Track when users override CS recommendations, then optimize GS/BS reconciliation rules by industry."
      />

      {tableMissing ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-800">
          Learning table not found. Run migration{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5">
            supabase/migrations/0059_audit_service_resolutions.sql
          </code>{" "}
          first.
        </section>
      ) : null}
      {!tableMissing && error ? (
        <section className="rounded-2xl border border-red-300 bg-red-50 p-4 text-[13px] text-red-700">
          Query failed: {error.message}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Samples tracked" value={String(total)} />
        <StatCard label="CS overridden" value={String(changedCount)} />
        <StatCard label="Override rate" value={`${changedRate.toFixed(1)}%`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-border-base bg-paper p-5">
          <h2 className="font-display text-[18px] text-ink">By industry</h2>
          <p className="mt-1 text-[12px] text-text-muted">
            Higher override-rate industries usually need better service mapping.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-[0.08em] text-text-muted">
                <tr>
                  <th className="pb-2">Industry</th>
                  <th className="pb-2">Samples</th>
                  <th className="pb-2">Overridden</th>
                  <th className="pb-2">Rate</th>
                  <th className="pb-2">Avg confidence</th>
                </tr>
              </thead>
              <tbody>
                {verticalRows.map((row) => (
                  <tr key={row.vertical} className="border-t border-border-soft">
                    <td className="py-2 font-medium text-ink">{row.vertical}</td>
                    <td className="py-2 text-text">{row.total}</td>
                    <td className="py-2 text-text">{row.changed}</td>
                    <td className="py-2 text-text">{row.changedRate.toFixed(1)}%</td>
                    <td className="py-2 text-text">
                      {row.avgConfidence === null
                        ? "—"
                        : `${(row.avgConfidence * 100).toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-border-base bg-paper p-5">
          <h2 className="font-display text-[18px] text-ink">Top reason codes</h2>
          <p className="mt-1 text-[12px] text-text-muted">
            Signals emitted by the reconciler. Use these for rule tuning.
          </p>
          <ul className="mt-4 space-y-2">
            {topReasons.length === 0 ? (
              <li className="text-[13px] text-text-muted">No reason-code data yet.</li>
            ) : (
              topReasons.map(([reason, count]) => (
                <li
                  key={reason}
                  className="flex items-center justify-between rounded-lg border border-border-soft px-3 py-2 text-[13px]"
                >
                  <span className="text-text">{reason}</span>
                  <span className="font-medium text-ink">{count}</span>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-border-base bg-paper p-5">
        <h2 className="font-display text-[18px] text-ink">Recent overrides</h2>
        <p className="mt-1 text-[12px] text-text-muted">
          Latest cases where user changed CS before generating audit.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-[0.08em] text-text-muted">
              <tr>
                <th className="pb-2">Time</th>
                <th className="pb-2">Industry</th>
                <th className="pb-2">GS</th>
                <th className="pb-2">BS</th>
                <th className="pb-2">CS recommended</th>
                <th className="pb-2">User final</th>
                <th className="pb-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {changedRows.slice(0, 25).map((row) => (
                <tr key={`${row.audit_id}-${row.created_at}`} className="border-t border-border-soft">
                  <td className="py-2 text-text-muted">
                    {new Date(row.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 text-text">{row.user_final_vertical ?? "unknown"}</td>
                  <td className="py-2 text-text">{row.gs_service ?? "—"}</td>
                  <td className="py-2 text-text">{row.bs_service ?? "—"}</td>
                  <td className="py-2 text-text">{row.cs_recommended_service ?? "—"}</td>
                  <td className="py-2 font-medium text-ink">{row.user_final_service ?? "—"}</td>
                  <td className="py-2 text-text">
                    {typeof row.cs_confidence === "number"
                      ? `${(row.cs_confidence * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
              {changedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[13px] text-text-muted">
                    No overrides yet. Run a few audits and confirm/edit CS to start learning.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border-base bg-paper p-5">
      <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className="mt-1 font-display text-[30px] leading-tight text-ink">{value}</p>
    </article>
  );
}
