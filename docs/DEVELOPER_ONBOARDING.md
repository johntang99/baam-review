# BAAM Review — Developer Onboarding

*If you're new to this codebase, start here. Read [PROGRESS.md](PROGRESS.md) for what's built and [ARCHITECTURE.md](ARCHITECTURE.md) for how it fits together.*

---

## Prerequisites

- **Node.js** — latest LTS (`v20` or higher); the repo was built on `v23`
- **pnpm** — `npm install -g pnpm`
- **Git**
- **A code editor** — VS Code or any other
- **Optional**: the Supabase CLI (`brew install supabase/tap/supabase`) for CLI-driven migrations. Not required; the SQL editor in the Supabase dashboard works fine.

---

## 1. Clone

```bash
git clone git@github.com:johntang99/baam-review.git
cd baam-review
pnpm install
```

If pnpm complains about ignored build scripts (`sharp`, `unrs-resolver`), it's safe — they're optional optimizers and the `onlyBuiltDependencies` allowlist in `pnpm-workspace.yaml` handles it.

---

## 2. Get credentials

You'll need access to these services. Ask whoever runs the project (currently John Tang) for credentials:

| Service | What you need |
|---|---|
| Supabase | Access to the `baam-review` project + the three keys (URL, anon, service role) |
| Vercel | Project access for `baam-review` (lets you see deployments + read env vars) |
| GitHub | Push access to `johntang99/baam-review` |
| Anthropic | An API key (any account works — they're scoped to project, not org) |
| Resend | Access to the `baamplatform.com` domain (for sender) |
| Twilio | Account SID + auth token; only needed if you're touching SMS |
| Google Cloud | OAuth client credentials in the `baam-platform` project |

---

## 3. Configure `.env.local`

Copy the example and fill in:

```bash
cp .env.local.example .env.local
```

Required to boot the app at all:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:4001
```

Required for specific features:

```env
# Session 3 — Connect Google Business Profile
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Session 6 — AI drafts
ANTHROPIC_API_KEY=...

# Session 7 — Email sends
RESEND_API_KEY=...
RESEND_FROM=No-Reply <no-reply@baamplatform.com>

# Session 7 — SMS sends (optional)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

---

## 4. Boot

```bash
pnpm dev
```

Visit [http://localhost:4001](http://localhost:4001). Port 4001 is set in [`package.json`](../package.json) `scripts` so it doesn't collide with other projects on 3000.

You should see the "Coming soon" placeholder. Click **Create account** to sign up. The verification email goes to a real inbox via the live Supabase + Resend setup — use your own address.

**Common boot errors:**

- *"createServiceClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"* — fill `.env.local` and restart.
- *Verification email never arrives* — the Supabase project's Site URL must include `http://localhost:4001/**` in Redirect URLs. Check Supabase dashboard → Authentication → URL Configuration.
- *Port 4001 in use* — `lsof -ti:4001 | xargs kill -9` and retry.

---

## 5. Walk a real customer flow end-to-end

Once you can sign in:

1. **Connect Google** at `/app/locations` → pick a location you have access to in your Google Business Profile (you'll need to be a verified manager of a real business, or use the `baam-platform` workspace which has several test businesses).
2. **Edit a location** at `/app/locations/[id]` → set a brand color, upload a logo, enable Chinese + Spanish, write welcome messages in each.
3. **Send a request** at `/app/send` → use your own email as the recipient, pick a language, send. Email should arrive in ~5 seconds.
4. **Click the link in the email** → lands on `/r/[slug]?t=<token>` in the chosen language.
5. **Walk the chip flow** → "Help me write a review" → see three Claude-generated drafts → "Looks good — post to Google" → opens Google's review form in a new tab, your tab navigates to thank-you.
6. **Check the dashboard** at `/app` → funnel + breakdowns should reflect your test send and click.

If anything in this flow doesn't work, the [PROGRESS.md](PROGRESS.md) session log tells you which session was supposed to deliver it.

---

## 6. Where to start changing things

The codebase is organized so each session's work is mostly contiguous. Pick the area you need to touch:

| You want to change… | Go to… |
|---|---|
| The admin sidebar / shell | [components/admin/sidebar.tsx](../components/admin/sidebar.tsx) |
| Color tokens / fonts | [app/globals.css](../app/globals.css) (Tailwind v4 `@theme`) |
| Location settings form fields | [app/app/locations/[id]/settings-form.tsx](../app/app/locations/%5Bid%5D/settings-form.tsx) |
| Public review page layout | [app/r/[slug]/page.tsx](../app/r/%5Bslug%5D/page.tsx) |
| The chip flow on the public page | [components/review/review-flow.tsx](../components/review/review-flow.tsx) |
| AI prompt or model | [lib/ai/draft.ts](../lib/ai/draft.ts) |
| Email or SMS template | [lib/messaging/templates.ts](../lib/messaging/templates.ts) |
| Velocity thresholds | [lib/messaging/velocity.ts](../lib/messaging/velocity.ts) |
| Default chip options for a new business type | [lib/business-prompts.ts](../lib/business-prompts.ts) |
| Translation strings | [lib/i18n/review.ts](../lib/i18n/review.ts) |
| The QR poster layout | [lib/pdf/qr-poster.ts](../lib/pdf/qr-poster.ts) |
| The embed button | [app/api/embed.js/route.ts](../app/api/embed.js/route.ts) |
| Dashboard metrics | [app/app/page.tsx](../app/app/page.tsx) + [lib/analytics/aggregate.ts](../lib/analytics/aggregate.ts) |
| RLS policies | [supabase/migrations/0002_rls.sql](../supabase/migrations/0002_rls.sql) |

---

## 7. Conventions worth knowing

### TypeScript

- Strict mode is on. No `any`. No `@ts-ignore` in committed code.
- `Database` type lives at [`lib/database.types.ts`](../lib/database.types.ts). It's hand-maintained for now; a session was deferred to swap in `supabase gen types typescript --linked` output. If you add columns, update both the SQL migration and this file.
- The four Supabase clients (`browser`, `server`, `proxy`, `service`) are typed against `Database<{ schema: 'public' }>`. Always use them.

### Server vs. client components

- Default is server component. Add `"use client"` only when you need state, effects, or browser APIs.
- Forms generally use a server action (see [`app/app/send/actions.ts`](../app/app/send/actions.ts) for the canonical pattern) rather than a client `fetch`.
- The exception is `/api/draft` — uses a fetch + client state because we wanted control over the loading skeleton.

### Server actions

- Always `redirect("/login")` if `getUser()` returns null. Auth is also enforced by `proxy.ts` for `/app/*`, but check anyway in case the action is called from outside the gated tree.
- Use the **server** Supabase client (cookie-aware, RLS-scoped) for user-driven mutations.
- Use the **service** Supabase client for things RLS would block but you've validated through other means (e.g., inserting into `landing_events` on behalf of an unauthenticated public page).

### Routing

- `proxy.ts` (Next 16 convention, was `middleware.ts` in older docs) gates `/app/*` only. Public routes (`/`, `/login`, `/signup`, `/r/[slug]`, `/api/*`) pass through with session refresh but no gate.

### File naming

- React components: `PascalCase.tsx`
- Utilities and route handlers: `kebab-case.ts`
- Test files would go next to source as `*.test.ts` (none yet — tests are a Phase 2 cleanup task).

### Style and tokens

- Use Tailwind utility classes; design tokens are CSS custom props via `@theme`.
- Primary action: `bg-forest text-cream`
- Secondary: `bg-paper border border-border-base text-text`
- Danger: `bg-alert text-cream`
- Sidebar: `bg-ink text-cream`
- Never hardcode hex values in TSX — always use the token (`bg-forest` not `bg-[#1F4D3F]`).

### i18n

- Three languages: `en` / `zh` / `es`. Add to all three (or to a typed `STRINGS` map) when you add user-facing strings.
- If you add a new chip set for a new `business_type`, add it to [`lib/business-prompts.ts`](../lib/business-prompts.ts).

### Naming for migrations

- Numeric prefix, four digits, name kebab-cased: `0009_add_thing.sql`.
- Migrations are append-only — never edit `0001_init.sql` after it's been applied to any environment.
- If you find yourself needing to change a column added in an earlier migration, write a new migration that alters it.

---

## 8. Common tasks

### Adding a new database table

```bash
# 1. Create the migration
echo "-- 0009_my_table.sql" > supabase/migrations/0009_my_table.sql
# Edit it with CREATE TABLE, indexes, RLS policies

# 2. Apply locally via Supabase SQL editor (paste and Run)

# 3. Add types to lib/database.types.ts (Row / Insert / Update / Relationships: [])

# 4. Use it from your route handler / server component
```

### Adding a new API route

Create `app/api/<name>/route.ts`. Export `GET`, `POST`, etc. as async functions taking `NextRequest`. Use `NextResponse.json(...)` to return.

```ts
// app/api/example/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  // ...
  return NextResponse.json({ ok: true });
}
```

For edge runtime add `export const runtime = "edge";` — useful for the embed script (low latency, lightweight). Most routes use Node runtime (default).

### Adding a feature behind a flag

We don't have a feature flag system yet. Sessions 11–12 might bring one. For now, hide UI behind a hardcoded boolean or behind tier check on `account.subscription_tier`.

### Running TypeScript locally

`./node_modules/.bin/tsc --noEmit` runs a type-check. There's no separate `pnpm typecheck` script; we lean on `next build` for CI-equivalent checks.

### Running a production build

```bash
./node_modules/.bin/next build
```

Same as Vercel runs. If it passes locally, deploy will pass.

### Cleaning the Next.js cache

```bash
rm -rf .next
pnpm dev
```

Useful if you see stale module errors or odd type-check behavior.

---

## 9. When you're stuck

In order of effort:

1. **Read [PROGRESS.md](PROGRESS.md)** to find which session introduced the feature you're touching and what the original brief looked like.
2. **Read [ARCHITECTURE.md](ARCHITECTURE.md)** to understand the data flow.
3. **Grep for the surrounding code** — most patterns repeat across sessions, so a similar feature you can copy from probably exists.
4. **Check the [master plan](BAAM_REVIEW_MASTER_PLAN.md)** — many design choices are recorded there (esp. §11 compliance, §13 sessions).
5. **Ask John.**
