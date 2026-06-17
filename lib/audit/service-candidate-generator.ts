import type { AuditGoogleData } from "@/lib/audit/google/types";
import {
  canonicalizeService,
  getServiceLexicon,
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

export type GeneratedServiceCandidate = {
  service: string;
  score: number;
  confidence: number;
  sources: string[];
  specificity: number;
};

const DEFAULT_SERVICE_BY_VERTICAL: Record<string, string> = {
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

const BROAD_SERVICE_TERMS = new Set([
  "manufacturer",
  "contractor",
  "restaurant",
  "store",
  "service",
  "business",
  "local business",
  "health",
  "finance",
  "consultant",
  "home goods store",
  "building materials store",
  "educational institution",
]);

export function generateServiceCandidates({
  google,
  gbpDescription,
  websiteSignalText,
  seedService,
}: {
  google: AuditGoogleData;
  gbpDescription?: string | null;
  websiteSignalText?: string | null;
  seedService?: string | null;
}): GeneratedServiceCandidate[] {
  const categoryText = (google.vertical.google_categories ?? [])
    .map((value) => value.replace(/_/g, " "))
    .join(" ");
  const websiteKeywordSignal = extractWebsiteKeywordSignal(google.business.website);
  const nameText = normalizeEvidenceText(google.business.name);
  const categoryEvidence = normalizeEvidenceText(
    [google.vertical.primary_category_display, google.vertical.primary_category, categoryText].join(
      " ",
    ),
  );
  const descriptionEvidence = normalizeEvidenceText(
    [google.business.description, gbpDescription].filter(Boolean).join(" "),
  );
  const websiteEvidence = normalizeEvidenceText(
    [websiteSignalText, websiteKeywordSignal].filter(Boolean).join(" "),
  );
  const fullEvidence = normalizeEvidenceText(
    [nameText, categoryEvidence, descriptionEvidence, websiteEvidence].join(" "),
  );

  const candidateMap = new Map<
    string,
    { score: number; sources: Set<string>; specificity: number }
  >();

  const add = (service: string | null | undefined, weight: number, source: string) => {
    const normalized = canonicalizeService(service);
    if (!normalized) return;
    const current = candidateMap.get(normalized) ?? {
      score: 0,
      sources: new Set<string>(),
      specificity: getServiceSpecificity(normalized),
    };
    current.score += weight;
    current.sources.add(source);
    candidateMap.set(normalized, current);
  };

  add(seedService, 0.64, "seed");
  add(DEFAULT_SERVICE_BY_VERTICAL[google.vertical.inferred_vertical] ?? "", 0.56, "vertical_prior");
  add(google.vertical.primary_category_display, 0.48, "google_category_display");
  add(google.vertical.primary_category?.replace(/_/g, " "), 0.48, "google_primary_type");

  const detailVision = inferDetailedVisionService({
    text: fullEvidence,
    hasVisionSignal: hasVisionSignalText(fullEvidence),
  });
  add(detailVision, 0.98, "detail_vision");

  const hasManufacturerType =
    google.vertical.primary_category === "manufacturer" ||
    (google.vertical.google_categories ?? []).includes("manufacturer");
  const detailManufacturer = inferDetailedManufacturerService({
    text: fullEvidence,
    hasManufacturerSignal: hasManufacturerSignalText(fullEvidence, hasManufacturerType),
  });
  add(detailManufacturer, 0.98, "detail_manufacturer");

  const detailRetail = inferDetailedRetailService({
    text: fullEvidence,
    hasRetailSignal: hasRetailSignalText(fullEvidence),
  });
  add(detailRetail, 0.92, "detail_retail");

  addTaxonomyMatches(nameText, 0.9, "name_match", add);
  addTaxonomyMatches(descriptionEvidence, 0.76, "description_match", add);
  addTaxonomyMatches(websiteEvidence, 0.72, "website_match", add);
  addTaxonomyMatches(categoryEvidence, 0.66, "category_match", add);

  if (candidateMap.size === 0) {
    return [];
  }

  return Array.from(candidateMap.entries())
    .map(([service, value]) => {
      const broadPenalty = isBroadService(service) ? 0.55 : 0;
      const score = Number((value.score + value.specificity * 0.05 - broadPenalty).toFixed(3));
      return {
        service,
        score,
        confidence: computeCandidateConfidence(score, value.sources.size, value.specificity),
        sources: Array.from(value.sources.values()).sort(),
        specificity: value.specificity,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      return b.service.length - a.service.length;
    });
}

export function pickTopComprehensiveService({
  google,
  gbpDescription,
  websiteSignalText,
  seedService,
}: {
  google: AuditGoogleData;
  gbpDescription?: string | null;
  websiteSignalText?: string | null;
  seedService?: string | null;
}) {
  const candidates = generateServiceCandidates({
    google,
    gbpDescription,
    websiteSignalText,
    seedService,
  });
  const top = candidates[0];
  if (!top) return null;
  const specificAlternative = candidates.find(
    (candidate) =>
      candidate.specificity >= 3 &&
      candidate.confidence >= 0.78 &&
      candidate.score >= top.score - 0.72,
  );
  if ((isBroadService(top.service) || top.specificity <= 2) && specificAlternative) {
    return specificAlternative;
  }
  if ((isBroadService(top.service) || isGenericServiceValue(top.service)) && top.confidence < 0.9) {
    return null;
  }
  if (top.confidence < 0.76 && top.specificity <= 2) return null;
  return top;
}

function addTaxonomyMatches(
  text: string,
  weight: number,
  source: string,
  add: (service: string, weight: number, source: string) => void,
) {
  if (!text) return;
  for (const entry of getServiceLexicon()) {
    if (entry.generic) continue;
    for (const term of entry.terms) {
      if (!term || term.length < 4) continue;
      if (!containsTerm(text, term)) continue;
      add(entry.canonical, weight + entry.specificity * 0.02, source);
      break;
    }
  }
}

function containsTerm(text: string, term: string) {
  if (!/[a-z0-9]/i.test(term)) {
    return text.includes(term);
  }
  const escaped = escapeRegex(term);
  const pattern = new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i");
  return pattern.test(text);
}

function computeCandidateConfidence(score: number, sourceCount: number, specificity: number) {
  let confidence = 0.58 + Math.min(0.2, score * 0.15);
  confidence += Math.min(0.12, sourceCount * 0.035);
  confidence += Math.min(0.07, specificity * 0.02);
  return Number(Math.min(0.95, confidence).toFixed(2));
}

function isBroadService(service: string) {
  const canonical = canonicalizeService(service);
  if (!canonical) return true;
  return BROAD_SERVICE_TERMS.has(canonical);
}

function normalizeEvidenceText(input: string | null | undefined) {
  return normalizeServiceText(input)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    const query = decodeURIComponent(parsed.search.replace(/^\?/, "")).replace(
      /[=&._-]+/g,
      " ",
    );
    return normalizeEvidenceText([host, path, query].join(" "));
  } catch {
    return normalizeEvidenceText(raw.replace(/[\/._-]+/g, " "));
  }
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
