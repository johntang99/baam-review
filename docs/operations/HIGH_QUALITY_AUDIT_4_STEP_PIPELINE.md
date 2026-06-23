# High-Quality Business Audit — 4-Step Pipeline (Technical SOP)

**Audience:** BAAM Review product, engineering, and operations.  
**Goal:** Produce the highest-quality paid audit by combining strong system automation with explicit human confirmation gates.

---

## 0) Why this pipeline exists

For paid business audits, quality must be deterministic and reviewable.  
This 4-step flow separates:

1. **Data lock-in** (what business we are auditing)
2. **Service lock-in** (what service vertical and sub-service we should use)
3. **Competitor lock-in** (which competitors are truly relevant)
4. **Generation lock-in** (report is generated only after confirmed inputs)

The key principle is simple: **automate candidate generation, require human confirmation at critical decision points.**

---

## 1) Step 1 — Intake + Identity Lock

### Purpose
Normalize the target business identity and collect enough structured data to support service and competitor decisions.

### Inputs
- User-entered business name, address, city/state, optional website
- Optional user-selected industry hint from the intake dropdown

### System actions
1. Call Google Places search and details endpoints to resolve the best matched GBP profile.
2. Normalize and store business profile data:
   - place id / name / address / phone / website
   - Google types/categories
   - editorial summary / description (if available)
3. Run initial profile-health extraction so downstream modules can reason about data confidence.

### Outputs
- `business identity` (locked target business record)
- `google evidence package` (types, categories, description, website, metadata)
- `vertical options` for UI (including alias options shown to users)

### Quality gate (must pass)
- Match quality is acceptable (name/location match is coherent)
- If mismatch is suspected, user must correct target before proceeding

### Failure handling
- If no reliable GBP match, block forward flow and require user correction.
- If website is missing/unreachable, continue with GBP-only signals but reduce confidence.

---

## 2) Step 2 — Service Reconciliation + RS Confirmation

### Purpose
Produce a **Recommended Service (RS)** that is specific enough for high-quality competitor discovery and final report generation.

### Current decision model (production)
Step 2 now runs a **comprehensive candidate-first** pipeline. `keyword-resolver` is a supporting/fallback signal, not the decision center.

Primary modules:

- `lib/audit/service-candidate-generator.ts`
- `lib/audit/service-reconciler.ts`
- `lib/audit/service-taxonomy.ts`

### Candidate sources used

The candidate generator combines:

- **Seed service:** fallback from resolver
- **Industry prior:** default service by inferred vertical (for example TCM -> acupuncture)
- **Google category evidence:** primary type + category display + category tokens
- **GBP description evidence**
- **Website evidence:** extracted webpage signal + URL/domain/path tokens
- **Detail rules:** manufacturer / vision / retail rule engines
- **Taxonomy lexical matches:** name / description / website / category token matches

### Core logic (high-level)
1. Normalize evidence and map services to canonical taxonomy values.
2. Generate multiple candidates with source-attributed score/confidence/specificity.
3. Apply broad-term penalty to generic services (for example `manufacturer`, `service`, `store`, `local business`).
4. Prefer specific alternatives when top broad candidate is close in score.
5. Reconcile GS + BS + external text signals + detail candidates through weighted model.
6. Block specificity downgrade in weighted override (a lower-specificity candidate cannot replace a stronger specific candidate by small confidence deltas).
7. If final RS equals comprehensive top candidate, align confidence upward via comprehensive confidence support.

### UI contract
At confirmation screen:
- Show **Google Service** (read-only evidence)
- Show **BAAM-generated Service** (read-only evidence)
- Show **Debug · Top candidates (up to 3)** with score/confidence/specificity/source tags
- Show **Recommended Service** as editable input (`RS`)
- Require explicit user confirmation before generating audit

### Quality gate (must pass)
- User confirms RS (or edits then confirms)
- Unconfirmed state blocks "Generate Audit" and shows reminder modal

### Failure handling
- If GS and BS conflict heavily and external text is weak, keep confidence conservative and force visible user confirmation.
- If RS remains broad/generic, prefer specific candidate alternatives when signal support exists.
- If only 1-2 unique high-quality candidates remain after canonicalization/dedupe, UI shows fewer than 3 candidates by design.

---

## 3) Step 3 — Competitor Generation + Confirmation

### Purpose
Generate a high-precision competitor set using the confirmed RS and location context, then let user validate.

### Upstream dependency
- **Must use confirmed RS** from Step 2 as primary service keyword anchor.

### Candidate generation layers
1. **Google Places local discovery**
   - Search nearby competitors by RS-focused keywords
   - Adaptive radius + filters (self-match removal, operational viability checks)
2. **Organic discovery (when enabled / available)**
   - Add SEO competitors from search-domain evidence (for broader market view)
3. **Merge + dedupe**
   - Merge by normalized identity/domain/place data
   - Keep rank metadata and source attribution per competitor

### Where Outscraper fits
Outscraper is an **enrichment layer**, not the primary discovery layer.

- Use Outscraper after candidate competitors are selected/confirmed to pull deeper review history and richer review signals.
- Do not rely on Outscraper alone to define the competitor list.

### Fast mode + timeout resilience (current production behavior)
Step 3 supports **fast mode** so users can see a competitor preview quickly while
paid enrichment continues in the background.

- Preview can return with status `ready` or `hydrating`.
- Scenario snapshot (`scenario_id`) is created so Step 4 can reuse Step 3 work.
- Enrichment calls use configured timeout and retry strategy.
- If live enrichment times out/fails, system attempts paid-cache fallback before degrading.
- Background hydration continues until scenario becomes `ready` or `failed`.

**Important quality rule:** timeout does **not** mean immediate data loss; in most
cases the system still reaches complete competitor data via retry/cache/hydration.
When completion is not achieved, generation is blocked and user must regenerate.

### Confirmation UI behavior
- Show candidate competitors with key context (name, distance/location relevance, rating/reviews, source)
- Require user to remove irrelevant competitors and keep final list
- Persist selected competitor place IDs from Step 3 for generation payload (`selected_competitor_place_ids`)
- Treat preview as stale when service changes; require re-generation before allowing Step 4

### Quality gate (must pass)
- Final competitor list reaches minimum quality threshold:
  - relevance to RS
  - local comparability
  - sufficient count for meaningful analysis
- selected competitor list is non-empty
- selected list is tied to current confirmed service (no stale preview mismatch)
- if scenario status is `hydrating` or `failed`, Step 4 is blocked

### Failure handling
- If too few relevant competitors, expand radius/keyword variants once, then require manual add.
- If results are noisy, tighten RS keyword and re-run shortlist.
- If hydration remains incomplete after retries/background work, mark scenario
  `failed` and require user re-generation before Step 4.

---

## 4) Step 4 — Report Generation (Business Audit + Review Audit)

### Purpose
Generate paid audit output only from locked, confirmed inputs to minimize hallucination and category drift.

### Required locked inputs
- Locked business identity (Step 1)
- Confirmed RS (Step 2)
- Confirmed competitor set (Step 3)

### Generation behavior
1. Build report context package from confirmed inputs and fetched evidence.
2. Produce business-audit modules and review-audit modules against the same locked context.
3. Persist generation metadata for traceability and QA.
4. If selected competitor place IDs exist, use them directly and skip broad competitor re-discovery.

### Outscraper in Step 4
- If Outscraper enrichment already executed in Step 3, Step 4 reuses stored enriched data.
- Step 4 should not require a second Outscraper run unless data freshness policy explicitly requires it.
- If Step 3 scenario is `ready`, Step 4 should consume scenario snapshot first to avoid duplicate timeout exposure.
- If selected competitors are not fully hydrated, Step 4 must refuse generation rather than silently using partial data.

### Quality gate (must pass)
- Report generation is blocked if RS or competitor confirmation is missing.
- All module prompts consume confirmed values, not raw unresolved candidates.

### Failure handling
- If generation fails due to missing evidence, surface precise missing dependency and return to the corresponding step.
- If model output conflicts with locked RS/competitors, treat as generation bug and retry with stricter context constraints.

---

## 5) Cross-step reliability controls

### A. Confirmation-first policy
- Never bypass RS confirmation for paid audits.
- Never bypass competitor confirmation for paid audits.

### B. Audit trail logging
Track decisions and overrides for continuous improvement:
- GS, BS, system RS, user-final RS
- confidence and reason traces
- competitor candidates vs user-confirmed final set

### C. Learning loop (V2)
Use override data to improve reconciliation and ranking:
- monitor RS overwrite rate by industry/service
- monitor top mismatch reasons
- prioritize high-frequency failure clusters for rule/taxonomy updates

### D. Safe defaults
- If confidence is low, force explicit visible user action
- Prefer conservative blocking over silent wrong auto-generation
- Prefer “block + clear retry message” over generating reports from incomplete competitor hydration

---

## 6) Data contract summary per step

### Step 1 output contract
- `business`: identity, location, website, GBP metadata
- `source_evidence`: matched profile evidence and confidence cues

### Step 2 output contract
- `service_google` (GS)
- `service_baam` (BS)
- `service_recommended_system` (RS system)
- `service_final_confirmed` (RS final, user-confirmed)
- `service_confidence`, reason metadata
- `service_candidates_debug` (top candidates, up to 3, with source tags and score metadata)

### Step 3 output contract
- `competitor_candidates` (scored with source tags)
- `competitor_final_confirmed` (user-approved set)
- `selected_competitor_place_ids` (IDs sent to Step 4 generate API)
- optional `review_history_enrichment` (Outscraper output)

### Step 4 output contract
- `report_context_snapshot` (immutable inputs used for generation)
- `report_modules` (business + review sections)
- `generation_log` (version, timing, success/failure details)
- `competitors_data.search_metadata.selection_mode` (`manual_selected` or `search`)

---

## 7) Operational KPIs (quality-focused)

- **RS overwrite rate** (lower over time by industry)
- **Wrong-service incident rate** (post-generation corrections needed)
- **Competitor rejection rate** (candidate-to-confirmed drop ratio)
- **Audit regeneration rate** (re-run due to upstream mismatch)
- **Time-to-confirm** for Step 2 and Step 3 (balance speed vs quality)

Target trend: lower overwrite/rejection/regeneration while preserving acceptable completion time.

---

## 8) Implementation checklist

1. Enforce hard blockers for missing RS confirmation before generate.
2. Ensure competitor step consumes confirmed RS only.
3. Reuse Step 3 enrichment payload in Step 4 (no duplicate expensive fetch by default).
4. Persist full reconciliation and competitor decision logs.
5. Expose admin/internal analytics page for override trend monitoring.
6. Add regression tests for:
   - low-confidence GS/BS conflict cases
   - generic-vs-specific service cases (for example manufacturer/vision families)
   - competitor precision under broad vs specific RS

---

## 9) Practical guidance for the team

- If there is uncertainty, spend effort in **Step 2 (service)** first.  
  A wrong RS causes most downstream quality failures.
- Treat **Step 3 confirmation** as mandatory editorial control for paid audits.
- Treat Outscraper as value-add enrichment, not a substitute for proper competitor discovery.

This is the default operating model for best-quality paid audits.
