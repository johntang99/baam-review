import { readFileSync } from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { resolveServiceKeyword } from "@/lib/audit/competitors/keyword-resolver";
import { reconcileServiceDecision } from "@/lib/audit/service-reconciler";
import { analyzeServiceWithAnalyst } from "@/lib/audit/service-analyst";
import { fetchWebsiteServiceSignalText } from "@/lib/audit/service-signal-web-core";
import { pickTopComprehensiveService } from "@/lib/audit/service-candidate-generator";
import {
  canonicalizeService,
  getServiceSpecificity,
} from "@/lib/audit/service-taxonomy";
import { isBroadServiceTerm } from "@/lib/audit/broad-service-terms";
import type { Database } from "@/lib/database.types";
import type { AuditGoogleData } from "@/lib/audit/google/types";

type AuditRow = {
  id: string;
  google_data: AuditGoogleData | null;
  status: string | null;
};

type EvalRow = {
  auditId: string;
  business: string;
  vertical: string;
  systemService: string;
  llmService: string;
  llmMode: string;
  same: boolean;
  systemBroad: boolean;
  llmBroad: boolean;
  specificityDelta: number;
};

async function main() {
  loadEnvFile(".env.local");
  const options = parseArgs(process.argv.slice(2));
  const supabase = createServiceClient();
  const primaryAnalystUseLlm =
    process.env.SERVICE_ANALYST_PRIMARY_USE_LLM === "1" ||
    (process.env.SERVICE_ANALYST_PRIMARY_USE_LLM !== "0" &&
      !!process.env.ANTHROPIC_API_KEY);
  const effectiveModel =
    process.env.SERVICE_ANALYST_CLAUDE_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    "claude-opus-4-1-20250805";

  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (query: string) => {
        eq: (column: string, value: string) => {
          limit: (value: number) => Promise<{
            data: AuditRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data, error } = await sb
    .from("audits")
    .select("id, status, google_data")
    .eq("status", "complete")
    .limit(options.limit * 3);
  if (error) {
    throw new Error(`Failed to load audits: ${error.message}`);
  }

  const uniqueRows = dedupeRows(data ?? []).slice(0, options.limit);
  const rows: EvalRow[] = [];
  const failures: Array<{ auditId: string; reason: string }> = [];

  for (const row of uniqueRows) {
    const google = row.google_data;
    if (!google?.business?.name || !google.vertical?.inferred_vertical) continue;
    try {
      const seedService = resolveServiceKeyword(google);
      const websiteSignal = await fetchWebsiteServiceSignalText(
        google.business.website ?? null,
      );
      const comprehensiveTop = pickTopComprehensiveService({
        google,
        gbpDescription: google.business.description ?? null,
        websiteSignalText: websiteSignal?.text ?? null,
        seedService,
      });
      const baseDetectedService = comprehensiveTop?.service || seedService;
      const systemDecision = reconcileServiceDecision({
        google,
        bsService: baseDetectedService,
        gbpDescription: google.business.description ?? null,
        websiteSignalText: websiteSignal?.text ?? null,
      });
      const analyst = await analyzeServiceWithAnalyst({
        google,
        googleService:
          google.vertical.primary_category_display ||
          google.vertical.primary_category ||
          "",
        fallbackService: baseDetectedService,
        gbpDescription: google.business.description ?? null,
        websiteSignalText: websiteSignal?.text ?? null,
        useLlm: primaryAnalystUseLlm,
      });
      const systemService = canonicalizeService(systemDecision.cs_recommended_service);
      const llmService = canonicalizeService(analyst.recommended_service);
      const systemBroad = isBroadService(systemService, google.vertical.inferred_vertical);
      const llmBroad = isBroadService(llmService, google.vertical.inferred_vertical);

      rows.push({
        auditId: row.id,
        business: google.business.name,
        vertical: google.vertical.inferred_vertical,
        systemService,
        llmService,
        llmMode: analyst.mode,
        same: systemService === llmService,
        systemBroad,
        llmBroad,
        specificityDelta:
          getServiceSpecificity(llmService) - getServiceSpecificity(systemService),
      });
    } catch (err) {
      failures.push({
        auditId: row.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const disagreements = rows.filter((item) => !item.same);
  const llmMoreSpecific = rows.filter((item) => item.specificityDelta > 0);
  const llmLessSpecific = rows.filter((item) => item.specificityDelta < 0);
  const llmReducedBroad = rows.filter((item) => item.systemBroad && !item.llmBroad);
  const llmIntroducedBroad = rows.filter((item) => !item.systemBroad && item.llmBroad);

  console.log("=== Large Cases LLM Comparison (Review Audit Pipeline) ===");
  console.log(`Rows evaluated: ${rows.length}`);
  console.log(`Failures: ${failures.length}`);
  console.log(`Effective analyst model: ${effectiveModel}`);
  console.log(`LLM enabled for analyst: ${primaryAnalystUseLlm ? "yes" : "no"}`);
  console.log(`System vs LLM same: ${rows.length - disagreements.length}/${rows.length}`);
  console.log(`System vs LLM different: ${disagreements.length}/${rows.length}`);
  console.log(`LLM more specific than system: ${llmMoreSpecific.length}`);
  console.log(`LLM less specific than system: ${llmLessSpecific.length}`);
  console.log(`LLM reduced broad outputs: ${llmReducedBroad.length}`);
  console.log(`LLM introduced broad outputs: ${llmIntroducedBroad.length}`);
  console.log("");

  console.log("=== Disagreement Samples ===");
  for (const item of disagreements.slice(0, options.samples)) {
    console.log(
      `- ${item.business} [${item.vertical}]` +
        `\n  system="${item.systemService}"` +
        `\n  llm="${item.llmService}" (${item.llmMode})` +
        `\n  specificity_delta=${item.specificityDelta}`,
    );
  }

  if (failures.length > 0) {
    console.log("");
    console.log("=== Failures (first 10) ===");
    for (const failure of failures.slice(0, 10)) {
      console.log(`- ${failure.auditId}: ${failure.reason}`);
    }
  }
}

function isBroadService(service: string, vertical?: string) {
  const normalized = canonicalizeService(service);
  if (!normalized) return true;
  if (isBroadServiceTerm(normalized, { vertical })) return true;
  return getServiceSpecificity(normalized) <= 2;
}

function parseArgs(args: string[]) {
  return {
    limit: readNumberArg(args, "--limit", 120),
    samples: readNumberArg(args, "--samples", 20),
  };
}

function readNumberArg(args: string[], name: string, fallback: number) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  const value = Number(args[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function dedupeRows(rows: AuditRow[]) {
  const seen = new Set<string>();
  const output: AuditRow[] = [];
  for (const row of rows) {
    const placeId = (row.google_data?.business?.place_id ?? "").trim();
    if (!placeId || seen.has(placeId)) continue;
    seen.add(placeId);
    output.push(row);
  }
  return output;
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
  console.error("[llm-large-cases-eval] failed:", err);
  process.exitCode = 1;
});
