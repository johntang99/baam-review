# BAAM Review — Implementation Plan (v2.0 Adaptation)

**Last updated:** 2026-05-12
**Owner:** John Tang
**Approach:** **Path B — Adapt** (preserve shipped v1, layer v2.0 deltas on top)

---

## 0. Why this plan exists

The `docs/updated-plan/` v2.0 materials (HANDOFF_TO_CLAUDE_CODE.md, BAAM_REVIEW_MASTER_PLAN.md, SESSION_1_BRIEF.md … SESSIONS_3_TO_12_BRIEFS.md, BRAND_ASSETS.md, prototypes 01–08, LAUNCH_CHECKLIST.md, OUTREACH_SCRIPTS.md, PRE_SESSION_1_SETUP.md) reposition BAAM Review as a **Review-to-Revenue Engine** running a 7-stage loop:

> Collect → Publish → Display → Distribute → Convert → Refer → Compound

That positioning + the 40-session roadmap arrived after Sessions 1–10 + R1 + R2 of the original plan had already shipped to `review.baamplatform.com` with:

- 5 connected GBP locations
- 380 fetched Google reviews
- Working chip-driven AI draft flow, SMS+Email sending, GBP reply assistant, low-rating private feedback alerts, monthly Resend digest
- 9 applied migrations (`0001_init` → `0009_google_reviews`)
- Founding pricing model not yet codified in app; no Stripe wired

The HANDOFF doc prescribes a clean restart. **We will not restart.** This plan keeps shipped code as the foundation and ships v2.0 as deltas, prototype-by-prototype.

---

## 1. Guiding principles

1. **Prototype HTML is the design source of truth.** Every UI session below references one or more files from `docs/updated-plan/*.html`. Tailwind/React translation must match layout, typography (Fraunces / Newsreader / Onest / JetBrains Mono), color tokens (`ink`, `cream`, `forest`, `gold`, per-location accent), and the italic-word brand voice in headlines.
2. **Brand tokens live in Tailwind config + `BRAND_ASSETS.md`.** Per-location `--clinic-primary` is derived from `locations.brand_color`.
3. **Migrations are append-only.** Never edit `0001` … `0009`. New work starts at `0010_*`.
4. **Each session ships behind a DONE GATE.** No partials merged. Gate format mirrors `SESSIONS_3_TO_12_BRIEFS.md`.
5. **i18n is non-optional.** Every new public surface must read from `lib/i18n/review.ts` STRINGS in EN / 中文 / Español before merging.
6. **Trilingual content under 1.5 KB stays inline.** Anything larger (legal pages, ROI calculator copy) gets its own typed module.
7. **Server actions over client fetches** for any mutation. `revalidatePath` after each write.
8. **No regressions on the 5 live locations.** Each migration is back-tested against existing rows before applying to prod.

---

## 2. Phase map

| Phase | Goal | Sessions | Target |
|---|---|---|---|
| **A** | v1 launch deltas — close gaps before paid launch | A1, A2, A3 | 2026-05 → 2026-06 |
| **B** | Growth-tier value — what justifies the $99 plan | B1, B2, B3, B4 | 2026-06 → 2026-07 |
| **C** | Polish & accessibility | C1, C2 | 2026-07 |
| **D** | Pre-launch ops (10DLC, OAuth verification, founding 50 outreach) | D1, D2, D3 | 2026-07 → 2026-08 |
| **E** | v1.6 / v1.7 from master plan (deferred) | — | post-launch |

Phases run sequentially. Sessions inside a phase may overlap when they touch disjoint files.

---

## 3. Phase A — v1 launch deltas

### Session A1 — Revenue Moment + Consent Layer

**Scope.** Turn the thank-you page from a dead end into the **Convert + Refer** stage of the 7-step loop. Add an explicit consent checkbox so we can legally republish review text on a public widget (Phase B1).

**Prototype:** [`07-review-thankyou.html`](07-review-thankyou.html) (canonical), [`05-review-questions.html`](05-review-questions.html) (consent placement), [`06-review-ai-draft.html`](06-review-ai-draft.html) (consent placement).

**Files to add:**
- `supabase/migrations/0010_revenue_moment_consent.sql`
- `app/r/[slug]/thank-you/actions.ts` — server action for logging `post_review_actions`
- `app/og/share/[token]/route.tsx` — Satori-rendered share card image (1200×630)
- `lib/share/share-card-data.ts` — shape + fetcher for share-card payload
- `components/review/thank-you-shell.tsx` — client component matching prototype 07 layout
- `components/review/post-review-actions.tsx` — Book / Refer / Follow CTA group
- `components/review/share-reveal.tsx` — share-card preview + destination buttons
- `components/review/consent-checkbox.tsx` — reusable consent input

**Files to edit:**
- `app/r/[slug]/thank-you/page.tsx` — fetch `post_review_actions` config, render new shell
- `components/review/review-flow.tsx` — surface consent checkbox right before the Google handoff button
- `lib/i18n/review.ts` — add ~25 new strings (`consent_display_*`, `thanks_next_*`, `book_*`, `refer_*`, `follow_*`, `share_*`, etc.) in EN / 中文 / ES

**Migration 0010 contents (summary):**
```sql
-- Post-review action config (booking URL, refer template, social handles)
alter table locations
  add column avg_customer_value_cents int default null,
  add column booking_url text default null,
  add column social_handles jsonb default '{}'::jsonb;  -- { xhs, ig, wechat_mp, ... }

-- Per-request consent (default false; opt-in)
alter table review_requests
  add column consent_display boolean default false;

-- Anonymous customer events on the thank-you page (book / refer / follow / share / done)
create table post_review_actions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  request_id uuid references review_requests(id) on delete set null,
  action_type text not null check (action_type in (
    'view','book_click','refer_click','share_click','follow_click','done_click'
  )),
  share_destination text,    -- 'wechat'|'sms'|'copy'|'more' when action_type='share_click'
  share_token text,          -- nanoid for tracked share links
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_pra_loc_created on post_review_actions (location_id, created_at desc);
create index idx_pra_share_token on post_review_actions (share_token) where share_token is not null;

-- RLS: insert is public via service role; select scoped to account
alter table post_review_actions enable row level security;
create policy "pra_select_own" on post_review_actions for select
  using (location_id in (select id from locations where account_id = current_account_id()));
```

**DONE GATE.**
- [ ] Thank-you page visually matches `07-review-thankyou.html` across EN / 中文 / ES.
- [ ] Per-location `--clinic-primary` CSS var driven from `locations.brand_color`.
- [ ] Consent checkbox appears in chip flow when `locations.consent_display_enabled` is true (default true for new accounts).
- [ ] When consent is denied, review text is NOT eligible for the public display widget in Phase B1.
- [ ] Book CTA hidden when `locations.booking_url` is null; Follow strip hidden when `social_handles` is empty.
- [ ] Share button generates a tracked share link `/s/<token>` and an OG image at `/og/share/<token>`.
- [ ] Every CTA click writes one row to `post_review_actions` via server action.
- [ ] Existing 5 locations and 380 reviews unaffected; migration applied in <2s on prod copy.

---

### Session A2 — Marketing Home + Pricing + ROI Calculator + Onboarding Wizard

**Scope.** Public marketing site (`/`), pricing page (`/pricing`), founding-50 ROI calculator, and a 4-step onboarding wizard that walks a new account from signup to "first review request sent."

**Prototypes:** [`01-marketing-home.html`](01-marketing-home.html), [`02-marketing-pricing.html`](02-marketing-pricing.html).

**Files to add:**
- `app/(marketing)/layout.tsx` — public-marketing shell (no auth, separate nav)
- `app/(marketing)/page.tsx` — hero + 7-stage loop + ROI calculator
- `app/(marketing)/pricing/page.tsx` — Founding 50 visible only when `pricing_cohort_open` flag is on
- `components/marketing/roi-calculator.tsx` — client component; uses `locations.avg_customer_value_cents` for personalized math when logged in
- `components/marketing/seven-stage-loop.tsx` — animated SVG loop graphic
- `app/onboarding/page.tsx` — 4-step wizard: business basics → GBP connect → first send → preview
- `lib/marketing/seven-stages.ts` — i18n copy for the 7 stages

**Files to edit:**
- `app/layout.tsx` — split marketing vs app shell (existing `/app` becomes authenticated; root becomes public)
- `app/page.tsx` — replace current placeholder with redirect to `(marketing)/page` for unauthenticated users; redirect to `/app` for authenticated

**Migration 0011 (optional):** `accounts.onboarding_completed_at timestamptz`.

**DONE GATE.**
- [ ] Lighthouse mobile ≥ 92 on `/` and `/pricing` (test on `iPhone SE` profile).
- [ ] ROI calculator math: `monthly_new_reviews × conversion_rate × avg_customer_value_cents` displays in user's currency assumption.
- [ ] `/pricing` shows Starter $49 / Growth $99 / Multi-location $499. Founding banner shows $39 / $89 / $249 only when env flag `FOUNDING_50_OPEN=true`.
- [ ] Onboarding wizard skippable but resumes on next login if `onboarding_completed_at` is null.
- [ ] All copy translated to EN / 中文 / ES.

---

### Session A3 — Stripe Integration

**Scope.** Wire Stripe Checkout for Starter / Growth / Multi-location, founding-50 coupon codes, billing portal, plan-gated features.

**Prototype:** none (admin-side). Pricing UI references `02-marketing-pricing.html`.

**Files to add:**
- `app/api/billing/checkout/route.ts` — create checkout session
- `app/api/billing/portal/route.ts` — billing portal session
- `app/api/billing/webhook/route.ts` — Stripe webhook (signature-verified)
- `app/app/billing/page.tsx` — current plan + manage subscription
- `lib/billing/plans.ts` — plan definitions, Stripe price IDs, gating helpers
- `lib/billing/stripe.ts` — Stripe client
- `supabase/migrations/0012_billing.sql` — subscription state tables

**Migration 0012 (summary):**
```sql
alter table accounts
  add column plan text not null default 'free' check (plan in ('free','starter','growth','multi')),
  add column stripe_customer_id text,
  add column subscription_status text,
  add column current_period_end timestamptz,
  add column founding_member boolean default false;
create unique index idx_accounts_stripe_customer on accounts (stripe_customer_id);
```

**Plan gates (enforced in server actions):**
- Free: 1 location, 25 review requests / month, branded footer locked on.
- Starter: 1 location, 250 reqs / mo, custom domain on email From.
- Growth: 1 location, unlimited reqs, display widget, share cards, basic referrals.
- Multi: 5 locations, unlimited reqs, all Growth features, priority support.

**DONE GATE.**
- [ ] Webhook updates `accounts.subscription_status` and `current_period_end` on `customer.subscription.{created,updated,deleted}`.
- [ ] Plan downgrade preserves data but disables Growth-only routes with a `<PaywallBanner>` instead of 404.
- [ ] Founding coupon `BAAM50` applies $10/mo discount via Stripe coupon, not in-app math.
- [ ] `lib/billing/plans.ts.requirePlan('growth')` is the single chokepoint — referenced from every gated server action and page.

---

## 4. Phase B — Growth-tier value

### Session B1 — Display Widget + Review JSON-LD

**Scope.** Embeddable widget showing a curated rotation of reviews (Google + first-party from B2), with `Review` schema markup for SEO.

**Prototype:** none yet — design during session, propose preview prototype to user mid-session.

**Files to add:**
- `app/api/widget/[location_id]/reviews/route.ts` — public JSON endpoint with caching headers
- `app/widget/[location_id]/route.tsx` — embedded HTML page (`<iframe>` target) and `<script>` loader
- `public/embed.js` — small (<4 KB) script that injects an iframe
- `app/app/widget/page.tsx` — admin page: pick layout, color, what to include, copy embed code
- `lib/widget/render.tsx` — server-side render of widget HTML
- `supabase/migrations/0013_widget_events.sql` — track widget impressions + click-throughs

**DONE GATE.**
- [ ] Widget loads in <300 ms p95 from the CDN edge.
- [ ] JSON-LD `Review` schema validates against Google Rich Results test.
- [ ] Only reviews with `consent_display=true` (or Google reviews, which are inherently public) appear.
- [ ] `widget_events` rows written for view/click; visible in admin analytics.

---

### Session B2 — First-Party Reviews + Import

**Scope.** Customers without GBP (or who can't get reviews on Google for compliance reasons) can collect reviews directly on BAAM. Also: import legacy Yelp / FB reviews via CSV.

**Files to add:**
- `supabase/migrations/0014_first_party_reviews.sql` — `first_party_reviews`, `imported_reviews` tables
- `app/r/[slug]/internal/page.tsx` — direct-to-BAAM review flow (no Google handoff)
- `app/app/reviews/import/page.tsx` — CSV importer with column mapping
- `lib/import/csv.ts` — CSV parser + sanitizer

**DONE GATE.**
- [ ] First-party reviews appear in the same reviews inbox as Google reviews, tagged with source.
- [ ] CSV import is idempotent (uses `imported_reviews.source_external_id` as dedupe key).
- [ ] Widget (B1) can include first-party reviews if `widget_config.include_sources` permits.

---

### Session B3 — Share Cards + Social Graphics

**Scope.** Generate beautiful share images for individual reviews (extends A1 share card to all reviews, not just the just-submitted one) + social-post graphics from review themes.

**Files to add:**
- `app/og/review/[review_id]/route.tsx` — Satori review card (1200×630, 1080×1080, 1080×1920 variants)
- `app/app/reviews/[id]/share/page.tsx` — preview + copy/download
- `lib/share/themes.ts` — 6 brand themes (warm-clinic, forest-pro, gold-luxe, etc.)
- `supabase/migrations/0015_social_graphics.sql` — `social_graphics` (generated assets log)

**DONE GATE.**
- [ ] PNG generation <800 ms p95 (warm cache).
- [ ] Per-location accent color applied automatically.
- [ ] CJK text renders correctly (Noto Sans SC fallback for Fraunces).

---

### Session B4 — Simple Referral Tracking + Best Advocates

**Scope.** Each share card carries a tracked link `/s/<token>`. Track clicks and conversions (a new review or a booking click). Surface "best advocates" leaderboard in admin.

**Files to add:**
- `supabase/migrations/0016_referrals.sql` — `referrals`, `advocates` tables
- `app/s/[token]/route.ts` — redirect + write `referrals` row
- `app/app/analytics/advocates/page.tsx` — leaderboard
- `lib/referrals/attribute.ts` — attribution helper

**DONE GATE.**
- [ ] Click on share link redirects in <100 ms and writes one referral row.
- [ ] Conversion attribution: a review submitted within 7d of clicking a referral link is attributed to that advocate.
- [ ] Leaderboard shows top 10 advocates per location, last 30/90 days.

---

## 5. Phase C — Polish & accessibility

### Session C1 — Staff Mode

**Scope.** Mobile-first front-desk surface. Staff scans a QR or taps a kiosk button, the page is locked to their location, and customer-facing review flow is one-tap-away.

**Prototype:** [`08-staff-mode.html`](08-staff-mode.html).

**Files to add:**
- `app/staff/[location_id]/page.tsx` — staff home (PIN-gated)
- `app/staff/[location_id]/handoff/page.tsx` — full-screen review handoff screen
- `lib/staff/auth.ts` — short-lived signed cookie auth (no full Supabase login)
- `supabase/migrations/0017_staff_pins.sql` — per-location staff PIN

**DONE GATE.**
- [ ] PIN session lasts 12h, scoped to one location.
- [ ] All buttons ≥ 48×48px tap targets.
- [ ] Works fully offline once loaded (PWA shell).

---

### Session C2 — Compliance + Trilingual Polish + a11y

**Scope.** Legal pages, ARIA pass, contrast audit, RTL safety (Arabic deferred), Chinese typography polish (Noto Sans SC variants), Spanish copy review by native speaker.

**Files to add:**
- `app/(marketing)/privacy/page.tsx`
- `app/(marketing)/terms/page.tsx`
- `app/(marketing)/dpa/page.tsx` (Data Processing Addendum for B2B customers)

**DONE GATE.**
- [ ] axe-core score 0 critical / 0 serious on every public page.
- [ ] All headings use Fraunces; all body uses Onest/Newsreader; no system-font fallback visible on supported devices.
- [ ] All three languages reviewed for tone match.

---

## 6. Phase D — Pre-launch ops

### Session D1 — Twilio A2P 10DLC Registration

Brand registration, campaign approval, brand-vetted score, opt-in/opt-out compliance.

**DONE GATE.** Twilio brand approved; campaign approved; outgoing SMS routes via vetted number pool.

---

### Session D2 — Google OAuth App Verification

Submit OAuth consent screen, verify domain ownership, supply privacy/terms (C2), pass security review.

**DONE GATE.** Verified status on `console.cloud.google.com/auth`. Consent screen no longer shows "Unverified app" warning.

---

### Session D3 — Founding 50 Outreach

Build the founding-50 list (Tier 1: warm WeChat contacts, Tier 2: cold local clinics, Tier 3: agencies). Use templates from [`OUTREACH_SCRIPTS.md`](OUTREACH_SCRIPTS.md).

**DONE GATE.** 50 founding sign-ups locked at $39/$89/$249. Stripe shows recurring MRR > $2,000.

---

## 7. Phase E — Deferred (v1.6 / v1.7)

From `BAAM_REVIEW_MASTER_PLAN.md`. Not started until Phase D is done and 30+ founding customers are active.

Highlights:
- Themes engine (auto-cluster reviews into themes per location)
- Partner / agency multi-tenant
- Landing-page builder (per-campaign URLs)
- Advanced advocate rewards
- AI Q&A widget (answer "is this clinic good for X" using review corpus)

---

## 8. Out of scope (explicitly)

- Multi-language beyond EN / 中文 / ES
- Native mobile apps
- White-label reseller mode (deferred to E)
- HIPAA-grade encryption — current encryption sufficient for non-PHI review data; revisit at 100 customers
- Replacing Supabase, Resend, or Twilio

---

## 9. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stripe webhook lag → plan state stale | medium | sync on next page load via lightweight `lib/billing/sync.ts` |
| Satori CJK rendering blocks share cards | medium | bundle Noto Sans SC subset; fallback to system serif |
| 10DLC rejection delays launch | low | start D1 in parallel with B-phase; have email-only fallback |
| Migration 0010 breaks existing flow | low | apply to staging copy first; back-fill defaults are non-null with sensible values |
| Onboarding wizard adds friction | medium | every step skippable; track drop-off per step |

---

## 10. Execution log

| Session | Started | Shipped | Notes |
|---|---|---|---|
| A1 | 2026-05-12 | — | revenue moment + consent layer |
| A2 | — | — | |
| A3 | — | — | |

(Each completed session appends a row + a brief retro paragraph below.)

---

## 11. Open questions deferred to mid-execution

- Per-location custom domain on share links (e.g., `share.drhuang.com`)? Re-evaluate after B4.
- Switch share-card renderer to `@vercel/og` vs. raw `satori-html`? Decide during A1.
- Founding cohort cap at 50 or 100? Decide during A3 based on A2 traffic.

---

**Next action:** start Session A1 — migration 0010 + consent layer + thank-you page rebuild.
