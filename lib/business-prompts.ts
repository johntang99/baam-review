/**
 * Resolve the trilingual service + quality chip sets for a location's
 * public review page.
 *
 * Precedence (most specific first):
 *   1. locations.prompt_questions JSON override (per-location custom tags)
 *   2. PRESETS[review_category] from lib/review/industry-presets.ts
 *   3. PRESETS.other (generic fallback)
 *
 * locations.review_category is the BAAM-Review-specific 46-bucket
 * classification (separate from locations.business_type which holds the
 * raw Google primary-category string). See lib/review/industry-presets.ts.
 */

import type { Language } from "@/lib/i18n/review";
import {
  getServicesForCategory,
  getQualitiesForCategory,
  asReviewCategory,
  type ReviewCategory,
} from "@/lib/review/industry-presets";

export interface PromptQuestions {
  service_chips?: Partial<Record<Language, string[]>>;
  descriptor_chips?: Partial<Record<Language, string[]>>;
}

/**
 * Service chips for the public review page.
 * @param reviewCategory - locations.review_category value
 * @param lang - viewer language
 * @param override - optional per-location locations.prompt_questions JSON
 */
export function getServiceChips(
  reviewCategory: string | null | undefined,
  lang: Language,
  override?: PromptQuestions | null,
): readonly string[] {
  const custom = override?.service_chips?.[lang];
  if (custom && custom.length > 0) return custom;
  return getServicesForCategory(asReviewCategory(reviewCategory), lang);
}

export function getDescriptorChips(
  reviewCategory: string | null | undefined,
  lang: Language,
  override?: PromptQuestions | null,
): readonly string[] {
  const custom = override?.descriptor_chips?.[lang];
  if (custom && custom.length > 0) return custom;
  return getQualitiesForCategory(asReviewCategory(reviewCategory), lang);
}

/**
 * Coerce arbitrary jsonb (could be old data, or invalid) into a typed
 * PromptQuestions shape. Returns null if the input doesn't look like ours.
 */
export function parsePromptQuestions(
  raw: unknown,
): PromptQuestions | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const result: PromptQuestions = {};

  const sc = obj.service_chips;
  if (sc && typeof sc === "object" && !Array.isArray(sc)) {
    result.service_chips = pickStringArrayMap(sc as Record<string, unknown>);
  }

  const dc = obj.descriptor_chips;
  if (dc && typeof dc === "object" && !Array.isArray(dc)) {
    result.descriptor_chips = pickStringArrayMap(dc as Record<string, unknown>);
  }

  return result.service_chips || result.descriptor_chips ? result : null;
}

function pickStringArrayMap(
  input: Record<string, unknown>,
): Partial<Record<Language, string[]>> {
  const out: Partial<Record<Language, string[]>> = {};
  for (const lang of ["en", "zh", "es"] as const) {
    const v = input[lang];
    if (Array.isArray(v)) {
      const cleaned = v
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter(Boolean);
      if (cleaned.length > 0) out[lang] = cleaned;
    }
  }
  return out;
}

// Re-export for callers that need the typed bucket.
export type { ReviewCategory };
