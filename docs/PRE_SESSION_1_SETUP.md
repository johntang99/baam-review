# Pre-Session 1 Setup

*Five minutes of manual setup before you open Claude Code. Do these in order, then paste `SESSION_1_BRIEF.md` into Claude Code.*

---

## Step 1 — Folder and git (30 seconds)

```bash
cd ~/path/to/clients
mkdir baam-review
cd baam-review
git init
```

Sits alongside your other projects in `clients/` (next to `baam`, `baam-local`, `Baam-Utilities`, the vertical templates, etc.). Independence comes from separate git repo + separate Supabase + separate Vercel deploy, not from folder location.

## Step 2 — Supabase project (2 minutes)

1. Go to supabase.com, sign in
2. Click **New project**
3. Name: `baam-review` (separate from any existing BAAM project)
4. Region: closest to your users (for NY metro: `us-east-1`)
5. Generate and save a strong database password
6. Wait ~30 seconds for provisioning
7. From the project's **Settings → API** page, capture:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public key**
   - **service_role key** (keep this secret — server-only)

Paste these into a temporary local note or password manager. Claude Code will ask for them during Session 1.

## Step 3 — DNS for the subdomain (1 minute setup, up to ~30 min propagation)

Wherever `baamplatform.com` DNS is managed (Cloudflare, GoDaddy, Namecheap, Vercel DNS, etc.), add a CNAME record:

```
Type:   CNAME
Name:   review
Value:  cname.vercel-dns.com
TTL:    Auto (or 3600)
```

Don't worry about waiting for propagation before starting Claude Code — Session 1 can scaffold and deploy in parallel with DNS propagating. By the time Session 1 is ready to verify the live URL, DNS will be live.

## Step 4 — GitHub repo (1 minute, optional but recommended)

Create an empty repo on GitHub named `baam-review` (private). Don't initialize with a README — let Claude Code generate one. Then:

```bash
git remote add origin git@github.com:YOUR_USERNAME/baam-review.git
```

You can defer this to Session 1 if you prefer; Claude Code will offer to do it.

## Step 5 — API keys you'll need eventually (gather as you go)

You don't need these for Session 1, but capturing them now means no interruptions later:

| Service | When needed | Where to get |
|---|---|---|
| Anthropic API key | Session 6 | console.anthropic.com → API keys |
| Twilio account SID + auth token | Session 7 | console.twilio.com |
| Resend API key | Session 7 | resend.com |
| Stripe secret + publishable keys | Session 11 | dashboard.stripe.com |

Google Business Profile OAuth uses your existing `baam-platform` Google Cloud project. Session 3 will walk through creating a new OAuth client inside that project — no new project needed.

## Step 6 — Open Claude Code and paste

```bash
cd baam-review
claude  # or however you launch Claude Code
```

Then paste the entire contents of `SESSION_1_BRIEF.md` as your first message.

Claude Code will ask the three confirmation questions from the brief (Supabase ready? DNS configured? template preference?). Answer those, and Session 1 begins.

---

## What "Session 1 done" looks like

- A working Next.js 15 + Supabase scaffold in `baam-review/`
- Login and signup pages working against the live Supabase project
- Empty admin shell at `/app` (sidebar, welcome message, logout)
- Deployed to Vercel and reachable at `https://review.baamplatform.com`
- README with setup instructions

When that's true, message me back and we go to Session 2 (schema + RLS).
