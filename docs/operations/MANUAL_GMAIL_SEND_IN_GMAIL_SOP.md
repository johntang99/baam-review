# MANUAL GMAIL SEND IN GMAIL SOP

How to safely send review-request emails via BAAM's manual `Send in Gmail` flow.

## Purpose

- Keep inbox placement as close to Primary as possible.
- Protect sender reputation and avoid Gmail anti-abuse limits.
- Give staff a repeatable daily workflow.

## Scope

- Applies to `Request a Review` -> `Send in Gmail` in BAAM.
- Applies to one-to-one review requests only.
- Does not apply to ESP campaign sends or Gmail API automation.

## Daily Pre-send Checklist

- Use the correct location in the left sidebar switcher.
- Confirm `Location Setup -> Email Sender -> Gmail sender preset (Preview flow)` is set correctly.
- Confirm recipient is a real recent customer and has not opted out.
- Confirm message is short, personal, and contains one main review link.

## Allowed Recipient Policy

- Send only to real customers who visited recently (recommended: last 30-60 days).
- No purchased/scraped lists, no cold outreach, no batch BCC sends.
- One recipient per email.

## Safe Volume and Cadence

- Day 1-3: up to 10 sends/day per mailbox.
- Day 4-7: up to 20 sends/day per mailbox.
- Week 2: up to 30 sends/day.
- Week 3+: 40-60/day only if health signals stay stable.
- Keep 120-180 seconds between sends.
- Keep 6-8 sends per hour max per mailbox.
- Pause 20-30 minutes after each 15-20 sends.

## Message Content Rules

- Keep to 60-120 words when possible.
- Use plain conversational language (not marketing copy).
- Personalize at least one element (name, visit context, or service mention).
- Use one clear review link only.
- Avoid all-caps, heavy punctuation, multiple links, and attachments.

## Operational Workflow (Per Send)

1. Open `Request a Review`.
2. Fill customer name and email.
3. Review subject/body and confirm personalization.
4. Click `Send in Gmail`.
5. In Gmail compose, re-check recipient and link, then send.
6. Wait before the next send according to cadence rules.

## Health Monitoring

Check at least once per day:

- Gmail Sent folder reflects expected sends.
- Test inboxes across Gmail/Outlook/Yahoo still receive.
- Spam/Promotions placement trend is stable.
- BAAM click/review conversion does not suddenly drop.

## Hard Stop Conditions

Pause sending from that mailbox for 24-72 hours if any occur:

- Gmail warning (rate/abuse warning or temporary block).
- Bounce rate exceeds 5%.
- Spam complaint rate exceeds 1%.
- Sudden inbox collapse (test emails mostly land in Spam).

## Recovery Playbook

- Reduce volume by 50% for 7 days.
- Send only to warmest recent customers.
- Increase personalization and simplify content.
- Resume gradual ramp only after stable delivery and engagement.

## Security and Ownership

- Use one dedicated mailbox per location whenever possible.
- Enable 2FA.
- Avoid broad password sharing; use controlled handoff procedures.

## Related Guides

- `GMAIL_SENDING_SAFETY_SOP.md`
- `SINGLE_REVIEW_REQUEST_SOP.md`
- `BULK_REVIEW_REQUEST_SOP.md`
