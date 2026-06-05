import type { AuditGoogleData, VerticalKey } from "../google/types";

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
  { type: "ophthalmologist", keyword: "eye doctor" },
  { type: "dermatologist", keyword: "dermatologist" },
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
  { pattern: /\b(dermatolog|skin clinic)\b/i, keyword: "dermatologist" },
  { pattern: /\b(chiropract)\b/i, keyword: "chiropractor" },
  { pattern: /\b(physical therap|physiotherap)\b/i, keyword: "physical therapy" },

  // Auto sub-types
  { pattern: /\b(body shop|collision)\b/i, keyword: "auto body shop" },
  { pattern: /\b(tire)\b/i, keyword: "tire shop" },
  { pattern: /\b(dealer(ship)?)\b/i, keyword: "car dealer" },

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

  return primary.vertical.primary_category || "business";
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
