# Session 10 · Customer-Facing Audit Flows (No Stripe)

**Build target:** The customer-facing wrapper around the audit engine. Auth, signup-gated intake, audit generation orchestration, dashboard, and transactional emails. No payment processing — both the previously planned "free" and "paid" tiers collapse into a single free audit gated only by signup, with the BAAM Review service ($99/$399/mo) as the upsell.

**This is the launch session.** After Session 10 ships, baamreview.com has a self-serve audit product that lead-generates for BAAM Review service.

---

## 0. What Changed from the Original Session 10 Spec

The original Session 10 spec had:
- Two audit tiers (free 3-page + paid 7-page at $299)
- Stripe Checkout integration
- Webhook handling, refund logic, payment confirmation emails
- Tier resolution function returning `'free' | 'paid'`
- Pricing page

This spec replaces all of that with:
- **One free audit product** — the full 7-page audit, signup required, no payment
- **No Stripe** anywhere in the customer journey
- **BAAM Review service** ($99/mo Self-Serve or $399/mo Full Service) as the upsell at three touchpoints: audit PDF footer, audit-ready email, dashboard banner
- Simpler tier model — there's only one tier customer-facing, but internally the audit engine still uses `tier: 'paid'` value to fetch full data (free-tier-equivalent data depth is reserved for cost-controlled cases like competitor data)

**Implementation note for code already written:** If any Stripe-related code was implemented per the earlier spec, keep it in a feature-flagged disabled state. We may reintroduce paid audits or paid premium features later (e.g., AI insights from Session 7). Don't delete; just gate behind a feature flag.

---

## 1. Architectural Anchors

Carrying from prior sessions + new for this revised Session 10:

1. **Supabase Auth is the authentication layer.** Same as before. Email/password + Google OAuth.

2. **Signup gates everything.** No anonymous audits. The marketing page describes the product; clicking "Get your audit" routes to signup; after signup, the user enters their business and the audit generates. This is the only mechanism to capture leads and prevent abuse.

3. **Internal tier value is always `'paid'` for the customer.** The audit engine functions accept `tier: 'free' | 'paid'`. With Stripe removed, every customer-initiated audit calls the engine with `tier: 'paid'` to produce the full 7-page deliverable. The `'free'` tier value still exists in the engine codebase for: (a) competitor data fetching where we want free-tier-equivalent cost, (b) future re-enablement of a paid premium tier (Session 7 AI features, etc.).

4. **Rate limiting replaces payment as the abuse-prevention mechanism.** With no paywall, the system needs limits: 2 audits per user per month, max 5 audits per user lifetime in v1. These are soft caps adjustable per-account by admin.

5. **The BAAM Review service is a separate product.** Session 10 does NOT implement BAAM Review service signup, billing, or onboarding. It only drives traffic to existing baamreview.com platform pages. When a customer clicks "Upgrade to BAAM Review service," they go to a separate signup flow that exists outside Session 10's scope.

6. **Audit history is permanent.** Same as before — past audits never deleted, even if account is deleted (anonymized instead). Supports Day-90 re-audit comparisons.

---

## 2. URL Structure

Locked URL map. Use these exact paths in implementation:

### Public (anonymous-accessible)
| URL | Purpose | Notes |
|---|---|---|
| `/` | Marketing landing page | Promotes the audit, drives to signup |
| `/login` | Login for returning users | Email/password + Google OAuth |
| `/signup` | Signup for new users | Email/password + Google OAuth |
| `/auth/verify` | Email verification landing | Token-based, redirects to `/audits/new` on success |
| `/auth/reset-request` | Password reset request | Sends email |
| `/auth/reset-confirm` | Password reset confirm | Token-based |
| `/methodology` | Public methodology page | References baamreview.com/review-value.html |
| `/about` | About BAAM Studio | Optional in v1 |

### Authenticated (logged-in users only)
| URL | Purpose | Notes |
|---|---|---|
| `/audits` | Dashboard — list of user's audits | Default landing for logged-in users |
| `/audits/new` | Intake form — enter business | First-time flow lands here after signup |
| `/audits/{audit_id}` | Audit detail page | Shows the audit data + PDF download |
| `/audits/{audit_id}/processing` | Audit generation wait state | Polls for completion |
| `/account` | Account settings | Profile, password, language, danger zone |
| `/account/usage` | Audit quota / limits | Future — shows audits used vs. allowed |

### API routes
| URL | Method | Purpose |
|---|---|---|
| `/api/audit/generate` | POST | Triggers audit generation, returns audit_id |
| `/api/audit/status?id={id}` | GET | Returns audit generation status |
| `/api/audit/{id}` | GET | Returns audit data for detail page |
| `/api/audit/{id}/pdf` | GET | Returns PDF for download (signed URL or stream) |
| `/api/account/profile` | GET, PUT | Profile read/update |
| `/api/account/delete` | POST | Account deletion (soft delete) |

---

## 3. Auth + User Management

### 3.1 Tech stack (unchanged from original spec)
- Supabase Auth (email/password + Google OAuth)
- `@supabase/ssr` for Next.js cookie-based sessions
- Next.js App Router middleware for protected routes

### 3.2 Profiles table

Same as original spec, with rate-limit fields added:

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'zh-tc', 'zh-sc')),
  
  -- Attribution / lead-gen tracking
  signup_source TEXT,                       -- 'baamreview.com' | 'referral' | 'social' | 'other'
  signup_referrer_url TEXT,
  signup_business_query TEXT,                -- if business was entered before signup (Flow 2/3 - not used in current flow)
  
  -- Quota tracking (replaces Stripe tier gating)
  audits_used_this_month INTEGER NOT NULL DEFAULT 0,
  audits_used_lifetime INTEGER NOT NULL DEFAULT 0,
  monthly_quota_override INTEGER,            -- admin can grant extra audits
  lifetime_quota_override INTEGER,
  quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month'),
  
  -- Communication preferences
  email_marketing_opt_in BOOLEAN DEFAULT true,
  email_audit_ready BOOLEAN DEFAULT true,
  email_re_audit_reminder BOOLEAN DEFAULT true,
  
  -- BAAM Review service interest tracking (for sales follow-up)
  expressed_service_interest BOOLEAN DEFAULT false,
  expressed_service_interest_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Row Level Security and the auto-creation trigger from the original spec apply unchanged.

### 3.3 Customer journey (locked flow)

```
1. User visits baamreview.com (marketing page)
   ↓ sees value prop, social proof
   ↓ clicks "Get your free audit"
   
2. /signup
   ↓ email + password (or Google OAuth)
   ↓ name field
   ↓ submits
   
3. Email verification email sent
   ↓ user clicks link in email
   ↓ /auth/verify validates token
   ↓ redirects to /audits/new
   
4. /audits/new — Intake form
   ↓ user enters business name OR Google Maps URL
   ↓ optional: confirms vertical (auto-detected from input)
   ↓ submits
   
5. Background: audit generation triggered
   ↓ redirects to /audits/{id}/processing
   
6. /audits/{id}/processing — Wait state (5-10s)
   ↓ shows progress: locating business, finding competitors, scoring, projecting, rendering
   ↓ polls /api/audit/status?id={id} every 1s
   
7. /audits/{id} — Audit detail page (once complete)
   ↓ user sees their audit (score summary + PDF download)
   ↓ BAAM Review service upsell banner visible
   ↓ toast notification: "Your audit is ready"
   ↓ email also sent with PDF attached
   
8. /audits — Dashboard
   ↓ user can now see all their audits
   ↓ can start a new audit (subject to quota)
   ↓ BAAM Review service upsell banner persistent
```

For Google OAuth signups, step 3 (verification) is skipped — Google has already verified the email. After OAuth completion, user goes directly to step 4 (`/audits/new`).

### 3.4 Rate limiting

With no payment gate, limits become important. v1 limits:
- **2 audits per user per calendar month** (resets on month boundary)
- **5 audits per user lifetime** (prevents long-tail abuse)
- Admin can override either limit via `monthly_quota_override` / `lifetime_quota_override` on the profile

When limits are hit:
- Display message on intake form before allowing submission
- Suggest the user contact support or upgrade to BAAM Review service for unlimited audits

Rate limit check function:

```ts
export async function canUserAudit(userId: string): Promise<{
  allowed: boolean;
  reason?: 'monthly_limit' | 'lifetime_limit';
  monthly_remaining: number;
  lifetime_remaining: number;
}>
```

Increments happen atomically in `/api/audit/generate` before queuing generation. If generation fails after increment, the counters are decremented in the audit-failure handler.

### 3.5 Acceptance criteria for auth

1. Email/password signup creates `auth.users` + `profiles` rows automatically
2. Email verification email sent on signup; user can't access `/audits/*` until verified
3. Google OAuth signup works; profile populated; no verification email needed
4. Login persists across sessions via HTTP-only cookies
5. Password reset flow works end to end
6. Logout clears session
7. Middleware protects all `/audits/*` and `/account/*` routes
8. Logged-in users redirected away from `/login` and `/signup`
9. Rate limit prevents over-quota users from generating

---

## 4. Marketing Page (`/`)

The public landing page. Single CTA: "Get your free audit."

### 4.1 Sections (top to bottom)

1. **Top nav** — BAAM logo, "How it works", "Methodology", "Log in", "Get free audit" (primary CTA button)
2. **Hero** — value prop headline, sub-deck, "Get free audit" CTA button (smaller form than original — just a button, since intake is on its own page after signup)
3. **The hook** — same quote from the audit PDF: "Average businesses become popular by building reviews relentlessly. Excellent businesses become invisible because they ignore them."
4. **What you get** — 7-page audit preview, with bulleted list of contents
5. **How it works** — 3-step process (Sign up → Enter business → Receive audit)
6. **Why it's free** — explanatory section about the BAAM Review service relationship. "We give the audit free because we want you to see the work we do. If you want help acting on it, that's where BAAM Review service comes in."
7. **The methodology** — abbreviated version of baamreview.com/review-value.html highlights
8. **Social proof / testimonials** — placeholder for v1; populate after launch
9. **BAAM Review service upsell** — soft introduction: "If you want help executing the action plan, we offer..." with link to BAAM Review platform
10. **FAQ** — 5-7 common questions
11. **Footer CTA** — "Your reputation is being audited by your customers right now. The question is whether you've seen the report." + "Get free audit" button
12. **Footer** — links, copyright, etc.

### 4.2 Key differences from previous landing page design

The earlier landing page design (in `baam-review-web-ui-design.html`) had:
- A large business-input field in the hero (used to be Flow 3 — anonymous intake)
- Two-tier pricing comparison
- Pricing-focused FAQ

The new landing page has:
- A button-only CTA in the hero ("Get free audit" → goes to signup)
- No pricing comparison (single free tier)
- BAAM Review service upsell section instead
- FAQ shifts focus to the audit itself + how the service relationship works

### 4.3 Acceptance criteria for marketing page

1. Mobile-responsive
2. Loads in <2 seconds
3. "Get free audit" CTA buttons all route to `/signup`
4. "Log in" routes to `/login`
5. BAAM Review service upsell links to existing platform signup (URL TBD)
6. FAQ items expand/collapse smoothly

---

## 5. Intake Form (`/audits/new`)

Where logged-in users enter their business and trigger audit generation.

### 5.1 Form fields

```ts
interface IntakeFormFields {
  // Required
  business_input: string;                 // either business name+location OR Google Maps URL
  
  // Optional / system-detected
  vertical_override?: VerticalKey;        // user can override auto-detection
  language_preference?: 'en' | 'zh-both' | 'zh-only';  // user can override auto-detection
  
  // Acknowledgments
  acknowledged_quota: boolean;            // if user is near quota limit
}
```

### 5.2 Smart input parsing

The `business_input` field accepts multiple formats. Server-side parsing handles:

- **Google Maps URL** (e.g., `https://maps.google.com/?cid=...` or `https://www.google.com/maps/place/...`) → extract place_id directly
- **Business name + city/zip** (e.g., "Modern TCM Center Flushing NY") → use Place Text Search
- **Just business name** → attempt search, but flag low confidence

If parsing fails or returns multiple matches, the form transitions to a disambiguation step showing candidate businesses with photos.

### 5.3 Auto-detection display

After input is parsed (debounced, server-side validation), the page shows what was detected:

```
✓ Found: Modern TCM Center
  136-40 39th Ave, Flushing NY 11354
  Detected vertical: TCM / Acupuncture clinic
  Detected language: Bilingual (auto-bilingual audit)

[Generate audit]   [Not the right business?]
```

The user can override vertical or language detection before submitting.

### 5.4 Form states

- **Empty** — just the input field with placeholder text
- **Parsing** — small loading indicator after debounce
- **Found** — shows detected business + override options + Generate button
- **Not found** — shows error message + suggestions ("Try adding city/state" or "Paste Google Maps URL")
- **Multiple matches** — disambiguation list with photos
- **Quota exceeded** — message blocks submission, points to support / service upsell

### 5.5 On submission

POST to `/api/audit/generate`:
```ts
{
  business_place_id: string,
  vertical_override?: VerticalKey,
  language_preference?: string,
}
```

Server:
1. Validates user's quota
2. Creates pending `audits` row with `status: 'generating'`
3. Increments user's `audits_used_this_month` and `audits_used_lifetime`
4. Triggers background job
5. Returns `{ audit_id }` 

Client redirects to `/audits/{audit_id}/processing`.

### 5.6 Acceptance criteria for intake form

1. Business URL paste works (Google Maps URL → place_id extraction)
2. Business name + location text search works
3. Disambiguation flow handles multiple matches
4. Vertical override option works
5. Language override option works (EN-only, ZH-only, or both)
6. Quota check prevents submission when exceeded
7. Submission successfully triggers generation and redirects to processing page

---

## 6. Generating Page (`/audits/{audit_id}/processing`)

Same as in the original spec — editorial progress indicator polling for completion. Five named stages:

1. Located your business on Google
2. Identified 5 local competitors
3. Calculating your BAAM Review Score
4. Projecting your 6-month trajectory
5. Generating your PDF

Each stage transitions from pending → active → done with visual indicators. Polling at 1-second intervals. On completion, redirect to `/audits/{audit_id}`.

If generation fails: redirect to `/audits/{audit_id}` which shows a failure state with retry option and decremented quota (refund the audit attempt).

---

## 7. Dashboard (`/audits`)

The user's home page. Shows all their audits + ability to start new ones.

### 7.1 Page structure

```
[Top nav with logo, dashboard, account, logout]

[Dashboard header]
  "Your reputation audits · Vol. I"
  "{N} audits, ready to review"
  [+ New Audit] button
  
[BAAM Review service banner — persistent, dismissable per session]
  "Ready to act on your audit? BAAM Review service handles the work."
  [Learn more →]
  
[Audit list]
  For each audit:
    - Business name + secondary name (Chinese name if applicable)
    - Location + vertical
    - Date audited
    - Audit ID
    - Score + grade
    - "Download PDF" buttons (EN and/or ZH)
    - "View details" link → /audits/{id}
  
  For in-progress audits:
    - Same business info
    - Progress bar with current stage label
    - "Cancel" option if stuck >2 minutes

[Empty state — only shown if zero audits]
  "Start with your first audit"
  Embedded intake form
```

### 7.2 BAAM Review service upsell banner

Persistent banner above the audit list. Different copy based on user state:

- **New user (1 audit, score < 70):** "Your score is {grade}. BAAM Review service can take this from {current_score} to 85+ in 90 days."
- **New user (1 audit, score ≥ 70):** "You're already above average. BAAM Review service helps you stay there."
- **Returning user (multiple audits):** "Multiple businesses? BAAM Review service handles all of them on one platform."
- **Generic:** "Stop checking. Let us handle review collection, response, and reporting."

User can dismiss banner per session; dismissal stored in localStorage. Server-side flag if they click "Learn more" or "Not interested" to track interest signals for sales follow-up.

### 7.3 Quota visibility

Small text near the new audit button:
- "2 of 2 monthly audits used · resets June 1"
- "1 of 2 monthly audits used"
- "Quota exceeded · contact support for more"

Generous default keeps this from feeling restrictive.

### 7.4 Acceptance criteria for dashboard

1. Lists all user's audits, newest first
2. In-progress audits show live status
3. Failed audits show retry option
4. PDF downloads work (signed URL or stream)
5. BAAM Review service banner displays appropriate copy
6. Quota status visible
7. Empty state shown when user has zero audits
8. Mobile-responsive

---

## 8. Audit Detail Page (`/audits/{audit_id}`)

For v1, this is a **simple delivery page** — not the full interactive web audit (which is deferred to a future session).

### 8.1 Content

```
[Top nav]

[Audit header]
  Business name
  Date audited · Audit ID · Status badge
  
[Score summary card — prominent]
  Large score number
  Grade letter
  One-line diagnosis
  
[PDF download section]
  [Download EN PDF] button (always)
  [Download ZH PDF] button (only for bilingual audits)
  Share link (copy-to-clipboard)
  
[BAAM Review service upsell — large card]
  "Your audit identified 5 specific actions. We can do them for you."
  Self-Serve $99/mo / Full Service $399/mo options
  [Learn more →]
  
[Re-audit option]
  "Re-audit this business" button — disabled until 30 days after this audit
  
[Back to dashboard link]
```

### 8.2 Future enhancement (deferred)

The full interactive web audit — a scrollable HTML version of the PDF with hover states, expandable sections, and interactive charts — is a future feature. For Session 10, the audit detail page is the simple delivery layout above. When the interactive web audit ships (future session, possibly 8B refresh), the audit detail page transforms into the full interactive experience with the score summary card still prominent at the top.

### 8.3 Acceptance criteria for audit detail

1. Score and grade displayed correctly
2. PDF downloads work for available languages
3. Share link copyable to clipboard
4. Re-audit button enabled after 30 days
5. BAAM Review service upsell prominent

---

## 9. Account Settings (`/account`)

Same structure as the original spec. Sections:

1. **Profile** — name, email (with verification for email change), preferred language
2. **Email preferences** — marketing opt-in, audit-ready emails, re-audit reminders
3. **Security** — change password, sign out all devices
4. **Danger zone** — delete account (soft delete, anonymize audit records)

No payment-related sections (no billing, no subscription, no invoices).

---

## 10. Transactional Emails

Simplified set (no payment confirmation):

| Email | Trigger | Subject (EN) |
|---|---|---|
| Welcome | After email verification | Welcome to BAAM Review |
| Email verification | On signup | Verify your email — BAAM Review |
| Password reset | User requests reset | Reset your password — BAAM Review |
| Audit ready | Audit completes successfully | Your BAAM Review Audit is ready |
| Audit failed | Generation fails (rare) | We had trouble with your audit |
| Re-audit available | 90 days after audit | Time for your 90-day re-audit |
| Quota reset (optional) | New month, quota refilled | Your monthly audits have refilled |

Each email has EN and ZH versions; selection per user's `preferred_language`. For audit-ready emails on bilingual businesses, send a bilingual email with both PDFs attached.

### 10.1 Audit-ready email content

Critical conversion moment. Email body includes:

```
Subject: Your BAAM Review Audit for {business_name} is ready

[Editorial header: "BAAM · Review Audit"]

Your audit for {business_name} is complete.

Quick summary:
- Score: {total_score}
- Grade: {grade}
- Diagnosis: "{grade_diagnosis}"

The full 7-page audit is attached as a PDF.

The audit identifies 5 specific actions to take in the next 12 months.
If you'd like help executing them, BAAM Review service is built exactly for this:

[Self-Serve $99/mo button]   [Full Service $399/mo button]

You can also view your audit anytime at:
{dashboard_url}

— BAAM Studio
```

For bilingual audits, this template repeats in Chinese below the English version with both PDFs attached.

---

## 11. BAAM Review Service Upsell

The upsell appears in three places:

### 11.1 In the audit PDF (already designed)

The existing audit PDF ends with the two-path CTA: Self-Serve ($99/mo) vs Full Service ($399/mo). No change needed.

### 11.2 In the audit-ready email

The conversion-critical placement. Two buttons in the email body, prominently placed below the score summary. Click takes the user to BAAM Review service signup page (existing system, URL TBD — likely baamreview.com/service/signup or similar).

### 11.3 On the dashboard

Persistent banner above the audit list. Conditional copy based on user state (see §7.2). Dismissable per session.

### 11.4 What Session 10 does NOT implement

- BAAM Review service signup flow
- BAAM Review service billing (no Stripe in Session 10)
- BAAM Review service onboarding
- The actual review-management platform features

These all live in the existing BAAM Review platform (or future Session 13). Session 10 just drives traffic to them.

---

## 12. Data Schema Changes from Original Spec

### Tables removed (or feature-flagged off)
- `paid_audit_purchases` — was for Stripe gating; no longer needed in v1. If implemented per original spec, keep with `is_active: false` flag or feature-flag the related code.

### Tables modified
- `audits` table loses `tier` field — single tier customer-facing. Internally the engine still uses `tier`; the audits table can record what tier was used internally for analytics (always `'paid'` for customer-initiated audits in v1).
- `profiles` table adds quota tracking fields (see §3.2)

### Tables added
- None new beyond original spec minus payment tables

---

## 13. Implementation Order (sub-phases)

Same 5 sub-phases as original spec, with payment-related work removed:

### 10A · Auth foundation (3 Claude Code sessions)
1. Supabase Auth setup
2. `profiles` table + trigger + quota fields
3. Signup, login, password reset pages
4. Email verification flow
5. Middleware

**Ship gate:** users can sign up, log in, log out. Empty dashboard accessible.

### 10B · Intake + audit generation (2-3 sessions)
1. Intake form with smart business input parsing
2. Generation API + background job orchestrator
3. Processing wait page with polling
4. Welcome + audit-ready emails
5. Rate limiting

**Ship gate:** users can request audit and receive PDF via email.

### 10C · Dashboard + audit detail (2 sessions)
1. Dashboard with audit list
2. Audit detail page (simple delivery layout)
3. BAAM Review service upsell banners
4. PDF download flow
5. Quota visibility

**Ship gate:** users have full self-serve experience.

### 10D · Account + polish (1-2 sessions)
1. Account settings
2. Email preferences
3. Re-audit reminders
4. Failure states + retry flows
5. Mobile responsiveness pass

**Ship gate:** product is launchable.

### 10E · Marketing page (1-2 sessions)
1. Marketing landing page implementation from design HTML
2. About / methodology pages
3. FAQ component
4. Analytics events
5. SEO + meta tags

**Ship gate:** baamreview.com publicly promotes the audit.

**Total: 9-12 Claude Code sessions over 3-4 weeks.** Fewer than the original (no Stripe work, no payment UX, no webhook handling).

---

## 14. Risk Considerations

Three risks specific to the no-Stripe model:

**Risk 1: Free abuse.**
Without payment, malicious users could create many accounts. Mitigations:
- Email verification required before any audit
- Rate limits (2/month, 5/lifetime) baked in
- Reject disposable email domains at signup (use a list)
- Monitor for IP-based abuse patterns
- Admin can ban accounts and reset quotas

**Risk 2: Outscraper / Google API costs run away.**
Without paid users to offset costs, every audit costs BAAM money (~$2-5 in API fees). At 100 audits/day, that's $200-500/day in pure cost. Mitigations:
- The 5-audit lifetime limit caps per-user damage
- Daily ceiling per IP (e.g., 10 audits)
- Daily ceiling overall (e.g., 200 audits site-wide) with admin alert
- Outscraper has prepaid balance — set up balance alerts

**Risk 3: Low BAAM Review service conversion.**
The whole funnel logic depends on audit → service conversion. If conversion is poor:
- Sharpen the audit's action-plan section (specifically point to service)
- A/B test different upsell positioning
- Add a sales-call request mechanism for warm leads
- Consider sales-driven outreach for high-score-improvement-opportunity leads

These risks are post-launch concerns. Session 10 just needs to ship with reasonable defaults; calibration comes from real data.

---

## 15. What's Left After Session 10

After Session 10 ships, the audit is live and generating leads.

The remaining sessions are optional:

- **Session 2** — Multi-platform (Yelp/Zocdoc/Healthgrades/Facebook). Updated spec acknowledges Outscraper Yelp Search doesn't work; uses Google-search-to-find-Yelp-URL workaround. Worth shipping after launch when you see which platforms customers care about.

- **Session 7** — AI sentiment + theme extraction. The premium differentiator. May or may not be free; could be the basis of a reintroduced paid tier.

- **Session 8 refresh** — Interactive web audit (the full audit rendered as a scrollable HTML page, not just a PDF). Major product enhancement. Replaces the simple audit detail page with a real interactive experience.

- **Session 13** — Full Service onboarding integration. Automate audit → Full Service customer handoff.

- **Future: Re-introduce paid tier.** When BAAM Review service is generating revenue, you may decide to charge for the audit itself (e.g., $99 or $299) to: (a) qualify leads, (b) cover API costs, (c) increase audit perceived value. The Stripe code (if kept feature-flagged) can be reactivated at that point.

---

## Appendix · Differences vs. Original Session 10 Spec

For Claude Code reference if cross-checking the older spec:

| Section | Original spec | This spec |
|---|---|---|
| Tiers | Free 3-page + Paid 7-page | Single Free 7-page |
| Payment | Stripe Checkout + Webhooks | None |
| `resolveTier` function | Returns 'free' or 'paid' from purchase state | Always returns 'paid' in v1; kept for future use |
| `paid_audit_purchases` table | Required | Feature-flagged off; not needed in v1 |
| Quota system | Implicit (paid customers unlimited per business) | Explicit rate limits (2/month, 5/lifetime) |
| Upsell endpoint | Stripe Checkout to $299 paid audit | BAAM Review service ($99/$399/mo) |
| Pricing page | Comparison table | Removed (no pricing) — or simplified to "Currently free" page |
| Customer journey | Marketing → Signup → Free audit → Upgrade flow | Marketing → Signup → Audit (already full) → BAAM Review service upsell |
| Customer-facing tier visibility | Yes | No (single tier presented) |

Implementation can reuse anything Stripe-related already built per the original spec, but it must be feature-flagged off until intentionally reactivated.
