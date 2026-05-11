# BAAM Review — Progress Log

*Snapshot of what's built, in the order it was built. Pair with [BAAM_REVIEW_MASTER_PLAN.md](BAAM_REVIEW_MASTER_PLAN.md) (the strategy) and [ARCHITECTURE.md](ARCHITECTURE.md) (the system design).*

**Status as of latest commit: Sessions 1–10 of 12 shipped to production at `review.baamplatform.com`. Sessions 11 (Stripe billing) and 12 (marketing + onboarding polish) remain.**

---

## Session map

| # | Brief | Status | Key files |
|---|---|---|---|
| 1 | Scaffold + auth | ✅ Shipped | [app/login](../app/login), [app/signup](../app/signup), [app/app/layout.tsx](../app/app/layout.tsx), [proxy.ts](../proxy.ts), [lib/supabase/](../lib/supabase/) |
| 2 | Schema + RLS | ✅ Shipped | [supabase/migrations/0001–0003](../supabase/migrations/), [lib/database.types.ts](../lib/database.types.ts) |
| 3 | GBP OAuth + place lookup | ✅ Shipped | [lib/google/](../lib/google/), [app/api/auth/google/](../app/api/auth/google/), [app/app/locations/connect/](../app/app/locations/connect/) |
| 4 | Location admin UI | ✅ Shipped | [app/app/locations/[id]/](../app/app/locations/%5Bid%5D/), [components/locations/](../components/locations/) |
| 5 | Public review page | ✅ Shipped | [app/r/[slug]/](../app/r/%5Bslug%5D/), [lib/i18n/review.ts](../lib/i18n/review.ts), [components/review/](../components/review/) |
| 6 | AI-assisted writing | ✅ Shipped | [lib/ai/draft.ts](../lib/ai/draft.ts), [app/api/draft/](../app/api/draft/), [components/review/draft-picker.tsx](../components/review/draft-picker.tsx) |
| 7 | Send via SMS + email | ✅ Shipped | [app/app/send/](../app/app/send/), [lib/messaging/](../lib/messaging/), [app/api/webhooks/](../app/api/webhooks/) |
| 8 | QR code generator | ✅ Shipped | [app/api/qr/[slug]/](../app/api/qr/%5Bslug%5D/), [app/app/locations/[id]/qr/](../app/app/locations/%5Bid%5D/qr/), [lib/pdf/qr-poster.ts](../lib/pdf/qr-poster.ts) |
| 9 | Embed script | ✅ Shipped | [app/api/embed.js/](../app/api/embed.js/), [app/api/embed-load/](../app/api/embed-load/), [app/app/locations/[id]/embed/](../app/app/locations/%5Bid%5D/embed/) |
| 10 | Analytics dashboard | ✅ Shipped | [app/app/page.tsx](../app/app/page.tsx), [app/app/reviews/](../app/app/reviews/), [app/app/analytics/](../app/app/analytics/), [lib/analytics/aggregate.ts](../lib/analytics/aggregate.ts) |
| 11 | Stripe billing | ⏳ Not started | — |
| 12 | Marketing site + onboarding | ⏳ Not started | [app/page.tsx](../app/page.tsx) (placeholder) |

---

## Session details

### Session 1 — Scaffold + auth

Next.js 16 + TypeScript strict + Tailwind CSS v4 + Supabase SSR auth on port 4001.

- Email + password signup with verification email, login, signout (`POST /api/auth/signout`).
- BAAM design tokens in [globals.css](../app/globals.css) via Tailwind `@theme`: forest/cream/gold palette, Fraunces (display) + Onest (UI) loaded via `next/font`.
- [proxy.ts](../proxy.ts) (Next 16's rename of `middleware.ts`) gates `/app/*` and redirects unauthenticated requests to `/login?next=…`.
- Three Supabase clients in [lib/supabase/](../lib/supabase/): browser (anon), server (cookie-aware), and proxy (edge session refresh).
- Sidebar + user-card admin shell at [components/admin/](../components/admin/).

**Deviations from the original brief:** Next.js 16 instead of 15 (latest scaffolder), Tailwind v4 CSS-first config instead of `tailwind.config.ts`. App Router and design tokens are otherwise identical to the brief.

### Session 2 — Schema + RLS

Eight tables matching master plan §8 with full RLS, an auto-account-creation auth trigger, and TypeScript types.

- [0001_init.sql](../supabase/migrations/0001_init.sql): `accounts`, `users`, `locations`, `review_requests`, `landing_events`, `private_feedback`, `embed_loads`, `subscription_events` with FK constraints, check constraints, indexes, `updated_at` triggers.
- [0002_rls.sql](../supabase/migrations/0002_rls.sql): every admin table is scoped via a `SECURITY DEFINER` helper `public.current_account_id()` that avoids RLS recursion on the `users` table.
- [0003_auth_trigger.sql](../supabase/migrations/0003_auth_trigger.sql): when an `auth.users` row is inserted, automatically create `accounts` + `users` rows. Includes a one-shot backfill for users that pre-date the trigger.
- [database.types.ts](../lib/database.types.ts) hand-written to match. Browser/server/proxy clients are typed against `Database`.
- [lib/supabase/service.ts](../lib/supabase/service.ts) exposes a service-role client (RLS bypass) gated by `server-only` for public review reads and webhooks.

### Session 3 — Google Business Profile OAuth

Connect-Google flow that exchanges an authorization code for tokens, stores them, and pulls accessible GBP locations.

- [0004_google_tokens.sql](../supabase/migrations/0004_google_tokens.sql): `google_oauth_tokens` table, RLS-enabled with no `authenticated` policies (service-role only).
- [lib/google/oauth.ts](../lib/google/oauth.ts): hand-rolled OAuth (consent URL, code exchange, refresh, userinfo). Scope = `business.manage`.
- [lib/google/business-profile.ts](../lib/google/business-profile.ts): typed wrappers for My Business Account Management + Business Information APIs. `getValidAccessToken()` auto-refreshes 60s before expiry.
- [/api/auth/google/start](../app/api/auth/google/start/route.ts): random state cookie, redirect to consent.
- [/api/auth/google/callback](../app/api/auth/google/callback/route.ts): state verification, token exchange, service-role upsert.
- [/app/locations/connect/picker](../app/app/locations/connect/picker/page.tsx): server component fetches GBP locations and a server action inserts a `public.locations` row with `place_id`, review URL, address, category, slug.
- New locations default `supported_languages = ['en', 'zh', 'es']` (multilingual is the BAAM wedge).

### Session 4 — Location admin UI

Per-location settings page at `/app/locations/[id]` with branding, multilingual welcome messages, external links, custom prompt override, sender configuration, and delete.

- [0005_storage_logos.sql](../supabase/migrations/0005_storage_logos.sql): public `logos` bucket with RLS restricting writes to `<account_id>/*` paths.
- [components/locations/sender-fields.tsx](../components/locations/sender-fields.tsx) handles per-location email sender configuration (added Session 7-followup).
- [LocalizedField](../components/locations/localized-textarea.tsx) tabbed input that emits per-language form fields (`welcome_<lang>`, `service_chips_<lang>`, etc.).
- Logo upload via browser-side Supabase Storage client.

### Session 5 — Public review page

Mobile-first `/r/[slug]` route with three-language UI, chip-driven question flow, platform handoff CTAs, and a private feedback alternative.

- Server component fetches the location via service-role client, picks language from `?lang` | tracking token | `Accept-Language` | location default.
- [ReviewFlow](../components/review/review-flow.tsx) state machine: input → loading → drafts → error.
- [LanguageSwitcher](../components/review/language-switcher.tsx), [ChipGroup](../components/review/chip-group.tsx), [StarRating](../components/review/star-rating.tsx) (default 5★ to match Google's own form).
- [/feedback](../app/r/%5Bslug%5D/feedback/page.tsx) typed form for the compliance-safe path. Server action inserts into `private_feedback`.
- [/thank-you](../app/r/%5Bslug%5D/thank-you/page.tsx) confirmation, copy varies by `?via=`.
- [/api/track](../app/api/track/route.ts) best-effort POST endpoint inserting `landing_events`; side-effects mark `review_requests.clicked_at` and `completed_at`.
- WeChat in-app browser detection ([lib/wechat.ts](../lib/wechat.ts)) with a localized "open in browser" hint — addresses the silent Google sign-in failure for Chinese customers tapping SMS links inside WeChat.
- Tiny i18n module ([lib/i18n/review.ts](../lib/i18n/review.ts)) with EN/中文/Español strings + `pickLanguage()`.
- Per-`business_type` default chip catalogs ([lib/business-prompts.ts](../lib/business-prompts.ts)) with editor in Location Settings.

### Session 6 — AI-assisted writing flow

Claude Haiku 4.5 generates three tonally-distinct draft reviews from the chip inputs. Customer picks, edits, clicks "Looks good" → text auto-copies to clipboard and Google's review form opens.

- [lib/ai/draft.ts](../lib/ai/draft.ts): localized system prompts enforcing three drafts (warm/specific/brief), 50–90 words, first person, no AI disclosure, no medical claims, rating-calibrated sentiment. System prompt cached with `cache_control: { type: 'ephemeral' }` for bursty traffic.
- [/api/draft](../app/api/draft/route.ts): validates inputs, checks account suspension, calls Claude, parses tolerant JSON envelope, logs `draft_generated` / `draft_regenerated`, marks `review_requests.draft_generated_at`.
- [DraftPicker](../components/review/draft-picker.tsx): three cards with tone labels, radio-style selection, inline edit textarea, regenerate, copy-to-clipboard with visible "Copied" badge.
- "Skip and go straight to Google" fallback always visible (in case Claude is down or customer wants to write their own).

### Session 7 — Send via SMS + email

One-recipient-at-a-time admin send form with channel toggle, language picker, live message preview (editable), and per-location sender configuration.

- [lib/tokens.ts](../lib/tokens.ts): nanoid-based read-aloud-safe tracking tokens (14 chars, no ambiguous 0/O/1/l).
- [lib/messaging/templates.ts](../lib/messaging/templates.ts): SMS bodies include TCPA opt-out (`Reply STOP…`); email templates are deliberately plain/personal-looking to escape Gmail Promotions.
- [lib/messaging/resend.ts](../lib/messaging/resend.ts): Resend SDK wrapper with optional `from` override.
- [lib/messaging/twilio.ts](../lib/messaging/twilio.ts): hand-rolled fetch to Twilio Messages API + `isTwilioConfigured()` so the UI degrades gracefully.
- [lib/messaging/velocity.ts](../lib/messaging/velocity.ts): hourly + daily caps. Soft (20/hr, 100/day) → set `flagged_at`; hard (60/hr, 300/day) → block.
- [0006_abuse_signals.sql](../supabase/migrations/0006_abuse_signals.sql) added `review_requests.flagged_at` + `accounts.suspended_at` ahead of enforcement.
- [0008_location_sender.sql](../supabase/migrations/0008_location_sender.sql) moved sender config from `accounts` to `locations` so multi-business accounts can have distinct senders.
- Editable message preview in the send form — owner can clean up SEO-stuffed Google Business names before sending.
- Reply-To set to the sending user's address so customers can reply to a real person (better Gmail classification).
- [/api/webhooks/twilio](../app/api/webhooks/twilio/route.ts) and [/api/webhooks/resend](../app/api/webhooks/resend/route.ts) update `delivered_at` / `opened_at` from provider callbacks.

### Session 8 — QR code generator

Per-location printable letter-size PDF posters with venue source attribution.

- [lib/qr.ts](../lib/qr.ts): `qrcode` wrappers.
- [lib/pdf/qr-poster.ts](../lib/pdf/qr-poster.ts): `pdf-lib` builder. Cream background, white card, BAAM REVIEW eyebrow, business name (autosized), 3.6" QR, primary English instruction, secondary Spanish instruction, venue caption, footer. Non-Latin-1 stripped (Helvetica can't render CJK — embedding deferred to v2).
- [/api/qr/[slug]](../app/api/qr/%5Bslug%5D/route.ts): GET returns PDF with `Content-Disposition: attachment`.
- [/app/locations/[id]/qr](../app/app/locations/%5Bid%5D/qr/page.tsx): admin UI with venue presets (front desk, receipt, business card, table tent, window decal, custom) + language selector + live QR preview.
- Public review page captures `?source=` and threads it through every `landing_events.metadata.source` value.

### Session 9 — Embed script

One-line `<script>` snippet customers paste into their website. Renders a styled Leave-a-Review button.

- [/api/embed.js](../app/api/embed.js/route.ts): edge route returning a ~1.2KB IIFE. Reads `data-slug` / `data-color` / `data-label` / `data-lang` / `data-position` from `document.currentScript`. Fire-and-forget load tracking via `mode: 'no-cors'`. Renders an `<a>` inline (default) or fixed bottom-right.
- [/api/embed-load](../app/api/embed-load/route.ts): logs origin/referer to `embed_loads`. CORS-permissive.
- [/app/locations/[id]/embed](../app/app/locations/%5Bid%5D/embed/page.tsx): builder UI with label, color, language, position toggle, copy-paste snippet block, live preview.

### Session 10 — Analytics dashboard

Three pages reading from the data we've been logging since Session 5.

- [/app](../app/app/page.tsx) — 5 stat cards + funnel viz + 3 breakdowns + recent requests + private feedback peek + empty state.
- [/app/reviews](../app/app/reviews/page.tsx) — unified inbox: All / Private feedback / Completed reviews / Unread tabs. Server actions mark feedback read/unread.
- [/app/analytics](../app/app/analytics/page.tsx) — 90-day deeper view: per-location, language, channel, platform, source, embed origin breakdowns + flagged requests list.
- [lib/analytics/aggregate.ts](../lib/analytics/aggregate.ts) pure helpers: `countBy`, `buildFunnel`, `pctFormat`, `relativeTime`.
- [components/admin/](../components/admin/) `funnel.tsx`, `breakdown.tsx`, `stat-card.tsx` reusable.

---

## What's left

### Session 11 — Stripe billing

Subscription tiers in Stripe (Free / Starter $39 / Growth $89 / Agency $249 per master plan §12), Checkout for upgrades, Customer Portal for cancellation, webhook-driven `accounts.subscription_*` sync, hard-paywall when the monthly request cap is exceeded.

### Session 12 — Marketing site + onboarding polish

Replace the "Coming soon" home, build pricing / privacy / terms pages, 4-step onboarding wizard from signup → first request sent.

### Pre-launch checklist (per master plan §13)

- Twilio A2P 10DLC registration
- Google OAuth verification (move from Testing → In production)
- Real privacy + terms pages (Session 12)
- Stripe products configured in production
- Test runs with DrHuang and 1–2 friendly other businesses
- Email deliverability warming (Resend domain reputation matures over weeks)
- SEO basics (title, meta, sitemap, robots)
- OG images and social cards

---

## Migrations applied to production

Run in order in the Supabase SQL editor. See [supabase/README.md](../supabase/README.md) for the application workflow.

```
0001_init.sql                Tables, indexes, FKs, updated_at triggers
0002_rls.sql                 RLS policies + current_account_id() helper
0003_auth_trigger.sql        handle_new_user trigger + backfill
0004_google_tokens.sql       Per-account GBP OAuth token storage
0005_storage_logos.sql       Public logos bucket + folder-scoped RLS
0006_abuse_signals.sql       review_requests.flagged_at, accounts.suspended_at
0007_account_sender.sql      [SUPERSEDED by 0008] account-level sender
0008_location_sender.sql     Per-location sender config (replaces 0007)
```

---

## Key non-obvious decisions

These are choices that look arbitrary in code but had a reason; future-you will want to know.

- **Per-location, not per-account, sender configuration.** Master plan assumes one business per account; in practice an agency owner ran one account with three unrelated businesses. Migration 0008 fixed this. (Conversation: 2026-05-10.)
- **Velocity caps soft-flag, not block, by default.** 20/hr or 100/day sets `flagged_at` but lets the send through. Hard block at 60/hr or 300/day. Tuned for "burst of legitimate customers" being possible without blocking legitimate work. (See [lib/messaging/velocity.ts](../lib/messaging/velocity.ts).)
- **Default 5★ on public page rating.** Matches Google's own review form. Not gating — private feedback path always visible. (Discussed 2026-05-10, see [components/review/review-flow.tsx](../components/review/review-flow.tsx).)
- **Editable message preview in Send form.** Some Google Business names are stuffed with SEO keywords ("Oishi sushi express:best;sushi;japanese;cuisine;…"). Owners can edit before sending. (Added after Oishi was connected; see Session 7 history.)
- **WeChat in-app browser detection.** WeChat blocks Google sign-in; Chinese customers tapping SMS links inside WeChat would silently fail at the handoff. We show a localized "open in browser" hint when `MicroMessenger` is in the UA.
- **Auto-copy on draft selection.** Selecting a draft copies it to clipboard immediately; doesn't wait for "Looks good". Customer doesn't get to Google's form and realize they have nothing to paste.
- **Public review page rating doesn't transfer to Google.** Google's URL doesn't accept a rating parameter — anti-spam policy. Our rating drives AI draft sentiment instead. (Discussed at length 2026-05-10.)
- **Migration 0007 was superseded by 0008.** 0007 added sender columns to `accounts`. 0008 drops them and moves to `locations`. If applying fresh, both still need to run (each step is idempotent and additive past the drop).
- **CJK characters stripped from QR posters.** Helvetica can't render them; embedding Noto Sans SC adds ~10MB. Customers with Chinese-named businesses get a Latin-only version of their name on the print poster. Email and public page render Chinese fine; only the PDF is affected.

---

## Repository layout

```
baam-review/
  app/                       Next.js App Router
    page.tsx                 Marketing placeholder (rebuild in Session 12)
    layout.tsx               Root layout + fonts
    globals.css              Tailwind v4 @theme tokens
    login/                   Sign-in page
    signup/                  Sign-up page
    app/                     Authenticated admin shell
      page.tsx               Dashboard (Session 10)
      send/                  Send form
      reviews/               Inbox
      analytics/             Deeper analytics
      locations/             List + per-location settings/qr/embed
      settings/              Account settings
    api/
      auth/                  OAuth + signout
      draft/                 AI draft generation
      track/                 landing_events ingestion
      qr/[slug]/             PDF poster generator
      embed.js/              Embed script
      embed-load/            Embed load tracker
      webhooks/              Twilio + Resend
    r/[slug]/                Public review page (mobile-first)

  components/
    ui/                      Button, Input, Label, Textarea, Section, Field
    auth/                    LoginForm, SignupForm, AuthShell
    admin/                   Sidebar, UserCard, PageHeader, Funnel, Breakdown, StatCard
    locations/               LogoUploader, BrandColorPicker, LanguageFields, LocalizedField, SenderFields
    review/                  ReviewFlow, DraftPicker, ChipGroup, StarRating, LanguageSwitcher, WeChatHint, track

  lib/
    utils.ts                 cn()
    tokens.ts                Tracking token generator
    wechat.ts                UA detection
    business-prompts.ts      Default chip sets per business_type
    database.types.ts        Hand-maintained Database type
    supabase/                Three client variants
    google/                  OAuth + GBP API
    messaging/               templates / resend / twilio / velocity
    ai/                      Anthropic draft generation
    pdf/                     QR poster builder
    i18n/                    EN/ZH/ES strings
    analytics/               aggregate helpers

  supabase/
    migrations/              0001 through 0008
    seed.sql                 Optional demo data
    README.md                Application workflow

  docs/
    BAAM_REVIEW_MASTER_PLAN.md       Strategy
    PRE_SESSION_1_SETUP.md           Initial manual setup
    SESSION_1_BRIEF.md               First session brief
    PROGRESS.md                      ← This file
    ARCHITECTURE.md                  System design
    DEVELOPER_ONBOARDING.md          New-contributor setup
    OPERATIONS.md                    Deploy + manual ops
    DOMAIN_MIGRATION.md              baamplatform.com → baamreview.com
    01–06-*.html                     Original visual prototypes
```
