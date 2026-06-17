import { readFileSync } from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { resolveServiceKeyword } from "@/lib/audit/competitors/keyword-resolver";
import { reconcileServiceDecision } from "@/lib/audit/service-reconciler";
import { analyzeServiceWithAnalyst } from "@/lib/audit/service-analyst";
import { canonicalizeService } from "@/lib/audit/service-taxonomy";
import type { Database } from "@/lib/database.types";
import type { AuditGoogleData } from "@/lib/audit/google/types";

type ResolutionRow = {
  audit_id: string;
  user_final_service: string | null;
  created_at: string;
};

type AuditSnapshotRow = {
  id: string;
  google_data: AuditGoogleData | null;
};

type RowResult = {
  businessName: string;
  userFinal: string;
  currentRecommended: string;
  analystRecommended: string;
  currentHit: boolean;
  analystHit: boolean;
  analystMode: string;
};

async function main() {
  loadEnvFile(".env.local");
  const options = parseArgs(process.argv.slice(2));
  const supabase = createServiceClient();

  const resolutions = await fetchResolutionRows(supabase, options.lookbackDays, options.limit);
  if (resolutions.length === 0) {
    console.log("No user-confirmed rows found in selected window.");
    return;
  }

  const snapshots = await fetchAuditSnapshots(
    supabase,
    Array.from(new Set(resolutions.map((row) => row.audit_id))),
  );

  const results: RowResult[] = [];
  const failures: string[] = [];
  for (const row of resolutions) {
    const snapshot = snapshots.get(row.audit_id);
    const google = snapshot?.google_data;
    const userFinal = canonicalizeService(row.user_final_service);
    if (!google || !userFinal) continue;

    try {
      const seed = resolveServiceKeyword(google);
      const current = reconcileServiceDecision({
        google,
        bsService: seed,
        gbpDescription: google.business.description ?? null,
        websiteSignalText: null,
      });

      const analyst = await analyzeServiceWithAnalyst({
        google,
        googleService: current.gs_service,
        fallbackService: seed,
        gbpDescription: google.business.description ?? null,
        websiteSignalText: null,
        useLlm: options.useLlm,
      });

      const currentRecommended = canonicalizeService(current.cs_recommended_service);
      const analystRecommended = canonicalizeService(analyst.recommended_service);
      results.push({
        businessName: google.business.name,
        userFinal,
        currentRecommended,
        analystRecommended,
        currentHit: currentRecommended === userFinal,
        analystHit: analystRecommended === userFinal,
        analystMode: analyst.mode,
      });
    } catch (err) {
      failures.push(
        `${row.audit_id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (results.length === 0) {
    console.log("No evaluable rows after filtering.");
    return;
  }

  const currentHits = results.filter((result) => result.currentHit).length;
  const analystHits = results.filter((result) => result.analystHit).length;
  const improved = results.filter((result) => !result.currentHit && result.analystHit);
  const regressed = results.filter((result) => result.currentHit && !result.analystHit);
  const changed = results.filter(
    (result) => result.currentRecommended !== result.analystRecommended,
  );

  console.log("=== Service Analyst Shadow Evaluation ===");
  console.log(`Mode: ${options.useLlm ? "LLM + distilled fallback" : "distilled only"}`);
  console.log(`Rows evaluated: ${results.length}`);
  console.log(`Skipped failures: ${failures.length}`);
  console.log(
    `Current hit rate: ${currentHits}/${results.length} (${pct(currentHits, results.length)}%)`,
  );
  console.log(
    `Analyst hit rate: ${analystHits}/${results.length} (${pct(analystHits, results.length)}%)`,
  );
  console.log(`Changed recommendation vs current: ${changed.length}`);
  console.log(`Improved (miss -> hit): ${improved.length}`);
  console.log(`Regressed (hit -> miss): ${regressed.length}`);
  console.log("");

  if (improved.length > 0) {
    console.log("=== Improved Samples ===");
    for (const row of improved.slice(0, options.samples)) {
      console.log(
        `- ${row.businessName}\n  user="${row.userFinal}"\n  current="${row.currentRecommended}" -> analyst="${row.analystRecommended}" (${row.analystMode})`,
      );
    }
    console.log("");
  }

  if (regressed.length > 0) {
    console.log("=== Regressed Samples ===");
    for (const row of regressed.slice(0, options.samples)) {
      console.log(
        `- ${row.businessName}\n  user="${row.userFinal}"\n  current="${row.currentRecommended}" -> analyst="${row.analystRecommended}" (${row.analystMode})`,
      );
    }
    console.log("");
  }

  console.log("=== Changed Samples ===");
  for (const row of changed.slice(0, options.samples)) {
    console.log(
      `- ${row.businessName}\n  user="${row.userFinal}"\n  current="${row.currentRecommended}" | analyst="${row.analystRecommended}" (${row.analystMode})`,
    );
  }

  if (failures.length > 0) {
    console.log("");
    console.log("=== Failures (first 10) ===");
    for (const failure of failures.slice(0, 10)) {
      console.log(`- ${failure}`);
    }
  }
}

function parseArgs(args: string[]) {
  return {
    lookbackDays: readNumberArg(args, "--days", 30),
    limit: readNumberArg(args, "--limit", 500),
    samples: readNumberArg(args, "--samples", 12),
    useLlm: args.includes("--llm"),
  };
}

function readNumberArg(args: string[], name: string, fallback: number) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  const value = Number(args[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
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
          not: (col: string, op: string, value: string) => {
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
  };
  const { data, error } = await sb
    .from("audit_service_resolutions")
    .select("audit_id, user_final_service, created_at")
    .gte("created_at", since)
    .not("user_final_service", "is", "null")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed loading resolutions: ${error.message}`);
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
    if (error) throw new Error(`Failed loading audits: ${error.message}`);
    for (const row of data ?? []) {
      output.set(row.id, row);
    }
  }
  return output;
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
  console.error("[service-analyst-shadow-eval] failed:", err);
  process.exitCode = 1;
});
