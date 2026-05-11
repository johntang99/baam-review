# Domain Migration — `review.baamplatform.com` → `baamreview.com`

*Step-by-step plan for when the standalone domain is ready. Designed to be near-zero downtime, near-zero code change, with the old subdomain kept alive forever as an alias.*

---

## TL;DR

1. Add `baamreview.com` to Vercel and DNS (parallel — both domains work).
2. Switch `NEXT_PUBLIC_APP_URL` env var to the new domain → redeploy.
3. Update Supabase, Google OAuth, Resend, webhook URLs to the new domain.
4. **Keep `review.baamplatform.com` attached forever** so already-printed QR codes, already-sent emails, and already-pasted embed snippets keep working.

Estimated wall-clock time: 3 hours of actual work + however long DNS / Resend domain verification takes (typically <24h).

---

## Why this is easy

Every URL the app generates flows through `NEXT_PUBLIC_APP_URL`. The five places that look hardcoded are all fallbacks `process.env.NEXT_PUBLIC_APP_URL || "https://review.baamplatform.com"` — the fallback string never gets used in deployed environments because the env var is always set.

This means: change the env var, redeploy, and every generated link, embed snippet `src`, QR destination URL, OAuth redirect URL, and webhook URL updates automatically.

Already-distributed artifacts (printed QR codes, sent SMS/email links, pasted embed snippets on customer sites) keep working because we leave the old domain serving the same Vercel project.

---

## Phase 1 — Parallel setup (~1 hour, no production impact)

Do these in any order. Both domains work simultaneously after this phase.

### 1.1 Vercel

1. Vercel → `baam-review` project → Settings → Domains → **Add**
2. Enter `baamreview.com`
3. Vercel shows DNS records to add. Note them.
4. (Optional) Add `www.baamreview.com` if you want both — Vercel handles `www` → apex redirect automatically.

### 1.2 DNS at your registrar

Wherever `baamreview.com` is registered:

- **A record** for the apex (`@`) → `76.76.21.21` (Vercel's anycast IP), OR
- **ANAME / CNAME flattening** for the apex → `cname.vercel-dns.com` (if your DNS provider supports it — Cloudflare, DNSimple, Hover all do)
- **CNAME** for `www` → `cname.vercel-dns.com`

Wait for propagation (usually 5–30 minutes). Vercel auto-provisions SSL.

Confirm with:

```bash
dig baamreview.com +short
curl -I https://baamreview.com   # should return 200 once SSL provisions
```

### 1.3 Google Cloud Console

In the `baam-platform` GCP project (or wherever the OAuth client lives):

1. APIs & Services → Credentials → BAAM Review OAuth client → Edit
2. **Authorized JavaScript origins** → add:
   - `https://baamreview.com`
   - `https://www.baamreview.com` (if applicable)
3. **Authorized redirect URIs** → add:
   - `https://baamreview.com/api/auth/google/callback`
   - `https://www.baamreview.com/api/auth/google/callback` (if applicable)
4. Save. Changes are immediate; no app redeploy needed.

Don't remove the existing `review.baamplatform.com` entries — leave them so the old domain continues working.

### 1.4 Supabase

Dashboard → `baam-review` project → Authentication → URL Configuration:

1. **Redirect URLs** → add `https://baamreview.com/**`
2. Leave the existing `https://review.baamplatform.com/**` and `http://localhost:4001/**` entries alone.
3. **Site URL** — leave on `review.baamplatform.com` for now. We'll switch this in Phase 2.

### 1.5 Resend

Dashboard → Domains → **Add Domain**:

1. Enter `baamreview.com`
2. Resend returns DKIM, SPF, and DMARC records
3. Add them at the domain registrar (alongside the Vercel A/CNAME records)
4. Wait for Resend to mark the domain as Verified (usually <1 hour)

### 1.6 Verify parallel state

Both domains should now respond identically:

| Test | URL on old | URL on new | Should match? |
|---|---|---|---|
| Homepage | https://review.baamplatform.com/ | https://baamreview.com/ | ✅ Yes (same Vercel project) |
| Login | …/login | …/login | ✅ Yes |
| Public review page | …/r/dr-huang-…?lang=en | …/r/dr-huang-…?lang=en | ✅ Yes |

If both render the same content, Phase 1 is done.

---

## Phase 2 — Switch primary (~10 minutes, brief invalidation of generated assets)

This phase changes which domain new artifacts (links, snippets, posters) reference. Existing artifacts continue to reference the old domain and keep working.

### 2.1 Update `NEXT_PUBLIC_APP_URL`

Vercel → Project Settings → Environment Variables:

1. Find `NEXT_PUBLIC_APP_URL` for *Production*
2. Change to `https://baamreview.com`
3. Save

Repeat for *Preview* if applicable (usually preview uses Vercel-generated URLs, so this might already be auto).

### 2.2 Update `RESEND_FROM` (optional)

If you want emails to come from the new domain:

1. `RESEND_FROM` → `No-Reply <no-reply@baamreview.com>`
2. Save

Mind: this requires `baamreview.com` to be Resend-verified (Phase 1 step 1.5).

### 2.3 Redeploy

Vercel → Deployments → latest → ⋯ → **Redeploy**

This is when the new domain becomes the primary in generated artifacts. Verify:

```bash
curl -s https://baamreview.com/api/embed.js | head -3
# Should show: var BASE = "https://baamreview.com";
```

```bash
# Visit /app/locations/[id]/qr, change source, check the "Encoded URL"
# field — should now say https://baamreview.com/r/...
```

### 2.4 Update Supabase Site URL

Supabase → Authentication → URL Configuration → **Site URL** = `https://baamreview.com`.

This is used for verification email redirects after sign-up.

### 2.5 Update webhook URLs

If/when Stripe is added (Session 11), update the webhook endpoint in the Stripe dashboard:

- Old: `https://review.baamplatform.com/api/webhooks/stripe`
- New: `https://baamreview.com/api/webhooks/stripe`

Similarly for Twilio status callback URL when SMS goes live:

- Old: `https://review.baamplatform.com/api/webhooks/twilio`
- New: `https://baamreview.com/api/webhooks/twilio`

---

## Phase 3 — Keep the old domain alive forever

This is the critical step that's easy to forget.

### What's already in the wild

| Artifact | Where it lives | URL baked in |
|---|---|---|
| Sent SMS / email messages | `review_requests.message_sent` | Old domain |
| Printed QR posters | On a wall somewhere | Old domain |
| Pasted embed `<script>` tags | On a customer's website | Old domain (`/api/embed.js`) |
| Pasted embed `<script>` outputs | Rendered `<a href="…/r/<slug>?source=embed">` | New domain (because the JS uses runtime `BASE`) |

Note: the embed snippets only have the old domain in the `src` attribute. Once `/api/embed.js` is served from the old domain but reads `NEXT_PUBLIC_APP_URL` and embeds that into the IIFE's `BASE` constant, the rendered button still goes to the new domain. Best of both worlds.

### What to do

**Do nothing.** Vercel keeps `review.baamplatform.com` attached to the project and continues serving requests. The old domain serves the new code; the embed script reads the new `BASE`; the public review pages render at either URL identically.

No 301 redirect needed. If you want one to gradually shift SEO authority:

- Optional: add a Next.js redirect rule in `next.config.ts` that 301s `/` from the old to new domain (but preserves all other paths).

```ts
async redirects() {
  return [
    {
      source: "/",
      has: [{ type: "host", value: "review.baamplatform.com" }],
      destination: "https://baamreview.com/",
      permanent: true,
    },
  ];
}
```

I'd hold off on this — it's clean to leave both domains serving identically until you're ready to fully sunset the old subdomain (years away, if ever).

---

## Phase 4 — Optional follow-ups

These can wait weeks or months.

### Move OAuth to a dedicated GCP project

If BAAM Review needs its own OAuth verification (separate from BAAM Platform's), create a new GCP project:

1. New GCP project: `baam-review`
2. Enable APIs: My Business Account Management, My Business Business Information, Places API
3. Create OAuth client with the new domain's redirect URIs
4. Update Vercel env: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
5. Submit OAuth verification (4–6 weeks)

Until verification is complete, switch the new OAuth client to **Testing** mode and add pilot users as test users.

The old OAuth client (`baam-platform` project) keeps working for existing customers — their refresh tokens are bound to the original client ID. Migrate one customer at a time by having them disconnect Google and reconnect.

### Per-customer custom domains

Some customers may want `reviews.theirbusiness.com` instead of `baamreview.com/r/<slug>`. Master plan §16 has this as a phase 2 feature.

Implementation outline:

1. Customer adds a CNAME `reviews.theirbusiness.com → cname.vercel-dns.com`
2. Vercel project → Domains → add the customer's domain (or programmatically via Vercel API)
3. Add a column `locations.custom_domain text UNIQUE`
4. New proxy logic: if the request's host doesn't match `baamreview.com`, look up the location by `custom_domain` and serve `/r/<that-slug>`
5. OAuth + verification still happens on `baamreview.com`

This is Phase 2 work; out of scope for the immediate domain migration.

---

## Rollback plan

If something breaks during Phase 2:

1. Vercel → Env Vars → change `NEXT_PUBLIC_APP_URL` back to `https://review.baamplatform.com`
2. Redeploy

That's the only switch that matters. All other Phase 1 changes (added DNS, added redirect URIs, added Resend domain) are additive and don't break anything if the env var stays on the old domain.

For Stripe / Twilio webhook URLs: if you've already moved them, change them back in the provider dashboard. No code change needed.

---

## Pre-migration checklist

Run through this before starting Phase 1:

- [ ] `baamreview.com` registered and DNS access confirmed
- [ ] Vercel project access confirmed
- [ ] Supabase project access confirmed
- [ ] Google Cloud Console access to the OAuth client
- [ ] Resend access to add a domain
- [ ] A test customer account you can use to verify end-to-end after migration
- [ ] (Recommended) Tell active customers a quick "we're updating our domain — old links continue to work" notice; not strictly necessary because of Phase 3

---

## Post-migration verification

After Phase 2, run through this:

- [ ] `https://baamreview.com/` loads (the marketing/placeholder home)
- [ ] `https://baamreview.com/login` lets a test user log in
- [ ] `https://baamreview.com/app` shows the dashboard for an existing account
- [ ] `https://baamreview.com/r/<known-slug>` loads a public review page
- [ ] Connect-Google flow from `/app/locations` works on the new domain (consent screen redirect URI matches)
- [ ] `/app/send` sends an email → check that the link in the email goes to `baamreview.com/r/...`
- [ ] `/app/locations/[id]/qr` → download a PDF → confirm QR encodes a `baamreview.com` URL
- [ ] `/app/locations/[id]/embed` → copy snippet → confirm `src` points to `baamreview.com/api/embed.js`
- [ ] `https://review.baamplatform.com/` still loads (old domain alive)
- [ ] An older sent email's link (saved from a prior session) still works
