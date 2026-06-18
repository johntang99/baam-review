# Email-in via Cloudflare Email Routing — setup

Receives a business's forwarded confirmation emails and feeds them into BAAM Review (Door 7 /
INTEGRATION_BRIDGES_PLAN Item 1). Cloudflare receives the mail → an Email Worker POSTs it to
`/api/integrations/inbound-email`. **Free.** Keep Resend for *sending*; this is only for *receiving*.

## Prerequisite
`baamplatform.com`'s DNS must be on **Cloudflare** (the domain is a Cloudflare zone). If it's not,
either move DNS to Cloudflare or use a different inbound provider.

## Step 0 — pick the receiving address: root vs subdomain
**Do you already receive email at `@baamplatform.com` (real mailboxes, e.g. Google Workspace)?**
- **No** → simplest: receive on the root. Use `INBOUND_EMAIL_DOMAIN=baamplatform.com`.
- **Yes** → DON'T touch the root MX. Use a **subdomain**: `INBOUND_EMAIL_DOMAIN=inbound.baamplatform.com`
  (recommended). Enabling Email Routing changes MX, so isolating to a subdomain protects your existing mail.

## Step 1 — set the app env (Vercel → baam-review → Settings → Env, then redeploy)
```
INBOUND_EMAIL_DOMAIN=inbound.baamplatform.com   # or baamplatform.com
INBOUND_EMAIL_SECRET=<openssl rand -hex 32>
```

## Step 2 — deploy the Worker
From `infra/cloudflare-inbound-email-worker/`:
```bash
npm install
npx wrangler login
npx wrangler secret put INBOUND_EMAIL_SECRET   # paste the SAME value as Step 1
npx wrangler deploy
```

## Step 3 — enable Email Routing + bind the Worker
Cloudflare dashboard → `baamplatform.com` → **Email → Email Routing**:
1. **Enable Email Routing.** Cloudflare adds the MX + SPF records.
   - *Root case:* it sets MX on `baamplatform.com`. Only do this if you don't receive mail there.
   - *Subdomain case:* enable Email Routing, then **manually add the same three MX records Cloudflare
     shows, but for the `inbound` subdomain** (host `inbound`, pointing to `route1/2/3.mx.cloudflare.net`),
     plus the SPF `TXT` on `inbound`. (Cloudflare's email MX hostnames are shown in the Email Routing
     DNS panel.)
2. **Email Workers** tab → find `baam-inbound-email` → **Create route / Set as catch-all** so any
   address on the domain (`r-*@…`) is delivered to the Worker.
   - If asked for a destination address rule, use the **catch-all → send to Worker** option.

## Step 4 — test
1. Open a location in BAAM Review → Location Setup → Integrations · API keys → **Email-in**; copy its
   address `r-<token>@inbound.baamplatform.com`.
2. From any inbox, **forward a real order/booking confirmation email** to that address.
3. Within a few seconds it appears in that location's **"Incoming · week of …"** queue.
   - Worker logs: `npx wrangler tail`. App responses: `201` queued · `200` skipped · `401` bad secret.

## Step 5 — onboard a business
Have the business add an **auto-forward rule** (Gmail: Settings → Filters → forward matching "order
confirmed/new booking" emails) to their location's `r-<token>@…` address. Done — no API, no Zapier.

## Notes
- One Worker + one domain serves **all** locations; the `r-<token>` part routes to the right business.
- The Worker accepts every email (no bounce); irrelevant emails just yield `no_contact` and are dropped.
- Secret must match on both sides (app env ↔ `wrangler secret`).
