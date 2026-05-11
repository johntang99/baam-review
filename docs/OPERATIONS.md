# BAAM Review — Operations Runbook

*How to deploy, configure, and run BAAM Review in production. See [ARCHITECTURE.md](ARCHITECTURE.md) for what's deployed, [DEVELOPER_ONBOARDING.md](DEVELOPER_ONBOARDING.md) for local setup.*

---

## Live URLs

| Surface | URL |
|---|---|
| Production app | https://review.baamplatform.com |
| Admin | https://review.baamplatform.com/app |
| Public review pages | https://review.baamplatform.com/r/[slug] |
| Repo | https://github.com/johntang99/baam-review |
| Supabase project | `baam-review` (in the Supabase dashboard) |
| Vercel project | `baam-review` (in the Vercel dashboard) |

---

## Deployments

Deploys are **automatic on push to `main`**. Vercel monitors GitHub, builds with `pnpm run build`, then promotes to production when CI passes.

### Promoting a deploy

You don't. Vercel does it automatically on green build. To preview a branch:

```bash
git push origin <branch>
```

Then Vercel creates a Preview deploy at `baam-review-git-<branch>-…vercel.app` — useful for reviewing UI changes before merging.

### Rolling back

Vercel dashboard → Deployments → previous successful deploy → **⋯ → Promote to Production**. Effective within seconds.

### Manual redeploy without code change

Vercel dashboard → Deployments → latest → **⋯ → Redeploy**. Use this when you've updated env vars and want them to take effect.

---

## Environment variables

Live in **Vercel → Project Settings → Environment Variables** for *Production* / *Preview* / *Development*. Mirror `.env.local.example` plus a few production-only secrets.

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All | Public, baked into client bundle |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | All | **Server only**; never exposed to browser |
| `NEXT_PUBLIC_APP_URL` | All | Production: `https://review.baamplatform.com`. Local dev: `http://localhost:4001` |
| `GOOGLE_CLIENT_ID` | All | OAuth client from `baam-platform` GCP project |
| `GOOGLE_CLIENT_SECRET` | All | Server only |
| `ANTHROPIC_API_KEY` | All | Server only; rotate yearly |
| `RESEND_API_KEY` | All | Server only |
| `RESEND_FROM` | All | Format: `Display Name <email@domain>`. Currently `No-Reply <no-reply@baamplatform.com>` |
| `TWILIO_ACCOUNT_SID` | All | Optional until A2P registration |
| `TWILIO_AUTH_TOKEN` | All | Same |
| `TWILIO_FROM_NUMBER` | All | E.164 (`+15551234567`) |

After updating any env var, **Redeploy** so it takes effect.

---

## Database migrations

Migrations live in [`supabase/migrations/`](../supabase/migrations/) numbered sequentially. They're append-only — never edit an applied migration.

### Applying a new migration to production

The fast path is the **Supabase SQL Editor**:

1. Open Supabase dashboard → `baam-review` project → SQL Editor → **+ New query**
2. Paste the contents of the migration file
3. Click **Run**

For larger or scripted workflows, use the Supabase CLI:

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <project-ref>   # one-time
supabase db push                             # applies any unapplied migration in supabase/migrations/
```

### Migrations applied so far

See [PROGRESS.md](PROGRESS.md#migrations-applied-to-production) for the list. Always check `information_schema.columns` after applying to confirm structure.

---

## Supabase configuration

In addition to the schema (managed by migrations), some Supabase settings are configured via the dashboard:

### Authentication → URL Configuration

- **Site URL**: `https://review.baamplatform.com`
- **Redirect URLs**: include both `https://review.baamplatform.com/**` and `http://localhost:4001/**`

When the domain migrates (see [DOMAIN_MIGRATION.md](DOMAIN_MIGRATION.md)), update both fields.

### Authentication → Providers → Email

- Email confirmation: **enabled**

### Storage → Buckets

- `logos` — created by migration 0005. Public bucket, 2MB limit, allowed MIME types: png/jpeg/webp/svg+xml.

---

## Resend configuration

### Verified sending domain

The `baamplatform.com` domain is verified in Resend so `no-reply@baamplatform.com` works as the default sender. DNS records (DKIM/SPF/DMARC) are configured at the domain registrar.

### Per-location custom senders

A customer can add their own domain in `/app/locations/[id]/settings` → Email sender section. When they do:

1. Customer enters `reviews@theirdomain.com` and a display name → Save
2. UI shows a yellow "needs verification" banner with a `mailto:support@baamplatform.com` link
3. **BAAM Studio admin (you)** receives the email and:
   - Adds the domain in Resend dashboard → Domains → Add Domain
   - Resend returns DKIM/SPF/DMARC records
   - Forwards records to the customer
4. Customer adds the records at their DNS provider (GoDaddy, Cloudflare, etc.)
5. Resend verifies → shows ✓ in the dashboard
6. **You flip the flag** in the Supabase SQL editor:
   ```sql
   UPDATE public.locations
   SET sender_verified_at = now()
   WHERE sender_email = 'reviews@theirdomain.com';
   ```
7. Next email from that location goes from `reviews@theirdomain.com`

### Resend webhooks

The Resend webhook endpoint is `https://review.baamplatform.com/api/webhooks/resend`. It handles `email.delivered`, `email.opened`, `email.bounced`, and `email.complained` events. Currently no signature verification — add `RESEND_WEBHOOK_SECRET` and verify the `svix-signature` header before going to scale.

**Setup steps (one-time per environment)**:

1. Resend dashboard → Webhooks → Add endpoint
2. URL: `https://review.baamplatform.com/api/webhooks/resend`
3. Events to subscribe: at minimum `email.delivered`, `email.opened`, `email.bounced`, `email.complained`
4. Save

Until the webhook is configured, `delivered_at` is set optimistically when the Resend API accepts the send (see [actions.ts](../app/app/send/actions.ts)). `opened_at` is never populated without the webhook. After the webhook is active, bounces clear `delivered_at` so the dashboard funnel reflects reality.

---

## Twilio configuration

### Setup (when SMS is ready)

1. Twilio Console → Buy a number (or use trial)
2. Phone number → Messaging → A message comes in → set to your webhook (not used currently)
3. Phone number → Messaging → Delivery status callback URL → `https://review.baamplatform.com/api/webhooks/twilio`
4. Set `TWILIO_*` env vars in Vercel
5. Redeploy

### A2P 10DLC registration

US SMS to consumer numbers requires Application-to-Person 10DLC registration. Process:

1. Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC
2. Register the brand (BAAM Studio, or the customer's business)
3. Register a campaign (Review collection)
4. Approval takes 4–6 weeks
5. Until approved, US SMS may be rate-limited or filtered

During the gap, email-only is the recommendation. Master plan §15 covers this trade-off.

---

## Google OAuth

### Where the OAuth client lives

We use the existing `baam-platform` GCP project's OAuth client. Credentials are in the `baam-platform` Google Cloud Console under APIs & Services → Credentials.

### Adding an authorized redirect URI

Required when the domain changes (see [DOMAIN_MIGRATION.md](DOMAIN_MIGRATION.md)):

1. GCP Console → `baam-platform` → APIs & Services → Credentials → BAAM Review OAuth client → Edit
2. Add to **Authorized JavaScript origins**: e.g., `https://newdomain.com`
3. Add to **Authorized redirect URIs**: e.g., `https://newdomain.com/api/auth/google/callback`
4. Save (no app redeploy needed; changes are immediate)

### OAuth verification status

The OAuth consent screen is currently in **Production** mode but the app is unverified. Users see Google's "Google hasn't verified this app" warning before consent.

For development and pilot users, the workflow is:

1. Switch OAuth consent screen to **Testing** mode (via Audience → Back to testing in the Google Auth Platform UI)
2. Add pilot user emails to **Test users**
3. Up to 100 test users can use the OAuth without seeing the warning

For full production, submit verification via the Verification Center:

- Required: live privacy policy URL, live terms of service URL, demo video showing the OAuth flow, domain ownership proof (TXT record), justification text per sensitive scope
- Approval takes 4–6 weeks
- Master plan §11 covers this

---

## Monitoring

Currently lightweight — no PostHog/Sentry/Datadog. Use these as your monitoring surface:

### Vercel dashboard

- **Logs** → Real-time function logs. Filter by route, error level. First place to look when a feature breaks.
- **Analytics** → Web Vitals + edge request stats.
- **Deployments** → Build success/failure history.

### Supabase dashboard

- **Logs** → Postgres query log, edge function log, API log.
- **Reports** → DB size, slow queries, RLS denials.

### In-app analytics (we built these)

| Page | What it surfaces |
|---|---|
| [/app](../app/app/page.tsx) | Per-account funnel (last 30 days) |
| [/app/reviews](../app/app/reviews/page.tsx) | Unread private feedback count → action items |
| [/app/analytics](../app/app/analytics/page.tsx) | Flagged requests (velocity-cap breaches) |

If an account is gaming us, the Flagged requests section is where you'd see it first.

### Email deliverability

Resend dashboard → Activity → search for the recipient. Shows whether the email was delivered, bounced, opened, etc.

If many emails land in Gmail Promotions, the cause is usually:

1. Generic "from" name (we fixed — uses location display name)
2. Marketing-style HTML body (we fixed — minimal plain-style)
3. No Reply-To (we fixed — set to the sending user)
4. Cold domain reputation — solution is to keep sending consistently for weeks, or move to a per-customer verified sender domain (see Sender configuration section above)

---

## Manual operations

### Suspending an abusive account

```sql
UPDATE public.accounts
SET suspended_at = now(),
    suspension_reason = 'Repeated sends to non-customers; reviewed 2026-05-11'
WHERE id = '<account-id>';
```

After this, every send attempt and every public submission (via [`accounts.suspended_at` check](../app/app/send/actions.ts)) is rejected. The flag is also checked by [`/api/draft`](../app/api/draft/route.ts).

To un-suspend:

```sql
UPDATE public.accounts
SET suspended_at = NULL, suspension_reason = NULL
WHERE id = '<account-id>';
```

### Clearing a stuck velocity flag

Velocity flags are advisory, not enforcement. To clear:

```sql
UPDATE public.review_requests
SET flagged_at = NULL, flag_reason = NULL
WHERE id = '<request-id>';
```

### Backfilling a feature for existing users

When a column is added with a `NOT NULL` default that doesn't match existing rows' intent, write a one-shot migration. Example pattern from [migration 0003](../supabase/migrations/0003_auth_trigger.sql):

```sql
WITH missing AS (
  SELECT au.id, au.email
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.id = au.id
  WHERE pu.id IS NULL
)
...
```

### Generating types from the Supabase schema

If the hand-maintained [`lib/database.types.ts`](../lib/database.types.ts) gets too painful, switch to the CLI generator:

```bash
supabase gen types typescript --linked > lib/database.types.ts
```

Keep an eye on the diff — the CLI includes `Relationships` arrays inferred from foreign keys, which improves embedded select type-inference.

### Rotating a key

1. Generate a new key in the provider's dashboard
2. Update the env var in Vercel
3. Redeploy
4. Confirm production works
5. Revoke the old key

Order matters — never revoke before the redeploy is live, or you'll have a window of broken production.

---

## What to monitor weekly

For the first 30 days post-launch, check these once a week:

| Check | Where | What to look for |
|---|---|---|
| Email deliverability | Resend → Activity | <1% bounce rate; opens >30% |
| Velocity flags | `/app/analytics` Flagged requests | Should usually be empty; investigate any rows |
| Private feedback inbox | `/app/reviews` Unread tab | Owner responsiveness is the metric here, but track that customers are using this path |
| Funnel conversion | `/app/analytics` | Target: >35% completion (vs ~10% industry baseline) |
| Vercel function errors | Vercel Logs | Anything in the `error` level |
| Supabase RLS denials | Supabase Logs → API | Bursts of RLS denials = misconfigured client or attacker probing |

---

## Common issues + fixes

### "Hydration mismatch" warnings in dev

Usually `window.*` referenced during render. Fix: use `useEffect` for browser-only logic, or replace with `process.env.NEXT_PUBLIC_*` for build-time constants. Seen once in [the send-form preview](../app/app/send/send-form.tsx).

### TypeScript fails on Vercel but passes locally

Almost always an out-of-date `pnpm-lock.yaml` or a `@types/*` package not in `devDependencies`. Run `pnpm install` locally and commit the lockfile. Don't trust `node_modules` cached state.

### Vercel "Module not found"

Same root cause — devDep not declared. Vercel does a clean install; your local node_modules might have it from a transient install.

### Google OAuth shows red triangle warning

OAuth consent screen is in Production mode with an unverified app. Either flip to Testing mode and add the user as a test user, or complete verification (4–6 weeks).

### Email from `no-reply@baamplatform.com` lands in Gmail Promotions

Expected for new sending domains. Three mitigations, in order:

1. Drag one email to Primary; Gmail learns from this for future sends to that user.
2. Set a per-location custom sender on a verified domain (see Sender configuration above).
3. Continue consistent sending over weeks; domain reputation matures.

### Customer's QR poster has Chinese characters stripped

Helvetica (the only font we embed in PDFs) can't render CJK. Either edit the location's `display_name` to be Latin-only, or wait for v2 to embed a Noto Sans SC subset.
