# BAAM Review — User Journeys

Snapshot of the post-signup / login flows as they exist today. Use this as
the shared reference when changing any of the entry points (marketing CTAs,
`/signup`, `/login`, onboarding bar, billing). If you change behavior, update
this file in the same PR.

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
5. Onboarding bar appears, plan-tailored:

| Self-Serve bar | Full Service bar |
|---|---|
| 1. Connect Google location → OAuth | 1. Set up billing → Stripe trial checkout |
| 2. Set up billing | 2. BAAM connects your GBP (passive — waits on staff) |
| 3. Start Review Request | 3. Start Review Request |

6. **Self-Serve:** click Step 1 → Google OAuth → picker → "Use this location"
   → location row created. **Bar disappears** (because `hasLocation` is now
   true). User then sets up billing for that location from `/app/billing`
   (per-row "Set up billing" prompts there).
7. **Full Service:** click Step 1 → Stripe trial checkout → returns to
   `/app/billing?status=success&session_id=…` → reconcile sets
   `account.subscription_status = trialing` + welcome email + team
   notification → bar advances to 2/3. User waits while BAAM staff
   connects their GBP. When staff connects it, `hasLocation` flips to true
   → **bar disappears**.

---

## 2. First-time user, no plan picked (just signs up)

**Entry:** Clicks `Sign in` → bottom of form → `Create account`, OR types
`/signup` directly.

1. Signup form has no `preferredPlan` → user only enters name/email/password
2. Email confirm → `/app`
3. `account.review_plan` stays `null`
4. Onboarding bar appears with **no plan suffix** in the eyebrow, defaults
   to **Self-Serve step order** (Connect location → Set up billing → Start
   Review Request)
5. User can either:
   - Click Step 1 to connect a GBP first (and stay on the Self-Serve path
     implicitly), OR
   - Click the sidebar `Billing` → `/app/billing` where the `<PlanChooser>`
     lets them pick Self-Serve or Full Service explicitly

After they pick a plan on billing, `review_plan` is set and the bar's
eyebrow + step order update accordingly.

---

## 3. Returning user, no locations yet

**Entry:** Logs in via `/login` → defaults to `/app` (no `next` override).

1. Dashboard renders with the onboarding bar (because `hasLocation` is false)
2. Bar variant depends on their saved `review_plan`:
   - **Self-Serve** → Step 1 active: "Connect Google location"
   - **Full Service + no billing** → Step 1 active: "Set up billing"
   - **Full Service + billing live** → Step 2 active: "BAAM connects your
     GBP" (waiting state, no CTA)
   - **No plan** → Self-Serve default order, no plan suffix
3. They continue from wherever they left off

Sidebar shows `Connect a new location`, `Manage all locations`, etc. — all
available — but the bar's CTA is the most prominent next-action prompt.

---

## 4. Returning user with at least one location

**Entry:** Login → `/app`.

1. `hasLocation` is true → **onboarding bar is hidden** (intentional design
   — the bar is a Getting-Started guide only; established users see a clean
   dashboard)
2. Full dashboard renders:
   - Greeting with `account.name · Self-Service plan · trial` (or whichever
     plan/status)
   - Revenue strip
   - Service Recovery Alert (if low-rating reviews / unread feedback)
   - Funnel card, AI Reply queue, Share-a-review preview, Recent activity
   - Referrals card, Best advocates
3. They work normally. Sidebar is their navigation.
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
  `/audit/service` or marketing home routes through `/signup?plan=…` which
  always overwrites `review_plan`. Subscription itself (Stripe) is
  separate; they'd manage that on `/app/billing` if they're already paying.
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
| Dashboard + auto-apply preferred_plan | `app/app/page.tsx` |
| Onboarding bar (plan-tailored steps, CTAs) | `app/app/onboarding-progress.tsx` |
| Onboarding flag computation | `lib/onboarding/status.ts` |
| Activate Step 3 server action | `app/app/actions/onboarding.ts` |
| Billing page (PlanChooser, reconciles) | `app/app/billing/page.tsx` |
| Stripe checkout endpoints | `app/api/billing/start-selfservice/route.ts`, `app/api/billing/start-fullservice/route.ts` |
| Stripe webhook + reconcile | `app/api/webhooks/stripe/route.ts`, `lib/billing/sync.ts` |
| Full Service welcome email + customer_record | `lib/billing/start-now.ts` |
| GBP picker (Connect a new location) | `app/app/locations/connect/picker/page.tsx` |
| Send page Gmail sender editor | `app/app/send/gmail-sender-editor.tsx`, `app/app/send/actions.ts` |
