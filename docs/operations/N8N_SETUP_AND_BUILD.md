# n8n Bridge — Build & Operations (master doc)

BAAM's **self-hosted, no-code** automation bridge. One n8n instance connects any client's
app → BAAM Review, replacing per-client Zapier subscriptions (no per-task fees). This is the
canonical build record; see also [N8N_BRIDGE_RUNBOOK.md](N8N_BRIDGE_RUNBOOK.md) (per-client steps),
[infra/n8n/](../../infra/n8n/) (the stack), and the importable
[templates/n8n-baam-review-bridge.json](templates/n8n-baam-review-bridge.json).

## Decisions (recorded)
- **Hosting:** self-hosted on a small VPS (cheapest; no per-task fees) — not n8n Cloud.
- **First build:** a generic dry-run (Manual trigger → POST to BAAM Review) before wiring a real client.
- **Role:** n8n is the **managed fallback** — use it only when a client's app has a trigger/API but
  **no native webhook** and **can't email-forward**. Prefer native adapters → email-in first.

## Architecture
```
Client's app (booking/POS/CRM)  ──►  n8n (one instance, one workflow per client)  ──►  BAAM Review
       TRIGGER (their account, OAuth)              ACTION: HTTP POST + that location's API key
       reads each new transaction                 /api/integrations/review-request
```
The **API key = which business** (bound to one location), so the body never names the business.

---

## Part A — Stand up n8n (one time, ~15 min)
Files: [infra/n8n/](../../infra/n8n/) — `docker-compose.yml` (n8n + Caddy auto-HTTPS), `Caddyfile`, `.env.example`, `README.md`.
1. **VPS:** Ubuntu 22.04+ (Hetzner CX22 ~€4/mo or DigitalOcean $6).
2. **Docker:** `curl -fsSL https://get.docker.com | sh`
3. **DNS (GoDaddy):** A record `n8n` → VPS IP → `n8n.baamplatform.com`.
4. **Configure:** `cp .env.example .env` → set `N8N_HOST` + `N8N_ENCRYPTION_KEY` (`openssl rand -hex 24`).
5. **Run:** `docker compose up -d` → open `https://n8n.baamplatform.com` → create owner account.
6. **Backups:** snapshot the `n8n_data` volume; keep `N8N_ENCRYPTION_KEY` safe (decrypts saved creds).

---

## Part B — Dry-run workflow (prove n8n → BAAM Review)
1. BAAM Review → a test location → Location Setup → Integrations · API keys → **Generate** → copy `brk_…`.
2. n8n → **Create Workflow** → **Manual Trigger**.
3. **HTTP Request** node: `POST https://baamreview.com/api/integrations/review-request`,
   Authentication = **Header Auth** (`Authorization: Bearer brk_…`), Body = JSON:
   `{ "name":"n8n Dry Run", "email":"n8ntest+1@gmail.com", "phone":"212-555-0190", "external_id":"n8n-dryrun-1" }`
4. **Test workflow** → expect `201` `{"status":"queued"}` → contact appears in that location's
   "Incoming · week of…" queue. Revoke the test key when done.

---

## Part C — Connect a new business (repeat per client) — **NO CODE**
Connecting a business is **point-and-click in the n8n UI**, not coding:
1. **Generate** that location's BAAM key → store as an n8n **Header Auth** credential (`BAAM <Client>`).
2. **Import** the template ([templates/n8n-baam-review-bridge.json](templates/n8n-baam-review-bridge.json)).
3. **Replace the trigger** with the client's app (Calendly / Square / Jobber / Shopify / a CRM …) →
   **connect their account** (the app's own login/OAuth inside n8n — never their website code).
4. **Map fields** in the HTTP node (`name/email/phone/service/transacted_at/external_id`) to the
   trigger's fields — done by clicking the field picker (these `{{ $json.… }}` expressions are
   *mapping*, not programming).
5. *(Optional)* add a **Delay/Wait** node to fire after the visit.
6. **Test → Activate.**

> See N8N_BRIDGE_RUNBOOK.md for the detailed per-client procedure + per-vendor trigger names.

## Is it code? (FAQ)
- **Do we write code per business?** **No.** Each client = a UI workflow (pick trigger, connect
  account, map fields). The only "code-ish" thing is `{{ $json.email }}` field mapping, which is
  point-and-click in n8n.
- **When IS code involved?** Only if we add a **native adapter** to BAAM Review itself (a separate,
  optional path in `lib/integrations/providers/`) — that's a one-time dev task per *vendor*, not per
  *business*, and is unrelated to n8n.

## Cost / when to use
- **Cost:** flat VPS (~$5–12/mo) for **all** clients combined — no per-task billing (vs Zapier per-seat).
- **Use n8n when:** the client's app has a trigger/API but no native webhook and can't email-forward.
- **Prefer first:** native adapter (free) → email-in (free) → n8n (managed) → Zapier (last resort).
