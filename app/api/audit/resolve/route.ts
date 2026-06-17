import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  BusinessHasNoReviewsError,
  BusinessNotFoundError,
  getGoogleBusinessData,
} from "@/lib/audit/google";
import { resolveServiceKeyword } from "@/lib/audit/competitors/keyword-resolver";
import { reconcileServiceDecision } from "@/lib/audit/service-reconciler";
import { fetchWebsiteServiceSignalText } from "@/lib/audit/service-signal-web";
import { logUnknownServiceCandidate } from "@/lib/audit/service-learning";
import {
  generateServiceCandidates,
  pickTopComprehensiveService,
} from "@/lib/audit/service-candidate-generator";
import { analyzeServiceWithAnalyst } from "@/lib/audit/service-analyst";
import {
  canonicalizeService,
  getServiceSpecificity,
  isKnownService,
} from "@/lib/audit/service-taxonomy";
import { isBroadServiceTerm } from "@/lib/audit/broad-service-terms";
import type { VerticalKey } from "@/lib/audit/google/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// UI industry options can include aliases that map to existing backend verticals.
const INDUSTRY_OPTIONS: string[] = [
  "tcm_clinic",
  "dental",
  "legal_immigration",
  "restaurant",
  "real_estate",
  "hotel",
  "auto",
  "contractor",
  "manufacturer_industrial",
  "salon_spa",
  "cafe",
  "apparel",
  "health_food",
  "insurance",
  "optometry_vision",
  "general_smb",
];

const FALLBACK_SERVICE_OPTIONS_BY_VERTICAL: Partial<Record<VerticalKey, string[]>> = {
  contractor: ["hvac contractor", "window treatment store", "kitchen remodeler"],
  restaurant: ["chinese restaurant", "italian restaurant", "mexican restaurant"],
  dental: ["pediatric dentist", "orthodontist", "dentist"],
  legal_immigration: ["immigration lawyer", "divorce lawyer", "personal injury lawyer"],
  salon_spa: ["day spa", "nail salon", "hair salon"],
  auto: ["auto repair", "auto body shop", "tire shop"],
  real_estate: ["real estate agent", "real estate broker", "property management"],
  apparel: ["bridal boutique", "jewelry store", "shoe store"],
  insurance: ["insurance agent", "insurance broker", "life insurance agency"],
  general_smb: ["business coach", "print shop", "loan agency"],
};

const EVIDENCE_SERVICE_OPTION_RULES: Array<{
  pattern: RegExp;
  options: string[];
  verticals?: VerticalKey[];
}> = [
  {
    pattern:
      /\b(business coach|business coaching|executive coach|growth coach|business consultant|business consulting)\b/i,
    options: ["business coach", "management consultant", "marketing consultant"],
  },
  {
    pattern: /\b(bridal|wedding dress|wedding gown|bridal boutique|bridal shop)\b/i,
    options: ["bridal boutique", "wedding dress shop", "formal wear store"],
    verticals: ["apparel", "general_smb"],
  },
  {
    pattern: /\b(curtains?|blinds?|shutters?|drapery|window treatments?)\b/i,
    options: ["window treatment store", "blinds store", "curtain store"],
    verticals: ["contractor", "general_smb"],
  },
  {
    pattern:
      /\b(mortgage broker|home loan|mortgage lender|loan agency|lending company|loan company|loan service)\b/i,
    options: ["loan agency", "mortgage broker", "financial planner"],
  },
  {
    pattern: /\b(financial advisor|financial planner|wealth advisor|wealth management)\b/i,
    options: ["financial planner", "loan agency", "mortgage broker"],
  },
  {
    pattern: /\b(bank|banking|credit union)\b/i,
    options: ["retail bank", "credit union", "loan agency"],
  },
  {
    pattern:
      /\b(tutor|tutoring|training school|learning center|learning centre|education center|education centre)\b/i,
    options: ["tutoring service", "vocational training center", "language school"],
  },
  {
    pattern: /\b(print(ing)?|print shop|commercial printer|copy shop|copy center|offset print)\b/i,
    options: ["print shop", "marketing consultant", "shipping and mailing service"],
  },
  {
    pattern: /\b(vocational school|trade school|skills training|career training)\b/i,
    options: ["vocational training center", "tutoring service", "language school"],
  },
  {
    pattern: /\b(language school|esl school|english school|language academy)\b/i,
    options: ["language school", "tutoring service", "vocational training center"],
  },
  {
    pattern:
      /\b(hvac|air conditioning|a\/c|heating\s*(and|&)\s*cooling|cooling\s*(and|&)\s*heating|furnace|heat pump|duct(work)?|ventilation)\b/i,
    options: ["hvac contractor", "air duct cleaning service", "heating contractor"],
    verticals: ["contractor", "general_smb"],
  },
];

interface ResolveRequest {
  name?: string;
  address?: string;
  website?: string;
}

const PRIMARY_ANALYST_ENABLED = process.env.SERVICE_ANALYST_PRIMARY === "1";
const PRIMARY_ANALYST_USE_LLM = process.env.SERVICE_ANALYST_PRIMARY_USE_LLM === "1";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!auth.user.email_confirmed_at) {
    return NextResponse.json({ error: "email_not_verified" }, { status: 403 });
  }

  let body: ResolveRequest;
  try {
    body = (await request.json()) as ResolveRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const address = (body.address ?? "").trim();
  if (!name || !address) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const textQuery = `${name} ${address}`;

  try {
    const google = await getGoogleBusinessData({ textQuery }, "free");
    const detectedVertical: VerticalKey = google.vertical.inferred_vertical;
    const websiteSignal = await fetchWebsiteServiceSignalText(
      google.business.website ?? body.website,
    );
    const fallbackDetectedService = resolveServiceKeyword(google);
    const comprehensiveTop = pickTopComprehensiveService({
      google,
      gbpDescription: google.business.description ?? null,
      websiteSignalText: websiteSignal?.text ?? null,
      seedService: fallbackDetectedService,
    });
    const generatedCandidates = generateServiceCandidates({
      google,
      gbpDescription: google.business.description ?? null,
      websiteSignalText: websiteSignal?.text ?? null,
      seedService: fallbackDetectedService,
    });
    const orderedCandidates = comprehensiveTop
      ? [
          comprehensiveTop,
          ...generatedCandidates.filter(
            (candidate) => candidate.service !== comprehensiveTop.service,
          ),
        ]
      : generatedCandidates;
    const comprehensiveCandidates = orderedCandidates.slice(0, 3).map((candidate) => ({
      service: candidate.service,
      score: candidate.score,
      confidence: candidate.confidence,
      specificity: candidate.specificity,
      sources: candidate.sources,
    }));
    const baseDetectedService = comprehensiveTop?.service || fallbackDetectedService;
    const primaryAnalyst = PRIMARY_ANALYST_ENABLED
      ? await analyzeServiceWithAnalyst({
          google,
          googleService:
            google.vertical.primary_category_display || google.vertical.primary_category || "",
          fallbackService: baseDetectedService,
          gbpDescription: google.business.description ?? null,
          websiteSignalText: websiteSignal?.text ?? null,
          useLlm: PRIMARY_ANALYST_USE_LLM,
        }).catch((err) => {
          console.error("[resolve] primary analyst failed:", err);
          return null;
        })
      : null;
    if (
      primaryAnalyst &&
      primaryAnalyst.recommended_service &&
      !isKnownService(primaryAnalyst.recommended_service) &&
      getServiceSpecificity(primaryAnalyst.recommended_service) >= 3
    ) {
      await logUnknownServiceCandidate({
        user_id: auth.user.id,
        business_place_id: google.business.place_id ?? undefined,
        business_name: google.business.name,
        inferred_vertical: detectedVertical,
        candidate_service: primaryAnalyst.recommended_service,
        source_tag: `primary_analyst_${primaryAnalyst.mode}`,
        confidence: primaryAnalyst.confidence,
        rationale: primaryAnalyst.rationale,
        evidence_excerpt: [
          google.business.name,
          google.business.description ?? "",
          websiteSignal?.text ?? "",
        ]
          .join(" ")
          .trim(),
      });
    }
    const detectedService = primaryAnalyst?.recommended_service || baseDetectedService;
    const serviceDecision = reconcileServiceDecision({
      google,
      bsService: detectedService,
      gbpDescription: google.business.description ?? null,
      websiteSignalText: websiteSignal?.text ?? null,
    });
    const serviceOptions = buildServiceOptions({
      vertical: detectedVertical,
      generatedCandidates: orderedCandidates,
      recommendedService: serviceDecision.cs_recommended_service,
      google,
      websiteSignalText: websiteSignal?.text ?? null,
    });
    const needsServiceSelection =
      isBroadService(serviceDecision.cs_recommended_service, detectedVertical) ||
      serviceDecision.cs_reason_codes.includes("broad_service_needs_user_selection");
    const enableShadow = process.env.SERVICE_ANALYST_SHADOW === "1";
    const useLlmShadow = process.env.SERVICE_ANALYST_SHADOW_USE_LLM === "1";
    const serviceShadow = enableShadow
      ? primaryAnalyst ??
        (await analyzeServiceWithAnalyst({
          google,
          googleService: serviceDecision.gs_service,
          fallbackService: detectedService,
          gbpDescription: google.business.description ?? null,
          websiteSignalText: websiteSignal?.text ?? null,
          useLlm: useLlmShadow,
        }).catch((err) => {
          console.error("[resolve] service shadow failed:", err);
          return null;
        }))
      : null;
    const websiteMatch = matchWebsite(body.website, google.business.website);

    return NextResponse.json({
      place_id: google.business.place_id,
      name: google.business.name,
      name_secondary: google.business.name_secondary ?? null,
      formatted_address: google.business.formatted_address,
      city: google.business.city,
      state: google.business.state,
      zip: google.business.zip,
      website_on_google: google.business.website ?? null,
      rating: google.reviews_aggregate.rating,
      total_count: google.reviews_aggregate.total_count,
      last_review_days_ago: google.reviews_aggregate.last_review_days_ago,
      is_chinese_business: google.language.is_chinese_business,
      detected_vertical: detectedVertical,
      detected_service: detectedService,
      gs_service: serviceDecision.gs_service,
      bs_service: serviceDecision.bs_service,
      cs_recommended_service: serviceDecision.cs_recommended_service,
      cs_confidence: serviceDecision.cs_confidence,
      cs_reason_codes: serviceDecision.cs_reason_codes,
      service_candidates: comprehensiveCandidates,
      service_options: serviceOptions,
      needs_service_selection: needsServiceSelection,
      primary_analyst: primaryAnalyst
        ? {
            enabled: true,
            mode: primaryAnalyst.mode,
            recommended_service: primaryAnalyst.recommended_service,
            confidence: primaryAnalyst.confidence,
            rationale: primaryAnalyst.rationale,
          }
        : { enabled: false },
      service_shadow: serviceShadow
        ? {
            enabled: true,
            mode: serviceShadow.mode,
            recommended_service: serviceShadow.recommended_service,
            confidence: serviceShadow.confidence,
            agrees_with_system:
              canonicalizeService(serviceShadow.recommended_service) ===
              canonicalizeService(serviceDecision.cs_recommended_service),
          }
        : { enabled: false },
      // Actual Google Business Profile categorization (for display/context).
      google_category:
        google.vertical.primary_category_display ||
        humanizeCategory(google.vertical.primary_category),
      google_categories: humanizeCategories(
        google.vertical.google_categories,
        google.vertical.primary_category,
      ),
      vertical_options: INDUSTRY_OPTIONS,
      website_match: websiteMatch,
    });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (err instanceof BusinessHasNoReviewsError) {
      return NextResponse.json({ error: "NO_REVIEWS" }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[resolve] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Google `types` mixes real categories with structural ones; drop the noise.
const GENERIC_TYPES = new Set([
  "establishment",
  "point_of_interest",
  "premise",
  "geocode",
  "food",
  "store",
  "health",
]);

function humanizeCategory(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Additional GBP categories (excluding the primary + generic types),
 *  humanized for display. */
function humanizeCategories(types: string[], primary: string): string[] {
  return types
    .filter((t) => t !== primary && !GENERIC_TYPES.has(t))
    .map(humanizeCategory);
}

function matchWebsite(
  user: string | undefined,
  google: string | undefined | null,
): "match" | "mismatch" | "no_user_input" | "no_google_data" {
  const u = (user ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const g = (google ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!u) return "no_user_input";
  if (!g) return "no_google_data";
  const userHost = u.replace(/^www\./, "").split("/")[0];
  const googleHost = g.replace(/^www\./, "").split("/")[0];
  return userHost === googleHost ? "match" : "mismatch";
}

function isBroadService(input: string, vertical?: string) {
  const canonical = canonicalizeService(input);
  if (!canonical) return true;
  if (isBroadServiceTerm(canonical, { vertical })) return true;
  return getServiceSpecificity(canonical) <= 2;
}

function buildServiceOptions({
  vertical,
  generatedCandidates,
  recommendedService,
  google,
  websiteSignalText,
}: {
  vertical: VerticalKey;
  generatedCandidates: Array<{
    service: string;
    score: number;
    confidence: number;
    sources: string[];
    specificity: number;
  }>;
  recommendedService: string;
  google: {
    business: { name: string; description?: string | null };
    vertical: {
      primary_category?: string | null;
      primary_category_display?: string | null;
      google_categories?: string[];
    };
  };
  websiteSignalText?: string | null;
}) {
  const options: string[] = [];
  const push = (value: string) => {
    const normalized = canonicalizeService(value);
    if (!normalized) return;
    if (options.includes(normalized)) return;
    if (isBroadService(normalized, vertical)) return;
    options.push(normalized);
  };

  push(recommendedService);
  for (const candidate of generatedCandidates) {
    if (candidate.specificity < 3) continue;
    if (candidate.confidence < 0.62) continue;
    push(candidate.service);
    if (options.length >= 3) break;
  }

  if (options.length < 3) {
    const categoriesText = (google.vertical.google_categories ?? [])
      .map((category) => category.replace(/_/g, " "))
      .join(" ");
    const evidenceText = [
      google.business.name,
      google.business.description ?? "",
      google.vertical.primary_category_display ?? "",
      google.vertical.primary_category ?? "",
      categoriesText,
      websiteSignalText ?? "",
      recommendedService,
    ]
      .join(" ")
      .toLowerCase();

    for (const suggestion of inferEvidenceServiceOptions(evidenceText, vertical)) {
      push(suggestion);
      if (options.length >= 3) break;
    }
  }

  if (options.length < 3) {
    for (const fallback of FALLBACK_SERVICE_OPTIONS_BY_VERTICAL[vertical] ?? []) {
      push(fallback);
      if (options.length >= 3) break;
    }
  }

  return options.slice(0, 3);
}

function inferEvidenceServiceOptions(text: string, vertical: VerticalKey) {
  const output: string[] = [];
  for (const rule of EVIDENCE_SERVICE_OPTION_RULES) {
    if (rule.verticals && !rule.verticals.includes(vertical)) continue;
    if (!rule.pattern.test(text)) continue;
    for (const option of rule.options) {
      if (!output.includes(option)) output.push(option);
    }
  }
  return output;
}
