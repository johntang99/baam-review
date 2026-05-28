# Custom Sender Domain Setup — Standard Operating Procedure

Setting up a customer's review-request emails to send from their own domain
(e.g. `review@reviews.drhuangclinic.com`) instead of the shared BAAM Review
address (`support@baamplatform.com`). This is the **single biggest lever for
landing in Gmail Primary instead of Promotions** and required for every
Full-Service customer.

**Audience**: BAAM Review staff doing customer onboarding. Sections marked
**[Customer]** are actions the customer (or their IT contact) performs.

**Estimated time**: 15–30 minutes per customer, plus 5–60 min for DNS
propagation.

---

## Why this matters

| Setup | Typical Gmail placement | Customer perceives email as |
|---|---|---|
| ❌ Shared sender (`Dr Huang via BAAM Review <support@baamplatform.com>`) | Promotions tab | Marketing / third-party tool |
| ✅ Custom sender (`Dr Huang Clinic <review@reviews.drhuangclinic.com>`) | Primary tab | From the business itself |

Custom senders also isolate **deliverability reputation** per customer —
one bad sender's bounces don't drag down everyone else.

---

## Decision: subdomain or root domain?

**Use a subdomain whenever possible.** Trade-offs:

| Choice | Use when | Example | Risk |
|---|---|---|---|
| **Subdomain** ✅ (recommended) | Customer already has email working on the root domain (Google Workspace, Office 365, custom MX) | `reviews.drhuangclinic.com` | None — won't touch existing mail setup |
| **Root domain** | Customer's root domain has NO existing email setup (rare) | `drhuangclinic.com` | Conflicts with their main email if they later add Google Workspace |

> **Default to a subdomain** unless the customer explicitly says they have no
> email and never will. The subdomain pattern (`reviews.`, `email.`, or
> `notify.`) is also the industry-standard convention for transactional mail.

**Recommended subdomain names** (in order of preference):

1. `reviews.{domain}` — most descriptive
2. `mail.{domain}` — neutral, multi-purpose
3. `notify.{domain}` — works for SMS/push expansion later

---

## Prerequisites checklist

Before starting, confirm:

- [ ] **Customer owns the domain** (you can verify with `whois <domain>`)
- [ ] **Customer has DNS access** (or can reach the person who does)
  - GoDaddy / Cloudflare / Namecheap / Squarespace / AWS Route 53 / etc.
- [ ] **The BAAM Review location row exists** for this customer (i.e., GBP
      already connected via `/app/locations/connect`)
- [ ] **Resend API key has Full Access** (BAAM internal — should already be
      set; verify at Resend → API Keys)

---

## Setup workflow

Five stages. Stages 1–3 happen in Resend + customer's DNS provider.
Stages 4–5 happen in BAAM Review.

### Stage 1 — Add the domain in Resend

1. Go to **Resend Dashboard → Domains → Add Domain**
2. **Name field**: enter the subdomain or root domain
   - Subdomain example: `reviews.drhuangclinic.com`
   - Root example: `drhuangclinic.com`
3. **Region**: choose **North Virginia (us-east-1)** — matches the rest of
   the BAAM Review sending infrastructure for consistent IP reputation
4. Click **Add**
5. You'll land on the domain's detail page showing 3 DNS records you need
   to add. Keep this tab open — you'll copy from it in Stage 2.

### Stage 2 — Configure DNS records **[Customer]**

Resend gives you three records to add at the customer's DNS provider. The
exact values come from the Resend detail page; the **types** and **purposes**
are documented below.

| # | Type | Hostname (Name) | Value | Purpose |
|---|---|---|---|---|
| 1 | **MX** | `<subdomain>` or `@` for root | `feedback-smtp.us-east-1.amazonses.com` priority `10` | Bounce processing — emails that fail get returned here |
| 2 | **TXT (SPF)** | `<subdomain>` or `@` | `v=spf1 include:amazonses.com ~all` | Tells the world Amazon SES (Resend's backbone) is allowed to send for this domain |
| 3 | **TXT (DKIM)** | `resend._domainkey.<subdomain>` | A long string starting with `p=MIGfMA0...` | Cryptographic signature proves emails are authentically from this domain |

If you also want DMARC (recommended, see [Optional records](#optional-records-recommended-dmarc) below):

| 4 | **TXT (DMARC)** | `_dmarc.<subdomain>` | `v=DMARC1; p=none; rua=mailto:<email>` | Reports who's sending under this domain |

#### Hostname conventions

DNS providers handle the "Hostname" field differently. Watch out for this
because it's the #1 cause of failed verification.

**For a subdomain like `reviews.drhuangclinic.com`:**

| DNS Provider | Type the Hostname as |
|---|---|
| GoDaddy | `reviews` (just the subdomain) — do NOT include `.drhuangclinic.com` |
| Cloudflare | `reviews` (the UI auto-appends `.drhuangclinic.com`) |
| Namecheap | `reviews` |
| Squarespace | `reviews` |
| AWS Route 53 | `reviews.drhuangclinic.com.` (full, with trailing dot) |

For the DKIM record at `resend._domainkey.reviews.drhuangclinic.com`,
similarly enter just `resend._domainkey.reviews` (the host portion).

**For a root domain like `drhuangclinic.com`:**

| DNS Provider | Type the Hostname as |
|---|---|
| GoDaddy | `@` |
| Cloudflare | `@` or leave blank (auto-resolves to root) |
| Namecheap | `@` |
| Squarespace | leave blank |
| AWS Route 53 | `drhuangclinic.com.` |

#### TTL

Set TTL to **1 hour (3600 seconds)** or whatever your provider's lowest
recommended value is. Lower TTL means faster propagation if changes are
needed; production usage doesn't benefit from longer TTLs here.

### Stage 3 — Verify in Resend

1. Wait 5–15 minutes after adding the DNS records. (Sometimes faster, up
   to 60 min on slow DNS providers like GoDaddy.)
2. **Optional sanity-check from a terminal** before clicking Verify:
   ```
   dig TXT resend._domainkey.reviews.drhuangclinic.com +short
   dig MX reviews.drhuangclinic.com +short
   ```
   If both return values, DNS has propagated.
3. **In Resend → Domains → click the domain row → Verify button** at the
   top right
4. Each of the 3 records flips to **Verified** with a green check
5. The overall domain status changes from "Pending" → "Verified"

If verification fails, see [Troubleshooting DNS](#troubleshooting-dns) below.

### Stage 4 — Configure BAAM Review location

1. Log into BAAM Review as an admin or as the customer themselves
2. Open the location's settings page: `/app/locations/<id>` → scroll to the
   **Email sender** section
3. **Send-from name**: the business name as it should appear in the
   recipient's inbox. Examples:
   - `Dr Huang Clinic`
   - `Acme Acupuncture`
   - `Northeast Auto Repair`
   - Keep it short and recognizable. Avoid all-caps. Avoid "Reviews from
     X" — looks like marketing.
4. **Send-from email**: an address on the verified domain. Examples:
   - `review@reviews.drhuangclinic.com` (recommended pattern)
   - `hello@reviews.drhuangclinic.com`
   - `feedback@reviews.drhuangclinic.com`
   - The local part (before `@`) can be anything. The mailbox doesn't need
     to receive mail — replies route through reply-to logic. But pick
     something a recipient won't mistake for spam.
5. Click **Save**

**What happens on save:** BAAM Review queries Resend's domains API live. If
the domain is verified there, `sender_verified_at` flips to the current
timestamp on the location row. From now on, sends from this location use
the custom From header.

If the Resend domain isn't verified at save time, the location is saved with
a null `sender_verified_at` and sends fall back to the shared
`support@baamplatform.com`. Re-saving the form after DNS verifies will fix
this automatically — no SQL needed.

### Stage 5 — Test send

1. Create a small bulk list (2 recipients, your own email accounts) for
   this location at `/app/lists/new`, OR use the single-send page at
   `/app/send`
2. Send it
3. In the recipient inbox, verify the **From** header reads:
   `Dr Huang Clinic <review@reviews.drhuangclinic.com>`
   (NOT `... via BAAM Review <support@baamplatform.com>`)
4. Check which tab the email lands in:
   - **Primary** → 🎉 setup successful
   - **Promotions** → still works, but consider [further deliverability
     improvements](#further-deliverability-improvements) below
5. Click the review link, complete a test review, confirm it reaches the
   business's Google Business Profile

---

## Optional records (recommended): DMARC

DMARC isn't required for emails to send, but it's a strong deliverability
signal and recommended best practice. It tells inbox providers what to do
with emails that fail SPF/DKIM checks.

| Type | Hostname | Value | Effect |
|---|---|---|---|
| TXT | `_dmarc.reviews.drhuangclinic.com` | `v=DMARC1; p=none; rua=mailto:dmarc-reports@drhuangclinic.com` | Monitor mode — reports sent to the mailto, no enforcement |
| TXT | (same) | `v=DMARC1; p=quarantine; rua=mailto:...` | Suspicious mail goes to spam folder |
| TXT | (same) | `v=DMARC1; p=reject; rua=mailto:...` | Suspicious mail is rejected outright |

**Recommendation**: start with `p=none` for 30 days, review the reports
in `dmarc-reports@drhuangclinic.com`, then graduate to `p=quarantine` or
`p=reject` once you're sure no legitimate senders are being missed.

---

## Provider-specific DNS quick references

### GoDaddy

1. **My Products → DNS → Manage DNS** for the domain
2. **Add Record** for each of the 3 (or 4) values
3. For the **Name** field on a subdomain: type just the subdomain prefix
   (e.g., `reviews`), NOT `reviews.drhuangclinic.com`
4. Save records individually
5. GoDaddy's DNS propagates in 5–60 minutes typically

**Gotcha**: GoDaddy's free Workspace Email creates default MX records on
the root. If you're adding a Resend subdomain, this won't conflict. If
you're adding to the root domain, you must remove or coexist with the
existing MX — usually means switching to a subdomain instead.

### Cloudflare

1. **DNS → Records → Add record**
2. Use the **Proxy status: DNS-only (gray cloud)** for ALL Resend records.
   The orange-cloud proxy breaks Resend's verification.
3. TTL: leave on Auto
4. For SPF, Cloudflare may show a yellow warning about the `~all` modifier
   — this is fine, save anyway

### Namecheap

1. **Domain List → Manage → Advanced DNS → Add New Record**
2. Set TTL to "Automatic" (defaults to 30 min)
3. Namecheap auto-appends the root domain when you save — type just the
   subdomain prefix

### AWS Route 53

1. **Hosted Zones → click your zone → Create record**
2. Record name: type the full subdomain (including the root, with no
   trailing dot — Route 53 adds it automatically)
3. Use simple routing (not aliased)
4. TTL: 300 (5 min) recommended for faster iteration

### Squarespace

1. **Settings → Domains → click the domain → DNS Settings → Custom Records**
2. Squarespace has known issues with long TXT values (like DKIM). If
   verification fails, try splitting the DKIM value into two quoted strings
   joined by a space: `"first part" "second part"`

---

## Verification checklist

After Stage 3 + Stage 4, confirm everything is wired:

- [ ] Resend dashboard shows the domain as **Verified** (all 3 records green)
- [ ] Stage 4 save completed without errors
- [ ] Diagnostic check shows `sender_verified_at` is set (not null):
  ```sql
  select display_name, sender_email, sender_verified_at
  from locations
  where id = '<location-id>';
  ```
- [ ] Test send lands with the correct From header (Stage 5)
- [ ] Reply-to header points to a useful address (usually the staff member
      who sent it — automatic, set by the send action)

---

## Troubleshooting DNS

### "Verification failed" in Resend

**Cause 1: DNS hasn't propagated yet.** Wait 15 min and retry. Some
providers (GoDaddy) can take up to 60 minutes.

**Cause 2: Hostname formatting.** The most common error. If you typed
`reviews.drhuangclinic.com.drhuangclinic.com` (because the provider
auto-appended the root and you also typed it), the record is at the wrong
location. Delete and re-add with just `reviews` as the host.

Quick test from terminal:
```
dig MX reviews.drhuangclinic.com +short
```
Should return `10 feedback-smtp.us-east-1.amazonses.com.`. If it returns
nothing OR returns at a different host, the record's at the wrong location.

**Cause 3: DKIM value truncated.** Long TXT records (DKIM is ~250 chars)
sometimes get truncated when pasted. Open the Resend "Records" tab and
the customer's DNS record side by side — character-count check the DKIM
value.

**Cause 4: Cloudflare proxy enabled.** Resend records must be set to
**DNS-only (gray cloud)**. The orange-cloud proxy intercepts all queries
and breaks verification.

**Cause 5: Existing MX record at root.** If you're trying to verify the
root domain (`drhuangclinic.com`) but they already have Google Workspace
email there, MX records conflict. Solution: use a subdomain instead
(`reviews.drhuangclinic.com`).

### Verification succeeded but BAAM Review still uses the shared sender

Check the location row:
```sql
select sender_email, sender_verified_at from locations
where id = '<location-id>';
```

If `sender_verified_at` is null, the BAAM Review side didn't auto-flip.
Most common cause: the location was saved BEFORE the domain became verified
in Resend. **Fix**: re-save the location settings form. The save action
re-queries Resend and updates `sender_verified_at` if the domain is now
verified.

If re-saving doesn't fix it, check the Resend API key:
- BAAM admin → Resend dashboard → API Keys → confirm the key set in
  `RESEND_API_KEY` has **Full Access** (not "sending only")

### Emails sending but bouncing

If the From header is correct (custom domain) but emails bounce:

- **Recipient's spam filter rejected** — sender domain too new. Continue
  sending consistently for 1-2 weeks to build reputation.
- **DMARC alignment fail** — if you added DMARC with `p=reject` and the
  alignment isn't tight, sends get rejected. Lower to `p=none` temporarily,
  review reports, fix the cause, then re-tighten.
- **SPF/DKIM record changed** — someone modified DNS. Re-verify in Resend.

---

## Further deliverability improvements

If, after setting up the custom sender, emails still land in Promotions:

1. **Disable open tracking** in Resend → Domains → Configuration. The 1×1
   tracking pixel is a strong Promotions-tab signal. You lose `email.opened`
   events but keep delivery and clicks.
2. **Disable click tracking too** if you want max placement. You'll lose
   the wrapped-link redirect (no `email.clicked` events) but the user
   still completes the review on your landing page, which is the metric
   that actually matters.
3. **Train Gmail with manual moves**. Have the customer's team move
   the first few test emails to Primary manually (and reply to them).
   Gmail learns within a few sends per recipient.
4. **Warm-up period**: deliverability builds over weeks. Don't judge
   placement from a single test.

---

## What each DNS record actually does

For staff curious about why this works:

| Record | Function | Failure mode if missing |
|---|---|---|
| **MX** | Receives bounce notifications and out-of-office replies. Without it, bounce data is lost and your suppression list grows incomplete. | Bounces silently disappear; reputation suffers over time |
| **SPF (TXT)** | Lists which servers are authorized to send emails on this domain's behalf. Inbox providers reject mail from unlisted senders. | Emails go to spam or get rejected outright |
| **DKIM (TXT)** | Each sent email carries a cryptographic signature. The DKIM record provides the public key to verify those signatures. Without it, the signature can't be verified. | Emails fail authentication → spam folder |
| **DMARC (TXT)** | Policy on what to do when SPF/DKIM fail. Also enables reporting. | No reporting; no policy enforcement |

---

## Rollback (if needed)

If a custom sender setup goes wrong and you need to revert to the shared
sender immediately:

1. **In BAAM Review** → location settings → clear the "Send-from email"
   field → Save
2. The location now sends from `support@baamplatform.com` again on next send
3. The DNS records can stay (harmless) or be removed at the customer's DNS
   provider. The Resend domain entry can stay or be removed in the Resend
   dashboard.

**Note**: in-flight sends already queued at Resend complete using whichever
sender they were submitted with. The change only affects subsequent sends.

---

## When to use this SOP

- ✅ **Every Full-Service customer onboarding** (mandatory per policy)
- ✅ **Self-Service customers requesting better deliverability** (offered as
  an upgrade)
- ✅ **High-volume customers** (>500 review requests/month) — reputation
  isolation becomes critical

## Checklist version (for quick reference during a setup call)

```
□ Customer has DNS access
□ Decide subdomain (reviews.*) vs root → recommend subdomain
□ Resend → Add Domain → enter subdomain → copy 3 DNS records
□ Customer adds MX, SPF (TXT), DKIM (TXT) at their DNS provider
□ Wait 5-15 min for DNS propagation
□ Resend → click Verify → confirm 3 records flip green
□ BAAM Review → location settings → Send-from name + Send-from email → Save
□ Confirm sender_verified_at is set (in DB or via re-save if unsure)
□ Send test email to 2 known inboxes
□ Confirm Primary tab placement
□ Confirm From header reads "<Business Name> <review@reviews.domain.com>"
```

---

## Document history

- **2026-05-28** — Initial SOP authored based on first production rollout
  (DR. Huang Acupuncture / drhuangclinic.com → shared sender on root domain).
  Recommends subdomain pattern going forward to avoid root-domain DNS
  conflicts.
