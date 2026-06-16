import type { VerticalKey } from "@/lib/audit/google/types";

type ServiceSourceWeights = {
  google: number;
  baam: number;
  gbp: number;
  website: number;
  detailRule: number;
};

type ServiceTaxonomyEntry = {
  canonical: string;
  aliases?: readonly string[];
  specificity?: 1 | 2 | 3 | 4;
  generic?: boolean;
};

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
  "local business",
]);

const SERVICE_TAXONOMY: readonly ServiceTaxonomyEntry[] = [
  {
    canonical: "manufacturer",
    aliases: ["manufacturing", "factory", "manufacturing company"],
    specificity: 2,
  },
  {
    canonical: "kitchen cabinet manufacturer",
    aliases: ["cabinet manufacturer", "custom kitchen cabinets"],
    specificity: 4,
  },
  {
    canonical: "countertop manufacturer",
    aliases: ["stone countertop manufacturer"],
    specificity: 4,
  },
  {
    canonical: "sign manufacturer",
    aliases: ["signage manufacturer", "light box manufacturer"],
    specificity: 4,
  },
  {
    canonical: "metal fabrication manufacturer",
    aliases: ["sheet metal manufacturer", "steel fabrication manufacturer"],
    specificity: 4,
  },
  {
    canonical: "electronics manufacturer",
    aliases: ["electronic components manufacturer", "pcb manufacturer"],
    specificity: 4,
  },
  {
    canonical: "furniture manufacturer",
    aliases: ["custom furniture manufacturer", "furniture factory"],
    specificity: 4,
  },
  {
    canonical: "food manufacturer",
    aliases: ["snack manufacturer", "beverage manufacturer"],
    specificity: 4,
  },
  {
    canonical: "packaging manufacturer",
    aliases: ["carton manufacturer", "label manufacturer"],
    specificity: 4,
  },
  {
    canonical: "textile manufacturer",
    aliases: ["garment manufacturer", "fabric manufacturer"],
    specificity: 4,
  },
  {
    canonical: "plastic manufacturer",
    aliases: ["injection molding manufacturer", "polymer products manufacturer"],
    specificity: 4,
  },
  {
    canonical: "automotive parts manufacturer",
    aliases: ["auto parts manufacturer", "aftermarket parts manufacturer"],
    specificity: 4,
  },
  {
    canonical: "optometry clinic",
    aliases: ["optometrist", "eye doctor", "vision clinic", "eye exam clinic"],
    specificity: 4,
  },
  {
    canonical: "optician",
    aliases: ["optical store", "optical shop", "contact lens center"],
    specificity: 4,
  },
  {
    canonical: "eyewear store",
    aliases: ["eyeglasses store", "glasses store", "sunglasses store"],
    specificity: 4,
  },
  {
    canonical: "ophthalmology clinic",
    aliases: ["ophthalmologist", "eye surgeon"],
    specificity: 4,
  },
  {
    canonical: "cabinet maker",
    aliases: ["cabinetry contractor", "millwork shop"],
    specificity: 3,
  },
  {
    canonical: "countertop contractor",
    aliases: ["countertop installer"],
    specificity: 3,
  },
  { canonical: "kitchen remodeler", specificity: 3 },
  { canonical: "contractor", aliases: ["general contractor"], specificity: 2 },
  { canonical: "restaurant", specificity: 2 },
  { canonical: "coffee shop", aliases: ["cafe"], specificity: 3 },
  { canonical: "day spa", aliases: ["wellness spa"], specificity: 3 },
  { canonical: "massage therapist", specificity: 3 },
  { canonical: "nail salon", specificity: 3 },
  { canonical: "hair salon", aliases: ["beauty salon"], specificity: 3 },
  { canonical: "dentist", specificity: 3 },
  { canonical: "orthodontist", specificity: 4 },
  { canonical: "pediatric dentist", specificity: 4 },
  { canonical: "immigration lawyer", specificity: 4 },
  { canonical: "real estate agent", aliases: ["realtor"], specificity: 3 },
  { canonical: "insurance agent", specificity: 3 },
  { canonical: "hotel", specificity: 2 },
  { canonical: "acupuncture", specificity: 3 },
  { canonical: "local business", generic: true, specificity: 1 },
];

const DEFAULT_SOURCE_WEIGHTS: ServiceSourceWeights = {
  google: 0.78,
  baam: 0.82,
  gbp: 0.64,
  website: 0.58,
  detailRule: 0.9,
};

const SOURCE_WEIGHTS_BY_VERTICAL: Partial<
  Record<VerticalKey, Partial<ServiceSourceWeights>>
> = {
  contractor: {
    google: 0.74,
    baam: 0.88,
    gbp: 0.74,
    website: 0.7,
    detailRule: 1.0,
  },
  apparel: {
    google: 0.8,
    baam: 0.84,
    gbp: 0.6,
    website: 0.54,
    detailRule: 0.86,
  },
  salon_spa: {
    google: 0.8,
    baam: 0.82,
    gbp: 0.66,
    website: 0.6,
    detailRule: 0.88,
  },
  general_smb: {
    google: 0.76,
    baam: 0.8,
    gbp: 0.68,
    website: 0.62,
    detailRule: 0.94,
  },
};

const SERVICE_BOOST_BY_VERTICAL: Partial<Record<VerticalKey, Record<string, number>>> = {
  contractor: {
    "kitchen cabinet manufacturer": 0.24,
    "countertop manufacturer": 0.2,
    "sign manufacturer": 0.18,
    "metal fabrication manufacturer": 0.18,
    "electronics manufacturer": 0.15,
    "furniture manufacturer": 0.15,
    "food manufacturer": 0.12,
    "packaging manufacturer": 0.14,
    "textile manufacturer": 0.12,
    "plastic manufacturer": 0.14,
    "automotive parts manufacturer": 0.14,
    "kitchen remodeler": 0.16,
    "cabinet maker": 0.14,
    manufacturer: -0.18,
  },
  general_smb: {
    "kitchen cabinet manufacturer": 0.22,
    "countertop manufacturer": 0.18,
    "sign manufacturer": 0.22,
    "metal fabrication manufacturer": 0.2,
    "electronics manufacturer": 0.2,
    "furniture manufacturer": 0.18,
    "food manufacturer": 0.18,
    "packaging manufacturer": 0.18,
    "textile manufacturer": 0.17,
    "plastic manufacturer": 0.18,
    "automotive parts manufacturer": 0.18,
    "optometry clinic": 0.24,
    optician: 0.22,
    "eyewear store": 0.22,
    "ophthalmology clinic": 0.2,
    manufacturer: -0.2,
    health: -0.2,
    "medical clinic": -0.16,
  },
  apparel: {
    "bridal boutique": 0.12,
    "clothing store": -0.08,
  },
};

const SERVICE_ALIAS_TO_CANONICAL = buildAliasIndex();

export function normalizeServiceText(input: string | null | undefined) {
  if (!input) return "";
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function canonicalizeService(input: string | null | undefined) {
  const normalized = normalizeServiceText(input);
  if (!normalized) return "";
  return SERVICE_ALIAS_TO_CANONICAL.get(normalized) ?? normalized;
}

export function getServiceSpecificity(input: string | null | undefined) {
  const canonical = canonicalizeService(input);
  if (!canonical) return 0;
  if (GENERIC_SERVICE_TERMS.has(canonical)) return 1;
  const taxonomyEntry = SERVICE_TAXONOMY.find((entry) => entry.canonical === canonical);
  if (taxonomyEntry?.specificity) return taxonomyEntry.specificity;
  const words = canonical.split(" ").length;
  if (words <= 1) return 2;
  if (words === 2) return 3;
  return 4;
}

export function isGenericServiceValue(input: string | null | undefined) {
  const canonical = canonicalizeService(input);
  if (!canonical) return true;
  if (GENERIC_SERVICE_TERMS.has(canonical)) return true;
  const taxonomyEntry = SERVICE_TAXONOMY.find((entry) => entry.canonical === canonical);
  if (taxonomyEntry?.generic) return true;
  return getServiceSpecificity(canonical) <= 1;
}

export function getIndustrySourceWeights(vertical: VerticalKey): ServiceSourceWeights {
  return {
    ...DEFAULT_SOURCE_WEIGHTS,
    ...(SOURCE_WEIGHTS_BY_VERTICAL[vertical] ?? {}),
  };
}

export function getServiceBoostForVertical(
  vertical: VerticalKey,
  service: string | null | undefined,
) {
  const canonical = canonicalizeService(service);
  if (!canonical) return 0;
  return SERVICE_BOOST_BY_VERTICAL[vertical]?.[canonical] ?? 0;
}

function buildAliasIndex() {
  const map = new Map<string, string>();
  for (const entry of SERVICE_TAXONOMY) {
    const canonical = normalizeServiceText(entry.canonical);
    map.set(canonical, canonical);
    for (const alias of entry.aliases ?? []) {
      map.set(normalizeServiceText(alias), canonical);
    }
  }
  return map;
}
