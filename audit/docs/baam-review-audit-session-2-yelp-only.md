# Session 2 · Yelp Data Acquisition (Updated)

**Build target:** Add Yelp data to the audit's snapshot (Section 2). One platform, not four — Yelp matters most across all verticals; Zocdoc/Healthgrades/Facebook are now deferred to Session 2B or later.

**Why this spec is updated:** the original Sessions 2+3 spec assumed Outscraper's Yelp Search API could resolve a business name → Yelp URL. That endpoint either doesn't work as documented or returns inconsistent results in production testing. This spec replaces that path with a Google-search workaround.

---

## 1. What Changed from the Original Sessions 2+3 Spec

The original spec assumed:

```ts
const yelpResult = await outscraper.yelpSearch({
  query: `${business.name} ${business.city} ${business.state}`,
});
```

This was supposed to return Yelp business profiles directly. In practice, Outscraper's Yelp Search either:
- Returns nothing
- Returns results with stale/incorrect business identifiers
- Has intermittent failures with no clear error semantics

The workaround documented in this spec uses Google's search results as a proxy:

```ts
// Step 1: Google search for "{business name} {city} site:yelp.com"
const yelpUrl = await extractYelpUrlFromGoogleSearch(business);

// Step 2: Outscraper fetches Yelp data from the URL directly
const yelpData = await outscraper.yelpReviewsFromUrl(yelpUrl);
```

This works because Google indexes Yelp pages reliably, and Outscraper's "fetch Yelp data from URL" endpoint is reliable when given a valid URL — the broken part was only the search/discovery step.

The other three platforms originally in Session 2 (Zocdoc, Healthgrades, Facebook) are **deferred** to Session 2B. Reason: each has the same discovery problem with no clean workaround. Solving them is meaningful work that can wait until after launch. Yelp alone covers most of the audit's value for Section 2.

---

## 2. Architectural Anchors

Carrying from prior sessions + new for Session 2:

1. **Single-platform scope.** This Session 2 produces `AuditYelpData`, not `AuditPlatformsData`. The original `AuditPlatformsData` shape is preserved for the future — it just has `yelp` populated and `zocdoc/healthgrades/facebook` set to `null` everywhere.

2. **Two-step resolution.** Yelp lookup is now Google search → URL extraction → Outscraper fetch. This adds latency (one Google search per audit) but reliability beats speed.

3. **Yelp data is always free-tier-equivalent in cost terms.** Even on paid audits, we fetch 5 most recent reviews from Yelp, not full history. Yelp's per-business reviews are smaller-impact than Google's; not worth the API cost to pull 100+ reviews per Yelp profile.

4. **Yelp absence is acceptable.** Many businesses, especially Chinese-vertical SMBs in Flushing, have weak or no Yelp presence. The audit template must handle `yelp: null` gracefully — show as "Not listed" with a soft CTA.

5. **Backwards-compatible output shape.** `AuditPlatformsData` keeps its existing schema. Yelp returns a populated `AuditPlatformData` object; the other three platforms remain `null` until Session 2B.

---

## 3. Public API

Unchanged from the original Sessions 2+3 spec:

```ts
export async function getAllPlatformsData(
  business: AuditGoogleData,
  tier: 'free' | 'paid'
): Promise<AuditPlatformsData>
```

The function still exists at the same path. Internally, it now only attempts Yelp; the other three platforms always return null.

```ts
// Internal implementation
export async function getAllPlatformsData(business, tier) {
  const yelpData = await safeYelpFetch(business, tier);
  
  return {
    yelp: yelpData,
    zocdoc: null,
    healthgrades: null,
    facebook: null,
    vertical_relevance: PLATFORM_VERTICAL_RELEVANCE[business.vertical.inferred_vertical],
    meta: {
      fetched_at: new Date().toISOString(),
      tier,
      platforms_attempted: ['yelp'],
      platforms_succeeded: yelpData ? ['yelp'] : [],
      platforms_not_found: yelpData ? [] : ['yelp'],
      platforms_errored: [],
      platforms_deferred: ['zocdoc', 'healthgrades', 'facebook'],  // NEW field
    },
  };
}
```

---

## 4. Yelp Resolution Algorithm

### 4.1 Step 1 — Google search for Yelp URL

Use Google's web search (via Outscraper's Google SERP API or direct Google Programmable Search):

```ts
async function findYelpUrlForBusiness(business: AuditGoogleData): Promise<string | null> {
  // Construct a precise search query
  const query = buildYelpSearchQuery(business);
  // Example: "Modern TCM Center" "Flushing" site:yelp.com
  
  const serpResults = await googleSearch({
    q: query,
    num: 5,        // top 5 results should include the right one if it exists
  });
  
  // Find first result that's a Yelp business profile URL
  for (const result of serpResults) {
    const yelpUrl = extractYelpBusinessUrl(result.link);
    if (yelpUrl && isProbableMatch(yelpUrl, business)) {
      return yelpUrl;
    }
  }
  
  return null;
}

function buildYelpSearchQuery(business: AuditGoogleData): string {
  // Quote-wrap business name to force exact match
  // Include city to disambiguate
  // Restrict to yelp.com via site: operator
  return `"${business.business.name}" "${business.business.city}" site:yelp.com`;
}

function extractYelpBusinessUrl(rawUrl: string): string | null {
  // Yelp business pages match: https://www.yelp.com/biz/{slug}
  // Reject other Yelp URLs (search pages, user profiles, /biz_photos/, etc.)
  const match = rawUrl.match(/^https:\/\/(?:www\.)?yelp\.com\/biz\/([a-z0-9\-]+)$/i);
  if (!match) return null;
  
  // Normalize to canonical form
  return `https://www.yelp.com/biz/${match[1]}`;
}

function isProbableMatch(yelpUrl: string, business: AuditGoogleData): boolean {
  // Extract slug from yelp URL
  const slug = yelpUrl.split('/biz/')[1];
  
  // Slugs are usually lowercase business name with city: "modern-tcm-center-flushing"
  // Confidence check: does the slug contain at least 2 significant words from business name?
  const businessWords = business.business.name
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)  // skip "the", "and", etc.
    .map(w => w.replace(/[^a-z0-9]/g, ''));
  
  const matchedWords = businessWords.filter(w => slug.includes(w));
  
  return matchedWords.length >= Math.min(2, businessWords.length);
}
```

### 4.2 Step 2 — Fetch Yelp data via Outscraper

Once we have a valid Yelp URL:

```ts
async function fetchYelpDataByUrl(
  yelpUrl: string,
  tier: 'free' | 'paid'
): Promise<RawYelpResponse> {
  const reviewLimit = tier === 'paid' ? 25 : 5;
  
  return outscraper.request('/yelp/reviews', {
    query: yelpUrl,
    reviewsLimit: reviewLimit,
    sort: 'newest',
    async: false,
  });
}
```

Outscraper's URL-based Yelp endpoint is reliable. The unreliable part was the search/discovery step — Step 1 replaces that.

### 4.3 Failure modes

Three places Yelp resolution can fail. Each handled gracefully:

| Failure | Cause | Behavior |
|---|---|---|
| Google search returns no Yelp URLs | Business genuinely not on Yelp | Return `null`; audit shows "Not listed on Yelp" |
| Google search returns ambiguous URLs | Common business name | Take first match if confidence ≥ threshold; else return `null` |
| Outscraper Yelp fetch fails | Outscraper outage, rate limit | Log error; return `null`; audit gracefully degrades |

**Critical:** A Yelp failure must never fail the audit. The audit always completes with whatever data is available; Yelp absence is presented as informational, not as an error.

---

## 5. Data Normalization

The normalized `AuditPlatformData` shape for Yelp matches the original spec exactly:

```ts
interface AuditPlatformData {
  platform: 'yelp';
  platform_id: string;              // Yelp business slug (e.g., "modern-tcm-center-flushing")
  platform_url: string;              // Full Yelp URL
  business_name_on_platform: string;
  
  rating: number | null;             // Yelp uses 0.5-star increments
  total_count: number;
  last_review_date: string | null;
  last_review_days_ago: number | null;
  
  profile_health: {
    is_claimed: boolean;
    has_photos: boolean;
    has_hours: boolean;
    has_description: boolean;
    completeness: number;
  };
  
  reviews: Review[];
  
  meta: {
    fetched_at: string;
    data_source: 'google-serp + outscraper-yelp';
    discovery_method: 'google_site_search';
    discovery_confidence: 'high' | 'medium' | 'low';
  };
}
```

### Yelp-specific normalization quirks

1. **Yelp ratings are 0.5-star increments** (not 0.1-star like Google). Display unchanged; algorithms can use as-is.
2. **Yelp uses "Recommended" vs "Not Recommended" reviews** — only count Recommended reviews in `total_count` and `reviews[]`. The hidden "Not Recommended" reviews exist but aren't visible in search rankings and shouldn't affect the score.
3. **Yelp review language detection** — Yelp surfaces fewer Chinese reviews than Google in NYC. The `Review.language` field still uses franc-min; just expect different distributions than Google.
4. **Yelp "elite" reviewer flag** — Outscraper returns this; preserve in the raw response but don't use in scoring for now. May be useful for Session 7 sentiment analysis.

---

## 6. Cost & Performance

### Cost per audit (Yelp portion only)

| Tier | Yelp lookup cost |
|---|---|
| Free | ~$0.04 (1 Google SERP + 1 Outscraper Yelp call, 5 reviews) |
| Paid | ~$0.06 (1 Google SERP + 1 Outscraper Yelp call, 25 reviews) |

This adds to existing Sessions 1+3 costs. Total per audit:
- Free: $0.10 (Session 1 Google) + $0.10 (Session 3 competitors) + $0.04 (Yelp) = **$0.24**
- Paid: $2.50 (Session 1 paid Google) + $0.60 (Session 3 competitors) + $0.06 (Yelp) = **$3.16**

Yelp adds <10% to total audit cost. Acceptable.

### Performance

Adds one Google SERP call (~500ms) + one Outscraper call (~800ms) = ~1.3 seconds added to audit generation.

Run **in parallel** with competitor fetching to avoid stacking latency:

```ts
const [competitorsData, platformsData] = await Promise.allSettled([
  getCompetitorsData(googleData, tier),
  getAllPlatformsData(googleData, tier),
]);
```

Net effect on total audit time: **negligible** — competitor fetch was already the bottleneck.

---

## 7. Caching

Reuse the existing `audit_platform_data` table from the original Sessions 2+3 spec:

```sql
-- Already defined in original Sessions 2+3 spec
CREATE TABLE audit_platform_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_place_id TEXT NOT NULL,
  platform TEXT NOT NULL,                  -- 'yelp' for Session 2
  tier TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_business_platform_tier UNIQUE (business_place_id, platform, tier)
);
```

TTL: same as Session 1 (7 days free / 24 hours paid). Cache key: Google's `place_id` (the canonical anchor) + platform + tier.

Cache the *Yelp URL* in addition to the data — Google SERP calls are expensive enough to deserve their own cache:

```sql
CREATE TABLE yelp_url_cache (
  business_place_id TEXT PRIMARY KEY,
  yelp_url TEXT,                           -- NULL if business not found on Yelp
  resolution_confidence TEXT NOT NULL CHECK (resolution_confidence IN ('high', 'medium', 'low', 'not_found')),
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);
```

A business's Yelp URL doesn't change often — 30-day TTL is safe. If Yelp wasn't found initially, re-check after 30 days (the business may have created a Yelp profile).

---

## 8. File Structure (Updated)

```
/baam-review/audit-engine/platforms/
├── src/
│   ├── index.ts                          # getAllPlatformsData
│   ├── types.ts
│   ├── platform-relevance.ts
│   ├── yelp/
│   │   ├── client.ts                     # Yelp data fetch via Outscraper URL endpoint
│   │   ├── url-resolver.ts               # NEW · Google SERP-based URL resolution
│   │   ├── normalizer.ts
│   │   └── tests/
│   ├── google-search/
│   │   └── serp-client.ts                # NEW · Google SERP wrapper for Yelp lookup
│   ├── shared/
│   │   └── outscraper-base.ts
│   └── cache/
│       ├── platform-cache.ts
│       └── yelp-url-cache.ts             # NEW · separate URL cache
└── tests/
```

Files removed/skipped from the original spec:
- `/zocdoc/*` — deferred to Session 2B
- `/healthgrades/*` — deferred to Session 2B
- `/facebook/*` — deferred to Session 2B
- `/shared/lookup-resolver.ts` — was generic discovery; replaced by yelp-specific `url-resolver.ts`

---

## 9. Open Questions

1. **Google SERP API source.** Two options for the Google search step:
   - **(a) Outscraper Google SERP API** — already have account, ~$0.005 per query
   - **(b) Google Programmable Search Engine** — official Google API, free tier of 100 queries/day, then $5/1000

   Recommendation: **(a) Outscraper** for v1 (already configured), migrate to (b) if free-tier costs become significant.

2. **Confidence threshold for slug matching.** Current spec requires ≥2 significant words to match. Too strict? Too loose? Adjust based on real-world data — log every Yelp URL match attempt with confidence score for first 100 audits, then tune.

3. **Should low-confidence matches be surfaced to the user?** When confidence is "medium" (1 of 2 words matched), do we use it silently or ask the user "Is this your Yelp profile?". Recommendation: **use silently for v1**, surface in admin views, and add UI confirmation if false-match rate exceeds 5%.

4. **Hidden reviews handling.** Yelp's "Not Recommended" reviews are a contested topic — some legitimately low-quality, some unfairly suppressed. Current spec excludes them entirely. Worth a note in the audit's methodology section explaining this choice.

5. **Yelp Fusion API as long-term replacement.** Yelp officially deprecated Fusion API access for new developers, but if BAAM ever gets approval, that would be cleaner than scraping. Watch for policy changes; not blocking for v1.

---

## 10. Acceptance Criteria

1. `getAllPlatformsData(googleData, 'paid')` returns `AuditPlatformsData` with `yelp` populated for a business that exists on Yelp
2. Returns `yelp: null` for a business that doesn't exist on Yelp
3. Returns `yelp: null` if Yelp lookup errors (no audit failure)
4. URL cache reduces redundant Google SERP calls
5. Slug confidence check prevents obvious false matches (e.g., common business names like "Modern Acupuncture")
6. Free tier returns ≤5 Yelp reviews; paid tier returns ≤25
7. Yelp's 0.5-star ratings preserved correctly in `rating` field
8. Performance: Yelp fetch adds <2 seconds when run in parallel with competitor fetch
9. Cost: <$0.10 per audit incremental cost
10. TypeScript strict mode clean; Zod validates output

---

## 11. What's Deferred to Session 2B

Three platforms still need attention eventually:

**Zocdoc** — medical-vertical-specific. Similar Google-search workaround applies (`"{name}" site:zocdoc.com`). Outscraper has a Zocdoc endpoint but reliability is untested.

**Healthgrades** — also medical-vertical. Same approach. Probably the most valuable of the three since healthgrades.com is highly authoritative for medical search.

**Facebook** — broadest applicability but lowest signal-quality (Facebook business pages often outdated, hidden reviews common). Google-search workaround is probably weakest here because business names on Facebook aren't standardized.

Session 2B can ship any combination of these three. **Recommendation:** after Session 10 launches, ship Healthgrades first (highest value), then Zocdoc, then Facebook (lowest priority).

---

## 12. Implementation Order

Suggested order for Session 2:

1. Build `google-search/serp-client.ts` — wraps the Google SERP API (Outscraper for v1)
2. Build `yelp/url-resolver.ts` — query construction, URL extraction, confidence scoring
3. Build `cache/yelp-url-cache.ts` — Supabase URL cache layer
4. Build `yelp/client.ts` — Outscraper Yelp endpoint wrapper (URL-based, not search-based)
5. Build `yelp/normalizer.ts` — raw Yelp response → `AuditPlatformData`
6. Update `index.ts` to call only Yelp; set other platforms to null
7. Update `platform-cache.ts` to handle Yelp specifically
8. Test against 10-20 real businesses (mix of Yelp-present and Yelp-absent)
9. Tune confidence thresholds based on false-match rates

Total estimate: **2-3 Claude Code sessions** (smaller than original Sessions 2+3 because of focused scope).

---

## 13. Migration from Original Session 2

If any code was implemented per the original Sessions 2+3 spec:

- **Keep:** `outscraper-base.ts`, the `AuditPlatformsData` type, the `platform-cache.ts`, the Yelp normalizer logic
- **Replace:** anything calling `outscraper.yelpSearch()` — replace with the URL resolver
- **Delete (or feature-flag):** Zocdoc, Healthgrades, Facebook clients if they were started
- **Add:** the Google SERP step, the `yelp_url_cache` table

Migration should be small — the Yelp data shape is unchanged; only the discovery mechanism changes.

---

## 14. Connection to Audit Template (Session 8)

When Yelp data is present, Section 2 of the audit shows the Yelp row populated:

```
PLATFORM       RATING    REVIEWS    LAST REVIEW    HEALTH
Google         ★ 4.4     47         22 days ago    ✓ Claimed
Yelp           ★ 4.0     12         3 mo ago       ⚠ No photos
```

When Yelp data is absent:

```
PLATFORM       RATING    REVIEWS    LAST REVIEW    HEALTH
Google         ★ 4.4     47         22 days ago    ✓ Claimed
Yelp           —         —          —              ○ Not listed
```

The "Not listed" cell can include a soft action link in the paid tier: "Claim your Yelp profile →" leading to Yelp's business owner page. This is a free win for the customer.

---

## 15. Summary of Changes for Claude Code

For Claude Code implementing this:

1. **Scope:** Session 2 is now Yelp-only, not all 4 platforms. Don't build Zocdoc/Healthgrades/Facebook clients yet.
2. **Discovery path:** Google site:yelp.com search → URL extraction → confidence check → Outscraper Yelp URL fetch. Do NOT use Outscraper Yelp Search.
3. **Schema:** `AuditPlatformsData` shape preserved, with non-Yelp platforms always `null`.
4. **Caching:** Add `yelp_url_cache` table separately from `audit_platform_data` (URLs have longer TTL).
5. **Failure handling:** Yelp absence never fails the audit. Graceful `null` returns throughout.
6. **Parallel execution:** Yelp fetch should run in parallel with competitor fetch (Promise.allSettled), not sequentially.
7. **Cost target:** <$0.10 incremental per audit.

The original Sessions 2+3 spec remains valid for everything *except* the Yelp resolution step. Use this spec for Yelp; preserve everything else.
