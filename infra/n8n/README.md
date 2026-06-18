# Self-hosted n8n (BAAM's managed bridge)

One n8n instance bridges any client's app → BAAM Review. No per-task fees. See
`docs/operations/N8N_BRIDGE_RUNBOOK.md` for the per-client workflow procedure.

## Stand it up (~15 min)
1. **VPS:** create an Ubuntu 22.04+ server (Hetzner CX22 ~€4/mo, or DigitalOcean $6). SSH in.
2. **Docker:** `curl -fsSL https://get.docker.com | sh`
3. **DNS:** in GoDaddy, add an **A record** `n8n` → the VPS IP (so `n8n.baamplatform.com` resolves).
4. **Configure:** copy these files to the server, then:
   ```bash
   cp .env.example .env
   nano .env            # set N8N_HOST + N8N_ENCRYPTION_KEY (openssl rand -hex 24)
   ```
5. **Run:** `docker compose up -d`
6. Open `https://n8n.baamplatform.com` → **create the owner account** (email + password). Caddy
   issues HTTPS automatically.

## Backups
- The `n8n_data` volume holds all workflows + (encrypted) credentials. Snapshot it regularly.
- Keep `N8N_ENCRYPTION_KEY` safe — credentials can't be decrypted without it.

## Update later
`docker compose pull && docker compose up -d`
