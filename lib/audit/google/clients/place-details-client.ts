import "server-only";
import { GoogleApiError } from "../errors";

const PLACE_DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "businessStatus",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "regularOpeningHours",
  "userRatingCount",
  "rating",
  "reviews",
  "photos",
  "editorialSummary",
].join(",");

export interface RawPlaceAddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

export interface RawPlaceReview {
  name?: string;
  relativePublishTimeDescription?: string;
  rating?: number;
  text?: { text: string; languageCode?: string };
  originalText?: { text: string; languageCode?: string };
  authorAttribution?: {
    displayName?: string;
    uri?: string;
    photoUri?: string;
  };
  publishTime?: string;
}

export interface RawPlaceLocation {
  latitude: number;
  longitude: number;
}

export interface RawPlaceDetails {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  addressComponents?: RawPlaceAddressComponent[];
  location?: RawPlaceLocation;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text: string; languageCode?: string };
  regularOpeningHours?: {
    periods?: unknown[];
    weekdayDescriptions?: string[];
  };
  userRatingCount?: number;
  rating?: number;
  reviews?: RawPlaceReview[];
  photos?: unknown[];
  editorialSummary?: { text: string; languageCode?: string };
}

export async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
): Promise<RawPlaceDetails> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;

  const response = await fetchWithRetry(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
    },
  });

  if (!response.ok) {
    const body = await safeReadBody(response);
    throw new GoogleApiError(
      response.status.toString(),
      `Place Details failed: ${body}`,
    );
  }

  return (await response.json()) as RawPlaceDetails;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.status === 429 || response.status >= 500) {
        if (attempt < attempts - 1) {
          await sleep(attempt === 0 ? 1000 : 3000);
          continue;
        }
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await sleep(attempt === 0 ? 1000 : 3000);
      }
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "(no body)";
  }
}
