import type { AuditGoogleData } from "@/lib/audit/google/types";
import type { VerticalKey } from "@/lib/audit/google/types";
import {
  canonicalizeService,
  getIndustrySourceWeights,
  getServiceBoostForVertical,
  getServiceSpecificity,
  isGenericServiceValue,
  normalizeServiceText,
} from "@/lib/audit/service-taxonomy";
import {
  hasManufacturerSignalText,
  inferDetailedManufacturerService,
} from "@/lib/audit/manufacturer-detail-rules";
import {
  hasVisionSignalText,
  inferDetailedVisionService,
} from "@/lib/audit/vision-detail-rules";
import {
  hasRetailSignalText,
  inferDetailedRetailService,
} from "@/lib/audit/retail-detail-rules";

export interface ServiceReconciliationResult {
  gs_service: string;
  bs_service: string;
  cs_recommended_service: string;
  cs_confidence: number;
  cs_reason_codes: string[];
}

const GOOGLE_TYPE_TO_SERVICE: Array<{ types: readonly string[]; service: string }> = [
  { types: ["acupuncture", "traditional_chinese_medicine"], service: "acupuncture" },
  { types: ["dentist", "dental_clinic"], service: "dentist" },
  { types: ["pediatric_dentist"], service: "pediatric dentist" },
  { types: ["orthodontist"], service: "orthodontist" },
  { types: ["optometrist"], service: "optometry clinic" },
  { types: ["optician"], service: "optician" },
  { types: ["sunglasses_store"], service: "eyewear store" },
  { types: ["ophthalmologist"], service: "ophthalmology clinic" },
  { types: ["lawyer", "attorney"], service: "lawyer" },
  { types: ["immigration_lawyer"], service: "immigration lawyer" },
  { types: ["real_estate_agency"], service: "real estate agent" },
  { types: ["insurance_agency"], service: "insurance agent" },
  { types: ["restaurant"], service: "restaurant" },
  { types: ["cafe", "coffee_shop"], service: "coffee shop" },
  { types: ["hotel", "lodging"], service: "hotel" },
  { types: ["general_contractor"], service: "contractor" },
  { types: ["kitchen_remodeler"], service: "kitchen remodeler" },
  { types: ["cabinet_maker"], service: "cabinet maker" },
  { types: ["manufacturer"], service: "manufacturer" },
  { types: ["auto_repair", "car_repair"], service: "auto repair" },
  { types: ["beauty_salon"], service: "beauty salon" },
  { types: ["spa"], service: "day spa" },
];

const DEFAULT_SERVICE_BY_VERTICAL: Record<VerticalKey, string> = {
  tcm_clinic: "acupuncture",
  dental: "dentist",
  legal_immigration: "immigration lawyer",
  restaurant: "restaurant",
  real_estate: "real estate agent",
  hotel: "hotel",
  auto: "auto repair",
  contractor: "contractor",
  salon_spa: "day spa",
  cafe: "coffee shop",
  apparel: "clothing store",
  health_food: "health food store",
  insurance: "insurance agent",
  general_smb: "local business",
};

const TEXT_SIGNAL_PATTERNS: Array<{
  pattern: RegExp;
  service: string;
  verticals?: readonly VerticalKey[];
}> = [
  {
    pattern: /\b(bridal|wedding gown|wedding dress)\b/i,
    service: "bridal boutique",
  },
  {
    pattern: /\b(acupuncture|traditional chinese medicine|tcm)\b/i,
    service: "acupuncture",
  },
  {
    pattern: /\b(immigration|visa|asylum)\b/i,
    service: "immigration lawyer",
  },
  {
    pattern: /\b(orthodontic|orthodontist|invisalign|braces)\b/i,
    service: "orthodontist",
  },
  {
    pattern: /\b(pediatric dentist|kids dentist)\b/i,
    service: "pediatric dentist",
  },
  {
    pattern: /\b(ophthalmolog(y|ist)|retina specialist|cataract|lasik)\b/i,
    service: "ophthalmology clinic",
  },
  {
    pattern: /\b(optometr(y|ist)|eye exams?|vision care|vision center)\b/i,
    service: "optometry clinic",
  },
  {
    pattern: /\b(optician|contact lenses?)\b/i,
    service: "optician",
  },
  {
    pattern: /\b(eyewear|eyeglasses?|glasses|spectacles|frames|sunglasses)\b/i,
    service: "eyewear store",
  },
  {
    pattern: /\b(kitchen remodel|renovation|kitchen & bath|kitchen and bath)\b/i,
    service: "kitchen remodeler",
  },
  {
    pattern: /\b(day spa|spa|wellness spa)\b/i,
    service: "day spa",
    verticals: ["salon_spa"],
  },
  {
    pattern: /\b(massage|reflexology)\b/i,
    service: "massage therapist",
    verticals: ["salon_spa"],
  },
  {
    pattern: /\b(nail salon|manicure|pedicure)\b/i,
    service: "nail salon",
    verticals: ["salon_spa"],
  },
  {
    pattern: /\b(hair salon|hairstylist|haircut)\b/i,
    service: "hair salon",
    verticals: ["salon_spa"],
  },
  {
    pattern: /\b(barber)\b/i,
    service: "barber shop",
    verticals: ["salon_spa"],
  },
  {
    pattern: /\b(cafe|coffee)\b/i,
    service: "coffee shop",
    verticals: ["cafe"],
  },
  {
    pattern: /\b(real estate|realtor)\b/i,
    service: "real estate agent",
    verticals: ["real_estate"],
  },
  {
    pattern: /\b(insurance)\b/i,
    service: "insurance agent",
    verticals: ["insurance"],
  },
  {
    pattern: /\b(hotel|inn|lodging)\b/i,
    service: "hotel",
    verticals: ["hotel"],
  },
  {
    pattern: /\b(oriental|persian)\s*(rugs?|carpets?)\b/i,
    service: "oriental rug store",
  },
  {
    pattern:
      /\b(area\s*rugs?|rugs?|carpets?)\s*(store|shop|gallery|showroom|boutique)\b/i,
    service: "oriental rug store",
  },
  {
    pattern: /\b(rug|carpet)\s*clean(ing|er|ers)?\b/i,
    service: "carpet cleaning service",
  },
  {
    pattern: /\b(rug|carpet)\s*repair(s|ing)?\b/i,
    service: "carpet repair service",
  },
];

function normalizeService(input: string | null | undefined) {
  return normalizeServiceText(input);
}

function specificityScore(service: string) {
  return getServiceSpecificity(service);
}

function isGenericService(service: string) {
  return isGenericServiceValue(service);
}

function deriveGsService(google: AuditGoogleData) {
  const types = google.vertical.google_categories ?? [];
  for (const type of types) {
    const mapped = GOOGLE_TYPE_TO_SERVICE.find((entry) => entry.types.includes(type));
    if (mapped) return mapped.service;
  }

  const display = normalizeService(google.vertical.primary_category_display ?? "");
  if (display) return display;

  const primaryType = normalizeService(google.vertical.primary_category ?? "").replace(/_/g, " ");
  if (primaryType) return primaryType;

  return DEFAULT_SERVICE_BY_VERTICAL[google.vertical.inferred_vertical] ?? "local business";
}

export function reconcileServiceDecision({
  google,
  bsService,
  gbpDescription,
  websiteSignalText,
}: {
  google: AuditGoogleData;
  bsService: string;
  gbpDescription?: string | null;
  websiteSignalText?: string | null;
}): ServiceReconciliationResult {
  const gsServiceRaw = deriveGsService(google);
  const gsService = canonicalizeService(gsServiceRaw);
  const bsServiceNormalized =
    canonicalizeService(bsService) ||
    canonicalizeService(DEFAULT_SERVICE_BY_VERTICAL[google.vertical.inferred_vertical]);

  const gsScore = specificityScore(gsService);
  const bsScore = specificityScore(bsServiceNormalized);

  const reasonCodes: string[] = [];
  let recommended = bsServiceNormalized;
  let confidence = 0.72;

  if (gsService === bsServiceNormalized) {
    reasonCodes.push("gs_bs_match");
    recommended = bsServiceNormalized;
    confidence = 0.95;
  } else if (isGenericService(gsService) && !isGenericService(bsServiceNormalized)) {
    reasonCodes.push("prefer_bs_non_generic");
    recommended = bsServiceNormalized;
    confidence = 0.82;
  } else if (gsScore > bsScore) {
    reasonCodes.push("prefer_gs_more_specific");
    recommended = gsService;
    confidence = gsScore - bsScore >= 2 ? 0.88 : 0.78;
  } else if (bsScore > gsScore) {
    reasonCodes.push("prefer_bs_more_specific");
    recommended = bsServiceNormalized;
    confidence = bsScore - gsScore >= 2 ? 0.88 : 0.78;
  } else {
    reasonCodes.push("gs_bs_conflict_manual_confirmation");
    recommended = bsServiceNormalized;
    confidence = 0.64;
  }

  if (
    google.vertical.inferred_vertical === "contractor" &&
    /(manufacturer|cabinet|countertop|remodel)/.test(gsService)
  ) {
    reasonCodes.push("contractor_signal_from_google");
    recommended = gsService;
    confidence = Math.max(confidence, 0.86);
  }

  const gbpDescriptionSignal = inferServiceFromTextSignals(
    gbpDescription,
    google.vertical.inferred_vertical,
  );
  const websiteSignal = inferServiceFromTextSignals(
    websiteSignalText,
    google.vertical.inferred_vertical,
  );
  if (gbpDescriptionSignal) {
    reasonCodes.push("gbp_description_signal");
  }
  if (websiteSignal) {
    reasonCodes.push("website_signal");
  }

  const externalCandidate = pickExternalCandidate([
    gbpDescriptionSignal,
    websiteSignal,
  ]);
  if (externalCandidate) {
    const candidateScore = specificityScore(externalCandidate.service);
    if (externalCandidate.count >= 2) {
      reasonCodes.push("prefer_external_consensus");
      recommended = externalCandidate.service;
      confidence = Math.max(confidence, 0.87);
    } else if (externalCandidate.service === gsService && gsService !== bsServiceNormalized) {
      reasonCodes.push("external_supports_gs");
      recommended = gsService;
      confidence = Math.max(confidence, 0.81);
    } else if (externalCandidate.service === bsServiceNormalized && gsService !== bsServiceNormalized) {
      reasonCodes.push("external_supports_bs");
      recommended = bsServiceNormalized;
      confidence = Math.max(confidence, 0.81);
    } else if (candidateScore >= 3 && confidence <= 0.82) {
      reasonCodes.push("prefer_external_specific_signal");
      recommended = externalCandidate.service;
      confidence = Math.max(confidence, 0.76);
    } else {
      reasonCodes.push("external_signal_observed");
    }
  }

  const detailedIndustryCandidate = inferDetailedIndustryCandidate({
    google,
    gbpDescription,
    websiteSignalText,
    gsService,
    bsService: bsServiceNormalized,
  });
  if (
    detailedIndustryCandidate &&
    shouldPreferDetailedIndustry(detailedIndustryCandidate, recommended)
  ) {
    reasonCodes.push("prefer_detailed_industry");
    recommended = detailedIndustryCandidate;
    confidence = Math.max(confidence, 0.89);
  }

  const weightedCandidate = pickWeightedCandidate({
    vertical: google.vertical.inferred_vertical,
    gsService,
    bsService: bsServiceNormalized,
    gbpService: gbpDescriptionSignal,
    websiteService: websiteSignal,
    detailService: detailedIndustryCandidate,
  });
  if (
    weightedCandidate &&
    shouldPreferWeightedCandidate(weightedCandidate, recommended, confidence)
  ) {
    reasonCodes.push("prefer_weighted_service_model");
    recommended = weightedCandidate.service;
    confidence = Math.max(confidence, weightedCandidate.confidence);
  }

  if (!reasonCodes.length) {
    reasonCodes.push("default_resolution");
  }

  return {
    gs_service: gsService || "local business",
    bs_service: bsServiceNormalized || "local business",
    cs_recommended_service: recommended || "local business",
    cs_confidence: Number(confidence.toFixed(2)),
    cs_reason_codes: reasonCodes,
  };
}

function inferDetailedIndustryCandidate({
  google,
  gbpDescription,
  websiteSignalText,
  gsService,
  bsService,
}: {
  google: AuditGoogleData;
  gbpDescription?: string | null;
  websiteSignalText?: string | null;
  gsService: string;
  bsService: string;
}) {
  const categoriesText = (google.vertical.google_categories ?? [])
    .map((category) => category.replace(/_/g, " "))
    .join(" ");
  const websiteKeywordSignal = extractWebsiteKeywordSignal(google.business.website);
  const reviewSignalText = (google.reviews ?? [])
    .slice(0, 8)
    .map((review) => review.text ?? "")
    .join(" ")
    .slice(0, 1500);
  const textBlob = normalizeEvidenceText(
    [
      google.business.name,
      google.business.description ?? "",
      google.vertical.primary_category_display ?? "",
      google.vertical.primary_category ?? "",
      categoriesText,
      gbpDescription ?? "",
      websiteSignalText ?? "",
      websiteKeywordSignal,
      reviewSignalText,
      gsService,
      bsService,
    ].join(" "),
  );

  const visionCandidate = inferDetailedVisionService({
    text: textBlob,
    hasVisionSignal: hasVisionSignalText(textBlob),
  });
  if (visionCandidate) {
    return canonicalizeService(visionCandidate);
  }

  const hasManufacturerType =
    google.vertical.primary_category === "manufacturer" ||
    (google.vertical.google_categories ?? []).includes("manufacturer");
  const manufacturerCandidate = inferDetailedManufacturerService({
    text: textBlob,
    hasManufacturerSignal: hasManufacturerSignalText(textBlob, hasManufacturerType),
  });
  if (manufacturerCandidate) {
    return canonicalizeService(manufacturerCandidate);
  }

  const retailCandidate = inferDetailedRetailService({
    text: textBlob,
    hasRetailSignal: hasRetailSignalText(textBlob),
  });
  if (retailCandidate) {
    return canonicalizeService(retailCandidate);
  }

  const hasCabinetSignal =
    /\b(kitchen cabinets?|cabinets?|cabinetry|millwork|joinery)\b/.test(textBlob);
  if (hasCabinetSignal && /(contractor|builder)/.test(textBlob)) {
    return canonicalizeService("cabinet maker");
  }
  return "";
}

function shouldPreferDetailedIndustry(candidate: string, current: string) {
  const next = normalizeService(candidate);
  const now = normalizeService(current);
  if (!next || next === now) return false;
  if (
    [
      "manufacturer",
      "contractor",
      "cabinet maker",
      "health",
      "medical clinic",
      "eye doctor",
    ].includes(now)
  ) {
    return true;
  }
  return specificityScore(next) > specificityScore(now);
}

function inferServiceFromTextSignals(
  text: string | null | undefined,
  vertical: VerticalKey,
) {
  const normalized = normalizeEvidenceText(text);
  if (!normalized || normalized.length < 12) return "";
  const visionCandidate = inferDetailedVisionService({
    text: normalized,
    hasVisionSignal: hasVisionSignalText(normalized),
  });
  if (visionCandidate) return canonicalizeService(visionCandidate);
  const retailCandidate = inferDetailedRetailService({
    text: normalized,
    hasRetailSignal: hasRetailSignalText(normalized),
  });
  if (retailCandidate) return canonicalizeService(retailCandidate);
  for (const pattern of TEXT_SIGNAL_PATTERNS) {
    if (pattern.verticals && !pattern.verticals.includes(vertical)) continue;
    if (pattern.pattern.test(normalized)) return canonicalizeService(pattern.service);
  }
  const manufacturerCandidate = inferDetailedManufacturerService({
    text: normalized,
    hasManufacturerSignal: hasManufacturerSignalText(normalized),
  });
  if (manufacturerCandidate) return canonicalizeService(manufacturerCandidate);
  if (hasManufacturerSignalText(normalized)) return canonicalizeService("manufacturer");
  return "";
}

function pickExternalCandidate(services: string[]) {
  const normalized = services
    .map((service) => canonicalizeService(service))
    .filter(Boolean);
  if (normalized.length === 0) return null;

  const counts = new Map<string, number>();
  for (const service of normalized) {
    counts.set(service, (counts.get(service) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([service, count]) => ({ service, count, score: specificityScore(service) }))
    .sort((a, b) => b.count - a.count || b.score - a.score || b.service.length - a.service.length)[0];
}

function pickWeightedCandidate({
  vertical,
  gsService,
  bsService,
  gbpService,
  websiteService,
  detailService,
}: {
  vertical: VerticalKey;
  gsService: string;
  bsService: string;
  gbpService: string;
  websiteService: string;
  detailService: string;
}) {
  const weights = getIndustrySourceWeights(vertical);
  const candidateMap = new Map<
    string,
    { score: number; sources: Set<string>; specificity: number; votes: number }
  >();

  const add = (service: string, weight: number, source: string) => {
    const normalized = canonicalizeService(service);
    if (!normalized) return;
    const current = candidateMap.get(normalized) ?? {
      score: 0,
      sources: new Set<string>(),
      specificity: specificityScore(normalized),
      votes: 0,
    };
    current.score += weight;
    current.votes += 1;
    current.sources.add(source);
    candidateMap.set(normalized, current);
  };

  add(gsService, weights.google, "google");
  add(bsService, weights.baam, "baam");
  add(gbpService, weights.gbp, "gbp");
  add(websiteService, weights.website, "website");
  add(detailService, weights.detailRule, "detail_rule");

  if (candidateMap.size === 0) return null;

  const ranked = Array.from(candidateMap.entries())
    .map(([service, value]) => {
      const boost = getServiceBoostForVertical(vertical, service);
      const specificity = specificityScore(service);
      const score = value.score + specificity * 0.06 + boost;
      const confidence = computeWeightedConfidence(score, value.votes, specificity);
      return {
        service,
        score,
        confidence,
        votes: value.votes,
        specificity,
        sources: value.sources,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.votes !== a.votes) return b.votes - a.votes;
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      return b.service.length - a.service.length;
    });

  return ranked[0];
}

function shouldPreferWeightedCandidate(
  candidate: {
    service: string;
    score: number;
    votes: number;
    specificity: number;
    confidence: number;
    sources: Set<string>;
  },
  currentRecommendation: string,
  currentConfidence: number,
) {
  const current = canonicalizeService(currentRecommendation);
  const next = canonicalizeService(candidate.service);
  if (!next || current === next) return false;

  const currentSpecificity = specificityScore(current);
  const hasMultiSourceSupport = candidate.sources.size >= 2;
  if (isGenericService(current) && candidate.specificity >= currentSpecificity) return true;
  if (candidate.specificity > currentSpecificity && candidate.score >= 1.12) return true;
  if (hasMultiSourceSupport && candidate.confidence > currentConfidence + 0.03) return true;
  return candidate.confidence >= 0.9 && candidate.score >= 1.18;
}

function computeWeightedConfidence(score: number, votes: number, specificity: number) {
  let confidence = 0.72 + Math.min(0.16, score * 0.1);
  if (votes >= 2) confidence += 0.04;
  if (votes >= 3) confidence += 0.03;
  confidence += Math.min(0.05, specificity * 0.01);
  return Number(Math.min(0.95, confidence).toFixed(2));
}

function normalizeEvidenceText(input: string | null | undefined) {
  return normalizeService(input).replace(/[_/]+/g, " ").replace(/-/g, " ");
}

function extractWebsiteKeywordSignal(inputUrl: string | null | undefined) {
  const raw = (inputUrl ?? "").trim();
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname
      .replace(/^www\./i, "")
      .split(".")
      .slice(0, -1)
      .join(" ");
    const path = parsed.pathname.replace(/[\/._-]+/g, " ");
    const query = decodeURIComponent(parsed.search.replace(/^[?]/, "")).replace(
      /[=&._-]+/g,
      " ",
    );
    return normalizeEvidenceText([host, path, query].join(" "));
  } catch {
    return normalizeEvidenceText(raw.replace(/[\/._-]+/g, " "));
  }
}
