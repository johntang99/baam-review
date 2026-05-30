# Session 1 · Google Business Data Acquisition

**Build target:** A backend service that takes a business reference and returns a normalized JSON object containing every data field the audit template needs from Google.

**This is Session 1 of approximately 13 sessions** to build the full BAAM Review Audit engine. Subsequent sessions extend this foundation; nothing in Session 1 is throwaway code.

---

## 1. Architectural Anchors (decisions already made)

These constraints frame everything below. Don't relitigate them mid-implementation.

1. **Dynamic data, no hardcoded businesses.** The design HTML samples used "Dr. Huang Acupuncture" as a worked example. Production code never references her. All business data flows through `BusinessReference` inputs. Test fixtures may use Dr. Huang explicitly as a test case, but only inside `/tests/fixtures/`.

2. **Bilingual output for Chinese-name businesses.** The data layer is language-agnostic. The rendering layer produces both EN and ZH PDFs in parallel when the business is detected as Chinese-primary. Detection rules (from framework v3): business name contains CJK characters, Google Business Profile registered in Chinese, ≥20% of reviews in Chinese, or website has Chinese version.

3. **Two tiers, both signup-gated:**
   - **Free Report** — requires signup (email + password OR Google OAuth). Limited data scope. Sections 1, 2, 3 of audit only.
   - **Paid Full Report** — requires signup + Stripe payment. Full data scope. All 7 pages including appendix.

   Session 1 exposes a `tier: 'free' | 'paid'` parameter that scopes data fetching. Signup/payment flows are Session 10. Session 1 just respects the parameter.

---

## 2. What This Session Builds

A TypeScript module that exposes one primary function:

```ts
export async function getGoogleBusinessData(
  input: BusinessReference,
  tier: 'free' | 'paid'
): Promise<AuditGoogleData>
```

Given a business reference (place ID, or text query like "Modern TCM Center, Flushing NY"), this function returns everything the audit needs from Google: profile metadata, profile health flags, full review history (paid) or recent reviews (free), and aggregate metrics with windowed velocity calculations.

**It does not score.** It does not detect competitors. It does not fetch from Yelp or any other platform. It produces a single normalized JSON shape for Google data only.

---

## 3. Scope Boundaries

### IN scope for Session 1
- Google Maps Place Details API integration (basic profile + 5 most recent reviews)
- Outscraper API integration for full review history (paid tier only)
- Place text search → Place ID resolution
- Photos count fetch
- Data normalization from raw API responses to `AuditGoogleData` schema
- Windowed review aggregation (30/180/365-day counts and per-month velocity)
- Language detection on review text
- Tier-aware scope limiting
- Supabase caching layer with TTL
- Comprehensive error handling
- Type-safe end to end

### OUT of scope for Session 1 (later sessions)
- Yelp / Zocdoc / Healthgrades / Facebook data — **Session 2**
- Competitor identification + parallel fetches — **Session 3**
- Vertical-specific benchmark lookup — **Session 4**
- Score calculation (5 components + critical floor rule) — **Session 5**
- Do-Nothing projection model — **Session 6**
- AI analysis (sentiment, themes) — **Session 7**
- PDF generation from HTML templates — **Session 8**
- Language detection logic for full-document EN/ZH routing — **Session 9**
- Signup, Stripe payment, OAuth flows — **Session 10**
- Free tier audit flow (landing → form → email delivery) — **Session 11**
- Paid tier audit flow (Stripe → intake → walkthrough booking) — **Session 12**
- Full Service onboarding integration — **Session 13**

---

## 4. Dependencies & Setup

### Google Cloud
1. Create or reuse a Google Cloud project for BAAM Review
2. Enable APIs:
   - **Places API (New)** — Place Details, Place Photos, Text Search
   - **Maps JavaScript API** (for future map embeds, optional Session 1)
3. Create an API key restricted to:
   - Places API (New)
   - HTTP referrer restriction: baamreview.com domain + localhost for dev
   - Daily quota cap: start at 1,000 calls/day (~$17/day max spend)
4. Store as env var: `GOOGLE_MAPS_API_KEY`

### Outscraper (for paid tier full review history)
1. Sign up at outscraper.com
2. Generate API key with Google Reviews API access
3. Store as env var: `OUTSCRAPER_API_KEY`
4. Budget: ~$5–15 per paid audit (200–1500 reviews × $0.001 + base fees)

**Important risk note:** Outscraper depends on Google's terms of service tolerating scraping. If Outscraper breaks or changes pricing, fallback path is Google Business Profile API with OAuth (requires the business owner to authorize). Build the abstraction to allow swapping later.

### Supabase
Create new table `audit_business_data`:
```sql
CREATE TABLE audit_business_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'paid')),
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  data_source TEXT NOT NULL,
  CONSTRAINT unique_place_tier UNIQUE (place_id, tier)
);
CREATE INDEX idx_audit_business_data_place_id ON audit_business_data (place_id);
CREATE INDEX idx_audit_business_data_expires ON audit_business_data (expires_at);
```

TTL strategy:
- Free tier: 7 days (data doesn't change fast for basic info)
- Paid tier: 24 hours (more aggressive freshness for paying customers)

### Environment variables
```
GOOGLE_MAPS_API_KEY=
OUTSCRAPER_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NODE_ENV=development|production
```

### Package versions
- `next@latest` (BAAM platform is already on Next.js)
- `@supabase/supabase-js@^2`
- `franc-min` for language detection (lightweight, supports CJK)
- `zod@^3` for runtime schema validation
- `vitest` for tests

---

## 5. File Structure

```
/baam-review/audit-engine/google/
├── src/
│   ├── index.ts                          # Public API entry
│   ├── types.ts                          # Shared types
│   ├── normalizers/
│   │   └── google-normalizer.ts          # Raw → AuditGoogleData
│   ├── clients/
│   │   ├── place-details-client.ts       # Google Place Details API
│   │   ├── place-search-client.ts        # Google Text Search API
│   │   └── outscraper-client.ts          # Outscraper Reviews API
│   ├── aggregators/
│   │   ├── review-aggregator.ts          # Windowed counts + velocity
│   │   ├── language-detector.ts          # franc-min wrapper
│   │   └── profile-health-evaluator.ts   # Health flag calculator
│   ├── cache/
│   │   └── supabase-cache.ts             # TTL-based cache layer
│   ├── errors.ts                         # Error classes
│   └── config.ts                         # Env var parsing
├── tests/
│   ├── fixtures/
│   │   ├── dr-huang-place-details.json   # Test fixture (the ONLY place Dr. Huang appears)
│   │   ├── dr-huang-outscraper.json
│   │   └── modern-tcm-place-details.json
│   ├── unit/
│   │   ├── google-normalizer.test.ts
│   │   ├── review-aggregator.test.ts
│   │   └── language-detector.test.ts
│   └── integration/
│       ├── place-details.test.ts          # Hits real API in CI
│       └── full-flow.test.ts
├── README.md
└── package.json
```

---

## 6. Public API · `getGoogleBusinessData`

### Signature
```ts
export async function getGoogleBusinessData(
  input: BusinessReference,
  tier: 'free' | 'paid'
): Promise<AuditGoogleData>
```

### Input schema
```ts
export interface BusinessReference {
  // Provide ONE of:
  placeId?: string;             // preferred — direct lookup, no search needed
  textQuery?: string;            // fallback — e.g., "Modern TCM Center Flushing NY"

  // Optional metadata
  expectedLanguages?: string[];  // ['en', 'zh'] — affects review language filtering
  forceRefresh?: boolean;        // bypass cache
}
```

### Resolution logic
1. If `placeId` provided: skip search, go directly to detail fetch
2. If `textQuery` provided: hit Place Text Search API, take first result's `place_id`, then fetch details
3. If both provided: `placeId` wins
4. If neither: throw `InvalidBusinessReferenceError`

### Tier-scoped behavior
| Capability | Free | Paid |
|---|---|---|
| Place Details fetch | ✓ | ✓ |
| 5 most recent reviews | ✓ | ✓ |
| Full review history (Outscraper) | ✗ | ✓ |
| 30-day review count | Estimated from 5 most recent | Exact |
| 6-month, 12-month windows | Returned as `null` | Exact |
| Owner response rate | Returned as `null` | Calculated |
| Median response time | Returned as `null` | Calculated |
| Language distribution | Partial (5 reviews) | Full corpus |
| Photos count | ✓ | ✓ |
| Profile health flags | ✓ | ✓ |

When free tier returns `null` for windowed metrics, the audit template gracefully degrades (shows "—" or "Upgrade for full velocity analysis" inline). Session 8 handles this.

---

## 7. Output Schema · `AuditGoogleData`

Complete type definition (also export as Zod schema for runtime validation):

```ts
export interface AuditGoogleData {
  business: {
    name: string;                      // primary display name
    name_secondary?: string;           // alt-language name if detected
    formatted_address: string;
    address_lines: string[];           // for multi-line cover display
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    place_id: string;
    business_url: string;              // GBP listing URL
    website?: string;                  // business's own website
    phone?: string;
  };

  vertical: {
    google_categories: string[];       // raw Google types
    primary_category: string;
    inferred_vertical: VerticalKey;    // mapped to BAAM vertical taxonomy
    confidence: number;                // 0–1
  };

  language: {
    primary_language: 'en' | 'zh' | 'other';
    is_bilingual: boolean;             // ≥20% reviews in non-primary language
    is_chinese_business: boolean;      // triggers ZH default + dual-output
    detection_signals: {
      name_has_cjk: boolean;
      gbp_locale: string;
      review_language_distribution: Record<string, number>;
    };
  };

  profile_health: {
    is_claimed: boolean;
    is_verified: boolean;
    has_hours: boolean;
    has_phone: boolean;
    has_website: boolean;
    has_categories: boolean;
    has_description: boolean;
    photos_count: number;
    profile_completeness: number;      // 0–100, computed
  };

  reviews_aggregate: {
    total_count: number;
    rating: number;
    last_review_date: string | null;   // ISO 8601
    last_review_days_ago: number | null;

    // Window counts (null on free tier except 30-day estimate)
    reviews_30d: number | null;
    reviews_90d: number | null;
    reviews_180d: number | null;
    reviews_365d: number | null;

    // Per-month velocity (derived)
    velocity_30d_per_month: number | null;
    velocity_180d_per_month: number | null;
    velocity_365d_per_month: number | null;

    // Engagement (paid only)
    response_rate: number | null;      // 0–1
    response_time_median_hours: number | null;
    unanswered_count: number | null;

    // Sentiment (paid only — placeholder for Session 7)
    photo_review_count: number | null;
  };

  reviews: Review[];                   // 5 (free) or full history (paid)

  meta: {
    fetched_at: string;                // ISO 8601
    expires_at: string;
    data_source: 'place_details' | 'place_details_plus_outscraper';
    tier: 'free' | 'paid';
    cache_hit: boolean;
  };
}

export interface Review {
  author_name: string;
  author_avatar_url?: string;
  rating: number;                      // 1–5
  text: string;
  language: string;                    // ISO code, detected
  relative_time_description?: string;
  timestamp: string;                   // ISO 8601
  has_owner_response: boolean;
  owner_response_text?: string;
  owner_response_timestamp?: string;
  owner_response_time_hours?: number;
}

export type VerticalKey =
  | 'tcm_clinic'
  | 'dental'
  | 'legal_immigration'
  | 'restaurant'
  | 'real_estate'
  | 'hotel'
  | 'auto'
  | 'contractor'
  | 'salon_spa'
  | 'cafe'
  | 'apparel'
  | 'health_food'
  | 'insurance'
  | 'general_smb';
```

### Why this exact shape

Every field maps to a specific element in the audit design:

| Schema field | Audit element |
|---|---|
| `business.name`, `name_secondary` | Cover meta — Business column |
| `business.address_lines` | Cover meta — Location column |
| `vertical.inferred_vertical` | Cover meta — Vertical column; benchmark lookup in Section 4; appendix highlight row |
| `language.is_chinese_business` | Triggers dual EN+ZH rendering |
| `profile_health.*` | Section 2 snapshot table — Profile Health column |
| `reviews_aggregate.rating` | Section 2 — Rating column; Section 3 — Rating Quality sub-score |
| `reviews_aggregate.total_count` | Section 2 — Reviews column; Section 3 — Review Volume sub-score |
| `reviews_aggregate.velocity_30d_per_month` | Section 3 — 30-day velocity sub-score; "1.0/mo" display |
| `reviews_aggregate.velocity_180d_per_month` | Section 3 — 6-month velocity sub-score; "1.67/mo avg" display |
| `reviews_aggregate.velocity_365d_per_month` | Section 3 — 12-month velocity sub-score; "2.5/mo avg" display |
| `reviews_aggregate.last_review_days_ago` | Section 2 — Last Review column; critical floor rule trigger |
| `reviews_aggregate.response_rate`, `unanswered_count` | Section 6 — Action ii and iv calculations |

Anything in the audit design that ISN'T mapped to a field here comes from another data source (other platforms in Session 2, competitors in Session 3, benchmarks in Session 4) and not Google.

---

## 8. API Integration Details

### Google Place Details API

**Endpoint:** `GET https://maps.googleapis.com/maps/api/place/details/json`

**Required fields parameter** (comma-separated, in this exact order to make billing predictable):
```
place_id,name,formatted_address,address_components,formatted_phone_number,
website,opening_hours,types,business_status,url,
user_ratings_total,rating,reviews,photos
```

**Critical limitation:** This endpoint returns at most **5 reviews**, always the most recent. There's no parameter to expand this. This is the reason we layer Outscraper on top for paid tier.

**Rate limits:**
- 100 QPS hard limit
- Daily quota set in console (start at 1,000/day)

**Cost** (as of 2026):
- Basic Data SKU: free
- Contact + Atmosphere Data SKU: ~$17 per 1,000 calls (we hit this because of reviews/photos)

**Implementation notes:**
- Use the `language` parameter to get localized review text. For BAAM, set `language=en` always; we detect actual review language ourselves via `franc-min`. Google's `language` param affects translation behavior, not source language.
- Handle `OVER_QUERY_LIMIT` and `REQUEST_DENIED` gracefully — retry once with exponential backoff, then surface to caller.

### Google Place Text Search API

**Endpoint:** `GET https://maps.googleapis.com/maps/api/place/textsearch/json`

**Use:** When user provides a text query instead of place_id.

**Params:**
- `query`: the text query
- `region`: 'us' (default for BAAM market)
- `language`: 'en'

**Response handling:** Take the first result. If `status !== 'OK'`, throw `BusinessNotFoundError`. If multiple plausible results, log warning but proceed with first; future session may add disambiguation UI.

### Outscraper Google Reviews API

**Endpoint:** `GET https://api.app.outscraper.com/maps/reviews-v3`

**Params:**
- `query`: place_id (preferred) or business URL
- `reviewsLimit`: 1000 (effectively all reviews)
- `sort`: 'newest'
- `language`: 'en' (returns all languages regardless; we detect)
- `async`: false (synchronous response for simplicity in audit context)

**Response:** Array of review objects with author, rating, text, timestamp, owner_response. Schema documented at outscraper.com.

**Cost:** ~$0.001 per review + $0.005 per request base. For a 300-review business: ~$0.31. Across paid audit including 5 competitors at 300 reviews each: ~$2.

**Rate limits:** 20 requests per second; 10,000 reviews per request max.

**Error handling:** Outscraper API failures should NOT fail the entire audit. If Outscraper fails on paid tier, return data from Place Details with `meta.data_source = 'place_details'` and a flag in meta noting the degradation. Log to monitoring. The audit template handles this gracefully.

---

## 9. Aggregator Logic

### `review-aggregator.ts`

Given an array of reviews with timestamps, computes the windowed counts:

```ts
export interface ReviewAggregates {
  total_count: number;
  reviews_30d: number;
  reviews_90d: number;
  reviews_180d: number;
  reviews_365d: number;
  velocity_30d_per_month: number;     // reviews_30d
  velocity_180d_per_month: number;    // reviews_180d / 6
  velocity_365d_per_month: number;    // reviews_365d / 12
  last_review_date: string | null;
  last_review_days_ago: number | null;
  response_rate: number;
  unanswered_count: number;
  response_time_median_hours: number | null;
}

export function aggregateReviews(
  reviews: Review[],
  asOf: Date = new Date()
): ReviewAggregates
```

**Windowing rule:** A review counts in a window if `(asOf - review.timestamp) <= window_days`. Use inclusive comparison.

**Velocity per-month formula:**
- 30-day: `reviews_30d / 1`
- 180-day: `reviews_180d / 6`
- 365-day: `reviews_365d / 12`

(Confirmed against the audit design's sub-score values for Dr. Huang: 1 review past 30d → 1.0/mo; 10 reviews past 180d → 1.67/mo; 30 reviews past 365d → 2.5/mo.)

**Response time:** For each review with owner response, compute `(owner_response_timestamp - review.timestamp)` in hours. Take median across all responded reviews. Returns `null` if zero responses.

### `language-detector.ts`

Wraps `franc-min`. Returns ISO 639-1 codes mapped from the franc 3-letter output. Specifically:
- `cmn` (Mandarin) → `'zh'`
- `eng` → `'en'`
- `spa` → `'es'`
- ...etc
- Unknown / undefined → `'other'`

Detect per-review, then aggregate to `language_distribution: Record<string, number>` (percentages).

### `profile-health-evaluator.ts`

Given raw Place Details response, computes:
```ts
{
  is_claimed: response.business_status === 'OPERATIONAL' && response.url != null,
  has_hours: !!response.opening_hours?.periods?.length,
  has_phone: !!response.formatted_phone_number,
  has_website: !!response.website,
  has_categories: response.types && response.types.length > 1,
  has_description: false,   // Place Details doesn't expose; always false in Session 1
  photos_count: response.photos?.length ?? 0,
  profile_completeness: <computed 0-100>
}
```

**Completeness formula** (5 binary flags, each worth 20 points): claimed + hours + phone + website + categories.

### Vertical mapper

`vertical-mapper.ts` — given Google's `types` array, map to BAAM `VerticalKey`:

```ts
const GOOGLE_TYPE_TO_VERTICAL: Array<[string[], VerticalKey]> = [
  [['acupuncture', 'traditional_chinese_medicine', 'chinese_medicine'], 'tcm_clinic'],
  [['dentist', 'dental_clinic'], 'dental'],
  [['lawyer', 'attorney'], 'legal_immigration'],
  [['restaurant', 'meal_takeaway', 'meal_delivery'], 'restaurant'],
  [['real_estate_agency'], 'real_estate'],
  [['lodging', 'hotel'], 'hotel'],
  [['car_dealer', 'car_repair'], 'auto'],
  [['general_contractor', 'roofing_contractor'], 'contractor'],
  [['beauty_salon', 'spa', 'hair_care'], 'salon_spa'],
  [['cafe', 'coffee_shop'], 'cafe'],
  [['clothing_store'], 'apparel'],
  [['health_food_store'], 'health_food'],
  [['insurance_agency'], 'insurance'],
];
// Fallback: 'general_smb'
```

Confidence: 1.0 if a direct match, 0.5 if multiple categories match different verticals (use the more specific), 0.0 if fallback.

---

## 10. Caching Strategy

### Read path
1. Compute cache key: `${place_id}:${tier}`
2. Query `audit_business_data` for matching row where `expires_at > NOW()`
3. If hit and `!forceRefresh`: return cached data with `meta.cache_hit = true`
4. If miss: proceed to fetch

### Write path
After successful fetch + normalization:
1. Compute `expires_at`:
   - Free tier: `NOW() + 7 days`
   - Paid tier: `NOW() + 24 hours`
2. Upsert into `audit_business_data` (conflict resolution: replace on `(place_id, tier)`)

### Bypass conditions
- `forceRefresh: true` in input
- Paid tier audit being re-run within the same audit session (Session 13 spec — Day-90 re-audit feature)

---

## 11. Error Handling

Define a clean error hierarchy:

```ts
export class AuditDataError extends Error {
  constructor(message: string, public code: string, public retryable: boolean) {
    super(message);
  }
}

export class InvalidBusinessReferenceError extends AuditDataError {
  constructor() { super('Provide placeId or textQuery', 'INVALID_REF', false); }
}

export class BusinessNotFoundError extends AuditDataError {
  constructor(query: string) { super(`No business found for "${query}"`, 'NOT_FOUND', false); }
}

export class GoogleApiError extends AuditDataError {
  constructor(status: string, message: string) {
    super(`Google API error: ${status} — ${message}`, 'GOOGLE_API', status === 'OVER_QUERY_LIMIT');
  }
}

export class OutscraperError extends AuditDataError {
  constructor(message: string) {
    super(`Outscraper failure: ${message}`, 'OUTSCRAPER', true);
  }
}

export class CacheError extends AuditDataError {
  constructor(message: string) { super(`Cache error: ${message}`, 'CACHE', true); }
}
```

### Retry policy
- Retryable errors: 1 retry with 1 second backoff, then 1 retry with 3 second backoff, then fail
- Non-retryable: surface immediately

### Outscraper degradation
If Outscraper fails on a paid-tier request, do NOT fail the entire request. Return Place Details data with `meta.data_source = 'place_details'` and add `meta.degraded: { outscraper_failed: true, reason: '...' }`. Log to monitoring.

---

## 12. Test Strategy

### Unit tests (deterministic, no API calls)
- `review-aggregator.test.ts`:
  - Given Dr. Huang fixture (300 reviews across 5 years), produces correct windowed counts and velocities
  - Given empty review array, produces zeros
  - Given single review 45 days ago, `reviews_30d = 0`, `reviews_180d = 1`
  - As-of date parameter correctly shifts windows
- `language-detector.test.ts`:
  - Chinese review text → 'zh'
  - English review text → 'en'
  - Mixed-language paragraph → primary language detected
- `vertical-mapper.test.ts`:
  - `['acupuncture', 'health']` → `tcm_clinic` with confidence 1.0
  - `['establishment']` only → `general_smb` with confidence 0.0
  - Multi-vertical match → most specific wins
- `profile-health-evaluator.test.ts`:
  - All flags present → completeness 100
  - No hours, no website → completeness 60

### Integration tests (real API, CI-only with secrets)
- `place-details.test.ts`:
  - Fetch known place ID (use a public landmark, not a real client) → returns valid AuditGoogleData
  - Invalid place ID → throws `BusinessNotFoundError`
- `full-flow.test.ts`:
  - End-to-end with text query → cached on second call

### Fixtures
- `/tests/fixtures/dr-huang-place-details.json` — sanitized real response with our test business
- `/tests/fixtures/dr-huang-outscraper.json` — same business, full review history
- Reviewers should be anonymized in fixtures (replace author names with generic strings)

---

## 13. Acceptance Criteria

Session 1 is complete when:

1. `getGoogleBusinessData({ placeId: 'ChIJ...' }, 'free')` returns valid `AuditGoogleData` with all required free-tier fields populated
2. Same call with `'paid'` populates windowed velocity fields (not null) and full reviews array
3. `getGoogleBusinessData({ textQuery: 'Modern TCM Center Flushing NY' }, 'paid')` resolves to a valid result
4. Cache hits return identical data with `meta.cache_hit = true` and ~10x faster
5. Cache expiration honored — stale data fetched again
6. Outscraper failure on paid tier gracefully degrades to Place Details with `meta.degraded` flag
7. Invalid input throws appropriate typed error
8. All unit tests pass; integration tests pass against live API in CI
9. Code passes TypeScript strict mode; no `any` types in public API
10. Zod schema validates the output of every public function call

---

## 14. What Sessions 2 Onward Build on This

- **Session 2 (Multi-platform):** Mirrors this exact pattern for Yelp, Zocdoc, Healthgrades, Facebook. Same `BusinessReference` input, same tier scoping, parallel `AuditYelpData`, `AuditZocdocData`, etc. outputs. Each platform gets its own normalizer; all results merge into `AuditPlatformsData`.

- **Session 3 (Competitors):** Given a primary `AuditGoogleData`, identifies 3–5 competitors via Maps Nearby Search filtered by vertical, then calls `getGoogleBusinessData` (and Session 2's equivalents) for each competitor in parallel. Output: `AuditCompetitorsData`.

- **Session 4 (Vertical benchmarks):** Reads vertical from `AuditGoogleData.vertical.inferred_vertical` and looks up per-review value + healthy velocity from the static benchmark tables (sourced from baamreview.com/review-value.html).

- **Session 5 (Scoring):** Consumes `AuditGoogleData` + `AuditPlatformsData` + benchmarks. Produces `AuditScore` with 5 sub-scores, total, grade, critical floor rule applied.

- **Session 6 (Projection):** Consumes `AuditScore` + competitor velocity from Session 3. Produces `AuditProjection` with 6-month decay model + revenue impact.

- **Session 8 (Templating):** Consumes all the above + chooses EN, ZH, or both based on `AuditGoogleData.language.is_chinese_business`. Renders HTML, converts to PDF.

- **Session 10 (Auth + tiers):** Wraps the data layer with user session + Stripe payment gates. The tier parameter passed to `getGoogleBusinessData` comes from the authenticated user's audit purchase state.

---

## 15. Implementation Order Within Session 1

Suggested order to minimize rework:

1. Set up project structure, env vars, package.json
2. Define all types in `types.ts` + Zod schemas
3. Implement `config.ts` with env var parsing + validation
4. Implement `place-details-client.ts` with mocked responses first
5. Implement `language-detector.ts` and `vertical-mapper.ts` (pure functions, easy to test)
6. Implement `review-aggregator.ts` (pure function)
7. Implement `profile-health-evaluator.ts` (pure function)
8. Implement `google-normalizer.ts` that wires the above together
9. Implement `place-search-client.ts`
10. Implement `outscraper-client.ts`
11. Implement `supabase-cache.ts`
12. Implement `index.ts` public API that orchestrates everything
13. Write tests against fixtures, then integration tests against live APIs
14. Document in README with example calls

---

## 16. Open Questions for Confirmation Before Implementation

1. **Auth model for Outscraper key:** the `OUTSCRAPER_API_KEY` is BAAM's API key, billed to BAAM. Confirm this is acceptable (alternative: per-client keys, but adds complexity for negligible benefit).

2. **Cache TTL values:** 7 days free / 24 hours paid — confirm or adjust.

3. **Fallback when Place Details has zero reviews:** current behavior is to return all aggregates as zero/null. Should we instead refuse to generate an audit for businesses with zero reviews? (Probably yes — audit becomes meaningless. Surface as `BusinessHasNoReviewsError`.)

4. **Vertical mapper edge cases:** how to handle businesses whose primary Google type doesn't map to any BAAM vertical? Currently falls back to `general_smb`. Confirm this is fine, or define more verticals.

5. **Place Search disambiguation:** when text query returns multiple results, current behavior is to take the first. Confirm — vs raising a `MultipleBusinessesFoundError` and forcing the calling layer to ask the user to disambiguate.
