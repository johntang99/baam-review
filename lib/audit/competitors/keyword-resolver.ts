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
  salon_spa: "beauty salon",
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
