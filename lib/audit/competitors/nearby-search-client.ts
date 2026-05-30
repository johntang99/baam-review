import "server-only";
import { GoogleApiError } from "../google/errors";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.userRatingCount",
  "places.rating",
  "places.businessStatus",
].join(",");

export interface NearbyCandidate {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  userRatingCount?: number;
  rating?: number;
  businessStatus?: string;
}

interface SearchResponse {
  places?: NearbyCandidate[];
}

export async function searchNearbyByKeyword(args: {
  keyword: string;
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  maxResults?: number;
  apiKey: string;
}): Promise<NearbyCandidate[]> {
  const radiusMeters = Math.min(args.radiusMiles * 1609.34, 50000);

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": args.apiKey,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: args.keyword,
        locationBias: {
          circle: {
            center: { latitude: args.centerLat, longitude: args.centerLng },
            radius: radiusMeters,
          },
        },
        maxResultCount: Math.min(args.maxResults ?? 20, 20),
        languageCode: "en",
        regionCode: "US",
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new GoogleApiError(
      response.status.toString(),
      `searchText nearby failed: ${body}`,
    );
  }

  const data = (await response.json()) as SearchResponse;
  return data.places ?? [];
}

export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
