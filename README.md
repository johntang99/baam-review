# BAAM Review


lsof -ti:4001 | xargs kill -9
rm -rf .next
npm run dev

npm install
npm run build

git add .
git commit -m "Update: describe your changes"
git push



Standalone review collection SaaS, built on the BAAM Studio stack. Served from `review.baamplatform.com`.

The full vision and roadmap live in [`docs/BAAM_REVIEW_MASTER_PLAN.md`](docs/BAAM_REVIEW_MASTER_PLAN.md). This README is the operator's guide.

## Stack

- **Framework**: Next.js 16 (App Router, TypeScript strict)
- **UI**: Tailwind CSS v4 + small shadcn-style primitives + `lucide-react`
- **Auth + DB**: Supabase (project `baam-review`)
- **Hosting**: Vercel

## Local development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Copy the example file and fill in the Supabase keys from your project's **Settings → API** page.

```bash
cp .env.local.example .env.local
```

Required variables:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (server only) |
| `NEXT_PUBLIC_APP_URL` | The public origin, e.g. `http://localhost:3000` for dev |

### 3. Run the dev server

```bash
pnpm dev
```

Visit [http://localhost:4001](http://localhost:4001). (Port 4001 is set in the `dev` and `start` scripts so it doesn't collide with other local services on 3000.)

## Routes (Session 1)

| Route | Purpose |
|---|---|
| `/` | Placeholder marketing home (rebuilt in Session 12) |
| `/signup` | Email + password + name → Supabase user + verification email |
| `/login` | Email + password → session |
| `/app` | Authenticated admin shell. Empty welcome until later sessions. |
| `POST /api/auth/signout` | Clears the session, redirects to `/` |

Unauthenticated requests to `/app/*` are redirected to `/login?next=...` by [`middleware.ts`](middleware.ts).

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel — `pnpm` and Next.js auto-detected.
3. Add the four env vars from `.env.local` to **Project Settings → Environment Variables** for *Production*, *Preview*, and *Development*.
4. Set `NEXT_PUBLIC_APP_URL` to `https://review.baamplatform.com` for Production.
5. Add the custom domain `review.baamplatform.com` under **Project Settings → Domains**. The CNAME (`review` → `cname.vercel-dns.com`) should already be configured at the DNS provider.

### Supabase configuration

In the Supabase dashboard for the `baam-review` project:

- **Authentication → URL Configuration**
  - Site URL: `https://review.baamplatform.com`
  - Redirect URLs: add `http://localhost:4001/**` for local dev
- **Authentication → Providers → Email** — confirm email enabled

## Project structure

```
app/
  page.tsx              Marketing placeholder
  layout.tsx            Root layout (Fraunces + Onest)
  globals.css           Tailwind v4 theme tokens
  login/                Sign-in page
  signup/               Sign-up page
  app/                  Authenticated admin shell
    layout.tsx          Sidebar + auth gate
    page.tsx            Welcome
  api/
    auth/signout/       POST → sign out + redirect

components/
  ui/                   Button, Input, Label
  auth/                 LoginForm, SignupForm, AuthShell
  admin/                Sidebar, UserCard

lib/
  utils.ts              cn() helper
  supabase/
    client.ts           Browser Supabase client
    server.ts           Server Supabase client (cookie-aware)
    middleware.ts       Edge session refresh + /app/* gate

middleware.ts           Wires updateSession into the request pipeline
```

## Database

Schema lives in [`supabase/migrations/`](supabase/) and mirrors §8 of the master plan. See [`supabase/README.md`](supabase/README.md) for how to apply migrations (dashboard SQL editor or `supabase db push`).

| Layer | Where it lives |
|---|---|
| Tables, indexes, FK constraints | `supabase/migrations/0001_init.sql` |
| RLS policies + `current_account_id()` helper | `supabase/migrations/0002_rls.sql` |
| `handle_new_user` trigger + backfill | `supabase/migrations/0003_auth_trigger.sql` |
| Optional demo location | `supabase/seed.sql` |
| TypeScript types | `lib/database.types.ts` |

The browser, server, and proxy Supabase clients in `lib/supabase/` are typed against `Database`. A separate `lib/supabase/service.ts` exposes a service-role client for trusted server code that needs to bypass RLS (public review page reads, webhooks).

## What's next

Session 3 — Google Business Profile OAuth + place lookup. See `docs/BAAM_REVIEW_MASTER_PLAN.md` §13.
