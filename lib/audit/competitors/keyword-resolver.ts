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

export function resolvePrimaryKeyword(primary: AuditGoogleData): string {
  const vertical = primary.vertical.inferred_vertical;
  let base = KEYWORD_BY_VERTICAL[vertical];

  if (vertical === "restaurant") {
    const cuisineHint = CUISINE_HINTS.find((c) =>
      primary.vertical.google_categories.includes(c.type),
    );
    if (cuisineHint) base = `${cuisineHint.word} restaurant`;
  }

  if (!base) base = primary.vertical.primary_category || "business";

  const city = primary.business.city;
  return city ? `${base} ${city}` : base;
}
