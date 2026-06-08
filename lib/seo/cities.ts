/**
 * Registry of cities that have a published /local/<slug> page.
 *
 * Why a registry instead of "any city with audit data": Google's
 * helpful-content update punishes auto-generated location pages with
 * thin content. We only ship a page once we've confirmed there's
 * enough real audit data behind it AND we've reviewed the page output
 * for that city.
 *
 * To enable a new city:
 *   1. Confirm we have ≥ 10 published audits whose google_data.business.city
 *      matches (case-insensitive) one of the `matchNames` entries.
 *   2. Add the city to CITIES below.
 *   3. Add hand-written `intro` + `whyHere` copy specific to that market
 *      — these are the human voice Google's E-E-A-T signal looks for.
 *   4. Deploy. The sitemap + IndexNow auto-pickup is wired in
 *      app/sitemap.ts.
 *
 * For NY-metro launch (Phase 2 Week 4), we ship Flushing, Manhattan,
 * Middletown, Brooklyn, Queens, and the broader "New York City" page.
 */

export interface CityEntry {
  /** URL slug — what appears in /local/<slug>. */
  slug: string;
  /** Display name as it appears in copy. */
  displayName: string;
  /** 2-letter state code. */
  state: string;
  /** Optional ZIP — improves Local Pack eligibility. Use the central
   * ZIP for the city (post office HQ is a fine pick). */
  postalCode?: string;
  /** All the strings we accept as "this audit is in this city" when
   * matching `google_data.business.city`. Lowercased + trimmed before
   * comparison. */
  matchNames: string[];
  /** Hand-written 1-2 sentence intro for the hero. Specific to this
   * market. Google rewards unique copy over boilerplate. */
  intro: string;
  /** Hand-written paragraph explaining why this market matters to BAAM
   * specifically — bilingual demand, dense competition, particular
   * verticals. Keep it ~80 words, voice-of-founder. */
  whyHere: string;
}

export const CITIES: CityEntry[] = [
  {
    slug: "flushing",
    displayName: "Flushing",
    state: "NY",
    postalCode: "11354",
    matchNames: ["flushing", "flushing, ny", "flushing queens"],
    intro:
      "Review marketing for local businesses in Flushing, Queens. We've audited the bilingual TCM, dental, and salon market here more than anywhere else.",
    whyHere:
      "Flushing is the densest Chinese-American small-business cluster on the East Coast. Most review tools treat it as a footnote — we treat it as the home market. Bilingual review templates, bilingual audit reports, and replies that actually sound right in 中文 are default features, not paid add-ons. If you're an owner here, the patterns we see locally apply to your business specifically.",
  },
  {
    slug: "manhattan",
    displayName: "Manhattan",
    state: "NY",
    postalCode: "10001",
    matchNames: ["manhattan", "manhattan, ny", "new york", "new york, ny"],
    intro:
      "Review marketing for local businesses in Manhattan. The most competitive Google Maps market in the country — and where reviews matter most.",
    whyHere:
      "Manhattan businesses face the most ruthless local-search competition in the United States. A 4.4-star average isn't enough — your competitors are at 4.8 with three times the review count. We audit Manhattan more than any other market and have the data on what actually moves rankings here, by neighborhood and vertical.",
  },
  {
    slug: "middletown-ny",
    displayName: "Middletown",
    state: "NY",
    postalCode: "10940",
    matchNames: ["middletown", "middletown, ny", "middletown township"],
    intro:
      "Review marketing for local businesses in Middletown, NY. A growing Hudson Valley market with strong demand and surprisingly little competition.",
    whyHere:
      "Middletown is the kind of market that's easy to underestimate — until you look at the audit data. Local search competition is lighter than Manhattan, which means there's still room to be the #1 result in your category. We've helped Middletown TCM, dental, and chiropractic practices reach the top of the Map Pack with realistic review-collection cadences.",
  },
  {
    slug: "brooklyn",
    displayName: "Brooklyn",
    state: "NY",
    postalCode: "11201",
    matchNames: ["brooklyn", "brooklyn, ny"],
    intro:
      "Review marketing for local businesses in Brooklyn. Borough-wide audit data across Park Slope, Williamsburg, Bay Ridge, and beyond.",
    whyHere:
      "Brooklyn is really a half-dozen markets stitched together. What works in Park Slope doesn't necessarily work in Bay Ridge, and Williamsburg has a different competitive baseline than Bensonhurst. Our audit data is broken down by neighborhood so the recommendations we make for your business are based on the actual competitive set you're up against.",
  },
  {
    slug: "queens",
    displayName: "Queens",
    state: "NY",
    postalCode: "11375",
    matchNames: ["queens", "queens, ny", "long island city"],
    intro:
      "Review marketing for local businesses across Queens — the most linguistically diverse borough in America.",
    whyHere:
      "Queens runs in English, Chinese, Korean, Spanish, Bengali, and a half-dozen other languages. Reviews matter the same way everywhere, but the templates and reply tones that work in Flushing don't necessarily work in Astoria or Jamaica. We build review systems that match the languages your actual customers speak.",
  },
];

const CITIES_BY_SLUG: Map<string, CityEntry> = new Map(
  CITIES.map((c) => [c.slug, c]),
);

/** Look up a city by its slug — used by `/local/[slug]/page.tsx`.
 *  Returns the code registry entry; DB overrides are merged in by
 *  `getCityResolved()` (see below), which the page actually calls. */
export function getCityBySlug(slug: string): CityEntry | null {
  return CITIES_BY_SLUG.get(slug) ?? null;
}

/** Code-registry slugs only. DB-only cities are appended by callers
 *  that need a full picture (e.g. sitemap auto-discovery). */
export function listCitySlugs(): string[] {
  return CITIES.map((c) => c.slug);
}

/**
 * Resolve a city by slug, merging DB overrides over the code registry.
 *
 * Precedence:
 *   1. DB row (status='published') for this slug — wins for any field
 *      it sets.
 *   2. Code registry — provides defaults for any field DB doesn't
 *      override.
 *
 * Either source is sufficient on its own. Returns null only when
 * neither exists.
 *
 * Lives in a separate module (lib/seo/cities-resolve.ts) so the
 * lookup map above stays a pure synchronous file — the resolver
 * needs to await the DB.
 */
