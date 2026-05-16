# SOP — Lists & Email Operations

**Scope:** operating the managed-service Lists feature (batch review-request
sending) safely: velocity limits, concurrency at scale, and email
deliverability.
**Audience:** whoever runs the managed service (currently John).
**Owner:** John Tang · **Last reviewed:** 2026-05-15
**Status:** living document — update Section 7 when a rule changes.

> This SOP reflects the code as built through Session 14 Phase Gate 1. File
> paths and constants are cited so it stays verifiable. If code and SOP
> disagree, the code is truth — fix the SOP.

---

## 1. Velocity caps

**Where:** [`lib/messaging/velocity.ts`](../../lib/messaging/velocity.ts) —
enforced **per location**, inside the v1 `sendReviewRequest` action that the
batch `sendList` reuses.

| Tier | Hourly | Daily | Effect |
|------|--------|-------|--------|
| Soft | 20 | 100 | Request is **flagged for review** but **still sends** |
| Hard | 60 | 300 | Send is **blocked** entirely |

Counts are over `review_requests.created_at` for the location, rolling 1h/24h.

### Rules

1. **A normal weekly managed list (≤50 patients) sends fine.** It exceeds the
   soft hourly (20) so requests past #20 are flagged, but stays under the hard
   hourly (60) so nothing is blocked. The flag is a "confirm this volume is
   legitimate" signal, not an error.
2. **Do not send >60 to one location within an hour**, or >300 within a day —
   sends past the threshold are blocked and reported in the batch failure
   count. Split large lists across hours/days, or raise the cap (below).
3. **The caps are adjustable** — four constants at the top of `velocity.ts`
   (`SOFT_HOURLY`, `SOFT_DAILY`, `HARD_HOURLY`, `HARD_DAILY`). Changing them is
   a one-line edit + deploy.
4. **Preferred future change:** make the hard caps **per-location**
   (`locations.velocity_*_limit` columns) so a trusted managed client can run
   large batches while new self-serve accounts stay capped. Do this instead of
   a global bump the first time a managed list legitimately needs >60/hr.

### Decision: when to raise vs. split

- One-off larger list → **split** across the day. No code change.
- A managed client is permanently >60/hr/week → add the per-location override
  column (small migration) and set their limit. Don't globally raise.

---

## 2. Concurrency at scale

**Current behaviour:** `sendList` sends **synchronously and sequentially** —
one `sendReviewRequest` await per customer, inside one request. There is **no
background queue** (Session 14 §5 assumed Supabase Edge Functions for this;
none exist in v1 — reconciled).

### Constraints

- **Resend account rate limit** — ~2 req/sec default per Resend account
  (raisable by request to Resend). Multiple users sending large lists at the
  same second can exceed this → individual sends error (counted as failures,
  not silent).
- **Serverless timeout** — a 100-customer list ≈ 100 sequential sends; very
  large lists or many concurrent senders risk the function timing out
  mid-batch. Customers already sent stay `sent`; the rest stay `pending`
  (safe, resumable — re-send is idempotent per customer because status moves
  off `pending`).
- Velocity is per-location, so different accounts never block each other.

### Rules

1. **Founding scale (≤ a few managed clients):** current sequential model is
   fine. No action.
2. **Before ~10 managed clients all sending weekly:** introduce a real send
   queue (background worker draining at a controlled rate). This is the
   scaling prerequisite — track it as a Session 14 PG8 / Session 15 item.
3. **Never** point `sendList` at a 200+ customer list on the current
   architecture — split it, or wait for the queue.

---

## 3. Email deliverability — avoiding Spam / Promotions

### What the code already does right (do not regress)

- **One recipient per send** (not bulk BCC) — reads as transactional, not
  blast.
- **Per-location verified sender** when configured (`locations.sender_email`
  + `sender_verified_at`); otherwise shared default with the location's
  display name.
- **`Reply-To` = a real human** (the sending user's address) — strong
  "personal mail" signal to Gmail.
- **Plain-text-dominant, minimal personal HTML**, conversational templates —
  not marketing markup.

### Rules

1. **Authenticate every sending domain: SPF + DKIM + DMARC.** Resend
   auto-handles SPF/DKIM on a verified domain; the **DMARC record is added
   manually** in DNS. Unauthenticated domain → Promotions/Spam is near-certain.
   No managed client goes live until their domain is verified in Resend.
2. **Use a dedicated subdomain** for review mail (e.g.
   `reviews.clientdomain.com`) so review-send reputation is isolated from the
   client's primary mail.
3. **Keep mail personal, never promotional.** Single CTA, no image headers,
   no marketing language ("🎉 SPECIAL OFFER"), human-sounding subject. Gmail's
   Promotions classifier keys on bulk/marketing patterns — the current
   personal template is correct; **do not add marketing chrome to it.**
4. **List hygiene is mandatory.** Never send to a previously bounced or
   complained address. The import flow already filters against `opt_outs`;
   the gap is wiring bounce/complaint webhooks *into* `opt_outs` (Section 4).
5. **Warm up new domains.** Ramp volume gradually; a cold domain suddenly
   sending hundreds/day tanks reputation. New managed client week 1 = small
   test batch, then scale.

### Pre-send checklist (run before every managed-client first send)

- [ ] Client's sending domain verified in Resend (SPF/DKIM green)
- [ ] DMARC record present in client DNS
- [ ] `locations.sender_email` set and `sender_verified_at` populated
- [ ] Test send to an internal inbox lands in **Primary**, not Promotions
- [ ] List run through import validation (no bounced/opted-out contacts)
- [ ] Batch size within velocity policy (Section 1)

---

## 4. Resend quality improvements

Priority order:

1. **Verify a custom domain per client in Resend** — single biggest
   deliverability win. Code supports per-location verified senders; the work
   is operational (domains actually verified before go-live).
2. **Bounce/complaint → `opt_outs` suppression.** Extend
   [`app/api/webhooks/resend/route.ts`](../../app/api/webhooks/resend/route.ts)
   so `bounced`/`complained` events insert into `opt_outs`. The S13 import
   already excludes anything in `opt_outs`, so this closes the loop and
   protects domain reputation automatically. **Highest-value Session 14
   deliverability task** — folds into PG2.
3. **Pass Resend `tags`.** `sendEmailViaResend` already accepts a `tags`
   param; `sendReviewRequest` passes none. Tag sends with `list_id` /
   `location_id` for per-list deliverability analytics in the Resend
   dashboard. ~3-line change.
4. **Dedicated IP** (Resend paid) — only once steady volume > a few
   thousand/month per domain.
5. **Monitoring** — watch Resend deliverability insights; set up a DMARC
   aggregate-report inbox per client domain.

---

## 5. Incident runbook

| Symptom | First check | Action |
|---|---|---|
| Batch reports many failures | Failure list in the send result | If "velocity:hourly/daily" → split/retry later (Section 1). If Resend errors → check Resend status + rate limit. |
| Emails landing in Promotions/Spam | Domain auth in Resend; test-send placement | Verify SPF/DKIM/DMARC (Section 3 rule 1); confirm personal template not modified. |
| Customer says "stop emailing me" | Is contact in `opt_outs`? | Add to `opt_outs` immediately; confirm future imports exclude them. |
| List stuck `sending` | `lists.status` in DB | A timed-out batch leaves it `sending`. Inspect which customers are `sent`; resume is safe (only `pending`/non-excluded get sent). Manually set `draft` to fully retry, or `active` if most went out. |
| Bounces climbing on a domain | Resend dashboard bounce rate | Pause sends from that domain; clean the list; investigate source of bad addresses. |

---

## 6. Hard rules (never violate)

1. No incentivized/paid reviews — Google policy + FTC 2024 rule. The product
   asks; it never bribes.
2. Never send to a bounced or opted-out contact.
3. Never go live for a managed client without a verified, authenticated
   sending domain.
4. Never globally raise velocity caps to serve one client — use a
   per-location override.
5. Never point the current (queue-less) `sendList` at a 200+ customer list.

---

## 7. Change log

| Date | Change | By |
|---|---|---|
| 2026-05-15 | Initial SOP — extracted from Session 14 PG1 review (velocity, concurrency, deliverability, Resend). | Claude Code |
