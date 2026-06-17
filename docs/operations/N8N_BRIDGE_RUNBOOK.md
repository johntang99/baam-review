# n8n Bridge Runbook — BAAM's managed Zapier replacement

**Why.** n8n is an open-source automation tool. **Self-hosted, it has no per-task fees** — one cheap
VPS runs workflows for *all* clients, replacing per-client Zapier subscriptions. Use it as BAAM's
**managed bridge** for clients whose system has no native webhook and who can't self-serve. See the
ladder in `INTEGRATION_BRIDGES_PLAN.md` (Rung 3).

> When NOT to use n8n: if the client's tool can POST its own webhook (Rung 1 native connector) or
> just forward emails (Rung 2 email-in) — those are simpler and need no n8n. n8n is for "SaaS with
> an API/trigger but no usable webhook, and the client can't run their own automation."

---

## 1. One-time setup (host it once, for all clients)

**Cheapest: Docker on a small VPS (~$5–12/mo, e.g. Hetzner/DigitalOcean).**
```bash
docker volume create n8n_data
docker run -d --name n8n --restart unless-stopped \
  -p 5678:5678 \
  -e N8N_HOST=n8n.baamplatform.com \
  -e N8N_PROTOCOL=https -e WEBHOOK_URL=https://n8n.baamplatform.com/ \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=ops -e N8N_BASIC_AUTH_PASSWORD='<strong-password>' \
  -e GENERIC_TIMEZONE=America/New_York \
  -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```
- Put it behind HTTPS (Caddy/Nginx + Let's Encrypt, or a Cloudflare tunnel).
- **Alternative (no server):** n8n Cloud (~$20–25/mo) or **Pipedream** (generous free tier). Self-host wins on cost at scale.

**Store BAAM keys as n8n credentials** (one per client location): n8n → Credentials → **Header Auth** →
name `BAAM <Client>`, Header Name `Authorization`, Value `Bearer brk_…` (that location's key from
Location Setup → Integrations · API keys). Keeps keys out of the workflow body.

---

## 2. The reusable pattern (every client is the same shape)
```
Trigger (client's app)  →  [optional] Delay until after visit  →  HTTP Request → BAAM Review
```
- **Trigger node** = the client's app ("New booking", "Order paid", "Job completed", "Deal won"), or a **Schedule + their API** when there's no trigger app.
- **HTTP Request node** → `POST https://baamreview.com/api/integrations/review-request`
  - Authentication: **Header Auth** credential (the `BAAM <Client>` one above)
  - Body (JSON): map trigger fields → `name`, `email`, `phone`, `service`, `transacted_at`, `external_id` (the record's unique id, for dedupe).

A ready-to-import template is at **`docs/operations/templates/n8n-baam-review-bridge.json`** — it has a
Manual Trigger (swap for the client's app) wired to a pre-configured HTTP Request node.

---

## 3. Per-client procedure
1. **Import** the template (n8n → Workflows → Import from File → the JSON above).
2. **Create the Header Auth credential** with that location's API key (§1).
3. **Replace the trigger** with the client's app; connect their account (OAuth inside n8n — no client code).
4. **Map the fields** in the HTTP Request node to the trigger's real fields.
5. *(Optional)* add a **Wait/Delay** node to fire after the visit.
6. **Execute / Test** → expect `201` / `{"status":"queued"}` → confirm it lands in the client's
   "Incoming · week of …" queue in BAAM Review.
7. **Activate** the workflow.

---

## 4. Testing & ops
- **Test a node:** n8n "Execute Node" sends a sample → check BAAM Review.
- **Dedupe:** always map `external_id` to the record's unique id; re-runs return `200 skipped`.
- **Monitoring:** n8n → Executions shows every run + errors. BAAM side: the contact appears (or the
  HTTP node shows the `200/201/4xx` response).
- **Backups:** the `n8n_data` volume holds all workflows + credentials — snapshot it.
- **Cost:** flat VPS for *all* clients. No per-task billing — that's the whole point vs Zapier.

---

## 5. Where this fits
- Most clients: **native webhook** (Rung 1) or **email-in** (Rung 2) — no n8n needed.
- Use **n8n** for the managed middle: a SaaS with a trigger/API but no usable direct webhook.
- **Zapier** stays the last resort (client already has it, on their own account).
