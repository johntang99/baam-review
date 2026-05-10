# Claude Code Session 1 — Scaffold + Auth

*The first of twelve sessions for BAAM Review. Self-contained brief; do not pull in the full master plan.*

---

## Goal

Stand up a Next.js 15 project with Supabase auth, deploy it to Vercel against the subdomain `review.baamplatform.com`, and have a working email/password login that gates an empty admin shell at `/app`.

## Out of scope (for this session)

Do not build any of these yet — they are later sessions:

- The database schema beyond what auth requires (Session 2)
- Google Business Profile OAuth (Session 3)
- Locations CRUD (Session 4)
- Public review page (Sessions 5–6)
- Sending SMS/email, QR codes, embed script, analytics, billing (Sessions 7–11)
- Marketing site polish, onboarding wizard (Session 12)

If you find yourself touching anything in the out-of-scope list, stop and confirm.

## Tech decisions already made

- **Framework**: Next.js 15 with the App Router, TypeScript strict mode
- **Hosting**: Vercel
- **Database & auth**: Supabase (project name: `baam-review`, separate from any existing BAAM project)
- **Auth method (v1)**: Email + password only. No magic link, no social login.
- **UI components**: shadcn/ui with Tailwind CSS, BAAM color tokens (see below)
- **Package manager**: pnpm
- **Node**: latest LTS

Do not introduce additional libraries beyond these without flagging them.

## Environment variables

Set up `.env.local` with placeholders for:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://review.baamplatform.com
```

User will provide actual values. Do not invent any.

## Color tokens (Tailwind config)

Add to `tailwind.config.ts`:

```ts
colors: {
  ink: '#0F1F1A',
  forest: { DEFAULT: '#1F4D3F', dark: '#163A30', light: '#2A6B57' },
  sage: { DEFAULT: '#87A899', soft: '#C5D2CB' },
  cream: { DEFAULT: '#FAF7F2', deep: '#F0EBE0' },
  paper: '#FFFFFF',
  gold: { DEFAULT: '#C9A961', soft: '#E8D9B5' },
}
```

Fonts (load via `next/font`):
- `Fraunces` (variable, used for display headings on marketing pages and key admin titles)
- `Onest` (variable, used for body and UI)

## Pages to build this session

1. **`/`** — Placeholder marketing home. Just a centered "BAAM Review — coming soon" with a Fraunces headline. We'll replace this in Session 12.
2. **`/login`** — Email + password form, logo at top, "Don't have an account? Sign up" link.
3. **`/signup`** — Email + password + full name form, "Already have an account? Log in" link. On submit, creates a Supabase user, sends verification email, redirects to a "check your inbox" state.
4. **`/app`** — Empty admin shell. Sidebar nav with placeholder items (Dashboard, Send request, Reviews, Analytics, Settings). Main content area says "Welcome to BAAM Review" with the user's name. Logout button in user card at bottom of sidebar.

Use the design language from prototype `03-admin-dashboard.html` (sidebar, color tokens, Fraunces page title). Do not implement the dashboard's stats/funnel/activity content yet — leave the main area empty with just the welcome message.

## Auth requirements

- Middleware at the root that protects `/app/*` routes — unauthenticated requests redirect to `/login?next=/app`
- After login, redirect to the `next` query param if present, else to `/app`
- After signup confirmation, redirect to `/app`
- Logout clears the session and redirects to `/`
- Use Supabase's `@supabase/ssr` package for cookie-based session handling
- Server components fetch the user via the Supabase server client; do not pass auth state through client-side fetches

## Acceptance criteria

The session is done when:

1. `pnpm dev` runs the app locally on port 3000 with no errors or warnings
2. Visiting `/` shows the placeholder home
3. Visiting `/app` while logged out redirects to `/login`
4. Submitting `/signup` creates a Supabase user and sends a verification email
5. After verifying, logging in via `/login` lands on `/app` with the user's name displayed
6. Logout returns to `/`
7. The app is deployed to Vercel and reachable at `review.baamplatform.com` (DNS configured by user beforehand)
8. TypeScript compiles with no `any` and no errors
9. There is a `README.md` with the setup instructions: required env vars, how to run locally, how to deploy

## What to confirm with the user before starting

- Has the new Supabase project been created? Is the URL and anon key ready?
- Has the Vercel project been created and the subdomain DNS configured?
- Is there an existing BAAM Studio repo template we should follow for code style, or start fresh?

If any of these are no, ask before proceeding rather than scaffolding placeholders.

## Files I expect to see when this session is complete

```
baam-review/
  app/
    (marketing)/
      page.tsx               # placeholder home
    login/
      page.tsx
    signup/
      page.tsx
    app/
      layout.tsx             # admin shell with sidebar
      page.tsx               # empty welcome
    api/
      auth/
        signout/route.ts
    layout.tsx               # root with font loading
    globals.css              # Tailwind + CSS variables
  components/
    ui/                      # shadcn/ui components installed as needed
    admin/
      sidebar.tsx
      user-card.tsx
    auth/
      login-form.tsx
      signup-form.tsx
  lib/
    supabase/
      client.ts              # browser client
      server.ts              # server client
      middleware.ts          # session refresh helper
  middleware.ts              # protects /app/*
  tailwind.config.ts
  .env.local.example
  README.md
```

If your structure differs meaningfully, explain why before deviating.

---

*End of Session 1 brief. When this session is complete and deployed, request the Session 2 brief (schema + RLS).*
