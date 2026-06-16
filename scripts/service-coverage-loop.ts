import { readFileSync } from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { canonicalizeService, isKnownService } from "@/lib/audit/service-taxonomy";
import type { Database } from "@/lib/database.types";
import type { AuditGoogleData } from "@/lib/audit/google/types";

type ResolutionRow = {
  audit_id: string;
  gs_service: string | null;
  bs_service: string | null;
  cs_recommended_service: string | null;
  cs_confidence: number | null;
  cs_reason_codes: string[] | null;
  user_final_service: string | null;
  user_final_vertical: string | null;
  changed_from_recommended: boolean;
  created_at: string;
};

type AuditSnapshotRow = {
  id: string;
  google_data: AuditGoogleData | null;
};

type GapCase = {
  auditId: string;
  createdAt: string;
  businessName: string;
  recommended: string;
  userFinal: string;
  gs: string;
  bs: string;
  vertical: string;
  confidence: number;
  changed: boolean;
};

const BROAD_SERVICE_TERMS = new Set([
  "manufacturer",
  "contractor",
  "store",
  "service",
  "business",
  "local business",
  "health",
  "medical clinic",
  "consultant",
  "finance",
  "restaurant",
  "home goods store",
  "building materials store",
]);

async function main() {
  loadEnvFile(".env.local");
  const options = parseArgs(process.argv.slice(2));
  const supabase = createServiceClient();
  const rows = await fetchResolutionRows(supabase, options.lookbackDays, options.limit);

  if (rows.length === 0) {
    console.log("No audit_service_resolutions rows found in selected time range.");
    return;
  }

  const snapshots = await fetchAuditSnapshots(
    supabase,
    Array.from(new Set(rows.map((row) => row.audit_id))),
  );

  const gapCases: GapCase[] = rows.map((row) => {
    const snapshot = snapshots.get(row.audit_id);
    return {
      auditId: row.audit_id,
      createdAt: row.created_at,
      businessName: snapshot?.google_data?.business?.name ?? "(unknown business)",
      recommended: normalizeService(row.cs_recommended_service),
      userFinal: normalizeService(row.user_final_service),
      gs: normalizeService(row.gs_service),
      bs: normalizeService(row.bs_service),
      vertical:
        normalizeService(row.user_final_vertical) ||
        normalizeService(snapshot?.google_data?.vertical?.inferred_vertical ?? ""),
      confidence: Number(row.cs_confidence ?? 0),
      changed:
        row.changed_from_recommended ||
        (normalizeService(row.user_final_service) !== "" &&
          normalizeService(row.user_final_service) !==
            normalizeService(row.cs_recommended_service)),
    };
  });

  const overrideCases = gapCases.filter((row) => row.changed && row.userFinal);
  const broadRecommendationCases = gapCases.filter((row) =>
    isBroadService(row.recommended),
  );
  const broadAndOverridden = overrideCases.filter((row) =>
    isBroadService(row.recommended),
  );

  console.log("=== Service Coverage Expansion Loop ===");
  console.log(`Lookback days: ${options.lookbackDays}`);
  console.log(`Rows analyzed: ${gapCases.length}`);
  console.log(
    `User overrides: ${overrideCases.length} (${pct(overrideCases.length, gapCases.length)}%)`,
  );
  console.log(
    `Broad/generic recommendations: ${broadRecommendationCases.length} (${pct(
      broadRecommendationCases.length,
      gapCases.length,
    )}%)`,
  );
  console.log(
    `Broad recommendations overridden by user: ${broadAndOverridden.length} (${pct(
      broadAndOverridden.length,
      Math.max(broadRecommendationCases.length, 1),
    )}% of broad)`,
  );
  console.log("");

  const broadTop = topCounts(
    broadRecommendationCases.map((row) => row.recommended || "(empty)"),
    12,
  );
  if (broadTop.length) {
    console.log("=== Top Broad/Generic Recommended Services ===");
    for (const item of broadTop) {
      console.log(`- ${item.key}: ${item.count}`);
    }
    console.log("");
  }

  const transitionTop = topCounts(
    overrideCases.map((row) => `${row.recommended || "(empty)"} -> ${row.userFinal}`),
    15,
  );
  if (transitionTop.length) {
    console.log("=== Top Override Transitions (model -> user) ===");
    for (const item of transitionTop) {
      console.log(`- ${item.key}: ${item.count}`);
    }
    console.log("");
  }

  const suggestedServiceTargets = topCounts(
    broadAndOverridden.map((row) => row.userFinal),
    12,
  );
  if (suggestedServiceTargets.length) {
    console.log("=== Priority Targets To Improve Next ===");
    for (const item of suggestedServiceTargets) {
      const known = isKnownService(item.key);
      console.log(
        `- ${item.key}: ${item.count} overrides from broad terms (${known ? "existing taxonomy" : "NEW taxonomy candidate"})`,
      );
    }
    console.log("");
  }

  const sampleRows = broadAndOverridden
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, options.sampleSize);
  if (sampleRows.length) {
    console.log("=== Recent High-Value Samples ===");
    for (const row of sampleRows) {
      console.log(
        [
          `- ${row.businessName}`,
          `  rec="${row.recommended}" -> user="${row.userFinal}"`,
          `  gs="${row.gs}" bs="${row.bs}" vertical="${row.vertical}" conf=${row.confidence.toFixed(2)}`,
          `  audit_id=${row.auditId}`,
        ].join("\n"),
      );
    }
    console.log("");
  }

  const lowConfidenceBroad = broadRecommendationCases.filter(
    (row) => row.confidence > 0 && row.confidence <= 0.82,
  );
  if (lowConfidenceBroad.length) {
    console.log("=== Watchlist: Low-confidence Broad Recommendations ===");
    for (const row of lowConfidenceBroad.slice(0, options.sampleSize)) {
      console.log(
        `- ${row.businessName}: rec="${row.recommended}" conf=${row.confidence.toFixed(2)} audit_id=${row.auditId}`,
      );
    }
  }
}

async function fetchResolutionRows(
  supabase: ReturnType<typeof createServiceClient>,
  lookbackDays: number,
  limit: number,
) {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (query: string) => {
        gte: (col: string, value: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{
              data: ResolutionRow[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };

  const { data, error } = await sb
    .from("audit_service_resolutions")
    .select(
      "audit_id, gs_service, bs_service, cs_recommended_service, cs_confidence, cs_reason_codes, user_final_service, user_final_vertical, changed_from_recommended, created_at",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load audit_service_resolutions: ${error.message}`);
  }
  return data ?? [];
}

async function fetchAuditSnapshots(
  supabase: ReturnType<typeof createServiceClient>,
  auditIds: string[],
) {
  const output = new Map<string, AuditSnapshotRow>();
  const chunkSize = 100;
  for (let i = 0; i < auditIds.length; i += chunkSize) {
    const chunk = auditIds.slice(i, i + chunkSize);
    const sb = supabase as unknown as {
      from: (table: string) => {
        select: (query: string) => {
          in: (col: string, values: string[]) => Promise<{
            data: AuditSnapshotRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
    const { data, error } = await sb.from("audits").select("id, google_data").in("id", chunk);
    if (error) {
      throw new Error(`Failed to load audit snapshots: ${error.message}`);
    }
    for (const row of data ?? []) {
      output.set(row.id, row);
    }
  }
  return output;
}

function parseArgs(args: string[]) {
  return {
    lookbackDays: readNumberArg(args, "--days", 30),
    limit: readNumberArg(args, "--limit", 1500),
    sampleSize: readNumberArg(args, "--samples", 12),
  };
}

function readNumberArg(args: string[], name: string, fallback: number) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  const value = Number(args[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function topCounts(values: string[], limit: number) {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value || "(empty)";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function normalizeService(value: string | null | undefined) {
  return canonicalizeService(value).trim();
}

function isBroadService(service: string) {
  if (!service) return true;
  if (BROAD_SERVICE_TERMS.has(service)) return true;
  if (service.split(" ").length <= 1 && !isKnownService(service)) return true;
  return false;
}

function pct(num: number, den: number) {
  if (!den) return "0.0";
  return ((num / den) * 100).toFixed(1);
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment",
    );
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function loadEnvFile(path: string) {
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore
  }
}

main().catch((err) => {
  console.error("[service-coverage-loop] failed:", err);
  process.exitCode = 1;
});
