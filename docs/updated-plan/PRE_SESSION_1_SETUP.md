# BAAM Review — Pre-Session 1 Manual Setup

**Version:** 2.0
**Purpose:** Things YOU (John) must do by hand before Claude Code Session 1 can begin.
**Estimated time:** 2–3 hours, spread across 1–2 days (some items have wait periods)

---

## How to use this checklist

Work top to bottom. Some items unblock others (Supabase has to exist before you can grab keys; A2P 10DLC has to be filed days before you actually need SMS). The brief assumes everything below is **done and verified** before you paste `SESSION_1_BRIEF.md` into Claude Code.

Items marked **🔴 Blocker** must be complete to start Session 1. Items marked **🟡 Async** can be filed now and will finish during/after Session 1 (they have multi-day wait periods). Items marked **🟢 Defer** are optional — you can do them later when their session arrives.

---

## 1. Domain & DNS

### 🔴 1.1 Configure the subdomain CNAME
- [ ] Log into your DNS provider for `baamplatform.com`
- [ ] Create a CNAME record:
  - **Host:** `review`
  - **Target:** `cname.vercel-dns.com`
  - **TTL:** 300 (5 minutes) so any iteration is fast during launch
- [ ] Verify with `dig review.baamplatform.com CNAME +short` — should return `cname.vercel-dns.com`
- [ ] **Do NOT** point the apex `baamplatform.com` to Vercel — that's `baam.baamplatform.com`'s job

**Why this matters:** Vercel won't issue SSL until DNS resolves. If the CNAME isn't live when Gate 4 runs, the production deploy fails on the domain attach step. Configure this first; DNS propagation can take 5–60 minutes.

### 🟢 1.2 Defer: Email DNS records (Resend)
You'll add SPF, DKIM, and DMARC records for `review.baamplatform.com` in Session 4 when Resend wires up. Don't do this now — it's premature and the records are issued during Resend onboarding.

---

## 2. Supabase

### 🔴 2.1 Create a new Supabase project
- [ ] Log into https://supabase.com/dashboard
- [ ] Create new project:
  - **Name:** `baam-review-prod`
  - **Region:** US East (N. Virginia) — same as Vercel default
  - **Database password:** generate strong, store in 1Password under `BAAM Review · Supabase DB`
  - **Pricing plan:** Pro tier ($25/mo) — required for daily backups, point-in-time recovery, and connection pooling at production scale
- [ ] Wait ~2 minutes for provisioning
- [ ] Save the following to 1Password under `BAAM Review · Supabase Keys`:
  - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public key)
  - `SUPABASE_SERVICE_ROLE_KEY` (service role — **server-only, never to a client**)

### 🔴 2.2 Configure auth providers
- [ ] In Supabase dashboard → **Authentication → Providers**:
  - **Email**: enabled, "Confirm email" on, "Secure email change" on
  - **Google**: enabled (Client ID + secret from step 3.2 below)
- [ ] **Site URL**: `https://review.baamplatform.com`
- [ ] **Redirect URLs**: add
  - `https://review.baamplatform.com/auth/callback`
  - `http://localhost:3000/auth/callback` (for local dev)
- [ ] **Email templates**: leave default for Session 1; Resend takes over in Session 4

### 🔴 2.3 Configure the local Supabase CLI for migration testing
- [ ] `brew install supabase/tap/supabase`
- [ ] `supabase login` (browser auth flow)
- [ ] From repo root: `supabase link --project-ref <your-project-ref>` (the part of the project URL before `.supabase.co`)
- [ ] Verify: `supabase projects list` shows `baam-review-prod`

**Why:** Claude Code's Gate 2 runs `npx supabase db reset` against a **local** Supabase instance to validate the migration. The cloud project doesn't run migrations directly until the agent pushes the verified migration.

### 🟡 2.4 Optional but recommended: Set up a staging project
- [ ] Create a second Supabase project: `baam-review-staging`
- [ ] Same region, smaller Free tier is fine for staging
- [ ] Save keys under `BAAM Review · Supabase Staging`

You'll wire staging in Session 12 when CI/CD properly lands. Don't worry about it now.

---

## 3. Google Cloud (OAuth + later Business Profile API)

### 🔴 3.1 Reuse the existing baam-platform GCP project
You already have a Google Cloud project for BAAM Platform with the `auth/business.manage` scope approved. **Reuse it** for BAAM Review — don't create a new one. The OAuth verification process takes weeks and you already passed it.

- [ ] Log into https://console.cloud.google.com
- [ ] Switch to the `baam-platform` project (or whatever it's named in your console)
- [ ] Confirm the project is still in "Published" status under **APIs & Services → OAuth consent screen**
- [ ] Confirm the `https://www.googleapis.com/auth/business.manage` scope is still in the verified scopes list

### 🔴 3.2 Add a new OAuth client for BAAM Review
- [ ] Navigate to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
- [ ] **Application type:** Web application
- [ ] **Name:** BAAM Review
- [ ] **Authorized JavaScript origins:**
  - `https://review.baamplatform.com`
  - `http://localhost:3000`
- [ ] **Authorized redirect URIs:**
  - `https://review.baamplatform.com/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `https://<your-supabase-ref>.supabase.co/auth/v1/callback` (Supabase's OAuth callback)
- [ ] Save the **Client ID** and **Client secret** to 1Password under `BAAM Review · Google OAuth`
- [ ] Paste the Client ID + secret into Supabase → Authentication → Providers → Google

### 🟢 3.3 Defer: Google Business Profile API enablement check
This already exists on the baam-platform project. Skip until Session 6 (GBP review fetching). If you want to be thorough, you can verify it's enabled now under **APIs & Services → Enabled APIs** and search for "Business Profile" — but it's not blocking Session 1.

---

## 4. GitHub

### 🔴 4.1 Create the codebase folder structure
You're working inside an existing monorepo. The agent will create `clients/baam-review/` during Gate 1, but the parent folder must exist and be writeable.

- [ ] `cd ~/dev/baam-monorepo` (or wherever your monorepo lives)
- [ ] Confirm `clients/` exists alongside `baam`, `baam-local`, `Baam-Utilities`
- [ ] Confirm the repo has a clean working tree: `git status` shows no uncommitted changes
- [ ] Create a feature branch for Session 1: `git checkout -b feature/baam-review-session-1`

### 🔴 4.2 Confirm Vercel can access the repo
- [ ] Log into https://vercel.com/dashboard
- [ ] Under **Account Settings → Integrations**, confirm GitHub is connected and your monorepo is accessible
- [ ] **Do NOT create the Vercel project yet** — Claude Code creates it during Gate 4 with the correct root directory setting

---

## 5. Stripe (placeholders for Session 7)

### 🟡 5.1 Pre-create your Stripe account + products
This isn't blocking, but if you do it now, Session 7 goes faster. You'll need the product IDs and price IDs anyway.

- [ ] Confirm you have a Stripe account at https://dashboard.stripe.com
- [ ] Test mode + Live mode are both fine for Session 1; switch to Live before launch
- [ ] Create the following **Products** with **Prices** (Live mode):

**Product: BAAM Review Starter**
- Price 1: $49/mo USD, monthly recurring, metadata `tier=starter`, `billing=monthly`
- Price 2: $470/yr USD ($39.17/mo equivalent), yearly recurring, metadata `tier=starter`, `billing=yearly`
- Price 3 (founding): $39/mo USD, monthly recurring, metadata `tier=starter`, `billing=monthly`, `founding=true`

**Product: BAAM Review Growth**
- Price 1: $99/mo USD, monthly recurring, metadata `tier=growth`, `billing=monthly`
- Price 2: $950/yr USD ($79.17/mo equivalent), yearly recurring, metadata `tier=growth`, `billing=yearly`
- Price 3 (founding): $89/mo USD, monthly recurring, metadata `tier=growth`, `billing=monthly`, `founding=true`

**Product: BAAM Review Agency**
- Price 1: $499/mo USD, monthly recurring, metadata `tier=agency`, `billing=monthly`
- Price 2: $4,790/yr USD ($399.17/mo equivalent), yearly recurring, metadata `tier=agency`, `billing=yearly`
- Price 3 (founding): $249/mo USD, monthly recurring, metadata `tier=agency`, `billing=monthly`, `founding=true`

- [ ] Save all nine Price IDs in 1Password under `BAAM Review · Stripe Prices`
- [ ] **Do NOT enable the founding prices for general checkout** — those get assigned manually to the first 50 paid signups via Stripe's API in a Session 7 admin-only path

### 🟡 5.2 Set up Stripe webhook endpoint placeholder
- [ ] In the Stripe dashboard → **Developers → Webhooks → Add endpoint**
- [ ] **Endpoint URL:** `https://review.baamplatform.com/api/webhooks/stripe`
- [ ] **Events:** `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [ ] Save the **Signing secret** to 1Password under `BAAM Review · Stripe Webhook`
- [ ] The endpoint will 404 until Session 7 — that's expected. Stripe retries on its own.

---

## 6. Twilio (SMS — file the A2P 10DLC NOW)

### 🟡 6.1 A2P 10DLC registration — start this TODAY
US SMS requires carrier registration. Approval takes **2–4 weeks**. If you start this on Session 1 day, it'll be live in time for Session 4 (when SMS sending wires up). If you wait, Session 4 ships and you can't actually send SMS.

- [ ] Sign up at https://www.twilio.com if you don't have an account
- [ ] In console → **Messaging → Compliance Hub → A2P 10DLC**:
  - **Brand registration**: register BAAM Studio LLC as the brand
    - Brand name: BAAM Studio
    - Use case: Mixed (a.k.a. multi-purpose)
    - Vertical: Technology
    - EIN: (your EIN)
- [ ] **Campaign registration**:
  - Campaign use case: Customer Care / Account Notification
  - Campaign description: "Review request notifications sent to existing customers of our SMB clients (acupuncture clinics, law firms, restaurants) on behalf of the SMB. One message per visit, opt-out via STOP."
  - Sample message: `Hi {{name}}, thanks for visiting {{business}}. Would you mind sharing your experience? It takes about a minute: {{link}}. Reply STOP to opt out.`
- [ ] Save the Account SID and Auth Token to 1Password under `BAAM Review · Twilio`
- [ ] **Estimated cost:** ~$4 brand registration one-time + $10/mo per campaign + $0.0075 per SMS segment

**Why this matters:** Twilio will throttle unregistered traffic to ~1 message/second and many carriers reject it outright. The product cannot ship at scale without 10DLC approval.

### 🟢 6.2 Defer: Provision a Messaging Service
You'll provision a Messaging Service with a long-code number in Session 4. Don't do this now — it costs ~$1/mo while sitting unused.

---

## 7. Resend (Email — defer to Session 4)

### 🟢 7.1 Defer
Resend setup is fast (~30 min) and the API key is short-lived (it's safer to provision close to actual usage). Wait for Session 4. **Do not** provision the domain or API key now.

---

## 8. Anthropic (AI drafting — defer to Session 5)

### 🟢 8.1 Defer
You likely have an Anthropic API key for other BAAM products. Reuse it for BAAM Review when Session 5 wires AI drafting. Don't provision a new one now.

---

## 9. Local development environment

### 🔴 9.1 Node + package manager
- [ ] Node 20.x installed: `node -v` should show `v20.x.x`
- [ ] npm 10.x: `npm -v` should show `10.x.x` (ships with Node 20)
- [ ] Don't use pnpm or yarn — Claude Code Session 1 brief specifies npm

### 🔴 9.2 Supabase CLI installed
- [ ] Already covered in 2.3 above. `supabase --version` should show `>= 1.150.0`

### 🟢 9.3 Optional helpers
- [ ] `vercel` CLI: `npm i -g vercel` — useful for triggering deploys manually but Session 1 uses the dashboard
- [ ] `ngrok` or `cloudflared` — only needed for testing Stripe webhooks locally in Session 7

---

## 10. The prototypes — copy them in

### 🔴 10.1 Copy the eight HTML prototypes into the codebase
The agent needs these as design reference. Put them somewhere the agent will discover them during Gate 1.

- [ ] Download from `/mnt/user-data/outputs/`:
  - `01-marketing-home.html`
  - `02-marketing-pricing.html`
  - `03-admin-dashboard.html`
  - `04-admin-send-request.html`
  - `05-review-questions.html`
  - `06-review-ai-draft.html`
  - `07-review-thankyou.html`
  - `08-staff-mode.html`
- [ ] Move them to `~/dev/baam-monorepo/clients/baam-review/_prototypes/` (the agent will create this folder during Gate 1, but copying them in advance speeds things up)

### 🔴 10.2 Copy the master plan and session brief
- [ ] Download `BAAM_REVIEW_MASTER_PLAN.md` from outputs
- [ ] Download `SESSION_1_BRIEF.md` from outputs
- [ ] Stage them somewhere you can paste from — desktop is fine. The session brief gets pasted into the **first** Claude Code prompt; the master plan stays as a reference document.

---

## 11. Founding customer pre-launch list

### 🟡 11.1 Build the day-one outreach list
This isn't blocking Session 1, but you want it ready by the time you ship v1 (end of Session 12, ~10–12 weeks out). Start gathering names now.

- [ ] Open a Notion or Airtable list called **BAAM Review · Founding 50**
- [ ] Add the columns: Name, Business, Vertical, Existing BAAM Studio client (Y/N), Language, Email, Phone, Status (Cold / Warm / Yes / No), Outreach date, Activated date, Plan tier
- [ ] Pre-populate with:
  - Your existing BAAM Studio clients first — they're the warmest leads and the strongest case study fodder
  - Dr. Huang Clinic (confirmed reference client throughout v2.0 design)
  - Acu-Flushing and Acu-Shi (in the SEO build-out queue)
  - Any other Chinese-speaking NY-metro local businesses you've been talking to
- [ ] Target 30 warm leads + 20 cold-reach by launch day

You'll work this list as part of the launch checklist (separate document). Just start gathering names now.

---

## Final pre-flight check

Before pasting `SESSION_1_BRIEF.md` into Claude Code, verify:

- [ ] DNS CNAME for `review.baamplatform.com` resolves (1.1)
- [ ] Supabase project `baam-review-prod` exists, keys saved (2.1)
- [ ] Supabase auth providers configured with redirect URLs (2.2)
- [ ] Supabase CLI installed and linked to project (2.3)
- [ ] Google OAuth client created with `review.baamplatform.com` origins (3.2)
- [ ] Google OAuth Client ID + secret pasted into Supabase auth providers (3.2)
- [ ] Monorepo repo on a clean `feature/baam-review-session-1` branch (4.1)
- [ ] Vercel has GitHub access to the monorepo (4.2)
- [ ] **Twilio A2P 10DLC filing submitted** (6.1) — async, but file it today
- [ ] Node 20 + npm 10 + Supabase CLI installed locally (9.1, 9.2)
- [ ] Eight HTML prototypes copied to `clients/baam-review/_prototypes/` (10.1)
- [ ] `SESSION_1_BRIEF.md` open in a tab, ready to paste (10.2)

When everything above is ✅, you're ready for Session 1.

---

## What if something goes wrong mid-Session 1?

The agent will pause at every gate. If a gate fails, **don't push through** — fix the underlying issue and re-run the gate.

Common Session 1 failure modes:
- **Gate 2 migration fails** → Usually missing `pgcrypto` extension or RLS policy syntax error. Agent will report the SQL error; tell it to fix and re-run.
- **Gate 3 Google OAuth fails** → Most often the redirect URI doesn't exactly match what's in the Google Cloud console. Re-check 3.2.
- **Gate 4 Vercel deploy fails on custom domain** → DNS hasn't propagated. Wait 30 minutes and have the agent retry. Don't proceed without `https://review.baamplatform.com` resolving cleanly.

---

**Time-to-start checklist:** Once everything red 🔴 above is green ✅, you can begin. The 🟡 items (Twilio, Stripe products, founding-50 list) can be parallel work while Session 1 runs.
