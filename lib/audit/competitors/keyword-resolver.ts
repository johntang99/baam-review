import type { AuditGoogleData, VerticalKey } from "../google/types";
import {
  hasManufacturerSignalText,
  inferDetailedManufacturerService,
} from "../manufacturer-detail-rules";
import {
  hasVisionSignalText,
  inferDetailedVisionService,
} from "../vision-detail-rules";
import {
  hasRetailSignalText,
  inferDetailedRetailService,
} from "../retail-detail-rules";

const KEYWORD_BY_VERTICAL: Record<VerticalKey, string> = {
  tcm_clinic: "acupuncture",
  dental: "dentist",
  legal_immigration: "immigration lawyer",
  restaurant: "restaurant",
  real_estate: "real estate agent",
  hotel: "hotel",
  auto: "auto repair",
  contractor: "contractor",
  // Empirically: a business categorized salon_spa with no other signal
  // (no spa/nail/barber/lash word in the name, no specific Google type)
  // is overwhelmingly a hair salon. "beauty salon" returned a mix of
  // nail + hair + spa results that included none of the relevant
  // hair-salon competitors. "hair salon" gives the right peer set.
  // Actual spas are caught by the `\bspa\b` name pattern + the new
  // `spa` Google-type refinement below — both run before this fallback.
  salon_spa: "hair salon",
  cafe: "coffee shop",
  apparel: "clothing store",
  health_food: "health food store",
  insurance: "insurance agent",
  general_smb: "",
};

// Google primaryType / google_categories that are MORE specific than the
// broad vertical bucket — when present, we use them verbatim as the
// competitor search keyword. Stops "wedding dress boutique" from being
// searched as "clothing store".
const TYPE_REFINEMENTS: Array<{ type: string; keyword: string }> = [
  { type: "bridal_shop", keyword: "bridal boutique" },
  { type: "jewelry_store", keyword: "jewelry store" },
  { type: "shoe_store", keyword: "shoe store" },
  { type: "sporting_goods_store", keyword: "sporting goods store" },
  { type: "book_store", keyword: "bookstore" },
  { type: "carpet_store", keyword: "oriental rug store" },
  { type: "florist", keyword: "florist" },
  { type: "hair_salon", keyword: "hair salon" },
  { type: "nail_salon", keyword: "nail salon" },
  { type: "barber_shop", keyword: "barber shop" },
  { type: "massage_therapist", keyword: "massage therapist" },
  // Google labels day spas as `spa`; some wellness studios use the
  // broader `wellness_center`. Both should compete against spas, not
  // hair salons.
  { type: "spa", keyword: "day spa" },
  { type: "wellness_center", keyword: "day spa" },
  { type: "pet_store", keyword: "pet store" },
  { type: "veterinary_care", keyword: "veterinarian" },
  { type: "physiotherapist", keyword: "physical therapy" },
  { type: "chiropractor", keyword: "chiropractor" },
  { type: "orthodontist", keyword: "orthodontist" },
  { type: "pediatric_dentist", keyword: "pediatric dentist" },
  { type: "endodontist", keyword: "endodontist" },
  { type: "optometrist", keyword: "optometry clinic" },
  { type: "optician", keyword: "optician" },
  { type: "sunglasses_store", keyword: "eyewear store" },
  { type: "ophthalmologist", keyword: "ophthalmology clinic" },
  { type: "dermatologist", keyword: "dermatologist" },
  // Contractor / home-improvement refinements
  { type: "cabinet_maker", keyword: "kitchen cabinet manufacturer" },
  { type: "kitchen_remodeler", keyword: "kitchen remodeler" },
  { type: "countertop_store", keyword: "countertop store" },
  { type: "countertop_contractor", keyword: "countertop contractor" },
  { type: "manufacturer", keyword: "manufacturer" },
];

// Name-token refinements for cases where Google's types are too generic.
// These run AFTER type refinements; first match wins. Order matters —
// more specific terms first.
const NAME_REFINEMENTS: Array<{ pattern: RegExp; keyword: string }> = [
  // Apparel sub-types
  { pattern: /\b(wedding|bridal|bride|gown)\b/i, keyword: "bridal boutique" },
  { pattern: /\b(tuxedo|menswear|suit\b)/i, keyword: "menswear store" },
  { pattern: /\b(jewelry|jeweler|diamond)\b/i, keyword: "jewelry store" },
  { pattern: /\b(shoe|sneaker|footwear)\b/i, keyword: "shoe store" },
  { pattern: /\b(lingerie|swimwear)\b/i, keyword: "lingerie shop" },
  { pattern: /\b(vintage|consignment|thrift)\b/i, keyword: "vintage clothing store" },
  { pattern: /\b(maternity)\b/i, keyword: "maternity clothing" },
  { pattern: /\b(children|kids|baby)\b/i, keyword: "children's clothing" },
  { pattern: /\b(rug|carpet)\s*clean(ing|er|ers)?\b/i, keyword: "carpet cleaning service" },
  { pattern: /\b(rug|carpet)\s*repair(s|ing)?\b/i, keyword: "carpet repair service" },
  {
    pattern:
      /\b(oriental|persian)\s*(rug|rugs|carpet|carpets)\b|\b(rug|rugs|carpet|carpets)\s*(store|shop|gallery|showroom|boutique)\b/i,
    keyword: "oriental rug store",
  },

  // Salon / spa sub-types
  // "spa" runs FIRST inside this block: a business named "X Salon and
  // Spa" is empirically more spa than salon, and the user expects spa
  // competitors. "Tai JI Spa", "Aqua Spa", "Bliss Day Spa" all land here
  // and get spa competitors instead of hair-salon competitors.
  { pattern: /\b(spa|day spa)\b/i, keyword: "day spa" },
  { pattern: /\b(nail|manicure|pedicure)\b/i, keyword: "nail salon" },
  { pattern: /\b(barber)\b/i, keyword: "barber shop" },
  { pattern: /\b(massage|reflexology)\b/i, keyword: "massage therapist" },
  { pattern: /\b(eyelash|lash|brow)\b/i, keyword: "lash bar" },
  { pattern: /\b(tattoo|piercing)\b/i, keyword: "tattoo shop" },

  // Medical sub-types
  { pattern: /\b(orthodontic|braces|invisalign)\b/i, keyword: "orthodontist" },
  { pattern: /\b(pediatric)\b/i, keyword: "pediatric dentist" },
  { pattern: /\b(ophthalmolog|retina|cataract|lasik)\b/i, keyword: "ophthalmology clinic" },
  { pattern: /\b(optometr|eye exam|vision care|vision center)\b/i, keyword: "optometry clinic" },
  { pattern: /\b(optician|contact lenses?)\b/i, keyword: "optician" },
  { pattern: /\b(eyewear|eyeglasses?|glasses|spectacles|frames|sunglasses)\b/i, keyword: "eyewear store" },
  { pattern: /\b(dermatolog|skin clinic)\b/i, keyword: "dermatologist" },
  { pattern: /\b(chiropract)\b/i, keyword: "chiropractor" },
  { pattern: /\b(physical therap|physiotherap)\b/i, keyword: "physical therapy" },

  // Auto sub-types
  { pattern: /\b(body shop|collision)\b/i, keyword: "auto body shop" },
  { pattern: /\b(tire)\b/i, keyword: "tire shop" },
  { pattern: /\b(dealer(ship)?)\b/i, keyword: "car dealer" },

  // Contractor / home-improvement sub-types
  { pattern: /\b(kitchen cabinets?|cabinets?|cabinetry|millwork|joinery)\b/i, keyword: "kitchen cabinet manufacturer" },
  { pattern: /\b(countertops?|granite|quartz)\b/i, keyword: "countertop contractor" },
  { pattern: /\b(remodel|renovation|kitchen\s*&\s*bath|kitchen and bath)\b/i, keyword: "kitchen remodeler" },

  // Food sub-types (when vertical is restaurant but cuisine wasn't tagged)
  { pattern: /\b(pizz)/i, keyword: "pizza restaurant" },
  { pattern: /\b(bakery|patisserie)\b/i, keyword: "bakery" },
  { pattern: /\b(ice cream|gelato)\b/i, keyword: "ice cream shop" },
  { pattern: /\b(sushi)\b/i, keyword: "sushi restaurant" },
  { pattern: /\b(steakhouse|steak house)\b/i, keyword: "steakhouse" },
  { pattern: /\b(taco|taqueria)\b/i, keyword: "mexican restaurant" },

  // Legal sub-types
  { pattern: /\b(immigration|visa|asylum)\b/i, keyword: "immigration lawyer" },
  { pattern: /\b(personal injury|injury)\b/i, keyword: "personal injury lawyer" },
  { pattern: /\b(divorce|family law)\b/i, keyword: "divorce lawyer" },
  { pattern: /\b(real estate law)\b/i, keyword: "real estate lawyer" },
  { pattern: /\b(criminal defense)\b/i, keyword: "criminal defense lawyer" },
];

const CUISINE_HINTS: Array<{ type: string; word: string }> = [
  { type: "chinese_restaurant", word: "chinese" },
  { type: "japanese_restaurant", word: "japanese" },
  { type: "korean_restaurant", word: "korean" },
  { type: "italian_restaurant", word: "italian" },
  { type: "mexican_restaurant", word: "mexican" },
  { type: "indian_restaurant", word: "indian" },
  { type: "thai_restaurant", word: "thai" },
  { type: "vietnamese_restaurant", word: "vietnamese" },
];

/** Returns the service-only keyword (no city) for this business. Used
 *  in two places: (a) prefilled on the intake confirmation screen as
 *  the user-editable "main service" field; (b) combined with city for
 *  the actual competitor search.
 *
 *  Priority: Google's specific type → restaurant cuisine → business-
 *  name pattern → vertical default → last-resort raw primary_category.
 */
export function resolveServiceKeyword(primary: AuditGoogleData): string {
  const vertical = primary.vertical.inferred_vertical;
  const types = primary.vertical.google_categories ?? [];
  const name = primary.business.name;
  const visionKeyword = resolveDetailedVisionKeyword(primary);
  if (visionKeyword) return visionKeyword;
  const detailKeyword = resolveDetailedManufacturerKeyword(primary);
  if (detailKeyword) return detailKeyword;
  const retailKeyword = resolveDetailedRetailKeyword(primary);
  if (retailKeyword) return retailKeyword;

  const typeMatch = TYPE_REFINEMENTS.find((r) => types.includes(r.type));
  if (typeMatch) return typeMatch.keyword;

  if (vertical === "restaurant") {
    const cuisineHint = CUISINE_HINTS.find((c) => types.includes(c.type));
    if (cuisineHint) return `${cuisineHint.word} restaurant`;
  }

  const nameMatch = NAME_REFINEMENTS.find((r) => r.pattern.test(name));
  if (nameMatch) return nameMatch.keyword;

  const fallback = KEYWORD_BY_VERTICAL[vertical];
  if (fallback) return fallback;

  // Last resort: Google's raw primary category (e.g. "medical_clinic").
  // Humanize it so it reads as a search term, not a snake_case type.
  return (primary.vertical.primary_category || "business").replace(/_/g, " ");
}

function resolveDetailedManufacturerKeyword(primary: AuditGoogleData): string {
  const types = primary.vertical.google_categories ?? [];
  const hasManufacturerType =
    types.includes("manufacturer") || primary.vertical.primary_category === "manufacturer";
  const textBlob = buildIndustryEvidenceText(primary);
  const hasManufacturingSignal = hasManufacturerSignalText(
    textBlob,
    hasManufacturerType,
  );
  return inferDetailedManufacturerService({
    text: textBlob,
    hasManufacturerSignal: hasManufacturingSignal,
  });
}

function resolveDetailedVisionKeyword(primary: AuditGoogleData): string {
  const textBlob = buildIndustryEvidenceText(primary);
  return inferDetailedVisionService({
    text: textBlob,
    hasVisionSignal: hasVisionSignalText(textBlob),
  });
}

function resolveDetailedRetailKeyword(primary: AuditGoogleData): string {
  const textBlob = buildIndustryEvidenceText(primary);
  return inferDetailedRetailService({
    text: textBlob,
    hasRetailSignal: hasRetailSignalText(textBlob),
  });
}

export function resolvePrimaryKeyword(
  primary: AuditGoogleData,
  serviceOverride?: string,
): string {
  const base = (serviceOverride?.trim() || resolveServiceKeyword(primary)).trim();
  const city = primary.business.city;
  return city ? `${base} ${city}` : base;
}

// Synonym variants per service-keyword. Google's textSearch ranks differently
// for "bridal boutique" vs "wedding dress shop" — Kleinfeld doesn't appear
// at all for the former but ranks high for the latter. Multi-pass search
// merges results so famous-named-differently competitors aren't lost.
//
// Guidelines for adding entries:
// - Lead with the canonical keyword (matches what's in TYPE_REFINEMENTS /
//   NAME_REFINEMENTS / KEYWORD_BY_VERTICAL).
// - Add 1-2 real synonyms that businesses in this category actually use in
//   their Google profile name/category. Avoid synonyms that return junk
//   (test with a real Google Places call first).
// - Cap at 3 variants — each adds one $0.025 API call per audit.
const KEYWORD_SYNONYM_VARIANTS: Record<string, string[]> = {
  // ── Retail / apparel ─────────────────────────────────────────────
  "bridal boutique": ["bridal boutique", "wedding dress shop", "wedding gowns"],
  "jewelry store": ["jewelry store", "fine jewelry", "engagement ring store"],
  "menswear store": ["menswear store", "men's suit shop", "tuxedo rental"],
  "shoe store": ["shoe store", "sneaker store"],
  "lingerie shop": ["lingerie shop", "bra fitting"],
  "vintage clothing store": ["vintage clothing store", "consignment shop"],
  "clothing store": ["clothing store", "boutique", "fashion store"],
  "children's clothing": ["children's clothing", "kids clothing store"],
  "maternity clothing": ["maternity clothing", "maternity wear"],
  "bookstore": ["bookstore", "independent bookshop"],
  "florist": ["florist", "flower shop"],
  "pet store": ["pet store", "pet supplies"],
  "sporting goods store": ["sporting goods store", "sports equipment"],
  "oriental rug store": ["oriental rug store", "persian rug store", "carpet store"],
  "carpet cleaning service": [
    "carpet cleaning service",
    "rug cleaning service",
    "carpet cleaner",
  ],
  "carpet repair service": ["carpet repair service", "rug repair service", "rug restoration"],

  // ── Beauty / personal care ───────────────────────────────────────
  "hair salon": ["hair salon", "hair stylist", "beauty salon"],
  "beauty salon": ["beauty salon", "hair salon", "beauty parlor"],
  "nail salon": ["nail salon", "manicure pedicure"],
  "barber shop": ["barber shop", "men's haircut"],
  "lash bar": ["lash bar", "eyelash extensions"],
  "tattoo shop": ["tattoo shop", "tattoo studio"],
  "massage therapist": ["massage therapist", "massage spa", "deep tissue massage"],
  "day spa": ["day spa", "massage spa", "wellness spa"],

  // ── Medical / dental ─────────────────────────────────────────────
  "dentist": ["dentist", "dental clinic", "family dentistry"],
  "pediatric dentist": ["pediatric dentist", "kids dentist"],
  "orthodontist": ["orthodontist", "braces", "invisalign provider"],
  "endodontist": ["endodontist", "root canal specialist"],
  "eye doctor": ["eye doctor", "optometrist"],
  "optometry clinic": ["optometry clinic", "optometrist", "eye exam center"],
  optician: ["optician", "optical store", "contact lens center"],
  "eyewear store": ["eyewear store", "eyeglasses store", "glasses shop"],
  "ophthalmology clinic": ["ophthalmology clinic", "ophthalmologist", "eye surgeon"],
  "dermatologist": ["dermatologist", "skin clinic"],
  "chiropractor": ["chiropractor", "back pain clinic"],
  "physical therapy": ["physical therapy", "physiotherapist", "sports rehab"],
  "acupuncture": ["acupuncture", "TCM clinic", "Chinese medicine"],
  "veterinarian": ["veterinarian", "animal hospital", "pet clinic"],

  // ── Food / restaurant ────────────────────────────────────────────
  // "restaurant" intentionally omitted — too generic to add variants.
  "pizza restaurant": ["pizza restaurant", "pizzeria"],
  "chinese restaurant": ["chinese restaurant", "dim sum"],
  "japanese restaurant": ["japanese restaurant", "izakaya"],
  "sushi restaurant": ["sushi restaurant", "sushi bar"],
  "korean restaurant": ["korean restaurant", "korean bbq"],
  "italian restaurant": ["italian restaurant", "trattoria"],
  "mexican restaurant": ["mexican restaurant", "taqueria"],
  "indian restaurant": ["indian restaurant", "curry house"],
  "thai restaurant": ["thai restaurant", "pad thai"],
  "vietnamese restaurant": ["vietnamese restaurant", "pho restaurant"],
  "steakhouse": ["steakhouse", "steak restaurant"],
  "bakery": ["bakery", "patisserie", "cake shop"],
  "ice cream shop": ["ice cream shop", "gelato"],
  "coffee shop": ["coffee shop", "cafe", "espresso bar"],

  // ── Auto ─────────────────────────────────────────────────────────
  "auto repair": ["auto repair", "car repair", "mechanic"],
  "auto body shop": ["auto body shop", "collision repair"],
  "tire shop": ["tire shop", "tire dealer"],
  "car dealer": ["car dealer", "auto dealership"],

  // ── Legal ────────────────────────────────────────────────────────
  "immigration lawyer": ["immigration lawyer", "asylum attorney", "visa lawyer"],
  "personal injury lawyer": ["personal injury lawyer", "accident attorney"],
  "divorce lawyer": ["divorce lawyer", "family law attorney"],
  "criminal defense lawyer": ["criminal defense lawyer", "criminal attorney"],
  "real estate lawyer": ["real estate lawyer", "real estate attorney"],

  // ── Professional services ────────────────────────────────────────
  "real estate agent": ["real estate agent", "realtor", "real estate broker"],
  "insurance agent": ["insurance agent", "insurance broker"],
  "contractor": ["contractor", "general contractor", "home builder"],
  "kitchen cabinet manufacturer": [
    "kitchen cabinet manufacturer",
    "cabinet manufacturer",
    "custom kitchen cabinets",
  ],
  "countertop manufacturer": [
    "countertop manufacturer",
    "stone countertop manufacturer",
    "granite quartz countertops",
  ],
  "sign manufacturer": ["sign manufacturer", "signage manufacturer", "light box manufacturer"],
  "metal fabrication manufacturer": [
    "metal fabrication manufacturer",
    "sheet metal manufacturer",
    "steel fabrication",
  ],
  "electronics manufacturer": [
    "electronics manufacturer",
    "electronic components manufacturer",
    "pcb manufacturer",
  ],
  "furniture manufacturer": [
    "furniture manufacturer",
    "custom furniture manufacturer",
    "furniture factory",
  ],
  "food manufacturer": [
    "food manufacturer",
    "snack manufacturer",
    "beverage manufacturer",
  ],
  "packaging manufacturer": [
    "packaging manufacturer",
    "carton manufacturer",
    "label manufacturer",
  ],
  "textile manufacturer": [
    "textile manufacturer",
    "garment manufacturer",
    "fabric manufacturer",
  ],
  "plastic manufacturer": [
    "plastic manufacturer",
    "injection molding manufacturer",
    "polymer products manufacturer",
  ],
  "automotive parts manufacturer": [
    "automotive parts manufacturer",
    "auto parts manufacturer",
    "aftermarket parts manufacturer",
  ],
  "lighting manufacturer": [
    "lighting manufacturer",
    "led lighting manufacturer",
    "lighting factory",
  ],

  // ── Hospitality / lifestyle ──────────────────────────────────────
  "hotel": ["hotel", "boutique hotel"],
  "health food store": ["health food store", "natural foods", "organic grocery"],
};

/** Returns 1-N keyword variants for multi-pass competitor discovery.
 *  First variant is the canonical keyword. Additional variants surface
 *  competitors that Google's ranking misses under the canonical name.
 */
export function resolvePrimaryKeywords(
  primary: AuditGoogleData,
  serviceOverride?: string,
): string[] {
  const baseKeyword = (serviceOverride?.trim() || resolveServiceKeyword(primary)).trim();
  const variants = KEYWORD_SYNONYM_VARIANTS[baseKeyword] ?? [baseKeyword];
  const city = primary.business.city;
  return variants.map((v) => (city ? `${v} ${city}` : v));
}

function buildIndustryEvidenceText(primary: AuditGoogleData) {
  const categories = (primary.vertical.google_categories ?? [])
    .map((type) => type.replace(/_/g, " "))
    .join(" ");
  const websiteSignal = extractWebsiteKeywordSignal(primary.business.website);
  return normalizeEvidenceText(
    [
      primary.business.name,
      primary.business.description ?? "",
      primary.vertical.primary_category_display ?? "",
      primary.vertical.primary_category ?? "",
      categories,
      websiteSignal,
    ].join(" "),
  );
}

function normalizeEvidenceText(input: string | null | undefined) {
  return (input ?? "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
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
