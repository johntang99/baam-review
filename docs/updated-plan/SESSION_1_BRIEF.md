# BAAM Review — Session 1 Brief

**Version:** 2.0
**Date:** May 12, 2026
**Agent:** Claude Code (`claude-code` CLI)
**Estimated duration:** 6–8 hours of agent execution
**Scope:** Foundation for a Next.js 15 multi-tenant Review-to-Revenue Engine
**Location on disk:** `clients/baam-review/` (sibling to `clients/baam`, `clients/baam-local`, `clients/Baam-Utilities`)
**Production domain:** `review.baamplatform.com`

---

## How to use this brief

1. Verify the prerequisites in `PRE_SESSION_1_SETUP.md` are complete. Do **not** start without all checkmarks green.
2. Open Claude Code from the repo root: `cd ~/dev/baam-monorepo && claude-code`
3. Paste **everything below the next divider** into the first prompt of the session.
4. Stay available for done-gate confirmations every 60–90 minutes. The agent will pause at each gate and wait for "go."

---

## CONTEXT — read this carefully, agent

You're building Session 1 of BAAM Review, a Review-to-Revenue Engine for local businesses targeting Chinese-speaking communities in NY metro. You're building inside an existing monorepo. **Do not modify** anything outside `clients/baam-review/`. Existing clients folders are off-limits.

### The product, in one sentence

BAAM Review turns happy customers into Google reviews, then into website social proof, social media distribution, referrals, and revenue. A seven-stage loop: **Collect → Publish → Display → Distribute → Convert → Refer → Compound.**

### What this session does NOT touch

Stages 3 through 7 of the loop are out of scope for Session 1. You're building the foundation that all stages will plug into: the database, auth, locations model, and admin shell. No widgets, no AI drafting, no social cards, no referrals — those land in Sessions 2 through 12.

### What you ARE building

A working Next.js 15 app at `clients/baam-review/` with:
- App Router, TypeScript strict mode
- Supabase wired for auth + Postgres
- A complete v2.0 schema deployed via migration (not just Session 1 tables — the full schema so future sessions don't re-migrate)
- Email/password auth + Google OAuth
- A `locations` model and switcher (a user can own multiple locations)
- Admin shell with the v2.0 sidebar nav from the prototypes (most items stub out for now)
- Tailwind + shadcn/ui + the BAAM Review design tokens (Fraunces / Newsreader / Onest + clinic-red + forest + gold + cream)
- Deployment to Vercel under `review.baamplatform.com`

### Prototypes you MUST mirror visually

The HTML prototypes in `/clients/baam-review/_prototypes/` are the design source of truth. Use them as the reference for color tokens, typography, spacing, and component patterns. **Do not invent your own design system.** When you build a screen for the admin shell, open the matching prototype side-by-side and match it closely.

The eight prototypes:
- `01-marketing-home.html` — landing page
- `02-marketing-pricing.html` — pricing
- `03-admin-dashboard.html` — owner dashboard (this is your reference for sidebar nav)
- `04-admin-send-request.html` — send screen
- `05-review-questions.html` — customer chip flow
- `06-review-ai-draft.html` — AI draft editor
- `07-review-thankyou.html` — post-review screen
- `08-staff-mode.html` — front-desk surface

### Stack you must use

- **Next.js 15** App Router, TypeScript strict, Node 20
- **Supabase** for auth, Postgres, storage (RLS on every table)
- **Tailwind v3.4** with custom theme tokens
- **shadcn/ui** for primitives (Button, Input, Select, Dialog, Toast, Sheet, Table)
- **Stripe** library installed but **not wired** — Session 7 wires checkout
- **Resend** library installed but **not wired** — Session 4 wires email
- **Twilio** library installed but **not wired** — Session 4 wires SMS
- **Anthropic SDK** installed but **not wired** — Session 5 wires AI drafting
- **Vercel** for hosting, with environment variables managed through the dashboard

### What "done" means for this session

When the user (John) types `npm run dev` from `clients/baam-review/`, opens `http://localhost:3000`, and completes this checklist:
- Signs up with email/password, receives confirmation email, confirms, logs in
- Signs up with Google OAuth
- Creates a location with name + address + GBP place ID
- Switches between two locations
- Sees the v2.0 admin sidebar nav with all eight items (badges are static for now)
- Lands on `/dashboard` and sees the four-card revenue strip with placeholder zeros (no real metrics yet)
- Visits the marketing site at `/` and sees the home page rendered from the React component (not a static HTML copy)
- Deploys to Vercel and confirms `review.baamplatform.com` resolves to the live app

…the session is done. **Nothing else is in scope.** Resist the temptation to build features.

---

## DONE GATES — pause at every one

You will pause at each of the four gates below and wait for explicit "go" before proceeding. Each gate ends with a runnable checkpoint and a summary of what changed since the last gate. Do not skip ahead.

### Gate 1 — Project bootstrap (~60 min)
- `clients/baam-review/` exists with Next.js 15 App Router scaffold (`create-next-app`)
- TypeScript strict mode enabled, no `any` types
- ESLint + Prettier configured to match the monorepo's existing config
- Tailwind installed with custom theme (see "Design tokens" below)
- shadcn/ui CLI initialized; Button, Input, Select, Dialog, Toast, Sheet, Table installed
- The four base fonts (Fraunces, Newsreader, Onest, JetBrains Mono) loaded via `next/font/google`
- Root layout renders with cream background, default font Onest, header showing "BAAM Review" in Fraunces serif
- `npm run dev` starts cleanly with no warnings
- `_prototypes/` folder created and all 8 HTML files copied in from `/mnt/user-data/outputs/`
- **Pause and report.** Wait for "go."

### Gate 2 — Supabase + database schema (~90 min)
- Supabase client wired (server-side via `@supabase/ssr`, client-side via `@supabase/supabase-js`)
- Environment variables read from `.env.local` — never committed
- A single migration file at `supabase/migrations/0001_v2_initial_schema.sql` containing the **entire v2.0 schema** below
- All tables have RLS enabled with starter policies (owner-only read/write on their own location's data; staff has scoped read; public has zero default access)
- TypeScript types generated via `supabase gen types typescript` → `lib/database.types.ts`
- A `lib/supabase/server.ts` and `lib/supabase/client.ts` exposing typed clients
- Migration runs cleanly with `npx supabase db reset` on local Supabase
- **Pause and report.** Wait for "go."

### Gate 3 — Auth + locations (~2 hr)
- `/auth/login`, `/auth/signup`, `/auth/callback` routes wired with Supabase Auth
- Email/password + Google OAuth both working end-to-end
- Email confirmation email arrives (uses Supabase's built-in template for now — Resend integration is later)
- Logged-out users hitting `/dashboard` redirect to `/auth/login`
- A `/onboarding/new-location` flow that creates the user's first location
- Locations switcher in the sidebar (matches the design in `03-admin-dashboard.html` — clinic-red icon, name, location+tier sub-line)
- A user can own multiple locations; the switcher persists selection per-session via cookie
- Owner role enforced on all admin routes; placeholder "staff" role flag exists in schema but staff-mode is Session 9
- **Pause and report.** Wait for "go."

### Gate 4 — Admin shell + marketing pages + deploy (~2 hr)
- `/` renders the marketing home as a React component (port from `01-marketing-home.html`)
- `/pricing` renders the pricing page (port from `02-marketing-pricing.html`)
- `/dashboard` renders the admin dashboard chrome — sidebar nav with 8 items, top bar, four-card revenue strip with placeholder zeros, service-recovery banner hidden (no triggered alerts yet)
- All eight sidebar nav items render (Dashboard, Send request, Reviews, AI Replies, Referrals, Distribute, Analytics, Embed & QR + Settings, Billing in the Account section); items besides Dashboard navigate to `/dashboard/<slug>` with a "Coming in Session N" placeholder page
- User avatar in the sidebar shows the logged-in user's initials + tier ("Starter · Trial" for now)
- Vercel project created, environment variables set, `review.baamplatform.com` configured with DNS CNAME, production deploy succeeds
- README at `clients/baam-review/README.md` covers local dev setup, env vars, deploy
- **Pause and report.** This is end-of-session.

---

## DESIGN TOKENS — `tailwind.config.ts`

Encode these into the Tailwind theme. Do not deviate. These come straight from the prototypes' CSS variables.

```typescript
// tailwind.config.ts excerpt
theme: {
  extend: {
    colors: {
      ink: '#0F1F1A',
      forest: {
        DEFAULT: '#1F4D3F',
        dark: '#163A30',
        light: '#2A6B57',
      },
      sage: {
        DEFAULT: '#87A899',
        soft: '#C5D2CB',
      },
      cream: {
        DEFAULT: '#FAF7F2',
        deep: '#F0EBE0',
      },
      paper: '#FFFFFF',
      gold: {
        DEFAULT: '#C9A961',
        dark: '#A88847',
        soft: '#E8D9B5',
      },
      clinic: {
        primary: '#962D22',
        'primary-dark': '#6F1F18',
        soft: '#F8E5E1',
        tint: '#FBF1EF',
      },
      success: '#2D7A5F',
      alert: {
        DEFAULT: '#B5443A',
        soft: '#FCE8E5',
      },
      warn: {
        DEFAULT: '#D4924A',
        soft: '#FBEAD3',
      },
    },
    fontFamily: {
      serif: ['Fraunces', 'Noto Sans SC', 'serif'],
      reader: ['Newsreader', 'serif'],
      sans: ['Onest', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
    boxShadow: {
      sm: '0 1px 2px rgba(15, 31, 26, 0.04)',
      md: '0 4px 14px rgba(15, 31, 26, 0.06)',
      lg: '0 12px 28px rgba(15, 31, 26, 0.08)',
      xl: '0 24px 48px rgba(15, 31, 26, 0.12)',
    },
  },
}
```

---

## SUPABASE SCHEMA — `0001_v2_initial_schema.sql`

This is the **complete v2.0 schema** from the master plan. Deploy all of it in Session 1 even though most tables are unused until later sessions — this prevents painful migration cycles. Every table has RLS enabled. Default deny.

```sql
-- ============ EXTENSIONS ============
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============ ENUMS ============
create type user_role as enum ('owner', 'staff', 'agency_admin');
create type subscription_tier as enum ('free', 'starter', 'growth', 'agency');
create type subscription_status as enum ('active', 'trial', 'past_due', 'canceled', 'paused');
create type request_channel as enum ('sms', 'email', 'qr', 'staff_mode');
create type request_status as enum ('queued', 'sent', 'delivered', 'clicked', 'completed', 'private', 'failed');
create type review_source as enum ('google', 'yelp', 'first_party');
create type referral_event_type as enum ('share_card_viewed', 'cta_clicked', 'booked');
create type widget_event_type as enum ('impression', 'view', 'cta_click');

-- ============ TENANTS / USERS / LOCATIONS ============
create table users (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  preferred_language text default 'en' check (preferred_language in ('en','zh','es')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  tier subscription_tier not null default 'free',
  status subscription_status not null default 'trial',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  trial_ends_at timestamptz,
  founding_member boolean default false,
  founding_locked_pricing jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table account_users (
  account_id uuid references accounts(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role user_role not null default 'owner',
  created_at timestamptz default now(),
  primary key (account_id, user_id)
);

create table locations (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references accounts(id) on delete cascade not null,
  name text not null,
  slug text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text default 'US',
  phone text,
  website text,
  booking_url text,
  gbp_place_id text,
  gbp_review_link text,
  brand_primary_color text default '#1F4D3F',
  brand_logo_url text,
  default_language text default 'en' check (default_language in ('en','zh','es')),
  avg_customer_value_cents integer,
  social_handles jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (account_id, slug)
);

create index idx_locations_account on locations(account_id);

-- ============ COLLECT STAGE ============
create table customers (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  full_name text,
  phone text,
  email text,
  preferred_language text default 'en' check (preferred_language in ('en','zh','es')),
  consent_to_display boolean default true,
  consent_revoked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_customers_location on customers(location_id);

create table review_requests (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete set null,
  customer_snapshot jsonb not null,
  channel request_channel not null,
  status request_status not null default 'queued',
  message_body text,
  language text default 'en' check (language in ('en','zh','es')),
  token text not null unique,
  twilio_sid text,
  resend_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  clicked_at timestamptz,
  completed_at timestamptz,
  consent_display boolean default true,
  sender_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_requests_location_status on review_requests(location_id, status);
create index idx_requests_token on review_requests(token);

create table review_question_responses (
  id uuid primary key default uuid_generate_v4(),
  review_request_id uuid references review_requests(id) on delete cascade not null,
  q1_helped_with text,
  q2_experience text,
  q3_one_word text,
  rating integer check (rating between 1 and 5),
  custom_other_text text,
  created_at timestamptz default now()
);

-- ============ PUBLISH STAGE ============
create table imported_reviews (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  source review_source not null,
  source_review_id text,
  author_name text,
  author_photo_url text,
  rating integer check (rating between 1 and 5),
  body text,
  language text,
  posted_at timestamptz,
  reply_body text,
  replied_at timestamptz,
  ai_reply_drafts jsonb,
  fetched_at timestamptz default now(),
  unique (source, source_review_id)
);

create index idx_imported_location on imported_reviews(location_id);

create table first_party_reviews (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  review_request_id uuid references review_requests(id) on delete set null,
  rating integer check (rating between 1 and 5),
  body text not null,
  author_name text,
  author_initial text,
  language text default 'en',
  consent_display boolean default true,
  consent_revoked_at timestamptz,
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

create index idx_fp_reviews_location on first_party_reviews(location_id);

-- Private feedback (3-star or less, or self-selected private)
create table private_feedback (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  review_request_id uuid references review_requests(id) on delete set null,
  customer_name text,
  customer_contact text,
  rating integer check (rating between 1 and 5),
  body text not null,
  language text default 'en',
  status text default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid references users(id),
  resolution_notes text,
  created_at timestamptz default now()
);

create index idx_private_location on private_feedback(location_id, status);

-- ============ DISPLAY STAGE ============
create table widget_events (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  event_type widget_event_type not null,
  page_url text,
  referrer text,
  session_id text,
  created_at timestamptz default now()
);

create index idx_widget_events_location_type on widget_events(location_id, event_type, created_at);

-- ============ DISTRIBUTE STAGE ============
create table social_graphics (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  source_review_id uuid,
  source_review_type text check (source_review_type in ('imported','first_party')),
  platform text check (platform in ('xiaohongshu','instagram','facebook','wechat')),
  image_url text,
  caption text,
  caption_language text,
  posted_at timestamptz,
  external_post_url text,
  created_at timestamptz default now()
);

create index idx_graphics_location on social_graphics(location_id);

create table review_themes (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  theme_name text not null,
  theme_description text,
  review_count integer default 0,
  example_quotes jsonb,
  last_computed_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ============ CONVERT STAGE ============
create table landing_pages (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  slug text not null,
  title text,
  theme_id uuid references review_themes(id),
  body_jsonb jsonb,
  status text default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz default now(),
  unique (location_id, slug)
);

-- ============ REFER STAGE ============
create table referrals (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  referrer_review_request_id uuid references review_requests(id) on delete set null,
  referrer_customer_id uuid references customers(id) on delete set null,
  token text not null unique,
  shared_via text check (shared_via in ('wechat','sms','copy','xiaohongshu','more','unknown')),
  status text default 'created' check (status in ('created', 'clicked', 'booked', 'churned')),
  attributed_revenue_cents integer,
  booked_at timestamptz,
  created_at timestamptz default now()
);

create index idx_referrals_location on referrals(location_id);
create index idx_referrals_token on referrals(token);

create table referral_events (
  id uuid primary key default uuid_generate_v4(),
  referral_id uuid references referrals(id) on delete cascade not null,
  event_type referral_event_type not null,
  metadata jsonb,
  created_at timestamptz default now()
);

create index idx_referral_events_ref on referral_events(referral_id);

create table partners (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  referral_token text not null unique,
  notes text,
  created_at timestamptz default now()
);

-- ============ COMPOUND STAGE ============
create table advocates (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  score integer default 0,
  visit_count integer default 0,
  review_count integer default 0,
  referral_count integer default 0,
  share_count integer default 0,
  rebook_count integer default 0,
  last_active_at timestamptz,
  flags jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (location_id, customer_id)
);

create index idx_advocates_location_score on advocates(location_id, score desc);

-- ============ POST-REVIEW ACTIONS (audit trail) ============
create table post_review_actions (
  id uuid primary key default uuid_generate_v4(),
  review_request_id uuid references review_requests(id) on delete cascade not null,
  action text check (action in ('booked','referred','followed_social','dismissed')),
  metadata jsonb,
  created_at timestamptz default now()
);

create index idx_pra_request on post_review_actions(review_request_id);

-- ============ ENABLE RLS ============
alter table users enable row level security;
alter table accounts enable row level security;
alter table account_users enable row level security;
alter table locations enable row level security;
alter table customers enable row level security;
alter table review_requests enable row level security;
alter table review_question_responses enable row level security;
alter table imported_reviews enable row level security;
alter table first_party_reviews enable row level security;
alter table private_feedback enable row level security;
alter table widget_events enable row level security;
alter table social_graphics enable row level security;
alter table review_themes enable row level security;
alter table landing_pages enable row level security;
alter table referrals enable row level security;
alter table referral_events enable row level security;
alter table partners enable row level security;
alter table advocates enable row level security;
alter table post_review_actions enable row level security;

-- ============ STARTER POLICIES (Session 1 scope) ============

-- users: a user can read/update their own row
create policy users_self_read on users for select using (auth_user_id = auth.uid());
create policy users_self_update on users for update using (auth_user_id = auth.uid());

-- accounts: members of the account can read; only owners can update
create policy accounts_member_read on accounts for select using (
  exists (
    select 1 from account_users au
    join users u on u.id = au.user_id
    where au.account_id = accounts.id and u.auth_user_id = auth.uid()
  )
);

-- locations: scoped to account membership
create policy locations_account_read on locations for select using (
  exists (
    select 1 from account_users au
    join users u on u.id = au.user_id
    where au.account_id = locations.account_id and u.auth_user_id = auth.uid()
  )
);
create policy locations_owner_write on locations for all using (
  exists (
    select 1 from account_users au
    join users u on u.id = au.user_id
    where au.account_id = locations.account_id
      and u.auth_user_id = auth.uid()
      and au.role = 'owner'
  )
);

-- All other tables get a default-deny posture for now; later sessions add specific policies.
-- public.* tables that customers hit (review_requests by token, first_party_reviews for widget)
-- will get permissive policies in Sessions 4-6.
```

**Important RLS note for agent:** Session 1 only writes minimal policies — locations read/write and users self-read. Default deny is the right posture for tables that don't have policies yet, because no later session should accidentally read data through an unauthenticated path. Future sessions add policies for `review_requests` (public read by token), `first_party_reviews` (public read for widget), and `referrals` (public read by token). Don't preemptively open those up.

---

## NAVIGATION STRUCTURE — admin sidebar

Match `03-admin-dashboard.html` exactly. Eight items grouped by section:

```
Brand: BAAM Review (Fraunces 18px, gold "B" mark)

Location switcher (clinic-red logo + name + tier sub-line)

— WORKSPACE —
- Dashboard               (active in Session 1)
- Send request            → /dashboard/send (placeholder)
- Reviews                 → /dashboard/reviews (placeholder, badges: gold/red counts)
- AI Replies              → /dashboard/replies (placeholder, gold badge)
- Referrals               → /dashboard/referrals (placeholder, "NEW" green pill)
- Distribute              → /dashboard/distribute (placeholder, "NEW" green pill)
- Analytics               → /dashboard/analytics (placeholder)
- Embed & QR              → /dashboard/embed (placeholder)

— ACCOUNT —
- Settings                → /dashboard/settings (placeholder)
- Billing                 → /dashboard/billing (placeholder)

User card at bottom: initials avatar + name + "Starter · Trial" or "Growth · Founding member"
```

Placeholder pages render: page title, "Coming in Session N" subtitle, link back to dashboard. Don't waste time on these.

---

## ROUTING — App Router structure

```
clients/baam-review/app/
├── layout.tsx                      # Root layout, fonts, cream bg
├── page.tsx                        # Marketing home (port 01-marketing-home.html)
├── pricing/page.tsx                # Pricing page (port 02-marketing-pricing.html)
├── auth/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── callback/route.ts           # OAuth callback handler
│   └── confirm/page.tsx            # Email confirmation landing
├── onboarding/
│   └── new-location/page.tsx
├── dashboard/
│   ├── layout.tsx                  # Sidebar + top bar shell
│   ├── page.tsx                    # Dashboard home (placeholder revenue strip)
│   ├── send/page.tsx               # Placeholder
│   ├── reviews/page.tsx            # Placeholder
│   ├── replies/page.tsx            # Placeholder
│   ├── referrals/page.tsx          # Placeholder
│   ├── distribute/page.tsx         # Placeholder
│   ├── analytics/page.tsx          # Placeholder
│   ├── embed/page.tsx              # Placeholder
│   ├── settings/page.tsx           # Placeholder
│   └── billing/page.tsx            # Placeholder
└── api/
    └── (none in Session 1)
```

`middleware.ts` at root enforces auth on `/dashboard/*` and `/onboarding/*` routes — redirects unauthenticated requests to `/auth/login?next=<original-url>`.

---

## ENVIRONMENT VARIABLES

Document these in `.env.example`. They'll be set in Vercel during Gate 4.

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # server-only

# OAuth
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=

# App
NEXT_PUBLIC_SITE_URL=https://review.baamplatform.com
NEXT_PUBLIC_APP_NAME="BAAM Review"

# Stripe (placeholders — Session 7)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Resend (placeholders — Session 4)
RESEND_API_KEY=

# Twilio (placeholders — Session 4)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=

# Anthropic (placeholders — Session 5)
ANTHROPIC_API_KEY=
```

---

## DEPLOYMENT — Gate 4 specifics

1. Create Vercel project, link to GitHub repo, root directory `clients/baam-review`.
2. Set environment variables in Vercel dashboard (production + preview).
3. Configure custom domain `review.baamplatform.com`. DNS CNAME should be in place (see `PRE_SESSION_1_SETUP.md`).
4. First deploy must succeed with zero warnings. Build command: `npm run build`. Install command: `npm install`. Output directory: `.next` (default).
5. Smoke test the deployed URL: marketing home loads, `/pricing` loads, `/auth/login` loads. Sign up with email, confirm, log in, create location, switch locations.
6. Update `clients/baam-review/README.md` with: local dev steps, env var list, Supabase setup pointer, Vercel project URL, list of placeholders pointing to future sessions.

---

## CONSTRAINTS — non-negotiable

1. **Do not** install packages outside the stated stack. No state libraries (Zustand, Jotai), no form libraries beyond what shadcn ships with, no chart libraries (recharts will land Session 8 when analytics needs them).
2. **Do not** invent new design tokens. If the prototypes don't have it, you don't need it. Ask before adding.
3. **Do not** build features beyond the gate scope. Resist the urge to wire up review request sending or AI drafting "to save time later." That's Session 4 and Session 5 respectively.
4. **Do not** commit `.env.local` or any file containing real keys. `.env.example` is the only env file in the repo.
5. **Do not** modify files outside `clients/baam-review/`. The other clients folders are off-limits.
6. **Stop at every gate.** Wait for "go" before continuing. If you hit ambiguity mid-gate, pause and ask.

---

## WHAT TO REPORT AT EACH GATE

Post a single message containing:
1. **Gate name** and approximate time spent
2. **Files added/changed** (path list, no diff)
3. **What works now** (one-line per checklist item, ✓ or ✗)
4. **What's blocking** (if anything)
5. **Suggested next step** ("ready for Gate N+1" or "needs review of X first")
6. **Any decisions you made that I should know about** — design choices, package selections, naming, anything non-trivial

Keep reports under 400 words. I'll respond with "go" or with specific feedback.

---

## SESSION 1 SUCCESS LOOKS LIKE THIS

By end of session, when I run `npm run dev` in `clients/baam-review/` and open `localhost:3000`:

- Marketing home renders with the new "Turn happy customers into reviews, referrals, and revenue" headline and the seven-stage loop graphic
- I can sign up with email, confirm via email, log in
- I land at `/onboarding/new-location`, fill in Dr. Huang Acupuncture details, get redirected to `/dashboard`
- The dashboard shows the v2.0 sidebar with all eight items, the four-card revenue strip (with placeholder zeros), and a "Good morning, John" heading
- I can switch to a second location from the sidebar switcher
- The deployed Vercel URL `review.baamplatform.com` shows the same thing

And **nothing more.** Resist scope creep. Sessions 2 onward are where features land.

---

**Now begin with Gate 1. Confirm you've read this brief before starting.**
