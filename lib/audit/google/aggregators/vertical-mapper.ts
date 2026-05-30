import type { VerticalKey } from "../types";

interface VerticalMatch {
  inferred_vertical: VerticalKey;
  confidence: number;
  primary_category: string;
}

const GOOGLE_TYPE_TO_VERTICAL: Array<{
  types: readonly string[];
  vertical: VerticalKey;
}> = [
  { types: ["acupuncture", "traditional_chinese_medicine", "chinese_medicine"], vertical: "tcm_clinic" },
  { types: ["dentist", "dental_clinic"], vertical: "dental" },
  { types: ["lawyer", "attorney"], vertical: "legal_immigration" },
  { types: ["restaurant", "meal_takeaway", "meal_delivery"], vertical: "restaurant" },
  { types: ["real_estate_agency"], vertical: "real_estate" },
  { types: ["lodging", "hotel"], vertical: "hotel" },
  { types: ["car_dealer", "car_repair"], vertical: "auto" },
  { types: ["general_contractor", "roofing_contractor"], vertical: "contractor" },
  { types: ["beauty_salon", "spa", "hair_care"], vertical: "salon_spa" },
  { types: ["cafe", "coffee_shop"], vertical: "cafe" },
  { types: ["clothing_store"], vertical: "apparel" },
  { types: ["health_food_store"], vertical: "health_food" },
  { types: ["insurance_agency"], vertical: "insurance" },
];

// Common keywords found in business names that strongly signal a vertical
// when Google's types are too generic (e.g., just ["health"] for a TCM clinic).
const NAME_KEYWORD_TO_VERTICAL: Array<{
  keywords: readonly string[];
  vertical: VerticalKey;
}> = [
  {
    keywords: [
      "acupuncture",
      "moxibustion",
      "针灸",
      "艾灸",
      "中医",
      "中醫",
      "tcm",
      "chinese medicine",
      "herbal medicine",
    ],
    vertical: "tcm_clinic",
  },
  {
    keywords: ["dental", "dentist", "orthodontic", "ortho ", "牙科", "牙醫", "齿科"],
    vertical: "dental",
  },
  {
    keywords: ["law office", "law firm", "attorney", "lawyer", "律师", "律師"],
    vertical: "legal_immigration",
  },
  {
    keywords: ["restaurant", "kitchen", "餐厅", "餐廳", "饭店", "酒家"],
    vertical: "restaurant",
  },
  {
    keywords: ["realty", "real estate", "房地产", "房地產"],
    vertical: "real_estate",
  },
  {
    keywords: ["salon", "spa", "barber", "美容", "美髮", "美发"],
    vertical: "salon_spa",
  },
  {
    keywords: ["café", "cafe", "coffee", "tea house", "咖啡"],
    vertical: "cafe",
  },
  {
    keywords: ["insurance", "保险", "保險"],
    vertical: "insurance",
  },
];

export function mapVertical(
  googleTypes: string[],
  businessName?: string,
): VerticalMatch {
  if (googleTypes.length === 0 && !businessName) {
    return {
      inferred_vertical: "general_smb",
      confidence: 0,
      primary_category: "establishment",
    };
  }

  const matchedVerticals = new Set<VerticalKey>();
  let firstMatchedType: string | null = null;

  for (const googleType of googleTypes) {
    for (const entry of GOOGLE_TYPE_TO_VERTICAL) {
      if (entry.types.includes(googleType)) {
        matchedVerticals.add(entry.vertical);
        if (firstMatchedType === null) firstMatchedType = googleType;
      }
    }
  }

  if (matchedVerticals.size === 1) {
    return {
      inferred_vertical: [...matchedVerticals][0],
      confidence: 1,
      primary_category: firstMatchedType ?? googleTypes[0],
    };
  }

  if (matchedVerticals.size > 1) {
    return {
      inferred_vertical: pickMostSpecific([...matchedVerticals]),
      confidence: 0.5,
      primary_category: firstMatchedType ?? googleTypes[0],
    };
  }

  const nameMatch = businessName ? matchByName(businessName) : null;
  if (nameMatch) {
    return {
      inferred_vertical: nameMatch,
      confidence: 0.7,
      primary_category: googleTypes[0] ?? "establishment",
    };
  }

  return {
    inferred_vertical: "general_smb",
    confidence: 0,
    primary_category: googleTypes[0] ?? "establishment",
  };
}

function matchByName(name: string): VerticalKey | null {
  const lower = name.toLowerCase();
  for (const entry of NAME_KEYWORD_TO_VERTICAL) {
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword.toLowerCase())) return entry.vertical;
    }
  }
  return null;
}

const SPECIFICITY_ORDER: VerticalKey[] = [
  "tcm_clinic",
  "dental",
  "legal_immigration",
  "real_estate",
  "auto",
  "contractor",
  "salon_spa",
  "insurance",
  "health_food",
  "apparel",
  "hotel",
  "cafe",
  "restaurant",
  "general_smb",
];

function pickMostSpecific(verticals: VerticalKey[]): VerticalKey {
  for (const v of SPECIFICITY_ORDER) {
    if (verticals.includes(v)) return v;
  }
  return verticals[0];
}
