# Sessions 6 & 8 · Projection Model + Templating & PDF Delivery

**Build target:**
- **Session 6** — The Do-Nothing projection engine. Given an audit's current score + competitor data + benchmarks, computes the 12-month score trajectory under two scenarios (do nothing vs. with BAAM Review), plus revenue impact and ranking position estimate. Powers Section 3.5 of the audit (the projection chart).
- **Session 8** — The rendering layer that transforms all the upstream data structures into the final deliverable: HTML audit pages (EN, ZH, or both), PDF generation, email delivery, and persistent storage. This is the session that turns "we have data" into "the customer received their audit."

These two sessions are paired because Session 6's output (`AuditProjection`) is one of the inputs Session 8 needs to render the projection chart. Writing them together locks the data contract.

**Note on Session 8's complexity:** This is the most multi-faceted session in the build. It encompasses templating, PDF generation, language routing, translation, email delivery, and storage. Claude Code may want to split this into 8A (templating + PDF) and 8B (delivery + storage) during implementation. The spec is structured to support that split.

---

## 1. Architectural Anchors

Carrying from prior sessions + new for 6+8:

1. **Projection is also a pure function.** Like scoring, the projection engine takes inputs and returns outputs deterministically. No I/O, fully testable. Three projections happen on each audit (do-nothing curve, with-BAAM curve, revenue impact) but all are pure math from the same inputs.

2. **Projection parameters are pulled from the benchmarks table, not hardcoded.** Per-vertical decay rates (ranking slide onset, velocity half-life) live alongside the scoring rubric in `vertical_benchmarks`. This means recalibration of the projection model happens the same way as scoring recalibration — through the table, not through code.

3. **Templates are tokenized versions of the existing design HTML.** Sessions 8 doesn't build HTML from scratch. The English and Chinese design files (`baam-review-audit-sample.html` and `baam-review-audit-sample-zh.html`) are the source of truth. Session 8's job is to convert them into templates with `{{token}}` placeholders, then render with real data.

4. **Language detection drives output count, not output choice.** Per the framework v3 decision: Chinese-name businesses get **both** EN and ZH versions delivered (not "Chinese instead of English"). Non-Chinese businesses get only EN. The data layer detects; the rendering layer produces 1 or 2 outputs.

5. **PDF generation uses Puppeteer + Chromium.** The design HTML is already pixel-perfect in browser. Puppeteer renders it identically to PDF with print CSS already in place. Alternative considered: pdfkit/jsPDF — rejected because re-implementing the design in those libraries would lose fidelity.

6. **Storage in Supabase Storage, not Supabase Postgres.** PDFs are 200KB–800KB each. They go to Supabase Storage with public URLs. The Postgres `audits` table just stores references.

---

## 2. Session 6 · Do-Nothing Projection Model

### 2.1 What this session builds

A projection engine that computes 12-month score trajectories under two scenarios, plus dollar impact and ranking position estimates.

### 2.2 Public API

```ts
export function computeProjection(
  googleData: AuditGoogleData,
  competitorsData: AuditCompetitorsData,
  currentScore: AuditScore,
  benchmarks: VerticalBenchmarks
): AuditProjection
```

Pure function. Synchronous. ~10ms execution target.

### 2.3 Output schema

```ts
export interface AuditProjection {
  // Score trajectories — both scenarios, sampled at each month
  timeline: ProjectionPoint[];      // length 13 (months 0 through 12)
  
  // Key milestone — 6-month projection (the headline number)
  six_month: {
    do_nothing_score: number;
    do_nothing_grade: 'A' | 'B' | 'C' | 'D' | 'F';
    with_baam_score: number;
    with_baam_grade: 'A' | 'B' | 'C' | 'D' | 'F';
    score_gap: number;              // with_baam - do_nothing
  };
  
  // 12-month milestone — long-horizon
  twelve_month: {
    do_nothing_score: number;
    do_nothing_grade: 'A' | 'B' | 'C' | 'D' | 'F';
    with_baam_score: number;
    with_baam_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  
  // Revenue impact — the "money on the table" number
  revenue_impact: {
    six_month_loss_usd: number;     // dollar value of doing nothing for 6 months
    twelve_month_loss_usd: number;
    monthly_loss_run_rate_usd: number;
    
    // The math (for audit transparency)
    competitor_velocity_advantage: number;  // reviews/month competitors gain over you
    per_review_value_used: number;          // from benchmarks.per_review_value.median_usd
    months_modeled: number;
    
    // Cumulative — if business does nothing for X months
    cumulative_at_month: {           // length 13
      month: number;
      loss_usd: number;
    }[];
  };
  
  // Ranking position estimate
  ranking_estimate: {
    current_position: number;        // estimated current Local Pack rank for primary keyword
    do_nothing_six_month_position: number;
    do_nothing_six_month_drop: number;   // negative number = how many positions lost
    confidence: 'low' | 'medium' | 'high';
    method: string;                  // documentation of how we estimated
  };
  
  // Decay parameters used (for transparency)
  parameters_used: {
    velocity_decay_model: 'linear_window_drop' | 'exponential';
    ranking_slide_onset_weeks: number;
    velocity_half_life_days: number;
    competitor_avg_velocity: number;
    benchmark_version: string;
  };
  
  computed_at: string;
}

export interface ProjectionPoint {
  month: number;                     // 0-12
  do_nothing_score: number;
  with_baam_score: number;
  
  // For chart hover/tooltip purposes
  do_nothing_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  with_baam_grade: 'A' | 'B' | 'C' | 'D' | 'F';
}
```

### 2.4 The model

Three forces work against a business that stops collecting reviews. Each contributes to the projected score decline.

**Force 1: Mechanical velocity decay.**

Velocity components in the score (`velocity_30d`, `velocity_180d`, `velocity_365d`) decrease as old reviews age out of the windows.

For each month t, we estimate windowed review counts assuming:
- No new reviews are added
- Existing reviews "age out" of windows linearly

```ts
function projectVelocityCount(
  currentCount: number,
  windowDays: number,
  monthsForward: number
): number {
  const daysForward = monthsForward * 30;
  
  // Assume reviews were uniformly distributed across the window
  // After daysForward elapsed, the proportion still inside the window is:
  // (windowDays - daysForward) / windowDays, clamped to [0, 1]
  const proportionRemaining = Math.max(0, (windowDays - daysForward) / windowDays);
  
  return Math.round(currentCount * proportionRemaining);
}
```

So:
- `velocity_30d` at month 1: 0 (whole window aged out)
- `velocity_180d` at month 3 (90 days): 50% of original count remains
- `velocity_180d` at month 6 (180 days): 0
- `velocity_365d` at month 6: 50%
- `velocity_365d` at month 12: 0

**Force 2: Ranking decline (Sterling Sky finding).**

The Sterling Sky research shows ~3 weeks of silence triggers visible Local Pack ranking drops. This converts to a ranking position estimate over time.

```ts
function projectRankingDrop(
  monthsForward: number,
  competitorAvgVelocity: number,    // reviews per month competitors are gaining
  primaryCurrentVelocity: number,    // 0 in the do-nothing scenario
  rankingSlideOnsetWeeks: number     // from benchmarks
): number {
  const monthsSinceSlideStart = monthsForward - (rankingSlideOnsetWeeks / 4.3);
  
  if (monthsSinceSlideStart <= 0) return 0;
  
  // Velocity gap × time = approximate ranking positions lost
  // Empirically: 1 review/month advantage ≈ 1 position over 6 months for hyper-local
  // This is a rough heuristic; calibrate against real data
  const velocityGap = competitorAvgVelocity - primaryCurrentVelocity;
  const positionsLost = Math.min(velocityGap * monthsSinceSlideStart * 0.15, 7);  // cap at 7 positions
  
  return Math.round(positionsLost);
}
```

**Force 3: Competitor compounding.**

Competitors continue at their measured velocity. The competitor velocity is `competitorsData.competitor_aggregate.avg_velocity_30d_per_month`. As your velocity drops and theirs holds steady, the gap widens.

### 2.5 The "Do Nothing" trajectory

For each month t (0 to 12):

```ts
function projectDoNothingScore(
  t: number,
  googleData: AuditGoogleData,
  benchmarks: VerticalBenchmarks
): number {
  // Project windowed review counts
  const projectedReviews30d = projectVelocityCount(googleData.reviews_aggregate.reviews_30d, 30, t);
  const projectedReviews180d = projectVelocityCount(googleData.reviews_aggregate.reviews_180d, 180, t);
  const projectedReviews365d = projectVelocityCount(googleData.reviews_aggregate.reviews_365d, 365, t);
  
  // Project per-month velocities
  const projectedVelocity30d = projectedReviews30d;       // already per-month
  const projectedVelocity180d = projectedReviews180d / 6;
  const projectedVelocity365d = projectedReviews365d / 12;
  
  // Score each component using benchmark rubric
  const ratingScore = scoreFromRating(googleData.reviews_aggregate.rating, benchmarks.rubric.rating);
  const volumeScore = scoreFromVolume(googleData.reviews_aggregate.total_count, benchmarks.rubric.volume);  // unchanged
  const velocity30dScore = scoreFromVelocity(projectedVelocity30d, benchmarks.rubric.velocity);
  const velocity180dScore = scoreFromVelocity(projectedVelocity180d, benchmarks.rubric.velocity);
  const velocity365dScore = scoreFromVelocity(projectedVelocity365d, benchmarks.rubric.velocity);
  
  // Weighted total
  const weighted = 
    ratingScore * benchmarks.weights.rating_quality +
    volumeScore * benchmarks.weights.review_volume +
    velocity30dScore * benchmarks.weights.velocity_30d +
    velocity180dScore * benchmarks.weights.velocity_180d +
    velocity365dScore * benchmarks.weights.velocity_365d;
  
  // Apply critical floor
  // After 60 days of no new reviews, floor activates
  const last_review_days_ago_projected = (googleData.reviews_aggregate.last_review_days_ago ?? 0) + (t * 30);
  if (projectedVelocity30d === 0 && last_review_days_ago_projected > 60) {
    return Math.min(weighted, 49);
  }
  
  return Math.round(weighted);
}
```

**Note:** rating and volume scores don't decay in this model (a business with 100 reviews still has 100 reviews 6 months later, regardless of whether they got new ones). Only velocity components decay.

### 2.6 The "With BAAM" trajectory

Models the business actually executing the action plan:

```ts
function projectWithBaamScore(
  t: number,
  googleData: AuditGoogleData,
  benchmarks: VerticalBenchmarks
): number {
  // Project new reviews added per month under BAAM workflow
  // Ramp from 0 → Optimal velocity over 3 months
  const targetVelocity = benchmarks.healthy_velocity.optimal_low_per_month;
  const rampMonths = 3;
  const newReviewsPerMonth = Math.min(targetVelocity, (t / rampMonths) * targetVelocity);
  
  // Cumulative new reviews
  const totalNewReviews = newReviewsPerMonth * t;
  
  // Project velocities — at month t, reviews_30d is approximately the most recent month's new reviews
  const projectedVelocity30d = t === 0 ? googleData.reviews_aggregate.velocity_30d_per_month ?? 0 : newReviewsPerMonth;
  
  // For 180d and 365d, integrate over the window
  const projectedReviews180d = Math.min(180/30, t) * newReviewsPerMonth + 
    (googleData.reviews_aggregate.reviews_180d ?? 0) * Math.max(0, (180 - t * 30) / 180);
  const projectedVelocity180d = projectedReviews180d / 6;
  
  const projectedReviews365d = Math.min(365/30, t) * newReviewsPerMonth +
    (googleData.reviews_aggregate.reviews_365d ?? 0) * Math.max(0, (365 - t * 30) / 365);
  const projectedVelocity365d = projectedReviews365d / 12;
  
  // Volume grows
  const projectedTotalCount = googleData.reviews_aggregate.total_count + totalNewReviews;
  
  // Rating may slowly improve under active management — assume +0.05 per quarter, capped at 4.9
  // (conservative assumption; can be tuned)
  const projectedRating = Math.min(4.9, googleData.reviews_aggregate.rating + (t / 3) * 0.05);
  
  // Score components
  const ratingScore = scoreFromRating(projectedRating, benchmarks.rubric.rating);
  const volumeScore = scoreFromVolume(projectedTotalCount, benchmarks.rubric.volume);
  const velocity30dScore = scoreFromVelocity(projectedVelocity30d, benchmarks.rubric.velocity);
  const velocity180dScore = scoreFromVelocity(projectedVelocity180d, benchmarks.rubric.velocity);
  const velocity365dScore = scoreFromVelocity(projectedVelocity365d, benchmarks.rubric.velocity);
  
  // Weighted total
  const weighted = 
    ratingScore * benchmarks.weights.rating_quality +
    volumeScore * benchmarks.weights.review_volume +
    velocity30dScore * benchmarks.weights.velocity_30d +
    velocity180dScore * benchmarks.weights.velocity_180d +
    velocity365dScore * benchmarks.weights.velocity_365d;
  
  return Math.round(weighted);
}
```

### 2.7 Revenue impact calculation

```ts
function computeRevenueImpact(
  googleData: AuditGoogleData,
  competitorsData: AuditCompetitorsData,
  benchmarks: VerticalBenchmarks
): AuditProjection['revenue_impact'] {
  const competitorAdvantage = 
    competitorsData.competitor_aggregate.avg_velocity_30d_per_month -
    (googleData.reviews_aggregate.velocity_30d_per_month ?? 0);
  
  const monthlyRevenueLoss = Math.max(0, competitorAdvantage) * benchmarks.per_review_value.median_usd;
  
  // Cumulative loss array — month 0 through 12
  const cumulative = [];
  for (let m = 0; m <= 12; m++) {
    cumulative.push({ month: m, loss_usd: Math.round(monthlyRevenueLoss * m) });
  }
  
  return {
    six_month_loss_usd: Math.round(monthlyRevenueLoss * 6),
    twelve_month_loss_usd: Math.round(monthlyRevenueLoss * 12),
    monthly_loss_run_rate_usd: Math.round(monthlyRevenueLoss),
    competitor_velocity_advantage: competitorAdvantage,
    per_review_value_used: benchmarks.per_review_value.median_usd,
    months_modeled: 12,
    cumulative_at_month: cumulative,
  };
}
```

### 2.8 New benchmark fields needed

Session 4's `vertical_benchmarks` table needs two additional fields. Add via migration `002-add-projection-params.ts`:

```ts
interface VerticalBenchmarks {
  // ... existing fields ...
  
  projection: {
    ranking_slide_onset_weeks: number;      // Sterling Sky baseline: 3 weeks
    velocity_half_life_days: number;        // how fast does momentum decay
    competitor_velocity_default: number;    // fallback when no competitor data
    ramp_months_with_baam: number;          // how fast we project ramp to Optimal velocity
  };
}
```

Per-vertical projection parameters (suggested values, calibrate later):

| Vertical | Slide onset (weeks) | Half-life (days) | Ramp (months) |
|---|---|---|---|
| tcm_clinic, dental | 3 | 90 | 3 |
| legal_immigration | 6 | 120 | 4 |
| restaurant | 2 | 60 | 2 |
| hotel | 2 | 60 | 2 |
| real_estate | 6 | 120 | 4 |
| others | 3 | 90 | 3 |

### 2.9 File structure

```
/baam-review/audit-engine/projection/
├── src/
│   ├── index.ts                          # computeProjection
│   ├── types.ts
│   ├── do-nothing-projector.ts
│   ├── with-baam-projector.ts
│   ├── revenue-impact.ts
│   ├── ranking-estimator.ts
│   └── velocity-decay.ts                 # shared decay function
├── migrations/
│   └── 002-add-projection-params.ts
└── tests/
```

### 2.10 Session 6 acceptance criteria

1. `computeProjection(drHuangData, drHuangCompetitors, drHuangScore, tcmBenchmarks)` returns a deterministic `AuditProjection`
2. `do_nothing_score` at month 6 is lower than current; `with_baam_score` is higher
3. Critical floor activates in do-nothing projection by month 3 (assuming current velocity_30d=0)
4. `six_month_loss_usd` matches the formula: `competitor_advantage × per_review_value × 6`
5. Timeline array has exactly 13 entries (months 0–12)
6. Pure function: identical inputs → identical outputs
7. Performance: <10ms per projection call
8. TS strict mode clean; Zod validates output
9. Edge case: when competitor_velocity ≤ primary_velocity, revenue_impact is 0 (no gap to monetize)
10. Edge case: when business has 0 reviews ever, projection still completes without errors (returns conservative estimates)

---

## 3. Session 8 · Templating + PDF + Delivery

### 3.1 What this session builds

The rendering pipeline that transforms audit data into a delivered PDF (or two PDFs for bilingual businesses). Five sub-components:

1. **Data mapper** — converts all the data structures (Google, competitors, score, projection, benchmarks) into a flat `AuditViewModel` with everything the templates need
2. **Language router** — decides whether to render EN, ZH, or both
3. **HTML renderer** — fills template tokens with view model data
4. **PDF renderer** — converts HTML to PDF via Puppeteer
5. **Delivery + storage** — uploads PDFs to Supabase Storage, sends emails, records the delivery

### 3.2 Public API

```ts
export async function renderAndDeliverAudit(
  input: RenderAuditInput
): Promise<RenderAuditOutput>

export interface RenderAuditInput {
  // Required data
  googleData: AuditGoogleData;
  competitorsData: AuditCompetitorsData;
  score: AuditScore;
  projection: AuditProjection;
  benchmarks: VerticalBenchmarks;
  
  // Customer context (from signup)
  customer: {
    user_id: string;
    email: string;
    name?: string;
  };
  
  tier: 'free' | 'paid';
  
  // Optional overrides
  force_language?: 'en' | 'zh' | 'both';   // bypass auto-detection
  send_email?: boolean;                     // default true
  store_pdf?: boolean;                      // default true
}

export interface RenderAuditOutput {
  audit_id: string;                         // UUID for the delivered audit
  languages_rendered: ('en' | 'zh')[];
  pdfs: {
    language: 'en' | 'zh';
    public_url: string;
    file_size_bytes: number;
    page_count: number;
  }[];
  email_sent: boolean;
  email_message_id?: string;
  rendered_at: string;
  generation_time_ms: number;
}
```

### 3.3 Data mapper

Flattens upstream data structures into a single view model:

```ts
function buildAuditViewModel(
  input: RenderAuditInput
): AuditViewModel
```

The view model has one field per template token. Examples:

```ts
interface AuditViewModel {
  // Cover meta
  business_name: string;
  business_name_secondary: string;
  business_address_line_1: string;
  business_address_line_2: string;
  vertical_display_name: string;            // "TCM Clinic" or "中醫診所"
  vertical_subtype: string;                  // "Acupuncture · Bilingual"
  audit_id: string;
  audit_date_display: string;                // "29 May 2026" or "2026 年 5 月 29 日"
  
  // Section 2 — snapshot table rows
  platform_rows: PlatformRowVM[];
  insight_callout_text: string;             // generated based on profile health
  
  // Section 3 — score
  score_total: number;
  score_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score_grade_diagnosis: string;
  subscore_rows: SubscoreRowVM[];
  
  // Section 3.5 — projection
  projection_chart_svg: string;             // pre-rendered SVG
  projection_six_month_score: number;
  projection_six_month_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  projection_revenue_loss: string;          // "$67,200" formatted
  projection_ranking_drop: string;          // "−3 to −4"
  
  // Section 4 — benchmarks
  per_review_value_median: string;          // "$1,400"
  per_review_value_range: string;           // "$400 — $2,400"
  velocity_min: number;
  velocity_optimal_low: number;
  velocity_optimal_high: number;
  velocity_aggressive: number;
  your_velocity: number;
  money_on_table_text: string;              // sentence template filled with numbers
  
  // Section 5 — competitors table
  competitor_rows: CompetitorRowVM[];
  competitor_diagnosis_text: string;
  
  // Section 6 — action plan
  action_items: ActionItemVM[];
  total_value_added: string;                // "+$139,400"
  total_value_lost_if_donothing: string;    // "$67,200"
  
  // Branding / theme
  language: 'en' | 'zh';
  is_chinese_business: boolean;
  page_count_total: number;                  // for "Page X / 07" labels
}

interface PlatformRowVM { /* G, Y, Z, H, F rows */ }
interface SubscoreRowVM { /* 5 score component rows */ }
interface CompetitorRowVM { /* 5 competitor rows */ }
interface ActionItemVM { /* 5 action items */ }
```

The data mapper has translation logic baked in via the language router (next section).

### 3.4 Language router

```ts
function decideLanguages(
  googleData: AuditGoogleData,
  override?: 'en' | 'zh' | 'both'
): ('en' | 'zh')[] {
  if (override === 'en') return ['en'];
  if (override === 'zh') return ['zh'];
  if (override === 'both') return ['en', 'zh'];
  
  // Auto-detection per framework v3
  if (googleData.language.is_chinese_business) {
    return ['en', 'zh'];   // bilingual delivery for Chinese-name businesses
  }
  
  return ['en'];
}
```

Triggers from `AuditGoogleData.language`:
- `is_chinese_business: true` → render both EN + ZH
- `is_chinese_business: false` → EN only

Output: array of languages to render. Each language produces a separate PDF.

### 3.5 Template structure

The design HTML files (`baam-review-audit-sample.html` and `baam-review-audit-sample-zh.html`) become templates with token replacement. Two approaches:

**Approach A: Handlebars/Mustache templates** (recommended for simplicity)

Convert the design HTML to `.hbs` files with `{{tokens}}`:

```html
<!-- audit-en.hbs -->
<div class="cover-meta-item">
  <div class="cover-meta-label">Business</div>
  <div class="cover-meta-value">{{business_name}}<span class="sub">{{business_name_secondary}}</span></div>
</div>
```

Pros: standard, fast, easy to maintain. Cons: limited logic (use helpers for conditionals).

**Approach B: React Server Components**

Render React components with TypeScript props. Pros: type safety, easy logic. Cons: more setup, heavier.

**Recommendation: Approach A (Handlebars).** The audit templates are mostly static structure + token replacement, not complex logic. Handlebars is simpler and adequate.

```
/baam-review/audit-engine/templating/templates/
├── audit-en.hbs
├── audit-zh-tc.hbs                       # Traditional Chinese
├── audit-zh-sc.hbs                       # Simplified Chinese (future)
├── partials/
│   ├── header.hbs
│   ├── footer.hbs
│   ├── platform-row.hbs                  # repeated per platform
│   ├── subscore-row.hbs                  # repeated per component
│   ├── competitor-row.hbs                # repeated per competitor
│   └── action-item.hbs                   # repeated per action
└── styles/
    └── audit-styles.css                   # extracted from design HTML <style>
```

### 3.6 Migration step from design HTML to templates

The existing design HTML files have ~1800 lines each. The migration is mechanical:

1. Extract `<style>` block to `audit-styles.css`
2. Identify all the places where Dr. Huang's data appears in the HTML
3. Replace with `{{tokens}}`
4. Identify repeating structures (platform rows, score rows, competitor rows, action items) — extract to partials
5. Verify rendered output with sample data matches the original design HTML

**Important:** this is mechanical work. Claude Code can do it as part of Session 8. The output should be visually identical to the original design HTML when rendered with Dr. Huang's data.

### 3.7 Translation layer

Strings that vary by language live in JSON files:

```
/baam-review/audit-engine/templating/translations/
├── en.json
├── zh-tc.json
└── zh-sc.json
```

Translation keys map to view-model fields where the actual text differs:

```json
// en.json
{
  "section_titles": {
    "01": "Why Reviews Decide Who Wins",
    "02": "Your Current Snapshot",
    "03": "Your BAAM Review Score",
    "04": "Industry Benchmarks",
    "05": "Competitor Comparison",
    "06": "Your 12-Month Action Plan",
    "A": "Appendix · Reference Tables"
  },
  "grade_diagnoses": {
    "A": "Winning your local market. Reviews are a competitive moat.",
    "B": "Strong — but losing ground to top competitors month over month.",
    "C": "Visible — but customers are choosing competitors with stronger reviews.",
    "D": "Bleeding customers to better-reviewed competitors every week.",
    "F": "Effectively invisible. Search and AI are skipping you entirely."
  },
  "action_items": {
    "post_visit_workflow": {
      "title": "Activate a post-visit review request workflow",
      "why": "You currently have no system. Sending a request 24–72 hours after every visit, in the customer's language, is the single biggest lever in this audit.",
      "result_template": "+{n} reviews / month"
    }
    // ... etc
  }
}
```

The Chinese design HTML already contains the canonical Chinese translations — extract them into `zh-tc.json` during the migration.

### 3.8 PDF generation

Using Puppeteer:

```ts
async function renderPdf(html: string, language: 'en' | 'zh'): Promise<Buffer> {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  const pdf = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });
  
  await browser.close();
  return pdf;
}
```

The design HTML already has print CSS configured (`@media print`). Puppeteer respects this and produces high-fidelity PDFs.

**Performance:** ~2–4 seconds per PDF. For bilingual businesses (2 PDFs), expect 4–8 seconds total. Acceptable for paid tier audit generation; for free tier "instant" audits, this may need to be backgrounded with a webhook.

**Production concern:** Puppeteer + Chromium has a heavy memory footprint (~300MB per browser instance). For a server handling 50 audits/day, run a pool of 2–3 browsers and reuse them. For Next.js deployment on Vercel, use `@sparticuz/chromium` (the slim Chromium build that fits Vercel's bundle limit).

### 3.9 Delivery

Email via Resend (you already use Resend for review-request emails per the conversation history):

```ts
async function deliverAudit(
  audit: RenderAuditOutput,
  customer: RenderAuditInput['customer']
): Promise<{ sent: boolean; message_id?: string }> {
  const subject = audit.languages_rendered.includes('zh')
    ? 'Your BAAM Review Audit · 您的 BAAM 評論審計報告'
    : 'Your BAAM Review Audit';
  
  const attachments = audit.pdfs.map(pdf => ({
    filename: `BAAM-Review-Audit-${audit.audit_id}-${pdf.language}.pdf`,
    path: pdf.public_url,
  }));
  
  // Email body — short, points to attached PDFs + cover info
  const html = renderEmailBody(audit, customer);
  
  return resend.emails.send({
    from: 'audits@baamreview.com',
    to: customer.email,
    subject,
    html,
    attachments,
  });
}
```

For bilingual businesses, send both PDFs as attachments in a single email with a bilingual subject line and body.

### 3.10 Storage

Supabase Storage bucket: `audit-pdfs` (public or signed-URL access depending on privacy needs)

```ts
async function storePdf(
  pdfBuffer: Buffer,
  auditId: string,
  language: 'en' | 'zh'
): Promise<string> {
  const filename = `${auditId}/${language}.pdf`;
  
  const { data, error } = await supabase.storage
    .from('audit-pdfs')
    .upload(filename, pdfBuffer, {
      contentType: 'application/pdf',
      cacheControl: '31536000',  // 1 year
    });
  
  if (error) throw new StorageError(error.message);
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('audit-pdfs')
    .getPublicUrl(filename);
  
  return urlData.publicUrl;
}
```

### 3.11 Persistent record

After successful render + delivery, write to `audits` table:

```sql
CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  
  -- Source data references
  business_place_id TEXT NOT NULL,
  vertical TEXT NOT NULL,
  region TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'paid')),
  
  -- Score snapshot
  total_score INTEGER NOT NULL,
  grade CHAR(1) NOT NULL,
  benchmark_version TEXT NOT NULL,
  
  -- Delivery
  languages_rendered TEXT[] NOT NULL,
  pdf_urls JSONB NOT NULL,           -- {en: "https://...", zh: "https://..."}
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_message_id TEXT,
  email_sent_at TIMESTAMPTZ,
  
  -- Cached snapshots (for re-rendering without re-fetching)
  google_data JSONB NOT NULL,
  competitors_data JSONB NOT NULL,
  score_data JSONB NOT NULL,
  projection_data JSONB NOT NULL,
  
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generation_time_ms INTEGER
);

CREATE INDEX idx_audits_user ON audits (user_id);
CREATE INDEX idx_audits_business ON audits (business_place_id);
CREATE INDEX idx_audits_generated ON audits (generated_at);
```

This is the customer-facing record. Day-90 re-audits (Session 13) query this table to compare before/after.

### 3.12 File structure

```
/baam-review/audit-engine/templating/
├── src/
│   ├── index.ts                          # renderAndDeliverAudit
│   ├── types.ts
│   ├── data-mapper.ts
│   ├── language-router.ts
│   ├── renderers/
│   │   ├── html-renderer.ts              # Handlebars + partials
│   │   ├── pdf-renderer.ts               # Puppeteer wrapper
│   │   └── chart-svg-generator.ts        # Do-Nothing chart SVG generator
│   ├── delivery/
│   │   ├── email-sender.ts               # Resend integration
│   │   └── audit-record-writer.ts        # Supabase insert
│   └── storage/
│       └── pdf-storage.ts                 # Supabase Storage uploader
├── templates/
│   ├── audit-en.hbs
│   ├── audit-zh-tc.hbs
│   ├── audit-zh-sc.hbs
│   ├── email-en.hbs
│   ├── email-zh.hbs
│   ├── partials/
│   └── styles/audit-styles.css
├── translations/
│   ├── en.json
│   ├── zh-tc.json
│   └── zh-sc.json
└── tests/
```

### 3.13 Session 8 acceptance criteria

1. `renderAndDeliverAudit({...drHuangInputs, force_language: 'en'})` returns `RenderAuditOutput` with 1 EN PDF, public URL accessible
2. Same call with `force_language: 'zh'` returns 1 ZH PDF, content visibly Chinese
3. Same call with `force_language: 'both'` returns 2 PDFs
4. Auto-detection: Chinese-name business returns both EN+ZH; English-name business returns EN only
5. PDF visually matches design HTML (do side-by-side comparison)
6. PDF file size 200KB–800KB
7. PDF page count = 7 (or 6 for free tier without appendix — TBD)
8. Email delivered with PDFs attached; message ID recorded
9. Audit record written to `audits` table with all snapshots
10. Generation time <15 seconds for bilingual paid audit
11. Free tier audit excludes Section 4 (benchmarks), Section 5 (competitors), Section 6 (action plan), Appendix — keeps only Sections 1, 2, 3 + a CTA to upgrade
12. TS strict mode clean
13. Handlebars templates render with sample data identical to design HTML

### 3.14 Free tier rendering distinction

The free tier audit (per architectural anchor #3 of Session 1) gets a **truncated** version of the report:

| Page | Content | Free | Paid |
|---|---|---|---|
| 1 | Cover + Section 1 (Why Reviews) | ✓ | ✓ |
| 2 | Section 2 (Snapshot) | ✓ | ✓ |
| 3 | Section 3 (Score) | ✓ | ✓ |
| 3.5 | Do-Nothing Projection | ✗ → upgrade CTA | ✓ |
| 4 | Industry Benchmarks | ✗ → upgrade CTA | ✓ |
| 5 | Competitor Comparison | ✗ → upgrade CTA | ✓ |
| 6 | Action Plan | ✗ → upgrade CTA | ✓ |
| 7 | Appendix | ✗ | ✓ |

The free tier PDF is ~3 pages — Sections 1, 2, 3 + a final "Upgrade for the full audit" page with a clear value proposition and Stripe link.

Implementation: same template, with Handlebars `{{#if isPaid}}...{{/if}}` blocks around the gated sections.

---

## 4. End-to-End Integration

After Sessions 6+8 ship, the full pipeline exists:

```ts
async function generateAudit(userId, businessReference, tier) {
  // Session 1
  const googleData = await getGoogleBusinessData(businessReference, tier);
  
  // Session 3
  const competitorsData = await getCompetitorsData(googleData, tier);
  
  // Session 4
  const benchmarks = await getBenchmarksForBusiness(googleData);
  
  // Session 5
  const score = computeAuditScore(googleData, competitorsData, benchmarks);
  
  // Session 6
  const projection = computeProjection(googleData, competitorsData, score, benchmarks);
  
  // Session 8
  const customer = await getCustomerFromUserId(userId);
  const audit = await renderAndDeliverAudit({
    googleData, competitorsData, score, projection, benchmarks,
    customer, tier,
  });
  
  return audit;
}
```

This is the function that gets called when a customer requests an audit. After Sessions 6+8, **the audit product works end-to-end.** All that remains is the customer-facing UI (Sessions 10+11).

### 4.1 End-to-end performance target

| Stage | Time budget |
|---|---|
| Google data fetch (Session 1) | 1–3 seconds |
| Competitors fetch (Session 3, parallel) | 1–2 seconds |
| Benchmark lookup (Session 4) | <100ms |
| Scoring (Session 5) | <5ms |
| Projection (Session 6) | <10ms |
| HTML rendering (Session 8) | <500ms |
| PDF generation (Session 8, per language) | 2–4 seconds |
| Storage upload (Session 8, per PDF) | <1 second |
| Email send (Session 8) | <1 second |
| **Total — English-only paid audit** | **~10 seconds** |
| **Total — bilingual paid audit** | **~14 seconds** |
| **Total — free tier audit** | **~6 seconds** |

These targets are aggressive but achievable given Session 3's measured 1.1-second performance.

---

## 5. Open Questions

1. **Do-nothing decay model accuracy.** The current model assumes uniform review distribution within historical windows. Real distributions are usually bursty (clusters of reviews from promotional events, etc.). After 50 audits, examine `audit_score_runs` data to validate or refine. Recommend: **ship v1, calibrate later** — same pattern as Session 4 benchmarks.

2. **Ranking estimate confidence.** The Sterling Sky-based ranking estimate is a rough heuristic. Real ranking depends on dozens of factors beyond review velocity. The output schema includes `confidence: 'low' | 'medium' | 'high'` — start everything as `'medium'` and degrade to `'low'` for edge cases. Recommend: **use sparingly in audit copy** — don't make hard ranking predictions, talk in ranges and probabilities.

3. **PDF rendering on Vercel.** Puppeteer + full Chromium exceeds Vercel's serverless function size limit. Options: (a) use `@sparticuz/chromium` slim build, (b) run PDF generation on a separate worker (Railway, Fly.io). Recommendation: **start with @sparticuz/chromium on Vercel**; migrate to dedicated worker if performance suffers.

4. **Audit re-render after benchmark version change.** When v1.1 benchmarks ship (per Session 4's calibration plan), should existing audits be re-rendered with the new benchmarks? Recommendation: **no, existing audits are point-in-time snapshots**. New audits use new benchmarks; old PDFs remain unchanged. Day-90 re-audits use whatever benchmark is active at that time.

5. **Free tier truncation strategy.** The free tier excludes Sections 4–6. Two approaches: (a) generate the full report and crop pages, (b) use conditional rendering in the template. Recommendation: **(b) conditional rendering** — cleaner, smaller PDFs, no wasted data fetching.

6. **Bilingual email body.** When both EN + ZH PDFs are sent, should the email body be: (a) English only, (b) Chinese only, (c) bilingual side-by-side, (d) language preference from user signup? Recommendation: **(c) bilingual short body** — short enough to fit comfortably, signals "we serve both" professionally.

7. **PDF page size — Letter or A4?** US market = Letter. Recommendation: **Letter by default**, A4 as future option for international expansion.

---

## 6. Implementation Order

**Session 6 first** (pure logic, faster to validate):

1. Add `projection` field to `vertical_benchmarks` schema via migration 002
2. Implement `velocity-decay.ts` (pure function)
3. Implement `do-nothing-projector.ts`
4. Implement `with-baam-projector.ts`
5. Implement `revenue-impact.ts`
6. Implement `ranking-estimator.ts`
7. Implement `computeProjection` orchestrator
8. Tests against Dr. Huang fixture — expect six-month do-nothing in D range

**Then Session 8** (multi-component, more involved):

Sub-phase 8A: Templating + HTML rendering
1. Convert `baam-review-audit-sample.html` to `audit-en.hbs` (tokenize)
2. Convert `baam-review-audit-sample-zh.html` to `audit-zh-tc.hbs`
3. Extract partials and CSS
4. Build `data-mapper.ts` for view model construction
5. Build `language-router.ts`
6. Build `html-renderer.ts` with Handlebars
7. Build `chart-svg-generator.ts` for projection chart
8. Test rendering — visual diff against original design HTML

Sub-phase 8B: PDF + delivery
9. Set up Puppeteer + `@sparticuz/chromium`
10. Build `pdf-renderer.ts`
11. Build `pdf-storage.ts` (Supabase Storage)
12. Build `email-sender.ts` (Resend integration)
13. Build `audit-record-writer.ts` (Supabase insert)
14. Build `renderAndDeliverAudit` orchestrator
15. End-to-end test with Dr. Huang fixture

---

## 7. Timing Estimate

- Session 6: **2 Claude Code sessions** (pure logic, parallel pattern to Session 5)
- Session 8A (templating + HTML): **3–4 Claude Code sessions** (template migration is mechanical but extensive)
- Session 8B (PDF + delivery): **2–3 Claude Code sessions** (Puppeteer setup + integration)
- Total: **7–9 Claude Code sessions over 2–3 weeks**

By the end of Sessions 6+8, you have a working audit product. Customers can be sent through it manually (no UI yet) and receive their audits via email.

---

## 8. What's Left After Sessions 6+8

The remaining session is **Session 10 (auth + tier flows + customer-facing UI)** — the wrapper around everything else.

Specifically:
- Signup flow (email/password + Google OAuth)
- Free audit landing page + form
- Paid audit landing page + Stripe checkout
- Audit history dashboard for logged-in users
- Email verification + transactional emails
- Tier resolution: maps a user's payment status → `tier: 'free' | 'paid'` value passed to `getGoogleBusinessData()` and downstream

Plus the deferred **Session 2 (multi-platform: Yelp/Zocdoc/Healthgrades/Facebook)** which now has a clear hook to be added — the templates and data mapper already handle the absence of secondary platforms gracefully, and adding them is enrichment, not a new architecture.

After Session 10 + (deferred) Session 2, the BAAM Review Audit product is feature-complete.

---

## 9. Critical Note on Sessions 6+8 Together

The Session 6 → Session 8 handoff is where the whole audit comes together visually for the first time. Specifically: **the Do-Nothing chart on page 3 of the audit** is the single most persuasive visual asset in the entire product, and its data comes entirely from Session 6.

When Session 6 ships, you should be able to look at the projected timeline data and feel something — either "yeah, this matches how I'd expect a sleeping clinic to decay" or "wait, this looks wrong." That gut-check matters. If the curves don't match intuition, fix the model in Session 6 before locking the templates in Session 8.

When Session 8 ships, you have a real PDF that looks identical to the design HTML, with real data instead of Dr. Huang's hardcoded values. That moment — running the pipeline against a real Flushing business and getting back a PDF that doesn't say "Dr. Huang" anywhere — is when the product becomes real.

Good luck.
