# Service Generation Guide (Production Flow + Model Conditions)

This guide documents the **actual production path** for how BAAM Review generates service, which model is used under each condition, and how confirmed service is carried into competitor discovery and report rendering.

Main production routes/files:

- Resolve: `app/api/audit/resolve/route.ts`
- Confirm + generate: `app/api/audit/generate/route.ts`
- Async pipeline: `lib/audit/delivery/start-audit.ts`
- Analyst logic + model cascade: `lib/audit/service-analyst.ts`
- Deterministic reconciliation: `lib/audit/service-reconciler.ts`
- Report mapper/rendering: `lib/audit/templating/data-mapper.ts`

---

## 1) Terms used in production

- `GS` (`gs_service`): Google-derived service hint (category/type mapping).
- `BS` (`bs_service`): BAAM service after inference/reconciliation.
- `CS` (`cs_recommended_service`): final recommended service returned by resolve API.
- `Confirmed service`: user-confirmed service from Step 3 and sent as `service_override` to `/api/audit/generate`.

---

## 2) Resolve step (service inference before user confirm)

When user clicks “Find my business”, `/api/audit/resolve` does:

1. Load Google business profile (`getGoogleBusinessData(..., "free")`).
2. Extract website signals from homepage + selected secondary pages (`fetchWebsiteServiceSignalText`).
3. Build deterministic baseline:
   - seed service (`resolveServiceKeyword`)
   - comprehensive top (`pickTopComprehensiveService`)
   - ranked candidates (`generateServiceCandidates`)
4. Run primary analyst (`analyzeServiceWithAnalyst`) if enabled.
5. Reconcile deterministic + evidence (`reconcileServiceDecision`).
6. Apply forced LLM default (`applyLlmForcedDefault`) when primary analyst mode is `llm`.
7. Return UI payload:
   - `gs_service`, `bs_service`, `cs_recommended_service`
   - candidate list/options
   - `primary_analyst`, `service_shadow`
   - `service_model_debug` (provider/model/fallback info)

Key behavior now:

- If LLM returns successfully (`mode: "llm"`), resolve forces BS/CS to LLM phrase/result.
- This is intentionally opinionated to prioritize LLM business-phrase output.

---

## 3) Candidate generation logic (deterministic layer)

Core: `lib/audit/service-candidate-generator.ts`.

Evidence inputs:

- business name
- Google primary category display + primary type + additional categories
- GBP description
- website extracted text
- website URL host/path/query tokens
- vertical prior defaults
- seed service
- vertical detail rules (vision/manufacturer/retail/window-treatment)

Candidate scoring:

- accumulates per-source weights
- broad/generic penalties apply
- emits candidate objects with `score`, `confidence`, `specificity`, `sources`

Used in both:

- baseline recommendation
- context for LLM prompts/verifier

---

## 4) Model usage and fallback conditions

Core: `lib/audit/service-analyst.ts`.

### 4.1 Enable conditions

LLM path is used when:

- `useLlm` is true from caller, and
- at least one key exists: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`.

Otherwise, output is `mode: "distilled"`.

### 4.2 Model order (primary + fallback)

Primary model:

1. `SERVICE_ANALYST_CLAUDE_MODEL`
2. else `ANTHROPIC_MODEL`
3. else default `claude-opus-4-8`

Fallback order if primary fails/invalid:

1. Anthropic fallback: `claude-sonnet-4-5-20250929`
2. OpenAI fallback: `SERVICE_ANALYST_GPT_FALLBACK_MODEL`
3. else `OPENAI_MAIN_MODEL`
4. backup fallback: `gpt-4o-mini`
5. if all LLM attempts fail -> distilled fallback

### 4.3 Opus-specific transport rule

For `claude-opus-4-8`, `temperature` is omitted from Anthropic request payloads because this model rejects temperature in our endpoint usage.

### 4.4 Verifier pass

When recommendation/category is broad or ambiguous, verifier pass runs with similar fallback logic and can refine phrase/recommendation.

### 4.5 Runtime debug visibility

Resolve response includes:

- `primary_analyst.llm_provider`, `llm_model`, `llm_fallback_used`
- `service_shadow.llm_provider`, `llm_model`, `llm_fallback_used`
- `service_model_debug` summary block

This is the source of truth to inspect “which model actually answered”.

---

## 5) Confirm + generate gate (user is final authority)

`/api/audit/generate` enforces:

- `service_confirmed` must be true
- `service_override` must be present
- broad service values are blocked
- if `needs_service_selection` is true, selected service must be in `service_options`

Then pipeline input stores:

- `vertical_override`
- `service_override`
- language choice

---

## 6) How confirmed service is used in production pipeline

In async generation (`runAuditPipeline`):

- Google is fetched in paid tier.
- Competitor discovery uses user-confirmed `service_override`:
  `getCompetitorsData(..., { service_override })`
- Competitor keyword variants are derived from that service.

This means confirmed service drives:

- competitor search query
- competitor set
- downstream score/projection context

---

## 7) Report rendering consistency with confirmed service

To make display consistent with user-confirmed service:

1. During generation, `score_data.service_context.confirmed_service` is persisted.
2. In report data-mapper, cover service display resolves in this order:
   - `score.service_context.confirmed_service` (preferred)
   - legacy fallback from `competitors.search_metadata.primary_keyword` (city-stripped)
   - fallback to `resolveServiceKeyword(google)`

So new audits are fully aligned to confirmed service; old audits still get best-effort alignment.

---

## 8) Environment flags that affect behavior

- `SERVICE_ANALYST_PRIMARY` (`1`/`0`)
- `SERVICE_ANALYST_PRIMARY_USE_LLM` (`1`/`0`)
- `SERVICE_ANALYST_SHADOW` (`1`/`0`)
- `SERVICE_ANALYST_SHADOW_USE_LLM` (`1`/`0`)
- `SERVICE_ANALYST_CLAUDE_MODEL`
- `ANTHROPIC_MODEL`
- `SERVICE_ANALYST_GPT_FALLBACK_MODEL`
- `OPENAI_MAIN_MODEL`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

---

## 9) Operational checklist

When validating service behavior in production:

1. Check `/api/audit/resolve` response:
   - `service_model_debug.primary`
   - `bs_service`, `cs_recommended_service`
2. Confirm generate request carries `service_override`.
3. Verify competitor metadata on resulting audit:
   - `competitors_data.search_metadata.primary_keyword`
4. Verify report display service:
   - should match `score_data.service_context.confirmed_service` for new audits.

