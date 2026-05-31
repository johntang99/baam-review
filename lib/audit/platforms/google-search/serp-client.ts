import "server-only";
import { OutscraperBaseClient } from "../../google/clients/outscraper-base-client";
import { OutscraperError } from "../../google/errors";

export interface SerpResult {
  link: string;
  title?: string;
  snippet?: string;
}

interface SerpOrganicResult {
  link?: string;
  title?: string;
  snippet?: string;
  description?: string;
}

interface SerpResponse {
  status?: string;
  data?: Array<{
    organic_results?: SerpOrganicResult[];
  }>;
}

/** Wrapper around Outscraper's Google SERP API. Used to discover Yelp
 *  business URLs via `site:yelp.com` queries; can be reused for other
 *  site-restricted lookups (Zocdoc, Healthgrades, etc.). */
export class GoogleSerpClient extends OutscraperBaseClient {
  async search(query: string, limit = 5): Promise<SerpResult[]> {
    const response = await this.getJson<SerpResponse>("/google-search-v3", {
      query,
      pagesPerQuery: 1,
      uleResultsLimit: limit,
      language: "en",
      region: "US",
      async: false,
    });

    if (response.status && response.status !== "Success") {
      throw new OutscraperError(`google-search-v3 status=${response.status}`);
    }

    const inner = response.data?.[0]?.organic_results ?? [];
    const out: SerpResult[] = [];
    for (const r of inner) {
      if (!r.link) continue;
      out.push({
        link: r.link,
        title: r.title,
        snippet: r.snippet ?? r.description,
      });
    }
    return out;
  }
}
