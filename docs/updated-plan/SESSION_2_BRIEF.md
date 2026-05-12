# BAAM Review — Session 2 Brief

**Version:** 2.0
**Date:** May 12, 2026
**Agent:** Claude Code
**Estimated duration:** 8–10 hours of agent execution
**Scope:** The customer-facing review flow — chip questions, AI draft editor, thank-you page, share-card preview
**Prerequisite:** Session 1 complete and merged. `clients/baam-review/` deployed at `review.baamplatform.com`.

---

## How to use this brief

Paste **everything below the next divider** into the first prompt of a fresh Claude Code session. Stay available for the four gate confirmations — each gate ends with an explicit pause for your "go."

This session does NOT touch the admin surface. It builds the public review pages that customers see at `review.baamplatform.com/r/[token]/...`. Owner-facing screens stay placeholder pages until Session 3.

---

## CONTEXT — agent, read this first

You're building **Stage 1 (Collect) + Stage 2 (Publish) + the Stage 6 (Refer) doorway** of BAAM Review's seven-stage Review-to-Revenue Loop. Specifically:

1. The route a customer lands on when they tap their SMS or scan a QR code
2. Three chip-question screens that elicit "what we helped with / how it went / one word"
3. The AI-drafted review editor where the customer reviews, edits, and copies the draft
4. The Google handoff that copies text and opens Google Maps
5. The thank-you page after they return from Google
6. The inline share-card preview that becomes a referral link

**What you are NOT building this session:**
- The AI drafting backend (uses a stub deterministic generator for Session 2; real Anthropic SDK wires in Session 5)
- SMS and email sending of the request itself (Session 4)
- Owner-facing screens like the Reply queue, Display widget, or revenue dashboard
- Stripe-gated tier features
- Staff Mode mobile surface

The customer flow is the **single most important conversion artifact** in BAAM Review. Every UX detail in the prototypes was deliberate. Match them.

### Prototypes you must mirror

Reference these from `_prototypes/`:
- `05-review-questions.html` — chip questions + consent checkbox
- `06-review-ai-draft.html` — AI draft editor + Google handoff
- `07-review-thankyou.html` — post-review revenue moment with share-card reveal

All three are mobile-first, full-width-on-mobile cards centered on a cream background, with the EN / 中文 / ES language switcher in the top-right. They use the clinic brand color (red `#962D22` for Dr. Huang in the prototypes — but in production, this is per-location and pulled from `locations.brand_primary_color`).

### Stack — same as Session 1

Next.js 15 App Router. TypeScript strict. Supabase. Tailwind + shadcn/ui. Same fonts. No new dependencies except `next-intl` for i18n.

---

## DONE GATES

### Gate 1 — Routes + token resolution + i18n (~2 hr)

- [ ] `next-intl` installed and configured for `en` / `zh` / `es` locales
- [ ] Translation messages at `messages/en.json`, `messages/zh.json`, `messages/es.json` with the strings from `_prototypes/05-review-questions.html`, `06-review-ai-draft.html`, `07-review-thankyou.html` (extract them — they're all in the `T` object inside each prototype's `<script>` block)
- [ ] Route `/r/[token]/page.tsx` — resolves the token to a `review_requests` row, redirects to `/r/[token]/q/1` if request exists and status is in `('queued','sent','delivered','clicked')`, otherwise renders a "this link has expired" page
- [ ] Routes scaffolded as placeholders for Gate 2-4:
  - `/r/[token]/q/[step]/page.tsx` (chip questions, steps 1–3)
  - `/r/[token]/draft/page.tsx` (AI draft editor)
  - `/r/[token]/thanks/page.tsx` (thank-you)
  - `/r/[token]/private/page.tsx` (private feedback path)
- [ ] Language switcher component in the top-right corner of all `/r/[token]/*` routes — uses URL search param `?lang=en|zh|es` and falls back to the request's `language` column
- [ ] Public RLS policy added: `review_requests` is readable by anyone with a valid token (only the row matching `token = $1`); no other rows ever exposed
- [ ] Smoke test: manually insert a row into `review_requests` via Supabase SQL editor, visit `/r/<token>` → redirects to `/r/<token>/q/1`. Switch language using the toggle → text updates live.
- [ ] **Pause and report. Wait for "go."**

### Gate 2 — Chip questions (Stage 1 · Collect) (~2 hr)

- [ ] `/r/[token]/q/1/page.tsx` — "What did we help you with today?" with vertical-aware chips
  - For Session 2, hardcode chip sets for three verticals: TCM/acupuncture (Back pain, Migraines, Stress, Insomnia, Allergies, Digestion, Fertility, Other), immigration law (Green card, Citizenship, Visa, Asylum, Family petition, Business immigration, Court representation, Other), and restaurant (Dinner, Lunch, Takeout, Special occasion, First time, Regular, Catering, Other). The vertical comes from `locations.vertical` (you'll add that column in this gate's migration).
- [ ] `/r/[token]/q/2/page.tsx` — "How did it go?" with sentiment chips (Excellent, Very good, Good, Okay, Disappointing). If user picks "Okay" or "Disappointing," the form skips to the private feedback path on submit, not the public review draft.
- [ ] `/r/[token]/q/3/page.tsx` — "One word for us?" with positive descriptors (Caring, Skilled, Patient, Welcoming, Professional, Effective, Friendly, Custom…). Only shown if Q2 was positive.
- [ ] Consent checkbox on Q3 with the exact text from the prototype, **default on**. Stored in `review_request.consent_display` on submit.
- [ ] Q1 stored in `review_question_responses.q1_helped_with` as the chip's `value`; Q2 in `q2_experience`; Q3 in `q3_one_word`; rating inferred from Q2 (Excellent=5, Very good=5, Good=4, Okay=3, Disappointing=2) and stored on the same row
- [ ] "Other…" chip on any question expands a text input below the chip row; the typed text goes into `custom_other_text`
- [ ] Progress bar at top reflects 1/3, 2/3, 3/3 with the clinic brand color
- [ ] Bottom of every Q page: a quiet "Share privately with the clinic instead" link → `/r/[token]/private`
- [ ] On Q3 submit (and consent captured), update `review_requests.status = 'clicked'` and `clicked_at = now()`, then redirect to `/r/[token]/draft`
- [ ] **Migration in this gate:** add `locations.vertical` column (text, default `'general'`, check constraint `vertical in ('general','tcm','immigration_law','restaurant','real_estate','home_decor','insurance')`)
- [ ] **Pause and report. Wait for "go."**

### Gate 3 — AI draft editor + Google handoff (Stage 2 · Publish) (~2.5 hr)

- [ ] `/r/[token]/draft/page.tsx` — full editor matching `06-review-ai-draft.html`
- [ ] **Stub AI generator** at `lib/ai/draft.ts` — a deterministic function `generateDraft(input: { responses, locationName, language, vertical }) → string`. Use templates that interpolate the chip answers in a natural-sounding way. **No Anthropic call yet** — that lands in Session 5. Three templates per vertical per language (9 templates × 3 languages = 27 strings total). They should produce convincingly varied output. Acceptable for Session 2; the seam between this stub and the real AI is exactly one function call later.
- [ ] Textarea editable with live character counter (use `Array.from(text).length` for correct Chinese handling)
- [ ] Star rating row at the top, prefilled from inferred rating, editable (user can downgrade)
- [ ] "Regenerate" button calls `generateDraft` with a different template seed, shows shimmer animation during the simulated 1.1-second delay
- [ ] Consent pill — shows "Consented to display" (green) if `consent_display` is true, otherwise "Posting only — not consented to display" (muted gray)
- [ ] "You're the author" callout card matches the prototype exactly
- [ ] "Copy & open Google" button:
  1. Writes the textarea contents to `navigator.clipboard`
  2. POSTs to `/api/r/[token]/copy-and-handoff` which: writes `first_party_reviews` row (if consent), creates an `imported_reviews` placeholder marked `source='google'` with `body=null` and `posted_at=null` (will be filled when GBP polling discovers it in Session 6), updates `review_requests.status = 'completed'` and `completed_at = now()`
  3. Opens `locations.gbp_review_link` in a new tab
  4. Redirects the current tab to `/r/[token]/thanks` after a 500ms delay so the user sees the toast
- [ ] "Share privately" button at the bottom always available → `/r/[token]/private` (never gated, master plan no-gating commitment)
- [ ] **Pause and report. Wait for "go."**

### Gate 4 — Thank-you page + share-card preview + private path (~2.5 hr)

- [ ] `/r/[token]/thanks/page.tsx` — matches `07-review-thankyou.html`
- [ ] Confirmation banner with checkmark animation, clinic logo strip
- [ ] Two-action card: "Book your next visit" (primary, clinic-red, opens `locations.booking_url` in new tab) and "Share with a friend" (secondary, reveals the share card)
- [ ] **Share card reveal** — inline, animated slide-down. Renders a preview of the actual generatable image (the real PNG generation lands in Session 6; for Session 2, the inline DOM-rendered preview is what gets shown in-page and is good enough for the customer to understand what they'll be sharing)
- [ ] Share destinations: WeChat / SMS / Copy link / More. **Copy link** writes a real tracked referral URL to clipboard, format: `https://review.baamplatform.com/ref/<referral_token>`. The other destinations fire toast notifications for Session 2 (deep-link integration lands in Session 6).
- [ ] When the user taps any share destination, write a `referral_events` row with `event_type='share_card_viewed'`, and create the `referrals` row if not yet created
- [ ] Follow card with Xiaohongshu / Instagram / WeChat — pulls handles from `locations.social_handles` JSONB (graceful empty state if not configured)
- [ ] "All done — close this page" button at the bottom
- [ ] `/r/[token]/private/page.tsx` — private feedback path matching the prototype's tone. Textarea, optional contact field, submit writes to `private_feedback` table with `status='open'`
- [ ] `/r/[token]/expired/page.tsx` — graceful "this link has expired or was already used" page with a CTA to contact the business directly
- [ ] All four pages render fully in EN / 中文 / ES via `next-intl`
- [ ] End-to-end smoke test from an inserted test row: visit `/r/<token>` → answer 3 questions → see AI draft → click "Copy & open Google" → land on thanks page → tap "Share with a friend" → see share card → tap Copy link → verify clipboard contains the referral URL → verify Supabase has the expected rows in `review_question_responses`, `first_party_reviews`, `referrals`, `referral_events`
- [ ] **Pause and report. This is end-of-session.**

---

## ROUTING — what gets added to `app/`

```
app/
├── r/
│   └── [token]/
│       ├── page.tsx              # Token resolution + redirect
│       ├── layout.tsx            # Per-token chrome — language switcher, clinic header
│       ├── q/
│       │   └── [step]/page.tsx   # Steps 1, 2, 3
│       ├── draft/page.tsx
│       ├── thanks/page.tsx
│       ├── private/page.tsx
│       └── expired/page.tsx
├── ref/
│   └── [token]/page.tsx          # Referral link landing — Session 6 wires the full conversion path; Session 2 just records the click event and redirects to the location's site
└── api/
    └── r/
        └── [token]/
            ├── responses/route.ts        # POST: save chip answers
            ├── copy-and-handoff/route.ts # POST: write FP review + imported review + status=completed
            ├── share-event/route.ts      # POST: write referral_events row
            └── private-feedback/route.ts # POST: write private_feedback row
```

---

## STUB AI GENERATOR — `lib/ai/draft.ts`

This is the most likely thing to get over-engineered. Keep it deterministic, keep it small. The interface:

```typescript
type DraftInput = {
  q1: string;          // chip value or custom text
  q2: string;          // chip value
  q3: string;          // chip value or custom text
  customQ1?: string;
  rating: number;
  locationName: string;
  vertical: string;    // 'tcm' | 'immigration_law' | 'restaurant' | etc
  language: 'en' | 'zh' | 'es';
  seed?: number;       // for regenerate — picks a different template variant
};

export function generateDraft(input: DraftInput): string {
  // Pick 1 of 3 templates per vertical+language based on seed % 3
  // Interpolate q1, q3, locationName
  // Return ~200-350 char string
}
```

Three templates per vertical+language. Keep them natural — they should read like something a happy customer would actually write. Use the example from the prototype as a starting point. Reuse the Q2 sentiment to inflect tone (Excellent → enthusiastic, Good → measured, but never sycophantic).

**Critical:** the generator must NEVER include the customer's name in the body. The author identity is captured separately and prevents accidental PII leakage to imported_reviews if Google posts the wrong name.

---

## VERTICAL-AWARE CHIP SETS

Hardcoded in `lib/verticals/chip-sets.ts` for Session 2. Three verticals to ship:

```typescript
const CHIP_SETS = {
  tcm: {
    q1: ['back-pain', 'migraines', 'stress-anxiety', 'insomnia', 'allergies', 'digestion', 'fertility', 'other'],
    q3: ['caring', 'skilled', 'patient', 'welcoming', 'effective', 'professional', 'gentle', 'custom']
  },
  immigration_law: {
    q1: ['green-card', 'citizenship', 'visa', 'asylum', 'family-petition', 'business-immigration', 'court-rep', 'other'],
    q3: ['responsive', 'thorough', 'reassuring', 'experienced', 'clear', 'professional', 'kind', 'custom']
  },
  restaurant: {
    q1: ['dinner', 'lunch', 'takeout', 'special-occasion', 'first-time', 'regular', 'catering', 'other'],
    q3: ['delicious', 'authentic', 'welcoming', 'attentive', 'fresh', 'memorable', 'quick', 'custom']
  }
}
```

Each chip's display label translates via `next-intl` per language. The `value` stored in DB is the slug (e.g. `'back-pain'`), not the display text — so the data is queryable regardless of language.

Sessions 8+ add the other verticals (real estate, home decor, insurance).

---

## RLS POLICIES THIS SESSION ADDS

```sql
-- review_requests readable by anyone with the matching token
create policy review_requests_public_read_by_token on review_requests
  for select using (true);
-- (Token uniqueness + the absence of any other public listing path is the security boundary;
-- nobody can read the table without supplying a specific token in the query)

-- review_question_responses: writable by anyone for a valid request token
create policy rqr_public_write on review_question_responses
  for insert with check (
    exists (select 1 from review_requests where id = review_request_id)
  );

-- first_party_reviews: insertable by the request token holder
create policy fpr_public_insert on first_party_reviews
  for insert with check (
    exists (select 1 from review_requests where id = review_request_id and status in ('clicked','completed'))
  );

-- referrals: readable by anyone with the matching token
create policy referrals_public_read_by_token on referrals
  for select using (true);

-- referrals: insertable from a valid review_request
create policy referrals_insert on referrals
  for insert with check (
    exists (select 1 from review_requests where id = referrer_review_request_id and status in ('clicked','completed'))
  );

-- referral_events: insertable for any existing referral
create policy referral_events_insert on referral_events
  for insert with check (exists (select 1 from referrals where id = referral_id));

-- private_feedback: insertable from a valid review_request token
create policy private_feedback_insert on private_feedback
  for insert with check (
    review_request_id is null or
    exists (select 1 from review_requests where id = review_request_id)
  );

-- post_review_actions: insertable from a valid request
create policy pra_insert on post_review_actions
  for insert with check (
    exists (select 1 from review_requests where id = review_request_id)
  );
```

**Note:** These are scoped writes for unauthenticated customers (the `anon` Supabase role). The `service_role` always bypasses RLS — owner/staff actions in later sessions use `service_role` from server components after auth checks.

---

## DESIGN FIDELITY CHECKLIST

When you finish each gate, side-by-side the rendered page against the prototype HTML at the same viewport width. The match should be near-perfect. Specific things to get right:

- **Clinic logo gradient.** Linear `135deg` from `clinic.primary` to `clinic.primary-dark`. Rendered with the location's brand color, not hardcoded clinic red — pull from `locations.brand_primary_color`.
- **Star rating hover scale.** `transform: scale(1.12)` on hover, 120ms ease.
- **Consent pill default state.** Green when checked, muted-gray when not. Updates live as the textarea contents render.
- **Chinese font.** When `language === 'zh'`, body inherits `Noto Sans SC`. Heading uses `Fraunces` + `Noto Sans SC` fallback. The textarea in draft view switches to Fraunces+Noto Sans SC for editorial weight (Newsreader doesn't support Chinese).
- **Share card preview.** The inline DOM render must match `07-review-thankyou.html` pixel-perfect (clinic gradient bg, gold pill, gold stars, italic Fraunces quote, customer attribution, branded QR placeholder, clinic logo bottom-left). Real PNG generation comes Session 6 — this is the visual-preview-only version.
- **Top-right language switcher.** Cream pill background, ink-on-cream when inactive, ink-bg+cream-text when active. Three options exactly.
- **Animations.** Sub-second, eased. Specifically:
  - Page-to-page transitions: 250ms fade
  - Share card reveal: 350ms slideDown + smooth scroll into view
  - Star hover: 120ms scale
  - Confirmation checkmark on thank-you: 500ms `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoot
  - Regenerate shimmer: 1.2s infinite while loading, 1100ms total before swap

---

## CONSTRAINTS

1. **Public routes don't query auth.** No `supabase.auth.getUser()` calls anywhere under `/r/[token]/*` — the token IS the authentication. RLS does the rest.
2. **Don't import the AI SDK.** That's Session 5. The `lib/ai/draft.ts` stub is deterministic and template-based.
3. **Don't call external APIs.** No Google Maps API calls for the handoff — just open `gbp_review_link` in a new tab. No share API integrations (deep links land Session 6). Toasts only for now.
4. **Don't add an auth wall.** These pages are accessed from SMS links by customers who never sign in. The token is the only identifier.
5. **Don't break the consent state machine.** If a customer unchecks consent, they can still post to Google but their review must NOT be written to `first_party_reviews` (only `imported_reviews` as a placeholder for GBP polling later).
6. **Stop at every gate.** Same as Session 1.

---

## REPORT FORMAT (same as Session 1)

At each gate: gate name + time spent, files changed, ✓/✗ checklist, blockers, next step, decisions to flag. Under 400 words.

---

## SESSION 2 SUCCESS LOOKS LIKE THIS

By end of session, you (John) should be able to:

1. Manually insert a `review_requests` row via Supabase SQL editor with `token='test-001'`, `location_id=<Dr. Huang>`, `customer_snapshot={"name":"Sarah Liu"}`, `language='zh'`
2. Visit `https://review.baamplatform.com/r/test-001` on your phone
3. Get redirected to `/r/test-001/q/1` rendered in 中文
4. Tap chip "偏头痛" → continue → tap "Excellent" → continue → tap "skilled" → consent stays checked → submit
5. See an AI-generated Chinese review in the textarea
6. Tap "Regenerate" → see a different draft
7. Tap "Copy & open Google" → Google Maps opens in a new tab with Dr. Huang's review form preloaded → return to BAAM tab → see the thank-you page
8. Tap "Share with a friend" → see the share card with Sarah's review quote rendered in italic Fraunces inside a red gradient card with a QR placeholder
9. Tap Copy link → paste in Messages → confirm the URL is a valid referral link

…all in Chinese, with consistent clinic-red branding throughout, no auth required, no console errors, all expected DB rows present.

**Nothing more.** Owner-facing screens come Session 3.

---

**Now begin with Gate 1. Confirm you've read this brief before starting.**
