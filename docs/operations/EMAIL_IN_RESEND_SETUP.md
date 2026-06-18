# Email-in via Resend Inbound (all-Resend, keep GoDaddy DNS)

The chosen path: receive forwarded confirmation emails through **Resend** (same vendor you use for
sending), no DNS migration. Resend receives mail on a subdomain and sends a **signed webhook** to
`/api/integrations/inbound-email`, which verifies the signature, parses the customer, and queues them.

> Why a subdomain: `baamplatform.com`'s root MX is **Google Workspace** — don't touch it. Receive on
> **`inbound.baamplatform.com`** instead.

## Step 1 — app env (Vercel → baam-review → Settings → Env, then redeploy)
```
INBOUND_EMAIL_DOMAIN=inbound.baamplatform.com
RESEND_INBOUND_SIGNING_SECRET=<the Resend webhook signing secret, whsec_…>   # filled after Step 3
```
(`INBOUND_EMAIL_SECRET` is only needed if you ALSO use a non-Resend provider; the Resend path uses
the signed-webhook secret instead.)

## Step 2 — set up receiving in Resend
1. In Resend, add/verify the **receiving domain `inbound.baamplatform.com`** (Domains → add, choose
   receiving/inbound if prompted). Resend shows the **MX** (and any TXT) records to add.
2. In **GoDaddy DNS**, add those records on the **`inbound`** host (e.g. MX `inbound` → Resend's MX
   value, plus any verification TXT). Leave the root domain untouched.

## Step 3 — point Resend's webhook at us
1. Resend → **Webhooks** → **Add Endpoint**: `https://baamreview.com/api/integrations/inbound-email`
2. Subscribe to the **inbound email received** event.
3. Copy the endpoint's **Signing Secret** (`whsec_…`) → set it as `RESEND_INBOUND_SIGNING_SECRET`
   (Step 1) → redeploy.

Our endpoint verifies the Svix/Standard-Webhooks signature (`svix-*` / `webhook-*` headers) against
that secret, and reads Resend's nested `{ data: { from, to, subject, text } }` payload (it's also
tolerant of flat payloads, so SendGrid/Mailgun/Cloudflare still work via `INBOUND_EMAIL_SECRET`).

## Step 4 — test
1. Location Setup → Integrations · API keys → **Email-in** → copy `r-<token>@inbound.baamplatform.com`.
2. Forward a real order/booking confirmation email to it.
3. It appears in that location's **"Incoming · week of …"** queue. Responses: `201` queued · `200`
   skipped (no_contact/duplicate/no_location) · `401` bad signature.

## Step 5 — onboard a business
They add a Gmail/Outlook **auto-forward rule** for "order confirmed / new booking" emails → their
`r-<token>@…` address. No API, no Zapier.

## Notes
- One Resend receiving domain + one webhook serves **all** locations; `r-<token>` routes each email.
- If Resend's inbound event name/shape differs from expectations, the endpoint is intentionally
  tolerant (nested `data.*` or flat; `to` as string/array/object). Check `wrangler`-style logs via
  Vercel function logs if a message doesn't land.
