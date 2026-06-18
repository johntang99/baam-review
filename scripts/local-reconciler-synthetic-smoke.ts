import { reconcileServiceDecision } from "@/lib/audit/service-reconciler";
import type { AuditGoogleData, VerticalKey } from "@/lib/audit/google/types";

type SyntheticCase = {
  name: string;
  vertical: VerticalKey;
  primaryCategory: string;
  primaryCategoryDisplay?: string;
  googleCategories: string[];
  bsService: string;
  gbpDescription?: string;
  websiteSignalText?: string;
};

const SYNTHETIC_CASES: SyntheticCase[] = [
  {
    name: "The Oriental Carpet",
    vertical: "contractor",
    primaryCategory: "manufacturer",
    primaryCategoryDisplay: "Manufacturer",
    googleCategories: ["manufacturer"],
    bsService: "oriental rug store",
    gbpDescription:
      "Oriental rug store and carpet gallery with cleaning and restoration services.",
    websiteSignalText:
      "Handmade oriental rugs and carpet showroom. Shipping and returns policy available with USPS and FedEx options.",
  },
  {
    name: "Smile Dental Group",
    vertical: "dental",
    primaryCategory: "dentist",
    primaryCategoryDisplay: "Dentist",
    googleCategories: ["dentist", "dental_clinic"],
    bsService: "dentist",
    gbpDescription: "Family dentist, Invisalign, dental implants, and preventive care.",
    websiteSignalText:
      "We accept most PPO insurance plans. Book your cleaning and exam online.",
  },
  {
    name: "Grand Garden Restaurant",
    vertical: "restaurant",
    primaryCategory: "restaurant",
    primaryCategoryDisplay: "Chinese Restaurant",
    googleCategories: ["restaurant"],
    bsService: "chinese restaurant",
    gbpDescription: "Cantonese restaurant near Central Park with private dining.",
    websiteSignalText:
      "Located one block from the park and nearby landmarks. Reserve dinner tonight.",
  },
  {
    name: "Liberty Immigration Law Group",
    vertical: "legal_immigration",
    primaryCategory: "lawyer",
    primaryCategoryDisplay: "Immigration Attorney",
    googleCategories: ["lawyer", "immigration_lawyer"],
    bsService: "immigration lawyer",
    gbpDescription: "Immigration attorney handling visa petitions and asylum matters.",
    websiteSignalText:
      "Experienced visa lawyer and immigration legal services for family and business cases.",
  },
  {
    name: "Northstar SEO Agency",
    vertical: "general_smb",
    primaryCategory: "consultant",
    primaryCategoryDisplay: "Marketing Agency",
    googleCategories: ["consultant"],
    bsService: "marketing consultant",
    gbpDescription: "Digital marketing agency focused on SEO and web design services.",
    websiteSignalText:
      "SEO agency, content strategy, web design studio, and paid search consulting.",
  },
];

function buildMockGoogleData(test: SyntheticCase): AuditGoogleData {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    business: {
      name: test.name,
      name_secondary: undefined,
      description: test.gbpDescription,
      formatted_address: "Synthetic Address",
      address_lines: ["Synthetic Address"],
      street: "Synthetic Street",
      city: "Synthetic City",
      state: "CA",
      zip: "94000",
      country: "US",
      place_id: `synthetic-${test.name.toLowerCase().replace(/\s+/g, "-")}`,
      business_url: "",
      website: "https://synthetic.example.com",
      phone: undefined,
      lat: null,
      lng: null,
    },
    vertical: {
      google_categories: test.googleCategories,
      primary_category: test.primaryCategory,
      primary_category_display: test.primaryCategoryDisplay ?? null,
      inferred_vertical: test.vertical,
      confidence: 0.9,
    },
    language: {
      primary_language: "en",
      is_bilingual: false,
      is_chinese_business: false,
      detection_signals: {
        name_has_cjk: false,
        gbp_locale: "en",
        review_language_distribution: {},
      },
    },
    profile_health: {
      is_claimed: true,
      is_verified: true,
      has_hours: true,
      has_phone: true,
      has_website: true,
      has_categories: true,
      has_description: Boolean(test.gbpDescription),
      photos_count: 0,
      profile_completeness: 80,
    },
    reviews_aggregate: {
      total_count: 100,
      rating: 4.6,
      last_review_date: null,
      last_review_days_ago: null,
      reviews_30d: null,
      reviews_90d: null,
      reviews_180d: null,
      reviews_365d: null,
      velocity_30d_per_month: null,
      velocity_180d_per_month: null,
      velocity_365d_per_month: null,
      response_rate: null,
      response_time_median_hours: null,
      unanswered_count: null,
      photo_review_count: null,
    },
    reviews: [],
    meta: {
      fetched_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      data_source: "place_details",
      tier: "free",
      cache_hit: false,
    },
  };
}

function main() {
  const rows = SYNTHETIC_CASES.map((test) => {
    const google = buildMockGoogleData(test);
    const decision = reconcileServiceDecision({
      google,
      bsService: test.bsService,
      gbpDescription: test.gbpDescription ?? null,
      websiteSignalText: test.websiteSignalText ?? null,
    });
    return {
      name: test.name,
      vertical: test.vertical,
      bsService: decision.bs_service,
      recommended: decision.cs_recommended_service,
      confidence: `${Math.round(decision.cs_confidence * 100)}%`,
      reasonCodes: decision.cs_reason_codes.join(", "),
    };
  });

  console.log("=== Synthetic Reconciliation Smoke ===");
  for (const row of rows) {
    console.log("");
    console.log(`- ${row.name} [${row.vertical}]`);
    console.log(`  bs_service: ${row.bsService}`);
    console.log(`  recommended: ${row.recommended} (${row.confidence})`);
    console.log(`  reason_codes: ${row.reasonCodes}`);
  }
}

main();
