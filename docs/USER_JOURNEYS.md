# BAAM Review — User Journeys

Snapshot of the post-signup / login flows as they exist today. Use this as
the shared reference when changing any of the entry points (marketing CTAs,
`/signup`, `/login`, dashboard plan-picker, onboarding bar, billing). If you
change behavior, update this file in the same PR.

---

## Core rule: plan-picker vs. journey bar on the dashboard

The dashboard (`/app`) has two mutually-exclusive guidance widgets at the
top of the page. Which one shows is decided by the user's saved
`account.review_plan`:

| `account.review_plan` | Widget shown on `/app` |
|---|---|
| `null` (no plan picked yet) | **Plan-picker** — Self-Service vs. Full Service cards. Picking writes `review_plan` and morphs into the journey bar. |
| `self_service` or `full_service` | **Journey bar** — plan-tailored "Getting started" 3-step progress. |
| set, but user is established (any review request ever sent) | Neither — clean dashboard. |

This means the dashboard guidance is always plan-appropriate. The bar never
defaults to the wrong plan because the user has to explicitly pick before
the bar appears.

---

## 1. First-time user, picks a plan on marketing home or audit/service

**Entry:** Clicks `Start Self-Serve trial →` or `Start Full Service trial →`
from `/` or `/audit/service`.

1. → `/signup?plan=self` (or `full`) → signup form rendered with that plan
   baked into `user_metadata.preferred_plan`
2. Submit → "Confirm your email" screen (Supabase sends confirmation link)
3. Click email link → `/auth/callback` (server route exchanges code, sets
   session cookies, redirects)
4. Lands on `/app` → dashboard auto-applies `preferred_plan` →
   `account.review_plan` (`app/app/page.tsx`)
5. **Plan is set → journey bar appears immediately** (no plan-picker step,
   they already chose):

| Self-Serve bar | Full Service bar |
|---|---|
| 1. Connect Google location → OAuth | 1. Set up billing → Stripe trial checkout |
| 2. Set up billing | 2. BAAM connects your GBP (passive — waits on staff) |
| 3. Start Review Request | 3. Start Review Request |

6. **Self-Serve:** click Step 1 → Google OAuth → picker → "Use this
   location" → location row created. Bar advances to Step 2. User sets up
   billing for that location from `/app/billing` (per-row "Set up billing"
   prompts on that page).
7. **Full Service:** click Step 1 → Stripe trial checkout → returns to
   `/app/billing?status=success&session_id=…` → reconcile sets
   `account.subscription_status = trialing` + welcome email + team
   notification → bar advances to 2/3. User waits while BAAM staff
   connects their GBP. When staff connects it, bar advances to 3/3.
8. Click Step 3 ("Start Review Request →") OR send any actual review
   request → bar hides permanently (established account).

---

## 2. First-time user, no plan picked (just signs up)

**Entry:** Clicks `Sign in` → bottom of form → `Create account`, OR types
`/signup` directly. No `?plan=` query param.

1. Signs up with name / email / password — no plan choice made yet.
2. Email confirm → lands on `/app` (dashboard).
3. **On the dashboard, two service plans are shown** for the user to
   choose: Self-Service or Full Service.
4. **User picks one** → the onboarding bar appears at the top of the
   dashboard, tailored to the chosen plan.
5. From here, the flow is identical to **Journey 1 from step 5 onward** —
   same bar, same per-plan CTAs (Connect GBP / Set up billing / Start
   Review Request), same Stripe checkout and GBP-connect paths.

*Implementation note:* the picker is the same `PlanChooser` used on
`/app/billing`; both write to `account.review_plan`. So a user who scrolls
past the dashboard picker and goes straight to `/app/billing` still gets
the same prompt.

---

## 3. Returning user, no locations yet

**Entry:** Logs in via `/login` → defaults to `/app` (no `next` override).

1. Dashboard renders. Two sub-cases:

   **3a. Plan already picked in a prior session:**
   - `review_plan` is set → **journey bar appears** at the position
     they're at:
     - Self-Serve → Step 1 active: "Connect Google location"
     - Full Service + no billing → Step 1 active: "Set up billing"
     - Full Service + billing live → Step 2 active: "BAAM connects your
       GBP" (passive — waiting on staff)

   **3b. No plan ever picked:**
   - `review_plan` is `null` → **plan-picker appears** (same as Journey 2).
   - After they pick, journey bar takes over.

2. Sidebar shows `Connect a new location`, `Manage all locations`, etc. —
   most items always visible. Exception:
   - For Full Service users, `Connect a new location` is hidden. BAAM
     staff connects GBPs for them; the picker page redirects them away
     anyway, so the menu item is just a trap.

---

## 4. Returning user with at least one location

**Entry:** Login → `/app`.

1. The "established" signal triggers as soon as the account has sent
   any review request → onboarding bar AND plan-picker are both
   hidden (`getOnboardingStatus().showBar === false`).
2. Full dashboard renders:
   - Greeting with `account.name · Self-Service plan · trial` (or whichever
     plan/status)
   - Revenue strip
   - Service Recovery Alert (if low-rating reviews / unread feedback)
   - Funnel card, AI Reply queue, Share-a-review preview, Recent activity
   - Referrals card, Best advocates
3. Sidebar is their main navigation.
4. Per-location nudges still appear where relevant — e.g., the
   `/app/billing` table shows "Set up billing →" on any location without a
   sub, and `/app/locations` shows the same. So an established customer
   adding a second location gets prompted there, not on the dashboard bar.

---

## Cross-cutting notes

- **Email not confirmed** → Supabase blocks `signInWithPassword` with "Email
  not confirmed". User goes back to the signup confirm-email screen (with
  the "Send email again" option).
- **Plan switch after the fact** → Re-clicking a different plan on
  `/audit/service`, marketing home, OR the dashboard plan-picker routes
  through `/signup?plan=…` (for the first two) or a direct server action
  (for the dashboard picker). Both always overwrite `review_plan`.
  Subscription itself (Stripe) is separate; they'd manage that on
  `/app/billing` if they're already paying.
- **BAAM internal staff** (`accounts.is_baam_internal`) see an extra "BAAM
  Operations" sidebar section: Customers (`/app/customers`), Onboarding
  queue (`/app/onboarding`), Admin Staff (`/app/admin/staff`).
- **Full Service email after payment** → `handleStartNowCheckoutSession`
  writes a `customer_records` row + emails the customer the "add
  `baamplatform@gmail.com` as Manager" instructions. Fires from BOTH the
  Stripe webhook AND the post-checkout reconcile (so it's not lost when
  webhooks are delayed/missed).
- **Billing self-heals** on every `/app/billing` visit via
  `reconcileAccountSubscriptions` — picks up any portal-driven cancel /
  card update / plan change that happened outside the app.

---

## Key files

| Concern | File |
|---|---|
| Marketing home (signed-in slot, plan CTAs) | `app/page.tsx`, `public/marketing-home.html` |
| Audit-service tier CTAs | `app/audit/service/page.tsx` |
| Signup (plan apply, signed-in redirect) | `app/signup/page.tsx`, `components/auth/signup-form.tsx` |
| Login (signed-in redirect default) | `app/login/page.tsx` |
| Auth callback (PKCE / OTP) | `app/auth/callback/route.ts` |
| Dashboard + plan-picker / journey bar slot | `app/app/page.tsx` |
| Plan-picker component (shared with billing) | `app/app/billing/billing-client.tsx` (`PlanChooser`) |
| Onboarding journey bar | `app/app/onboarding-progress.tsx` |
| Onboarding flag computation | `lib/onboarding/status.ts` |
| Activate Step 3 server action | `app/app/actions/onboarding.ts` |
| Billing page (PlanChooser, reconciles) | `app/app/billing/page.tsx` |
| Stripe checkout endpoints | `app/api/billing/start-selfservice/route.ts`, `app/api/billing/start-fullservice/route.ts` |
| Stripe webhook + reconcile | `app/api/webhooks/stripe/route.ts`, `lib/billing/sync.ts` |
| Full Service welcome email + customer_record | `lib/billing/start-now.ts` |
| GBP picker (Connect a new location) | `app/app/locations/connect/picker/page.tsx` |
| Sidebar (per-plan visibility) | `components/admin/nav-sidebar.tsx` (or wherever `Connect a new location` is rendered) |
| Send page Gmail sender editor | `app/app/send/gmail-sender-editor.tsx`, `app/app/send/actions.ts` |
