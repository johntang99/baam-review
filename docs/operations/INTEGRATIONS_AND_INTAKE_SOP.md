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

### Phase 4 — Native connectors (surgical, by vertical)
- **(a) Direct webhook adapters — ✅ shipped.** `POST /api/integrations/<provider>?key=<key>` → a per-provider mapper (`lib/integrations/providers/`) translates the vendor's native webhook → the queue. No Zapier, no OAuth — for vendors whose payload carries the contact. Live: **Shopify** (`orders/fulfilled`), **Calendly** (`invitee.created`). Adding one = a single adapter file. Tested: `scripts/test-providers.mts`. See §6 Door 6.
- **(b) Credential connectors — Acuity ✅ shipped.** Vendors whose webhook returns only an id need stored creds + an API fetch. **Acuity** is live via API-key mode (client pastes User ID + API Key in Location Setup → Native connectors; `location_integrations` store, migration 0056). **Square / Clover** need OAuth (vendor dev app) — use Zapier today, build native on demand.

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

**Google Sheets auto‑push (free, no Zapier).** If the client keeps customers in a Google Sheet
(columns `name, email, phone, service`), paste this **Apps Script** (Extensions → Apps Script) so each
new row auto‑POSTs to us. Set their location key once. Then add an **installable trigger** on
`onFormSubmit`/`onEdit` or run hourly.
```javascript
const BAAM_KEY = 'brk_xxxxxxxxxxxxxxxx';                 // this location's key
const BAAM_URL = 'https://baamreview.com/api/integrations/review-request';
function pushNewRows() {
  const sh = SpreadsheetApp.getActiveSheet();
  const rows = sh.getDataRange().getValues();
  const header = rows.shift().map(h => String(h).toLowerCase());
  const sentCol = header.indexOf('sent');          // add a "sent" column to track
  rows.forEach((r, i) => {
    if (sentCol > -1 && r[sentCol]) return;        // skip already-sent
    const get = n => r[header.indexOf(n)] || '';
    if (!get('email') && !get('phone')) return;
    UrlFetchApp.fetch(BAAM_URL, {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + BAAM_KEY },
      payload: JSON.stringify({
        name: get('name'), email: get('email'), phone: get('phone'),
        service: get('service'), external_id: 'sheet-row-' + (i + 2)
      }), muteHttpExceptions: true
    });
    if (sentCol > -1) sh.getRange(i + 2, sentCol + 1).setValue(new Date());
  });
}
```

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

#### Recipes for Square / Clover / Acuity (via Zapier — works today)
These three vendors' webhooks return only a customer id, so a *direct* webhook can't get the email. But Zapier's vendor triggers **do** include the contact (Zapier handles the vendor login and fetches the customer), so route them through Zapier → our **generic** endpoint (`/api/integrations/review-request`). Action in every case = **Webhooks by Zapier → Custom Request**: `POST`, header `Authorization: Bearer <key>`, JSON body mapping the trigger fields.

| Vendor | Zapier trigger to use | Map to our body |
|---|---|---|
| **Acuity Scheduling** | "Appointment Scheduled" | `name` ← First+Last, `email` ← Email, `phone` ← Phone, `service` ← Appointment Type, `external_id` ← Appointment ID |
| **Square** | "New Order" / "New Customer" / (Square Appointments) "New Appointment" — pick the one carrying the customer email | `name` ← Customer name, `email` ← Customer email, `phone` ← Customer phone, `external_id` ← Order/Appointment ID |
| **Clover** | "New Order" / "New Payment" / "New Customer" | `name`/`email`/`phone` ← Customer fields, `external_id` ← Order/Payment ID |

Same pattern in **Make** (HTTP module) or **n8n** (HTTP Request node). This is the recommended path for these vendors today — no developer app, no OAuth on our side. (Acuity also has a *native* connector — see Door 6.)

> A branded "BAAM Review" Zapier/Make app (so clients pick it from the directory instead of the generic HTTP module) is a later productization step — build it once the generic‑HTTP path shows real demand. The endpoints above are already everything such an app would wrap.

#### Walkthrough — set up Zapier for a business, end to end
A full, repeatable walkthrough for staff onboarding a client whose booking/POS/CRM we **cannot** modify (no website-code access needed — Zapier connects to their tool through the tool's own login).

**Mental model — a Zap has two ends:**
```
Client's app (booking/POS/CRM)  ──►   Zapier (the Zap)   ──►   BAAM Review
        TRIGGER  (input)                                       ACTION (output)
   reads each new transaction                            POSTs the contact to the queue
```
- The **TRIGGER** connects Zapier **to the business** (Part 1).
- The **ACTION** connects Zapier **to BAAM Review** (Part 2).
- **The API key = which business.** A key is bound to one location, so the request body never names the business — get the key from that location's **Location Setup → Integrations · API keys**.

**Before you start, confirm:**
1. **Which tool** captures their customers (Calendly / Acuity / Square / Shopify / Jobber / a CRM / etc.) — that's the trigger app.
2. **Access to connect it in Zapier** — either the client builds it in *their* Zapier, adds you as a collaborator, or authorizes the tool for you. (You need the *tool's* login/OAuth, never their website code.)
3. **The location's API key** is generated and copied.

**Part 1 — Connect Zapier → the business (Trigger)**
1. zapier.com → **Create → Zap**.
2. **Trigger** step → search the client's tool → pick the "new transaction" event (e.g. Calendly **Invitee Created**, Acuity **New Appointment**, Square **New Booking/Order**, Shopify **Order Fulfilled**, Jobber **Job Closed**). Prefer the **fulfillment / visit-complete** event over payment-auth.
3. **Connect account** → sign in / authorize the tool (OAuth). 
4. **Test trigger** → Zapier pulls a recent real record as sample data — confirms the connection and gives you fields to map.

**Part 2 — Connect Zapier → BAAM Review (Action)**
1. **Action** step → **Webhooks by Zapier → Custom Request** (or POST).
2. **Method:** `POST` · **URL:** `https://baamreview.com/api/integrations/review-request`
3. **Headers:** `Authorization: Bearer <LOCATION_API_KEY>` (and `Content-Type: application/json` if using JSON).
4. **Data** — map the trigger's fields (don't type values; pick them from the dropdown so each booking fills its own data):

   | Our field | Map from the trigger |
   |---|---|
   | `name` | customer name (combine First+Last if split) |
   | `email` | customer email |
   | `phone` | customer phone (often a custom field) |
   | `service` | service / appointment type / first line item |
   | `transacted_at` | appointment or fulfillment time |
   | `external_id` | the record's **unique id** (makes retries idempotent) |

5. *(Optional)* To request **after the visit**: add a **Delay by Zapier → Delay Until** the appointment end time before the webhook. (Otherwise it queues now; staff send one-by-one later anyway.)

**Test it (three levels):**
- **BAAM side only, before the Zap exists:** `GET …/ping` with the key (or POST a sample) via curl / ReqBin / Hoppscotch → expect the location name / `201`.
- **In Zapier:** click **Test action** → Zapier sends the sample record → expect `201` / `{"status":"queued"}`.
- **End-to-end:** make a real test booking with a fresh `+alias` email → confirm it lands.
- Verify in **Bulk Review Requests → (filter to the location) → "Incoming · week of …"**.

**Go live:** **Publish** and toggle the Zap **ON**. Every future transaction now auto-queues a contact — no website code, hands-off.

**Gotchas:**
- **Key = business.** Use the *correct* location's key, or contacts land under the wrong business.
- **`external_id`** must be the record's unique id → prevents duplicates on Zapier retries.
- **60-day dedupe:** when testing, use a new `+alias` email each time (a repeat returns `200 skipped`).
- **Form vs JSON:** Zapier "Webhooks → POST" defaults to form-encoded; our endpoint accepts both, so either is fine.
- **Managed option:** if the client can't self-serve, we build the Zap *for* them (Phase 5) — same steps in their account or ours.

### Door 6 — Native connector (Phase 4)
Two flavors:

**(a) Direct webhook adapters — shipped, no OAuth.** For vendors whose webhook already carries the customer's contact, the client points that vendor's *own* webhook straight at us (no Zapier). We translate the payload with a per-provider adapter.
- URL: `POST https://baamreview.com/api/integrations/<provider>?key=<LOCATION_KEY>`
- Live providers: **`shopify`** (`orders/fulfilled`), **`calendly`** (`invitee.created`), **`stripe`** (`checkout.session.completed` / `charge.succeeded`), **`woocommerce`** (Order created/updated), **`calcom`** (`BOOKING_CREATED`), **`typeform`** (form response). Each: point the vendor's webhook at `…/api/integrations/<id>?key=<key>`.
- Setup: generate a key (Location Setup → Integrations · API keys) → in the vendor's webhook settings, add the URL above with `?key=…` → send a test → it lands in this week's queue. Auth + rate‑limit + dedupe are identical to the generic endpoint.
- Adding a provider = one adapter file in `lib/integrations/providers/` (id, label, `map(payload)→contact`). Tested by `scripts/test-providers.mts`.

**(b) Credential connectors — for vendors whose webhook returns only an id.** We store the client's credentials and call the vendor's API to resolve the customer.
- **Acuity — ✅ shipped (API-key mode, no OAuth app needed).** Location Setup → **Native connectors → Acuity**: client pastes their **User ID + API Key** (Acuity → Account → Integrations → API). Then in Acuity → Integrations → **Webhooks**, add `POST https://baamreview.com/api/integrations/acuity?key=<location key>` for *Appointment Scheduled*. We fetch the appointment via Acuity's API and enqueue. (`lib/integrations/providers/acuity.ts`; tested in `test-providers.mts`.)
- **Square / Clover — OAuth, not built.** These need a vendor developer app + OAuth (their tokens, not a simple API key). Use the **Zapier recipe** above today; build native only when a client's volume justifies it.

### Door 7 — Email-in (forward confirmation emails) — *no integration on the client's side*
The cheapest, most universal door: a business that has **no connectable tool at all** just
**auto-forwards its order/booking confirmation emails** to a per-location address, and we parse the
customer out and queue them. (See `docs/operations/INTEGRATION_BRIDGES_PLAN.md`.)

**How it works:**
1. Each location has a forward-to address shown in **Location Setup → Integrations · API keys → Email-in**: `r-<token>@<INBOUND_EMAIL_DOMAIN>`.
2. The client adds an **auto-forward rule** (Gmail/Outlook) for their **customer order/booking confirmation** emails → that address. *(Forward emails that carry the customer's contact in the body — not internal/marketing/notification emails.)*
3. The inbound provider posts the email to `POST /api/integrations/inbound-email`; we resolve the location by the address token, extract the **customer's** name/email/phone (Claude Haiku; AI is trusted and returns nothing for non-customer emails), and enqueue. Idempotent per message.

**Parser behavior (important):** the extractor **only** queues a genuine customer. It returns
`no_contact` for non-transaction emails and **never** uses the **forwarder/sender** or business/role
addresses (`support@`, `service@`, `no-reply`, `@baamplatform.com`, etc.). Handles HTML-only emails.

**Live setup — SendGrid Inbound Parse (receiving) + Resend (sending), on GoDaddy DNS.**
Full steps: **`EMAIL_IN_SENDGRID_SETUP.md`**. Summary:
- Subdomain `inbound.baamplatform.com` (never the root — it has Google Workspace MX).
- SendGrid: authenticate the domain (3 CNAMEs in GoDaddy), then **Inbound Parse → Add Host & URL**:
  host `inbound`, domain `baamplatform.com`, URL `…/api/integrations/inbound-email?secret=<INBOUND_EMAIL_SECRET>`, **"POST raw MIME" UNCHECKED**.
- GoDaddy: `inbound` **MX → `mx.sendgrid.net`** (priority 10).
- **Env:** `INBOUND_EMAIL_DOMAIN=inbound.baamplatform.com`, `INBOUND_EMAIL_SECRET=<same as URL>`, `ANTHROPIC_API_KEY` (set). **DB:** migration `0059` (`locations.inbound_email_token`).

> ⚠️ **Resend Inbound does NOT work for receiving** — its `email.received` webhook is metadata-only
> (no body) and there's no body-fetch API. Use it only for *sending*. See `EMAIL_IN_RESEND_SETUP.md`.
> The endpoint still accepts Resend's Svix-signed JSON (`RESEND_INBOUND_SIGNING_SECRET`) if Resend
> ships full-body inbound later. **Alternatives:** Mailgun Routes, or Cloudflare Email Routing
> (free, needs DNS on Cloudflare; worker at `infra/cloudflare-inbound-email-worker/`, see
> `EMAIL_IN_CLOUDFLARE_SETUP.md`).

**Test:** forward a real **customer confirmation** email to a location's address → it appears in that location's "Incoming · week of …" queue. Endpoint returns `201` queued · `200` skipped (no_contact/duplicate/no_location) · `401` bad secret/signature.

### Door 8 — Managed onboarding (Full Service)
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

## 11. Comparing with Birdeye (staff talking points)

Prospects often say *"Birdeye connects to 2,000–3,000 integrations — do you?"* Here's how to answer honestly and confidently.

### What Birdeye's "3,000 integrations" actually is
That headline number is **real as a count, but it's mostly the Zapier ecosystem — not 3,000 hand‑built connectors.** It's three tiers:
1. **A native core** — genuinely deep connectors for big systems (Salesforce, HubSpot, common POS, some industry PMS/EHR). Realistically dozens to low‑hundreds.
2. **The Zapier/middleware ecosystem** — "works with Zapier" instantly inherits Zapier's **6,000+ apps**. This is where most of the big number comes from.
3. **A generic API + webhooks** for anything custom.

The mechanism is the same as ours: an event in the source system → pull the customer → send a review request.

### Our range is comparable — because the big number *is* Zapier, and we use Zapier too
| Mechanism | Reaches | Us |
|---|---|---|
| Zapier / Make / n8n | the same ~6,000+ apps that make up most of Birdeye's count | ✅ |
| Direct webhook + API key | any system that can POST | ✅ |
| Native adapters | Shopify, Calendly, Acuity (more on demand) | ✅ |
| CSV / QR / manual | the long tail + no‑system / walk‑in businesses | ✅ |

So **we can connect essentially the same universe of apps.** Don't concede on "range."

### Where Birdeye is genuinely ahead — and how to frame it
It's **polish + niche breadth, not capability:**
- More **pre‑built one‑click connector UIs** (client picks "Square" from a list vs. setting up a Zap). We have a few native + reach the rest via Zapier/managed setup.
- Some **niche industry connectors** (specific dental PMS / healthcare EHR) we haven't built. *If a system has no webhook/API/Zapier app, neither vendor can connect it.* When a specific system recurs among our clients, we build that one native connector (small task on our framework).

### Our genuine advantages (lead with these)
- **Deliverability:** we send review‑request emails **one‑by‑one from the business's own Gmail → Primary inbox.** Birdeye (and most tools) blast via an ESP → Promotions/Spam. This is our biggest differentiator — say it first.
- **No fake reviews / human‑in‑the‑loop**, AI‑personalized per recipient.
- **Bilingual (EN/中文/ES)** and tuned for our client base (TCM, dental, beauty), many of whom book by phone/WeChat/walk‑in — where **QR + managed setup beats 3,000 connectors they'd never use.**

### One‑liner for sales
> "Their 3,000 'integrations' are mostly Zapier — which we also use, so we reach the same apps. The difference that matters is the *other* direction: our review emails land in the **Primary inbox**, sent one‑by‑one from your own Gmail, instead of the Promotions tab. We connect to what you use **and** actually get seen."

---

### TL;DR for the team
Ask **"do you capture email/phone?"** and **"what system do you use?"** → pick a door from the tree. Every door does the same thing: **drops the customer's contact into our queue.** We send it — SMS automatically, email by hand from their Gmail — and own everything after. Build the **universal webhook (Phase 2)** first; add native connectors only where clients pile up.
