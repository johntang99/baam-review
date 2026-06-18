# BAAM Review — Cloudflare inbound-email Worker

Receives forwarded confirmation emails and posts them to BAAM Review's
`/api/integrations/inbound-email`. See docs/operations/INTEGRATION_BRIDGES_PLAN.md
(Item 1) and SOP Door 7.

## Deploy
1. `npm install`
2. `npx wrangler login`
3. `npx wrangler secret put INBOUND_EMAIL_SECRET`  (paste the SAME value set in the app env)
4. `npx wrangler deploy`

Then in Cloudflare dashboard → your domain → **Email → Email Routing**:
- Enable Email Routing (adds MX/SPF).
- **Email Workers** → bind a route (catch-all) to the `baam-inbound-email` worker.

See ../../docs/operations/EMAIL_IN_CLOUDFLARE_SETUP.md for the full walkthrough.
