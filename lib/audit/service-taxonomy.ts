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

export type ServiceLexiconEntry = {
  canonical: string;
  terms: string[];
  specificity: 1 | 2 | 3 | 4;
  generic: boolean;
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
    canonical: "lighting manufacturer",
    aliases: ["led lighting manufacturer", "lighting factory"],
    specificity: 4,
  },
  {
    canonical: "oriental rug store",
    aliases: [
      "rug store",
      "carpet store",
      "oriental carpet store",
      "persian rug store",
    ],
    specificity: 4,
  },
  {
    canonical: "carpet cleaning service",
    aliases: ["rug cleaning service", "carpet cleaning", "rug cleaning"],
    specificity: 4,
  },
  {
    canonical: "carpet repair service",
    aliases: ["rug repair service", "carpet repair", "rug repair"],
    specificity: 4,
  },
  {
    canonical: "optometry clinic",
    aliases: ["optometry", "optometrist", "eye doctor", "vision clinic", "eye exam clinic"],
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
    canonical: "women's health clinic",
    aliases: [
      "womens health clinic",
      "women's healthcare clinic",
      "women healthcare clinic",
      "women's healthcare center",
      "women healthcare center",
      "ob gyn clinic",
      "ob-gyn clinic",
      "gynecology clinic",
      "gynecological clinic",
    ],
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
  {
    canonical: "hvac contractor",
    aliases: [
      "hvac",
      "air conditioning contractor",
      "air conditioning",
      "heating contractor",
      "heating and cooling contractor",
      "cooling and heating contractor",
      "heating and cooling",
      "cooling and heating",
      "hvac service",
      "hvac company",
      "air conditioning service",
      "furnace repair",
      "heat pump service",
    ],
    specificity: 4,
  },
  {
    canonical: "bridal boutique",
    aliases: ["bridal shop", "wedding dress boutique", "wedding gown boutique"],
    specificity: 4,
  },
  {
    canonical: "window treatment store",
    aliases: [
      "curtain store",
      "blinds store",
      "window blinds store",
      "drapery store",
      "shutters store",
      "curtain and blinds store",
    ],
    specificity: 4,
  },
  {
    canonical: "business coach",
    aliases: [
      "business coaching",
      "business consultant",
      "business consulting",
      "executive coach",
      "growth coach",
    ],
    specificity: 4,
  },
  {
    canonical: "management consultant",
    aliases: ["management consulting", "strategy consultant", "strategy consulting"],
    specificity: 4,
  },
  {
    canonical: "marketing consultant",
    aliases: [
      "marketing consulting",
      "marketing advisor",
      "growth marketing consultant",
      "digital marketing services",
      "digital marketing agency",
      "seo agency",
      "seo services",
      "advertising agency",
      "advertising services",
      "广告公司",
      "广告服务",
    ],
    specificity: 4,
  },
  {
    canonical: "website design agency",
    aliases: [
      "web design agency",
      "web design services",
      "website design services",
      "website development agency",
      "web development agency",
      "web development company",
      "website design company",
      "web design company",
      "网站设计",
      "网页设计",
      "建站服务",
      "网站开发",
      "网页开发",
    ],
    specificity: 4,
  },
  {
    canonical: "loan agency",
    aliases: ["loan service", "loan company", "lending company", "lender"],
    specificity: 4,
  },
  {
    canonical: "mortgage broker",
    aliases: ["mortgage lender", "home loan broker", "home mortgage broker"],
    specificity: 4,
  },
  {
    canonical: "financial planner",
    aliases: ["financial advisor", "wealth advisor", "wealth planner"],
    specificity: 4,
  },
  {
    canonical: "tutoring service",
    aliases: [
      "tutoring center",
      "tutoring school",
      "private tutor",
      "tutor",
      "after school tutoring",
      "after-school tutoring",
    ],
    specificity: 4,
  },
  {
    canonical: "after school program",
    aliases: [
      "after school",
      "after-school program",
      "afterschool program",
      "enrichment program",
      "learning center program",
    ],
    specificity: 4,
  },
  {
    canonical: "vocational training center",
    aliases: ["trade school", "vocational school", "training school", "skills academy"],
    specificity: 4,
  },
  {
    canonical: "language school",
    aliases: ["english school", "esl school", "language academy", "language center"],
    specificity: 4,
  },
  {
    canonical: "personal injury lawyer",
    aliases: ["injury lawyer", "car accident lawyer"],
    specificity: 4,
  },
  {
    canonical: "dermatology clinic",
    aliases: ["dermatologist", "skin clinic", "skin specialist"],
    specificity: 4,
  },
  {
    canonical: "translation service",
    aliases: ["translation agency", "interpreter service", "interpretation service"],
    specificity: 4,
  },
  {
    canonical: "property management service",
    aliases: ["property management", "property manager"],
    specificity: 4,
  },
  {
    canonical: "driving school",
    aliases: [
      "driver training school",
      "auto driving school",
      "auto school",
      "driving academy",
      "driving lessons",
    ],
    specificity: 4,
  },
  {
    canonical: "kitchen & bath plumbing showroom",
    aliases: [
      "kitchen and bath showroom",
      "kitchen bath showroom",
      "plumbing showroom",
      "bathroom showroom",
      "bath fixture showroom",
      "walk in tub showroom",
      "walk-in tub showroom",
      "walk in tubs showroom",
      "walk-in tubs showroom",
      "tub showroom",
      "tubz",
      "tubz showroom",
    ],
    specificity: 4,
  },
  {
    canonical: "tailor shop",
    aliases: ["tailor", "alterations", "sewing and alterations"],
    specificity: 4,
  },
  {
    canonical: "photography studio",
    aliases: ["photo studio", "self portrait studio", "photography and video studio"],
    specificity: 4,
  },
  {
    canonical: "print shop",
    aliases: [
      "printing service",
      "print service",
      "commercial printer",
      "copy shop",
      "print and copy center",
    ],
    specificity: 4,
  },
  {
    canonical: "laundry service",
    aliases: ["laundromat", "dry cleaning", "dry cleaner", "dry cleaning service"],
    specificity: 4,
  },
  {
    canonical: "cleaning service",
    aliases: [
      "house cleaning service",
      "home cleaning service",
      "commercial cleaning service",
      "janitorial service",
      "maid service",
    ],
    specificity: 4,
  },
  {
    canonical: "shipping and mailing service",
    aliases: ["shipping store", "mailing service", "parcel shipping", "courier service"],
    specificity: 4,
  },
  {
    canonical: "phone repair service",
    aliases: ["cell phone repair", "mobile phone repair", "iphone repair"],
    specificity: 4,
  },
  {
    canonical: "computer repair service",
    aliases: ["pc repair", "laptop repair", "computer service"],
    specificity: 4,
  },
  {
    canonical: "piano store",
    aliases: ["piano shop", "piano dealer", "piano showroom"],
    specificity: 4,
  },
  { canonical: "jewelry store", aliases: ["jeweler", "jewellery store"], specificity: 4 },
  { canonical: "pet store", specificity: 3 },
  { canonical: "pet care", aliases: ["pet services"], specificity: 3 },
  { canonical: "zoo", specificity: 3 },
  { canonical: "park", specificity: 3 },
  { canonical: "church", specificity: 3 },
  { canonical: "buddhist temple", specificity: 3 },
  { canonical: "hindu temple", specificity: 3 },
  { canonical: "historical landmark", specificity: 3 },
  { canonical: "arcade", aliases: ["amusement center", "game center"], specificity: 3 },
  { canonical: "travel agency", specificity: 3 },
  { canonical: "electronics store", specificity: 3 },
  { canonical: "car dealer", specificity: 3 },
  { canonical: "plumbing service", aliases: ["plumber", "plumbing"], specificity: 4 },
  { canonical: "kitchen remodeler", specificity: 3 },
  { canonical: "contractor", aliases: ["general contractor"], specificity: 2 },
  { canonical: "restaurant", specificity: 2 },
  { canonical: "coffee shop", aliases: ["cafe"], specificity: 3 },
  { canonical: "day spa", aliases: ["wellness spa"], specificity: 3 },
  { canonical: "massage therapist", specificity: 3 },
  { canonical: "nail salon", specificity: 3 },
  { canonical: "hair salon", aliases: ["beauty salon"], specificity: 3 },
  {
    canonical: "dentist",
    aliases: [
      "dental clinic",
      "dental office",
      "dental implants",
      "dental implant center",
      "periodontics and dental implants",
      "periodontist",
    ],
    specificity: 3,
  },
  { canonical: "orthodontist", specificity: 4 },
  { canonical: "pediatric dentist", specificity: 4 },
  { canonical: "immigration lawyer", specificity: 4 },
  { canonical: "real estate agent", aliases: ["realtor"], specificity: 3 },
  { canonical: "insurance agent", specificity: 3 },
  { canonical: "hotel", specificity: 3 },
  {
    canonical: "acupuncture",
    aliases: [
      "tcm",
      "tcm clinic",
      "traditional chinese medicine",
      "traditional chinese medicine clinic",
      "中医",
      "中醫",
      "针灸",
      "針灸",
      "中医针灸",
      "中醫針灸",
    ],
    specificity: 3,
  },
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
    "hvac contractor": 0.24,
    "plumbing service": 0.22,
    "window treatment store": 0.2,
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
    "lighting manufacturer": 0.14,
    "kitchen remodeler": 0.16,
    "cabinet maker": 0.14,
    "cleaning service": 0.2,
    "piano store": 0.18,
    "print shop": 0.22,
    "shipping and mailing service": -0.1,
    "jewelry store": -0.14,
    manufacturer: -0.18,
  },
  general_smb: {
    "hvac contractor": 0.18,
    "bridal boutique": 0.16,
    "window treatment store": 0.16,
    "business coach": 0.18,
    "management consultant": 0.16,
    "marketing consultant": 0.16,
    "website design agency": 0.2,
    "loan agency": 0.18,
    "mortgage broker": 0.2,
    "financial planner": 0.18,
    "tutoring service": 0.2,
    "after school program": 0.2,
    "vocational training center": 0.18,
    "language school": 0.18,
    "translation service": 0.2,
    "property management service": 0.2,
    "driving school": 0.2,
    "tailor shop": 0.18,
    "photography studio": 0.18,
    "print shop": 0.2,
    "laundry service": 0.18,
    "cleaning service": 0.18,
    "shipping and mailing service": 0.18,
    "phone repair service": 0.18,
    "computer repair service": 0.18,
    "piano store": 0.16,
    "jewelry store": 0.16,
    "pet store": 0.16,
    "pet care": 0.14,
    "zoo": 0.12,
    park: 0.1,
    church: 0.1,
    "buddhist temple": 0.1,
    "hindu temple": 0.1,
    "historical landmark": 0.1,
    arcade: 0.16,
    "travel agency": 0.16,
    "electronics store": 0.16,
    "car dealer": 0.16,
    "plumbing service": 0.2,
    "kitchen & bath plumbing showroom": 0.24,
    "dermatology clinic": 0.2,
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
    "lighting manufacturer": 0.16,
    "oriental rug store": 0.2,
    "carpet cleaning service": 0.16,
    "carpet repair service": 0.16,
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
    "tailor shop": 0.18,
    "jewelry store": 0.14,
    "clothing store": -0.08,
  },
};

const SERVICE_ALIAS_TO_CANONICAL = buildAliasIndex();

export function normalizeServiceText(input: string | null | undefined) {
  if (!input) return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
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

export function isKnownService(input: string | null | undefined) {
  const canonical = canonicalizeService(input);
  if (!canonical) return false;
  return SERVICE_ALIAS_TO_CANONICAL.has(canonical);
}

export function getServiceLexicon(): ServiceLexiconEntry[] {
  return SERVICE_TAXONOMY.map((entry) => ({
    canonical: normalizeServiceText(entry.canonical),
    terms: [
      normalizeServiceText(entry.canonical),
      ...(entry.aliases ?? []).map((alias) => normalizeServiceText(alias)),
    ],
    specificity: entry.specificity ?? 2,
    generic: Boolean(entry.generic),
  }));
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
