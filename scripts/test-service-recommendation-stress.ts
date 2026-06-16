import { readFileSync } from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { resolveServiceKeyword } from "@/lib/audit/competitors/keyword-resolver";
import { reconcileServiceDecision } from "@/lib/audit/service-reconciler";
import type { Database } from "@/lib/database.types";
import type { AuditGoogleData } from "@/lib/audit/google/types";

type AuditRow = {
  id: string;
  business_place_id: string | null;
  status?: string | null;
  google_data?: AuditGoogleData | null;
};

type StressCase = {
  placeId: string;
  businessName: string;
  tags: string[];
  gs: string;
  bs: string;
  oldRec: string;
  newRec: string;
  changed: boolean;
  oldConfidence: number;
  newConfidence: number;
  delta: number;
  oldReasons: string[];
  newReasons: string[];
  usedWebSignal: boolean;
  usedGbpSignal: boolean;
};

const STRESS_LIMIT = 20;
const QUERY_LIMIT = 500;

const STRESS_PATTERNS: Array<{ tag: string; pattern: RegExp }> = [
  { tag: "manufacturer", pattern: /\b(manufacturer|manufacturing|factory)\b/i },
  { tag: "cabinet", pattern: /\b(cabinet|cabinetry|millwork)\b/i },
  { tag: "countertop", pattern: /\b(countertop|granite|quartz)\b/i },
  { tag: "remodel", pattern: /\b(remodel|renovation|kitchen\s*&\s*bath|kitchen and bath)\b/i },
  { tag: "bridal", pattern: /\b(bridal|wedding|gown|wedding dress)\b/i },
  { tag: "spa", pattern: /\b(spa|massage|wellness|day spa|nail salon)\b/i },
  { tag: "generic", pattern: /\b(store|business|service|health|local business)\b/i },
];

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
    .limit(QUERY_LIMIT);

  if (error) throw new Error(`Failed to load audits: ${error.message}`);

  const uniqueRows = dedupeRows(rawRows ?? []);
  const candidates = uniqueRows
    .map((row) => toCandidate(row))
    .filter((row): row is ReturnType<typeof toCandidate> & { google: AuditGoogleData } =>
      row !== null,
    );

  const tagged = candidates
    .map((row) => {
      const textBlob = [
        row.google.business.name,
        row.google.business.description ?? "",
        row.google.vertical.primary_category_display ?? "",
        row.google.vertical.primary_category ?? "",
        ...(row.google.vertical.google_categories ?? []),
      ]
        .join(" | ")
        .toLowerCase();
      const tags = STRESS_PATTERNS.filter((rule) => rule.pattern.test(textBlob)).map(
        (rule) => rule.tag,
      );
      return {
        ...row,
        tags,
      };
    })
    .filter((row) => row.tags.length > 0)
    .sort((a, b) => b.tags.length - a.tags.length)
    .slice(0, STRESS_LIMIT);

  if (tagged.length === 0) {
    console.log("No stress-tagged audit samples found.");
    return;
  }

  const results: StressCase[] = [];
  const failures: Array<{ placeId: string; error: string }> = [];

  for (const row of tagged) {
    try {
      const google = row.google;
      const bs = resolveServiceKeyword(google);
      const baseline = reconcileServiceDecision({ google, bsService: bs });
      const websiteSignal = await fetchWebsiteServiceSignalText(
        google.business.website ?? null,
      );
      const upgraded = reconcileServiceDecision({
        google,
        bsService: bs,
        gbpDescription: google.business.description ?? null,
        websiteSignalText: websiteSignal,
      });

      results.push({
        placeId: google.business.place_id,
        businessName: google.business.name,
        tags: row.tags,
        gs: baseline.gs_service,
        bs: baseline.bs_service,
        oldRec: baseline.cs_recommended_service,
        newRec: upgraded.cs_recommended_service,
        changed:
          normalize(baseline.cs_recommended_service) !==
          normalize(upgraded.cs_recommended_service),
        oldConfidence: baseline.cs_confidence,
        newConfidence: upgraded.cs_confidence,
        delta: Number((upgraded.cs_confidence - baseline.cs_confidence).toFixed(2)),
        oldReasons: baseline.cs_reason_codes,
        newReasons: upgraded.cs_reason_codes,
        usedWebSignal: upgraded.cs_reason_codes.includes("website_signal"),
        usedGbpSignal: upgraded.cs_reason_codes.includes("gbp_description_signal"),
      });
    } catch (err) {
      failures.push({
        placeId: row.google.business.place_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const changed = results.filter((row) => row.changed);
  const avgOld = average(results.map((row) => row.oldConfidence));
  const avgNew = average(results.map((row) => row.newConfidence));
  const avgDelta = Number((avgNew - avgOld).toFixed(2));
  const webHits = results.filter((row) => row.usedWebSignal).length;
  const gbpHits = results.filter((row) => row.usedGbpSignal).length;

  console.log("=== Service Recommendation Stress Test ===");
  console.log(`Stress samples tested: ${results.length}`);
  console.log(`Failures: ${failures.length}`);
  console.log(`Recommendation changed: ${changed.length}`);
  console.log(
    `Average confidence: ${avgOld.toFixed(2)} -> ${avgNew.toFixed(2)} (delta ${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(2)})`,
  );
  console.log(`Website signal used: ${webHits}/${results.length}`);
  console.log(`GBP description signal used: ${gbpHits}/${results.length}`);
  console.log("");

  if (changed.length > 0) {
    console.log("=== Changed Recommendations ===");
    for (const row of changed) {
      console.log(
        `- ${row.businessName} [${row.tags.join(", ")}]\n  old="${row.oldRec}" -> new="${row.newRec}"\n  conf ${row.oldConfidence.toFixed(2)} -> ${row.newConfidence.toFixed(2)}\n  new reasons: ${row.newReasons.join(", ")}`,
      );
    }
    console.log("");
  }

  console.log("=== Stress Sample Details ===");
  for (const row of results) {
    console.log(
      [
        `- ${row.businessName} [${row.tags.join(", ")}]`,
        `  gs="${row.gs}" bs="${row.bs}"`,
        `  old="${row.oldRec}" new="${row.newRec}" changed=${row.changed ? "Y" : "N"}`,
        `  conf ${row.oldConfidence.toFixed(2)} -> ${row.newConfidence.toFixed(2)} (delta ${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(2)})`,
        `  signals web=${row.usedWebSignal ? "Y" : "N"} gbp=${row.usedGbpSignal ? "Y" : "N"}`,
      ].join("\n"),
    );
  }

  if (failures.length > 0) {
    console.log("");
    console.log("=== Failures ===");
    for (const failure of failures) {
      console.log(`- ${failure.placeId}: ${failure.error}`);
    }
  }
}

function toCandidate(row: AuditRow) {
  const google = row.google_data;
  const placeId = (google?.business?.place_id ?? row.business_place_id ?? "").trim();
  if (!google || !google.business || !google.vertical || !placeId) return null;
  return { row, google };
}

function dedupeRows(rows: AuditRow[]) {
  const seen = new Set<string>();
  const output: AuditRow[] = [];
  for (const row of rows) {
    const placeId =
      (row.google_data?.business?.place_id ?? row.business_place_id ?? "").trim();
    if (!placeId || seen.has(placeId)) continue;
    seen.add(placeId);
    output.push(row);
  }
  return output;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
  console.error("[test-service-recommendation-stress] failed:", err);
  process.exitCode = 1;
});
