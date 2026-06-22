import "server-only";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { BusinessReference, VerticalKey } from "../google/types";
import { getGoogleBusinessData } from "../google";
import { getCompetitorsData } from "../competitors";
import { getAllPlatformsData } from "../platforms";
import { getBenchmarks, getBenchmarksForBusiness } from "../benchmarks";
import { computeAuditScore } from "../scoring";
import { computeProjection } from "../projection";
import { decrementAuditCount } from "../quotas";
import { canonicalizeService } from "../service-taxonomy";
import { renderAndDeliverAudit } from "./index";

export interface StartAuditInput {
  business_ref: BusinessReference;
  user_id: string;
  email: string;
  name?: string;
  /** User-confirmed industry. When set, overrides Google-inferred vertical
   *  for benchmark + scoring purposes. */
  vertical_override?: VerticalKey;
  /** User-confirmed main service (e.g. "bridal boutique"). When set,
   *  preserved as the user-facing phrase for rendering/report copy. */
  service_override?: string;
  /** Canonical alias for stable matching/querying/scoring.
   *  If omitted, derived from `service_override`. */
  service_override_canonical?: string;
  /** Optional competitor place IDs selected during intake preview. */
  selected_competitor_place_ids?: string[];
  /** User-picked report language. "auto" (or undefined) lets the
   *  language router decide from Google data — Chinese businesses get
   *  both, everyone else gets English. The explicit choices force the
   *  render set: "en"/"zh" → single-language, "both" → bilingual. */
  language_choice?: "auto" | "en" | "zh" | "both";
}

export interface StartAuditOutput {
  audit_id: string;
}

/** Creates the pending audits row and returns its id. The pipeline
 * itself is run separately by `runAuditPipeline` (typically scheduled
 * with next/server's `after()` so it survives the API response). */
export async function startAuditGeneration(
  input: StartAuditInput,
): Promise<StartAuditOutput> {
  const audit_id = randomUUID();
  await insertPendingRow(audit_id, input.user_id);
  return { audit_id };
}

export async function runAuditPipeline(
  audit_id: string,
  input: StartAuditInput,
): Promise<void> {
  try {
    const confirmedServiceRaw = String(input.service_override ?? "").trim();
    const confirmedServiceCanonical = canonicalizeService(
      input.service_override_canonical || confirmedServiceRaw,
    );

    await updateStage(audit_id, 1);
    const google = await getGoogleBusinessData(input.business_ref, "paid");

    // Apply user-confirmed vertical override (if any) BEFORE downstream
    // logic that depends on it (benchmarks, scoring, action plan).
    if (input.vertical_override && input.vertical_override !== google.vertical.inferred_vertical) {
      google.vertical.inferred_vertical = input.vertical_override;
      google.vertical.confidence = 1;
    }

    await updateStage(audit_id, 2);
    const [competitors, platforms] = await Promise.all([
      getCompetitorsData(google, "paid", {
        service_override: confirmedServiceCanonical || confirmedServiceRaw || undefined,
        include_place_ids: input.selected_competitor_place_ids,
      }),
      getAllPlatformsData(google, "paid").catch((e) => {
        console.error(`[audit ${audit_id}] platforms fetch failed:`, e);
        return null;
      }),
    ]);

    await updateStage(audit_id, 3);
    const benchmarks = input.vertical_override
      ? await getBenchmarks(input.vertical_override)
      : await getBenchmarksForBusiness(google);
    const scoreBase = computeAuditScore(google, competitors, benchmarks);
    const score = {
      ...scoreBase,
      service_context: {
        confirmed_service: confirmedServiceRaw || null,
        confirmed_service_canonical: confirmedServiceCanonical || null,
      },
    };

    await updateStage(audit_id, 4);
    const projection = computeProjection(google, competitors, score, benchmarks);

    await updateStage(audit_id, 5);
    // "auto" / undefined → let decideLanguages() inspect the Google data
    // and choose. Anything else is an explicit user override.
    const forceLanguage =
      input.language_choice && input.language_choice !== "auto"
        ? input.language_choice
        : undefined;
    await renderAndDeliverAudit({
      google,
      competitors,
      score,
      projection,
      benchmarks,
      platforms: platforms ?? undefined,
      customer: { user_id: input.user_id, email: input.email, name: input.name },
      send_email: !!input.email,
      audit_id,
      force_language: forceLanguage,
    });

    await markComplete(audit_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[audit ${audit_id}] generation failed:`, message);
    await markFailed(audit_id, message).catch(() => {});
    await decrementAuditCount(input.user_id).catch(() => {});
  }
}

async function insertPendingRow(audit_id: string, user_id: string): Promise<void> {
  const supabase = createServiceClient();
  const supabaseAny = supabase as unknown as {
    from: (t: string) => {
      insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error } = await supabaseAny.from("audits").insert({
    id: audit_id,
    user_id,
    business_place_id: "",
    languages_rendered: [],
    pdf_urls: {},
    google_data: {},
    competitors_data: {},
    score_data: {},
    projection_data: {},
    status: "generating",
    progress_stage: 0,
    progress_started_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`pending audit insert failed: ${error.message}`);
  }
}

async function updateStage(audit_id: string, stage: 1 | 2 | 3 | 4 | 5): Promise<void> {
  const supabase = createServiceClient();
  const supabaseAny = supabase as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  await supabaseAny
    .from("audits")
    .update({ progress_stage: stage })
    .eq("id", audit_id);
}

async function markComplete(audit_id: string): Promise<void> {
  const supabase = createServiceClient();
  const supabaseAny = supabase as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  await supabaseAny
    .from("audits")
    .update({ status: "complete", progress_stage: 5 })
    .eq("id", audit_id);
}

async function markFailed(audit_id: string, reason: string): Promise<void> {
  const supabase = createServiceClient();
  const supabaseAny = supabase as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  await supabaseAny
    .from("audits")
    .update({ status: "failed", failed_reason: reason })
    .eq("id", audit_id);
}
