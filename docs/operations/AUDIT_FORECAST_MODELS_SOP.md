# Audit Forecast Models — Standard Operating Procedure

How the audit report projects a business's future: the **review-quantity
model** (how many more reviews/month we target) and the **score-curve model**
(the 0–100 BAAM Review Score over 12 months). This documents the rules so the
numbers in the report are explainable to customers and consistent across the
team.

**Audience**: BAAM Review staff (sales / account managers) explaining the
report, and engineers maintaining the projection logic.

**Where it lives in code**
- Review-quantity model: `reviewVelocityGain()` in `lib/audit/templating/data-mapper.ts`
- Score curve: `projectWithBaamScore()` in `lib/audit/projection/with-baam-projector.ts`, clamped in `lib/audit/projection/index.ts`
- Forecast copy: `projection_floor` + `cover_toc` in `lib/audit/templating/labels.ts`; chart in `lib/audit/templating/chart-svg.ts`

**Vertical velocity bands** (per-vertical, from `lib/audit/benchmarks/seed-data.ts`):
`minimum → optimal_low (OL) → optimal_high (OH) → aggressive (AG)` reviews/month.

| Vertical | OL | OH | AG |
|---|---|---|---|
| Dental / TCM clinic | 4 | 8 | 10 |
| Salon / Spa | 8 | 12 | 15 |
| Restaurant | 10 | 15 | 20 |
| Legal / Immigration | 3 | 5 | 6 |

---

## Part 1 — Review-Quantity Model

Answers: **"How many more reviews per month should this business target, and
what does that compound to over 12 months?"** Drives Action #1 ("+X reviews /
month"), the action's right-column ("+N reviews / 12 months"), and the §06
Conclusion ("+N new reviews" and the review-asset value).

### The rule

Let `v` = current reviews/month (`velocity_30d_per_month`).

```
v < OL          → target = OH          (climb into the healthy zone)
OL ≤ v < AG     → target = AG          (push to / close in on dominant)
v ≥ AG          → target = v × 1.15    (extend an existing lead)

gain_per_month  = max( round(target − v), 1 )     ← floored at +1
gain_per_year   = gain_per_month × 12
```

The "ambitious" framing is deliberate: once a business is healthy, the goal
becomes dominance (aim at AG), not merely staying healthy.

### The four cases in detail

#### Case 1 — Below optimal-low (`v < OL`) → target **optimal-high**
- **Who:** under-collectors (silent or barely collecting).
- **Why OH, not OL:** lift them to the *top* of the healthy band so they clear
  it decisively, not just scrape into it.
- **Gap:** `OH − v` (the largest gains in the model).
- **Examples:** Dental v=1 → 8 = **+7/mo (+84/yr)**; Restaurant v=6 → 15 = **+9/mo (+108/yr)**.

#### Case 2 — Between optimal-low and optimal-high (`OL ≤ v < OH`) → target **aggressive**
- **Who:** healthy collectors already in the optimal band.
- **Why AG:** they don't need to "get healthy" — the opportunity is to dominate.
- **Gap:** `AG − v`.
- **Examples:** Dental v=5 → 10 = **+5/mo (+60/yr)**; Restaurant v=12 → 20 = **+8/mo (+96/yr)**.

#### Case 3 — Between optimal-high and aggressive (`OH ≤ v < AG`) → target **aggressive**
- **Who:** strong collectors in the upper healthy zone, near dominant.
- **Behavior:** same rule as Case 2 (target = AG); because `v` is close to AG,
  the gap is **small** — correctly reflecting little room left.
- **Gap:** `AG − v` (small).
- **Examples:** Dental v=9 → 10 = **+1/mo (+12/yr)**; Restaurant v=17 → 20 = **+3/mo (+36/yr)**.

> In code, Cases 2 and 3 are one branch (`OL ≤ v < AG → target AG`). They
> differ only in distance from AG, which shrinks the gain as the business climbs.

#### Case 4 — Above aggressive (`v ≥ AG`) → target **v × 1.15**
- **Who:** already dominant — collecting faster than the aggressive benchmark.
- **Why ×1.15:** no higher benchmark to aim at, so propose a modest **15%
  stretch** ("extend the lead") instead of a flat +1.
- **Gap:** `0.15 × v` (rounded, floored at +1).
- **Examples:** Dental v=27 → ≈31 = **+4/mo (+48/yr)**; Restaurant v=22 → ≈25 = **+3/mo (+36/yr)**.

### Guardrails
- **Floor of +1/mo** (`max(…, 1)`): every business shows at least a +1 lever, so
  Action #1 never reads as zero — even a maxed-out collector.
- **Intentional jump at OL:** crossing from "below healthy" to "in healthy"
  flips the target from OH to AG, so the target steps up on entering the band
  (e.g. Dental v=3 aims at 8, but v=4 aims at 10).

---

## Part 2 — Score-Curve Model (§05 The Forecast)

Answers: **"Where does the 0–100 BAAM Review Score go over 12 months, with vs.
without our service?"** Drives the §05 chart, the "12-Month Score" cell
(current → projected), the "the gap" label, and the forecast blurb.

The "With BAAM" score is recomputed each month from projected components
(rating, review volume, velocity at 30/180/365d) using the same rubric as the
live score, then **clamped**.

### Hard guarantees (never violate)
1. **With BAAM ≥ today's score** — the service can only hold or improve. The gap
   is always ≥ +1, never negative.
2. **Monotonic & capped** — the curve only rises month-over-month, capped at 100.
3. **No modeled slowdown** — projected velocity uses `target = max(current pace,
   optimal_low)`, so a fast collector keeps its pace instead of regressing.
   (This was the root cause of the old "95 → 83" bug.)
4. **Diminishing returns near the top** — less headroom as the score approaches 100.
5. **Do-nothing baseline is drawn flat at the current score** — the chart shows
   "hold flat vs. climb," a conservative, defensible comparison. (The raw
   do-nothing model still computes a decline internally; it is intentionally not
   shown.)

### Behavior by starting grade (real audit examples)

| Band | Examples (current → 12-mo) | Typical gap | Copy shown |
|---|---|---|---|
| **F (0–39)** | 20→72, 36→76, 38→78 | +40 to +52 | "Climbs from F to C/B" |
| **D (40–59)** | 42→78, 54→82, 55→82 | +27 to +36 | "Climbs from D to B" |
| **C (60–74)** | 71→88, 73→86, 66→82 | +10 to +17 | "Climbs from C to B" |
| **C (stays C)** | 64→70 (already ~6/mo) | +6 | "Score climbs steadily…within tier" |
| **B (75–89)** | 83→98, 87→91, 89→90 | +1 to +15 | "Climbs from B to A" |
| **A (90–100)** | 95→97, 96→99 | +2 to +3 | "Already at the top — defends your Grade A lead" |

### Copy rules (`buildProjectionFloorBlurb`)
- **Grade improves** → `"Climbs from {from} to {to} …"`
- **Stays Grade A** → `"Already at the top — sustained collection defends your Grade A lead and edges toward 100"`
- **Same non-A grade** → `"Score climbs steadily…within tier"`
- **Chart "the gap" label** → `"+N points / 12 months"` when the lift > 0, else `"holds Grade {grade} / 12 months"`.

### Shape summary
- **Low scorers** get the hero story — big, multi-grade climbs (steepest curves).
- **Mid scorers** climb a grade — believable +10–17.
- **High scorers** get a "defend & edge up" story — small positive (+1–3),
  capped near 100, reframed from "climb" to "defend." Never a false A→B drop.

---

## Relationship between the two models
Both share the **"don't model a slowdown"** principle (`max(current, optimal_low)`),
but answer different questions:
- **Review-quantity** → *how many more reviews* (band-tiered target).
- **Score curve** → *what score* (rubric recompute + clamp).

They are computed independently and can move differently — e.g. an already-fast,
mid-score business shows a small review-quantity gain (near AG) but a healthy
score climb (room in rating/volume).

---

## When to change these models
- **Band values** live in `lib/audit/benchmarks/seed-data.ts` (per vertical).
- **Review-quantity targets** (ambitious vs conservative) → `reviewVelocityGain()`.
- **Score guarantees / clamp** → `computeProjection()` in `lib/audit/projection/index.ts`.
- After any change, re-render samples (`scripts/test-render-audit.ts`) and, if
  needed, re-render stored audit PDFs so existing reports reflect the new logic.
