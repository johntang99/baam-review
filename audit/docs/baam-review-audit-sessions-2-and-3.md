# Sessions 2 & 3 · Multi-Platform Data + Competitor Identification

**Build target:**
- **Session 2** — extends Session 1's pattern to four additional platforms (Yelp, Zocdoc, Healthgrades, Facebook), with unified output and tier-aware scoping.
- **Session 3** — given a primary audited business, identifies 3–5 real competitors and fetches data for each in parallel using Sessions 1 + 2.

These two sessions are specified together because Session 3 is structurally "do Sessions 1+2 again N times in parallel." Writing them together avoids duplicating patterns and surfaces shared abstractions.

---

## 1. Architectural Anchors (decisions already made)

Carrying forward from Session 1, plus new decisions specific to Sessions 2+3:

1. **All non-Google platforms require scraping.** Yelp Fusion API only returns 3 reviews and is being deprecated by Yelp. Zocdoc and Healthgrades have no public APIs. Facebook Graph API requires page-owner OAuth (impossible for competitor analysis). **Outscraper covers all four platforms** with the same auth pattern as Session 1. Approximate cost: $1–3 per platform per audit.

2. **Competitor identification uses Google Maps Nearby Search, not user selection.** Per the v3 framework decision: "We pick the competitors — owners pick the wrong ones." The audit reveals competitors the owner often isn't even aware of, which is part of the audit's persuasive value. Owner-selected competitors would also add 24–48 hours of intake friction. (Documented as future option, not Session 3 scope.)

3. **Top 5 competitors selected by Google local ranking** for the audited business's primary search query. Filtered to same `inferred_vertical` within a configurable radius (default: 1.5 miles urban, 5 miles suburban, 10 miles rural — determined by population density of the area).

4. **Parallel fetch with rate limiting.** When fetching data for 1 primary business + 5 competitors × 5 platforms = up to 30 API calls per audit, naive sequential fetching takes minutes. Parallelize within rate limits (Google: 100 QPS, Outscraper: 20 QPS).

5. **Competitor data scoped to free-tier-equivalent depth, always.** Even on paid-tier audits, we don't pay Outscraper for full review history of 5 competitors — that'd quadruple the audit's API cost. Competitors get Place Details (rating + recent reviews + count), enough to populate Section 5's comparison table.

---

## 2. Session 2 · Multi-Platform Data

### 2.1 What this session builds

Four new client modules that mirror Session 1's `getGoogleBusinessData` pattern for Yelp, Zocdoc, Healthgrades, and Facebook. A unified orchestrator function fetches all platforms in parallel and returns a single `AuditPlatformsData` object.

### 2.2 Public API

```ts
export async function getAllPlatformsData(
  business: AuditGoogleData,    // primary identifier comes from Session 1
  tier: 'free' | 'paid'
): Promise<AuditPlatformsData>
```

**Why `AuditGoogleData` as input, not `BusinessReference`?** Because by the time we're fetching secondary platforms, we already have the canonical business name, address, phone, and vertical from Google. These are the lookup keys for the other platforms (each platform has its own ID system, but business name + address is the universal join).

### 2.3 Output schema

```ts
export interface AuditPlatformsData {
  yelp: AuditPlatformData | null;          // null if not found on platform
  zocdoc: AuditPlatformData | null;
  healthgrades: AuditPlatformData | null;
  facebook: AuditPlatformData | null;

  // Vertical-relevance flags — set true if the platform matters for this vertical
  // (e.g., Zocdoc only matters for medical; Healthgrades only for medical; etc.)
  vertical_relevance: {
    yelp: boolean;                          // true for all verticals
    zocdoc: boolean;                        // true for tcm_clinic, dental, etc.
    healthgrades: boolean;                  // true for tcm_clinic, dental, etc.
    facebook: boolean;                      // true for all verticals
  };

  meta: {
    fetched_at: string;
    tier: 'free' | 'paid';
    platforms_attempted: string[];
    platforms_succeeded: string[];
    platforms_not_found: string[];
    platforms_errored: { platform: string; error: string }[];
  };
}

export interface AuditPlatformData {
  platform: 'yelp' | 'zocdoc' | 'healthgrades' | 'facebook';
  platform_id: string;                      // platform-specific ID
  platform_url: string;
  business_name_on_platform: string;        // may differ slightly from Google

  rating: number | null;
  total_count: number;
  last_review_date: string | null;
  last_review_days_ago: number | null;

  profile_health: {
    is_claimed: boolean;
    has_photos: boolean;
    has_hours: boolean;
    has_description: boolean;
    completeness: number;                    // 0-100
  };

  reviews: Review[];                         // 5 (free) or more (paid)

  meta: {
    fetched_at: string;
    data_source: string;                     // 'outscraper-yelp', etc.
  };
}
```

The `Review` type from Session 1 is reused unchanged.

### 2.4 Vertical relevance rules

Not every platform matters for every vertical. The relevance map drives both the data fetcher (don't bother fetching irrelevant platforms) and the audit template (don't show empty rows for irrelevant platforms).

```ts
export const PLATFORM_VERTICAL_RELEVANCE: Record<VerticalKey, PlatformRelevance> = {
  tcm_clinic:        { yelp: true, zocdoc: true,  healthgrades: true,  facebook: true },
  dental:            { yelp: true, zocdoc: true,  healthgrades: true,  facebook: true },
  legal_immigration: { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  restaurant:        { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  real_estate:       { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  hotel:             { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  auto:              { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  contractor:        { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  salon_spa:         { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  cafe:              { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  apparel:           { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  health_food:       { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  insurance:         { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  general_smb:       { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
};
```

For verticals beyond TCM/dental where Zocdoc/Healthgrades isn't relevant, the legal vertical needs `avvo` and `martindale` instead. **Out of scope for Session 2** — Legal-specific platforms are Session 2B if you choose to extend. For now, legal vertical audits show only Google + Yelp + Facebook.

### 2.5 Platform-specific fetchers

Each platform follows the same skeleton: client → normalizer → output. Shared types and patterns, platform-specific lookup logic.

**File structure:**

```
/baam-review/audit-engine/platforms/
├── src/
│   ├── index.ts                          # getAllPlatformsData
│   ├── types.ts
│   ├── platform-relevance.ts             # vertical → platform mapping
│   ├── yelp/
│   │   ├── client.ts                     # Outscraper Yelp endpoint
│   │   └── normalizer.ts
│   ├── zocdoc/
│   │   ├── client.ts                     # Outscraper Zocdoc endpoint
│   │   └── normalizer.ts
│   ├── healthgrades/
│   │   ├── client.ts                     # Outscraper Healthgrades endpoint
│   │   └── normalizer.ts
│   ├── facebook/
│   │   ├── client.ts                     # Outscraper Facebook endpoint
│   │   └── normalizer.ts
│   ├── shared/
│   │   ├── outscraper-base.ts            # shared Outscraper auth/request
│   │   └── lookup-resolver.ts            # business name → platform ID resolver
│   └── cache/
│       └── platform-cache.ts
└── tests/
```

### 2.6 Lookup challenge — business name → platform ID

Outscraper for non-Google platforms typically requires either the platform's own URL or a high-precision text query. Strategy per platform:

**Yelp:** Use Outscraper's Yelp Search API with `query = "${business.name} ${business.city} ${business.state}"`. Take the result with closest address match. Threshold: address must match by at least street number + street name to count as a confident match.

**Zocdoc:** No public search API; Outscraper offers a Zocdoc search by name + zip code. Match by practitioner name + specialty.

**Healthgrades:** Same pattern as Zocdoc — name + zip + specialty.

**Facebook:** Use Outscraper's Facebook Page Search API with `query = "${business.name}"` and filter by location. Many businesses have generic page names that match multiple unrelated pages — use phone number as a disambiguator when available.

**If lookup fails:** Return `null` for that platform with `meta.platforms_not_found` flagged. The audit template handles missing platforms gracefully (the row shows as "Not Listed" with a soft CTA to claim).

### 2.7 Tier scoping for Session 2

| Capability | Free | Paid |
|---|---|---|
| Profile lookup (all 4 platforms) | ✓ | ✓ |
| Rating + count from each platform | ✓ | ✓ |
| Last review date | ✓ | ✓ |
| 5 most recent reviews | ✓ | ✓ |
| Full review history per platform | ✗ | ✓ |
| Windowed velocity per platform | ✗ | ✓ |
| Response rate per platform | ✗ | ✓ |

Free tier still uses Outscraper for the lookup and basic fetch — even free audits need Yelp data to populate Section 2 of the audit. Cost per free audit across all platforms: ~$0.50–1. Cost per paid audit: ~$3–8 depending on review volumes.

### 2.8 Parallel fetching pattern

```ts
export async function getAllPlatformsData(
  business: AuditGoogleData,
  tier: 'free' | 'paid'
): Promise<AuditPlatformsData> {
  const relevance = PLATFORM_VERTICAL_RELEVANCE[business.vertical.inferred_vertical];

  const fetchPromises: Promise<[string, AuditPlatformData | null]>[] = [];

  if (relevance.yelp)         fetchPromises.push(safeYelpFetch(business, tier));
  if (relevance.zocdoc)       fetchPromises.push(safeZocdocFetch(business, tier));
  if (relevance.healthgrades) fetchPromises.push(safeHealthgradesFetch(business, tier));
  if (relevance.facebook)     fetchPromises.push(safeFacebookFetch(business, tier));

  const results = await Promise.allSettled(fetchPromises);
  // Each result is [platformName, data|null] or rejected with the platform name embedded
  // ...build AuditPlatformsData object, populate meta with success/failure breakdowns
}

async function safeYelpFetch(business, tier): Promise<['yelp', AuditPlatformData | null]> {
  try {
    const data = await fetchYelpData(business, tier);
    return ['yelp', data];
  } catch (error) {
    // Log error; return null so other platforms still succeed
    logError('yelp', error);
    return ['yelp', null];
  }
}
```

**Key principle:** No single platform failure should fail the audit. The audit gracefully reports partial data with a meta block explaining what was attempted, what succeeded, what failed.

### 2.9 Caching strategy

Same as Session 1, but per-platform:

```sql
CREATE TABLE audit_platform_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_place_id TEXT NOT NULL,        -- Google place_id as anchor
  platform TEXT NOT NULL CHECK (platform IN ('yelp', 'zocdoc', 'healthgrades', 'facebook')),
  tier TEXT NOT NULL CHECK (tier IN ('free', 'paid')),
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_business_platform_tier UNIQUE (business_place_id, platform, tier)
);
CREATE INDEX idx_apd_place_platform ON audit_platform_data (business_place_id, platform);
CREATE INDEX idx_apd_expires ON audit_platform_data (expires_at);
```

TTL: same as Session 1 (7 days free, 24 hours paid). Cache key joined on Google's `place_id` as the canonical anchor, since secondary-platform IDs aren't stable across lookups.

### 2.10 Session 2 acceptance criteria

1. `getAllPlatformsData(googleData, 'paid')` returns `AuditPlatformsData` with all 4 platforms attempted for a TCM clinic
2. For a real-estate vertical, only `yelp` and `facebook` are attempted (others marked as `vertical_relevance: false`)
3. If Yelp lookup fails but other platforms succeed, audit still completes with `yelp: null` and other platforms populated
4. Cache hits return identical data with no API calls
5. Paid tier returns more reviews than free tier for the same business
6. All unit tests pass; integration tests pass against live Outscraper

---

## 3. Session 3 · Competitor Identification & Parallel Fetch

### 3.1 What this session builds

Given a primary audited business (`AuditGoogleData` from Session 1), identifies 3–5 real local competitors via Google Maps Nearby Search filtered by vertical, then fetches Google + multi-platform data for each competitor in parallel.

The output feeds Section 5 (Competitor Comparison) of the audit and the Do-Nothing projection (Session 6) which needs competitor velocity to model the gap.

### 3.2 Public API

```ts
export async function getCompetitorsData(
  primary: AuditGoogleData,
  tier: 'free' | 'paid',
  options?: GetCompetitorsOptions
): Promise<AuditCompetitorsData>

export interface GetCompetitorsOptions {
  count?: number;                     // default 5
  radius_miles?: number;              // auto-detected from primary.address if omitted
  exclude_place_ids?: string[];       // for excluding known false positives
}
```

### 3.3 Output schema

```ts
export interface AuditCompetitorsData {
  primary_place_id: string;            // for traceability — the business we audited

  competitors: AuditCompetitor[];      // 3–5 entries, ordered by Google's local ranking

  search_metadata: {
    primary_keyword: string;            // the query used (e.g., "acupuncture Flushing")
    radius_used_miles: number;
    total_candidates_found: number;     // before filtering down to top N
    candidates_excluded: number;        // e.g., closed businesses, duplicates
  };

  // Aggregate stats across competitors — used for Section 4 "money on the table"
  // and Section 6 (Do-Nothing projection)
  competitor_aggregate: {
    avg_rating: number;
    avg_review_count: number;
    avg_velocity_30d_per_month: number;
    median_velocity_30d_per_month: number;
    top_velocity_30d_per_month: number;
    velocity_gap_vs_primary: number;     // avg_competitor - primary
  };

  meta: {
    fetched_at: string;
    tier: 'free' | 'paid';
    total_api_calls: number;
    estimated_cost_usd: number;          // for monitoring
  };
}

export interface AuditCompetitor {
  rank: number;                          // 1 = closest competitor, 2 = next, etc.
  google: AuditGoogleData;               // Session 1 output for this competitor
  platforms: AuditPlatformsData | null;  // Session 2 output; only fetched on paid tier
  distance_miles: number;
  shares_primary_keyword: boolean;
}
```

### 3.4 Competitor identification algorithm

**Step 1: Determine the primary search keyword**

The keyword is derived from `primary.vertical.inferred_vertical` + neighborhood:

```ts
const KEYWORD_BY_VERTICAL: Record<VerticalKey, string> = {
  tcm_clinic:        'acupuncture',
  dental:            'dentist',
  legal_immigration: 'immigration lawyer',
  restaurant:        'restaurant',      // refined by cuisine if available
  real_estate:       'real estate agent',
  hotel:             'hotel',
  auto:              'auto repair',
  contractor:        'contractor',
  salon_spa:         'beauty salon',
  cafe:              'coffee shop',
  apparel:           'clothing store',
  health_food:       'health food store',
  insurance:         'insurance agent',
  general_smb:       primary.vertical.primary_category,  // fallback
};

const primary_keyword = `${KEYWORD_BY_VERTICAL[primary.vertical.inferred_vertical]} ${primary.business.city}`;
```

For restaurants specifically, attempt to refine using cuisine type from Google's secondary categories (e.g., `"chinese_restaurant"` → "chinese restaurant Flushing"). This dramatically improves competitor relevance.

**Step 2: Determine search radius**

Default radii by population density of the city:

```ts
const RADIUS_BY_DENSITY: { density: 'urban' | 'suburban' | 'rural'; miles: number }[] = [
  { density: 'urban',     miles: 1.5 },   // Manhattan, Flushing, etc.
  { density: 'suburban',  miles: 5.0 },   // Long Island, NJ suburbs
  { density: 'rural',     miles: 15.0 },  // upstate, distant exurbs
];
```

Population density inferred from zip code via a lookup table (US Census). For Session 3, hardcode a small list of known NYC-metro zip-to-density mappings. Full coverage is a later concern.

**Step 3: Google Maps Nearby Search**

```ts
const nearbyResults = await googleNearbySearch({
  location: primary.business.lat_lng,
  radius_meters: radius_miles * 1609.34,
  keyword: primary_keyword,
  type: googleTypeForVertical(primary.vertical.inferred_vertical),
});
```

Google's Nearby Search returns results ranked by Google's local algorithm — the same ranking that determines who shows up in the Local Pack for that keyword. This is exactly the ranking we care about.

**Step 4: Filter candidates**

Remove from results:
- The primary business itself (match by `place_id`)
- Permanently closed businesses (`business_status !== 'OPERATIONAL'`)
- Businesses with zero reviews (no signal, audit comparison would be meaningless)
- Anything in `options.exclude_place_ids`

**Step 5: Take top N**

Default N = 5. Take the first 5 from the filtered list. These are the businesses Google considers your client's actual competitors for the search query they care about.

**Step 6: Parallel fetch**

For each of the 5 competitors:
- Fetch `AuditGoogleData` via Session 1 with `tier: 'free'` (always — never pay Outscraper for competitor full history)
- Fetch `AuditPlatformsData` via Session 2 with `tier: 'free'` ONLY if `tier === 'paid'` (free-tier audits don't show competitor cross-platform data in Section 5; only Google data)

All 5 competitors fetched in parallel with `Promise.allSettled`. Total time should be 2–4 seconds for 5 competitors.

**Step 7: Compute aggregate stats**

After all competitors are fetched, compute the `competitor_aggregate` block. These are the numbers that feed Section 4's "money on the table" calculation and Section 6's Do-Nothing projection.

### 3.5 Cost & rate limiting

**Per competitor (free tier of the audit):**
- 1 Place Details call ≈ $0.017
- 0 Outscraper calls
- Total: ~$0.02

**Per competitor (paid tier of the audit):**
- 1 Place Details call ≈ $0.017
- 4 Outscraper calls (yelp/zocdoc/healthgrades/facebook lookup + 5 reviews each) ≈ $0.10
- Total: ~$0.12

**Per audit:**
- Free: ~$0.10 for 5 competitors (negligible)
- Paid: ~$0.60 for 5 competitors

Plus Session 1+2 cost for the primary business. Aggregate paid-tier audit cost: **$3–10**, gross margin on $299 audit: ~97%.

**Rate limiting:**
- Google Place Details and Nearby Search: 100 QPS — well within limits even when fetching 5 competitors in parallel
- Outscraper: 20 QPS — also fine

Implement a simple in-process token bucket if QPS becomes an issue at scale, but Session 3 doesn't need this.

### 3.6 File structure

```
/baam-review/audit-engine/competitors/
├── src/
│   ├── index.ts                          # getCompetitorsData
│   ├── types.ts
│   ├── keyword-resolver.ts               # vertical → search keyword
│   ├── radius-resolver.ts                # zip → search radius
│   ├── nearby-search-client.ts           # Google Maps Nearby Search
│   ├── competitor-filter.ts              # filter logic
│   ├── parallel-fetcher.ts               # orchestrate Sessions 1+2 in parallel
│   └── aggregator.ts                     # compute competitor_aggregate stats
├── tests/
```

### 3.7 Session 3 acceptance criteria

1. `getCompetitorsData(drHuangData, 'paid')` returns 5 competitors with non-null `platforms` data
2. Same call with `'free'` returns 5 competitors with `platforms: null`
3. Each competitor has rank (1–5) reflecting Google's local ranking order
4. `competitor_aggregate.velocity_gap_vs_primary` is correctly computed
5. Primary business is never returned as its own competitor (place_id filter works)
6. Closed competitors are filtered out
7. Search radius adapts based on zip-code density (test with NYC zip vs suburban zip)
8. Total fetch time for 5 paid-tier competitors ≤ 8 seconds
9. All unit tests pass; integration tests pass against live APIs

---

## 4. Shared Improvements That Land in Sessions 2+3

These refactors come up naturally while building Sessions 2+3 and should be applied:

### 4.1 Extract `OutscraperBaseClient`

Session 1's `outscraper-client.ts` for Google Reviews is one of N Outscraper integrations. Refactor to a base class with platform-specific subclasses:

```ts
abstract class OutscraperBaseClient {
  protected apiKey: string;
  protected baseUrl = 'https://api.app.outscraper.com';

  protected async request<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    // shared auth, retry logic, error handling
  }
}

class GoogleReviewsClient extends OutscraperBaseClient {
  async fetchReviews(placeId: string, options: { limit?: number }): Promise<RawReview[]> { ... }
}

class YelpReviewsClient extends OutscraperBaseClient {
  async fetchReviews(yelpUrl: string, options: { limit?: number }): Promise<RawReview[]> { ... }
}

// ...etc for Zocdoc, Healthgrades, Facebook
```

This refactor should happen at the start of Session 2, retroactively cleaning up Session 1's code.

### 4.2 Move review normalization into shared utility

Both Sessions 1 and 2 normalize reviews from different raw shapes into the unified `Review` type. The mapping logic (raw fields → `Review`) is platform-specific, but downstream operations (language detection, response time calculation, windowing) are identical.

Move the downstream operations into `/shared/review-utils.ts`:

```ts
export function enrichReview(raw: PartialReview): Review {
  return {
    ...raw,
    language: detectLanguage(raw.text),
    owner_response_time_hours: computeResponseTime(raw),
  };
}
```

Each platform's normalizer ends with `reviews.map(enrichReview)`.

### 4.3 Unified `AuditDataError` extensions

Sessions 2+3 should extend Session 1's error hierarchy rather than inventing new patterns:

```ts
export class YelpLookupFailedError extends AuditDataError { ... }
export class ZocdocLookupFailedError extends AuditDataError { ... }
// ...etc

export class CompetitorSearchEmptyError extends AuditDataError {
  constructor(keyword: string, radius: number) {
    super(`No competitors found for "${keyword}" within ${radius} miles`, 'NO_COMPETITORS', false);
  }
}
```

`CompetitorSearchEmptyError` is interesting — for hyper-niche businesses (immigration lawyer in a small town), Google Nearby Search may return only the primary business and nothing else. The audit needs to handle this gracefully — show Section 5 as "Your market has no comparable competitors within {radius} miles" rather than an empty table.

---

## 5. Open Questions for Confirmation

1. **Legal/immigration vertical platforms:** Sessions 2 doesn't include Avvo or Martindale. Two options: (a) include them as Session 2B mini-extension, (b) defer to a later "Legal Vertical" specialty session. My recommendation: **defer**. Avvo's data is notoriously hard to scrape consistently, and the legal vertical may warrant its own treatment given the stricter advertising rules around attorney reviews.

2. **Restaurant cuisine refinement:** Should Session 3 attempt to detect cuisine type and use it in the competitor keyword? "Chinese restaurant Flushing" vs "restaurant Flushing" yields very different competitor sets. My recommendation: **yes, but as a soft refinement.** If we detect cuisine confidently from Google secondary categories, use it; otherwise fall back to generic.

3. **Competitor count — exactly 5, or 3–5 flexible?** Current spec says "take top 5." But in dense areas, top 5 may all be near-identical clones; in rural areas, top 5 may include some weak matches. Allow 3–5 with quality threshold (only include competitors with ≥10 reviews)?

4. **Caching for competitors:** Should competitor data cached for one audited business be reusable when auditing a DIFFERENT business that has overlapping competitors? Example: auditing "Modern TCM" and "Wei Lin Acupuncture" — both would pull "Flushing Acupuncture Center" as a competitor. Cache by competitor place_id allows reuse. Recommend: **yes, cache competitors independently** by their own place_id.

5. **Density lookup table scope:** Hardcoding NYC-metro zip codes is enough for current BAAM clientele. National coverage would require a 40,000-zip lookup table. Recommendation: **NYC metro only for Session 3**; expand when geographic scope expands.

---

## 6. What Sessions 4+ Build on Sessions 2+3

- **Session 4 (Benchmarks):** consumes `AuditCompetitorsData.competitor_aggregate.avg_velocity_30d_per_month` for the "money on the table" computation in Section 4 of the audit. Also uses competitor count + ratings for vertical median calibration.

- **Session 5 (Scoring):** the critical floor rule needs `primary.reviews_aggregate.last_review_days_ago`. The volume sub-score normalizes against `competitor_aggregate.median_review_count` rather than a static vertical median.

- **Session 6 (Projection):** the Do-Nothing decay model uses `competitor_aggregate.avg_velocity_30d_per_month` as the "competitor compounding" input. The 6-month projected score for the primary business diverges from competitors at their measured rate.

- **Session 8 (Templating):** Section 5 of the audit (Competitor Comparison table) renders directly from `AuditCompetitorsData.competitors[]`. The "what the leader is doing differently" diagnosis paragraph is generated from comparing the top competitor's stats vs the primary.

---

## 7. Implementation Order

**Session 2 first**, then Session 3. Session 3 depends on Session 2 being callable.

Within Session 2, suggested order:
1. Extract `OutscraperBaseClient` from Session 1
2. Build `yelp/client.ts` + normalizer first (highest-value platform, simplest schema)
3. Build `facebook/client.ts` + normalizer (similar simplicity, broad relevance)
4. Build `zocdoc/client.ts` + normalizer (medical-specific, narrower applicability)
5. Build `healthgrades/client.ts` + normalizer (parallel to Zocdoc)
6. Wire `index.ts` to orchestrate all four in parallel with platform-relevance filtering
7. Test against real data for a medical business (uses all 4 platforms)
8. Test against real data for a non-medical business (uses 2 platforms)

Within Session 3:
1. `keyword-resolver.ts` — pure function, easy first win
2. `radius-resolver.ts` — pure function with hardcoded zip table
3. `nearby-search-client.ts` — wraps Google Nearby Search
4. `competitor-filter.ts` — pure function
5. `parallel-fetcher.ts` — orchestrate Sessions 1+2 with `Promise.allSettled`
6. `aggregator.ts` — compute summary stats
7. `index.ts` — wire it all together
8. End-to-end test: given a real business, return 5 competitors with full data

---

## 8. Timing Estimate

**Session 2:** 3–4 Claude Code sessions to implement, 1 session to test against real Outscraper data, 1 session to debug platform-specific edge cases (especially Facebook page disambiguation). Total: **5–6 Claude Code sessions over 1–2 weeks**.

**Session 3:** 2 Claude Code sessions to implement (most code reuses Sessions 1+2), 1 session to tune the competitor identification heuristics with real data. Total: **3 Claude Code sessions over 3–5 days**.

After Sessions 2+3 ship, you have a working data pipeline that produces real audit data for any NYC-metro business. That's the moment to write Sessions 4+5 (benchmarks + scoring), because by then you'll have empirical data on what real competitor velocity distributions actually look like — which will make the scoring rubric calibration much sharper.

---

## 9. After Sessions 2+3 Ship — Decision Point

You'll have:
- Full multi-platform data for any primary business
- 5 real competitors per primary, with their data
- Empirical evidence on Outscraper reliability, cost, latency

Three possible next moves at that point — pick based on what you learn:

**Option A: "Ship a free competitor-comparison tool now"** — package what Sessions 1+2+3 produce as a standalone free product. "Get a free side-by-side comparison of your business vs your 5 closest competitors." Lead gen for BAAM Review proper. No scoring required, no benchmarks — just data presented well.

**Option B: "Continue the audit build"** — write Sessions 4+5 specs (benchmarks + scoring) and build the full scored audit.

**Option C: "Calibrate first"** — run Sessions 1+2+3 against 20 real BAAM-prospect businesses, then use that empirical data to refine the benchmark + scoring spec before writing Sessions 4+5.

My recommendation: **C**, then **B**. Twenty real audits' worth of data lets you write a far better scoring rubric than my current spec assumptions. The investment is ~$60 in API costs and 2–3 hours of running the tool against real businesses. Worth it.

But that's a decision for after Sessions 2+3 ship. For now, just hand this spec to Claude Code and watch what happens.
