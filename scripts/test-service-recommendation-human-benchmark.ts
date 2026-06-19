import { readFileSync } from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { resolveServiceKeyword } from "@/lib/audit/competitors/keyword-resolver";
import { reconcileServiceDecision } from "@/lib/audit/service-reconciler";
import { fetchWebsiteServiceSignalText as fetchWebsiteServiceSignalTextCore } from "@/lib/audit/service-signal-web-core";
import type { Database } from "@/lib/database.types";
import type { AuditGoogleData } from "@/lib/audit/google/types";

type ResolutionRow = {
  audit_id: string;
  business_place_id: string | null;
  user_final_service: string | null;
  changed_from_recommended: boolean;
  created_at: string;
};

type AuditSnapshotRow = {
  id: string;
  google_data: AuditGoogleData | null;
};

type CaseResult = {
  auditId: string;
  placeId: string;
  businessName: string;
  userFinalService: string;
  baselineRecommended: string;
  upgradedRecommended: string;
  baselineMatch: boolean;
  upgradedMatch: boolean;
  changedByUpgrade: boolean;
  baselineConfidence: number;
  upgradedConfidence: number;
  usedWebSignal: boolean;
  usedGbpSignal: boolean;
};

const MAX_CASES = 40;

async function main() {
  loadEnvFile(".env.local");
  const supabase = createServiceClient();
  const s = supabase as unknown as {
    from: (table: string) => {
      select: (query: string) => {
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
      selectIn?: unknown;
    };
  };

  const { data: rawResolutions, error: resolutionErr } = await s
    .from("audit_service_resolutions")
    .select(
      "audit_id, business_place_id, user_final_service, changed_from_recommended, created_at",
    )
    .not("user_final_service", "is", "null")
    .order("created_at", { ascending: false })
    .limit(500);

  if (resolutionErr) {
    throw new Error(`Failed to load audit_service_resolutions: ${resolutionErr.message}`);
  }

  const resolutions = dedupeByAuditAndService(rawResolutions ?? []).slice(0, MAX_CASES);
  if (resolutions.length === 0) {
    console.log("No user-confirmed service rows found for benchmark.");
    return;
  }

  const auditIds = resolutions.map((row) => row.audit_id);
  const snapshots = await fetchAuditSnapshots(supabase, auditIds);

  const results: CaseResult[] = [];
  const failures: Array<{ auditId: string; reason: string }> = [];

  for (const row of resolutions) {
    const snapshot = snapshots.get(row.audit_id);
    const google = snapshot?.google_data;
    if (!google || !google.business || !google.vertical) {
      failures.push({ auditId: row.audit_id, reason: "missing google_data snapshot" });
      continue;
    }

    const userFinal = normalize(row.user_final_service ?? "");
    if (!userFinal) {
      failures.push({ auditId: row.audit_id, reason: "empty user_final_service" });
      continue;
    }

    try {
      const bsService = resolveServiceKeyword(google);
      const baseline = reconcileServiceDecision({
        google,
        bsService,
      });
      const websiteSignal = (
        await fetchWebsiteServiceSignalTextCore(google.business.website ?? null)
      )?.text;
      const upgraded = reconcileServiceDecision({
        google,
        bsService,
        gbpDescription: google.business.description ?? null,
        websiteSignalText: websiteSignal,
      });

      const baselineMatch =
        normalize(baseline.cs_recommended_service) === userFinal;
      const upgradedMatch =
        normalize(upgraded.cs_recommended_service) === userFinal;

      results.push({
        auditId: row.audit_id,
        placeId:
          (google.business.place_id ?? row.business_place_id ?? row.audit_id).trim(),
        businessName: google.business.name,
        userFinalService: row.user_final_service ?? "",
        baselineRecommended: baseline.cs_recommended_service,
        upgradedRecommended: upgraded.cs_recommended_service,
        baselineMatch,
        upgradedMatch,
        changedByUpgrade:
          normalize(baseline.cs_recommended_service) !==
          normalize(upgraded.cs_recommended_service),
        baselineConfidence: baseline.cs_confidence,
        upgradedConfidence: upgraded.cs_confidence,
        usedWebSignal: upgraded.cs_reason_codes.includes("website_signal"),
        usedGbpSignal: upgraded.cs_reason_codes.includes("gbp_description_signal"),
      });
    } catch (err) {
      failures.push({
        auditId: row.audit_id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const baselineHits = results.filter((r) => r.baselineMatch).length;
  const upgradedHits = results.filter((r) => r.upgradedMatch).length;
  const improved = results.filter((r) => !r.baselineMatch && r.upgradedMatch);
  const regressed = results.filter((r) => r.baselineMatch && !r.upgradedMatch);
  const unchangedWrong = results.filter((r) => !r.baselineMatch && !r.upgradedMatch);
  const changedRec = results.filter((r) => r.changedByUpgrade).length;
  const avgBaselineConf = average(results.map((r) => r.baselineConfidence));
  const avgUpgradedConf = average(results.map((r) => r.upgradedConfidence));

  console.log("=== Human-Benchmark Service Recommendation Test ===");
  console.log(`Cases evaluated: ${results.length}`);
  console.log(`Failures skipped: ${failures.length}`);
  console.log(`Recommendation changed by upgrade: ${changedRec}`);
  console.log(
    `Match user-final (baseline): ${baselineHits}/${results.length} (${pct(baselineHits, results.length)}%)`,
  );
  console.log(
    `Match user-final (upgraded): ${upgradedHits}/${results.length} (${pct(upgradedHits, results.length)}%)`,
  );
  console.log(`Improved (miss -> hit): ${improved.length}`);
  console.log(`Regressed (hit -> miss): ${regressed.length}`);
  console.log(`Unchanged wrong (miss -> miss): ${unchangedWrong.length}`);
  console.log(
    `Avg confidence: ${avgBaselineConf.toFixed(2)} -> ${avgUpgradedConf.toFixed(2)} (delta ${(avgUpgradedConf - avgBaselineConf >= 0 ? "+" : "") + (avgUpgradedConf - avgBaselineConf).toFixed(2)})`,
  );
  console.log(
    `Signal usage: website ${results.filter((r) => r.usedWebSignal).length}/${results.length}, gbp-description ${results.filter((r) => r.usedGbpSignal).length}/${results.length}`,
  );
  console.log("");

  if (improved.length > 0) {
    console.log("=== Improvements ===");
    for (const row of improved.slice(0, 15)) {
      console.log(
        `- ${row.businessName}\n  user_final="${row.userFinalService}"\n  baseline="${row.baselineRecommended}" -> upgraded="${row.upgradedRecommended}"`,
      );
    }
    console.log("");
  }

  if (regressed.length > 0) {
    console.log("=== Regressions ===");
    for (const row of regressed.slice(0, 15)) {
      console.log(
        `- ${row.businessName}\n  user_final="${row.userFinalService}"\n  baseline="${row.baselineRecommended}" -> upgraded="${row.upgradedRecommended}"`,
      );
    }
    console.log("");
  }

  console.log("=== Sample Cases ===");
  for (const row of results.slice(0, 12)) {
    console.log(
      [
        `- ${row.businessName}`,
        `  user_final="${row.userFinalService}"`,
        `  baseline="${row.baselineRecommended}" (${row.baselineMatch ? "hit" : "miss"})`,
        `  upgraded="${row.upgradedRecommended}" (${row.upgradedMatch ? "hit" : "miss"}) changed=${row.changedByUpgrade ? "Y" : "N"}`,
      ].join("\n"),
    );
  }

  if (failures.length > 0) {
    console.log("");
    console.log("=== Skipped Cases (first 10) ===");
    for (const f of failures.slice(0, 10)) {
      console.log(`- ${f.auditId}: ${f.reason}`);
    }
  }
}

async function fetchAuditSnapshots(
  supabase: ReturnType<typeof createServiceClient>,
  auditIds: string[],
) {
  const map = new Map<string, AuditSnapshotRow>();
  const chunkSize = 80;
  for (let i = 0; i < auditIds.length; i += chunkSize) {
    const chunk = auditIds.slice(i, i + chunkSize);
    const sb = supabase as unknown as {
      from: (table: string) => {
        select: (query: string) => {
          in: (col: string, vals: string[]) => Promise<{
            data: AuditSnapshotRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
    const { data, error } = await sb
      .from("audits")
      .select("id, google_data")
      .in("id", chunk);
    if (error) {
      throw new Error(`Failed to load audit snapshots: ${error.message}`);
    }
    for (const row of data ?? []) {
      map.set(row.id, row);
    }
  }
  return map;
}

function dedupeByAuditAndService(rows: ResolutionRow[]) {
  const seen = new Set<string>();
  const output: ResolutionRow[] = [];
  for (const row of rows) {
    const key = `${row.audit_id}::${normalize(row.user_final_service ?? "")}`;
    if (!normalize(row.user_final_service ?? "") || seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }
  return output;
}

function pct(num: number, den: number) {
  if (!den) return "0.0";
  return ((num / den) * 100).toFixed(1);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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

async function fetchWebsiteServiceSignalText(
  inputUrl: string | null | undefined,
): Promise<string | null> {
  const url = normalizeWebsiteUrl(inputUrl);
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2200);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BAAMReviewAuditBot/1.0; +https://baamreview.com)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;

    const html = (await response.text()).slice(0, 200_000);
    const text = extractSignalText(html);
    return text.length > 20 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWebsiteUrl(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function extractSignalText(html: string) {
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const title = normalizeText(
    extractFirstGroup(cleaned, /<title[^>]*>([\s\S]*?)<\/title>/i),
  );
  const body = normalizeText(cleaned.replace(/<[^>]+>/g, " ")).slice(0, 1800);
  return [title, body].filter(Boolean).join(" | ");
}

function extractFirstGroup(input: string, pattern: RegExp) {
  const match = input.match(pattern);
  return match?.[1] ?? "";
}

function normalizeText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
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
  console.error("[test-service-recommendation-human-benchmark] failed:", err);
  process.exitCode = 1;
});
