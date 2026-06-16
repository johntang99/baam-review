# Service Coverage Loop (RS Quality Expansion)

Use this loop to continuously improve service recommendation quality from real user corrections.

## Command

```bash
pnpm service:coverage-loop -- --days 30 --limit 1500 --samples 12
```

Arguments:

- `--days`: lookback window in days (default `30`)
- `--limit`: max `audit_service_resolutions` rows to analyze (default `1500`)
- `--samples`: number of sample cases printed (default `12`)

## What it analyzes

Script: `scripts/service-coverage-loop.ts`

It scans:

1. user overrides (`changed_from_recommended` or `recommended != user_final`)
2. broad/generic recommended services (for example `manufacturer`, `store`, `service`, `local business`)
3. broad recommendations that were overridden by users

## What it outputs

- override rate
- broad/generic recommendation rate
- top broad recommendations
- top transition pairs (`model service -> user final service`)
- priority targets to improve next
- recent high-value samples for rule/taxonomy work
- low-confidence broad recommendation watchlist

## How to use output

1. Prioritize top transitions where broad terms are replaced by specific user services.
2. If target service already exists in taxonomy, improve matching signals/weights.
3. If target service is new, add taxonomy entry + aliases + detail rules.
4. Re-run benchmark scripts:
   - `npx tsx scripts/test-service-recommendation-stress.ts`
   - `npx tsx scripts/test-service-recommendation-human-benchmark.ts`
5. Ship only if no critical regressions.
