# Email-in via Resend Inbound — ⚠️ DOES NOT WORK FOR RECEIVING (use SendGrid)

> **Outcome of the trial:** Resend's inbound (`email.received`) webhook delivers **metadata only**
> — `from`, `to`, `subject`, `email_id` — with **no email body** (`text`/`html`), and there is **no
> API to fetch the body** (`GET /emails/{id}` → 404 for received mail). Since the customer's
> contact lives in the **body**, Resend inbound cannot feed the parser.
>
> ✅ **Use [EMAIL_IN_SENDGRID_SETUP.md](EMAIL_IN_SENDGRID_SETUP.md) for *receiving*.** Keep **Resend
> for *sending*** review requests — that part works great.

## What we kept from the Resend attempt
- The inbound **subdomain** `inbound.baamplatform.com` and the per-location addresses
  `r-<token>@inbound.baamplatform.com` are unchanged — only the **MX** moved from Resend/AWS
  (`inbound-smtp.us-east-1.amazonaws.com`) to **SendGrid** (`mx.sendgrid.net`).
- The endpoint still *supports* Resend's Svix-signed JSON (via `RESEND_INBOUND_SIGNING_SECRET`) in
  case Resend ships full-body inbound later — but today the live path is SendGrid's
  `multipart/form-data` + shared `INBOUND_EMAIL_SECRET`.

## Why this matters (for staff)
Resend is a **sending** ESP first. "Receiving + parse to webhook" is a different capability; the
mature, body-delivering options are **SendGrid Inbound Parse**, **Mailgun Routes**, or **Cloudflare
Email Routing**. We chose SendGrid because it keeps GoDaddy DNS and our endpoint already supports its
payload.
