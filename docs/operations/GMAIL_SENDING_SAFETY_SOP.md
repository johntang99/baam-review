# Gmail Sending Safety — Standard Operating Procedure

How to send review-request emails via Gmail (including manual Gmail flow)
without getting throttled, blocked, or flagged as spam.

**Use this when**: you are sending from Gmail or Google Workspace accounts,
especially from `/app/send` preview Gmail flow and upcoming `/app/lists` bulk
Gmail-assisted workflow.

**Audience**: BAAM Review staff, account managers, and self-service operators.

---

## Quick answers (the 4 most common questions)

### 1) What rules matter most so Google doesn't block or spam-folder us?

- Send only to real customers who visited and expect the message.
- Never use bought/scraped lists.
- Avoid deceptive subjects, fake urgency, or "5-star please" language.
- For domain-sent traffic, set up SPF + DKIM + DMARC.
- Keep complaint rate low (target under 0.1%; avoid reaching 0.3%+).
- For large-volume Gmail traffic, support easy unsubscribe on marketing-style
  flows and honor unsubscribes quickly.

### 2) Is there a daily limit?

Yes. Limits are account-level and applied over a rolling 24-hour window.

Typical reference values:

| Account type | Typical send cap |
|---|---|
| Personal Gmail | ~500 recipients/day |
| Google Workspace (paid) | up to ~2,000 messages/day |
| Google Workspace trial | usually lower (often ~500/day) |

Important: Google can change limits, and reputation-based throttling can happen
below the published caps.

### 3) For bulk sending, what's the safest gap between emails?

There is no single official "magic gap." For safety, use conservative pacing:

- New or recovering sender reputation: **90–180 seconds random gap**
- Healthy warmed sender: **30–90 seconds random gap**
- Never blast large batches back-to-back from a cold sender

### 4) Is AI-written varied content okay?

Yes, and generally helpful, if done correctly.

Safe use:
- Keep it truthful, relevant, and customer-contextual
- Vary tone/phrasing while preserving core intent
- Keep one clear CTA link

Unsafe use:
- Spam-evasion tricks ("urgent", fake scarcity, all-caps promotions)
- Incentive-for-review language (discount/reward for positive review)
- Fake personalization or misleading claims

---

## BAAM operating guardrails (required)

For Gmail-assisted sends in BAAM operations:

1. **Customer legitimacy**
   - Recipient must be an actual customer visit
   - Prefer recency: within 90 days

2. **Consent + suppression**
   - Respect opt-out/bounce suppression list
   - Do not retry hard-bounced contacts

3. **Volume ramp**
   - New sender mailbox: start 20–30/day, then ramp gradually
   - Increase only when bounce/complaint signals are healthy

4. **Per-run pacing**
   - Use randomized delay (not fixed interval)
   - Split large lists into smaller windows (morning + afternoon)

5. **Content hygiene**
   - No incentives, no "5-star" prompts
   - No deceptive subject lines
   - Keep message plain and concise

---

## Recommended warm-up plan (mailbox-level)

| Week | Suggested max/day | Notes |
|---|---|---|
| Week 1 | 20–30 | High personalization, strict list quality |
| Week 2 | 40–60 | Maintain random send gaps |
| Week 3 | 60–100 | Increase only if no warning signals |
| Week 4+ | 100+ | Continue gradual scaling, monitor daily |

If reputation dips, roll back to last healthy tier for 7–14 days.

---

## Warning signals (stop and investigate)

Stop increasing volume immediately if any appears:

- Bounce rate spikes (especially hard bounces)
- User spam complaints increase
- Gmail temporary blocks / unusual send failures
- Open/click collapse across multiple sends

First response:
1) reduce daily volume,
2) improve list quality,
3) tighten copy quality,
4) verify sender auth + mailbox health.

---

## Implementation guidance for BAAM bulk Gmail flow

As we roll out `/app/lists` Gmail-based bulk assistance, enforce:

- Configurable per-location daily caps
- Randomized per-recipient delay window
- Auto-stop threshold on failure/bounce ratio
- Safe default templates + AI variation constraints
- Clear operator warnings when approaching risky volume

---

## References (official Google docs)

- Gmail sender guidelines:
  https://support.google.com/mail/answer/81126
- Gmail sender guidelines FAQ:
  https://support.google.com/a/answer/14229414
- Google Workspace Gmail sending limits:
  https://support.google.com/a/answer/166852

---

## Document history

- **2026-05-30** — Initial SOP. Added policy, daily-limit framing, pacing
  recommendations, AI content guidance, and BAAM guardrails for Gmail-assisted
  sends.
