# Service Inference Guide (How BAAM Gets Service)

This document explains how BAAM Review determines service on the New Audit flow, from raw business data to final Recommended Service.

---

## 1) Terminology used in UI

- `Google Service (GS)`: service inferred from Google profile categories/types.
- `BAAM-generated Service (BS)`: service selected by BAAM's comprehensive inference engine.
- `Recommended Service (RS)`: final system recommendation used for competitor query and report generation (editable by user before confirm).

---

## 2) End-to-end flow

Main route: `app/api/audit/resolve/route.ts`

When user clicks "Find my business", the system does:

1. Load business profile from Google via `getGoogleBusinessData(...)`.
2. Fetch website text signal via `fetchWebsiteServiceSignalText(...)`.
3. Build a fallback service from legacy resolver (`resolveServiceKeyword(...)`).
4. Run comprehensive candidate selection (`pickTopComprehensiveService(...)`).
5. Set `detected_service` to comprehensive top candidate when available, otherwise fallback.
6. Run reconciliation (`reconcileServiceDecision(...)`) to produce final `cs_recommended_service`, confidence, and reason codes.
7. Return top candidates (up to 3) to UI for debug transparency.

---

## 3) Comprehensive candidate generation (V2 core)

Core module: `lib/audit/service-candidate-generator.ts`

### Inputs used for candidate generation

- business name
- Google primary type/category display
- Google categories (`google_categories`)
- GBP editorial description
- website extracted text
- website URL/domain/path/query tokens
- seed service from fallback resolver
- industry prior by inferred vertical (for example `tcm_clinic -> acupuncture`)

### Candidate sources

Each candidate can accumulate score from multiple sources:

- `seed`
- `vertical_prior`
- `google_category_display`
- `google_primary_type`
- `detail_vision`
- `detail_manufacturer`
- `detail_retail`
- `name_match`
- `description_match`
- `website_match`
- `category_match`

### Candidate ranking behavior

- Candidates are normalized via taxonomy (`canonicalizeService`).
- Generic/broad services receive a penalty (for example `manufacturer`, `service`, `store`, `local business`).
- If top candidate is broad and a close, more specific candidate exists, system prefers the specific one.
- Output includes score, confidence, specificity, and sources.

---

## 4) Reconciliation to final RS

Core module: `lib/audit/service-reconciler.ts`

The reconciler merges:

- `GS` (Google-derived service)
- `BS` (comprehensive top candidate or fallback)
- text signals from GBP/website
- detail-industry signals
- weighted model decision

### Important safeguards

- Broad generated candidates are dampened in weighted model.
- Weighted override cannot downgrade to lower specificity just because confidence is slightly higher.
- If final recommended service equals comprehensive top candidate, confidence is lifted by `comprehensive_confidence_support`.

This prevents generic terms (for example `medical clinic`) from pulling a specific result (for example `acupuncture`) backward.

---

## 5) Taxonomy + detail rules

### Taxonomy

File: `lib/audit/service-taxonomy.ts`

- canonical services
- aliases/synonyms (including Chinese aliases where relevant)
- specificity scores
- source weights and vertical boosts

### Detail rules

- Manufacturer: `lib/audit/manufacturer-detail-rules.ts`
- Vision: `lib/audit/vision-detail-rules.ts`
- Retail/rug cases: `lib/audit/retail-detail-rules.ts`

These rules generate high-precision service candidates when signal text matches strong domain patterns.

---

## 6) UI behavior on confirm step

File: `app/audit/new/intake-form.tsx`

Step 3 shows:

- Google Service
- BAAM-generated Service
- Debug block: `Top candidates (up to 3)` with score/confidence/specificity/source tags
- Recommended Service editable input

Why "up to 3": after normalization and dedupe, some businesses only have 1-2 meaningful unique candidates.

---

## 7) Why a service can still be wrong

Most common reasons:

1. Very weak text evidence (empty description + weak website content).
2. Business name is highly generic and categories are broad.
3. Missing taxonomy alias for a niche term.
4. Missing detail rule for a vertical-specific phrase.

In these cases user confirmation is the final safety gate.

---

## 8) How to improve accuracy continuously

Use loop script:

```bash
pnpm service:coverage-loop -- --days 30 --limit 1500 --samples 12
```

Output helps identify:

- broad recommendations overridden by users
- top model->user transition pairs
- highest-value next taxonomy/rule targets

For Phase 2 shadow validation, compare current reconciler vs analyst recommendation:

```bash
pnpm service:shadow-eval -- --days 30 --limit 500 --samples 12
```

Optional (more costly) LLM analyst run:

```bash
pnpm service:shadow-eval -- --days 14 --limit 150 --llm
```

This script reports:

- current hit-rate vs user-confirmed service
- analyst hit-rate vs user-confirmed service
- improved and regressed samples
- recommendation changes requiring manual review

For persistent production tracking (no script required):

- apply migration `supabase/migrations/0060_audit_service_shadow_logs.sql`
- enable shadow in resolve API with `SERVICE_ANALYST_SHADOW=1`
- generate audits normally; rows are logged on `/api/audit/generate`
- review metrics at `/app/admin/service-learning` (internal/staff only)

Phase 3 distilled layer is implemented in `lib/audit/service-distilled-ranker.ts`:

- lightweight ranker (no online LLM required)
- uses candidate score, confidence, specificity, source diversity
- applies generic-service penalties and specific multi-source bonus
- serves as both standalone cheap ranker and LLM fallback

After any service logic change, run:

```bash
npx tsx scripts/test-service-recommendation-stress.ts
npx tsx scripts/test-service-recommendation-human-benchmark.ts
```

Ship only if no critical regressions.

---

## 9) Practical operator rule

- Trust RS when it is specific and supported by multiple sources.
- If RS is broad and confidence is moderate, refine manually in UI.
- Always confirm before generate; user-confirmed service is the final source of truth for that audit.
