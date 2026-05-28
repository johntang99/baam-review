# Single Review Request — Standard Operating Procedure

How to send a one-off review request that lands in the customer's Primary
inbox, sounds personal, and converts to an actual review.

**Use this when**: you need to send to one specific customer right now —
they just left, they're a VIP, the business owner is sitting next to you,
etc. For week-of-visits batches use the [Bulk Review Request SOP](./BULK_REVIEW_REQUEST_SOP.md) instead.

**Audience**: BAAM Review staff (admin / sales / account_manager) or
self-service customers using `/app/send`.

---

## Why single send still matters

Even with bulk sends doing most of the volume, the single-send path is
better for these scenarios:

| Scenario | Why single send wins |
|---|---|
| Customer just walked out | Send within an hour while the experience is fresh — best response rate |
| High-value customer (long-term patient, big spender) | Worth crafting a personal message; bulk variants are still generic |
| Owner wants to send themselves from their phone | The send page works on mobile; no list creation needed |
| Re-send after a bounce / fix | One customer at a time is cleaner |

---

## Pre-send checklist

Before clicking Send, confirm:

- [ ] **Recipient actually visited the business.** Sending review requests
      to non-customers is a Google policy violation and can get the GBP
      profile suspended. No exceptions.
- [ ] **Recipient gave consent** to receive emails (verbal at checkout is
      fine for most jurisdictions; written consent for stricter ones).
- [ ] **Custom sender domain is set up** for this location. Look for
      `From: <Business Name> <review@reviews.theirdomain.com>` in the
      preview area — NOT `... via BAAM Review <support@baamplatform.com>`.
      If shared sender is used, follow the [Custom Sender Domain Setup SOP](./CUSTOM_SENDER_DOMAIN_SETUP.md)
      first. **This is the single biggest deliverability factor.**
- [ ] **Location has active billing** (location_subscriptions.subscription_status
      is `trialing`, `active`, or `past_due`). Without active billing the
      send is blocked at the gate.
- [ ] **No duplicate sends.** Check the customer's history at `/app/reviews`
      — sending the same person two requests in 30 days looks pushy and
      tanks engagement.

---

## Compose the message

### Step 1 — Pick the location and channel

`/app/send` → pick the location → channel defaults to **Email**. SMS is
also supported but only when Twilio is wired up; email is the default
because deliverability is much more controllable.

### Step 2 — Fill in the recipient

- **Name**: first name only is fine. The greeting "Hi April," reads
  better than "Hi April Wang Smith,".
- **Email**: lower-case it; trim whitespace. The form does this but
  double-check pasted values.
- **Language**: pick what the customer actually speaks — NOT the
  location's default. The system supports en / zh / es and renders the
  review form in the same language.

### Step 3 — Use the AI rewrite (recommended)

Click **"Rewrite with AI"** above the body field. This does two things:

1. **Generates a fresh subject + body** in the language you've selected,
   matching the **tone** you picked from the dropdown
2. **Preserves the business name, the link placeholder, and the recipient's
   first name** — even though the AI rewrites the surrounding copy

#### Tone selection guide

| Tone | When to use |
|---|---|
| **Warm** (default) | Default for most cases. Reads like a sincere thank-you note. |
| **Brief** | Repeat customers, busy professionals. 2–3 sentences plus the link. |
| **Professional** | Medical, legal, B2B customers who expect formal communication. |
| **Casual** | Restaurants, salons, retail — relationship-based informal businesses. |

For Chinese language, tones translate to: 親切 (warm) / 簡潔 (brief) /
正式 (professional) / 輕鬆 (casual).

#### Why rewrite when there's already a default template?

Inbox-providers' spam filters hash incoming email bodies. If you (or
your team) send 50 identical-looking emails per week from the same
sender, those filters start treating your domain as bulk marketing →
Promotions tab → eventually spam folder. **AI rewrite varies the
content** so each email looks naturally different. This matters even
on single sends because the spam classifier sees patterns across many
sends over weeks.

#### What the AI is told NOT to do

The system prompt has hard rules. The AI will refuse to produce a
draft that:

- Removes the business name
- Removes the URL placeholders (`<slug>` and `<token>`)
- Offers any incentive, gift, discount, or reward for a review (Google
  policy violation)
- Implies the reviewer should leave a specific rating ("5 stars please")
- Uses urgency language ("limited time", "today only")
- Mentions BAAM, AI, or any tooling
- Uses emojis, hashtags, or ALL-CAPS

If a rewrite somehow slips one of these through, the validation guard
rejects it and retries — staff sees an error instead of bad content.

### Step 4 — Review the preview

After AI rewrite (or with the default template), check:

- **Subject** (50–60 chars ideal). Examples that work:
  - "Linda, do you have a minute?" ✅
  - "Quick favor from Dr Huang Clinic" ✅
  - "REVIEW REQUEST — PLEASE READ" ❌ (all-caps screams spam)
- **Body** (60–180 words for email). Check:
  - Recipient's first name appears at least once
  - Business name appears at least once
  - There's exactly ONE call-to-action (the review link)
  - No marketing fluff or promotional language
- **From field** should show the custom sender, not the shared one

### Step 5 — Send

Click the green **Send via email** button. The send happens immediately;
the customer should receive the email within 30 seconds. You'll see a
success toast with a link to view tracking.

---

## After the send

### What to expect

| Time | Expected event |
|---|---|
| 0–30 sec | `email.delivered` webhook fires → BAAM dashboard shows "Delivered" |
| 5 min – 24 hrs | Customer opens (if open-tracking is on — usually off for better placement) |
| 5 min – 7 days | Customer clicks the review link → BAAM shows "Clicked" |
| 5 min – 7 days | Customer completes the review on Google → BAAM shows "Reviewed" |

**A typical funnel** looks like 100% sent → 95% delivered → 50% opened
→ 30% clicked → 15% reviewed. For high-trust businesses (long-term
patients, regulars), conversion can hit 40–50%. For one-shot retail
walk-ins, 5–10% is normal.

### When to follow up

- **No click in 5 days**: send a softer follow-up. Use Brief tone:
  "Linda, didn't want to bug you — but if you have 60 seconds…"
- **Clicked but no review in 7 days**: don't follow up. The customer
  saw the form and chose not to complete it; pushing harder is spam.
- **Bounced**: do NOT resend. The address is bad — try a different
  channel (SMS) or skip this customer.

---

## Avoiding the Promotions tab

The Gmail Promotions classifier looks at dozens of signals. The most
impactful ones, in priority order:

### 1. Sender domain (biggest lever)

- ✅ `<Business Name> <review@reviews.theirdomain.com>` (custom subdomain)
- ✅ `<Business Name> <review@theirdomain.com>` (custom root domain)
- ❌ `<Business Name> via BAAM Review <support@baamplatform.com>` (shared)

If your sends are landing in Promotions, **fix this first**. See the
[Custom Sender Domain Setup SOP](./CUSTOM_SENDER_DOMAIN_SETUP.md).

### 2. Personalization (significant)

Every email MUST contain:
- The recipient's first name
- The business name
- Specific context if possible (service received, visit date)

The AI rewrite handles this automatically. Manual edits should preserve
these elements.

### 3. Tracking pixel (moderate)

The 1×1 open-tracking pixel is a classic Promotions signal. If your
emails consistently land in Promotions despite a custom sender, consider
disabling open tracking in Resend → Domains → toggle off "Track Opens".
You lose `email.opened` events but gain inbox placement. Click tracking
can stay on (much weaker signal).

### 4. Content patterns (moderate)

Avoid these in subject or body:

- ALL-CAPS WORDS (any volume)
- Excessive exclamation marks (more than one is suspicious)
- "FREE", "URGENT", "GUARANTEED", "WINNER", "100% off", "Act now"
- Multiple links per email (review request should have ONE link)
- Image-heavy HTML with multiple CTAs (looks like a marketing newsletter)

The AI rewrite avoids all of these by default. Manual content edits
should keep the email plain, conversational, and link-light.

### 5. Sending volume (small for single sends)

For single sends, volume is rarely the problem. But if you and your
team manually send 50+ emails per day per location, the sender domain
will accumulate volume — and that volume needs to be matched by an
equally high engagement rate. See the Bulk SOP for details.

---

## Multilingual sends

### Chinese (中文)

The AI rewrite supports both Simplified and Traditional Chinese. It
will match the character set used in the existing body or business name.
If you need to force a specific variant (e.g., all Traditional for a
Hong Kong audience), edit the existing body to that variant before
clicking Rewrite — the AI will preserve your character choice.

**Chinese-character emails get extra scrutiny from Western spam
filters.** Mitigations:
- Send from a fully-authenticated custom domain (DKIM + SPF + DMARC)
- Avoid mixing Chinese + ALL-CAPS English in subject or body
- Test rendering in QQ Mail, 163, and Outlook (popular among Chinese
  immigrants in NYC) before rolling out to a new client
- Keep subject under 30 characters — long Chinese subjects truncate in
  preview and look spammy

### Spanish (Español)

Same deliverability rules apply. The AI generates appropriately formal
or casual Spanish based on the chosen tone. **Don't mix English and
Spanish in the same email** — pick one and stick with it.

### Mixed-language scenarios

If your customer base spans languages and you're not sure which to use:
default to the location's primary language. The customer can read it
even if it's their second language, and inbox placement is better when
the language matches the sender domain's typical content.

---

## Troubleshooting

### "Didn't arrive"

- Check Spam/Junk folder first (most common)
- Check the dashboard at `/app/reviews` — does it show `delivered` for
  this send? If yes, the issue is recipient-side.
- If `delivered` is missing but `sent` is present, check Resend's logs
  for a bounce or delay
- If neither, check that the send actually completed (no error toast?)

### "Landed in Promotions"

- See [Avoiding the Promotions tab](#avoiding-the-promotions-tab) above
- Single sends from a new sender domain can take 1–2 weeks of consistent
  sends to build positive reputation; placement improves with time
- Have the recipient manually move the email to Primary and reply — both
  are strong positive signals to Gmail's classifier

### "Customer says they didn't get it"

- Did you ask them to check Spam/Promotions? Almost always there
- Did you use the right email address? Re-verify the spelling
- Has this address bounced before? Check Resend logs → if bounced once,
  it'll likely bounce again; ask for a different address or use SMS

### "I clicked Send but nothing happened"

- Check the page for an error message (red banner)
- Common cause: location's billing isn't active. Look for "Billing
  required" — click the pill to set up billing (see [Locations table](/app/locations))
- If the form just looks blank: refresh the page and try again

### "AI rewrite returns the same thing every time"

- Different tones produce different results — make sure you change the
  dropdown before clicking Rewrite
- If you're getting truly identical output from different tones, that's
  a bug — report it. The default behavior is each tone visibly differs.

---

## What NOT to do

- ❌ **Don't send to "potential" customers** (people who haven't visited).
  Google policy violation.
- ❌ **Don't ask for 5 stars** in the body. Google's filter looks for this
  and penalizes the business profile.
- ❌ **Don't offer rewards** for reviews. Federal regulatory issue (FTC)
  in the US, plus Google policy.
- ❌ **Don't send the same email to multiple recipients** by changing
  only the To field. Use the Bulk Review Request flow for that — it
  varies subject + body per recipient automatically.
- ❌ **Don't re-send to a bounced address.** It will bounce again, and
  bounces hurt sender reputation for everyone on the shared domain
  (or the location's domain if isolated).
- ❌ **Don't send in a language the recipient doesn't read.** Even with
  perfect deliverability, a Chinese-only customer ignoring an English
  email is the same outcome as it going to spam.

---

## Quick checklist (use during a send)

```
□ Location has custom sender domain set up (otherwise see Custom Sender SOP)
□ Location billing is active
□ Recipient actually visited the business
□ Recipient consented to receive email
□ Pick the correct language (recipient's language, not yours)
□ Click "Rewrite with AI" — pick tone matching the customer's style
□ Verify preview: name + business name + ONE link, no spam-trigger words
□ Verify From: shows custom domain, not "via BAAM Review"
□ Click Send via email
□ Confirm "delivered" appears within 30 seconds on /app/reviews
```

---

## Document history

- **2026-05-28** — Initial SOP. Covers single-send flow at `/app/send`
  with AI rewrite (4 tones, multilingual), custom sender domain
  expectations, and Promotions-tab mitigation strategies. Companion
  to BULK_REVIEW_REQUEST_SOP.md for batch sends.
