# BAAM Review — Session Briefs 3 through 12

**Version:** 2.0
**Date:** May 12, 2026
**Scope:** The remaining 10 Claude Code sessions from end-of-Session-2 through v1 launch readiness.

---

## How to use this document

Each session has its own self-contained brief with prerequisites, scope, gates, and success criteria. To start a session: copy the section from `## SESSION N` through the next `---` divider into a fresh Claude Code prompt.

**Prerequisite for every session:** The previous session is complete and merged to `main`. Vercel preview deploys are passing.

**Timing assumption:** Sessions run weekly. Total elapsed time from Session 1 start to v1 launch: ~10–12 weeks.

**Three sessions are "soak weeks"** with no agent work — Sessions 5, 8, and 11 each include a paragraph at the top describing what you should do **manually** during the soak (customer outreach, testing, content creation).

---

# SESSION 3 — Admin Dashboard

**Estimated duration:** 8–10 hours
**Scope:** The owner-facing daily-use surface — revenue strip, funnel, recent activity, sidebar nav with live counts
**Prerequisite:** Session 2 merged. Customer flow works end-to-end with a manually-inserted test row.

---

## Context — agent, read this first

You're building the **daily-use surface** for the BAAM Review paying customer. This is the screen the owner opens every morning. It must surface three things instantly: (1) revenue attribution this month, (2) anything that needs their attention (service recovery, pending replies), and (3) what's been happening since they last logged in.

Reference prototype: `_prototypes/03-admin-dashboard.html`. The match should be near-pixel-perfect for desktop; mobile responsive collapse is acceptable.

What this session does NOT include:
- The Send Request screen (Session 4)
- AI Reply queue functionality (Session 5; this session just renders the queue badge with a count)
- Stripe checkout / billing screens (Session 7)

---

## DONE GATES

### Gate 1 — Dashboard shell + sidebar nav (~2 hr)

- [ ] `app/dashboard/layout.tsx` renders the sidebar exactly matching prototype `03-admin-dashboard.html`
- [ ] Sidebar items: Dashboard (active), Send request, Reviews, AI Replies, Referrals, Distribute, Analytics, Embed & QR; Settings, Billing
- [ ] Location switcher above nav — pulls from `locations` table for the current account, shows current selection with chevron, click opens dropdown
- [ ] User card at bottom — initials, name, tier + "Founding member" if `accounts.founding_member`
- [ ] Nav badge logic wired (Reviews: count where `imported_reviews.replied_at is null` for pending replies as gold, count where `private_feedback.status='open'` as red alert; AI Replies: same gold count; Referrals + Distribute: "NEW" pill for first 30 days after the feature launched per account)
- [ ] Top bar with greeting, date, "Last 30 days" filter button, "Send request" primary CTA
- [ ] **Pause and report. Wait for "go."**

### Gate 2 — Revenue strip + funnel (~2 hr)

- [ ] Four-card revenue strip at top
- [ ] Hero card (1.4× width): "Estimated revenue impact" with computed value
- [ ] Revenue impact formula: `(completed_reviews_30d × locations.avg_customer_value_cents × 0.05) / 100` (the 0.05 is the assumed conversion lift; surface the assumption in the tooltip)
- [ ] Three secondary cards: New Google reviews (count `imported_reviews where posted_at >= now() - 30 days`), Referral clicks (count `referral_events where event_type='cta_clicked' and created_at >= now() - 30 days`), Website widget views (count `widget_events where event_type='view' and created_at >= now() - 30 days`)
- [ ] All four cards show delta vs. previous 30-day window with up/down arrows
- [ ] Funnel section below: Sent → Delivered → Clicked → Completed bars sourced from `review_requests` status counts
- [ ] Funnel extends to fifth bar in gold gradient: "Est. impact" with the dollar value
- [ ] Funnel summary line: "Outperforming the industry by Nx on completion. Revenue attribution assumes $X/customer with 5% lift."
- [ ] All counts use server components with `cache: 'no-store'` — no client-side fetching for these stats
- [ ] **Pause and report. Wait for "go."**

### Gate 3 — Service recovery + activity feed (~2.5 hr)

- [ ] Service recovery alert at top renders **only when** count of unresolved items > 0
- [ ] Counts unresolved items as: `private_feedback where status='open'` PLUS `imported_reviews where rating <= 3 AND replied_at is null`
- [ ] Red gradient banner with icon, "N reviews need your attention" headline, breakdown sub, "Review now →" button
- [ ] Activity table — last 10 events across `review_requests`, `imported_reviews`, `referrals`, `private_feedback`
- [ ] Unified into a single sorted-by-recency feed via UNION query
- [ ] Each row: status dot (5 colors: completed green, clicked gold, sent sage, private warn-orange, referred gold gradient), name + meta, channel, language tag, time-ago
- [ ] Activity row click navigates to the relevant detail screen (placeholder for now)
- [ ] **Pause and report. Wait for "go."**

### Gate 4 — Right column: referrals, advocates, quick actions (~2.5 hr)

- [ ] Referrals card — shows count of bookings attributed to referrals this month, four-step pipeline (Reviewers → Shared → Clicked → Booked) with arrows between
- [ ] Top referrers list — top 3 customers by referral_count from `advocates` view (build this view in migration: aggregate from `referrals`)
- [ ] Best Advocates card — top 3 by composite score (review count × 1 + share count × 2 + referral count × 5 + rebook × 3, capped at 100)
- [ ] Quick Actions card — four buttons: Send a review request, Generate social graphic (placeholder), Copy widget embed (placeholder), Open Staff Mode (placeholder)
- [ ] End-to-end smoke test: log into the dashboard, see real data from your test review_request rows, verify the revenue impact calculation by hand, click each card → reasonable navigation
- [ ] **Pause and report. End of session.**

---

# SESSION 4 — Send Request (SMS + Email)

**Estimated duration:** 8–10 hours
**Scope:** The actual sending of review requests via Twilio (SMS) and Resend (email)
**Prerequisite:** Session 3 merged. **Twilio A2P 10DLC approval must be live** (you filed this in Pre-Session-1 setup).

---

## Context — agent, read this first

This is the wiring session. The customer-facing flow already works (Session 2). The dashboard already shows revenue (Session 3). Now we make the actual SMS arrive on a customer's phone.

Three things:
1. The Send Request admin screen at `/dashboard/send` (matching `_prototypes/04-admin-send-request.html`)
2. Twilio SMS integration with TCPA compliance (opt-out, A2P 10DLC, message templates)
3. Resend email integration as the alternative channel

Reference prototype: `_prototypes/04-admin-send-request.html`.

---

## DONE GATES

### Gate 1 — Send request screen (~2 hr)

- [ ] `app/dashboard/send/page.tsx` matching the prototype
- [ ] Form fields: Recipient name, Channel toggle (SMS / Email), Phone or Email input (swaps), Language pills (EN/中文/ES), Message template preview
- [ ] Right column live preview — phone-frame SVG with the SMS rendering live as the user types or changes language
- [ ] Recent sends table at the bottom — last 10 from `review_requests` with channel, language, status pill, time
- [ ] **Pause and report.**

### Gate 2 — Twilio SMS sending (~2.5 hr)

- [ ] `lib/sms/twilio.ts` with `sendReviewRequestSMS(params)` function
- [ ] Uses Twilio Messaging Service SID from env (created in Pre-Session-1 setup)
- [ ] Message body: language-aware template with `{{name}}`, `{{business}}`, `{{link}}` variables
- [ ] Link is `https://review.baamplatform.com/r/{token}` where token is generated via `crypto.randomBytes(8).toString('base64url')`
- [ ] TCPA compliance: every message ends with "Reply STOP to opt out" (or 中文/ES equivalent)
- [ ] STOP/opt-out tracking: webhook from Twilio at `/api/webhooks/twilio` updates `customers.opted_out_at`
- [ ] Sending suppressed for opted-out customers (return error with clear message in admin UI)
- [ ] On successful send: `review_requests.status = 'sent'`, `sent_at = now()`, `twilio_sid` set
- [ ] On delivery webhook: `status = 'delivered'`, `delivered_at = now()`
- [ ] **Pause and report.**

### Gate 3 — Resend email sending (~2 hr)

- [ ] `lib/email/resend.ts` with `sendReviewRequestEmail(params)`
- [ ] Email template designed in Resend dashboard (or as a React Email component) matching brand
- [ ] Subject line: "Quick favor? Share your visit with us" / 中文 / ES equivalents
- [ ] Verified sending domain set up under `review.baamplatform.com` with SPF, DKIM, DMARC (this is the DNS setup deferred from Pre-Session-1)
- [ ] Tracking: `resend_id` saved to `review_requests`; click tracking via custom URL with token resolution
- [ ] Bounce handling: hard bounces mark `customers.email_invalid`
- [ ] **Pause and report.**

### Gate 4 — Click and completion tracking (~2 hr)

- [ ] When customer clicks the SMS/email link: middleware on `/r/[token]/page.tsx` writes `status='clicked'` and `clicked_at=now()` if not already set
- [ ] When customer completes Google handoff: API route from Session 2 already sets `status='completed'` — verify it fires
- [ ] Dashboard funnel reflects the live transitions
- [ ] Send a real SMS to your own phone end-to-end, complete the flow, watch dashboard update in real time
- [ ] **Pause and report. End of session.**

---

# SESSION 5 — AI Drafting (Claude integration)

**This is a SOAK WEEK.** During this week, plan to:
- Send review requests to 5–10 real customers (with their permission, framed as beta)
- Collect feedback on the AI draft quality
- Document edge cases for the prompt design

Then the agent work below tunes the prompts based on real data.

**Estimated duration:** 6–8 hours
**Scope:** Replace the Session 2 stub generator with real Claude integration
**Prerequisite:** Session 4 merged. Anthropic API key in env. **Real customer feedback collected** during the soak.

---

## Context — agent, read this first

Session 2 shipped a deterministic template generator at `lib/ai/draft.ts`. This session replaces that with Claude (Haiku for the customer draft path — fast and cheap; Sonnet only for the AI reply assistant which lands in Session 6).

The interface stays the same: `generateDraft(input: DraftInput) → string`. The agent should not touch the customer flow UI — only the implementation behind `generateDraft`.

Critical design principle: **the prompt MUST produce drafts that read like the customer wrote them, not an AI**. The most common failure mode is sycophantic / over-formal / non-idiomatic prose. Test against real human reviews in each language.

---

## DONE GATES

### Gate 1 — Prompt design + Anthropic SDK wiring (~2 hr)

- [ ] Install `@anthropic-ai/sdk`
- [ ] `lib/ai/anthropic.ts` exports a configured client using env `ANTHROPIC_API_KEY`
- [ ] `lib/ai/prompts/draft.ts` exports `buildDraftPrompt(input: DraftInput)` returning system + user messages
- [ ] System prompt establishes role: "You help customers turn three short answers into a natural-sounding review. The customer is the author; you are an assistant. Write 200-350 characters in the customer's language. Match the energy of their sentiment. Never include the customer's name. Never sound like marketing copy."
- [ ] User prompt fills in: vertical, location name, sentiment score, q1+q2+q3 answers, language
- [ ] Three language-specific prompt addenda — `en`, `zh`, `es` — each calibrated to the idiomatic register of that language. Chinese specifically must avoid translated-English feel.
- [ ] **Pause and report.**

### Gate 2 — Generation + regeneration (~2 hr)

- [ ] `generateDraft(input)` calls `claude-haiku-4-5-20251001` with the built prompt
- [ ] Returns the cleaned text (no markdown, no preamble)
- [ ] Regenerate variant uses a temperature change + a "different angle: emphasize {{aspect}}" addendum
- [ ] Timeout 8 seconds — if Claude doesn't respond, fall back to the Session 2 deterministic stub
- [ ] Cost tracking: log token usage per call to `ai_usage_events` table (build this table in migration)
- [ ] **Pause and report.**

### Gate 3 — Quality testing + prompt iteration (~2 hr)

- [ ] Build an internal `/dashboard/_qa/drafts` page (owner-only, hidden from nav) that lets you generate 20 drafts with different input combos and review them side by side
- [ ] Test 20+ generations across EN/中文/ES, varying vertical and sentiment
- [ ] Iterate the prompt until at least 18/20 read naturally
- [ ] Critical: test Chinese drafts against real Chinese-language Google reviews from local clinics. The voice should match — measured, polite, specific. Not the breathless adjective-stack of translated marketing.
- [ ] **Pause and report.**

### Gate 4 — Failure modes + safeguards (~1.5 hr)

- [ ] Prompt injection guard: if any of `q1`, `q3`, `customQ1` contains suspicious patterns (`SYSTEM:`, `<|`, etc.), reject and use the deterministic stub
- [ ] Profanity filter on the output (use a simple deny-list, not an LLM call — cheap)
- [ ] Length enforcement: if output is < 100 chars or > 600 chars, regenerate once; if it still fails, fall back to stub
- [ ] Empty/whitespace output: same fallback
- [ ] End-to-end test: complete a review flow as a real customer, get a Claude-drafted response, edit, post to Google. Verify the seam between stub and real Claude is invisible to the customer.
- [ ] **Pause and report. End of session.**

---

# SESSION 6 — Display Widget + Social Distribution + Reply Assistant

**Estimated duration:** 10–12 hours
**Scope:** The Display stage (website widget) + Distribute stage (social cards) + AI Reply Assistant
**Prerequisite:** Session 5 merged. AI drafting is working in production.

---

## Context — agent, read this first

This is the heaviest session. It ships three major features that justify the Growth tier ($89/$99). Without these, BAAM Review is a $39 review-collection tool. With these, it's the $99 Review-to-Revenue Engine.

1. **Display widget** — a single embeddable script tag that puts a clinic's reviews on their website with proper Review schema markup
2. **Social graphics** — auto-generated PNG cards from top reviews for Xiaohongshu / Instagram / Facebook
3. **AI Reply Assistant** — drafts replies to incoming Google reviews in the reviewer's language

Each is non-trivial. Split the session into four gates accordingly.

---

## DONE GATES

### Gate 1 — Display widget (embed script + schema markup) (~3 hr)

- [ ] `app/api/widget/[location_slug]/route.ts` returns minified JS that injects the widget
- [ ] Embed snippet provided in `/dashboard/embed`: `<script src="https://review.baamplatform.com/api/widget/dr-huang" data-baam-review></script>`
- [ ] Widget renders inline: star rating average, latest 3-6 reviews (mix of imported_reviews + first_party_reviews where consent), CTA button to Google reviews page
- [ ] Widget pulls reviews via `/api/widget/[location_slug]/reviews.json` — cached at edge with 5-min TTL
- [ ] **Review schema markup** injected as JSON-LD in the host page for SEO benefit
- [ ] Mobile responsive, inherits host page styling minimally (Shadow DOM for isolation)
- [ ] Three preset themes: minimal, card, carousel — pickable in `/dashboard/embed`
- [ ] Widget fires `widget_events` rows on impression, view (>50% in viewport for >1s), and CTA click
- [ ] **Pause and report.**

### Gate 2 — Social graphics generator (~3 hr)

- [ ] `lib/graphics/social-card.ts` generates PNG cards from a review using `@vercel/og` or `satori` (server-side rendering)
- [ ] Three formats: 1080×1080 (square), 1080×1350 (portrait), 1080×1920 (stories)
- [ ] Card design matches spec in `BRAND_ASSETS.md` — clinic gradient bg, review quote in Fraunces italic, attribution, clinic logo + branded QR
- [ ] QR code rendered in clinic brand color (use `qrcode` npm package, post-process the colors)
- [ ] Generated cards stored in Supabase Storage under `social-graphics/{location_id}/{review_id}-{format}.png`
- [ ] `social_graphics` table row written per generated card
- [ ] `/dashboard/distribute` admin page: select a review, pick formats, generate, preview, download or copy direct URL
- [ ] Optional one-click "post to Xiaohongshu" — for v1 this just opens Xiaohongshu's web composer with the image URL pre-filled (full API integration deferred to v1.7)
- [ ] **Pause and report.**

### Gate 3 — AI Reply Assistant (~2.5 hr)

- [ ] `lib/ai/reply-prompts.ts` builds prompts for `claude-sonnet-4-6` (NOT Haiku — reply quality matters more than cost)
- [ ] System prompt: "You are drafting a reply from a small business owner to a Google reviewer. Respond in the language of the review. Acknowledge specific things the reviewer mentioned. Sound like a person, not a brand. 1-3 sentences."
- [ ] When `imported_reviews` row is created (or fetched in Session 7's GBP polling), trigger draft generation
- [ ] Three drafts generated per review (different tones: warm/professional/brief)
- [ ] Stored in `imported_reviews.ai_reply_drafts` JSONB column
- [ ] `/dashboard/replies` admin page lists pending replies with three draft options each, edit-and-approve flow
- [ ] Approved reply posts to Google via GBP API (or in v1, copies to clipboard with deep-link to Google reply screen — v1.5 wires the full API)
- [ ] **Pause and report.**

### Gate 4 — Polish and metric wiring (~2 hr)

- [ ] Widget impression/view/click counts flowing into the dashboard's "Website widget views" stat
- [ ] Social graphics generation count visible somewhere in admin (probably under `/dashboard/distribute`)
- [ ] AI Reply queue count in sidebar reflects real pending count
- [ ] End-to-end: install widget on a test page (a static HTML file works), see reviews render, click a CTA, watch the event flow in admin
- [ ] **Pause and report. End of session.**

---

# SESSION 7 — Stripe Integration

**Estimated duration:** 6–8 hours
**Scope:** Stripe checkout, subscription management, founding-customer pricing, billing portal
**Prerequisite:** Session 6 merged. Stripe products + prices created in Pre-Session-1 setup.

---

## Context — agent, read this first

Currently every user is on a free trial. This session monetizes. Four flows:
1. Trial → paid conversion via Stripe Checkout
2. Tier change (Starter ↔ Growth ↔ Agency)
3. Founding-customer pricing (admin-only path)
4. Subscription portal for self-serve billing changes / cancellations

---

## DONE GATES

### Gate 1 — Checkout flow (~2 hr)

- [ ] `/dashboard/billing` page shows current plan, next billing date, "Upgrade" / "Change plan" CTAs
- [ ] Plan picker → Stripe Checkout session → success URL `/dashboard/billing?success=1`
- [ ] On success, `accounts.tier`, `accounts.status='active'`, `accounts.stripe_customer_id`, `accounts.stripe_subscription_id` updated
- [ ] Use Stripe Checkout in subscription mode with the appropriate Price ID from `STRIPE_PRICE_IDS` env mapping
- [ ] **Pause and report.**

### Gate 2 — Webhook handling (~1.5 hr)

- [ ] `/api/webhooks/stripe/route.ts` verifies signature, handles five events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [ ] Subscription updated → write new tier and status to `accounts`
- [ ] Subscription deleted → status to `'canceled'`, but keep data (read-only mode until 30 days, then archive)
- [ ] Payment failed → status to `'past_due'`, fire notification email
- [ ] Idempotency: use Stripe event ID as dedupe key in `stripe_webhook_events` table
- [ ] **Pause and report.**

### Gate 3 — Founding customer assignment path (~1.5 hr)

- [ ] Hidden admin route `/admin/founding/[account_id]` (BAAM staff only — gated on a hardcoded `ADMIN_EMAILS` env list)
- [ ] Allows assigning a founding tier price to an existing account (via Stripe Subscription update with the founding Price ID)
- [ ] Marks `accounts.founding_member = true`, `accounts.founding_locked_pricing = jsonb({ tier, price_id, locked_at })`
- [ ] Decrement of remaining founding slots: a server function `getFoundingSlotsRemaining()` returns `50 - count(*) where founding_member`
- [ ] Landing page banner shows `getFoundingSlotsRemaining()` value live
- [ ] **Pause and report.**

### Gate 4 — Billing portal + cancellation (~1.5 hr)

- [ ] Stripe Customer Portal session creation
- [ ] "Manage billing" button in `/dashboard/billing` → portal redirect
- [ ] Cancellation flow: user cancels in portal → webhook fires → account moves to read-only on `current_period_end`
- [ ] In-app cancellation prompt: "Are you sure? Founding pricing is lost on cancellation. To pause instead, contact support."
- [ ] **Pause and report. End of session.**

---

# SESSION 8 — GBP Polling, Verticals Expansion, QR/Embed UX

**This is a SOAK WEEK.** During this week:
- Sign up at least 3 paying customers from your Tier 1 list
- Onboard each personally; document every confusing moment
- Take screenshots of every dashboard view with real customer data for your case studies

Then the agent work below addresses what you learned during real-world use.

**Estimated duration:** 8–10 hours
**Scope:** Google Business Profile review polling, additional verticals, QR code generation, embed snippet polish
**Prerequisite:** Session 7 merged. GBP API enabled (from Pre-Session-1).

---

## DONE GATES

### Gate 1 — GBP review polling (~3 hr)

- [ ] `lib/gbp/poll.ts` polls each connected location's GBP for new reviews every 30 minutes (Vercel cron at `/api/cron/poll-gbp`)
- [ ] New reviews inserted into `imported_reviews` (idempotent via `unique(source, source_review_id)`)
- [ ] On insert, trigger AI reply draft generation (from Session 6)
- [ ] Match incoming reviews against `review_requests` by author name + email when possible — link them so completion tracking is accurate
- [ ] **Pause and report.**

### Gate 2 — Additional verticals (~2 hr)

- [ ] Add 4 new verticals to chip sets: `real_estate`, `home_decor`, `insurance`, `general`
- [ ] Each gets 8 Q1 chips + 8 Q3 chips, in EN/中文/ES (the agent should research representative chip sets — for real estate: Buying, Selling, Investment, Renting, Commercial, etc.)
- [ ] Translation review: the chips need to make sense in each language, not be literal translations
- [ ] Vertical selectable during `/onboarding/new-location` flow
- [ ] **Pause and report.**

### Gate 3 — QR generation + Staff Mode polish (~2 hr)

- [ ] `/dashboard/embed` includes QR code download (PDF + PNG) for the location's primary review link
- [ ] QR rendered in location brand color, framed with the editorial "Scan to review" card design
- [ ] Staff Mode at `/app/staff` shipped with the prototype design — for accounts with `staff` role users
- [ ] Staff invite flow: owner can invite a staff user by email, staff account gets restricted dashboard
- [ ] **Pause and report.**

### Gate 4 — Onboarding flow polish (~1.5 hr)

- [ ] Onboarding wizard: 5 steps with progress indicator (basic info → GBP link → brand color → first SMS → done)
- [ ] Each step is saved on completion; resumable if interrupted
- [ ] Verify the GBP link by opening it in the user's browser during step 2 — if they get a working review form, the link is good
- [ ] **Pause and report. End of session.**

---

# SESSION 9 — Referral Tracking + Best Advocates

**Estimated duration:** 8–10 hours
**Scope:** The full referral funnel from share-card creation through attributable booking
**Prerequisite:** Session 8 merged.

---

## Context — agent, read this first

Session 2 shipped the share-card moment on the customer-facing thank-you page. Session 6 wired the social graphic generator. This session closes the loop: when a referred new customer books, attribute revenue back to the original referrer.

---

## DONE GATES

### Gate 1 — Referral landing page (~2 hr)

- [ ] `/ref/[token]/page.tsx` is the page a friend lands on when they tap a shared link
- [ ] Renders the original review prominently, plus a clear "Book at [Business]" CTA
- [ ] CTA opens the location's `booking_url` in a new tab
- [ ] Writes `referral_events` row with `event_type='cta_clicked'`
- [ ] If the referred friend has been here before (cookie), skip the review showcase and go direct to booking
- [ ] **Pause and report.**

### Gate 2 — Booking attribution (~2 hr)

- [ ] Booking attribution depends on the location's booking system; for v1, support two patterns:
  - **Manual confirmation:** Owner sees a list of "Recent referral clicks" in `/dashboard/referrals` and can mark "X became a customer" — writes `referral_events` row with `event_type='booked'` and updates `referrals.status='booked'`, `booked_at=now()`, `attributed_revenue_cents = locations.avg_customer_value_cents`
  - **Booking URL param:** If `booking_url` is configured with a `{ref}` placeholder, the referral link rewrites it with the referral token. If the booking provider supports webhooks (Calendly, Booksy), wire a webhook handler.
- [ ] **Pause and report.**

### Gate 3 — Best Advocates CRM preview (~2.5 hr)

- [ ] `/dashboard/advocates` page lists top 20 advocates with scoring
- [ ] Score formula: `review_count × 5 + share_count × 3 + referral_count × 15 + rebook_count × 8`, capped at 100
- [ ] Per-advocate detail page: their reviews, their shares, their referred customers (with attributed revenue)
- [ ] Bulk action: "Send thank-you message to top 10 advocates"
- [ ] Background job updates advocate scores nightly via `/api/cron/recompute-advocates`
- [ ] **Pause and report.**

### Gate 4 — Revenue attribution wired through (~2 hr)

- [ ] The dashboard's revenue strip now sources attribution from TWO paths:
  - `completed_reviews × avg_customer_value × 0.05` (estimated lift)
  - `sum(referrals.attributed_revenue_cents)` (actual referral revenue)
- [ ] Display the sum; tooltip explains breakdown
- [ ] Activity feed row "Wei Zhang via Sarah's referral · $300 attributed" pattern works end-to-end with real data
- [ ] **Pause and report. End of session.**

---

# SESSION 10 — Trilingual Polish, Compliance, Accessibility

**Estimated duration:** 6–8 hours
**Scope:** Pre-launch polish across i18n, compliance text, accessibility audit
**Prerequisite:** Session 9 merged.

---

## DONE GATES

### Gate 1 — Trilingual audit (~2 hr)

- [ ] Every string in the customer-facing flow verified by a native speaker (Chinese: you or someone you trust; Spanish: hire a native speaker for 2 hours via Upwork)
- [ ] Particular attention: the consent checkbox text in 中文 + ES, the AI draft prompts, the SMS templates, the thank-you page copy
- [ ] Owner-facing dashboard stays EN-only for v1 (the operator interface is for the business owner who reads English; the customer-facing flow is what needs to be trilingual)
- [ ] **Pause and report.**

### Gate 2 — Compliance text (~1.5 hr)

- [ ] Terms of Service drafted (use a SaaS template, customize for review collection use case)
- [ ] Privacy Policy drafted (GDPR + CCPA aware; explicit data retention windows)
- [ ] Cookie banner for EU visitors only (geolocate via Vercel headers)
- [ ] TCPA disclosure on the send-request screen and in onboarding
- [ ] Footer links to /terms, /privacy on every page
- [ ] **Pause and report.**

### Gate 3 — Accessibility (~2 hr)

- [ ] Run Lighthouse on all key pages — target 95+ accessibility score
- [ ] Color contrast audit: every text/background combo passes WCAG AA
- [ ] Keyboard navigation: every interactive element reachable and operable via keyboard
- [ ] Screen reader: review flow tested with VoiceOver on iOS (the dominant phone for your customer base)
- [ ] Reduced motion: animations respect `prefers-reduced-motion`
- [ ] **Pause and report.**

### Gate 4 — Performance + SEO (~1.5 hr)

- [ ] Marketing pages Lighthouse perf score 90+
- [ ] Customer review pages load < 1.5s on a throttled 4G connection
- [ ] Open Graph + Twitter Card metadata on all marketing pages
- [ ] Sitemap.xml + robots.txt
- [ ] Structured data on marketing pages (Organization, SoftwareApplication schemas)
- [ ] **Pause and report. End of session.**

---

# SESSION 11 — Founding Customer Onboarding + Admin Tools

**This is a SOAK WEEK.** During this week:
- Begin paid acquisition: light Meta and WeChat ad spend, $200–$500 total
- Sign up 5–8 more founding customers
- Record the case studies from your first cohort (with their permission)

Then the agent work below builds tools to support what you learned at scale.

**Estimated duration:** 6–8 hours
**Scope:** Internal admin tools for managing the founding-customer program
**Prerequisite:** Session 10 merged.

---

## DONE GATES

### Gate 1 — Founding customer counter + landing page wire-up (~2 hr)

- [ ] Landing page banner "23 spots left" pulls from `getFoundingSlotsRemaining()` live
- [ ] Counter decrements as new founding customers sign up
- [ ] At 0 remaining, banner changes to "All founding spots taken — thank you to our 50 founders"
- [ ] **Pause and report.**

### Gate 2 — Internal admin dashboard (~2.5 hr)

- [ ] `/admin/overview` (BAAM staff only) shows MRR, active accounts, trial-to-paid conversion, churn, top accounts by revenue impact
- [ ] `/admin/accounts` lists all accounts with tier, status, founding flag, MRR contribution, last login, activation status
- [ ] `/admin/accounts/[id]` detail view: full history, ability to comp a month, change tier manually, view all their reviews/referrals/widget events
- [ ] **Pause and report.**

### Gate 3 — Weekly retention pulse (~1.5 hr)

- [ ] Cron at `/api/cron/retention-pulse` runs Mondays at 8am
- [ ] Computes risk score per active paying account (low login frequency + low send volume + low revenue impact = high risk)
- [ ] Sends an internal email to you with top 5 at-risk accounts and suggested intervention scripts
- [ ] **Pause and report.**

### Gate 4 — Customer success polish (~1.5 hr)

- [ ] In-app "Need help?" widget on every dashboard page — opens a panel with: video walkthrough, common questions, "Message John on WeChat" CTA
- [ ] Onboarding completion email sequence (Day 0, Day 3, Day 7, Day 14, Day 30) via Resend
- [ ] Each email is short, actionable, links to a specific dashboard view
- [ ] **Pause and report. End of session.**

---

# SESSION 12 — Launch Readiness

**Estimated duration:** 4–6 hours
**Scope:** Final testing, monitoring, runbook for launch day
**Prerequisite:** Session 11 merged. All previous sessions deployed to production.

---

## DONE GATES

### Gate 1 — Production smoke test (~1.5 hr)

- [ ] Sign up a brand new account on production
- [ ] Complete onboarding end-to-end
- [ ] Send a real SMS to a real phone
- [ ] Complete a customer review flow on a different device
- [ ] Verify GBP polling picks up the posted review within 30 minutes
- [ ] Verify AI reply drafts generate
- [ ] Generate a social graphic and verify the PNG looks correct
- [ ] Embed the widget on a test page and verify it renders + tracks events
- [ ] Convert the trial to paid via Stripe Checkout (use a real card; refund afterwards)
- [ ] **Pause and report.**

### Gate 2 — Monitoring + alerting (~1.5 hr)

- [ ] Sentry wired for client + server error tracking
- [ ] Vercel Analytics + Speed Insights enabled
- [ ] Critical alerts to your phone via PagerDuty or Better Stack: prod 500 spike, Stripe webhook failure, Twilio delivery failure rate spike, AI generation timeout rate spike
- [ ] Status page at `status.review.baamplatform.com` (or simpler: Better Stack public page)
- [ ] **Pause and report.**

### Gate 3 — Backup + recovery (~1 hr)

- [ ] Supabase daily backups confirmed running (Pro tier feature, configured in Pre-Session-1)
- [ ] Point-in-time recovery tested (restore to staging from a 1-hour-ago point)
- [ ] Document the disaster recovery runbook in `clients/baam-review/docs/dr-runbook.md`
- [ ] **Pause and report.**

### Gate 4 — Launch day runbook (~1 hr)

- [ ] Document at `clients/baam-review/docs/launch-day.md` covering:
  - Pre-flight checklist (DNS, Stripe live mode, env vars, Twilio quota)
  - First 4 hours: monitor error rates, response times, signup conversion
  - First 24 hours: signup-to-activation rate target ≥ 80%, response to any production issue within 15 min
  - Week 1: daily 30-min review of metrics, daily customer outreach progress
- [ ] **Pause and report. End of v1 build.**

---

# After Session 12

You're ready to follow the `LAUNCH_CHECKLIST.md` playbook. The product can ship. Sessions 13+ are v1.6/v1.7 territory — covered briefly in `BAAM_REVIEW_MASTER_PLAN.md`'s 40-session plan but not detailed here.

**Estimated v1 launch readiness: end of week 10–12.**

---

**End of session briefs 3–12.**
