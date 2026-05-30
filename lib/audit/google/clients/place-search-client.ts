import "server-only";
import { BusinessNotFoundError, GoogleApiError } from "../errors";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
].join(",");

interface SearchResponse {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
  }>;
}

export async function searchPlaceIdByText(
  query: string,
  apiKey: string,
): Promise<string> {
  const url = "https://places.googleapis.com/v1/places:searchText";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "en",
      regionCode: "US",
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new GoogleApiError(
      response.status.toString(),
      `Text Search failed: ${body}`,
    );
  }

  const data = (await response.json()) as SearchResponse;
  const first = data.places?.[0];
  if (!first) throw new BusinessNotFoundError(query);
  return first.id;
}
