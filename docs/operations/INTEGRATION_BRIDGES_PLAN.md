# Integration Bridges — Cheaper, Powerful Alternatives to Zapier

**Problem.** BAAM Review must pull each business's customers (name + email/phone) into the review
queue. Most SMBs **don't** have Zapier or a similar paid bridge, and Zapier costs ~$20–30/mo each
(task-based). We need cheaper, more powerful paths that cover every kind of business.

**Principle — *one pipeline, many front doors*.** Everything ultimately calls
`enqueueReviewRequest` (the universal door is `POST /api/integrations/review-request`; native
vendors use `POST /api/integrations/<provider>`). A "bridge" is only needed when a business uses a
SaaS we don't natively connect **and** we can't add code. Use the **highest rung that fits** below.

---

## The ladder (cheapest / most-native first)

### Rung 1 — No bridge: native webhooks (FREE)
The vendor POSTs its own webhook straight to our endpoint. No Zapier, $0. Add a one-file
**provider adapter** per vendor (`lib/integrations/providers/`). Live: Shopify, Calendly, Acuity.

### Rung 2 — The "no real system" majority (≈ FREE)
- **📧 Email-in parsing** — every business gets order/booking **confirmation emails**. They set an
  auto-forward rule → a per-location BAAM inbound address → we parse the customer contact → enqueue.
  Works for **any** business with zero integration on their side. Near-free (Cloudflare Email
  Routing / Resend inbound). **Widest, cheapest net.**
- **CSV / Google Sheets** — upload a weekly list, or a tiny Apps Script auto-POSTs new rows. $0.

### Rung 3 — One central bridge WE run (flat cost, scales) — *the Zapier replacement*
- **⭐ n8n (self-hosted)** — open-source, **no per-task fees**. One ~$5–12/mo VPS runs workflows for
  **all** clients. More powerful than Zapier (code nodes, branching, 400+ apps).
- Alternatives: **Pipedream** (generous free tier) / **Make** (~$9/mo, cheaper than Zapier).

### Rung 4 — Zapier (last resort)
Only when the client already uses it; **they** pay their own account (free tier ≤100 tasks/mo).

### Always-on fallback — QR / review link (FREE)
Walk-in / no-contact businesses: QR poster + link. No integration, no contact capture. *(Shipped.)*

---

## Cost / power

| Option | Maintainer | Cost | Power | Status |
|---|---|---|---|---|
| Native webhook (adapter) | one-time dev | **$0** | High (per vendor) | Shipped + expanding |
| Email-in parser | BAAM (build once) | **≈$0** | Universal | **To build** |
| CSV / Sheets script | client/BAAM | **$0** | Simple | CSV shipped; script to add |
| n8n self-hosted | BAAM ops | **~$5–12/mo for ALL** | Very high | Runbook to add |
| Pipedream / Make | BAAM | free–$10/mo | High | Optional |
| Zapier | client | $0–30/mo each | High | Documented |
| QR / link | none | $0 | Fallback | Shipped |

---

## Implementation roadmap (tick off one by one)

- [x] **1. Email-in parser** — ✅ built. Endpoint `POST /api/integrations/inbound-email`, per-location
      token (migration `0059`), AI+regex extractor (verified — picks the customer, ignores
      business/no-reply), address shown in Location Setup. **Remaining (ops):** apply `0059`, set
      `INBOUND_EMAIL_DOMAIN`/`INBOUND_EMAIL_SECRET`, and wire an inbound provider (Cloudflare Email
      Routing / Resend). Docs: SOP Door 7.
- [x] **2. n8n self-hosting runbook + reusable workflow template** — ✅ [N8N_BRIDGE_RUNBOOK.md](N8N_BRIDGE_RUNBOOK.md) + importable [templates/n8n-baam-review-bridge.json](templates/n8n-baam-review-bridge.json) (validated). *Ops: stand up the VPS when first needed.*
- [x] **3. Native adapter expansion** — ✅ added & tested: **Stripe, WooCommerce, Cal.com, Typeform**
      (`lib/integrations/providers/`). *(Jotform deferred — fully form-defined payload; use email-in or n8n.)*
- [x] **4. CSV / Google Sheets auto-push** — ✅ Apps Script snippet in SOP Door 3 (CSV import already shipped).
- [x] **5. Docs** — ✅ SOP updated: Door 7 (email-in), Door 6 provider list, Door 3 (Sheets); n8n runbook.

> Recommended standing stack: **native webhook → email-in → n8n (managed) → CSV/QR**, with Zapier
> only when a client already has it. We should almost never pay Zapier.

---

## Item 1 — Email-in parser (design)
- **Address:** `r-<token>@<INBOUND_EMAIL_DOMAIN>` — `token` is a per-location random string
  (`locations.inbound_email_token`). The business forwards their "new order/booking" emails there.
- **Transport:** the inbound provider (Cloudflare Email Routing → Worker, or Resend inbound webhook)
  POSTs the parsed email to `POST /api/integrations/inbound-email` as
  `{ to, from, subject, text }`, authenticated by a shared `INBOUND_EMAIL_SECRET`.
- **Resolve location:** extract `<token>` from the `to` address → look up the location.
- **Extract contact:** Claude Haiku (cheap) pulls `{name,email,phone,service}` from
  subject+from+body; regex fallback for email/phone if AI is unavailable. Never the business's own
  address (filter known sender domains / no-reply).
- **Enqueue:** `enqueueReviewRequest` with `externalId` = a stable hash of the message → idempotent.
- **Surface:** show the location's inbound address in Location Setup → Integrations (copy button).
