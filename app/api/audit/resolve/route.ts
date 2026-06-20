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
    pattern:
      /\b(school|academy|after school|prep school|test prep|education academy|learning academy)\b/i,
    options: ["tutoring service", "after school program", "language school"],
  },
  {
    pattern:
      /\b(kitchen\s*(and|&)\s*bath|bath(room)? fixtures?|plumbing showroom|walk[\s-]?in tubs?|tub showroom|tubz)\b/i,
    options: [
      "kitchen & bath plumbing showroom",
      "kitchen remodeler",
      "plumbing service",
    ],
    verticals: ["contractor", "general_smb"],
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

const HAS_LLM_PROVIDER = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
const PRIMARY_ANALYST_ENABLED =
  process.env.SERVICE_ANALYST_PRIMARY === "1" ||
  (process.env.SERVICE_ANALYST_PRIMARY !== "0" && HAS_LLM_PROVIDER);
const PRIMARY_ANALYST_USE_LLM =
  process.env.SERVICE_ANALYST_PRIMARY_USE_LLM === "1" ||
  (process.env.SERVICE_ANALYST_PRIMARY_USE_LLM !== "0" && HAS_LLM_PROVIDER);
const SHADOW_ANALYST_ENABLED =
  process.env.SERVICE_ANALYST_SHADOW === "1" ||
  (process.env.SERVICE_ANALYST_SHADOW !== "0" && HAS_LLM_PROVIDER);
const SHADOW_ANALYST_USE_LLM =
  process.env.SERVICE_ANALYST_SHADOW_USE_LLM === "1" ||
  (process.env.SERVICE_ANALYST_SHADOW_USE_LLM !== "0" && HAS_LLM_PROVIDER);
const MAX_SERVICE_OPTIONS = 4;

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
    const detectedService = selectPrimaryDetectedService({
      baseDetectedService,
      primaryAnalyst,
    });
    const reconciledServiceDecision = reconcileServiceDecision({
      google,
      bsService: detectedService,
      gbpDescription: google.business.description ?? null,
      websiteSignalText: websiteSignal?.text ?? null,
    });
    const serviceDecision = applyLlmForcedDefault({
      serviceDecision: reconciledServiceDecision,
      primaryAnalyst,
    });
    const serviceShadow = SHADOW_ANALYST_ENABLED
      ? await analyzeServiceWithAnalyst({
          google,
          googleService: serviceDecision.gs_service,
          fallbackService: detectedService,
          gbpDescription: google.business.description ?? null,
          websiteSignalText: websiteSignal?.text ?? null,
          useLlm: SHADOW_ANALYST_USE_LLM,
        }).catch((err) => {
          console.error("[resolve] service shadow failed:", err);
          return null;
        })
      : null;
    const llmCandidates = collectLlmSuggestedServices({
      primaryAnalyst,
      serviceShadow,
    });
    const llmServicePhrases = collectLlmSuggestedPhrases({
      primaryAnalyst,
      serviceShadow,
    });
    const serviceOptions = buildServiceOptions({
      vertical: detectedVertical,
      generatedCandidates: orderedCandidates,
      recommendedService: serviceDecision.cs_recommended_service,
      llmSuggestedServices: llmCandidates,
      google,
      websiteSignalText: websiteSignal?.text ?? null,
    });
    const needsServiceSelection =
      isBroadService(serviceDecision.cs_recommended_service, detectedVertical) ||
      serviceDecision.cs_reason_codes.includes("broad_service_needs_user_selection");
    const serviceCandidates = buildDisplayServiceCandidates({
      generatedCandidates: orderedCandidates,
      llmCandidates,
      llmConfidence:
        primaryAnalyst?.mode === "llm"
          ? primaryAnalyst.confidence
          : serviceShadow?.mode === "llm"
            ? serviceShadow.confidence
            : null,
    });
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
      service_candidates: serviceCandidates,
      service_options: serviceOptions,
      needs_service_selection: needsServiceSelection,
      llm_service_candidates: llmCandidates,
      llm_service_phrases: llmServicePhrases,
      primary_analyst: primaryAnalyst
        ? {
            enabled: true,
            mode: primaryAnalyst.mode,
            llm_provider: primaryAnalyst.llm_provider ?? "",
            llm_model: primaryAnalyst.llm_model ?? "",
            llm_fallback_used: primaryAnalyst.llm_fallback_used ?? false,
            recommended_service: primaryAnalyst.recommended_service,
            llm_service_phrase: primaryAnalyst.llm_service_phrase ?? "",
            llm_phrase_candidates: primaryAnalyst.llm_phrase_candidates ?? [],
            confidence: primaryAnalyst.confidence,
            rationale: primaryAnalyst.rationale,
            llm_suggested_services: primaryAnalyst.llm_suggested_services ?? [],
          }
        : { enabled: false },
      service_shadow: serviceShadow
        ? {
            enabled: true,
            mode: serviceShadow.mode,
            llm_provider: serviceShadow.llm_provider ?? "",
            llm_model: serviceShadow.llm_model ?? "",
            llm_fallback_used: serviceShadow.llm_fallback_used ?? false,
            recommended_service: serviceShadow.recommended_service,
            llm_service_phrase: serviceShadow.llm_service_phrase ?? "",
            llm_phrase_candidates: serviceShadow.llm_phrase_candidates ?? [],
            confidence: serviceShadow.confidence,
            llm_suggested_services: serviceShadow.llm_suggested_services ?? [],
            agrees_with_system:
              canonicalizeService(serviceShadow.recommended_service) ===
              canonicalizeService(serviceDecision.cs_recommended_service),
          }
        : { enabled: false },
      service_model_debug: {
        primary: primaryAnalyst
          ? {
              mode: primaryAnalyst.mode,
              provider: primaryAnalyst.llm_provider ?? "",
              model: primaryAnalyst.llm_model ?? "",
              fallback_used: primaryAnalyst.llm_fallback_used ?? false,
            }
          : null,
        shadow: serviceShadow
          ? {
              mode: serviceShadow.mode,
              provider: serviceShadow.llm_provider ?? "",
              model: serviceShadow.llm_model ?? "",
              fallback_used: serviceShadow.llm_fallback_used ?? false,
            }
          : null,
      },
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
  llmSuggestedServices,
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
  llmSuggestedServices?: string[];
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
  const normalizedRecommended = canonicalizeService(recommendedService);
  const recommendedIsBroad = isBroadService(normalizedRecommended, vertical);
  const push = (value: string) => {
    const normalized = canonicalizeService(value);
    if (!normalized) return;
    if (options.includes(normalized)) return;
    if (isBroadService(normalized, vertical)) return;
    options.push(normalized);
  };
  const pushLlmChoice = (value: string) => {
    const normalized = canonicalizeService(value);
    if (!normalized) return;
    if (options.includes(normalized)) return;
    if (options.length >= MAX_SERVICE_OPTIONS) {
      options.pop();
    }
    options.push(normalized);
  };

  push(recommendedService);
  const rankedGenerated = [...generatedCandidates].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.specificity !== a.specificity) return b.specificity - a.specificity;
    return b.score - a.score;
  });

  for (const candidate of rankedGenerated) {
    if (candidate.specificity < 3) continue;
    if (candidate.confidence < 0.45) continue;
    if (
      !recommendedIsBroad &&
      normalizedRecommended &&
      !isSemanticallyRelatedService(candidate.service, normalizedRecommended)
    ) {
      continue;
    }
    push(candidate.service);
    if (options.length >= MAX_SERVICE_OPTIONS) break;
  }

  if (options.length < MAX_SERVICE_OPTIONS) {
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
      if (
        !recommendedIsBroad &&
        normalizedRecommended &&
        !isSemanticallyRelatedService(suggestion, normalizedRecommended)
      ) {
        continue;
      }
      push(suggestion);
      if (options.length >= MAX_SERVICE_OPTIONS) break;
    }
  }

  if (options.length < MAX_SERVICE_OPTIONS && normalizedRecommended) {
    for (const suggestion of inferRelatedKeywordOptions(normalizedRecommended, vertical)) {
      push(suggestion);
      if (options.length >= MAX_SERVICE_OPTIONS) break;
    }
  }

  // Last resort: if options are still too sparse, use remaining specific generated
  // candidates only (no static vertical fallback).
  if (options.length < 2) {
    for (const candidate of rankedGenerated) {
      if (candidate.specificity < 3) continue;
      if (candidate.confidence < 0.38) continue;
      push(candidate.service);
      if (options.length >= 2) break;
    }
  }

  for (const llmChoice of llmSuggestedServices || []) {
    pushLlmChoice(llmChoice);
  }

  return options.slice(0, MAX_SERVICE_OPTIONS);
}

function collectLlmSuggestedServices(
  args: {
    primaryAnalyst: {
      mode: "distilled" | "llm";
      recommended_service: string;
      llm_service_phrase?: string;
      llm_phrase_candidates?: string[];
      llm_suggested_services?: string[];
    } | null;
    serviceShadow: {
      mode: "distilled" | "llm";
      recommended_service: string;
      llm_service_phrase?: string;
      llm_phrase_candidates?: string[];
      llm_suggested_services?: string[];
    } | null;
  },
) {
  const output: string[] = [];
  const push = (value: string | null | undefined) => {
    const phrase = String(value ?? "");
    if (!phrase.trim()) return;
    if (output.some((item) => item.trim().toLowerCase() === phrase.trim().toLowerCase())) return;
    output.push(phrase);
  };
  for (const suggestion of args.primaryAnalyst?.llm_suggested_services ?? []) {
    push(suggestion);
  }
  for (const suggestion of args.serviceShadow?.llm_suggested_services ?? []) {
    push(suggestion);
  }
  if (args.primaryAnalyst?.mode === "llm") {
    push(args.primaryAnalyst.recommended_service);
  }
  if (args.serviceShadow?.mode === "llm") {
    push(args.serviceShadow.recommended_service);
  }
  return output;
}

function collectLlmSuggestedPhrases(
  args: {
    primaryAnalyst: {
      mode: "distilled" | "llm";
      llm_service_phrase?: string;
      llm_phrase_candidates?: string[];
      recommended_service: string;
    } | null;
    serviceShadow: {
      mode: "distilled" | "llm";
      llm_service_phrase?: string;
      llm_phrase_candidates?: string[];
      recommended_service: string;
    } | null;
  },
) {
  const output: string[] = [];
  const push = (value: string | null | undefined) => {
    const phrase = String(value ?? "");
    if (!phrase.trim()) return;
    if (output.some((item) => item.trim().toLowerCase() === phrase.trim().toLowerCase())) return;
    output.push(phrase);
  };
  push(args.primaryAnalyst?.llm_service_phrase);
  for (const phrase of args.primaryAnalyst?.llm_phrase_candidates ?? []) {
    push(phrase);
  }
  push(args.serviceShadow?.llm_service_phrase);
  for (const phrase of args.serviceShadow?.llm_phrase_candidates ?? []) {
    push(phrase);
  }
  if (args.primaryAnalyst?.mode === "llm") {
    push(args.primaryAnalyst.recommended_service);
  }
  if (args.serviceShadow?.mode === "llm") {
    push(args.serviceShadow.recommended_service);
  }
  return output;
}

function buildDisplayServiceCandidates(args: {
  generatedCandidates: Array<{
    service: string;
    score: number;
    confidence: number;
    sources: string[];
    specificity: number;
  }>;
  llmCandidates: string[];
  llmConfidence: number | null;
}) {
  const output = args.generatedCandidates.slice(0, 3).map((candidate) => ({
    service: candidate.service,
    score: candidate.score,
    confidence: candidate.confidence,
    specificity: candidate.specificity,
    sources: candidate.sources,
  }));
  for (const llmCandidate of args.llmCandidates) {
    const exists = output.some(
      (candidate) => canonicalizeService(candidate.service) === canonicalizeService(llmCandidate),
    );
    if (exists) continue;
    output.push({
      service: llmCandidate,
      score: output[0]?.score ?? 0,
      confidence: args.llmConfidence ?? 0.74,
      specificity: getServiceSpecificity(llmCandidate),
      sources: ["llm_analyst"],
    });
  }
  return output.slice(0, 4);
}

function selectPrimaryDetectedService(args: {
  baseDetectedService: string;
  primaryAnalyst:
    | {
        recommended_service: string;
        confidence: number;
        mode: "distilled" | "llm";
      }
    | null;
}) {
  if (!args.primaryAnalyst) return args.baseDetectedService;
  const analystService = String(args.primaryAnalyst.recommended_service ?? "").trim();
  if (!analystService) return args.baseDetectedService;
  return analystService;
}

function applyLlmForcedDefault(args: {
  serviceDecision: {
    gs_service: string;
    bs_service: string;
    cs_recommended_service: string;
    cs_confidence: number;
    cs_reason_codes: string[];
  };
  primaryAnalyst:
    | {
        mode: "distilled" | "llm";
        recommended_service: string;
        llm_service_phrase?: string;
        confidence: number;
      }
    | null;
}) {
  if (!args.primaryAnalyst || args.primaryAnalyst.mode !== "llm") {
    return args.serviceDecision;
  }
  const preferredRaw = String(
    args.primaryAnalyst.llm_service_phrase || args.primaryAnalyst.recommended_service || "",
  ).trim();
  if (!preferredRaw) {
    return args.serviceDecision;
  }
  const reasonCodes = args.serviceDecision.cs_reason_codes.includes("llm_forced_default")
    ? args.serviceDecision.cs_reason_codes
    : [...args.serviceDecision.cs_reason_codes, "llm_forced_default"];

  return {
    ...args.serviceDecision,
    bs_service: preferredRaw,
    cs_recommended_service: preferredRaw,
    cs_confidence: Number(Math.max(args.serviceDecision.cs_confidence, args.primaryAnalyst.confidence).toFixed(2)),
    cs_reason_codes: reasonCodes,
  };
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

const SERVICE_TOKEN_STOPWORDS = new Set([
  "service",
  "services",
  "store",
  "shop",
  "agency",
  "center",
  "centre",
  "clinic",
  "company",
  "office",
  "group",
  "business",
  "local",
  "professional",
  "solutions",
  "specialist",
  "specialists",
]);

const SERVICE_KEYWORD_FAMILIES: string[][] = [
  ["rug", "rugs", "carpet", "carpets"],
  ["shipping", "mailing", "postal", "courier", "parcel", "packaging"],
  ["hvac", "heating", "cooling", "air", "duct", "furnace", "ventilation"],
  ["dentist", "dental", "orthodontist", "orthodontic"],
  ["lawyer", "attorney", "legal", "immigration", "visa", "asylum"],
  ["translation", "translator", "interpretation", "interpreter", "localization"],
  ["marketing", "seo", "branding", "advertising", "digital", "web"],
  ["plumber", "plumbing", "drain", "sewer"],
  ["repair", "cleaning", "restoration", "maintenance"],
];

function isSemanticallyRelatedService(inputA: string, inputB: string) {
  const a = canonicalizeService(inputA);
  const b = canonicalizeService(inputB);
  if (!a || !b) return false;
  if (a === b) return true;

  const aTokens = tokenizeService(a);
  const bTokens = tokenizeService(b);
  if (aTokens.length === 0 || bTokens.length === 0) return false;

  if (aTokens.some((token) => bTokens.includes(token))) return true;
  if (hasSharedKeywordFamily(aTokens, bTokens)) return true;
  return false;
}

function tokenizeService(value: string) {
  return canonicalizeService(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter((token) => !SERVICE_TOKEN_STOPWORDS.has(token));
}

function hasSharedKeywordFamily(tokensA: string[], tokensB: string[]) {
  for (const family of SERVICE_KEYWORD_FAMILIES) {
    const hasA = tokensA.some((token) => family.includes(token));
    if (!hasA) continue;
    const hasB = tokensB.some((token) => family.includes(token));
    if (hasB) return true;
  }
  return false;
}

const RELATED_KEYWORD_OPTION_RULES: Array<{
  pattern: RegExp;
  options: string[];
  verticals?: VerticalKey[];
}> = [
  {
    pattern: /\b(rug|carpet)\b/i,
    options: ["carpet cleaning service", "carpet repair service", "rug store"],
    verticals: ["contractor", "general_smb"],
  },
  {
    pattern: /\b(shipping|mailing|postal|courier)\b/i,
    options: ["print shop", "mailbox rental service", "shipping and mailing service"],
  },
  {
    pattern: /\b(hvac|heating|cooling|air duct|furnace)\b/i,
    options: ["heating contractor", "air duct cleaning service", "hvac contractor"],
    verticals: ["contractor", "general_smb"],
  },
  {
    pattern: /\b(dentist|dental|orthodont)\b/i,
    options: ["pediatric dentist", "orthodontist", "dentist"],
    verticals: ["dental"],
  },
  {
    pattern: /\b(acupuncture|tcm|traditional chinese medicine)\b/i,
    options: ["acupuncture", "massage therapist", "wellness center"],
    verticals: ["tcm_clinic", "general_smb"],
  },
  {
    pattern: /\b(marketing|seo|web design|branding|advertising)\b/i,
    options: ["marketing consultant", "management consultant", "business coach"],
  },
  {
    pattern: /\b(immigration|visa|asylum|attorney|lawyer)\b/i,
    options: ["immigration lawyer", "personal injury lawyer", "divorce lawyer"],
    verticals: ["legal_immigration"],
  },
  {
    pattern: /\b(school|academy|education|learning center|learning centre|test prep)\b/i,
    options: ["tutoring service", "after school program", "language school"],
  },
  {
    pattern:
      /\b(kitchen\s*(and|&)\s*bath|bath(room)? fixtures?|plumbing showroom|walk[\s-]?in tubs?|tub showroom|tubz)\b/i,
    options: [
      "kitchen & bath plumbing showroom",
      "kitchen remodeler",
      "plumbing service",
    ],
    verticals: ["contractor", "general_smb"],
  },
];

function inferRelatedKeywordOptions(service: string, vertical: VerticalKey) {
  const normalized = canonicalizeService(service);
  if (!normalized) return [];
  const output: string[] = [];
  for (const rule of RELATED_KEYWORD_OPTION_RULES) {
    if (rule.verticals && !rule.verticals.includes(vertical)) continue;
    if (!rule.pattern.test(normalized)) continue;
    for (const option of rule.options) {
      if (!output.includes(option)) output.push(option);
    }
  }
  return output;
}
