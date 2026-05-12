# BAAM Review — Master Plan v2.0

*A Review-to-Revenue Engine for local businesses. Served from `review.baamplatform.com`.*

**Changelog from v1.3 → v2.0 (major rewrite):**
- Repositioned from "review collection tool" to "Review-to-Revenue Engine" — reviews are the raw material, not the goal
- Expanded product loop from 5 to 7 stages: Collect → Publish → Display → Distribute → Convert → Refer → Compound
- Headline updated to "Turn happy customers into reviews, referrals, and revenue"
- Post-review thank-you flow with Book/Refer/Follow CTAs moved into v1
- Simple referral links moved into v1.5 (from v1.6)
- Customer share-card moment added to v1.5
- Consent layer for testimonial reuse moved into v1
- Staff Mode (mobile-first front-desk surface) added to v1.5
- Service recovery workflow for low-rating private feedback added to v1.5
- Basic revenue attribution moved into v1.5 (was v1.7)
- ROI calculator added to marketing site and onboarding
- B2B partner referral mode added to v1.6
- Widget type expansion (7 widget formats) added v1.5 → v1.6
- Review-to-Ad-Copy generator added to v1.6
- GBP Post generator from reviews added to v1.5
- Review Theme Mining + Best Advocates CRM elevated to first-class Growth value
- Pricing tiers re-narrated around outcomes
- All previous changelogs preserved at bottom

---

## 1. Vision & Positioning

BAAM Review is a Review-to-Revenue Engine for local businesses. The category is full of tools that ask one question — "how do I get more Google reviews?" — and stop there. The right question is bigger: how do I turn every happy customer into reviews, referrals, repeat visits, and new revenue? That's what BAAM Review answers, and that's what justifies a $99 product over a $39 one.

**Positioning statement.** BAAM Review turns every happy customer into a marketing asset. We help local businesses collect Google reviews in 60 seconds, display them on their website to convert visitors, distribute them on Xiaohongshu and social to reach new audiences, and turn happy customers into measurable referrals. Setup in five minutes. Three languages out of the box. From $49 a month.

**The thesis in one line.** Reviews are not the end goal. Reviews are the raw material for trust, content, SEO, referrals, and revenue.

**Who it's for, in v1.**
- Solo and small local businesses (1–5 locations) where the owner is also the operator
- Businesses with multilingual customer bases — TCM clinics, immigration lawyers, restaurants, salons, contractors, translation services
- BAAM Studio's existing client roster as a beachhead

**Who it's not for, in v1.**
- Multi-location enterprise chains (Birdeye and Reputation.com own this)
- Pure e-commerce (different review dynamics)
- Agencies wanting deep white-label until v2

**Strategic rationale.** Reviews drive local SEO. Displayed reviews drive website conversion. Distributed reviews drive social reach. Referrals drive direct revenue. A tool that compounds all four creates a defensible moat against single-purpose competitors.

**Domain strategy (locked).** Subdomain `review.baamplatform.com`. Marketing, admin, and public review pages all live under one Next.js project via path routing. Migration to standalone `baamreview.com` reserved for post-launch.

---

## 2. The Review-to-Revenue Loop (Seven Stages)

The product is organized around seven stages, each representing a distinct product capability and a moment of value to the business.

```
       1. Collect → 2. Publish → 3. Display → 4. Distribute
                                                       ↓
       7. Compound ← 6. Refer ← 5. Convert ←─────────┘
```

**Stage 1 — Collect.** Get more reviews through AI-assisted request flows. SMS, email, QR code, and embedded "Leave a Review" button on the business's website. The wedge feature: three quick chip questions → AI-generated draft → customer edits → posts to Google in 60 seconds. Multilingual from day one (EN/ZH/ES).

**Stage 2 — Publish.** Route reviews to the right destination. Google (primary), Yelp (secondary), first-party testimonials stored in BAAM (for customers who don't want to post publicly to Google), private feedback (for service recovery). Customer always sees public and private options side by side — no gating.

**Stage 3 — Display.** Put reviews to work on the business's own website. Embeddable widgets with `Review` schema markup, conversion CTAs ("Book Now," "Call Now," "Get Directions") attached to each review. Reviews become both trust signals and conversion drivers. Schema feeds GEO citations and Google rich snippets.

**Stage 4 — Distribute.** Automatically turn top reviews into shareable social graphics — sized for Xiaohongshu, Instagram, Facebook, and Google Business Profile posts. AI-generated GBP posts grounded in actual review language. Plus customer-side share cards (image the customer can share to WeChat or Xiaohongshu). For Chinese-speaking businesses, this stage alone is structurally differentiated against any US competitor.

**Stage 5 — Convert.** Use review-grounded content to drive bookings, calls, and inquiries. Review-themed landing pages (auto-generated from review themes like "migraine relief" or "fertility support"). Review-derived ad copy in real customer language. Service-page review blocks. Every displayed review carries a CTA.

**Stage 6 — Refer.** Turn happy customers into a referral engine. Simple "Share with a Friend" link after every successful review (v1.5). Two-sided referral incentives ($10/$10) for higher-effort referrals (v1.6). B2B partner referral tracking (v1.6). Every referral is attributable to a specific reviewer.

**Stage 7 — Compound.** Reviews are data, not trophies. Theme mining surfaces what customers actually value ("47 reviews mention 'patient explanations' this quarter"). That data flows back into website headlines, GBP posts, ad copy, service pages, FAQ content, sales scripts. Best Advocates CRM identifies highest-value customers for VIP outreach, video testimonials, partner introductions. Auto-published testimonial landing pages turn review themes into long-tail SEO pages at zero marginal cost.

**How the loop justifies the price.** Starter ($49) buys Stage 1 + half of Stage 2. Growth ($99) buys all seven stages with first-party access. Agency ($499) buys the loop running across multiple client accounts with white-label and partner tracking.

---

## 3. Scope & Boundaries

### v1 (launch): Collect + Publish + Thank-You Moment

The minimum that lets a business get more reviews and immediately put the customer back to work.

- Self-serve account signup and onboarding (with ROI calculator)
- Google Business Profile OAuth (existing BaaM Platform project)
- Hosted review page at `review.baamplatform.com/r/[slug]`
- AI-assisted writing flow with three-question chip UI
- Trilingual interface (EN, ZH, ES) on every customer-facing surface
- Send review request via SMS (Twilio) or email (Resend), one recipient at a time
- QR code generator (printable PDF, per location)
- One-line `<script>` embed renders a "Leave a Review" button on any website
- Compliance-safe private feedback form alongside public CTAs (never gated)
- **Post-review thank-you page with three CTAs: Book Next Visit, Refer a Friend (simple share link), Follow Social** — shown only after handoff to Google or private feedback submission
- **Consent layer** for testimonial reuse — checkbox during review flow
- Basic analytics: sent → clicked → completed funnel, platform breakdown, language breakdown
- Stripe self-serve billing with three tiers
- Per-location branding (logo, color, welcome message, custom prompt questions)
- Marketing site with pricing, ROI calculator, signup

### v1.5: Display + Distribute + Initial Refer

The release that justifies the $99 Growth tier. Everything below is exclusive to Growth and Agency.

- **Review Display Widgets** with `Review` schema markup — three widget types initially: homepage trust wall, service-page review block, floating review badge
- **First-party testimonials** — for customers who'd rather not post to Google. Stored in BAAM, displayed alongside Google reviews on website widget. Explicit consent.
- **AI Reply Assistant** — drafts 2–3 reply options for incoming Google reviews in reviewer's language, owner approves with one tap, posts to Google
- **Review Monitoring** — pulls reviews from Google and Yelp into admin inbox with real-time alerts (SMS + email), escalation for ≤3-star
- **Social Review Graphics** — auto-generated, branded image cards from top reviews, sized for Xiaohongshu, Instagram, Facebook. Manual download in v1.5; scheduled posting in v1.6.
- **Customer share cards** — same image offered to the reviewer themselves after submission ("Want to share this with friends?") with QR code/short link back to business
- **GBP Post Generator** — turn strong reviews into Google Business Profile posts with call/book CTAs
- **Simple Referral Links** — every successful review ends with optional "Share with a Friend" → tokenized URL `review.baamplatform.com/ref/[slug]?from=[token]` → landing page with business info and call/book/directions CTAs. Tracks referral traffic; no monetary incentive yet.
- **Basic Revenue Attribution** — dashboard surface showing review requests sent, reviews gained, widget views, CTA clicks, referral clicks, estimated revenue impact (using per-business customer-value input set during onboarding)
- **Service Recovery Workflow** — when private feedback or ≤3-star review arrives, alert owner, AI summarizes issue, AI drafts response, suggested next actions (call, offer correction, escalate, mark resolved)
- **Staff Mode** — simplified mobile-first surface at `/app/staff` for front-desk use: send review request, show QR code, send referral link, book-next-visit link. Restricted user role.
- **Staff Scripts** — built into admin: copy-paste scripts for after-visit ask, referral ask, repeat-booking ask, in EN/ZH/ES

### v1.6: Convert + Full Refer

The release that makes BAAM Review a true customer acquisition engine.

- **Two-Sided Referral Engine** — TCPA-safe incentive structure ($10/$10 or business-configured). Reviewer initiates outreach; friend redeems on first visit; both get reward.
- **B2B Partner Referral Mode** — partner-specific referral pages (`/partner/[slug]`), tracked links for cross-business referrals, optional internal notes
- **Review-Themed Landing Pages** — auto-generated SEO pages from review themes. Clinic with 12 reviews mentioning migraines gets `/lp/migraine-relief-flushing` with real review excerpts, service explanation, FAQ, call/booking CTA, full schema markup, location data
- **Review-to-Ad-Copy Generator** — feed review themes into prompt, get Google Ads and Facebook Ads copy grounded in customer language. FTC-compliant.
- **Review Theme Mining dashboard** — top phrases customers used about you this month, one-click conversion to website headlines, GBP posts, ad copy
- **Expanded widget gallery** — adds before/after testimonial block, location-specific review wall, review carousel for landing pages, QR poster wall (printable)
- **Scheduled social posting** — Xiaohongshu (manual via download for v1.6, integrated when API access feasible), Instagram, Facebook via Meta Graph API
- **Custom domain CNAME** — `reviews.clientdomain.com`

### v1.7: Compound + Advanced

The release that compounds prior work into asset-class advantages.

- **Auto-published testimonial SEO pages at scale** — quarterly review batches into long-tail landing pages
- **Best Advocates CRM** — list of top customers (review + referred + shared + rebooked + consent), templated outreach for VIP events, video testimonials, case stories
- **Video testimonial generator** — turn top reviews into 15–30s short-form videos using AI avatar or animated text-over-photo, connecting to BAAM Studio's content engine
- **Full Revenue Attribution** — booking system integrations (Calendly, Square, Acuity) for actual booking-from-review attribution; ROI dashboard with real numbers
- **Multi-location bulk management** — for accounts with 3+ locations
- **CSV bulk customer upload**
- **Reply Assistant with full automation** — auto-reply to ≥4-star reviews after owner-set approval threshold

### Explicitly out of scope (v1–v1.7)

- Full enterprise multi-location chain support (Birdeye/Reputation.com territory)
- Native mobile apps (admin is mobile-responsive; Staff Mode handles the front-desk case)
- Public REST API and webhooks (until customer demand justifies)
- 150+ platform integrations (Google primary, Yelp secondary, first-party tertiary)
- Facebook reviews integration (deliberately deferred)
- Full CRM (we surface advocates but don't try to be HubSpot)
- SMS marketing campaigns (different product; TCPA-heavy)
- Payments / POS integration

---

## 4. Differentiation Strategy

The category is crowded. BAAM Review wins on five vectors:

1. **Convenience for the end customer.** The 60-second AI-assisted flow is the wedge.
2. **Multilingual from day one.** None of the major US competitors handle Chinese or Spanish fluently. For NY metro local businesses serving immigrant communities, this is structural advantage that goes through every stage of the loop.
3. **The complete loop, not just collection.** Birdeye stops at Stages 1–2. NiceJob stops at Stage 1. None do Stages 6–7 (referrals + theme mining) as integrated product. We do all seven.
4. **Xiaohongshu and bilingual social distribution.** No US competitor can match this without rebuilding their content engine for Chinese platforms.
5. **Pricing transparency and self-serve.** Birdeye and Podium gate everything behind sales calls. We publish pricing and let users sign up in five minutes.

Secondary differentiators: editorial brand identity (the category looks like enterprise CRM; we look like a thoughtful product) and BAAM ecosystem leverage (reviews loop back into client sites as schema markup feeding GEO score).

---

## 5. User Personas

**The Owner-Operator.** Solo or small clinic, restaurant, law office, salon, translation service. Will pay $49–99/month if it works without constant attention. Will pay $99 specifically if the ROI dashboard shows the money coming back.

**The Front-Desk Staff.** Uses Staff Mode day-to-day. Needs it obvious and mobile. May not be account holder.

**The Customer.** Mid-experience. Just had a service. Possibly older, possibly more comfortable in Chinese or Spanish. Wants to be done in under a minute.

**The Happy Repeat Customer (becomes the Advocate).** Already gave a 5-star review. Already came back. Most businesses do nothing with them. Best Advocates CRM surfaces them.

**The BAAM Studio team.** Acting across multiple BAAM Local clients, needing an agency-level view. Agency tier from v1.

---

## 6. User Flows

### Owner signup → first review request sent (v1)

1. Land on marketing site → see ROI calculator inline → click "Start free trial"
2. Email + password signup → email verification
3. Onboarding step 1: connect Google Business Profile via OAuth
4. Onboarding step 2: confirm pulled location data, optional custom logo, brand color
5. Onboarding step 3: select supported languages, preview prompt questions
6. **Onboarding step 4: set average customer value** ($300 default — drives revenue attribution estimates)
7. **Onboarding step 5: configure thank-you CTAs** — pick booking URL (Calendly/Square/custom), enable/disable refer-a-friend, enable/disable follow-social with handles
8. Onboarding step 6: send a test review request to themselves
9. Land in dashboard → funnel populated → revenue-attribution preview
10. Optional: generate QR PDF, copy embed snippet

Target: 6 minutes from landing to first request sent.

### Customer review flow (v1)

1. Customer receives SMS or email: "Hi [name], thanks for visiting [business]. Mind sharing your experience? [link]"
2. Tap link → land on `review.baamplatform.com/r/[slug]?t=[token]`
3. Page detects language, shows business logo + warm welcome
4. Three chip questions — 15 seconds
5. AI generates 2–3 drafts, customer picks one
6. **Consent checkbox**: "I allow [Business] to display my testimonial on their website and marketing materials" (default checked, visible and uncheckable)
7. Buttons: *Looks good* / *Edit* / *Regenerate*
8. Tap *Looks good* → draft copies to clipboard, Google review form opens in new tab
9. Customer pastes and submits to Google
10. **Post-handoff thank-you page** appears: "Thank you for supporting [Business]. Your feedback helps more local families find trusted care." Three buttons: **Book Next Visit** / **Refer a Friend** / **Follow on [social]**
11. If "Refer a Friend" — share card image generated, share menu opens (SMS, WeChat, WhatsApp, email, copy link)
12. Tracking pixel fires on each interaction → dashboard reflects everything

Total customer time: 60 seconds for review, +30 seconds optional for referral.

### Embed flow on client website (v1 collect + v1.5 display)

Two distinct embeds, two snippets:

**Snippet A: "Leave a Review" button (v1)** — small button styled to client brand, click opens hosted review page.

**Snippet B: Review Display Widget (v1.5)** — renders best reviews on client's website. Configurable: homepage trust wall, service-page block, floating badge. Each review carries client's chosen CTA. Includes `Review` schema markup automatically.

### Private feedback + service recovery (v1 + v1.5)

1. Customer on review page taps "Share privately with [business]"
2. Form: optional rating, message, optional contact
3. Submits → admin inbox + email alert
4. **v1.5: if ≤3-star or negative sentiment, escalation flow** — SMS alert, AI summary, AI-drafted response (in customer's language), suggested actions

Critical: this path is *always* visible alongside the Google CTA, never sequenced. No gating ever.

### Staff Mode flow (v1.5)

1. Owner adds staff member (email invite, staff role only)
2. Staff opens `review.baamplatform.com/app/staff` on phone, logs in
3. Mobile-first card stack:
   - **Send review request** → pick language, type name + phone/email, tap send
   - **Show QR code** → fullscreen QR
   - **Send referral link** → generate share link for happy customer
   - **Book next visit** → booking URL → share via SMS/copy
4. Cannot see analytics, billing, or settings. Cannot delete data.

---

## 7. Information Architecture

All surfaces live under `review.baamplatform.com` via path routing.

### Public marketing site
- `/` — Marketing home (Review-to-Revenue Engine positioning)
- `/how-it-works` — Seven-stage loop walkthrough
- `/pricing` — Pricing tiers + ROI calculator
- `/roi-calculator` — Standalone ROI calculator
- `/for-clinics`, `/for-restaurants`, `/for-lawyers`, `/for-translation`, `/for-immigration` — Vertical landing pages (v1.5+)
- `/about` — About BAAM Studio + product
- `/privacy`, `/terms`, `/dpa` — Legal
- `/login`, `/signup` — Auth

### Admin app (auth required, `/app/*`)
- `/app` — Dashboard (with revenue-attribution surface in v1.5+)
- `/app/locations` — Locations list
- `/app/locations/[id]` — Location detail and settings
- `/app/locations/[id]/qr` — QR code generator
- `/app/locations/[id]/embed` — Embed snippets (Collect button + Display widget)
- `/app/locations/[id]/widget` — Widget configurator (v1.5+)
- `/app/send` — Send review request
- `/app/reviews` — Completed reviews + private feedback inbox + service recovery queue
- `/app/replies` — AI Reply Assistant queue (v1.5+)
- `/app/themes` — Review Theme Mining dashboard (v1.6+)
- `/app/distribute` — Social Review Graphics gallery + scheduling (v1.5+)
- `/app/referrals` — Customer + partner referrals (v1.5 simple, v1.6 full)
- `/app/landing-pages` — Auto-generated review-themed landing pages (v1.6+)
- `/app/ads` — Review-to-Ad-Copy generator (v1.6+)
- `/app/advocates` — Best Advocates CRM (v1.7+)
- `/app/analytics` — Funnel and breakdowns
- `/app/staff` — Staff Mode (v1.5+)
- `/app/settings` — Account, team, billing

### Public review surface
- `/r/[slug]` — Public review landing (chip questions)
- `/r/[slug]?t=[token]` — Tracked context
- `/r/[slug]/feedback` — Private feedback form
- `/r/[slug]/thank-you` — Post-review revenue moment (Book/Refer/Follow)
- `/r/[slug]/share-card` — Customer share card generator
- `/ref/[slug]?from=[token]` — Referral landing page (v1.5)
- `/partner/[slug]?id=[partner_id]` — B2B partner referral page (v1.6)
- `/lp/[business]/[theme]` — Auto-published review-themed SEO pages (v1.6+)

### API + utility routes
- `/api/auth/google/*` — GBP OAuth callbacks
- `/api/draft` — AI customer-side draft generation (streaming)
- `/api/reply-draft` — AI reply-side draft generation (v1.5)
- `/api/track` — Analytics event ingestion
- `/api/embed/collect.js` — "Leave a Review" embed script
- `/api/embed/widget.js` — Display widget embed script (v1.5)
- `/api/qr/[slug]` — QR PDF generator
- `/api/share-card/[slug]` — Customer share card PNG (satori)
- `/api/social-graphic/[review_id]` — Social distribution graphic generator
- `/api/webhooks/stripe`, `/twilio`, `/resend` — Service webhooks

### Responsive strategy by surface

- **Marketing pages**: desktop-first with mobile breakpoints
- **Admin app (main)**: desktop-first with mobile breakpoints
- **Staff Mode (`/app/staff`)**: mobile-first, narrow centered layout even on desktop
- **Public customer review surfaces**: mobile-first, narrow centered layout even on desktop

---

## 8. Technical Architecture

### Stack

| Layer | Choice |
|---|---|
| App framework | Next.js 15 (App Router) |
| Hosting | Vercel |
| Database & auth | Supabase (project: `baam-review`) |
| Billing | Stripe Checkout + Portal |
| SMS | Twilio |
| Email | Resend |
| AI | Anthropic Claude API (Haiku drafts, Sonnet for reply assistant) |
| Google integration | GBP API + Places API |
| Social graphics | `satori` + `sharp` for PNG generation |
| Admin UI | shadcn/ui + Tailwind |
| Marketing/public | Custom editorial, Fraunces + Newsreader + Onest |
| Analytics | PostHog |
| QR generation | `qrcode` + `pdf-lib` |

### New architectural primitives in v2.0

- **Event-driven revenue attribution.** Every interaction emits a typed event (`review_completed`, `widget_view`, `cta_click`, `referral_click`, `referral_converted`). Attribution rolls up from events, not periodic batch jobs.
- **Image generation pipeline.** Share cards and social graphics use `satori` to render React-style components to SVG, then `sharp` to PNG. Generated on-demand and cached.
- **Schema markup engine.** Shared utility constructs valid JSON-LD `Review`, `LocalBusiness`, `AggregateRating` from review data. Same engine feeds website widget and auto-published landing pages.
- **Multi-surface AI prompt registry.** Prompts for customer-side drafting, owner-side replying, GBP post generation, ad-copy generation, theme mining all live in a versioned registry with eval suites.

---

## 9. Database Schema (v2.0)

The v1.3 schema (accounts, users, locations, review_requests, landing_events, private_feedback, embed_loads, subscription_events) remains. New tables and columns:

```sql
-- v1: capture consent for testimonial reuse
ALTER TABLE review_requests ADD COLUMN consent_display boolean DEFAULT NULL;
ALTER TABLE review_requests ADD COLUMN consent_anonymized boolean DEFAULT NULL;

-- v1: thank-you page interactions
CREATE TABLE post_review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,
  action_type text NOT NULL, -- book_clicked, refer_clicked, follow_clicked, share_card_generated, share_card_shared
  metadata jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- v1: customer value + booking + social configuration
ALTER TABLE locations ADD COLUMN avg_customer_value_cents int DEFAULT 30000;
ALTER TABLE locations ADD COLUMN booking_url text;
ALTER TABLE locations ADD COLUMN social_handles jsonb DEFAULT '{}'::jsonb;

-- v1.5: first-party testimonials
CREATE TABLE first_party_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  request_id uuid REFERENCES review_requests(id) ON DELETE SET NULL,
  rating int NOT NULL,
  content text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  reviewer_display_name text,
  consent_display boolean NOT NULL DEFAULT true,
  display_anonymous boolean NOT NULL DEFAULT false,
  approved_for_display boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- v1.5: imported Google/Yelp reviews
CREATE TABLE imported_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_review_id text NOT NULL,
  reviewer_name text,
  rating int,
  content text,
  language text,
  posted_at timestamptz,
  reply_status text DEFAULT 'pending',
  reply_content text,
  replied_at timestamptz,
  alerted_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_review_id)
);

-- v1.5: referral links + events
CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  referrer_request_id uuid REFERENCES review_requests(id) ON DELETE SET NULL,
  referral_token text UNIQUE NOT NULL,
  partner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- v1.5: widget views and CTA clicks
CREATE TABLE widget_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  widget_type text NOT NULL,
  origin_url text,
  event_type text NOT NULL,
  cta_destination text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- v1.5: social graphics
CREATE TABLE social_graphics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  source_review_id text,
  source_table text,
  format text NOT NULL,
  image_url text,
  caption text,
  scheduled_for timestamptz,
  posted_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- v1.6: review themes
CREATE TABLE review_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  theme_label text NOT NULL,
  theme_summary text,
  example_review_ids uuid[],
  mention_count int NOT NULL DEFAULT 0,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- v1.6: partners (B2B referrals)
CREATE TABLE partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  partner_name text NOT NULL,
  contact_email text,
  partner_slug text NOT NULL,
  internal_notes text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, partner_slug)
);

-- v1.7: best advocates
CREATE TABLE advocates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL,
  reviewer_contact_email text,
  reviewer_contact_phone text,
  language text,
  advocate_score int,
  flags jsonb DEFAULT '{}'::jsonb,
  last_outreach_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- v1.7: review-themed landing pages
CREATE TABLE landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  theme_id uuid REFERENCES review_themes(id),
  title text NOT NULL,
  content jsonb NOT NULL,
  published boolean DEFAULT false,
  views_30d int DEFAULT 0,
  conversions_30d int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, slug)
);
```

RLS policies follow v1.3 pattern: `account_id IN (SELECT account_id FROM users WHERE id = auth.uid())`. Public widget reads bypass via service-role server route.

---

## 10. AI Prompt Architecture

### Customer-side review draft (v1)
3 drafts, varied tones, customer's language, grounded in customer inputs, no fabricated specifics, no mention of AI assistance, mandatory edit step disclosed.

### Owner-side reply draft (v1.5)
- Inputs: imported review (rating, content, language), business name, business type
- Output: 2–3 reply drafts, varied tones (warm/specific/concise), in reviewer's language
- Constraints: no medical/legal advice, no inflammatory language for negative reviews, always thank reviewer
- For ≤3-star: emphasize listening + offering to resolve offline; never argue publicly

### GBP post draft (v1.5)
- Inputs: 1–3 strong reviews, business type, optional current promotion
- Output: GBP post (~150 chars) capturing review sentiment, with CTA suggestion
- Constraints: no fabrication; mirrors customer language

### Social graphic caption (v1.5)
- Inputs: review, format (Xiaohongshu / Instagram / Facebook), business handle
- Output: platform-appropriate caption with hashtags
- Xiaohongshu: red-style emoji conventions, ~100 char limit, 5–8 tags

### Review-themed landing page (v1.6)
- Inputs: theme label, 5–10 review excerpts mentioning the theme, business info, service description
- Output: structured page (hero, problem, approach, real-review quotes, FAQ, CTA, schema)
- Constraints: every claim sourced from a review; no medical efficacy claims

### Ad copy generator (v1.6)
- Inputs: review themes, platform (Google Ads / Facebook), goal (calls / bookings / forms)
- Output: 5 ad variants per platform spec
- Constraints: customer language echoed, never fabricated

### Theme mining (v1.6)
- Inputs: batch of recent reviews (50–200), language(s)
- Output: top 10 themes with mention counts, summary, representative excerpt IDs
- Runs weekly; updates `review_themes`; drives dashboard

### Service recovery response (v1.5)
- Inputs: private feedback or low-rating review
- Output: AI summary of issue + recommended next action + drafted owner response
- Constraints: empathetic, takes responsibility where appropriate, offers concrete remedy, never defensive

---

## 11. Compliance Posture

**TCPA (SMS).** Express written consent before SMS, opt-out language ("Reply STOP") in every message. Twilio A2P 10DLC registration for production volume.

**Google review policies.** No review gating, ever. No incentives for the review itself. Private feedback path always visible alongside public CTA, never sequenced based on satisfaction. The post-review thank-you page (Book/Refer/Follow) appears *after* Google handoff, so referral incentives never influence the review itself. AI-assistance for drafting disclosed on customer page.

**FTC endorsement guidelines + 2024 Fake Reviews rule.** Real-customer-grounded marketing only. Ad copy and landing pages derived from real review excerpts, never fabricated. Material connections (paid reviews, employee reviews, family reviews) explicitly prohibited in Terms. Consent layer captures testimonial reuse permission. Best Advocates outreach asks permission before using anyone in marketing.

**Referral incentives (v1.6).** Two-sided ($10/$10) structured so the reviewer initiates outreach to a friend (compliant) rather than business cold-messaging (TCPA risk). Disclosure on redemption page.

**Privacy.** Customer PII encrypted at rest. 90-day rolling retention default for raw contact info, configurable. Reviews retained indefinitely (content business owns).

**Consent for testimonial reuse.** Captured at review-time as opt-in checkbox. Required before any testimonial appears on website widget, social graphics, ads, or landing pages.

**Google OAuth verification.** Reuse existing BaaM Platform Google Cloud project's `auth/business.manage` scope.

---

## 12. Pricing & Tier Narrative

| Tier | Price | Narrative | Includes |
|---|---|---|---|
| Free | $0 | "Try it" | 5 review requests/month, 1 location, BAAM branding |
| **Starter** | **$49/mo or $470/yr** | **"Get more Google reviews"** | All of Stage 1 (Collect): SMS + email, AI customer-side draft, QR codes, embed Collect button, private feedback, basic analytics, post-review thank-you with Book/Refer/Follow, consent layer, 1 location, custom branding |
| **Growth** | **$99/mo or $950/yr** | **"Turn reviews into revenue"** | Everything in Starter + Stages 2–6: Display Widgets with schema, first-party testimonials, AI Reply Assistant, monitoring + alerts, social graphics + GBP posts, customer share cards, simple referral links, service recovery, Staff Mode + scripts, revenue attribution dashboard, ROI calculator, up to 5 locations, custom domain (v1.6+) |
| **Agency** | **$499/mo or $4,790/yr** | **"Reputation and referrals at scale"** | Everything in Growth + white label, agency dashboard across clients, partner referral tracking, multi-client reports, review-themed landing pages, ad-copy generator, theme mining across portfolio, advocates CRM, up to 25 locations |

**Pricing rationale.** Starter at $49 undercuts NiceJob's basic plan ($75) while delivering the wedge. Growth at $99 is the value tier — sub-$100 psychological threshold, justified by genuinely owning all seven stages. Birdeye explicitly does not sell anything under $299; Growth wins every prospect who looked at Birdeye and balked. Agency at $499 reflects what white-label agency customers actually pay.

**Founding customer program (first 50 paid signups).** Launch pricing locked forever: Starter $39, Growth $89, Agency $249. Marketing page shows "X spots left." Once 50 founders converted, list prices apply universally.

**Variable cost per Growth customer:** Anthropic API $3–10, Twilio SMS $5–15, Resend email $1–3, Supabase + Vercel proration $2–5. Gross margin north of 75%.

---

## 13. Implementation Phases

### v1 Launch (Sessions 1–12) — ~10–12 weeks

1. Scaffold + auth
2. Schema + RLS (includes v1 additions: `post_review_actions`, location columns for customer value/booking/social)
3. GBP OAuth + place lookup
4. Locations admin UI (includes booking_url, social handles, customer value during onboarding)
5. Public review page in 3 languages — **add consent checkbox**
6. AI-assisted writing flow
7. Send request via SMS + email
8. QR code generator
9. Embed "Leave a Review" script
10. Analytics dashboard — funnel + breakdowns + **basic revenue estimate**
11. Stripe billing
12. Marketing site + onboarding wizard — **includes ROI calculator on home + pricing; thank-you page Book/Refer/Follow configured during onboarding**

### v1.5 Release (Sessions 13–23) — ~6–8 weeks after v1

13. First-party testimonial flow
14. Display Widget v1 — three widget types + schema markup engine
15. Embed Snippet B (display widget) + configurator
16. Review import pipeline — Google + Yelp into `imported_reviews`
17. AI Reply Assistant — `/app/replies` + reply prompts + one-tap post
18. Real-time review alerts + service recovery escalation for ≤3-star
19. Social graphic generator — satori-based, three formats
20. GBP post generator + customer share-card moment on thank-you page
21. Simple referral links + tracking + admin referrals view
22. Staff Mode + restricted role + staff scripts
23. Revenue Attribution Dashboard

### v1.6 Release (Sessions 24–32) — ~8–10 weeks after v1.5

24. Two-sided referral engine (TCPA-safe incentive)
25. B2B Partner Referral Mode
26. Review Theme Mining — weekly batch + dashboard
27. Review-to-Ad-Copy Generator
28. Review-themed Landing Page Generator
29. Expanded widget gallery — before/after, location-specific, carousel, QR poster
30. Scheduled social posting (Instagram/Facebook via Meta Graph)
31. Custom domain CNAME support
32. Vertical landing pages (clinics, restaurants, lawyers, translation, immigration)

### v1.7 Release (Sessions 33–40) — ~10 weeks after v1.6

33. Best Advocates CRM + outreach templates
34. Video Testimonial Generator (Remotion)
35. Booking integrations (Calendly, Square, Acuity)
36. Auto-published quarterly testimonial SEO pages at scale
37. Multi-location bulk management UI
38. CSV bulk customer upload
39. Reply Assistant auto-mode for ≥4-star
40. Public REST API + webhooks (demand-dependent)

### Cadence

Assuming 1–2 sessions per week alongside agency work:
- v1: ~10–12 weeks
- v1.5: +6–8 weeks → month 5
- v1.6: +8–10 weeks → month 7
- v1.7: +10 weeks → month 10

Real product company in under a year.

---

## 14. Success Metrics

### v1 launch (first 30 days post-launch)
- 25 paying accounts
- 60% trial-to-paid conversion
- 90% of accounts complete onboarding (send at least one request)
- Customer review completion rate > 35%

### v1 + v1.5 quarter (90 days post-v1.5)
- 100 paying accounts
- $8,500–$10,500 MRR
- 30%+ of Growth customers using website widget within first week of v1.5
- AI Reply Assistant adoption: ≥40% of Growth customers reply through BAAM within 30 days
- Referral link click-through rate: ≥8% of completed reviews → at least one referral click

### Health metrics
- AI draft generation P50 < 3s, P95 < 8s
- Public review page LCP < 1.5s
- Account churn < 4% monthly
- NPS > 40
- **Revenue Attribution dashboard engagement** — % of Growth customers viewing it weekly (target > 60%; this is the anti-churn metric)

---

## 15. Risks & Mitigations

**Scope creep.** Three new feature areas in v1.5 (Reply Assistant, Display, Distribute) could each become their own product. Mitigation: hard phase boundaries.

**Google review API rate limits / scraping.** Importing via GBP API has limits; some businesses may not have Profile Manager set up. Mitigation: graceful degradation, guided GBP setup during onboarding.

**Xiaohongshu API uncertainty.** Limited official API; auto-posting may require manual export-and-upload through v1.6. Mitigation: ship image generation in v1.5, scheduled posting only for stable APIs (Meta Graph). Xiaohongshu stays "generate-and-download" until partnership feasible.

**FTC fake reviews rule (2024) is strict.** Mitigation: ad-copy and landing-page outputs always cite real review themes; never fabricate testimonials; consent layer ensures legal usability; documented audit trail.

**Customer education curve.** "Review-to-Revenue Engine" is bigger than "review collection." Mitigation: marketing home walks through the loop visually; pricing page explains tier narrative; ROI calculator gives concrete dollar value; onboarding introduces features incrementally.

**Service recovery.** If a low-rating review is mishandled, owner-operator may blame BAAM. Mitigation: AI-suggested responses are clearly drafted suggestions, never auto-sent.

**Competitor copies the loop.** Mitigation: ship fast; win multilingual + Xiaohongshu + bilingual-reply combination first; BAAM-ecosystem GEO loop-back as second moat.

---

## 16. Future Beyond v1.7

- White-label tier with full agency dashboard customization
- Public REST API and webhooks
- Native iOS app
- HubSpot, Pipedrive, Mailchimp integrations
- Industry-specific prompt libraries
- BAAM Review + BAAM SEO + BAAM Local bundle

**The portfolio thesis.** BAAM Review is one product in a portfolio. Customers who succeed with Review become candidates for SEO and Local. Customers using all three become highly defensible and high-LTV. The portfolio is the moat, not any single product.

---

## 17. Appendix

### A. Customer copy library

**Marketing home headline.**
> Turn happy customers into reviews, referrals, and revenue.

**Marketing home subhead.**
> BAAM Review is the Review-to-Revenue Engine for local businesses. Collect Google reviews in 60 seconds, display them on your website to convert visitors, distribute them to Xiaohongshu and social, and turn your best customers into referrals — all in three languages, from $49/month.

**Sub-narratives by tier:**
- Starter: "Get more Google reviews. In English, Chinese, or Spanish, in 60 seconds, from your customers."
- Growth: "Turn reviews into revenue. Display them, distribute them, refer from them, learn from them."
- Agency: "Reputation and referrals at scale. For agencies managing many local businesses."

**Post-review thank-you copy (English):**
> Thank you for supporting [Business Name].
> Your feedback helps more local families find trusted care.
> A few things you might want to do next:
> • Book your next visit
> • Share [Business Name] with a friend
> • Follow us for updates

**For BAAM Studio clients:**
> BAAM Review is the reputation layer of your market presence system. Your website, Google profile, social content, and referral flow all become stronger every time a customer leaves feedback.

### B. Naming alternatives

In pocket if `baamreview.com` ever feels limiting: Vouch, Praise, Tally, Chime, Loop, Echo, Hark.

### C. Open questions

1. **Xiaohongshu posting automation.** Manual-download workflow in v1.5; revisit in v1.6.
2. **Analytics tool.** Recommend PostHog for funnel + event-level analysis.
3. **Booking integration order.** Calendly first, then Square, then Acuity.

---

## Previous Changelogs

**v1.3**: Added Reputation Engine v1.5/v1.6 outline, expanded competitive analysis, Xiaohongshu distribution.

**v1.2**: Pricing tiers up — Starter $49, Growth $99 (5 locations), Agency $499. Free tier 5 requests/month. Founding-customer lock-in. Updated success metrics.

**v1.1**: Locked subdomain decision. Added explicit URL structure. Added responsive strategy section.

**v1.0**: Initial master plan.

---

*End of Master Plan v2.0. Next deliverable: 01-marketing-home.html with Review-to-Revenue Engine positioning.*
