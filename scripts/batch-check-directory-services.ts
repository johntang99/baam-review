import { readFileSync } from "node:fs";
import { resolveServiceKeyword } from "@/lib/audit/competitors/keyword-resolver";
import { mapVertical } from "@/lib/audit/google/aggregators/vertical-mapper";
import { reconcileServiceDecision } from "@/lib/audit/service-reconciler";

interface InputBusiness {
  name: string;
  address: string;
  website?: string;
}

interface PlaceSearchMatch {
  id: string;
  name: string;
  formattedAddress: string;
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

const DEFAULT_DIRECTORY_SAMPLES: InputBusiness[] = [
  {
    name: "Wedding Atelier Flagship Bridal Boutique",
    address: "72 Madison Ave 4th floor, New York, NY 10016",
    website: "weddingatelier.com",
  },
  {
    name: "Natural Life Acupuncture, PC",
    address: "143-26 41st Ave, Flushing, NY 11354",
    website: "acupunctureflushing.com",
  },
  {
    name: "ACA Acupuncture & Wellness - Washington Heights",
    address: "613 W 169th St, New York, NY 10032",
    website: "acaacupuncture.com",
  },
  {
    name: "Mayell Real Estate",
    address: "345 E 18th St Front A, New York, NY 10003",
    website: "mayellre.com",
  },
  {
    name: "Ranshaw Plumbing & Heating",
    address: "151-01 14th Ave, Whitestone, NY 11357",
    website: "ranshaw.com",
  },
  {
    name: "WORLD SPA",
    address: "1571 McDonald Ave, Brooklyn, NY 11230",
    website: "worldspa.com",
  },
  {
    name: "Haidilao Hotpot",
    address: "138-23 39th Ave, Flushing, NY 11354",
    website: "superhiinternational.com",
  },
  {
    name: "Blue Steel Auto School",
    address: "197 Utica Ave, Brooklyn, NY 11213",
    website: "bluesteelautoschool.com",
  },
];

async function main() {
  loadEnvFile(".env.local");
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is required in environment.");
  }

  const input = await loadInputBusinesses(process.argv[2]);
  const rows: Array<Record<string, string>> = [];
  const failures: Array<{ name: string; reason: string }> = [];

  for (const business of input) {
    try {
      const searchQuery = `${business.name} ${business.address}`.trim();
      const match = await searchBestPlace(searchQuery, apiKey);
      if (!match) {
        failures.push({
          name: business.name,
          reason: "No Google place match found",
        });
        continue;
      }

      const details = await fetchPlaceDetails(match.id, apiKey);
      const googleData = buildGoogleLikeData(details);
      const bsService = resolveServiceKeyword(googleData as any);
      const websiteSignalText = await fetchWebsiteServiceSignalText(
        googleData.business.website ?? business.website ?? null,
      );
      const decision = reconcileServiceDecision({
        google: googleData as any,
        bsService,
        gbpDescription: googleData.business.description ?? null,
        websiteSignalText,
      });

      rows.push({
        Input: business.name,
        "Google Matched Name": googleData.business.name,
        "Google Service": decision.gs_service,
        "BAAM-generated Service": decision.bs_service,
        "Recommended Service": decision.cs_recommended_service,
        Confidence: `${Math.round(decision.cs_confidence * 100)}%`,
        "Reason Codes": decision.cs_reason_codes.join(", "),
        "Website Signal": decision.cs_reason_codes.includes("website_signal")
          ? "Yes"
          : "No",
      });
    } catch (err) {
      failures.push({
        name: business.name,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("=== Batch Service Check (Directory Samples) ===");
  console.log(`Input businesses: ${input.length}`);
  console.log(`Resolved: ${rows.length}`);
  console.log(`Failures: ${failures.length}`);
  console.log("");

  if (rows.length > 0) {
    printTable(rows);
    console.log("");
  }

  if (failures.length > 0) {
    console.log("=== Failures ===");
    for (const item of failures) {
      console.log(`- ${item.name}: ${item.reason}`);
    }
  }
}

async function loadInputBusinesses(pathArg?: string): Promise<InputBusiness[]> {
  if (!pathArg) return DEFAULT_DIRECTORY_SAMPLES;
  const raw = readFileSync(pathArg, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Input JSON must be an array of {name,address,website?}.");
  }
  const items: InputBusiness[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const entry = row as Record<string, unknown>;
    const name = String(entry.name ?? "").trim();
    const address = String(entry.address ?? "").trim();
    const website = String(entry.website ?? "").trim();
    if (!name || !address) continue;
    items.push({ name, address, website: website || undefined });
  }
  if (items.length === 0) {
    throw new Error("No valid entries found in input JSON.");
  }
  return items;
}

async function searchBestPlace(
  textQuery: string,
  apiKey: string,
): Promise<PlaceSearchMatch | null> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "en",
      maxResultCount: 3,
    }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
    }>;
  };
  const first = json.places?.[0];
  if (!first?.id) return null;
  return {
    id: first.id,
    name: first.displayName?.text ?? "",
    formattedAddress: first.formattedAddress ?? "",
  };
}

async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetails> {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,addressComponents,types,primaryType,primaryTypeDisplayName,websiteUri,editorialSummary,userRatingCount,rating",
      },
    },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(`Place details failed (${response.status}): ${body}`);
  }
  return (await response.json()) as PlaceDetails;
}

function buildGoogleLikeData(details: PlaceDetails) {
  const name = details.displayName?.text ?? "(unknown)";
  const types = details.types ?? [];
  const verticalMatch = mapVertical(types, name);
  return {
    business: {
      name,
      place_id: details.id,
      website: details.websiteUri ?? undefined,
      description: details.editorialSummary?.text?.trim() || undefined,
      city: deriveCity(details),
    },
    vertical: {
      google_categories: types,
      primary_category: details.primaryType ?? verticalMatch.primary_category,
      primary_category_display: details.primaryTypeDisplayName?.text ?? null,
      inferred_vertical: verticalMatch.inferred_vertical,
      confidence: verticalMatch.confidence,
    },
  };
}

function deriveCity(details: PlaceDetails): string {
  for (const component of details.addressComponents ?? []) {
    const types = component.types ?? [];
    if (types.includes("locality")) {
      return (component.longText ?? component.shortText ?? "").trim();
    }
  }
  const formatted = (details.formattedAddress ?? "").trim();
  const parts = formatted.split(",").map((value) => value.trim());
  return parts[1] ?? "";
}

async function fetchWebsiteServiceSignalText(
  inputUrl: string | null | undefined,
): Promise<string | null> {
  const url = normalizeWebsiteUrl(inputUrl);
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2200);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BAAMReviewAuditBot/1.0; +https://baamreview.com)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;
    const html = (await response.text()).slice(0, 200_000);
    const text = extractSignalText(html);
    return text.length > 20 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWebsiteUrl(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function extractSignalText(html: string) {
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const title = normalizeText(
    extractFirstGroup(cleaned, /<title[^>]*>([\s\S]*?)<\/title>/i),
  );
  const body = normalizeText(cleaned.replace(/<[^>]+>/g, " ")).slice(0, 1800);
  return [title, body].filter(Boolean).join(" | ");
}

function extractFirstGroup(input: string, pattern: RegExp) {
  const match = input.match(pattern);
  return match?.[1] ?? "";
}

function normalizeText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function printTable(rows: Array<Record<string, string>>) {
  const headers = Object.keys(rows[0]);
  const widths = headers.map((header) =>
    Math.max(
      header.length,
      ...rows.map((row) => String(row[header] ?? "").length),
    ),
  );

  const pad = (value: string, width: number) =>
    value.length >= width ? value : value + " ".repeat(width - value.length);

  const headerLine = headers
    .map((header, index) => pad(header, widths[index]))
    .join(" | ");
  const separator = widths.map((width) => "-".repeat(width)).join("-|-");
  console.log(headerLine);
  console.log(separator);
  for (const row of rows) {
    console.log(
      headers
        .map((header, index) => pad(String(row[header] ?? ""), widths[index]))
        .join(" | "),
    );
  }
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
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore
  }
}

main().catch((err) => {
  console.error("[batch-check-directory-services] failed:", err);
  process.exitCode = 1;
});
