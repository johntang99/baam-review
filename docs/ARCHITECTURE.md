# BAAM Review — Architecture

*How the system fits together. For "what's been built" see [PROGRESS.md](PROGRESS.md). For setup see [DEVELOPER_ONBOARDING.md](DEVELOPER_ONBOARDING.md).*

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript strict) | Matches BAAM stack; server components for performance; edge runtime for `/api/embed.js` |
| Hosting | Vercel | Atomic deploys; auto-SSL on multiple domains; edge functions |
| Database & Auth | Supabase (project `baam-review`) | Postgres + RLS + auth + storage in one |
| Email | Resend | Modern DX; React Email; better than SES/Postmark for greenfield |
| SMS | Twilio (Messages API, hand-rolled fetch) | US deliverability + A2P 10DLC; no SDK to keep bundle small |
| AI | Anthropic Claude Haiku 4.5 | Fast + cheap for short generations; prompt caching reduces cost on bursty traffic |
| Storage | Supabase Storage (`logos` bucket) | Same project; folder-by-account RLS |
| PDF | `pdf-lib` + `qrcode` | Server-side; no client deps; Edge-incompatible (Node runtime only) |
| UI | Tailwind v4 CSS-first + small shadcn-style primitives + `lucide-react` | Matches BAAM admin standard |
| Tokens | `nanoid` with readable alphabet | URL-safe, no ambiguous 0/O/1/l/I |

Tailwind v4 uses **CSS-first config**. All design tokens live in [`app/globals.css`](../app/globals.css) inside `@theme { ... }`. There is no `tailwind.config.ts`.

---

## System diagram

```
                ┌──────────────────────────┐
                │  review.baamplatform.com │
                │   (Next.js on Vercel)    │
                └──────────┬───────────────┘
                           │
       ┌───────────────────┼────────────────────┐
       │                   │                    │
 ┌─────▼──────┐    ┌───────▼───────┐    ┌───────▼────────┐
 │ Marketing  │    │  Admin app    │    │ Public review  │
 │   (/)      │    │ /app/*        │    │ /r/[slug]      │
 │ unauthed   │    │ (proxy gates) │    │ unauthed       │
 └────────────┘    └───────┬───────┘    └────────┬───────┘
                           │                     │
                           ▼                     ▼
         ┌────────────────────────────────────────────────┐
         │  Supabase Postgres + RLS                       │
         │  accounts · users · locations · ...            │
         │  Reads via authed client (RLS scoped)          │
         │  Public + webhook writes via service-role      │
         └─────────────┬──────────────────────────────────┘
                       │
   ┌───────────────────┼────────────────────┬────────────┐
   ▼                   ▼                    ▼            ▼
┌────────┐   ┌──────────────────┐   ┌───────────┐  ┌─────────┐
│Anthropic│  │  Google APIs     │   │  Twilio   │  │ Resend  │
│ Claude  │  │  OAuth + GBP     │   │  SMS      │  │ Email   │
└────────┘   └──────────────────┘   └───────────┘  └─────────┘
```

Three distinct surfaces share one Next.js project on one Vercel deploy on one subdomain:

| Surface | Path | Auth | Design |
|---|---|---|---|
| Marketing | `/`, `/login`, `/signup` | Public | Desktop-first |
| Admin app | `/app/*` | Auth required (cookie session) | Desktop-first, sidebar layout |
| Public review | `/r/[slug]`, `/r/[slug]/feedback`, `/r/[slug]/thank-you` | Public, narrow card | **Mobile-first**, no admin chrome |
| API + webhooks | `/api/*` | Mixed (some public, some authed) | Edge or Node depending on the route |

---

## Supabase client variants

Three different ways to talk to Supabase, each with a different RLS posture:

| Client | File | Used by | RLS posture |
|---|---|---|---|
| Browser | [lib/supabase/client.ts](../lib/supabase/client.ts) | Client components (sign-in form, file uploads) | Scoped by the user's auth cookie |
| Server | [lib/supabase/server.ts](../lib/supabase/server.ts) | Server components, route handlers, server actions | Scoped by the user's auth cookie via `next/headers` |
| Proxy | [lib/supabase/middleware.ts](../lib/supabase/middleware.ts) | [proxy.ts](../proxy.ts) for session refresh + `/app/*` gating | Same as server, but in the edge proxy |
| Service | [lib/supabase/service.ts](../lib/supabase/service.ts) | Public review reads, public POST endpoints, webhooks | **Bypasses RLS** — only callable from trusted server code (`server-only` import) |

The `server-only` package in `lib/supabase/service.ts` makes it a build error if a client component imports it. The service role key is never exposed to the browser.

---

## Row-level security model

Every admin-facing table has RLS policies that scope by **the caller's account**. The helper:

```sql
CREATE FUNCTION public.current_account_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT account_id FROM public.users WHERE id = auth.uid(); $$;
```

`SECURITY DEFINER` is critical — it runs with the function-owner's privileges, so it doesn't hit RLS recursion when reading from `users` (which itself has RLS).

The pattern for each table:

```sql
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations_all_own_account" ON locations
  FOR ALL TO authenticated
  USING (account_id = public.current_account_id())
  WITH CHECK (account_id = public.current_account_id());
```

For tables that scope via `location_id` (review_requests, landing_events, etc.) the policy uses a subquery:

```sql
USING (
  location_id IN (
    SELECT id FROM locations WHERE account_id = public.current_account_id()
  )
)
```

**Tables without an `authenticated` policy** are service-role-only:

- `google_oauth_tokens` — tokens are never readable by users, only by trusted server code
- Storage objects in `logos` — writes are scoped to `<account_id>/*` by the `storage.foldername(name)[1] = current_account_id()::text` policy; reads are public (bucket is public)

When the public review page (`/r/[slug]`) and webhooks (`/api/webhooks/*`) need to read or write, they use [`createServiceClient()`](../lib/supabase/service.ts) and **return only fields safe for public consumption**.

---

## Request flows

### Owner workflow: signup → first send

```
1.  User visits / → clicks Create account
2.  /signup form → supabase.auth.signUp() with full_name in metadata
3.  Supabase inserts into auth.users
4.  handle_new_user trigger (migration 0003) creates:
       INSERT INTO accounts (name, primary_email) VALUES (...)
       INSERT INTO users (id, account_id, full_name, 'owner')
5.  Verification email lands → user clicks → redirected to /app
6.  proxy.ts updateSession() runs, gets user, allows /app/*
7.  /app dashboard loads (RLS scoped to their account_id)
8.  User → /app/locations → "Connect Google" → /api/auth/google/start
       (random state cookie set, redirected to consent screen)
9.  Google redirects to /api/auth/google/callback
       Token exchange, upsert into google_oauth_tokens (service role)
       Redirects to /app/locations/connect/picker
10. Picker page fetches GBP accounts + locations
       (uses stored access token; refreshes if expired)
11. User clicks "Use this location" → server action inserts into locations
12. User → /app/send → fills form → server action:
       a. validateInputs, checkSuspension, checkVelocity
       b. generateTrackingToken (nanoid)
       c. buildSmsBody or buildEmail with localized template
       d. sendSmsViaTwilio or sendEmailViaResend
       e. insert review_requests row with sent_at, flagged_at
```

### Customer workflow: tap link → post on Google

```
1.  Customer receives SMS/email with link review.baamplatform.com/r/<slug>?t=<token>
2.  Lands on /r/[slug] (server component, service-role read)
3.  Language picked from token → Accept-Language → location default
4.  page_view tracked in landing_events (also marks review_requests.clicked_at)
5.  Customer fills three chip questions (each fires question_answered)
6.  Default rating 5 (matches Google's own form)
7.  Customer taps "Help me write a review" → POST /api/draft
       a. Claude Haiku generates 3 drafts in target language
       b. cache_control on system prompt — repeated requests cache for ~5min
       c. draft_generated logged, review_requests.draft_generated_at marked
8.  DraftPicker shows three cards (warm / specific / brief)
       a. First card auto-selected and auto-copied to clipboard
       b. User can edit inline → re-copies on save
       c. User can regenerate → POST /api/draft with regenerate=true → draft_regenerated
9.  User clicks "Looks good — post to Google":
       a. platform_clicked event with metadata (service, rating, descriptor, source, tone)
       b. review_requests.completed_platform/completed_at marked
       c. Google's review form opens in new tab (deep-linked to place_id)
       d. Current tab navigates to /r/[slug]/thank-you?via=google
10. Customer pastes draft into Google's form, taps stars, taps Post
        Google publishes — we don't get a webhook; "clicked → done" is our proxy metric
```

### Public review page → private feedback alternative

Always visible alongside Google CTA. Compliance-safe (Google policy forbids gating).

```
1.  Customer clicks "Or share privately with us"
2.  /r/[slug]/feedback form (typed, with optional rating + contact)
3.  Submit → server action submitPrivateFeedback
4.  Service-role client inserts into private_feedback
5.  private_feedback_submitted event logged
6.  review_requests.completed_platform = 'private_feedback' set
7.  Redirect to /r/[slug]/thank-you?via=private
8.  Owner sees it in /app/reviews inbox with unread badge
```

### Embed flow on customer's website

```
1.  Customer pastes <script src="…/api/embed.js" data-slug="…" ...>
2.  /api/embed.js is an Edge route returning ~1.2KB IIFE
3.  IIFE reads data-attrs from document.currentScript
4.  Fires fetch to /api/embed-load?slug=… (mode: 'no-cors')
       Server logs into embed_loads with Origin/Referer
5.  Renders <a> with inline styles (immune to customer CSS reset)
6.  Customer scans/clicks → opens /r/<slug>?source=embed in new tab
```

### QR poster flow

```
1.  Owner → /app/locations/[id]/qr → picks venue (front_desk, receipt, ...)
2.  Live QR preview built in-browser with qrcode library
3.  Owner clicks "Download printable PDF"
4.  Browser GETs /api/qr/[slug]?source=…&lang=…
5.  Node runtime: pdf-lib + qrcode generate the poster
6.  Returns application/pdf with Content-Disposition: attachment
7.  Owner prints, sticks at front desk
8.  Customer scans → /r/<slug>?source=front_desk → tracked
```

---

## Data model essentials

See [migration 0001](../supabase/migrations/0001_init.sql) for SQL, [database.types.ts](../lib/database.types.ts) for TypeScript types.

```
auth.users (Supabase managed)
  └─ public.users (id = auth.users.id, account_id)
       └─ public.accounts (one per business or agency)
            ├─ public.locations (1..N per account; v1 caps in §12)
            │    ├─ public.review_requests (1..N per location)
            │    │    └─ public.landing_events (1..N per request, via location)
            │    └─ public.private_feedback (1..N per location)
            │    └─ public.embed_loads (1..N per location)
            ├─ public.google_oauth_tokens (1:1, service-role only)
            └─ public.subscription_events (audit log; Session 11)
```

Key columns to know:

- **`locations.slug`** is the public URL component. Generated from `display_name` + 4 random chars. Unique.
- **`review_requests.tracking_token`** is the nanoid in the URL `?t=…`. Each send creates one. Token reuse (one URL opened many times) is a spam signal.
- **`landing_events.metadata`** is `jsonb`. Carries `source`, `service`, `rating`, `descriptor`, `tone`, `edited`, `platform` depending on `event_type`.
- **`review_requests.flagged_at` + `flag_reason`** are set by velocity checks; `accounts.suspended_at` is set manually by BAAM Studio admin. Neither is enforced yet at write time (Session 10 dashboard surfaces them; Session 11 will gate sends).

---

## Multilingual handling

Three languages everywhere customer-facing: **EN / 中文 / Español**.

- UI strings: [`lib/i18n/review.ts`](../lib/i18n/review.ts) — typed `STRINGS` object keyed by language.
- Per-language welcome messages, custom URL labels, prompt chips, message templates: stored as `jsonb` per language code on the relevant row.
- Language picker on public review page: client component that sets `?lang=` and re-renders.
- Server-side language resolution: [`pickLanguage()`](../lib/i18n/review.ts) — order is `?lang=` → tracking-token request → `Accept-Language` → location's `default_language`.
- AI drafts: Claude system prompt enforces the target language. See [`lib/ai/draft.ts`](../lib/ai/draft.ts).

The one place CJK is not rendered: **printed PDF posters**. Helvetica can't render CJK; embedding Noto Sans SC adds ~10MB to the deploy. Stripped on the poster. Email / SMS / public page / drafts all handle CJK fine.

---

## Source attribution

Every customer arrival is tracked back to its origin via `landing_events.metadata.source`:

| Source value | Set by | Meaning |
|---|---|---|
| `null` | Direct visit | Customer typed the URL or clicked an SMS/email link (token provides attribution) |
| `front_desk`, `receipt`, `business_card`, `table_tent`, `window` | QR poster | Encoded in the printed QR's URL |
| Custom string | QR poster | Whatever the owner typed for "Custom" venue |
| `embed` | Embed script | Always for clicks from `/api/embed.js`-generated buttons |

The dashboard breakdowns ([Session 10](../app/app/page.tsx)) aggregate this so the owner sees which surface converts best.

---

## Abuse-prevention plumbing

Built in [migration 0006](../supabase/migrations/0006_abuse_signals.sql), enforced in [`lib/messaging/velocity.ts`](../lib/messaging/velocity.ts):

| Signal | Threshold | Action |
|---|---|---|
| Hourly velocity | ≥ 20 / hr | Soft flag: `review_requests.flagged_at = now()`, `flag_reason = 'velocity:hourly'` |
| Daily velocity | ≥ 100 / day | Same, with `flag_reason = 'velocity:daily'` |
| Hard hourly | ≥ 60 / hr | Block the send entirely; return error |
| Hard daily | ≥ 300 / day | Same |
| Account suspension | Manual | `accounts.suspended_at IS NOT NULL` → all sends blocked |

Surface: [`/app/analytics`](../app/app/analytics/page.tsx) Flagged requests section. Stripe billing in Session 11 will add tier-based monthly request caps on top of these velocity caps.

Master plan §11 documents the broader fake-review-prevention policy.

---

## Environment variables (overview)

See [.env.local.example](../.env.local.example) for the full list. Categories:

- **Supabase** — URL, anon key, service-role key
- **Public app URL** — `NEXT_PUBLIC_APP_URL` (used to build every customer-facing URL)
- **Anthropic** — API key for AI drafts (Session 6)
- **Resend** — API key + default `RESEND_FROM` address for email sends (Session 7)
- **Twilio** — Account SID + auth token + from number for SMS (Session 7, optional until A2P registration)
- **Google** — OAuth client ID + secret for GBP connect (Session 3)

`NEXT_PUBLIC_APP_URL` is the single most important variable — it threads into every generated link, embed snippet, QR destination, and webhook URL. Changing it is also how we migrate domains; see [DOMAIN_MIGRATION.md](DOMAIN_MIGRATION.md).
