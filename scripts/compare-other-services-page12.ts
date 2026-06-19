import { readFileSync } from "node:fs";
import { resolveServiceKeyword } from "@/lib/audit/competitors/keyword-resolver";
import { mapVertical } from "@/lib/audit/google/aggregators/vertical-mapper";
import { reconcileServiceDecision } from "@/lib/audit/service-reconciler";
import { pickTopComprehensiveService } from "@/lib/audit/service-candidate-generator";
import { analyzeServiceWithAnalyst } from "@/lib/audit/service-analyst";
import { fetchWebsiteServiceSignalText } from "@/lib/audit/service-signal-web-core";
import { canonicalizeService } from "@/lib/audit/service-taxonomy";
import type { AuditGoogleData } from "@/lib/audit/google/types";

interface InputBusiness {
  rank: number;
  name: string;
  address?: string;
}

interface PlaceSearchMatch {
  id: string;
}

interface PlaceDetails {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  websiteUri?: string;
  editorialSummary?: { text?: string };
  userRatingCount?: number;
  rating?: number;
}

const PAGE_12_BUSINESSES: InputBusiness[] = [
  { rank: 221, name: "Cherny Law Office P.C.", address: "1935 Shore Pkwy Apt 12j, Brooklyn, NY" },
  { rank: 222, name: "Legacy Timeless Jewel Inc.", address: "1808 86th St, Brooklyn, NY 11214" },
  { rank: 223, name: "JayZhuoPhoto", address: "101 Wadsworth Ave, Staten Island, NY 103" },
  { rank: 224, name: "Judson Memorial Church", address: "55 Washington Square S, New York, NY" },
  { rank: 225, name: "Animal Haven", address: "200 Centre St, New York, NY 10013" },
  {
    rank: 226,
    name: "YY 快递 YY EXPRESS WORLDWIDE SHIPPING 顺时国际物流 SINCE LOGISTICS 邮寄中国",
    address: "812 58th St, Brooklyn, NY 11220",
  },
  { rank: 227, name: "My Natural Pet", address: "8318 5th Ave, Brooklyn, NY 11209" },
  { rank: 228, name: "City Mailroom", address: "44-70 21st St, Long Island City, NY 1110" },
  { rank: 229, name: "Heritage House Photography", address: "1432 Briarcliff Dr, Merrick, NY 11566" },
  { rank: 230, name: "Lao Feng Xiang- LFX Jewelry", address: "136-20 Roosevelt Ave #108, Flushing, NY" },
  { rank: 231, name: "Verizon", address: "8516 Bay Pkwy, Brooklyn, NY 11214" },
  { rank: 232, name: "Guru Repairs", address: "40-03 Bell Blvd, Bayside, NY 11361" },
  { rank: 233, name: "AmbuVet Pet Ambulance", address: "81st St, Jackson Heights, NY 11372" },
  {
    rank: 234,
    name: "The Mail Drop (UPS , FedEx , USPS, DHL, ShipCenter)",
    address: "64-31 108th St, Forest Hills, NY 11375",
  },
  { rank: 235, name: "Happy Paw Studio. Dog Grooming", address: "27-10 99th St, East Elmhurst, NY 11369" },
  { rank: 236, name: "Wing On Wo & Co", address: "26 Mott St, New York, NY 10013" },
  {
    rank: 237,
    name: "J&YElectronics - Brooklyn Mobile Phone Repair Store",
    address: "766 Liberty Ave, Brooklyn, NY 11208",
  },
  { rank: 238, name: "DOGMA GARDEN", address: "220 Avenue B, New York, NY 10009" },
  { rank: 239, name: "4the1 Image", address: "25-18 50th St Suite 202, Woodside, NY" },
  { rank: 240, name: "Wat Buddha Thai Thavorn Vanaram", address: "76-16 46th Ave, Elmhurst, NY 11373" },
];

async function main() {
  loadEnvFile(".env.local");
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is required in environment.");

  const llmEnabled =
    process.env.SERVICE_ANALYST_PRIMARY_USE_LLM === "1" ||
    (process.env.SERVICE_ANALYST_PRIMARY_USE_LLM !== "0" && !!process.env.ANTHROPIC_API_KEY);
  const effectiveModel =
    process.env.SERVICE_ANALYST_CLAUDE_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    "claude-opus-4-1-20250805";

  const rows: Array<{
    rank: number;
    input_name: string;
    matched_name: string;
    system_service: string;
    llm_service: string;
    llm_phrase: string;
    same: boolean;
  }> = [];
  const failures: Array<{ rank: number; name: string; reason: string }> = [];

  for (const business of PAGE_12_BUSINESSES) {
    try {
      const primaryQuery = [business.name, business.address ?? ""].join(" ").trim();
      const match =
        (await searchBestPlace(primaryQuery, apiKey)) ||
        (await searchBestPlace(business.name, apiKey));
      if (!match) {
        failures.push({ rank: business.rank, name: business.name, reason: "No Google place match found" });
        continue;
      }

      const details = await fetchPlaceDetails(match.id, apiKey);
      const googleData = buildGoogleLikeData(details);
      const seedService = resolveServiceKeyword(googleData);
      const websiteSignal = await fetchWebsiteServiceSignalText(googleData.business.website ?? null);
      const comprehensiveTop = pickTopComprehensiveService({
        google: googleData,
        gbpDescription: googleData.business.description ?? null,
        websiteSignalText: websiteSignal?.text ?? null,
        seedService,
      });
      const baseDetectedService = comprehensiveTop?.service || seedService;

      const systemDecision = reconcileServiceDecision({
        google: googleData,
        bsService: baseDetectedService,
        gbpDescription: googleData.business.description ?? null,
        websiteSignalText: websiteSignal?.text ?? null,
      });
      const analyst = await analyzeServiceWithAnalyst({
        google: googleData,
        googleService:
          googleData.vertical.primary_category_display || googleData.vertical.primary_category || "",
        fallbackService: baseDetectedService,
        gbpDescription: googleData.business.description ?? null,
        websiteSignalText: websiteSignal?.text ?? null,
        useLlm: llmEnabled,
      });

      const systemService = canonicalizeService(systemDecision.cs_recommended_service);
      const llmService = analyst.recommended_service;
      const llmPhrase = analyst.llm_service_phrase || analyst.recommended_service;
      rows.push({
        rank: business.rank,
        input_name: business.name,
        matched_name: googleData.business.name,
        system_service: systemService,
        llm_service: llmService,
        llm_phrase: llmPhrase,
        same: systemService.trim().toLowerCase() === llmService.trim().toLowerCase(),
      });
    } catch (err) {
      failures.push({
        rank: business.rank,
        name: business.name,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  rows.sort((a, b) => a.rank - b.rank);
  failures.sort((a, b) => a.rank - b.rank);

  console.log("=== Other Services Page 12 · System vs LLM ===");
  console.log(`Businesses requested: ${PAGE_12_BUSINESSES.length}`);
  console.log(`Evaluated: ${rows.length}`);
  console.log(`Failures: ${failures.length}`);
  console.log(`LLM enabled: ${llmEnabled ? "yes" : "no"}`);
  console.log(`Effective model: ${effectiveModel}`);
  console.log(`Same service: ${rows.filter((row) => row.same).length}/${rows.length}`);
  console.log(`Different service: ${rows.filter((row) => !row.same).length}/${rows.length}`);
  console.log("");
  console.log(JSON.stringify({ rows, failures }, null, 2));
}

async function searchBestPlace(textQuery: string, apiKey: string): Promise<PlaceSearchMatch | null> {
  if (!textQuery.trim()) return null;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "en",
      maxResultCount: 3,
    }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { places?: Array<{ id?: string }> };
  const first = json.places?.[0];
  if (!first?.id) return null;
  return { id: first.id };
}

async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetails> {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,addressComponents,types,primaryType,primaryTypeDisplayName,websiteUri,editorialSummary,userRatingCount,rating",
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(`Place details failed (${response.status}): ${body}`);
  }
  return (await response.json()) as PlaceDetails;
}

function buildGoogleLikeData(details: PlaceDetails): AuditGoogleData {
  const name = details.displayName?.text ?? "(unknown)";
  const types = details.types ?? [];
  const verticalMatch = mapVertical(types, name);
  const formattedAddress = details.formattedAddress ?? "";
  const city = deriveCity(details);
  const state = deriveState(details);
  const zip = deriveZip(details);
  const country = deriveCountry(details);
  const street = deriveStreet(details);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    business: {
      name,
      name_secondary: undefined,
      formatted_address: formattedAddress,
      address_lines: formattedAddress
        ? formattedAddress.split(",").map((part) => part.trim()).filter(Boolean)
        : [],
      street,
      state,
      zip,
      country,
      place_id: details.id,
      business_url: "",
      website: details.websiteUri ?? undefined,
      description: details.editorialSummary?.text?.trim() || undefined,
      city,
      phone: undefined,
      lat: null,
      lng: null,
    },
    vertical: {
      google_categories: types,
      primary_category: details.primaryType ?? verticalMatch.primary_category ?? "local business",
      primary_category_display: details.primaryTypeDisplayName?.text ?? null,
      inferred_vertical: verticalMatch.inferred_vertical,
      confidence: verticalMatch.confidence,
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
      is_claimed: false,
      is_verified: false,
      has_hours: false,
      has_phone: false,
      has_website: Boolean(details.websiteUri),
      has_categories: types.length > 0,
      has_description: Boolean(details.editorialSummary?.text),
      photos_count: 0,
      profile_completeness: 0,
    },
    reviews_aggregate: {
      total_count: details.userRatingCount ?? 0,
      rating: details.rating ?? 0,
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

function deriveCity(details: PlaceDetails): string {
  for (const component of details.addressComponents ?? []) {
    const types = component.types ?? [];
    if (types.includes("locality")) return (component.longText ?? component.shortText ?? "").trim();
  }
  const formatted = (details.formattedAddress ?? "").trim();
  const parts = formatted.split(",").map((value) => value.trim());
  return parts[1] ?? "";
}

function deriveState(details: PlaceDetails): string {
  for (const component of details.addressComponents ?? []) {
    const types = component.types ?? [];
    if (types.includes("administrative_area_level_1")) {
      return (component.shortText ?? component.longText ?? "").trim();
    }
  }
  return "";
}

function deriveZip(details: PlaceDetails): string {
  for (const component of details.addressComponents ?? []) {
    const types = component.types ?? [];
    if (types.includes("postal_code")) return (component.longText ?? component.shortText ?? "").trim();
  }
  return "";
}

function deriveCountry(details: PlaceDetails): string {
  for (const component of details.addressComponents ?? []) {
    const types = component.types ?? [];
    if (types.includes("country")) {
      return (component.shortText ?? component.longText ?? "").trim() || "US";
    }
  }
  return "US";
}

function deriveStreet(details: PlaceDetails): string {
  let streetNumber = "";
  let route = "";
  for (const component of details.addressComponents ?? []) {
    const types = component.types ?? [];
    if (types.includes("street_number")) streetNumber = (component.longText ?? component.shortText ?? "").trim();
    if (types.includes("route")) route = (component.longText ?? component.shortText ?? "").trim();
  }
  return [streetNumber, route].filter(Boolean).join(" ").trim();
}

function loadEnvFile(path: string) {
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

main().catch((err) => {
  console.error("[compare-other-services-page12] failed:", err);
  process.exitCode = 1;
});
