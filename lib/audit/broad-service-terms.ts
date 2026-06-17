import type { VerticalKey } from "@/lib/audit/google/types";

export const ALWAYS_BROAD_SERVICE_TERMS = [
  "manufacturer",
  "manufacturing company",
  "factory",
  "contractor",
  "contracting",
  "contractor services",
  "store",
  "retail",
  "retail store",
  "shop",
  "outlet",
  "service",
  "services",
  "service provider",
  "service company",
  "business",
  "business service",
  "business services",
  "local business",
  "company",
  "agency",
  "office",
  "center",
  "centre",
  "institution",
  "organization",
  "education",
  "educational institution",
  "school",
  "academy",
  "college",
  "university",
  "training center",
  "training institute",
  "health",
  "medical clinic",
  "clinic",
  "healthcare provider",
  "healthcare service",
  "medical service",
  "consultant",
  "consulting",
  "consulting firm",
  "professional service",
  "professional services",
  "finance",
  "financial service",
  "financial services",
  "technology",
  "technology company",
  "tech company",
  "software company",
  "it company",
  "it service",
  "it services",
  "digital agency",
  "home goods store",
  "building materials store",
] as const;

export const VERTICAL_DEPENDENT_BROAD_TERMS: Record<string, readonly VerticalKey[]> = {
  restaurant: ["restaurant", "general_smb"],
  "food service": ["restaurant", "general_smb"],
  "clothing store": ["apparel", "general_smb"],
  "fashion store": ["apparel", "general_smb"],
  lawyer: ["legal_immigration", "general_smb"],
  "law firm": ["legal_immigration", "general_smb"],
  doctor: ["tcm_clinic", "dental", "general_smb"],
};

// Domain policy: these are "base-specific" services that are acceptable as final
// output in their own vertical, even if they are not hyper-specialized.
const ACCEPTABLE_BASE_SERVICE_BY_VERTICAL: Partial<Record<VerticalKey, readonly string[]>> = {
  dental: ["dentist"],
  real_estate: ["real estate agent"],
  insurance: ["insurance agent"],
  auto: ["auto repair"],
  cafe: ["coffee shop"],
  hotel: ["hotel"],
  salon_spa: ["day spa", "hair salon", "beauty salon", "nail salon", "massage therapist"],
};

const ALWAYS_BROAD_SERVICE_TERM_SET = new Set(
  ALWAYS_BROAD_SERVICE_TERMS.map(normalizeBroadServiceText),
);

export function isBroadServiceTerm(
  input: string | null | undefined,
  context?: { vertical?: string | null },
) {
  const normalized = normalizeBroadServiceText(input);
  if (!normalized) return true;
  if (ALWAYS_BROAD_SERVICE_TERM_SET.has(normalized)) return true;

  const dependentVerticals = VERTICAL_DEPENDENT_BROAD_TERMS[normalized];
  const vertical = normalizeBroadServiceText(context?.vertical);
  if (!vertical) return Boolean(dependentVerticals);

  const acceptedBaseServices = ACCEPTABLE_BASE_SERVICE_BY_VERTICAL[vertical as VerticalKey] ?? [];
  if (acceptedBaseServices.some((item) => normalizeBroadServiceText(item) === normalized)) {
    return false;
  }

  if (!dependentVerticals) return false;
  return dependentVerticals.includes(vertical as VerticalKey);
}

export function normalizeBroadServiceText(input: string | null | undefined) {
  return (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}
