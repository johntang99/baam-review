# BAAM Review — Master Plan v1.1

*Standalone review collection SaaS, built on the BAAM Studio stack, served from `review.baamplatform.com`.*

**Changelog from v1.0**: Locked subdomain decision (`review.baamplatform.com` over subdirectory). Added explicit URL structure across surfaces. Added responsive strategy section clarifying desktop-first for marketing/admin, mobile-first for public review pages. Removed resolved open question on custom domain.

---

## 1. Vision & Positioning

BAAM Review is a review collection tool for local businesses that wins on two things competitors don't do well: **AI-assisted review writing** that makes leaving a Google review take 60 seconds, and **first-class multilingual support** (English, Chinese, Spanish from day one). Every other category leader — Birdeye, Podium, NiceJob, GatherUp — funnels customers to a blank Google form and prays. We close that gap with a guided, three-question flow that produces a natural-sounding draft the customer reviews, edits, and posts.

**Positioning statement.** BAAM Review is the easiest way for a local business to turn happy customers into Google reviews. Setup in five minutes. Customer flow in sixty seconds. Three languages out of the box. From $39 a month.

**Who it's for, in v1.**
- Solo and small local businesses (1–3 locations) where the owner is also the operator
- Businesses with multilingual customer bases — TCM clinics, immigration lawyers, restaurants, salons, contractors
- BAAM Studio's existing client roster as a beachhead

**Who it's not for, in v1.**
- Multi-location enterprise chains (Birdeye and Reputation.com own this)
- Pure e-commerce (different review dynamics, often platform-native like Shopify reviews)
- Agencies wanting deep white-label until v2

**Strategic rationale.** Reviews drive local SEO, drive AI engine citations (the GEO bet), and drive trust at the moment of decision. A tool that compounds these is sticky. BAAM Review is also the right size for a parallel SaaS track: small enough to ship in 6–8 weeks, narrow enough to not distract from agency work, broad enough to serve as more than a single-client utility.

**Domain strategy (locked).** BAAM Review is served from the subdomain `review.baamplatform.com`. Marketing site, admin app, and public review pages all live on this single subdomain via path routing in one Next.js project. Subdirectory routing under `baamplatform.com/review` was considered and rejected: it tightly couples the BAAM Platform and BAAM Review codebases, and reads as a sub-feature of the agency rather than a distinct product at the customer SMS-link moment. Migration to a standalone domain (`baamreview.com`) is reserved for after launch — when it happens, point the new domain at the same Vercel project and add 301 redirects. One day of DNS work, no code changes.

---

## 2. Scope & Boundaries

### In scope for v1

- Self-serve account signup and onboarding
- Google Business Profile OAuth connection (using the existing BaaM Platform project)
- Hosted review page at `review.baamplatform.com/r/[slug]`
- AI-assisted writing flow with three-question chip UI
- Bilingual interface (EN, ZH, ES) on every customer-facing surface
- Send review request via SMS (Twilio) or email (Resend), one recipient at a time
- QR code generator producing per-location printable PDFs
- One-line `<script>` embed renders a "Leave a Review" button on any website
- Compliance-safe private feedback form alongside public CTAs (never gated)
- Basic analytics: sent → clicked → completed funnel, platform breakdown, language breakdown
- Stripe self-serve billing with three tiers
- Per-location branding (logo, color, welcome message, custom prompt questions)
- Marketing site at the root domain with pricing and signup

### Out of scope for v1

- Bulk customer upload and campaign automation
- Booking system integrations (Calendly, Square, Acuity, etc.)
- Review monitoring (pulling reviews back from Google to display in dashboard)
- Auto-response to reviews (replying to Google reviews from inside the dashboard)
- Schema markup back to client sites (the GEO loop-back — phase 2)
- Custom domain CNAME (`reviews.clientdomain.com`)
- White-label and agency multi-tenant management
- Yelp deep integration (we'll link out, not sync)
- Xiaohongshu integration (link out only — no API)
- Native mobile apps
- Public REST API and webhooks
- Incentive engine
- A/B testing of prompts

### Phase 2 (post-launch, prioritized)

1. Review monitoring — pull new Google reviews into dashboard, surface in the inbox
2. Schema markup loop-back — push fresh reviews onto client websites as `Review` schema (the GEO play)
3. Bulk upload via CSV
4. Custom domain support
5. Booking system webhooks (Calendly first)
6. Reply assistant — AI-drafted responses to incoming reviews
7. Multi-location bulk management
8. White-label tier for agencies (BAAM Studio is the first customer here, but so are other agencies)

---

## 3. Differentiation Strategy

The category is crowded. We win on three vectors:

**Convenience for the end customer.** Every competitor optimizes the business owner's workflow. We optimize the *customer's* workflow. The 60-second AI-assisted flow is the wedge. Most customers abandon Google review forms because writing is hard; we make writing trivial while keeping authenticity (customer's inputs drive the draft, customer edits and posts).

**Multilingual from day one.** Birdeye's Chinese support is a translated UI bolt-on. None of the major US competitors handle Chinese or Spanish fluently. For NY metro local businesses serving immigrant communities — BAAM's natural beachhead — this is a structural advantage.

**Pricing transparency and self-serve.** Birdeye and Podium gate everything behind sales calls. We publish pricing on the homepage and let users sign up with a credit card in five minutes. The buyer for this product is a busy owner-operator who does not have time for a 30-minute demo call.

Secondary differentiators that will matter as we grow:

- **Editorial brand identity** — the category looks like enterprise CRM. We look like a thoughtful product. This matters for word-of-mouth and trust in markets where the competition is generic.
- **BAAM ecosystem leverage** — for BAAM Studio clients, the reviews loop back into their site as schema markup, feeding the GEO score. No standalone competitor can do this.

---

## 4. User Personas

**The Owner-Operator.** Solo or small clinic, restaurant, law office, salon. Sees reviews as important but doesn't have time. Currently asking customers verbally and hoping. Will pay $39–89/month if it just works without their constant attention.

**The Front-Desk Staff.** The person actually using the tool day-to-day. Logs visits, hands customers QR codes, occasionally sends an SMS. Needs the admin to be obvious and mobile-friendly. May not be the account holder.

**The Customer.** The person leaving the review. Just had a service. Possibly older, possibly more comfortable in Chinese or Spanish than English. Already has the business's text or email open. Wants to be done in under a minute. Won't write a review if writing is hard.

**The BAAM Studio team (eventually).** Acting on behalf of multiple BAAM Local clients, needing an agency-level view. Phase 2 concern.

---

## 5. User Flows

### Owner signup to first review request sent
1. Land on marketing site → click "Start free trial"
2. Email + password signup → email verification
3. Onboarding wizard step 1: connect Google Business Profile via OAuth
4. Onboarding wizard step 2: confirm pulled location data, optionally upload custom logo, pick brand color
5. Onboarding wizard step 3: select supported languages (default: account language + EN), preview prompt questions
6. Onboarding wizard step 4: send a test review request to themselves
7. Land in dashboard → see funnel starting at 1 sent → clicked → review (their own test)
8. Optional: generate QR PDF for in-store placement, copy embed snippet for website

Target: 5 minutes from landing to first request sent.

### Daily owner workflow
1. After a good visit, open dashboard on phone or desktop
2. Click "Send a review request"
3. Enter customer name + phone or email + language
4. Click send → SMS or email goes out
5. Move on with their day

### Customer review flow (the wedge)
1. Customer receives SMS: "Hi [name], thanks for visiting [business]. Mind sharing your experience? [link]"
2. Tap link → land on `review.baamplatform.com/r/[slug]?t=[token]`
3. Page detects language from token + browser, shows business logo and a warm welcome
4. Three quick chip-style questions — 15 seconds total
5. AI generates 2–3 draft reviews, customer picks one
6. Buttons: *Looks good* / *Edit* / *Regenerate (different tone)*
7. Tap *Looks good* → draft copies to clipboard, Google review form opens in new tab
8. Customer pastes (or it's already pre-pasted on supported devices) and submits to Google
9. Tracking pixel fires on completion → dashboard shows the request as completed

Total time: 60 seconds.

### Embed flow on client website
1. Client copies one-line `<script>` snippet from dashboard
2. Pastes into their site's HTML or CMS template (works on WordPress, Squarespace, Webflow, Wix, raw HTML, BAAM sites)
3. A small "Leave a Review" button appears, styled per the client's brand color
4. Customer on the client's site clicks button → opens hosted review page in new tab
5. Same 60-second flow as above

### Private feedback flow (compliance-safe alternative)
1. On the public review page, alongside the Google CTA there's a "Share privately with [business]" link
2. Customer who'd rather not post publicly clicks → form with optional contact + message
3. Submits → goes directly to client's email + dashboard inbox
4. **Critical**: this path is *always* visible, never sequenced based on satisfaction. No gating.

---

## 6. Information Architecture

All surfaces live under `review.baamplatform.com` via path routing in a single Next.js project.

### Public marketing site
- `review.baamplatform.com/` — Marketing home
- `review.baamplatform.com/pricing` — Pricing tiers
- `review.baamplatform.com/how-it-works` — Product walkthrough
- `review.baamplatform.com/for-clinics`, `/for-restaurants`, `/for-lawyers` — Vertical landing pages (phase 1.5)
- `review.baamplatform.com/about` — About BAAM Studio + the product
- `review.baamplatform.com/privacy` — Privacy policy
- `review.baamplatform.com/terms` — Terms of service
- `review.baamplatform.com/login` — Owner login
- `review.baamplatform.com/signup` — Owner signup

### Admin app (auth required, served at `/app/*`)
- `/app` — Dashboard
- `/app/locations` — Locations list
- `/app/locations/[id]` — Location detail and settings
- `/app/locations/[id]/qr` — QR code generator
- `/app/locations/[id]/embed` — Embed snippet
- `/app/send` — Send review request
- `/app/reviews` — Completed reviews + private feedback inbox
- `/app/analytics` — Funnel and breakdowns
- `/app/settings` — Account, team, billing

### Public review surface
- `/r/[slug]` — Public review landing page
- `/r/[slug]?t=[token]` — Same page, with tracked context (language, source)
- `/r/[slug]/feedback` — Private feedback form
- `/r/[slug]/thank-you` — Post-submission confirmation

### API + utility routes
- `/api/auth/google/*` — GBP OAuth callbacks
- `/api/draft` — AI draft generation endpoint (streaming)
- `/api/track` — Analytics event ingestion (called from public review page)
- `/api/embed.js` — The embed script itself
- `/api/qr/[slug]` — QR PDF generator
- `/api/webhooks/stripe` — Stripe webhooks
- `/api/webhooks/twilio` — Twilio status webhooks
- `/api/webhooks/resend` — Resend delivery webhooks

### Responsive strategy by surface

Different surfaces optimize for different primary devices.

**Marketing pages** are desktop-first with mobile breakpoints. Owner-operators evaluate SaaS tools on laptops, comparing tabs side-by-side. Build for the laptop and gracefully reflow on phones.

**Admin app** is desktop-first with mobile breakpoints. Sending review requests, reviewing analytics, configuring locations are laptop activities. Mobile responsive supports occasional checks-on-the-go but is the secondary use case.

**Public customer review pages** (`/r/[slug]` and downstream) are mobile-first and present the same focused narrow-card layout even on desktop. Most customers arrive via SMS link on their phone, and the entire interaction is single-task — one question, one decision, one tap at a time. Wider columns hurt the flow rather than help it.

---

## 7. Technical Architecture

### Stack

| Layer | Choice | Reason |
|---|---|---|
| App framework | Next.js 15 (App Router) | Matches BAAM stack, server components for performance, excellent Vercel integration |
| Hosting | Vercel | Existing BAAM deployment patterns, edge functions for embed.js |
| Database & auth | Supabase (new project: `baam-review`) | Matches BAAM patterns, built-in RLS, generous free tier, Postgres |
| Billing | Stripe Checkout + Portal | No-code subscription management, webhook-driven state sync |
| SMS | Twilio | Industry standard, US deliverability, A2P registration straightforward |
| Email | Resend | Modern DX, React Email for templating, far better than SES/Postmark for greenfield |
| AI | Anthropic Claude API | Haiku for draft generation (fast + cheap), Sonnet only if quality demands |
| Google integration | GBP API + Places API (New) | Required for OAuth + place lookup |
| Admin UI components | shadcn/ui + Tailwind | Matches BAAM admin standard |
| Marketing/public UI | Custom, editorial typography | Tailwind base, Fraunces + Newsreader |
| Analytics | PostHog or self-hosted Plausible | Owner privacy + funnel analysis |
| QR generation | `qrcode` + `pdf-lib` | Server-side, no client deps |

### Architecture diagram (text)

```
                    ┌──────────────────────────┐
                    │  review.baamplatform.com │
                    │   (Next.js 15 on Vercel) │
                    └──────────┬───────────────┘
                               │
      ┌────────────────────────┼─────────────────────────┐
      │                        │                         │
┌─────▼──────┐         ┌───────▼──────┐         ┌────────▼─────┐
│ Marketing  │         │  Admin App   │         │ Public Review│
│   Site     │         │  /app/*      │         │ Page /r/*    │
│  /, /pricing│        │ (auth req'd) │         │  (no auth)   │
└────────────┘         └───────┬──────┘         └────────┬─────┘
                               │                         │
                               ▼                         ▼
              ┌────────────────────────────┐    ┌──────────────────┐
              │   Supabase Postgres + RLS  │◄───┤  Anonymous track │
              │   accounts, locations,     │    │   events (RPC)   │
              │   review_requests, etc.    │    └──────────────────┘
              └─────────────┬──────────────┘
                            │
        ┌───────────────────┼─────────────────────┬──────────────────┐
        ▼                   ▼                     ▼                  ▼
┌─────────────┐    ┌─────────────────┐   ┌──────────────┐   ┌─────────────┐
│  Anthropic  │    │  Google APIs    │   │   Twilio     │   │   Stripe    │
│  (drafting) │    │  (OAuth, Place) │   │  (SMS send)  │   │  (billing)  │
└─────────────┘    └─────────────────┘   └──────────────┘   └─────────────┘
                                                ▲
                                                │
                                          ┌─────┴─────┐
                                          │  Resend   │
                                          │  (email)  │
                                          └───────────┘
```

### Multi-tenancy model

Single shared database, per-account row-level security. Every table that holds account-scoped data has an `account_id` column with RLS policies enforcing `account_id = auth.uid()'s account`. Public review page reads use a service-role server route that takes a slug, verifies it, and returns only public-safe fields.

### Performance targets

- Marketing site Core Web Vitals: all green (LCP < 2.5s, CLS < 0.1, INP < 200ms)
- Public review page LCP < 1.5s on 4G — this is critical, customers bail fast
- AI draft generation P50 < 3s, P95 < 8s — Haiku, streaming response
- Admin dashboard initial render < 2s

---

## 8. Database Schema

```sql
-- Accounts (one per business or organization)
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  primary_email text NOT NULL,
  stripe_customer_id text UNIQUE,
  subscription_tier text NOT NULL DEFAULT 'trial', -- trial, starter, growth, agency
  subscription_status text NOT NULL DEFAULT 'trialing', -- trialing, active, past_due, canceled
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Users (admins of an account, ties to Supabase auth.users)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'owner', -- owner, admin, staff
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Locations (one per Google Place, multiple per account possible)
CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL, -- used in /r/[slug]
  google_place_id text,
  google_review_url text, -- pre-built deep link to GBP review form
  display_name text NOT NULL,
  address text,
  business_type text, -- clinic, restaurant, law_office, etc. — drives default prompts
  brand_color text DEFAULT '#1F4D3F',
  logo_url text,
  default_language text NOT NULL DEFAULT 'en',
  supported_languages text[] NOT NULL DEFAULT ARRAY['en'],
  welcome_message jsonb DEFAULT '{}'::jsonb, -- {en: "...", zh: "...", es: "..."}
  prompt_questions jsonb DEFAULT NULL, -- override defaults if present
  yelp_url text,
  custom_url text, -- e.g., client's own testimonial form, or Xiaohongshu
  custom_url_label jsonb DEFAULT '{}'::jsonb, -- localized button label
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Review requests (one row per ask)
CREATE TABLE review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  recipient_phone text,
  recipient_email text,
  language text NOT NULL DEFAULT 'en',
  channel text NOT NULL, -- sms, email
  tracking_token text UNIQUE NOT NULL, -- nanoid, used in URL
  message_sent text, -- the actual content sent
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz, -- from Twilio/Resend webhook
  opened_at timestamptz, -- email pixel
  clicked_at timestamptz, -- when /r/[slug]?t=[token] was loaded
  draft_generated_at timestamptz,
  completed_platform text, -- google, yelp, custom, private_feedback
  completed_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Landing events (analytics on the public review page)
CREATE TABLE landing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES review_requests(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- page_view, language_selected, question_answered, draft_generated, draft_regenerated, draft_edited, platform_clicked, private_feedback_submitted
  metadata jsonb DEFAULT '{}'::jsonb,
  language text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Private feedback (the compliance-safe alternative path)
CREATE TABLE private_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  request_id uuid REFERENCES review_requests(id) ON DELETE SET NULL,
  rating int, -- optional 1-5
  message text NOT NULL,
  contact_email text,
  contact_phone text,
  language text NOT NULL DEFAULT 'en',
  read_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Embed loads (analytics on which sites have the embed script live)
CREATE TABLE embed_loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  origin_url text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Subscription events (audit log for billing)
CREATE TABLE subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- created, upgraded, downgraded, canceled, payment_failed, etc.
  stripe_event_id text UNIQUE,
  payload jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_locations_account ON locations(account_id);
CREATE INDEX idx_locations_slug ON locations(slug);
CREATE INDEX idx_review_requests_location ON review_requests(location_id);
CREATE INDEX idx_review_requests_token ON review_requests(tracking_token);
CREATE INDEX idx_landing_events_location ON landing_events(location_id, occurred_at DESC);
CREATE INDEX idx_private_feedback_location ON private_feedback(location_id, created_at DESC);
```

### RLS policies (sketch)

All admin-facing tables use the same pattern:

```sql
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own account locations" ON locations
  FOR ALL USING (
    account_id IN (
      SELECT account_id FROM users WHERE id = auth.uid()
    )
  );
```

Public review page reads bypass RLS via a server-only Supabase client with the service role key, returning only the fields safe for public consumption (no PII, no internal flags).

---

## 9. Page Inventory

| # | Page | Surface | Auth | Priority |
|---|------|---------|------|----------|
| 1 | Marketing home | Public | No | v1 |
| 2 | Pricing | Public | No | v1 |
| 3 | How it works | Public | No | v1.5 |
| 4 | Vertical landing (clinics, etc.) | Public | No | v1.5 |
| 5 | Privacy / Terms | Public | No | v1 |
| 6 | Signup | Public | No | v1 |
| 7 | Login | Public | No | v1 |
| 8 | Onboarding wizard (4 steps) | Admin | Yes | v1 |
| 9 | Dashboard | Admin | Yes | v1 |
| 10 | Locations list | Admin | Yes | v1 |
| 11 | Location detail / settings | Admin | Yes | v1 |
| 12 | QR code generator | Admin | Yes | v1 |
| 13 | Embed snippet | Admin | Yes | v1 |
| 14 | Send review request | Admin | Yes | v1 |
| 15 | Reviews + private feedback inbox | Admin | Yes | v1 |
| 16 | Analytics | Admin | Yes | v1 |
| 17 | Settings (account, team, billing) | Admin | Yes | v1 |
| 18 | Public review landing | Public | No | v1 |
| 19 | AI draft preview | Public | No | v1 |
| 20 | Private feedback form | Public | No | v1 |
| 21 | Thank-you confirmation | Public | No | v1 |

---

## 10. AI Drafting — Prompt Architecture

The wedge feature deserves its own design.

### Inputs from the customer
- Service or treatment received (chip selection + free text option)
- Star rating 1–5 + optional one-line note
- One-word descriptor (chip selection: "professional," "warm," "knowledgeable," etc., localized)

### Inputs from location config
- Business type (drives default chip options)
- Display name
- Practitioner or staff name (optional)

### System prompt (sketch, in target language)

```
You are helping a customer write a Google review for {location_name}, a {business_type}.

Generate THREE distinct review drafts based on the customer's inputs. Each draft should:
- Be 50–80 words
- Sound like a natural customer review, not marketing copy
- Reflect the customer's specific experience as conveyed in their inputs
- Vary in tone and structure across the three drafts (e.g., one warm/personal, one factual/specific, one brief/punchy)
- Be in {target_language}
- NOT mention BAAM, BAAM Review, or that it was AI-assisted
- NOT include any unverified claims (medical outcomes, etc.)
- Use the customer's own phrasing where they typed something

Customer inputs:
- Service received: {service}
- Rating: {rating}/5
- Optional note: {note}
- One-word descriptor: {descriptor}

Return JSON: { "drafts": [{ "tone": "warm", "text": "..." }, ...] }
```

### Output handling

The customer sees the three drafts as cards. Tapping one selects it, edit mode allows free-form editing, regenerate produces three new drafts with different randomization. On final accept, the draft is copied to clipboard and the Google review form opens in a new tab.

### Compliance notes

- The disclosure on the page reads, in the customer's language: "This draft is generated from your inputs to help you start. Please edit it to make it your own."
- The system prompt explicitly prohibits unverified claims (especially relevant for medical contexts — TCM clinics, dental, etc.)
- Customer reviews and edits before posting to Google; they are the author of record.

---

## 11. Compliance Posture

Three areas where getting it wrong costs money or distribution. Build assuming all three matter.

**TCPA (Telephone Consumer Protection Act).** Automated SMS to US phone numbers requires express written consent. Two enforcement implications: clients must capture consent before adding a customer's number to BAAM Review, and our SMS templates must include opt-out language ("Reply STOP to opt out"). We document this in the Terms and bake the opt-out copy into the default templates. Twilio A2P 10DLC registration handles the carrier side.

**Google review policies.** Google explicitly prohibits review gating (filtering out unhappy customers before showing the public CTA), incentivizing reviews ("get $5 for a 5-star review"), and self-reviewing. Our architecture is non-gated by design: every customer sees the public review CTA and the private feedback option side by side, no sequencing based on satisfaction. We do not implement any incentive feature in v1, even though clients will request it.

**FTC endorsement guidelines.** Material connections between businesses and reviewers must be disclosed. We do not enable any incentive flow that would create such a connection. AI-assistance is disclosed on-page to the customer.

**Google OAuth verification.** We're using the existing BaaM Platform Google Cloud project, which already has the `auth/business.manage` scope. We will eventually need to update the consent screen branding to be umbrella-friendly (e.g., "BaaM Studio" rather than "BaaM Platform") so it covers both products without confusion. Until customer base diversifies meaningfully beyond BAAM-adjacent businesses, this is acceptable.

**Privacy.** Customer phone numbers and emails are PII. Stored encrypted at rest (Supabase default), purged 90 days after the request lifecycle completes (configurable). No selling, no third-party data sharing. Standard privacy policy.

**Fake-review prevention.** Google bans reviews from people who didn't actually visit, coordinated/inauthentic activity, employee reviews, and incentivized reviews. The business owner — not BAAM Review — gets punished when Google catches this (silent removal of suspect reviews, "Reviews disabled" warning on the GBP listing, profile suspension in extreme cases). We are not legally liable for owner misuse, but Google operates on a "what have you done to prevent this?" basis — if our tool is seen as systematically enabling abuse, our `business.manage` OAuth access can be revoked, which would break Connect-Google for every customer.

Defenses we build into the product to be a good citizen:

- **No bulk send in v1.** Send-request is one recipient at a time (master plan §2). Bulk CSV is phase 2, gated behind documented compliance steps.
- **Per-token tracking.** Each SMS/email request mints a unique `tracking_token`. Token reuse (one URL opened many times) is a strong abuse signal.
- **Velocity caps.** Tier-based monthly limits ([§12](#12-pricing--billing)) cap how many requests a small clinic can send. Session 7 adds hourly + daily velocity checks on top, marking requests with `review_requests.flagged_at` when triggered. Migration 0006.
- **Fingerprint capture.** Every `landing_events` row records `user_agent` and IP. Foundation for same-IP / same-fingerprint detection in Session 10.
- **Account-level suspension.** `accounts.suspended_at` + `suspension_reason` columns (migration 0006). Suspended accounts can't send new requests or accept new public submissions. Used when we observe systematic abuse.
- **No incentive flow.** Banned by policy at the product level, regardless of customer demand.
- **Pre-flight warning copy** in the send form (Session 7): a small inline note that the recipient should be a real customer.
- **Terms of Service** (Session 12) explicitly prohibit fake reviews, employee reviews, and incentives, and reserve our right to suspend accounts that violate this.

When Google flags a customer, our policy is to suspend that account immediately, freeze sending, and notify Google we did. The social contract is "we'll keep our house clean," not "every customer is your problem."

---

## 12. Pricing & Billing

| Tier | Price | Limits | Audience |
|---|---|---|---|
| Free | $0 | 10 review requests/month, BAAM Review branding on public page | Trial drivers and very small businesses |
| Starter | $39/mo or $375/yr | 200 requests/month, 1 location, branding hidden | Solo operators (clinics, single restaurants) |
| Growth | $89/mo or $855/yr | Unlimited requests, up to 3 locations, custom domain (phase 2), priority support | Small chains, multi-location practices |
| Agency | $249/mo or $2,388/yr | Up to 25 locations, white label, agency dashboard | BAAM Studio itself, plus other agencies |

**Trial model.** 14-day free trial of Starter on signup, no credit card required. Card prompt at trial end or earlier if user wants to remove BAAM Review branding.

**Billing implementation.** Stripe Checkout for upgrades and conversions, Customer Portal for cancellation and card updates. Webhook-driven status sync to `accounts.subscription_status` and `accounts.subscription_tier`. Hard-paywall on the send-request action when over monthly limit (soft-paywall via UI badge starting at 80% usage).

---

## 13. Implementation Phases

Twelve sessions, sized for one focused 2–4 hour block each, structured to fit John's one-task-per-Claude-Code-session preference. Sessions 1–6 produce a demo-able product; 7–10 unblock paid use; 11–12 unblock launch.

### Critical path to demo (Sessions 1–6)

**Session 1 — Scaffold + auth.** Next.js 15 project with App Router, Supabase auth wired (email + password), basic admin shell with shadcn/ui sidebar, login + signup pages, protected route middleware. Deploy to Vercel against `review.baamplatform.com`. Acceptance: can sign up, log in, see an empty dashboard at `/app`.

**Session 2 — Schema + RLS.** All tables from Section 8 created in a fresh Supabase project (`baam-review`), RLS policies enforced, seed script for local dev with one account, one location, one user. Acceptance: data visible only to its owner; service-role read works for public surface.

**Session 3 — GBP OAuth + place lookup.** OAuth flow against the existing BaaM Platform Google project, exchange code for access token, call My Business Account Management API to get the place_id and business details, store in `locations`. Acceptance: clicking "Connect Google" in admin opens consent screen, returns, fills location with name + address + place_id.

**Session 4 — Locations admin UI.** CRUD page for location settings: brand color picker, logo upload to Supabase storage, language multi-select, welcome message editor (per language), custom prompt questions editor, Yelp/custom URL fields. Acceptance: editing settings saves and re-renders.

**Session 5 — Public review page (no AI yet).** `/r/[slug]` route, language detection from token + browser, three-question chip UI in three languages, links out to Google/Yelp/custom URL, private feedback form. All UI strings translated. Acceptance: page renders correctly in all three languages, all CTAs work, private feedback writes to DB.

**Session 6 — AI-assisted writing flow.** Anthropic API integration, prompt templates per language, multi-draft generation with 2–3 candidates, draft picker UI, edit-in-place, regenerate button, copy-to-clipboard handoff to Google review URL. Streaming responses. Acceptance: end-to-end customer flow works in all three languages, drafts feel natural and varied.

### Unblock paid use (Sessions 7–10)

**Session 7 — Send review request via SMS + email.** Form in admin (`/app/send`), Twilio + Resend integrations, tracking token generation, message templates per language with opt-out language, status webhooks for delivery/open. Includes velocity checks (hourly + daily caps) that set `review_requests.flagged_at` when exceeded and a pre-flight warning copy reminding owners that recipients should be real customers. Acceptance: sending updates `review_requests.sent_at`, customer receives message, click logs `clicked_at`, abusive bursts surface a flag.

**Session 8 — QR code generator.** Per-slug QR PDFs with optional venue suffix (e.g., `?source=front_desk`), printable layout, downloadable from admin. Acceptance: scanning QR loads public page, source tracked.

**Session 9 — Embed script.** `embed.js` served from `/api/embed.js`, lightweight (under 5KB), renders configurable button, opens hosted page in new tab, logs `embed_loads`. Acceptance: pasting one-line snippet on a test site renders the button and click logs the origin.

**Session 10 — Analytics dashboard.** Funnel view (sent → delivered → clicked → completed), platform breakdown, language breakdown, private feedback inbox at `/app/reviews`. Acceptance: dashboard reflects test data accurately.

### Unblock launch (Sessions 11–12)

**Session 11 — Stripe billing.** Three subscription tiers in Stripe, Checkout integration, Customer Portal, webhooks for status sync, hard-paywall on monthly request limit, in-app upgrade flow. Acceptance: sign up free, hit limit, upgrade via Checkout, limit lifts.

**Session 12 — Marketing site + onboarding polish.** Public landing page, pricing page, privacy + terms, four-step onboarding wizard from signup → first request sent. Acceptance: a stranger can sign up, complete onboarding, send their first review request without help.

### Pre-launch checklist (post-Session 12, ~1 week)

- Twilio A2P 10DLC registration submitted
- Privacy policy and Terms drafted and reviewed
- Stripe products configured in production
- Test runs with DrHuang and 1–2 friendly other businesses
- Analytics events validated
- Email deliverability warmed up via Resend
- Marketing site SEO basics (title, meta, sitemap, robots)
- Initial OG images and social cards

### Estimated timeline

If sessions are 1–2 per week (realistic for solo execution alongside agency work): 12 sessions = 8–10 weeks. Plus 1 week pre-launch. Plus 1–2 weeks of friendly-customer feedback and fixes. **Target launch: 11–13 weeks from kickoff.**

---

## 14. Success Metrics

**v1 launch (first 30 days post-launch):**
- 25 paying accounts (mix of BAAM clients, friends-of-BAAM, organic)
- 60% trial-to-paid conversion (high because we'll have warm pipeline)
- 90% of accounts complete onboarding (send at least one request)

**v1 quarter (90 days post-launch):**
- 100 paying accounts
- $4,500 MRR
- Customer review completion rate: >35% (industry average is ~10% for blank Google forms; ~20% for templated; we should beat 30% with AI assist)
- Average drafts generated per request: 1.4 (i.e., most customers accept the first draft)
- Three-language usage: at least 25% of completed reviews via non-English flow

**Health metrics, ongoing:**
- AI draft generation P50 latency < 3s
- Public review page LCP < 1.5s
- Account churn < 4% monthly
- NPS from owner-operators > 40

---

## 15. Risks & Mitigations

**AI-generated reviews flagged by Google.** Google has begun detecting and removing obviously AI-generated reviews. Mitigation: customer-driven inputs, multiple draft variants with intentional variation, mandatory edit step disclosed on page, no template repetition across customers. We monitor flagged-review rate as a health metric.

**Twilio A2P registration delays.** Carrier registration can take 2–6 weeks. Mitigation: submit on Day 1 of build, use email-only flow as fallback during the gap, test with personal Twilio number for development.

**Google OAuth verification scope creep.** If we ever need additional scopes, verification can take 4–6 weeks. Mitigation: stay within `auth/business.manage` for v1, plan scope additions to bundle with phase 2.

**Pricing too low.** Risk: we get stuck at "low-LTV bargain tier" status and never command premium. Mitigation: track LTV by tier, raise Starter to $49 if early signal supports it, push Growth tier hard with feature differentiation.

**Pricing too high.** Risk: solo operators bounce at $39. Mitigation: Free tier with 10 requests/month gives them an entry point that converts via usage-driven upgrade prompts.

**BAAM brand confusion.** Risk: non-BAAM customers wonder if they need to be BAAM clients to use BAAM Review. Mitigation: clear marketing copy ("From BAAM Studio. Works on any website."), eventual move to standalone domain `baamreview.com` once domain registration is settled.

**Existing competitor copies the AI flow.** Risk: Birdeye or Podium ships the same wedge. Mitigation: ship fast, win the multilingual local-business segment first, build the GEO loop-back as the second moat.

---

## 16. Future Roadmap (Phase 2+)

**Q2 post-launch:**
- Review monitoring and inbox
- Schema markup loop-back to client websites (the GEO play)
- Custom domain CNAME

**Q3 post-launch:**
- Booking system integrations (Calendly, Square, Acuity)
- Reply assistant — AI-drafted responses to Google reviews
- Bulk customer upload via CSV

**Q4 post-launch:**
- White-label tier with full agency dashboard
- Public REST API and webhooks
- Native mobile apps (iOS first, owner-operator phone usage is high)
- Yelp deeper integration if their API allows
- Industry-specific prompt libraries (TCM clinic, dental, immigration law, etc.)

---

## 17. Appendix

### A. Naming alternatives if `baamreview.com` ever feels limiting

Keep these in pocket: Vouch, Praise, Chime, Tally, OneTap, Wellsaid, Goodword. Single-word names with available domains in the .com or .ai TLDs are the bar.

### B. Open questions pending decision

1. **Analytics tool.** PostHog (more powerful, free up to 1M events/month) vs. Plausible (lighter, $9/mo). PostHog likely wins for our funnel needs.

2. **Email-only MVP vs. SMS+email at launch.** SMS requires A2P registration (4–6 weeks). Email-only gets us live faster. Recommend launching with both visible in admin but A2P pending = warning banner during early period.

### C. Reference specs for the prototype HTML pages

The prototype HTML files accompanying this plan demonstrate the visual language and layout for six key surfaces: marketing home, pricing, admin dashboard, send-request screen, public review questions, and AI draft preview. They use the locked color palette (deep forest green primary, warm cream background, amber gold accent) and typography (Fraunces display, Newsreader body for editorial pages, Onest for admin UI).

---

*End of Master Plan v1.0. Next step after sign-off: kick off Session 1 (Scaffold + auth).*
