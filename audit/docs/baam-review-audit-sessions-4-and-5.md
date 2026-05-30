# Sessions 4 & 5 · Benchmarks + Scoring Engine

**Build target:**
- **Session 4** — A configurable per-vertical benchmark system: rating curves, volume baselines, velocity bands, per-review dollar values. Sourced from baamreview.com research, stored as runtime configuration.
- **Session 5** — A pure-function scoring engine that consumes `AuditGoogleData` (Session 1) + `AuditCompetitorsData` (Session 3) + benchmarks (Session 4), and produces `AuditScore` — the data structure that feeds Section 3 of the audit (sub-scores, total, grade, critical floor).

These two sessions are paired because Session 5 cannot exist without Session 4's benchmark inputs, and Session 4's data shapes are defined by what Session 5 needs to consume.

---

## 1. Architectural Anchors

Carrying from prior sessions + new decisions specific to 4+5:

1. **Benchmarks are configuration, not constants.** Per-vertical rating curves, volume baselines, and velocity bands are stored in a Supabase table (`vertical_benchmarks`). This allows:
   - Recalibration after empirical data without code changes
   - Per-region thresholds (e.g., Flushing TCM ≠ national TCM)
   - A/B testing of different scoring approaches
   - Version history for analytical traceability
   
   The Sessions 4+5 implementation seeds the table with values from baamreview.com research. The data layer reads from the table at runtime.

2. **Scoring is a pure function.** `computeAuditScore(googleData, competitorsData, benchmarks)` does no I/O, takes no time, has no side effects. Deterministic given the same inputs. This makes testing trivial and enables future cache/memoization without complexity.

3. **Score components reveal their math.** Each sub-score returns not just a number but also the raw value, the rubric used, and the scale markers needed to render the audit's transparent bar visualization (the design feature where the bar shows 4.0★/4.5★ tick marks).

4. **The "critical floor" rule applies post-computation.** Even if raw component scores produce a 65, if 30-day velocity = 0 AND last review > 60 days ago, the total caps at 49 (D grade). This is a structural override, not a component adjustment, so it gets its own dedicated step.

5. **Empirical-data feedback loop is built in.** Each audit run logs its inputs and outputs to a `audit_score_runs` table. After 50–100 audits, real distributions emerge and the benchmark table can be recalibrated against actual market data. This is how the system gets smarter over time without code changes.

---

## 2. Session 4 · Vertical Benchmarks

### 2.1 What this session builds

A benchmark service that, given a vertical + optional region, returns all the parameters needed for scoring and audit display.

### 2.2 Public API

```ts
export async function getBenchmarks(
  vertical: VerticalKey,
  region?: RegionKey                    // optional, e.g., 'nyc_metro', defaults to 'national'
): Promise<VerticalBenchmarks>

export async function getBenchmarksForBusiness(
  business: AuditGoogleData             // convenience wrapper, derives vertical+region from business data
): Promise<VerticalBenchmarks>
```

### 2.3 Output schema

```ts
export interface VerticalBenchmarks {
  vertical: VerticalKey;
  region: RegionKey;
  version: string;                       // e.g., "1.0.0" — for traceability
  source: string;                        // e.g., "baamreview.com/review-value.html"
  effective_from: string;                // ISO date
  
  // For Section 4A — per-review dollar value
  per_review_value: {
    range_low_usd: number;
    range_high_usd: number;
    median_usd: number;                  // the number used in audit calculations
    horizon_months: number;              // 24 per baamreview.com framework
  };
  
  // For Section 4B — healthy velocity standards
  healthy_velocity: {
    minimum_per_month: number;           // below this = "sleeping"
    optimal_low_per_month: number;       // start of healthy band
    optimal_high_per_month: number;      // top of healthy band
    aggressive_per_month: number;        // top performers
  };
  
  // For Section 3 — scoring rubrics
  rubric: {
    rating: RatingRubric;
    volume: VolumeRubric;
    velocity: VelocityRubric;            // applies to all three velocity windows
  };
  
  // For Section 3 — component weights (sum to 1.0)
  weights: {
    rating_quality: number;              // 0.25
    review_volume: number;               // 0.20
    velocity_30d: number;                // 0.25
    velocity_180d: number;               // 0.20
    velocity_365d: number;               // 0.10
  };
  
  // For Section 5 — competitor benchmarks (rolling, recalculated from real data)
  competitor_baseline: {
    typical_total_count: number;
    typical_velocity_30d: number;
    typical_rating: number;
    last_updated: string;
  } | null;                              // null until empirical data is gathered
}

export interface RatingRubric {
  // Non-linear curve — maps composite rating to 0-100 score
  // Anchor points; intermediate values interpolated linearly between anchors
  curve: { rating: number; score: number }[];
  // Default for TCM: [
  //   { rating: 3.0, score: 15 },
  //   { rating: 3.5, score: 35 },
  //   { rating: 4.0, score: 55 },       // 4.0★ threshold — 70% of consumers filter here
  //   { rating: 4.5, score: 80 },
  //   { rating: 4.7, score: 88 },
  //   { rating: 5.0, score: 100 },
  // ]
}

export interface VolumeRubric {
  // Maps total review count to 0-100 score
  // Logarithmic-ish curve anchored to per-vertical thresholds
  thresholds: {
    count: number;
    score: number;
  }[];
  // Default for TCM: [
  //   { count: 0,   score: 0 },
  //   { count: 25,  score: 35 },
  //   { count: 50,  score: 50 },        // median
  //   { count: 100, score: 70 },        // top 25%
  //   { count: 200, score: 85 },
  //   { count: 300, score: 100 },
  // ]
}

export interface VelocityRubric {
  // Maps reviews-per-month to 0-100 score
  // Non-linear: rewards crossing into "Min" and "Optimal" bands sharply
  thresholds: {
    per_month: number;
    score: number;
  }[];
  // Default for TCM: [
  //   { per_month: 0,  score: 0 },
  //   { per_month: 1,  score: 25 },
  //   { per_month: 2,  score: 40 },     // Min threshold
  //   { per_month: 4,  score: 75 },     // Optimal low
  //   { per_month: 6,  score: 88 },     // Optimal mid
  //   { per_month: 8,  score: 95 },     // Optimal high
  //   { per_month: 10, score: 100 },    // Aggressive
  // ]
}

export type RegionKey = 
  | 'national'
  | 'nyc_metro'                          // first region beyond national
  // future: 'nj_north', 'long_island', 'connecticut', 'national_urban', etc.
```

### 2.4 Database schema

```sql
CREATE TABLE vertical_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'national',
  version TEXT NOT NULL,
  source TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  data JSONB NOT NULL,                   -- entire VerticalBenchmarks object minus the lookup keys
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_active UNIQUE (vertical, region, is_active) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_vb_lookup ON vertical_benchmarks (vertical, region, is_active);

-- Stale versions remain in table for audit traceability; only is_active=true used for current scoring
```

Lookup logic:
1. Query for `vertical=X, region=Y, is_active=true` → returns current benchmark
2. If region-specific not found, fall back to `vertical=X, region='national'`
3. If still not found, throw `BenchmarkNotFoundError`

### 2.5 Seeding the table

A migration script seeds the table with v1.0 data sourced from baamreview.com research. The 13 verticals × 1 region (`national`) = 13 rows for initial deployment.

Migration approach:
```ts
// /baam-review/audit-engine/benchmarks/migrations/001-seed-v1.ts
const SEED_DATA: VerticalBenchmarks[] = [
  {
    vertical: 'tcm_clinic',
    region: 'national',
    version: '1.0.0',
    source: 'baamreview.com/review-value.html#by-vertical',
    effective_from: '2026-05-01',
    per_review_value: { range_low_usd: 400, range_high_usd: 2400, median_usd: 1400, horizon_months: 24 },
    healthy_velocity: { minimum_per_month: 2, optimal_low_per_month: 4, optimal_high_per_month: 8, aggressive_per_month: 10 },
    rubric: { 
      rating: { curve: [/* anchor points */] },
      volume: { thresholds: [/* per-vertical counts */] },
      velocity: { thresholds: [/* per-vertical rates */] }
    },
    weights: { rating_quality: 0.25, review_volume: 0.20, velocity_30d: 0.25, velocity_180d: 0.20, velocity_365d: 0.10 },
    competitor_baseline: null   // populated later from empirical data
  },
  // ... 12 more verticals
];
```

All 13 verticals' data is fully specified in the spec's Appendix A (below). Implementation just translates that table into seed data.

### 2.6 File structure

```
/baam-review/audit-engine/benchmarks/
├── src/
│   ├── index.ts                          # public API
│   ├── types.ts
│   ├── benchmark-client.ts               # Supabase lookup + fallback logic
│   ├── interpolator.ts                   # linear interpolation between rubric anchors
│   ├── score-from-rating.ts              # rating → score using RatingRubric
│   ├── score-from-volume.ts              # count → score using VolumeRubric
│   ├── score-from-velocity.ts            # per_month → score using VelocityRubric
│   └── errors.ts
├── migrations/
│   └── 001-seed-v1.ts
└── tests/
```

### 2.7 Session 4 acceptance criteria

1. `getBenchmarks('tcm_clinic', 'national')` returns the v1.0 benchmark from seed data
2. `getBenchmarks('tcm_clinic', 'nyc_metro')` falls back to national when nyc_metro doesn't exist
3. `scoreFromRating(4.37, ratingRubric)` returns ~72 (interpolated between 4.0→55 and 4.5→80)
4. `scoreFromVelocity(1.67, velocityRubric)` returns ~35 (interpolated between 1→25 and 2→40)
5. All 13 verticals seeded successfully via migration
6. Active benchmark uniqueness constraint prevents accidentally activating two versions for same vertical+region

---

## 3. Session 5 · Scoring Engine

### 3.1 What this session builds

The pure-function scoring engine that consumes data + benchmarks and produces a complete `AuditScore` object.

### 3.2 Public API

```ts
export function computeAuditScore(
  googleData: AuditGoogleData,
  competitorsData: AuditCompetitorsData,
  benchmarks: VerticalBenchmarks
): AuditScore
```

Synchronous, pure function. No I/O. No randomness. Same inputs always produce same output.

### 3.3 Output schema

```ts
export interface AuditScore {
  total: number;                          // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  grade_diagnosis: string;                // one-liner like "Visible — but customers are choosing competitors..."
  
  components: {
    rating_quality: ScoreComponent;
    review_volume: ScoreComponent;
    velocity_30d: ScoreComponent;
    velocity_180d: ScoreComponent;
    velocity_365d: ScoreComponent;
  };
  
  // Critical floor metadata
  critical_floor_applied: boolean;
  critical_floor_reason: string | null;  // e.g., "30-day velocity 0 + last review 65 days ago"
  uncapped_total: number;                 // what total would be without floor (for diagnostics)
  
  // Used by Section 6 for action plan prioritization
  weakest_component: keyof AuditScore['components'];
  
  // Identifiers for traceability
  benchmark_version: string;              // "1.0.0"
  computed_at: string;                    // ISO 8601
}

export interface ScoreComponent {
  // The score
  raw_score: number;                      // 0-100
  weight: number;                         // e.g., 0.25 for rating_quality
  weighted_contribution: number;          // raw_score × weight
  
  // The math (for Section 3's transparent bar visualization)
  measured_value: number;                 // e.g., 4.37 (rating), 47 (volume), 1.67 (velocity/mo)
  measured_value_label: string;           // e.g., "composite 4.37★", "47 total reviews", "1.67/mo avg"
  measured_value_calculation: string | null;  // e.g., "10 reviews ÷ 6 months" — null when no calculation needed
  
  // Rubric reference (for tick marks on the audit's bar visualization)
  rubric_anchors: { 
    label: string;       // e.g., "MIN · 2/mo", "OPTIMAL · 4/mo"
    value: number;       // the raw measurement value at this anchor
    score: number;       // the score that maps to (used for bar position)
    is_key: boolean;     // whether to highlight as a major tick
  }[];
}
```

### 3.4 Component computation logic

**Rating Quality (25%):**

```ts
function computeRatingQuality(googleData, benchmarks): ScoreComponent {
  // Composite rating — weighted across platforms
  // For Session 5, Google-only since Session 2 (other platforms) deferred
  // When Session 2 ships, replace with: G × 0.70 + Y × 0.15 + Z × 0.15
  const compositeRating = googleData.reviews_aggregate.rating;
  
  const score = scoreFromRating(compositeRating, benchmarks.rubric.rating);
  
  return {
    raw_score: score,
    weight: benchmarks.weights.rating_quality,
    weighted_contribution: score * benchmarks.weights.rating_quality,
    measured_value: compositeRating,
    measured_value_label: `composite ${compositeRating.toFixed(2)}★`,
    measured_value_calculation: null,  // single-platform until Session 2
    rubric_anchors: buildRatingAnchors(benchmarks.rubric.rating),
  };
}
```

**Review Volume (20%):**

```ts
function computeReviewVolume(googleData, benchmarks): ScoreComponent {
  const count = googleData.reviews_aggregate.total_count;
  const score = scoreFromVolume(count, benchmarks.rubric.volume);
  
  return {
    raw_score: score,
    weight: benchmarks.weights.review_volume,
    weighted_contribution: score * benchmarks.weights.review_volume,
    measured_value: count,
    measured_value_label: `${count} total reviews`,
    measured_value_calculation: null,
    rubric_anchors: buildVolumeAnchors(benchmarks.rubric.volume),
  };
}
```

**30-Day Velocity (25%):**

```ts
function computeVelocity30d(googleData, benchmarks): ScoreComponent {
  // Free tier: this comes from 5 recent reviews; may be 0/1
  // Paid tier: exact count from Outscraper
  const velocity = googleData.reviews_aggregate.velocity_30d_per_month ?? 0;
  const reviewsIn30d = googleData.reviews_aggregate.reviews_30d ?? 0;
  
  const score = scoreFromVelocity(velocity, benchmarks.rubric.velocity);
  
  return {
    raw_score: score,
    weight: benchmarks.weights.velocity_30d,
    weighted_contribution: score * benchmarks.weights.velocity_30d,
    measured_value: velocity,
    measured_value_label: `${velocity.toFixed(1)} / mo`,
    measured_value_calculation: `${reviewsIn30d} review${reviewsIn30d === 1 ? '' : 's'} past 30 days`,
    rubric_anchors: buildVelocityAnchors(benchmarks.rubric.velocity),
  };
}
```

**6-Month Velocity (20%) and 12-Month Velocity (10%):** Same pattern as 30-day, with appropriate calculation labels:
- 6-month: `"10 reviews ÷ 6 months"`
- 12-month: `"30 reviews ÷ 12 months"`

### 3.5 Total + Grade logic

```ts
function computeTotal(components): number {
  return Math.round(
    components.rating_quality.weighted_contribution +
    components.review_volume.weighted_contribution +
    components.velocity_30d.weighted_contribution +
    components.velocity_180d.weighted_contribution +
    components.velocity_365d.weighted_contribution
  );
}

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

const GRADE_DIAGNOSES: Record<string, string> = {
  A: 'Winning your local market. Reviews are a competitive moat.',
  B: 'Strong — but losing ground to top competitors month over month.',
  C: 'Visible — but customers are choosing competitors with stronger reviews.',
  D: 'Bleeding customers to better-reviewed competitors every week.',
  F: 'Effectively invisible. Search and AI are skipping you entirely.',
};
```

### 3.6 Critical floor rule

Applied after total computation:

```ts
function applyCriticalFloor(uncappedTotal, googleData): {
  total: number;
  applied: boolean;
  reason: string | null;
} {
  const velocity30d = googleData.reviews_aggregate.velocity_30d_per_month ?? 0;
  const daysSinceLastReview = googleData.reviews_aggregate.last_review_days_ago ?? Infinity;
  
  if (velocity30d === 0 && daysSinceLastReview > 60) {
    return {
      total: Math.min(uncappedTotal, 49),
      applied: uncappedTotal > 49,
      reason: `30-day velocity is 0 and last review was ${Math.round(daysSinceLastReview)} days ago. ` +
              `A business this dormant cannot score above D regardless of historical strength.`,
    };
  }
  
  return { total: uncappedTotal, applied: false, reason: null };
}
```

This rule prevents businesses with strong historical numbers but no current activity from receiving misleadingly high scores — exactly the dying-on-glory case the audit framework is designed to expose.

### 3.7 Weakest component identification

For Section 6 (Action Plan) prioritization, identify which component is most dragging the score:

```ts
function findWeakestComponent(components): keyof typeof components {
  // Weakest = lowest raw_score, regardless of weight
  // (weight matters for total, but for action prioritization, raw weakness drives focus)
  let weakest: keyof typeof components = 'rating_quality';
  let minScore = components.rating_quality.raw_score;
  
  for (const [key, comp] of Object.entries(components)) {
    if (comp.raw_score < minScore) {
      minScore = comp.raw_score;
      weakest = key as keyof typeof components;
    }
  }
  
  return weakest;
}
```

Used by Session 6 (action plan) to prioritize which actions to recommend first. If `velocity_30d` is weakest, the post-visit review workflow action goes to the top.

### 3.8 Logging for empirical calibration

Every score computation logs to `audit_score_runs`:

```sql
CREATE TABLE audit_score_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Inputs (for re-computation if needed)
  business_place_id TEXT NOT NULL,
  vertical TEXT NOT NULL,
  region TEXT NOT NULL,
  tier TEXT NOT NULL,
  benchmark_version TEXT NOT NULL,
  
  -- Inputs snapshot (for analysis)
  composite_rating NUMERIC,
  total_count INTEGER,
  velocity_30d NUMERIC,
  velocity_180d NUMERIC,
  velocity_365d NUMERIC,
  
  -- Outputs
  total_score INTEGER NOT NULL,
  grade CHAR(1) NOT NULL,
  critical_floor_applied BOOLEAN NOT NULL,
  
  -- Per-component scores (for distribution analysis)
  rating_quality_score INTEGER,
  review_volume_score INTEGER,
  velocity_30d_score INTEGER,
  velocity_180d_score INTEGER,
  velocity_365d_score INTEGER
);

CREATE INDEX idx_asr_vertical ON audit_score_runs (vertical, region);
CREATE INDEX idx_asr_computed ON audit_score_runs (computed_at);
```

After 50+ audits, this table powers a calibration query like:

```sql
SELECT vertical, region,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_count) as median_count,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_count) as p75_count,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY velocity_30d) as median_velocity_30d,
  AVG(total_score) as avg_score,
  COUNT(*) as audit_count
FROM audit_score_runs
WHERE computed_at > NOW() - INTERVAL '30 days'
GROUP BY vertical, region;
```

That's the data that informs whether the v1.0 benchmark thresholds match reality. If actual median TCM clinic in NYC has 25 reviews not 60, the volume rubric needs to shift.

### 3.9 File structure

```
/baam-review/audit-engine/scoring/
├── src/
│   ├── index.ts                          # computeAuditScore
│   ├── types.ts
│   ├── component-rating.ts
│   ├── component-volume.ts
│   ├── component-velocity.ts
│   ├── critical-floor.ts
│   ├── grade-diagnoses.ts
│   ├── weakest-component.ts
│   ├── score-logger.ts                   # writes to audit_score_runs
│   └── anchor-builders.ts                # build rubric_anchors for audit display
└── tests/
```

### 3.10 Session 5 acceptance criteria

1. `computeAuditScore(drHuangData, drHuangCompetitors, tcmBenchmarks)` returns a deterministic `AuditScore` object
2. Score components match the audit design's worked example (rating 72, volume 48, velocity_30d 25, velocity_180d 42, velocity_365d 58, total 62, grade C)
3. Critical floor activates when `velocity_30d_per_month=0` AND `last_review_days_ago=65`
4. Critical floor does NOT activate when `last_review_days_ago=30` even if `velocity_30d=0`
5. `weakest_component` correctly identifies the lowest-scoring component
6. Pure function: identical inputs → identical outputs
7. Score logged to `audit_score_runs` table on each computation
8. Performance: <5ms per scoring call
9. TS strict mode clean; Zod validates output

---

## 4. The Empirical Calibration Loop

This is the part that makes the system get smarter over time.

**Stage 0 (now):** Sessions 4+5 ship with v1.0 benchmarks from baamreview.com research. These are educated guesses, not measurements.

**Stage 1 (after 50+ audits run):** Query `audit_score_runs` for actual distributions. Compare to v1.0 thresholds:
- Is median TCM volume actually 60, or is it 25?
- What's the real velocity_30d distribution in Flushing TCM market?
- What % of audits trigger the critical floor? (If too high, threshold may be wrong.)

**Stage 2 (after 200+ audits):** Insert v1.1 benchmarks with empirically-calibrated thresholds. Set v1.0 to `is_active=false`, v1.1 to `is_active=true`. New audits use v1.1; old audits remain explainable via v1.0.

**Stage 3 (after 1000+ audits):** Insert region-specific benchmarks (`nyc_metro`, `nj_north`, etc.) where data supports it.

**This loop is the system's defensible moat.** Birdeye and Podium have generic scoring; BAAM has Flushing-specific scoring, dental-specific scoring, immigration-law-specific scoring — calibrated against real local data nobody else has access to.

---

## 5. Open Questions

1. **The `velocity_30d_per_month = 0` reality.** Your Session 3 ship revealed that Flushing TCM clinics had 0 reviews across all 6 businesses in past 30 days. If this is widespread, the v1.0 rubric (where 0/month = 0 score, 2/month = 40 score) will produce a market where most clinics get D or F grades for velocity. Two options:
   - **Keep the rubric** — let the grades be honest about a dormant market. The audit's value prop becomes "even a small effort beats your competitors."
   - **Recalibrate Flushing-TCM specifically** — region-specific benchmark where 0.5/month = 40 score. Easier grades, but loses the absolute-truth quality.
   
   My recommendation: **keep the rubric, let the grades be honest.** A market where everyone gets D for velocity is a market where the first business to fix velocity gets dramatic ranking lift. That's exactly the BAAM Review value prop.

2. **Composite rating without Session 2 multi-platform data.** Session 5's `computeRatingQuality` uses only Google rating since Session 2 was deferred. The audit design originally specified G × 0.70 + Y × 0.15 + Z × 0.15 weighting. Two options for the gap:
   - **Use Google rating directly** — code is simpler, output is honest about what data we have
   - **Apply the weights but treat missing platforms as null** — falls back to Google when others absent
   
   Recommendation: **use Google directly for now**; refactor to multi-platform when Session 2 ships. Cleaner contract.

3. **Audit score logging — privacy/retention.** Logging every score run permanently is great for calibration but raises questions about retention if a business owner asks for their data deleted. Recommendation: store `business_place_id` (public identifier), no PII. Place IDs are public Google data, not personal.

4. **Score versioning at the audit level.** If a customer re-runs their audit 60 days later under v1.1 benchmarks, their score might shift even if their business didn't change. Should the audit show "score under v1.0: 62, score under v1.1: 58" for transparency? Recommendation: **no for the customer-facing report** (confusing), **yes in internal admin views** (helpful for debugging).

5. **Should `weakest_component` be exposed in the customer-facing report?** Currently it drives Section 6 action prioritization internally. Could also be a sentence in Section 3: "Your weakest area is 30-day velocity." Recommendation: **yes, surface it as a sentence** — sharpens the diagnosis.

---

## 6. What This Unlocks

Once Sessions 4+5 ship, the data + scoring pipeline is complete:

`getGoogleBusinessData → getCompetitorsData → getBenchmarks → computeAuditScore`

That chain produces enough data to render Sections 1, 2, 3, 4, and 5 of the audit. Section 6 (Action Plan) needs scoring to identify weakest components — also possible now. Section 3.5 (Do-Nothing Projection) needs Session 6's projection engine. Section 7 (Appendix) is static content.

**Practically: after Sessions 4+5, you have everything except the projection model and the rendering layer.**

The natural next pair after Sessions 4+5 is **Session 6 (Projection model) + Session 8 (Templating/PDF)**. Together those two complete the audit's data-to-deliverable pipeline.

---

## 7. The Calibration Stop Recommendation

Strong recommendation: **before writing Sessions 6+8, do a calibration pass with real audits.**

Specifically:
1. Run `computeAuditScore` against 15–20 real Flushing-area businesses (TCM, dental, immigration lawyers)
2. Review the score distribution. Are all TCM clinics getting D grades for velocity? Is rating_quality clustering too high?
3. Decide whether to recalibrate v1.0 → v1.1 before continuing
4. Inform the projection model (Session 6) with realistic decay curves based on actual market data

The calibration cost is ~$50 in API fees and 2–3 hours of running the pipeline. The benefit is a scoring system grounded in NYC reality, not generic assumptions. **Don't skip this step.** Generic scoring is the trap that every competitor falls into.

The screenshot of your Session 3 ship already showed empirical reality conflicting with assumed benchmarks (zero velocity across the entire test market). That's exactly the calibration signal — if you run 20 more audits, you'll see the pattern repeat or break, and that knowledge is invaluable.

---

## 8. Implementation Order

**Session 4 first:**
1. Define schemas (`VerticalBenchmarks`, all sub-types) — pure types, easy first win
2. Implement `interpolator.ts` (linear interp between rubric anchors) — pure function
3. Implement `scoreFromRating`, `scoreFromVolume`, `scoreFromVelocity` — pure functions
4. Implement Supabase client + lookup logic
5. Write migration `001-seed-v1.ts` with all 13 verticals from Appendix A
6. Implement `getBenchmarks` + `getBenchmarksForBusiness`
7. Tests against seeded data

**Then Session 5:**
1. Define schemas (`AuditScore`, `ScoreComponent`)
2. Implement each component function (`computeRatingQuality`, `computeReviewVolume`, etc.)
3. Implement `applyCriticalFloor`
4. Implement `findWeakestComponent`
5. Implement `gradeFromScore` + grade diagnoses
6. Implement `computeAuditScore` orchestrator
7. Implement `score-logger.ts` (Supabase insert)
8. Tests using Dr. Huang fixture — expect total=62, grade=C
9. Edge case tests: critical floor activation, all-zero inputs, max scores

**Then calibration pass** (not a Claude Code session — runtime activity):
1. Pick 15–20 real Flushing businesses
2. Run the pipeline end-to-end
3. Export `audit_score_runs` data
4. Analyze distributions
5. Decide on v1.1 benchmark adjustments
6. Insert v1.1 if warranted

**Then Session 6 + 8 next wave.**

---

## 9. Timing Estimate

- Session 4: **2–3 Claude Code sessions** (mostly schema + seed data work, plus 4 pure interpolation functions)
- Session 5: **2–3 Claude Code sessions** (5 component functions + orchestrator + critical floor + logger)
- Calibration: **2–3 hours of your time**, ~$50 in API costs
- Total to "audit scoring works end-to-end": **about 1 week of calendar time**

---

## Appendix A · v1.0 Benchmark Seed Data

Complete data for all 13 verticals × 1 region (`national`). Translated directly from baamreview.com/review-value.html. Use this verbatim in the seed migration.

### A.1 — TCM Clinic / Acupuncture / Medical (`tcm_clinic`)

```json
{
  "per_review_value": { "range_low_usd": 400, "range_high_usd": 2400, "median_usd": 1400, "horizon_months": 24 },
  "healthy_velocity": { "minimum_per_month": 2, "optimal_low_per_month": 4, "optimal_high_per_month": 8, "aggressive_per_month": 10 },
  "rubric": {
    "rating": { "curve": [
      { "rating": 3.0, "score": 15 },
      { "rating": 3.5, "score": 35 },
      { "rating": 4.0, "score": 55 },
      { "rating": 4.5, "score": 80 },
      { "rating": 4.7, "score": 88 },
      { "rating": 5.0, "score": 100 }
    ]},
    "volume": { "thresholds": [
      { "count": 0, "score": 0 },
      { "count": 25, "score": 35 },
      { "count": 50, "score": 50 },
      { "count": 100, "score": 70 },
      { "count": 200, "score": 85 },
      { "count": 300, "score": 100 }
    ]},
    "velocity": { "thresholds": [
      { "per_month": 0, "score": 0 },
      { "per_month": 1, "score": 25 },
      { "per_month": 2, "score": 40 },
      { "per_month": 4, "score": 75 },
      { "per_month": 6, "score": 88 },
      { "per_month": 8, "score": 95 },
      { "per_month": 10, "score": 100 }
    ]}
  }
}
```

### A.2 — Dental (`dental`)

```json
{
  "per_review_value": { "range_low_usd": 400, "range_high_usd": 2400, "median_usd": 1400, "horizon_months": 24 },
  "healthy_velocity": { "minimum_per_month": 2, "optimal_low_per_month": 4, "optimal_high_per_month": 8, "aggressive_per_month": 10 },
  "rubric": "same as tcm_clinic — dental and TCM share medical-clinic benchmarks per baamreview.com"
}
```

### A.3 — Legal / Immigration (`legal_immigration`)

```json
{
  "per_review_value": { "range_low_usd": 1200, "range_high_usd": 12000, "median_usd": 6600, "horizon_months": 24 },
  "healthy_velocity": { "minimum_per_month": 1, "optimal_low_per_month": 3, "optimal_high_per_month": 5, "aggressive_per_month": 6 },
  "rubric": {
    "rating": { "curve": [ /* same shape as TCM, anchored to higher trust threshold */ ] },
    "volume": { "thresholds": [
      { "count": 0, "score": 0 },
      { "count": 10, "score": 35 },
      { "count": 25, "score": 50 },
      { "count": 50, "score": 70 },
      { "count": 100, "score": 85 },
      { "count": 200, "score": 100 }
    ]},
    "velocity": { "thresholds": [
      { "per_month": 0, "score": 0 },
      { "per_month": 0.5, "score": 25 },
      { "per_month": 1, "score": 40 },
      { "per_month": 3, "score": 75 },
      { "per_month": 5, "score": 95 },
      { "per_month": 6, "score": 100 }
    ]}
  }
}
```

### A.4 through A.13 — Remaining 10 verticals

Same structural pattern. Specific values for each vertical pulled from baamreview.com data tables:

| Vertical | Median $ | Min/mo | Optimal/mo | Aggressive/mo |
|---|---|---|---|---|
| `restaurant` | $105 | 4 | 10–15 | 20+ |
| `salon_spa` | $360 | 3 | 8–12 | 15+ |
| `apparel` | $390 | 3 | 6–10 | 12+ |
| `health_food` | $675 | 2 | 4–7 | 8+ |
| `insurance` | $1,050 | 1 | 3–5 | 6+ |
| `hotel` | $1,550 | 6 | 12–20 | 25+ |
| `auto` | $2,750 | 3 | 6–10 | 12+ |
| `contractor` | $3,300 | 2 | 5–8 | 10+ |
| `real_estate` | $4,750 | 1 | 3–5 | 6+ |
| `cafe` | $105 | 4 | 10–15 | 20+ |
| `general_smb` | (uses cafe defaults as fallback) |

Volume thresholds scale proportionally with healthy_velocity × horizon_months. Rubric anchors follow same shape, scaled to vertical-appropriate volumes.

Full JSON for each vertical generated by a transformation function from the table above — Claude Code can compute this deterministically during the migration script's execution.
