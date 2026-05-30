# Bulk Review Requests — Standard Operating Procedure

How to send review requests to a list of customers (5 – 500 at a time)
while staying out of spam folders, keeping deliverability reputation
healthy, and converting at the highest rate possible.

**Use this when**: a business wants to email a batch of recent customers
— "everyone we saw this week", "all new patients from October", "the
list of people who finished therapy this month". For one-off sends use
the [Single Review Request SOP](./SINGLE_REVIEW_REQUEST_SOP.md).

For Gmail policy, daily limits, pacing, and AI-copy safety guardrails,
see [Gmail Sending Safety SOP](./GMAIL_SENDING_SAFETY_SOP.md).

**Audience**: BAAM Review staff doing operations work for Full Service
customers, plus self-service customers using `/app/lists`.

---

## The mental model: bulk sends are NOT marketing blasts

A review-request batch is closer to **personal correspondence sent in
rapid succession** than to a marketing campaign. The goal:

| Marketing email | Bulk review request |
|---|---|
| One identical message to many people | Each recipient gets a slightly different (subject, body) variant |
| Heavy HTML with images, CTAs, footers | Plain, short, single-link |
| Sent from a marketing platform identity | Sent from the business's own domain |
| Optimized for open rate | Optimized for review-completion rate |
| Spam-folder placement is "expected loss" | Spam-folder placement is a failure |

If you remember nothing else: **the goal is for each recipient to feel
like the business owner personally wrote them a quick note** — not
that they got swept up in a campaign.

---

## Pre-send checklist (run through before EVERY batch)

- [ ] **Custom sender domain set up for the location.** See [Custom Sender
      Domain Setup SOP](./CUSTOM_SENDER_DOMAIN_SETUP.md). Required for
      Full Service customers; strongly recommended for Self-Service. The
      #1 driver of inbox placement.
- [ ] **Location billing is active.** `location_subscriptions.subscription_status`
      ∈ {trialing, active, past_due}. The bulk send blocks otherwise.
- [ ] **All recipients actually visited the business** in the past 90
      days. Older than 90 days = stale list = bounce risk + low
      engagement = sender-reputation damage. Google policy also requires
      genuine visit history.
- [ ] **All recipients consented** to receive emails. Verbal at checkout
      is fine for most jurisdictions.
- [ ] **No recipient on the list has been emailed for review in the past
      30 days.** Re-asking too soon feels pushy; lifecycle dedup at
      `list_customers.excluded_reason = duplicate_60d` handles this
      automatically in the BAAM Review flow.
- [ ] **List size is reasonable for this sending stage** (see
      [Volume guidelines](#volume-guidelines) below).
- [ ] **AI variations have been generated and reviewed.**
- [ ] **If using Gmail/manual Gmail-assisted sending**, apply the cadence
      and volume controls in [Gmail Sending Safety SOP](./GMAIL_SENDING_SAFETY_SOP.md).

---

## Step-by-step send workflow

### Step 1 — Build the customer list

Go to **/app/lists/new** → pick the location → choose import method:

| Method | When to use |
|---|---|
| **Paste from spreadsheet** | Most common. Open the sample in Sheets/Excel, replace example rows, paste into the textarea. |
| **File upload** | Download the [sample Excel](/samples/bulk-review-requests-sample.xlsx) or [sample CSV](/samples/bulk-review-requests-sample.csv), edit, save, upload. |
| **Manual entry** | For very short lists (≤10 customers). |

Required columns: **Name**, **Email** (or Phone for SMS-only customers).
Optional: **Language** (en/zh/es), **Visit date**, **Notes**.

The parser is forgiving — column order doesn't matter, header row is
auto-detected, language can be spelled multiple ways ("English", "EN",
"中文", "Chinese", "Spanish", "Español" all work).

### Step 2 — Review and clean the list

After paste/upload, you land on the preview screen. The system has
already done basic validation:

| Indicator | Meaning | Action |
|---|---|---|
| Green check next to row | Valid; will send | None |
| Yellow warning | Missing optional field (e.g., no phone) | Usually fine to send |
| Red strikethrough | Excluded (duplicate, opted out, bounced before) | Will not send; leave as-is |
| Unchecked checkbox | You manually unchecked it | Will not send |

**Hygiene rules to apply manually**:
- Uncheck anyone whose visit was >90 days ago (review request feels
  stale after 3 months)
- Uncheck anyone whose visit ended badly — review requests after a
  complaint situation are a bad idea
- Verify language is right for each customer — wrong language tanks
  engagement to almost zero

### Step 3 — Generate AI variants

This is the **anti-spam-classifier secret**. Click **"Generate variations"**
on the presend page. ~5 seconds later you have 5 distinct templates:

| Variant | Content |
|---|---|
| #1 (default) | The default template — same as a non-bulk send would use |
| #2 (brief) | 2–3 sentences plus link |
| #3 (professional) | Polite, formal tone |
| #4 (casual) | Conversational, light |
| #5 (warm) | Sincere thank-you note tone |

At send time, customers are assigned variants via a **balanced
round-robin shuffle** — for a 22-customer list, two variants are used
5 times each and three are used 4 times each, in randomized order.

#### Why 5 variants instead of N per recipient?

Spam classifiers fingerprint at the **template level** — 5 visibly
different bodies break the fingerprint as effectively as 22 unique
ones, at a fraction of the cost (~5¢ per list vs ~$0.02 per list).
Staff can also QA all 5 variants before send, which catches AI weirdness
that pure per-recipient generation wouldn't.

#### Edit variants before sending (recommended for new clients)

Click **Preview** to expand the variant cards. Each card has an **Edit**
button — click it to tweak subject or body for that one variant. Useful
when the AI produces something slightly off-tone for a particular
business (a luxury brand wants a more formal Variant #4, etc.).

The save action validates:
- Body still contains the business name literally
- Body still contains `<slug>` and `<token>` placeholders
- Subject ≤ 120 chars

Staff can't accidentally ship a broken variant.

#### Mixed-language warning

When a list has customers in multiple languages (e.g., 15 Chinese, 5
English, 2 Spanish), the variants are only generated in the list's
**default language**. Customers in other languages receive the default
template in their own language at send time. The system shows a banner
warning when this applies:

> ⚠ Variants generated in 中文 only. 2 English, 1 Español customers will
> receive the default template in their own language instead.

This is the right behavior — sending a Chinese-language variant to a
Spanish customer would be much worse than sending them the default
Spanish template.

### Step 4 — Final review

The presend table shows every customer in the list with:
- Channel (Email / SMS)
- Language pill (EN / 中文 / ES)
- Notes field (editable)
- Selected checkbox

Glance through one last time. Common edits at this stage:
- Re-check a customer you accidentally unchecked
- Fix a typo in a Notes field
- Verify the right language is picked for each row

### Step 5 — Send

Click **"Send to N customers"** at the bottom. The send is synchronous
— don't navigate away until you see the success toast (`Sent to 22 ·
0 failed`).

For lists over ~50 customers, the send takes 10–30 seconds (one-by-one
through Resend). The page stays on the presend table while sending; a
spinner indicates progress.

---

## Volume guidelines

### Daily limits (Resend)

Resend's transactional tier limits:

| Plan | Per-day cap | Per-month cap |
|---|---|---|
| Free | 100 | 3,000 |
| Pro | none | none |
| Scale | none | none |

BAAM Review is on a paid Resend plan — Resend itself isn't your
bottleneck. **The real bottleneck is recipient inbox providers** (Gmail,
Outlook, Yahoo, Apple iCloud), which apply their own per-sender-domain
limits and reputation-based throttling.

### Per-sender-domain volume (the real limit)

| Domain age | Recommended max per day | Notes |
|---|---|---|
| Brand new (<7 days verified) | 10–20 | Warm-up mode. Don't blast yet. |
| 1–4 weeks old | 20–100/day | Gradual ramp; monitor bounce rate |
| 1–3 months old | 100–500/day | Healthy domain |
| 3+ months with clean record | 500–5,000/day | Established reputation |

If a new business with a freshly-verified custom sender domain wants
to send to 200 customers their first week, **don't.** Split into 4
sends of 50 each across 4 days. Spreading volume early builds a
positive sender-reputation trajectory; spiking it early establishes a
suspicion baseline that's hard to recover from.

### Per-send batch size

Even on an established domain, single-batch size matters:

| Batch size | Acceptable? | Why |
|---|---|---|
| 1–25 | Always fine | Looks like normal correspondence |
| 25–100 | Fine if domain is warmed up | Standard SMB volume |
| 100–250 | Pace it out | Sudden 250-recipient burst is a yellow flag |
| 250+ | Split into multiple sends | One big burst trips throttling at Gmail/Outlook |

The bulk send code already paces sends sequentially (one customer at
a time, ~50–100ms each), so a 100-recipient batch takes ~10 seconds
to fully transmit. That's slower than necessary for the system, but
gentle on inbox-provider rate limits.

### Multi-tenant isolation (when it matters)

If 10 client businesses all send from the shared `support@baamplatform.com`
sender (no custom domain), and one client's emails generate spam
complaints, **all 10 clients' deliverability drops together**. The
shared domain accumulates the bad reputation.

When isolation matters most:
- High-volume clients (>500 review requests/month)
- Clients in sensitive industries (medical, legal) — bounce/complaint
  rates tend to be higher
- Clients with newer email lists (more bounce risk)

Custom sender domains per client are the fix. See [Custom Sender Domain
Setup SOP](./CUSTOM_SENDER_DOMAIN_SETUP.md).

---

## Content variation (anti-spam-classifier)

Variation works on three axes. The AI variants handle all three, but
manual edits should preserve them:

### 1. Subject line variation

Every recipient gets a subject from the variant assigned to them. Across
the batch, you'll see 5 distinct subjects. Examples for a Chinese
acupuncture clinic:

- "{name}，能耽误您一分钟吗？" (default warm)
- "{name}，今天来看诊感觉怎么样？" (casual)
- "您的寶貴意見，對我們意義重大" (formal Traditional)
- "DR. Huang 想听听您的反馈" (brief — practitioner-name framing)
- "感谢您光临 DR. Huang Acupuncture" (warm — business-first framing)

Inbox providers fingerprint exact subjects — having 5 across a 20-person
batch beats having 1.

### 2. Body variation

Each variant has a structurally different body — different opening
sentence, different sentence count, different CTA framing. Same call
to action (the review link), same business name, but the surrounding
copy varies.

### 3. Per-recipient personalization

Within any one variant, **{name} is substituted with the recipient's
first name**. So "Hi {name}," becomes "Hi Linda," for one customer and
"Hi Marcus," for the next. The business name is also baked in literally
so the AI can't accidentally homogenize it.

### What to KEEP consistent across variants

- Core call-to-action (the review link)
- Footer (unsubscribe link, business name)
- No incentive language ("free", "discount", "gift") — Google policy
  violation in every variant
- Plain text style; no marketing HTML

The validation guard rejects rewrites that violate these rules — but
manual variant edits should respect them too.

---

## Timing and pacing

### When to send during the day

Best response rates for review requests in the US:

| Day | Time (recipient's local time) | Why |
|---|---|---|
| Tue / Wed / Thu | 10am – 2pm | Mid-week, mid-day — checking email during lunch |
| Tue / Wed / Thu | 6pm – 9pm | After work, before TV |
| Mon | After 10am | Mondays are busy; don't compete with Monday emails |
| Fri afternoon | Avoid | "I'll do it Monday" → forgotten |
| Weekends | OK for casual businesses (restaurants, salons) | Avoid for medical/legal |

### Spreading sends across hours (not just minutes)

The bulk send completes the technical send in ~10 seconds for 50
recipients. That's a tight burst. **If you have a list of 200 to send**,
consider splitting into 4 batches of 50 across the morning rather than
one big 200 send. Smoothes the rate-limit curve at Gmail/Outlook.

### Send-time variation in the data itself

The system already varies the per-recipient send timestamp by a few
hundred milliseconds (natural processing delay). This is enough variation
for inbox-provider rate limiters. **Don't manually delay sends with a
script** — Resend doesn't expose a per-recipient delay parameter, and
hand-paced sends create more inconsistency in the per-recipient delivery
timeline than the natural send order.

---

## Monitoring after send

### The lifecycle funnel

After clicking Send, navigate to the list detail page. You'll see:

```
5 SENT (100%) → 5 DELIVERED (100%) → 3 OPENED (60%) → 3 CLICKED (60%) → 1 REVIEWED (20%)
```

The funnel updates in real time via Resend webhooks (delivered, opened,
clicked) and the BAAM review-completion event.

### What "healthy" looks like

| Stage | Target rate | Concern threshold |
|---|---|---|
| Delivered / Sent | >95% | <90% (lots of bounces — bad list) |
| Opened / Delivered | 30–70% | <20% (sender reputation issue) |
| Clicked / Opened | 40–60% | <20% (subject mismatch with body) |
| Reviewed / Clicked | 30–50% | <15% (review form has UX issue) |

Note: opened is only tracked if open tracking is enabled in Resend.
Many BAAM customers run with open tracking OFF for better placement —
in which case the funnel goes Sent → Delivered → Clicked → Reviewed.

### Second-touch (5-day rule)

The system marks customers as **eligible for resend** at day 5 if they
haven't clicked. Click "Resend to non-clickers" on the list detail page
to send a softer follow-up. Don't do this manually — the resend flow
applies a different (gentler) variant pool and respects the velocity
gate so you don't accidentally double-send.

### When to investigate

- **Bounce rate >5%**: stop adding to this list. Likely bad data
  source. Check email column for typos.
- **0 opens after 24 hours**: deliverability issue. Check Resend
  webhook log for hard delivery confirmations. If delivered but
  zero opens, the emails are going to Spam folder.
- **High clicks, zero reviews**: review form has a bug or the GBP
  isn't connected properly. Test the link yourself.
- **One specific customer's events never fire**: their email provider
  may be stripping tracking. Not your problem; they may still complete
  the review.

---

## Authentication requirements (technical reference)

These are required by Gmail/Yahoo since Feb 2024 for any sender
emailing more than 5,000/day per Gmail user (and best practice at any
volume). All of these are configured automatically when you set up a
custom sender via the [Custom Sender Domain Setup SOP](./CUSTOM_SENDER_DOMAIN_SETUP.md).

| Record | What it does | Required value |
|---|---|---|
| **SPF** | Lists Amazon SES (Resend's backbone) as authorized to send from this domain | `v=spf1 include:amazonses.com ~all` |
| **DKIM** | Cryptographic signature on every email; receivers verify with the public key in DNS | Resend-provided long string at `resend._domainkey.<subdomain>` |
| **DMARC** | Policy on what to do when SPF/DKIM fail; also enables reporting | Start at `v=DMARC1; p=none; rua=mailto:...`; graduate to `quarantine` |
| **MX** | Receives bounce notifications so suppression list stays accurate | `feedback-smtp.us-east-1.amazonses.com` priority 10 |
| **List-Unsubscribe header** | Allows recipients to one-click unsubscribe; mandatory by Gmail for senders >5K/day | Auto-added by BAAM Review on every send (mailto + URL) |

If any of these are missing, deliverability drops dramatically. The
custom sender setup SOP walks through configuring all of them.

---

## Multilingual bulk sends

### Single-language lists (recommended)

Easier to manage. The variants generate in one language, all customers
get variants from that pool. No mixed-language warnings, no edge cases.

Group your customers by language when building the list. If you have
60 customers across English/Chinese/Spanish, run **three separate sends**
(60/15/5 in each language), not one mixed send of 80.

### Mixed-language lists (acceptable)

The system handles mixed lists gracefully: customers in the list's
default language get AI variants; everyone else gets the default
template in their own language. This is correct behavior — never send
a wrong-language email.

**When to use mixed lists**: small batches where splitting by language
would create lists of 1–2 customers. Mixed is fine; just expect the
non-default-language recipients to get the standard template (no
variant).

### Chinese-character emails (NYC clinic context)

Chinese-character bulk emails to Chinese-American customers in NYC
(Flushing, Chinatown, etc.) have a few extra considerations:

- **Sender domain reputation matters more**. Set up the custom domain
  *before* the first bulk send.
- **Test with QQ Mail and 163.com** addresses if any customers use them
  — Chinese providers have stricter filters for foreign-IP senders.
- **Outlook/Hotmail** is popular among older Chinese immigrants — test
  with at least one Outlook recipient before a big send.
- **Subject line in Chinese should be ≤30 characters** — longer
  subjects truncate in inbox preview and look spammy.

---

## Troubleshooting

### "No sends succeeded — list left as draft"

Most common cause: **location billing isn't active**. The location's
`subscription_status` must be trialing/active/past_due. Click the
billing pill / banner that appears after the failure to set it up.

### "Variants didn't generate"

- Anthropic API rate limit (rare) — wait 1 minute, regenerate
- Network blip — regenerate (the system makes the call again with no
  side effects)
- Persistent failure — check Vercel logs for the rewrite-body endpoint

### "Emails sent but everyone got the same content"

- Check `lists.template_variants` in the database — should be a 5-element
  array. If null, variants weren't applied.
- Check `list_customers.variant_index` and `review_requests.variant_index`
  after a send — they should be different values 0–4 per row.
- If you see all the same value, the assignment algorithm has a bug
  (shouldn't happen with current code — open an issue).

### "Some emails delivered, some bounced"

Normal for any bulk send. Resend's webhooks update
`review_requests.delivered_at` and trigger lifecycle status on bounce.
Bounced customers go into the `opt_outs` table automatically; future
sends to those addresses are blocked.

If bounce rate >10% on a single list: the list is bad. Stop using this
data source.

### "Customers say emails went to spam"

Walk through these in order:

1. **Is the custom sender domain set up?** If not, fix that first.
2. **Is open tracking on?** Toggle it off in Resend → Domains. The 1×1
   pixel is a strong Promotions signal.
3. **Are subject lines varied across the batch?** Check the variants
   — 5 distinct subjects is the goal.
4. **What's the recipient's email provider?** Gmail and Outlook have
   the strictest filters; Yahoo is forgiving; iCloud is in the middle.
5. **How old is the sender domain?** If verified <2 weeks ago, expect
   some Promotions placement until reputation builds.

### "I sent to 50 people but only 30 got delivered"

Check the funnel — if delivered = 30/50, the other 20 are stuck
in-flight or bounced. Wait 30 minutes; if delivered count doesn't
move, examine the failed sends individually via the list detail page.

---

## What NOT to do

- ❌ **Don't send to >100 customers from a brand-new sender domain.** Warm
  up first.
- ❌ **Don't manually paste the same body into multiple recipient slots.**
  That's what variants are for.
- ❌ **Don't send to anyone who hasn't visited recently.** Both an
  engagement-rate killer and a Google policy violation.
- ❌ **Don't ask for 5 stars** in any variant. The AI prompt blocks this;
  manual edits should respect it.
- ❌ **Don't offer incentives** (discount, free service) for reviews.
  FTC violation in the US.
- ❌ **Don't send the same list twice within 30 days.** The dedup check
  exists for a reason.
- ❌ **Don't keep bumping people who didn't click.** One second touch
  at day 5 is the limit. Beyond that, you're harassing.
- ❌ **Don't blame the recipient when emails go to Promotions.** The
  classifier weighs sender reputation 10× more than recipient behavior.
  Fix the sender side.

---

## Quick checklist (use during a list send)

```
□ Custom sender domain set up for this location
□ Location billing is active
□ List built — all rows valid, no stale visits, no duplicates
□ Customer language correctly identified per row
□ AI variations generated (5 variants — Default + 4 tones)
□ Variants reviewed for tone match; any awkward ones edited
□ Mixed-language warning addressed (split into separate lists if large)
□ Verified the From: shows the custom sender, not the shared one
□ Send timing: weekday 10am–2pm or 6pm–9pm (recipient's local time)
□ Click Send → wait for the success toast
□ After 30 min: check funnel for unusual bounce or low-delivery rates
□ Day 5: review who hasn't clicked → consider resend flow
```

---

## Document history

- **2026-05-28** — Initial SOP. Covers bulk send flow at `/app/lists/*`
  including AI variants, balanced round-robin assignment, mixed-language
  handling, Resend volume limits, deliverability authentication, and
  spam-classifier mitigation. Companion to SINGLE_REVIEW_REQUEST_SOP.md
  for one-off sends, and references CUSTOM_SENDER_DOMAIN_SETUP.md for
  per-client sender configuration.
- **2026-05-30** — Added explicit cross-link to
  GMAIL_SENDING_SAFETY_SOP.md for Gmail policy/limit/pacing guidance.
