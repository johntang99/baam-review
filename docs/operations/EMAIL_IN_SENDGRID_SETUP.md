# Email-in via SendGrid Inbound Parse (receiving) — keeps GoDaddy + Resend-for-sending

Why SendGrid for *receiving*: Resend's inbound webhook is **metadata-only** (no email body), so it
can't feed the parser. SendGrid Inbound Parse POSTs the **full parsed email** (to/from/subject/text/
html) to our endpoint, which already supports it. Keep **Resend for sending**; SendGrid only handles
inbound. DNS stays at **GoDaddy** (one MX change).

> Code prerequisite: the inbound endpoint must accept `multipart/form-data` (SendGrid's format).
> Shipped — deploy before testing.

## Step 1 — Create a SendGrid account (free)
- sendgrid.com → **Start for Free** → sign up → verify email → enable **2FA** (required).
- Free plan includes Inbound Parse.

## Step 2 — Authenticate the domain (required to use it in Inbound Parse)
- Settings → **Sender Authentication** → **Authenticate Your Domain** → DNS host: GoDaddy, domain:
  `baamplatform.com`.
- SendGrid gives ~3 **CNAME** records → add them at GoDaddy → **Verify**. (These don't affect your
  Resend sending — different records.)

## Step 3 — Inbound Parse
- Settings → **Inbound Parse** → **Add Host & URL**:
  - **Subdomain:** `inbound`  · **Domain:** `baamplatform.com`
  - **Destination URL:** `https://baamreview.com/api/integrations/inbound-email?secret=<INBOUND_EMAIL_SECRET>`
  - **Leave "POST the raw, full MIME message" UNCHECKED** (we want parsed fields, not raw MIME).
  - Save.

## Step 4 — GoDaddy: point the inbound MX to SendGrid
- Edit the existing `inbound` MX record:
  - **Name:** `inbound` · **Value:** `mx.sendgrid.net` · **Priority:** `10`
  - (This **replaces** the old `inbound-smtp.us-east-1.amazonaws.com` value from the Resend attempt.)

## Step 5 — Vercel env + deploy
```
INBOUND_EMAIL_DOMAIN=inbound.baamplatform.com   # already set
INBOUND_EMAIL_SECRET=<the SAME secret used in the Step 3 URL>
```
Redeploy. (The `RESEND_INBOUND_SIGNING_SECRET` can stay; the SendGrid path uses the shared secret.)

## Step 6 — Test
1. Location Setup → Integrations · API keys → **Email-in** → copy `r-<token>@inbound.baamplatform.com`.
2. Forward an order/booking confirmation (one with a customer's name/email in the body) to it.
3. ✅ The contact appears in that location's **"Incoming · week of …"** queue.
   - Debug: SendGrid → Inbound Parse shows POST attempts; our endpoint returns `201 queued` /
     `200 skipped` / `401` (bad secret).

## Notes
- One Inbound Parse host (`inbound.baamplatform.com`) serves **all** locations; the `r-<token>`
  routes each email to the right business.
- Resend keeps doing **sending**; only the inbound **MX** moved to SendGrid.
- **Forward CUSTOMER confirmation emails** (order/booking) — they carry the customer's contact in the
  body. The parser **only** queues a real customer: it returns `no_contact` for internal/marketing/
  notification emails and **never** uses the forwarder/sender or business/role addresses (`support@`,
  `service@`, `no-reply`, `@baamplatform.com`, …). HTML-only emails are handled.
- The Inbound Parse URL's `?secret=` **must exactly equal** Vercel's `INBOUND_EMAIL_SECRET`, or the
  endpoint returns `401`.
- `INBOUND_EMAIL_SECRET` (shared) is what this path uses; `RESEND_INBOUND_SIGNING_SECRET` is only for
  the (currently unused) Resend Svix path and can be left set or removed.
