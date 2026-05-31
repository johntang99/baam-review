import "server-only";
import type { AuditGoogleData } from "../../google/types";
import { GoogleSerpClient } from "../google-search/serp-client";

export type ResolutionConfidence = "high" | "medium" | "low" | "not_found";

export interface ResolvedYelpUrl {
  url: string | null;
  confidence: ResolutionConfidence;
  candidates_seen: number;
}

const YELP_BUSINESS_URL = /^https?:\/\/(?:www\.)?yelp\.com\/biz\/([a-z0-9\-]+)\/?(\?.*)?$/i;

export async function resolveYelpUrl(
  business: AuditGoogleData,
  apiKey: string,
): Promise<ResolvedYelpUrl> {
  const client = new GoogleSerpClient(apiKey);
  const query = buildSerpQuery(business);

  let results: Array<{ link: string }>;
  try {
    results = await client.search(query, 5);
  } catch (err) {
    console.error("[yelp-resolver] SERP failed:", err);
    return { url: null, confidence: "not_found", candidates_seen: 0 };
  }

  const businessWords = significantNameTokens(business.business.name);
  let bestMatch: { url: string; matches: number } | null = null;

  for (const r of results) {
    const match = YELP_BUSINESS_URL.exec(r.link);
    if (!match) continue;
    const slug = match[1].toLowerCase();
    const matches = businessWords.filter((w) => slug.includes(w)).length;
    if (!bestMatch || matches > bestMatch.matches) {
      bestMatch = {
        url: `https://www.yelp.com/biz/${slug}`,
        matches,
      };
    }
  }

  if (!bestMatch) {
    return { url: null, confidence: "not_found", candidates_seen: results.length };
  }

  const threshold = Math.min(2, businessWords.length);
  const confidence: ResolutionConfidence =
    bestMatch.matches >= threshold
      ? "high"
      : bestMatch.matches >= 1
        ? "medium"
        : "low";

  if (confidence === "low") {
    return { url: null, confidence: "not_found", candidates_seen: results.length };
  }

  return {
    url: bestMatch.url,
    confidence,
    candidates_seen: results.length,
  };
}

function buildSerpQuery(business: AuditGoogleData): string {
  const name = business.business.name;
  const city = business.business.city;
  return `"${name}" "${city}" site:yelp.com`;
}

function significantNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[（）()]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "llc",
  "inc",
  "corp",
  "ltd",
  "pllc",
  "pc",
  "for",
  "with",
  "from",
]);
