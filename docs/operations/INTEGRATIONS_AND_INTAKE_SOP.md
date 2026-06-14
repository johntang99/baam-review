# Integrations & Contact Intake — Implementation Plan + SOP

**Audience:** BAAM Review engineering + onboarding/sales.
**Purpose:** One reference for (a) how we connect to a business's POS / CRM / checkout to feed review requests, (b) the build plan and phases, and (c) the step‑by‑step SOP + tutorial the team uses when onboarding a client.

---

## 1. Core principle — *one pipeline, many front doors*

We already own the whole engine after a contact is captured:

```
contact in ─► AI personalized variation ─► send (SMS auto / Gmail one‑by‑one)
           ─► tokenized review link /r/<slug>?t=<token>
           ─► review‑flow page ─► routes to Google / Yelp / private feedback
           ─► tracking (delivered / opened / clicked / completed) + resend
```

An "integration" with an outside system does **one job only: deliver the customer contact into that pipeline.** Everything after is ours. So we do **not** build a different system per POS — we build **one intake contract** and a small ladder of *doors* that all drop the same payload into it.

**Three rules that never change:**

1. **Automate the input, never the email send.** Our deliverability moat is that a real person sends each email **one‑by‑one from the business's own Gmail** → Primary inbox. Third‑party ESPs (Resend/SendGrid) and programmatic Gmail‑API sends land in Promotions/Spam. Integrations populate a **queue**; the human still clicks "Send in Gmail." (SMS is exempt — see §7.)
2. **Pull the minimum data.** Only `name + email/phone + which location + "just transacted"`. Never card/payment data (keeps us out of PCI scope); minimize anything sensitive (PHI for clinics). Less data = faster client sign‑off + lower risk.
3. **It's a live feed, not a one‑time list.** The value is timing — ask while the visit is fresh. A static export is only for the initial backfill.

**The canonical payload every door produces:**

```json
{
  "location": "<baam location slug or id>",
  "name": "Jane Doe",
  "email": "jane@example.com",        // email and/or phone
  "phone": "+15551234567",
  "service": "Acupuncture",            // optional, for personalization
  "transacted_at": "2026-06-13T18:30:00Z",
  "external_id": "pos-txn-8842"        // optional, for dedupe/idempotency
}
```

---

## 2. Architecture — what feeds what

```
 ┌─────────── DOORS (intake) ───────────┐        ┌──────── BAAM pipeline (exists) ────────┐
 QR poster / link  ─────────────────────────────►  review‑flow page (no contact needed)
 Manual single send (app/app/send) ─────────────►  Ready‑to‑send queue ─► AI variation ─►
 CSV import (app/app/lists) ─────────────────────►        send: SMS auto (Twilio)
 Generic webhook/API  /api/integrations/... ─────►              + email draft → Gmail one‑by‑one
 Zapier / Make / n8n  → calls the webhook ───────►        tracking via review_requests / list_*
 Native connectors (Square/Clover/…) → webhook ──►        opt‑outs via opt_outs + /api/unsubscribe
 └───────────────────────────────────────┘        └────────────────────────────────────────┘
```

**Existing surfaces we reuse (do not rebuild):**

| Concern | Where |
|---|---|
| Single send + "Send in Gmail" | `app/app/send/` (`send-form.tsx`, `gmail-sender-editor.tsx`, `actions.ts`) |
| Bulk list flow (import → variations → send one‑by‑one) | `app/app/lists/`, tables `lists`, `list_customers`, `list_events` |
| Per‑request tracking | table `review_requests` (`delivered_at/opened_at/clicked_at`) + `/api/webhooks/{twilio,resend}` |
| Per‑location Gmail identity | `gmail_oauth_tokens`, `lib/google/gmail-oauth.ts`, `/api/auth/google/gmail/callback` |
| SMS | Twilio (`lib/messaging/twilio.ts`) |
| Opt‑out / suppression | `opt_outs`, `/api/unsubscribe` |
| QR poster + embeddable widget | `app/app/share/`, `/api/qr/[slug]`, `/api/widget`, `/api/embed.js` |
| Tokenized review link + flow | `/r/<slug>?t=<token>` |

**The net‑new pieces (all shipped):**

1. **The "Ready‑to‑send" queue** — an inbound contact lands as a pending `list_customers` row in a `source='integration'` list, **rolled weekly** (`window_key`), so it shows in the existing Bulk Review Requests screen auto‑populated instead of CSV‑uploaded.
2. **`POST /api/integrations/review-request`** — the universal door. Per‑location API key auth, dedupes on `external_id`, suppresses opt‑outs, rate‑limited (120/min + daily cap), appends to the queue.
3. **`GET /api/integrations/ping`** — connection test for no‑code tools.
4. **Per‑location API keys** — generate/reveal‑once/revoke + editable daily cap in Location Setup; stored hashed.

---

## 3. Implementation phases

> Sequencing principle: ship the **universal door first** (serves any capable client and is what Zapier/native connectors call later). Native connectors are surgical, added only where clients cluster.

### Phase 0 — Baseline (already shipped) ✅
- Manual single send, "Send in Gmail," bulk CSV lists, QR poster + widget, SMS, tracking, opt‑outs, per‑location Gmail.
- **This already serves the low‑tech long tail today.** No client is blocked.

### Phase 1 — Queue contract (foundation) ✅ shipped
- `enqueueReviewRequest(payload)` ([lib/integrations/enqueue.ts](../../lib/integrations/enqueue.ts)): maps `location` (slug or id), normalizes contact, checks `opt_outs`, real **60‑day dedupe**, idempotent on `external_id`, appends a pending `list_customers` row.
- **Rolling weekly:** contacts land in that location's **current‑week** integration list (`source='integration'`, `window_key` = that Monday), named `"Incoming · week of <Mon>"`. Each week is a bounded batch; the list never grows unbounded. (migrations 0052, 0055)
- Email → the one‑by‑one Gmail queue; channel defaults to email when present. Tested: `scripts/test-enqueue.mts`.

### Phase 2 — Universal webhook/API + keys (highest leverage) ⭐ ✅ shipped
- `POST /api/integrations/review-request` — `Bearer <key>` → location derived from the key → `enqueueReviewRequest`. `201` queued · `200` skipped (duplicate/opted_out/no_contact) · `401` bad key · `429` rate‑limited. ([route](../../app/api/integrations/review-request/route.ts))
- Per‑location API keys (hash‑only) + **Location Setup → Integrations · API keys** UI: generate / reveal‑once / revoke + **editable per‑key daily cap**. (migrations 0053, 0054)
- **Rate limiting:** 120/min burst + per‑location daily cap (default 5,000, editable) via the atomic `api_key_consume` DB function. Tested: `test-intake-endpoint.mts`, `test-rate-limit.mts`.

### Phase 3 — No‑code (Zapier / Make / n8n) ✅ shipped
- `GET /api/integrations/ping` — connection test returning `{ ok, location }` so each tool's "Test connection" shows the business. ([route](../../app/api/integrations/ping/route.ts), test: `test-ping.mts`)
- Clients connect via each tool's **generic HTTP action** today (recipes in §6, Door 5) — reaches thousands of apps with no per‑connector code. A branded directory app is a later productization step.

### Phase 4 — Native connectors (surgical, by vertical) — *not built; demand‑driven*
- **Build only where our clients concentrate.** Each = OAuth app + subscribe to their transaction/appointment webhook → call Phase‑2 endpoint internally. Candidate first connectors:
  - **Square / Clover / Toast** (restaurants, retail, salons)
  - **Calendly / Acuity / Square Appointments** (appointment businesses)
  - **One dental/medical PMS** (if clinics dominate the book)
  - **Shopify / WooCommerce** (e‑commerce / pickup)
- **Acceptance:** client clicks "Connect Square," authorizes, a test sale enqueues a request with no further setup.

### Phase 5 — Managed onboarding (ops, our default delivery)
The operational layer that makes "cover every client" real. Runbook below (§5.1).

> **Coverage is already complete (Phases 0–3).** Every client connects through one of: no‑code (Zapier/Make/n8n → thousands of apps), direct webhook + key, CSV, or QR/manual — plus our team doing setup. Native connectors (Phase 4) are an *optional convenience* for recurring systems, not how breadth is achieved. Don't chase a connector per system.

---

## 4. Connection catalog — every kind of system a business might have

Use this to recognize what a client has and pick the door. **"Gives contact?"** = does the system capture/expose customer email or phone. **Method** = how we get it today.

### A. Point of Sale / Checkout (in‑person)
| System | Gives contact? | Method | Notes |
|---|---|---|---|
| Square | Often (email/phone at checkout, loyalty) | Native (OAuth + webhook) / Zapier | Strong API; good first connector |
| Clover | Sometimes | Native / Zapier | Customer object if cashier captures it |
| Toast (restaurants) | Online orders yes; dine‑in often no | Native / Zapier | Dine‑in cash = no contact → QR fallback |
| Shopify POS / Lightspeed / Square Retail | Often | Native / Zapier / CSV | Retail loyalty captures contact |
| Generic/old cash register | **No** | **QR poster only** | No contact exists to pull |

### B. CRM
| System | Gives contact? | Method | Notes |
|---|---|---|---|
| HubSpot / Salesforce / Zoho / Pipedrive | Yes | Zapier / native / webhook | Trigger on "deal won" / "ticket closed" |
| GoHighLevel (agencies) | Yes | Webhook / Zapier | Common in local‑marketing world |
| Spreadsheet "CRM" (Google Sheets/Excel) | Yes | CSV import / Zapier(Sheets) | Most SMBs live here |

### C. Appointments / Booking
| System | Gives contact? | Method | Notes |
|---|---|---|---|
| Calendly / Acuity / Square Appointments | Yes | Zapier / native | Trigger on "appointment completed" |
| Booksy / Vagaro / Fresha (salon/spa) | Yes | Zapier / CSV | Beauty vertical |
| OpenTable / Resy (restaurants) | Limited | CSV / manual | Reservation ≠ guaranteed contact |

### D. Field service / home services
| System | Gives contact? | Method | Notes |
|---|---|---|---|
| Jobber / Housecall Pro / ServiceTitan | Yes | Zapier / native / webhook | Trigger on "job completed / invoice paid" |

### E. E‑commerce / online
| System | Gives contact? | Method | Notes |
|---|---|---|---|
| Shopify / WooCommerce / BigCommerce | Yes (email always) | Native / Zapier / webhook | Trigger on "order fulfilled" |
| Stripe / Square Online checkout | Yes (email) | Webhook | Use *fulfillment*, not payment, as trigger |

### F. Healthcare / dental (clinic vertical)
| System | Gives contact? | Method | Notes |
|---|---|---|---|
| Dentrix / Open Dental / athenahealth / Jane | Yes | Native (1 PMS) / CSV / managed | **Minimize PHI** — name + contact + "visited" only; check BAA needs |

### G. Hospitality / other
| PMS (Cloudbeds, Mews), Mindbody (fitness), POS variants | Usually | Zapier / native / CSV | Same pattern: event → contact |

### H. No system / minimal
| Reality | Method |
|---|---|
| Walk‑ins, cash, no contact captured | **QR poster / link on receipt + manual single send** |
| Keeps a notebook / phone contacts | Manual entry / CSV |

> **Rule of thumb:** if a system can fire "a customer just transacted" and exposes their email/phone, it fits the webhook (directly, via Zapier, or a native connector). If it can't, fall back to **QR + manual** — which needs no integration at all.

---

## 5. Client intake SOP (how to ask)

Run this at onboarding. Two questions decide everything.

**Q1 — "Do you collect a customer's email or phone number when they pay or book?"**
- **No** → there is nothing to integrate. Path = **QR poster + link + manual send**. Stop here; set up the poster/widget.
- **Yes** → continue.

**Q2 — "What software do you use to ring up sales / book appointments / track customers?"** (get the exact product name)
- Map the answer to the catalog (§4) → pick a door using the decision tree below.

**Q3 (scope) — "Do you want a request sent automatically after every visit, or do you prefer to review a list and send yourself?"**
- Automatic SMS is fine to auto‑send; **email always routes to the one‑by‑one Gmail queue** regardless (explain the Primary‑inbox reason).

### Decision tree → which door
```
Captures contact? ── No ─► QR poster + manual send                (Phase 0)
        │
        Yes
        │
Has a connectable system? ── No (paper/Sheets) ─► CSV import / Sheets→Zapier   (Phase 0 / 3)
        │
        Yes
        │
Client technical / has IT? ── Yes ─► Generic webhook + API key    (Phase 2)
        │
        No
        │
System is in our native list? ── Yes ─► Native connector (Square/…)(Phase 4)
        │
        No
        │
        └─► Zapier/Make (self‑serve) OR we build the n8n flow (managed) (Phase 3/5)
```

### Always also set up (belt‑and‑suspenders)
- **QR poster + review link** for in‑store walk‑ins, even when an integration exists (catches the contacts the system misses).
- Confirm the **business's Gmail is connected** (per‑location) so sends come from them → Primary inbox + recognition.

### 5.1 Managed onboarding runbook (per client — Phase 5)
The end‑to‑end process the team runs for each new client. Works for **any** client because every branch lands in the same queue.

1. **Triage** — ask Q1/Q2/Q3 (above) → pick a door from the decision tree.
2. **Connect the location's Gmail** (Location Setup → Email Sender) and send yourself a test → confirm it lands in **Primary**. *(Deliverability prerequisite — do this before anything else.)*
3. **Generate the QR poster** (Widget & QR poster) — always, regardless of door.
4. **Set up the chosen door:**
   - *No system / walk‑ins* → poster only. Done.
   - *Spreadsheet* → import CSV (or a recurring export).
   - *Has a SaaS, non‑technical* → **we build their Zapier/Make/n8n flow** (Door 5): trigger in their app → HTTP `POST` to the endpoint with their key. (Generate the key in Location Setup → Integrations · API keys.)
   - *Has a dev / custom system* → hand them the key + the endpoints reference (§6); they call it directly.
5. **Set the daily cap** if the client is high‑volume (Location Setup → Integrations · API keys → edit "Daily cap" on the key; default 5,000/day).
6. **Verify end‑to‑end:** `GET …/ping` shows the right business → push one **test contact** → it appears in this week's **"Incoming · week of …"** list → generate variations → it's ready to Send in Gmail. Then delete the test contact.
7. **Show the owner/staff** the Bulk Review Requests queue and the one‑by‑one "Send in Gmail" step (email) / "SMS all" (text).
8. **Hand off** + note the door used on the client record.

Use the **go‑live checklist (§9)** to confirm nothing's missed. After this, contacts flow in automatically (weekly batches), the team reviews + sends, and the second‑touch/resend logic handles non‑responders.

---

## 6. Setup tutorials (how to make the connection)

### Door 1 — QR poster / link (no integration)
1. `app/app/share` → generate the location's QR poster + short link (`/r/<slug>`).
2. Client prints it for the counter / adds the link to receipts/booking confirmations.
3. Customer scans → review‑flow page directly (no contact needed).

### Door 2 — Manual single send
1. `app/app/send` → enter name + email/phone, pick channel, AI writes the message.
2. Email → **Send in Gmail** (one‑by‑one). SMS → send.

### Door 3 — CSV import (backfill or recurring)
1. `app/app/lists` → New list → upload CSV (`name,email,phone`).
2. Generate variations → send in Gmail one‑by‑one / auto‑SMS.
3. For recurring: client exports weekly from their system → upload (or automate the export via Zapier in Door 4).

### Endpoints reference (Phase 2/3)
Two endpoints, authenticated by a per‑location key (`Authorization: Bearer <key>` or `x-api-key: <key>`):

| Method · Path | Use |
|---|---|
| `GET /api/integrations/ping` | **Connection test.** Returns `{ ok, location: { id, name } }` so a tool's "Test connection" shows the business. Doesn't consume rate budget. |
| `POST /api/integrations/review-request` | **Send a contact.** Body below. `201` queued · `200` skipped (duplicate/opted_out/no_contact) · `401` bad key · `429` rate‑limited (120/min; daily cap per location). |

Body for POST (email and/or phone required; everything else optional):
```json
{ "name":"Jane Doe", "email":"jane@x.com", "phone":"+15551234567",
  "service":"Haircut", "language":"en", "transacted_at":"2026-06-13T18:30:00Z",
  "external_id":"txn-123" }
```
Trigger on the **fulfillment / visit‑complete** event (not payment auth). `external_id` makes retries idempotent. Location is derived from the key — never sent in the body.

### Door 4 — Generic webhook / API (Phase 2)
1. Location Setup → **Integrations · API keys** → generate a key (copy once).
2. Give the client/developer the endpoint + payload above.
3. Trigger on their fulfillment/visit‑complete event.
4. Verify: `curl` the `ping` endpoint → confirms the location; then POST a test contact → it appears in the current week's "Incoming · week of …" queue.

### Door 5 — No‑code: Zapier / Make / n8n
All three call the same endpoint; pick whichever the client uses. **Auth** in each = a header `Authorization: Bearer <LOCATION_API_KEY>`; **connection test** = `GET …/ping`.

**Zapier** (best for non‑technical clients — biggest app directory):
1. New Zap → **Trigger** = the client's app event ("Appointment completed", "Order fulfilled", "Invoice paid", "Deal won").
2. **Action** = **Webhooks by Zapier → Custom Request**.
   - Method `POST`, URL `https://baamreview.com/api/integrations/review-request`
   - Headers: `Authorization: Bearer <KEY>`, `Content-Type: application/json`
   - Data (JSON): map trigger fields → `name`, `email`, `phone`, `service`, `external_id` (use the trigger's record id).
3. **Test** the step → expect `201` / `{"status":"queued"}`. Turn on.

**Make (Integromat):**
1. Scenario → trigger module = the client's app.
2. Add an **HTTP → Make a request** module: `POST` the URL, add the `Authorization` header, body = JSON with mapped fields.
3. Run once to test → `201`. Schedule on.

**n8n** (self‑host; our internal managed engine, or a technical client):
1. Trigger node = the client's app (or a Schedule + their API).
2. **HTTP Request** node: `POST` the URL, Authentication = "Header Auth" (`Authorization: Bearer <KEY>`), JSON body with mapped fields.
3. Execute to test → `201`. Activate.

**Managed variant:** for clients who can't self‑serve, we build the Zapier Zap or the n8n workflow *for* them (Phase 5). The contact still lands in their queue; email still goes out one‑by‑one from their Gmail.

> A branded "BAAM Review" Zapier/Make app (so clients pick it from the directory instead of the generic HTTP module) is a later productization step — build it once the generic‑HTTP path shows real demand. The endpoints above are already everything such an app would wrap.

### Door 6 — Native connector (Phase 4)
1. Location Setup → **Connect [Square/Clover/…]** → OAuth authorize.
2. We auto‑subscribe to their transaction/appointment webhook → enqueue on each event.
3. Verify with a test sale.

### Door 7 — Managed onboarding (Full Service)
1. Run §5 discovery → pick door.
2. We do the setup (key + Zapier/n8n flow, or native connect, or scheduled CSV).
3. Test, confirm queue populates, confirm sends land in Primary, hand over.

---

## 7. Sending & deliverability rules (do not break)

- **Email = human, one‑by‑one, from the business's Gmail.** Integrations only *queue/draft*; they never auto‑send email. (Optional enhancement: auto‑create a Gmail **draft** so staff just click Send — verify it still lands in Primary before relying on it.)
- **SMS may auto‑send** on the trigger (Twilio → phone, no Promotions problem). Default: auto‑SMS + email‑to‑queue.
- **From identity:** always the business's connected Gmail / sending identity, never a generic BAAM address.
- **Cadence:** keep email spaced and content **uniquely AI‑varied per recipient** — this is part of why one‑by‑one stays in Primary.

---

## 8. Data, privacy & compliance

- **Minimum fields only:** `name`, `email/phone`, `location`, `transacted_at`, optional `service`/`external_id`. **Never** ingest card/payment data → out of PCI scope.
- **PHI (clinics):** name + contact + "visited" only — no diagnoses/treatment detail. Check whether a BAA is needed before connecting a medical PMS.
- **Consent / opt‑out:** every send respects `opt_outs`; `/api/unsubscribe` + SMS STOP suppress future sends. Honor the client's own consent state if they pass it.
- **Location mapping:** every inbound payload must resolve to exactly one BAAM location (so it sends from the right Gmail and routes to the right Google listing). Reject/flag unmatched.
- **Keys:** per‑location API keys stored hashed, revealed once, rotatable, revocable. Webhook/native connectors verify signatures (mirror the Stripe/Resend pattern).

---

## 9. Go‑live checklist (per client)

- [ ] Q1/Q2/Q3 discovery answered; door chosen via decision tree.
- [ ] Business Gmail connected (per‑location) → test email lands in **Primary**.
- [ ] QR poster generated (always).
- [ ] Chosen door configured (key issued / Zapier on / native connected / CSV scheduled).
- [ ] One **test contact** flows end‑to‑end: door → queue → AI variation → send → review‑flow → tracked.
- [ ] Opt‑out path verified (unsubscribe / STOP suppresses).
- [ ] Channel preference set (auto‑SMS yes/no; email always queued).
- [ ] Owner shown the Bulk Review Requests queue + how to "Send in Gmail."

---

## 10. FAQ / troubleshooting

- **"They use a system we don't have a connector for."** → Webhook (if they have a dev) or Zapier/n8n. Don't build a native connector for one client.
- **"They capture no contact at checkout."** → QR + manual only; integration is impossible, and that's fine.
- **"Can we just auto‑send the emails?"** → No. That's the exact thing that lands in Promotions. Auto‑SMS yes; email stays human one‑by‑one.
- **"Requests aren't appearing."** → check API key/location mapping, signature, opt‑out suppression, dedupe on `external_id`.
- **"Sender lands in Promotions."** → confirm sending from the business's connected Gmail via the one‑by‑one flow, not an ESP/Gmail‑API blast; confirm AI variations are unique.

---

### TL;DR for the team
Ask **"do you capture email/phone?"** and **"what system do you use?"** → pick a door from the tree. Every door does the same thing: **drops the customer's contact into our queue.** We send it — SMS automatically, email by hand from their Gmail — and own everything after. Build the **universal webhook (Phase 2)** first; add native connectors only where clients pile up.
