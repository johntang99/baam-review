# AWS Migration Plan — HIPAA Readiness for BAAM Review

**Status**: Planning. Not yet started.
**Drafted**: 2026-05-21
**Target start**: TBD (gated on decisions in §11)
**Target completion**: 9 weeks calendar after start
**Owner**: TBD

---

## 1. Why this matters

BAAM Review currently runs on **Vercel + Supabase Pro + Resend**. None of those three signs a HIPAA Business Associate Agreement (BAA) at the price tier we're on. The moment a HIPAA-covered customer (dental clinic, acupuncturist who bills insurance, etc.) sends a review request through BAAM, we're processing Protected Health Information (PHI) without legal cover. Penalties tier up to **$50K–$1.5M per violation** for willful neglect.

The PHI risk isn't the review *content* — it's the *identifier*: a message saying "thanks for your visit to Dr. X" addressed to a phone or email reveals that this person is Dr. X's patient. That association alone is PHI.

**Target market reality**: BAAM Review's customer base skews healthcare-adjacent.
- Dental: unambiguously HIPAA-covered.
- Acupuncture / TCM: covered if they bill insurance (most licensed CA/NY practices do).
- Wellness, massage, herbal: usually not covered, but state privacy laws (CA's CMIA) may still apply.
- A realistic estimate: **30–60% of BAAM customers will be HIPAA-touching**.

Competitors (Birdeye, Podium, Solutionreach, Reputation.com) all run on AWS with BAA coverage. They charge a healthcare tier of **$199–$500/mo per location** (vs. the $89–$299 self-serve/full-service rates we have). HIPAA isn't a cost center for them — it's a higher-margin segment.

## 2. Strategic decision: all-AWS, not bifurcated

We considered three paths:

| Path | Verdict |
|---|---|
| **A.** Stay on Vercel+Supabase, upgrade to BAA tiers (Vercel Enterprise $20K+/yr + Supabase Team $599/mo) | Rejected. Most expensive long-term (~$78K over 3 years). Lock-in to pricier tiers. |
| **B.** Bifurcate: Vercel+Supabase for non-healthcare customers, AWS for healthcare only | Rejected. Maintaining two stacks is a 30–50% drag on engineering velocity, **forever**. Schema drift risk. Customer support confusion. Bifurcation is justified only if healthcare stays <10% of customers — which is unlikely for BAAM's demographic. |
| **C.** Migrate everything to AWS over ~9 weeks | **Chosen.** Cheapest at 3-year horizon (~$44K). One stack. HIPAA-compliant for all customers (the non-healthcare ones don't pay more or notice). Future-proofs the business. |

### Concession to keep migration tractable

**We will NOT migrate authentication.** Supabase Auth on the Team plan ($599/mo) includes a BAA. Keeping `@supabase/ssr` saves ~3 weeks of Cognito work (the worst-DX part of AWS). The end-state is:

- AWS BAA covers: infrastructure, database, hosting, file storage, email, AI.
- Supabase BAA covers: authentication only.
- Twilio BAA covers: SMS (when we launch it on Twilio Security Edition).
- Stripe: no PHI flows through (payment customer is the clinic business, not the patient).

## 3. Current state vs target state

| Concern | Current (Vercel + Supabase) | Target (AWS) |
|---|---|---|
| App hosting | Vercel Pro | **AWS App Runner** (closest UX to Vercel) |
| Database | Supabase Postgres (Pro) | **AWS RDS Postgres** |
| Auth | Supabase Auth (Pro, no BAA) | **Supabase Auth (Team plan, BAA-signed)** ← kept |
| File storage | Supabase Storage | **AWS S3** |
| Email | Resend | **AWS SES** |
| AI calls | Direct OpenAI/Anthropic API (if any) | **AWS Bedrock** (Claude with BAA cover) |
| SMS | Twilio (no Security Edition yet) | **Twilio Security Edition** (Phase 2, not part of this migration) |
| Logs / audit | Vercel built-in | **AWS CloudWatch** (6-year retention for HIPAA audit) |
| Secrets | `.env.local` + Vercel env vars | **AWS Secrets Manager** |
| CI/CD | Vercel auto-deploy on git push | **GitHub Actions → ECR → App Runner** |
| Cost (monthly) | ~$45 | ~$800 (Supabase Auth Team dominates; pure AWS ~$200) |

## 4. Cost analysis

Three-year totals:

| Path | Year 1 | Year 2 | Year 3 | Total |
|---|---|---|---|---|
| Stay on Vercel+Supabase, BAA tiers (Path A) | $26K | $26K | $26K | **$78K** |
| Bifurcated (Path B) — includes ongoing dev drag | $32K | $17K | $17K | **$66K** |
| **All-AWS migration (Path C) — chosen** | **$28K** | **$8K** | **$8K** | **$44K** |

Year 1 of Path C includes ~$20K of one-time migration engineering (6 weeks of dedicated work) plus ~$8K of infrastructure. After Year 1, ongoing cost drops to ~$3K AWS + ~$5K maintenance.

Path A "looks easy" because there's no engineering work, but it's the most expensive option overall and gives the worst long-term position (locked into pricier vendor tiers, no leverage).

## 5. Decision: keep current stack running during the entire migration

**Parallel deployment with cutover.** Customers see zero disruption throughout the build. The current Vercel + Supabase stack serves 100% of traffic until the day of cutover. The new AWS stack is built and tested alongside, gets one pilot customer for a few days, then takes over via DNS swap. Old stack remains alive for 2 weeks post-cutover as a rollback safety net.

## 6. Phase plan (9 weeks calendar, ~6 weeks of focused engineering)

### Phase 0 — Foundation & audit (Week 1, ~3 days)

| Task | Notes |
|---|---|
| Confirm BAA signed in AWS | AWS Console → AWS Artifact → Agreements. Free; takes 5 minutes if not done. |
| Audit existing AWS resources (video system) | Tag all current resources `Project=VideoStudio` so we don't disrupt them. |
| Choose isolation model | (a) IAM users + tags in same account (simpler), or (b) Organizations sub-account (cleaner). Default to (a) unless both products will grow. |
| Pick region | **us-east-1** (matches existing console; NYC latency; max service availability). |
| Set up billing alerts | Budgets at $50, $100, $200. |
| Pick IaC tool | **Terraform** recommended (portable, easier to learn than CDK). |

**Exit criteria**: BAA confirmed signed; clean separation between VideoStudio and BAAMReview resource namespaces.

### Phase 1 — Network & data infrastructure (Week 1–2, ~5 days)

Provision via Terraform:

```
VPC (10.0.0.0/16)
├── Public subnets (10.0.1.0/24, 10.0.2.0/24)    ← 2 AZs, NAT egress
├── Private subnets (10.0.10.0/24, 10.0.20.0/24) ← 2 AZs, RDS
└── Security groups
    ├── rds-sg            (Postgres from app-sg only)
    └── app-sg            (HTTPS out)
```

| Resource | Purpose | Cost (~) |
|---|---|---|
| VPC + subnets | Network isolation | $0 |
| NAT Gateway | Private-subnet egress | $32/mo + traffic |
| **RDS Postgres 16** (`db.t4g.small`) | App database; encryption at rest; 7-day backup retention | $30/mo |
| **S3 bucket** `baam-review-uploads-prod` | App file storage (lifecycle: IA after 30d, expire intermediates 90d) | $1–5/mo |
| **S3 bucket** `baam-review-backups-prod` | DB snapshots + audit logs; Object Lock for compliance | $1–3/mo |
| **KMS keys** | Customer-managed for RDS + S3 (HIPAA audit clarity) | $1/key/mo |
| **Secrets Manager** | Stripe key, Twilio key, Supabase Auth keys | $0.40/secret/mo |
| **CloudWatch Logs** | App + RDS + audit; **6-year retention policy** | $1–10/mo |
| **Route 53 hosted zone** | DNS for review.baamplatform.com | $0.50/mo |
| **ACM certificate** | HTTPS for App Runner custom domain | Free |

**Exit criteria**: Empty but properly secured infrastructure. RDS reachable from a test EC2 in the same VPC.

### Phase 2 — App deployment infrastructure (Week 2–3, ~3 days)

| Resource | Purpose |
|---|---|
| **ECR repository** | Docker images of the Next.js app |
| **AWS App Runner service** | Runs the app; auto-scales; SSL included; closest UX to Vercel |
| **App Runner VPC connector** | Reach private RDS |
| **App Runner IAM role** | Read Secrets Manager, write CloudWatch Logs, S3 access scoped to the app's bucket |
| **GitHub Actions workflow** | On push to `main`: build → push to ECR → App Runner auto-deploys |
| **`Dockerfile`** | Build Next.js standalone output, copy `public/` and `.next/standalone`, run `node server.js` |

**Why App Runner over Lambda+CloudFront via OpenNext**: App Runner = "push a container, get a URL". OpenNext is more cost-efficient at scale but adds weeks of complexity (function packaging, cold starts, edge cache invalidation). Start simple; consider OpenNext later if cost demands it.

**Exit criteria**: A pipeline that builds and deploys the current Next.js codebase. App accessible at a temporary App Runner URL (no customer DNS yet).

### Phase 3 — Code refactor (Week 3–6, ~15 days engineering)

Four atomic swaps, done in this order. Each one is independently testable.

#### 3a. Database client swap (~2 weeks)

The biggest piece. Refactor away from `@supabase/supabase-js` query methods to a portable ORM.

**Recommended: drizzle-orm**.

- Define table schemas in `lib/db/schema.ts` matching current Supabase tables. Drizzle auto-generates TypeScript types.
- Replace every `supabase.from("…").select()` / `.insert()` / `.update()` call with drizzle equivalents.
- Apply existing `supabase/migrations/*.sql` to RDS — same Postgres SQL works.
- Keep RLS policies — they work on RDS natively.
- One subtlety: Supabase's `auth.uid()` JWT-aware function (used inside RLS policies) needs reimplementation. Pattern: read JWT from request header in the API layer, pass `user_id` to drizzle as an explicit parameter; RLS uses that.

**Files affected** (rough scan):
- `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`, `lib/supabase/service.ts` → become `lib/db/{server,client,middleware,service}.ts` thin wrappers around drizzle
- Every `app/**/page.tsx`, `app/**/actions.ts`, `app/api/**/route.ts` that calls `supabase.from(...)` — refactored to `db.select().from(tableX)…`
- `lib/database.types.ts` → generated by drizzle from schema, no longer hand-maintained

#### 3b. Storage swap (~3 days)

- Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
- Replace `supabase.storage.upload()` → `S3Client.send(PutObjectCommand)`.
- Replace public/signed URL generation → `getSignedUrl()` with TTL.
- Affected: review-video uploads, location logos, anything using Supabase Storage.

#### 3c. Email swap (~3 days)

- Add `@aws-sdk/client-sesv2`.
- Replace `resend.emails.send()` → `SESv2Client.send(SendEmailCommand)`.
- Verify sending domain in SES (DKIM + SPF + DMARC records). Update DNS at the registrar — same records, different provider.
- **Request production access** in SES sandbox — 1-day approval typically. Without it, SES only sends to verified addresses.
- Migrate suppression list from Resend webhooks → SES suppression list (automatic on bounce/complaint).
- Affected: review request emails, signup confirm (after Supabase Auth SMTP swap), reset password, transactional notifications.

#### 3d. Auth — keep Supabase, upgrade plan (~0 days code change)

- Upgrade Supabase project to **Team plan** ($599/mo) — BAA included.
- No code change. `@supabase/ssr` continues to work identically.
- Update Supabase Auth SMTP settings to send via SES (the Resend setting we use today swaps to SES). The branded email templates we configured continue to render.

#### 3e. AI calls — Bedrock (if applicable, ~2 days)

If we have any direct OpenAI / Anthropic API calls (e.g., AI review draft generation, AI reply suggestions), swap to **AWS Bedrock**. Anthropic's Claude is available in Bedrock with BAA cover. Configure model access permission via IAM.

If no AI calls today, skip this step until a feature needs it.

**Exit criteria**: All code paths work against AWS infrastructure. Codebase deployable to either Vercel or App Runner via env var (`BAAM_STACK=supabase` vs `aws`) — both work side-by-side for safety during the parallel phase.

### Phase 4 — Data migration tooling (Week 6, ~3 days)

- **One-time dump**: `pg_dump --no-owner --no-acl` from Supabase → `pg_restore` into RDS.
- **Verification script**: per-table row counts must match; sample 100 rows from each table, compare hashes.
- **Continuous sync (during parallel phase)**: EventBridge cron @ 02:00 UTC daily → Lambda runs `pg_dump | pg_restore --clean --if-exists` from Supabase to RDS. AWS stack always has yesterday's data for testing.
- **Sync verification**: Lambda also runs row-count comparison post-sync, alerts via SNS to email if mismatch >0.1%.

**Exit criteria**: Production data is in RDS. Sync runs nightly without drift.

### Phase 5 — Testing & validation (Week 7, ~5 days)

Acceptance checklist — **every box must be checked before any customer traffic touches AWS**:

- [ ] All admin pages render correctly on AWS deployment
- [ ] Signup → email confirm → login works (Supabase Auth + SES verified)
- [ ] Forgot password → reset link → set new password works
- [ ] Connect Google Business Profile → location appears → no Google OAuth issues
- [ ] Send review request via email — delivered to recipient, tracking link works, `review_requests` row created
- [ ] Public review page (`/r/[slug]`) loads, accepts submissions, writes to DB
- [ ] Widget loads on external test site
- [ ] Stripe Checkout → webhook to AWS endpoint → DB update → admin reflects subscription
- [ ] Stripe Customer Portal cancel → reconcile-on-load → admin reflects canceling
- [ ] Billing gate works: location with no sub shows "Billing required" banner and blocks send/widget/public page
- [ ] Load test ~10× current traffic — no degradation, no error spikes
- [ ] RDS backup → restore drill — verify recovery from snapshot
- [ ] CloudWatch logs capturing app + audit events with proper retention policy
- [ ] HIPAA attorney sign-off on architecture, audit logs, breach SOP
- [ ] Rollback drill — practice reverting DNS back to Vercel, verify it works

### Phase 6 — Pilot (Week 8, ~5 days)

- Move one internal test account to AWS via DNS or feature flag.
- 3–5 days of live customer-realistic flow.
- Watch CloudWatch metrics, error rates, P95 latencies.
- Fix surfaced issues.

### Phase 7 — Cutover (Week 9, ~2 days)

Sunday morning (off-peak) for the actual switch:

1. Announce 30-minute maintenance window (preemptive, in case).
2. Stop writes to Supabase (read-only mode).
3. Final `pg_dump | pg_restore` from Supabase to RDS.
4. Run verification script — counts and hashes must match exactly.
5. Update Route 53: `review.baamplatform.com` → App Runner URL.
6. Wait for DNS propagation (~5 min with low TTL).
7. Verify a real customer flow end-to-end on AWS.
8. Re-enable writes (now landing on RDS).
9. Monitor closely for 24 hours.

### Phase 8 — Decommission (Weeks 11–12, ~1 day total)

After **2 weeks of clean operations**:
- Cancel Vercel subscription.
- Downgrade or cancel Supabase Pro (keep Team plan for Auth).
- Cancel Resend.
- Keep old DB snapshots for 90 days as ultimate fallback.
- Then delete archived resources.

## 7. Detailed code refactor: file-level map

For Phase 3, here's the rough scope (snapshot at time of writing; will need re-scan when starting):

| File / area | Change |
|---|---|
| `lib/supabase/server.ts` | Rename to `lib/db/server.ts`; export a drizzle DB client |
| `lib/supabase/client.ts` | Stays — Supabase Auth is keeping this for auth-only |
| `lib/supabase/service.ts` | Rename to `lib/db/service.ts`; drizzle service-role client |
| `lib/supabase/middleware.ts` | Stays — auth session refresh logic |
| `lib/database.types.ts` | Delete (hand-maintained). Replace with drizzle-generated schema |
| `lib/db/schema.ts` | **NEW** — drizzle schema for all tables |
| `lib/db/migrations/` | **NEW** — drizzle migrations folder (existing `supabase/migrations/*.sql` reused as initial migration) |
| `lib/storage/` | **NEW** — S3 client wrapper for uploads + signed URLs |
| `lib/messaging/resend.ts` | Rename to `lib/messaging/email.ts`; swap Resend SDK calls for SES SDK calls; keep `sendEmail(...)` interface |
| `lib/billing/sync.ts` | DB calls swap supabase-js → drizzle; logic unchanged |
| `lib/billing/access.ts` | Same |
| `app/api/webhooks/stripe/route.ts` | DB calls swap; same logic |
| `app/api/webhooks/twilio/route.ts` | DB calls swap; same logic |
| `app/api/webhooks/resend/route.ts` | Rename to `app/api/webhooks/email/route.ts` or replace with SES SNS bounce/complaint handler |
| `app/app/**/*.tsx` (all admin pages) | Every `supabase.from(...).select(...)` becomes drizzle query. Mechanical refactor. |
| `app/r/[slug]/page.tsx`, `app/widget/[slug]/page.tsx`, `app/s/[token]/page.tsx` | DB calls swap |
| `components/auth/*` | No change — Supabase Auth retained |
| `.env.local` | Add `DATABASE_URL` (RDS), `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `SES_FROM_EMAIL`; remove Resend creds; Stripe/Twilio unchanged |
| `Dockerfile` | **NEW** — multi-stage Next.js standalone build |
| `.github/workflows/aws-deploy.yml` | **NEW** — build, push to ECR, trigger App Runner deploy |
| `terraform/` | **NEW** — IaC for VPC, RDS, S3, SES, App Runner, IAM, KMS, Secrets Manager, Route 53 |

Estimate: ~30 files materially changed, ~10 new, ~5 deleted/renamed.

## 8. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Database migration corrupts data | High | Verification script on every sync (counts + sample hashes). Pre-cutover dry run. Snapshot before cutover. |
| App Runner cold start latency | Medium | Configure min instances = 1 (~$50/mo overhead, eliminates cold starts) |
| RLS policies behave differently on RDS than Supabase | Medium | Port and test all policies in pilot phase. Some may need rewriting if they used Supabase-specific functions. |
| SES emails land in spam | Medium | Verify domain DKIM/SPF/DMARC before cutover. Warm up sending IP gradually if needed. |
| Stripe webhook URL change breaks signature verification | Low | Update webhook endpoint in Stripe Dashboard during cutover. Set both old + new endpoints active during transition for 24h. |
| Twilio status callbacks point to old domain | Low | Same — update Twilio Console during cutover. |
| Cognito FOMO ("should we migrate auth too") | Low | Explicit decision: NO. Supabase Auth Team BAA is fine. Revisit only if Supabase becomes a problem. |
| Engineering capacity insufficient | High | Don't ship new features during the 6-week core migration period. Decide upfront. |
| AWS bill shock | Medium | Billing alerts at $50/$100/$200. Review weekly during migration. |

## 9. What's NOT in this migration

To keep scope manageable, the following are explicitly **out of scope**:

- **Cognito migration** — keep Supabase Auth on Team plan.
- **SMS** (Twilio Security Edition + BAA) — Phase 2, separate project. Current Twilio integration stays.
- **OpenNext / Lambda+CloudFront hosting** — start with App Runner. Migrate to Lambda only if scale demands.
- **Bedrock for AI** — only if we're calling external AI APIs from server code. If not, skip.
- **Video system (BAAM Studio)** — separate product, separate AWS scope. Keep tagged as `Project=VideoStudio`.
- **Multi-region failover** — single region (us-east-1) is fine for v1. Reconsider at >$100K ARR.
- **Audit log immutability via QLDB** — start with CloudWatch + S3 Object Lock. QLDB is overkill at our scale.

## 10. Required organizational work (parallel to engineering)

These are not engineering tasks but must happen by the same target date:

| Item | Owner | Deliverable |
|---|---|---|
| Sign AWS BAA in AWS Artifact | Founder | Confirmation screenshot |
| Sign Supabase BAA (upon Team upgrade) | Founder | Signed BAA document |
| Privacy Policy + Terms of Service update | Legal | Mention PHI processing, BAA-signed sub-processors |
| Notice of Privacy Practices (NPP) — if acting as Business Associate | Legal | Drafted with HIPAA attorney |
| Breach Notification SOP | Founder + Legal | 60-day notification procedure; HHS contact info; affected-individuals process |
| Employee HIPAA training | All staff who touch customer data | Completion certificate (HIPAATrek / Compliancy Group typical) |
| Audit logging policy | Engineering | What gets logged, who can access, 6-year retention |
| Customer BAA template | Legal | The agreement BAAM signs with each healthcare customer |
| HIPAA attorney engagement | Founder | Hourly engagement for review + ongoing questions |

These six items are the legal/process side of HIPAA — the engineering migration only solves the infrastructure side. **Both must be complete before onboarding the first HIPAA customer.**

## 11. Open decisions before kickoff

Cannot start Phase 0 without answers:

1. **Who runs the migration?** One dedicated engineer for 6 weeks, or split across the team? Affects timeline confidence.
2. **AWS production experience on the team?** If no, budget for a part-time AWS consultant (~$3–5K, 10–20 hours) to review IAM/VPC/Terraform setup.
3. **First pilot customer?** An internal account, a friendly customer, or both?
4. **Video system (BAAM Studio) BAA scope** — bring it under the same AWS BAA umbrella, or keep separately tagged with explicit boundaries?
5. **Feature freeze duration** — confirm with the product team that no major features ship during the core migration weeks.
6. **Budget approval** — Year 1 cost ~$28K (migration + infra + Supabase Team Auth). Confirm budget owner.
7. **HIPAA attorney engagement** — already engaged? If not, get one before starting.

## 12. Decision log

Tracks key choices made during planning. Add to as new decisions arise.

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-21 | Path C (all-AWS) over Path A (BAA tiers) or Path B (bifurcated) | Cheapest long-term, simplest operationally, future-proofs for healthcare growth |
| 2026-05-21 | Keep Supabase Auth on Team plan | Avoids ~3 weeks of Cognito migration; ergonomics worth $599/mo |
| 2026-05-21 | App Runner over Lambda+OpenNext | Closest UX to current Vercel; defer Lambda complexity until scale demands |
| 2026-05-21 | drizzle-orm over Prisma or raw `pg` | Best TypeScript inference, schema-as-code, lightweight |
| 2026-05-21 | us-east-1 region | Matches existing AWS console; lowest NYC latency |
| 2026-05-21 | Terraform over CDK | Portable; easier for non-AWS-specialists to read |

---

## Appendix A: AWS services needed (final list)

| Service | Used for |
|---|---|
| **App Runner** | Next.js hosting |
| **ECR** | Docker image registry |
| **RDS Postgres** | Database |
| **S3** | File storage + backups |
| **VPC, NAT Gateway, subnets, security groups** | Network isolation |
| **IAM** | Permissions |
| **KMS** | Encryption keys |
| **Secrets Manager** | Runtime secrets |
| **CloudWatch Logs** | Application + audit logs |
| **CloudWatch Metrics + Alarms** | Monitoring |
| **EventBridge** | Cron schedules (DB sync) |
| **Lambda** | Sync jobs, custom webhooks |
| **SES** | Transactional email |
| **SNS** | Internal alerts (sync drift, etc.) |
| **Route 53** | DNS |
| **ACM** | TLS certificates |
| **AWS Artifact** | BAA + compliance docs |
| **Cost Explorer + Budgets** | Cost tracking |
| **Bedrock** *(if needed)* | AI calls (Claude) |

## Appendix B: Environment variables — before vs after

**Removed** (Vercel + Supabase + Resend):
- `RESEND_API_KEY`, `RESEND_FROM`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` *(only the URL stays since Supabase Auth still uses it)*

**Added** (AWS):
- `DATABASE_URL` — Postgres connection string to RDS
- `AWS_REGION=us-east-1`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — or App Runner IAM role (preferred — no creds in env)
- `S3_BUCKET=baam-review-uploads-prod`
- `SES_FROM_EMAIL=support@baamplatform.com`
- `SES_REGION=us-east-1`
- (If Bedrock used) `BEDROCK_REGION=us-east-1`, `BEDROCK_MODEL_ID=anthropic.claude-…`

**Unchanged**:
- All `STRIPE_*` (live keys, price IDs, webhook secret)
- All `TWILIO_*`
- `NEXT_PUBLIC_APP_URL=https://review.baamplatform.com`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — kept for Supabase Auth (just upgraded plan)

## Appendix C: Estimated monthly AWS bill at production scale

Assumes ~50 active locations, ~1000 emails/day, ~100GB DB, low-moderate web traffic:

| Service | Monthly |
|---|---|
| App Runner (1 vCPU 2GB, min 1 instance) | $75 |
| RDS Postgres `db.t4g.small` Multi-AZ | $60 |
| RDS storage (100GB SSD) | $12 |
| RDS backups (7-day retention) | $5 |
| NAT Gateway | $32 + ~$5 traffic |
| S3 storage (100GB standard) | $3 |
| S3 requests | $2 |
| SES (30K emails/mo) | $3 |
| CloudWatch Logs (10GB ingest) | $5 |
| CloudWatch Metrics + Alarms | $3 |
| Secrets Manager (5 secrets) | $2 |
| KMS keys (2 customer-managed) | $2 |
| Data transfer out | $10 |
| Route 53 + ACM | $1 |
| Bedrock (if used) | usage-based |
| **AWS subtotal** | **~$220/mo** |
| **+ Supabase Auth Team (BAA)** | **$599/mo** |
| **Grand total** | **~$820/mo** |

Compare current spend (~$45/mo). The increase is primarily the Supabase Auth Team plan; if we accept the pain of a future Cognito migration, that drops by $599 and AWS-only is ~$220/mo.

## Appendix D: Reference reading

- AWS HIPAA-eligible services list: <https://aws.amazon.com/compliance/hipaa-eligible-services-reference/>
- AWS Artifact (BAA): AWS Console → Services → Artifact → Agreements
- Supabase Team plan: <https://supabase.com/pricing>
- Twilio Security Edition (for SMS Phase 2): <https://www.twilio.com/en-us/security/security-edition>
- HIPAA Security Rule (audit controls): 45 CFR 164.312(b), retention 45 CFR 164.316(b)(2)
- Drizzle ORM: <https://orm.drizzle.team>
