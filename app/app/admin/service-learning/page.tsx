import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInternalContext } from "@/lib/auth/staff";
import { isBroadServiceTerm } from "@/lib/audit/broad-service-terms";
import { PageHeader } from "@/components/admin/page-header";
import { markPromotionAdded, promoteUnknownService } from "./actions";

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

interface ServiceShadowRow {
  audit_id: string;
  user_final_vertical: string | null;
  user_final_service: string | null;
  system_recommended_service: string | null;
  analyst_mode: string | null;
  analyst_recommended_service: string | null;
  agrees_with_system: boolean | null;
  matches_user_final_system: boolean | null;
  matches_user_final_analyst: boolean | null;
  created_at: string;
}

interface UnknownServiceRow {
  id: string;
  business_place_id: string | null;
  business_name: string | null;
  inferred_vertical: string | null;
  candidate_service: string;
  source_tag: string;
  confidence: number | null;
  reviewed: boolean;
  review_note: string | null;
  created_at: string;
}

interface TaxonomyPromotionRow {
  id: string;
  unknown_candidate_id: string | null;
  canonical_service: string;
  suggested_vertical: string | null;
  status: string;
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

  const {
    data: shadowData,
    error: shadowError,
  } = await (service as unknown as {
    from: (table: string) => {
      select: (query: string) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => {
          limit: (value: number) => Promise<{
            data: ServiceShadowRow[] | null;
            error: { code?: string; message: string } | null;
          }>;
        };
      };
    };
  })
    .from("audit_service_shadow_logs")
    .select(
      "audit_id, user_final_vertical, user_final_service, system_recommended_service, analyst_mode, analyst_recommended_service, agrees_with_system, matches_user_final_system, matches_user_final_analyst, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  const shadowRows = shadowData ?? [];
  const shadowTableMissing = shadowError?.code === "42P01";

  const {
    data: unknownData,
    error: unknownError,
  } = await (service as unknown as {
    from: (table: string) => {
      select: (query: string) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => {
          limit: (value: number) => Promise<{
            data: UnknownServiceRow[] | null;
            error: { code?: string; message: string } | null;
          }>;
        };
      };
    };
  })
    .from("audit_service_unknown_candidates")
    .select(
      "id, business_place_id, business_name, inferred_vertical, candidate_service, source_tag, confidence, reviewed, review_note, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const unknownRows = unknownData ?? [];
  const unknownTableMissing = unknownError?.code === "42P01";

  const {
    data: promotionData,
    error: promotionError,
  } = await (service as unknown as {
    from: (table: string) => {
      select: (query: string) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => {
          limit: (value: number) => Promise<{
            data: TaxonomyPromotionRow[] | null;
            error: { code?: string; message: string } | null;
          }>;
        };
      };
    };
  })
    .from("audit_service_taxonomy_promotions")
    .select("id, unknown_candidate_id, canonical_service, suggested_vertical, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const promotionRows = promotionData ?? [];
  const promotionTableMissing = promotionError?.code === "42P01";

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
  const broadSelectionGateCount = rows.filter((row) =>
    (row.cs_reason_codes ?? []).includes("broad_service_needs_user_selection"),
  ).length;
  const lowConfidenceCount = rows.filter(
    (row) => typeof row.cs_confidence === "number" && row.cs_confidence <= 0.65,
  ).length;
  const highRiskVerticals = verticalRows.filter(
    (row) => row.total >= 3 && row.changedRate >= 25,
  );

  const shadowTotal = shadowRows.length;
  const shadowCompared = shadowRows.filter(
    (row) => Boolean(row.user_final_service?.trim()) && Boolean(row.analyst_recommended_service?.trim()),
  );
  const analystWins = shadowCompared.filter(
    (row) =>
      row.matches_user_final_analyst === true && row.matches_user_final_system !== true,
  );
  const systemWins = shadowCompared.filter(
    (row) =>
      row.matches_user_final_system === true && row.matches_user_final_analyst !== true,
  );
  const ties = shadowCompared.filter(
    (row) =>
      row.matches_user_final_system === true && row.matches_user_final_analyst === true,
  );
  const disagreements = shadowRows.filter((row) => row.agrees_with_system === false);
  const analystWinRate =
    shadowCompared.length > 0 ? (analystWins.length / shadowCompared.length) * 100 : 0;
  const policyComparable = shadowCompared.filter((row) => {
    const finalService = row.user_final_service?.trim() ?? "";
    if (!finalService) return false;
    return !isBroadServiceTerm(finalService, { vertical: row.user_final_vertical });
  });
  const policyAnalystHits = policyComparable.filter(
    (row) => row.matches_user_final_analyst === true,
  ).length;
  const policySystemHits = policyComparable.filter(
    (row) => row.matches_user_final_system === true,
  ).length;
  const policyAnalystHitRate =
    policyComparable.length > 0
      ? (policyAnalystHits / policyComparable.length) * 100
      : 0;
  const policySystemHitRate =
    policyComparable.length > 0
      ? (policySystemHits / policyComparable.length) * 100
      : 0;

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
      {shadowTableMissing ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-800">
          Shadow table not found. Run migration{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5">
            supabase/migrations/0060_audit_service_shadow_logs.sql
          </code>{" "}
          first.
        </section>
      ) : null}
      {!shadowTableMissing && shadowError ? (
        <section className="rounded-2xl border border-red-300 bg-red-50 p-4 text-[13px] text-red-700">
          Shadow query failed: {shadowError.message}
        </section>
      ) : null}
      {unknownTableMissing ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-800">
          Unknown-service queue table not found. Run migration{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5">
            supabase/migrations/0061_audit_service_unknown_candidates.sql
          </code>{" "}
          first.
        </section>
      ) : null}
      {!unknownTableMissing && unknownError ? (
        <section className="rounded-2xl border border-red-300 bg-red-50 p-4 text-[13px] text-red-700">
          Unknown queue query failed: {unknownError.message}
        </section>
      ) : null}
      {promotionTableMissing ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-800">
          Taxonomy promotion table not found. Run migration{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5">
            supabase/migrations/0062_audit_service_taxonomy_promotions.sql
          </code>{" "}
          first.
        </section>
      ) : null}
      {!promotionTableMissing && promotionError ? (
        <section className="rounded-2xl border border-red-300 bg-red-50 p-4 text-[13px] text-red-700">
          Taxonomy promotion query failed: {promotionError.message}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Samples tracked" value={String(total)} />
        <StatCard label="CS overridden" value={String(changedCount)} />
        <StatCard label="Override rate" value={`${changedRate.toFixed(1)}%`} />
      </section>

      <section className="rounded-2xl border border-border-base bg-paper p-5 space-y-4">
        <div>
          <h2 className="font-display text-[18px] text-ink">Phase 2 shadow: system vs analyst</h2>
          <p className="mt-1 text-[12px] text-text-muted">
            Compares current RS decision and analyst recommendation against user final service.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Shadow rows" value={String(shadowTotal)} />
          <StatCard label="Comparable rows" value={String(shadowCompared.length)} />
          <StatCard label="Analyst win rate" value={`${analystWinRate.toFixed(1)}%`} />
          <StatCard label="System/analyst disagree" value={String(disagreements.length)} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MiniStatCard
            label="Analyst wins"
            value={String(analystWins.length)}
            hint="Analyst matches user final while system misses."
          />
          <MiniStatCard
            label="System wins"
            value={String(systemWins.length)}
            hint="System matches user final while analyst misses."
          />
          <MiniStatCard
            label="Both correct"
            value={String(ties.length)}
            hint="Both system and analyst match user final."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MiniStatCard
            label="Policy comparable rows"
            value={String(policyComparable.length)}
            hint="Excludes broad user-final values for stricter quality scoring."
          />
          <MiniStatCard
            label="Policy analyst hit rate"
            value={`${policyAnalystHitRate.toFixed(1)}%`}
            hint={`Analyst hit rows: ${policyAnalystHits}`}
          />
          <MiniStatCard
            label="Policy system hit rate"
            value={`${policySystemHitRate.toFixed(1)}%`}
            hint={`System hit rows: ${policySystemHits}`}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border-base bg-paper p-5 space-y-4">
        <div>
          <h2 className="font-display text-[18px] text-ink">Risk alerts</h2>
          <p className="mt-1 text-[12px] text-text-muted">
            Quick health checks for paid-quality service decision flow.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Broad-selection gate hits" value={String(broadSelectionGateCount)} />
          <StatCard label="Low-confidence (65% or below)" value={String(lowConfidenceCount)} />
          <StatCard label="Unknown service candidates" value={String(unknownRows.length)} />
          <StatCard label="Promotion queue (pending)" value={String(promotionRows.filter((row) => row.status === "pending").length)} />
        </div>
        <div className="rounded-xl border border-border-soft bg-cream-light px-4 py-3 text-[12px] text-text">
          {highRiskVerticals.length > 0 ? (
            <span>
              Watchlist:{" "}
              {highRiskVerticals
                .map((row) => `${row.vertical} (${row.changedRate.toFixed(1)}%)`)
                .join(", ")}
            </span>
          ) : (
            <span>No high-risk verticals by current threshold (min 3 samples and 25%+ override).</span>
          )}
        </div>
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

      <section className="rounded-2xl border border-border-base bg-paper p-5">
        <h2 className="font-display text-[18px] text-ink">Unknown service candidate queue</h2>
        <p className="mt-1 text-[12px] text-text-muted">
          Analyst-first suggestions not currently in taxonomy. Review and promote to taxonomy queue.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-[0.08em] text-text-muted">
              <tr>
                <th className="pb-2">Time</th>
                <th className="pb-2">Business</th>
                <th className="pb-2">Vertical</th>
                <th className="pb-2">Candidate service</th>
                <th className="pb-2">Source</th>
                <th className="pb-2">Confidence</th>
                <th className="pb-2">Reviewed</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {unknownRows.slice(0, 25).map((row) => (
                <tr key={row.id} className="border-t border-border-soft">
                  <td className="py-2 text-text-muted">
                    {new Date(row.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 text-text">{row.business_name ?? row.business_place_id ?? "—"}</td>
                  <td className="py-2 text-text">{row.inferred_vertical ?? "unknown"}</td>
                  <td className="py-2 font-medium text-ink">{row.candidate_service}</td>
                  <td className="py-2 text-text">{row.source_tag}</td>
                  <td className="py-2 text-text">
                    {typeof row.confidence === "number"
                      ? `${(row.confidence * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="py-2 text-text">{row.reviewed ? "Yes" : "No"}</td>
                  <td className="py-2">
                    {row.reviewed ? (
                      <span className="text-[12px] text-text-muted">
                        {row.review_note ?? "Reviewed"}
                      </span>
                    ) : (
                      <form action={promoteUnknownService} className="flex items-center gap-2">
                        <input type="hidden" name="unknown_id" value={row.id} />
                        <input
                          type="text"
                          name="canonical_service"
                          defaultValue={row.candidate_service}
                          className="h-8 w-44 rounded-md border border-border-base bg-white px-2 text-[12px] text-ink"
                        />
                        <button
                          type="submit"
                          className="h-8 rounded-md border border-border-base bg-cream-light px-2 text-[12px] font-medium text-ink hover:bg-cream"
                        >
                          Promote
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {unknownRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[13px] text-text-muted">
                    No unknown candidates logged yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border-base bg-paper p-5">
        <h2 className="font-display text-[18px] text-ink">Taxonomy promotion queue</h2>
        <p className="mt-1 text-[12px] text-text-muted">
          Pending candidates to add to `service-taxonomy.ts` as canonical services/aliases.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-[0.08em] text-text-muted">
              <tr>
                <th className="pb-2">Time</th>
                <th className="pb-2">Canonical service</th>
                <th className="pb-2">Vertical</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {promotionRows.slice(0, 25).map((row) => (
                <tr key={row.id} className="border-t border-border-soft">
                  <td className="py-2 text-text-muted">
                    {new Date(row.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 font-medium text-ink">{row.canonical_service}</td>
                  <td className="py-2 text-text">{row.suggested_vertical ?? "unknown"}</td>
                  <td className="py-2 text-text">{row.status}</td>
                  <td className="py-2">
                    {row.status === "pending" ? (
                      <form action={markPromotionAdded}>
                        <input type="hidden" name="promotion_id" value={row.id} />
                        <button
                          type="submit"
                          className="h-8 rounded-md border border-border-base bg-cream-light px-2 text-[12px] font-medium text-ink hover:bg-cream"
                        >
                          Mark as added
                        </button>
                      </form>
                    ) : (
                      <span className="text-[12px] text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {promotionRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[13px] text-text-muted">
                    No taxonomy promotions yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border-base bg-paper p-5">
        <h2 className="font-display text-[18px] text-ink">Recent shadow disagreements</h2>
        <p className="mt-1 text-[12px] text-text-muted">
          Cases where analyst recommendation differs from current system recommendation.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-[0.08em] text-text-muted">
              <tr>
                <th className="pb-2">Time</th>
                <th className="pb-2">Industry</th>
                <th className="pb-2">User final</th>
                <th className="pb-2">System RS</th>
                <th className="pb-2">Analyst RS</th>
                <th className="pb-2">Mode</th>
                <th className="pb-2">Winner</th>
              </tr>
            </thead>
            <tbody>
              {disagreements.slice(0, 25).map((row) => {
                const winner =
                  row.matches_user_final_analyst === true &&
                  row.matches_user_final_system !== true
                    ? "Analyst"
                    : row.matches_user_final_system === true &&
                        row.matches_user_final_analyst !== true
                      ? "System"
                      : row.matches_user_final_system === true &&
                          row.matches_user_final_analyst === true
                        ? "Both"
                        : "Neither";
                return (
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
                    <td className="py-2 font-medium text-ink">{row.user_final_service ?? "—"}</td>
                    <td className="py-2 text-text">{row.system_recommended_service ?? "—"}</td>
                    <td className="py-2 text-text">{row.analyst_recommended_service ?? "—"}</td>
                    <td className="py-2 text-text">{row.analyst_mode ?? "—"}</td>
                    <td className="py-2 text-text">{winner}</td>
                  </tr>
                );
              })}
              {disagreements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[13px] text-text-muted">
                    No disagreements logged yet. Enable shadow and generate audits to collect data.
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

function MiniStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-xl border border-border-soft bg-paper p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className="mt-1 font-display text-[26px] leading-tight text-ink">{value}</p>
      <p className="mt-1 text-[12px] text-text-muted">{hint}</p>
    </article>
  );
}
