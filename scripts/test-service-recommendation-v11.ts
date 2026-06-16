import { readFileSync } from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { resolveServiceKeyword } from "@/lib/audit/competitors/keyword-resolver";
import { reconcileServiceDecision } from "@/lib/audit/service-reconciler";
import type { Database } from "@/lib/database.types";
import type { AuditGoogleData } from "@/lib/audit/google/types";

type AuditRow = {
  id: string;
  business_place_id: string | null;
  created_at?: string | null;
  status?: string | null;
  google_data?: AuditGoogleData | null;
};

type CaseResult = {
  placeId: string;
  businessName: string;
  oldRecommendation: string;
  newRecommendation: string;
  changed: boolean;
  oldConfidence: number;
  newConfidence: number;
  confidenceDelta: number;
  oldReasons: string[];
  newReasons: string[];
  gsService: string;
  bsService: string;
  websiteSignalUsed: boolean;
  gbpDescriptionUsed: boolean;
  inChallengeSet: boolean;
};

const SAMPLE_LIMIT = 120;
const GENERIC_TERMS = new Set([
  "service",
  "services",
  "business",
  "store",
  "company",
  "organization",
  "establishment",
  "point of interest",
  "premise",
  "medical clinic",
  "health",
  "local business",
]);

async function main() {
  loadEnvFile(".env.local");
  const supabase = createServiceClient();
  const supabaseAny = supabase as unknown as {
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

  const { data: rawRows, error } = await supabaseAny
    .from("audits")
    .select("id, business_place_id, status, google_data")
    .eq("status", "complete")
    .limit(120);

  if (error) {
    throw new Error(`Failed to load audits: ${error.message}`);
  }

  const rows = rawRows ?? [];
  const sampleRows = pickSampleRows(rows, SAMPLE_LIMIT);

  if (sampleRows.length === 0) {
    console.log("No valid google_data snapshots found in recent complete audits.");
    return;
  }

  const results: CaseResult[] = [];
  const failures: Array<{ placeId: string; error: string }> = [];

  for (const row of sampleRows) {
    const placeId =
      (row.google_data?.business?.place_id ?? row.business_place_id ?? "").trim() ||
      row.id;
    try {
      const google = row.google_data;
      if (!google || !google.business || !google.vertical) {
        throw new Error("google_data is missing required business/vertical fields");
      }

      const bsService = resolveServiceKeyword(google);

      const baseline = reconcileServiceDecision({
        google,
        bsService,
      });

      const websiteSignalText = await fetchWebsiteServiceSignalText(
        google.business.website ?? null,
      );
      const upgraded = reconcileServiceDecision({
        google,
        bsService,
        gbpDescription: google.business.description ?? null,
        websiteSignalText,
      });
      const inChallengeSet =
        baseline.cs_confidence < 0.75 ||
        baseline.cs_reason_codes.includes("gs_bs_conflict_manual_confirmation") ||
        (isGenericService(baseline.gs_service) &&
          isGenericService(baseline.bs_service));

      results.push({
        placeId,
        businessName: google.business.name,
        oldRecommendation: baseline.cs_recommended_service,
        newRecommendation: upgraded.cs_recommended_service,
        changed:
          normalize(baseline.cs_recommended_service) !==
          normalize(upgraded.cs_recommended_service),
        oldConfidence: baseline.cs_confidence,
        newConfidence: upgraded.cs_confidence,
        confidenceDelta: Number(
          (upgraded.cs_confidence - baseline.cs_confidence).toFixed(2),
        ),
        oldReasons: baseline.cs_reason_codes,
        newReasons: upgraded.cs_reason_codes,
        gsService: upgraded.gs_service,
        bsService: upgraded.bs_service,
        websiteSignalUsed: upgraded.cs_reason_codes.includes("website_signal"),
        gbpDescriptionUsed: upgraded.cs_reason_codes.includes(
          "gbp_description_signal",
        ),
        inChallengeSet,
      });
    } catch (err) {
      failures.push({
        placeId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const changed = results.filter((row) => row.changed);
  const challengeRows = results.filter((row) => row.inChallengeSet);
  const challengeChanged = challengeRows.filter((row) => row.changed);
  const challengeAvgOldConfidence = average(
    challengeRows.map((row) => row.oldConfidence),
  );
  const challengeAvgNewConfidence = average(
    challengeRows.map((row) => row.newConfidence),
  );
  const challengeAvgDelta = Number(
    (challengeAvgNewConfidence - challengeAvgOldConfidence).toFixed(2),
  );
  const websiteSignalCases = results.filter((row) => row.websiteSignalUsed);
  const gbpSignalCases = results.filter((row) => row.gbpDescriptionUsed);
  const avgOldConfidence = average(results.map((row) => row.oldConfidence));
  const avgNewConfidence = average(results.map((row) => row.newConfidence));
  const avgDelta = Number((avgNewConfidence - avgOldConfidence).toFixed(2));

  console.log("=== Service Recommendation V1.1 Regression ===");
  console.log(`Samples tested: ${results.length}`);
  console.log(`Failures: ${failures.length}`);
  console.log(`Recommendation changed: ${changed.length}`);
  console.log(
    `Average confidence: ${avgOldConfidence.toFixed(2)} -> ${avgNewConfidence.toFixed(2)} (delta ${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(2)})`,
  );
  console.log(
    `Cases with GBP description signal: ${gbpSignalCases.length}/${results.length}`,
  );
  console.log(
    `Cases with website signal: ${websiteSignalCases.length}/${results.length}`,
  );
  console.log("");

  console.log("=== Challenge Set (low-confidence / conflict / generic-vs-generic) ===");
  console.log(`Challenge samples: ${challengeRows.length}`);
  console.log(`Changed in challenge set: ${challengeChanged.length}`);
  if (challengeRows.length > 0) {
    console.log(
      `Challenge avg confidence: ${challengeAvgOldConfidence.toFixed(2)} -> ${challengeAvgNewConfidence.toFixed(2)} (delta ${challengeAvgDelta >= 0 ? "+" : ""}${challengeAvgDelta.toFixed(2)})`,
    );
  }
  console.log("");

  if (challengeRows.length > 0) {
    console.log("=== Challenge Rows ===");
    for (const row of challengeRows.slice(0, 10)) {
      console.log(
        [
          `- ${row.businessName}`,
          `  gs="${row.gsService}" bs="${row.bsService}"`,
          `  old="${row.oldRecommendation}" new="${row.newRecommendation}"`,
          `  conf ${row.oldConfidence.toFixed(2)} -> ${row.newConfidence.toFixed(2)} reasons(old): ${row.oldReasons.join(", ")}`,
          `  reasons(new): ${row.newReasons.join(", ")}`,
        ].join("\n"),
      );
    }
    console.log("");
  }

  if (changed.length > 0) {
    console.log("=== Changed Recommendations ===");
    for (const row of changed.slice(0, 8)) {
      console.log(
        `- ${row.businessName}\n  old="${row.oldRecommendation}" -> new="${row.newRecommendation}" | confidence ${row.oldConfidence.toFixed(2)} -> ${row.newConfidence.toFixed(2)}\n  reasons: ${row.newReasons.join(", ")}`,
      );
    }
    console.log("");
  }

  console.log("=== Sample Rows ===");
  for (const row of results.slice(0, 10)) {
    console.log(
      [
        `- ${row.businessName}`,
        `  gs="${row.gsService}" bs="${row.bsService}"`,
        `  old="${row.oldRecommendation}" new="${row.newRecommendation}"`,
        `  delta=${row.confidenceDelta >= 0 ? "+" : ""}${row.confidenceDelta.toFixed(2)} signals(gbp=${row.gbpDescriptionUsed ? "Y" : "N"},web=${row.websiteSignalUsed ? "Y" : "N"})`,
      ].join("\n"),
    );
  }

  if (failures.length > 0) {
    console.log("");
    console.log("=== Failures (first 5) ===");
    for (const failure of failures.slice(0, 5)) {
      console.log(`- ${failure.placeId}: ${failure.error}`);
    }
  }
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isGenericService(value: string) {
  const normalized = normalize(value);
  return GENERIC_TERMS.has(normalized) || normalized.length <= 0;
}

function pickSampleRows(rows: AuditRow[], limit: number) {
  const selected: AuditRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const google = row.google_data;
    const placeId =
      (google?.business?.place_id ?? row.business_place_id ?? "").trim();
    if (!placeId || seen.has(placeId)) continue;
    if (!google?.business?.name || !google?.vertical?.inferred_vertical) continue;
    seen.add(placeId);
    selected.push(row);
    if (selected.length >= limit) break;
  }
  return selected;
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
    // Ignore env loading errors; createServiceClient will fail with a clear message if required vars are missing.
  }
}

main().catch((err) => {
  console.error("[test-service-recommendation-v11] failed:", err);
  process.exitCode = 1;
});
