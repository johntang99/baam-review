import type { AuditGoogleData } from "@/lib/audit/google/types";
import type { VerticalKey } from "@/lib/audit/google/types";

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

const GENERIC_SERVICE_TERMS = new Set([
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
]);

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

function normalizeService(input: string | null | undefined) {
  if (!input) return "";
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function specificityScore(service: string) {
  const normalized = normalizeService(service);
  if (!normalized) return 0;
  if (GENERIC_SERVICE_TERMS.has(normalized)) return 1;
  if (normalized.split(" ").length === 1) return 2;
  return 3;
}

function isGenericService(service: string) {
  return specificityScore(service) <= 1;
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
}: {
  google: AuditGoogleData;
  bsService: string;
}): ServiceReconciliationResult {
  const gsServiceRaw = deriveGsService(google);
  const gsService = normalizeService(gsServiceRaw);
  const bsServiceNormalized =
    normalizeService(bsService) ||
    normalizeService(DEFAULT_SERVICE_BY_VERTICAL[google.vertical.inferred_vertical]);

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
