# BAAM Review — Launch Checklist

**Version:** 1.0
**Owner:** John Chen
**Target launch:** End of Session 12 (~10–12 weeks from Session 1 start)
**Goal:** First 10 paying founding customers in week 1, first 50 within 8 weeks

---

## What this document is

This is the operational playbook for taking BAAM Review from "the code works" to "the code has revenue." It covers the founding-customer outreach plan, the week-1 metrics you actually watch, the retention pulse for paying customers, and the failure modes to look out for.

It assumes Sessions 1–12 are complete and `review.baamplatform.com` is in production with the v1 feature set (Collect + Publish + Display + post-review thank-you + share-card referrals + revenue attribution + Staff Mode).

It does **not** cover product marketing for the broader category push (Birdeye replacement positioning, paid acquisition, SEO content). That's a separate document and a later phase.

---

## The launch thesis

BAAM Review's first 50 customers determine whether the product survives. They aren't acquired through paid channels — they're acquired through:

1. **Existing BAAM Studio clients** who already trust you (warmest)
2. **Direct outreach to Chinese-speaking SMBs** in NY metro via WeChat, Xiaohongshu, in-person visits, and existing BAAM Studio client referrals (warm)
3. **Founding-customer FOMO** — the public landing page shows "23 spots left" and counts down as signups happen, creating mild scarcity without manipulation

Paid acquisition (Google Ads, Meta) is **deliberately deferred** until you have ten paying customers and can measure CAC against LTV from real data.

---

## Pre-launch — T-minus 2 weeks

### Build the warm list to 30

Open the `BAAM Review · Founding 50` Notion/Airtable list you started in `PRE_SESSION_1_SETUP.md` section 11.

Pre-populate with three tiers:

**Tier 1 — Warmest (existing BAAM Studio clients)**
- [ ] Dr. Huang Clinic — confirmed reference client throughout v2.0
- [ ] Acu-Flushing — in SEO build-out queue
- [ ] Acu-Shi — in SEO build-out queue
- [ ] Every other active BAAM Studio retainer client
- [ ] Pause: target 8–12 names in this tier

**Tier 2 — Warm (cold-but-validated)**
- [ ] Local TCM clinics in Flushing / Sunset Park / Manhattan Chinatown — pulled from Google Maps with `>= 4.5★` and `>= 30 reviews` (i.e. they already care about reviews)
- [ ] Local immigration law firms in Flushing / Sunset Park serving Chinese-speaking clients (search "Chinese immigration lawyer NYC")
- [ ] Restaurants you frequent that you have a personal relationship with
- [ ] Pause: target 15–20 names in this tier

**Tier 3 — Cold (broader category)**
- [ ] Any SMB in NY metro that's English/Chinese bilingual and would obviously benefit
- [ ] BAAM Studio client referrals — ask each Tier 1 client "do you know two other businesses who'd find this useful?"
- [ ] Target 8–12 names in this tier

**Total: 30 names minimum by T-1 week.**

### Pre-launch operational setup

- [ ] Stripe Live mode confirmed working with test transaction
- [ ] Founding-customer Stripe prices ($39 / $89 / $249) configured but NOT in the public checkout — only manually assignable via admin path
- [ ] First-line support: WeChat business account + email `review@baamplatform.com` both forwarding to your inbox + WeChat
- [ ] Onboarding video recorded (3–5 min) — walks through signup → location setup → first SMS send → seeing first review come in
- [ ] One-page PDF deck in EN + 中文 — "What is BAAM Review and why $89?" — to send via WeChat for cold outreach
- [ ] The 23-spots-left counter on the landing page wired to a real Supabase count of `accounts where founding_member = true` (Session 11 wires this)
- [ ] Test the full customer flow end-to-end on your own clinic-client account before any outreach: send yourself a review request, complete it, see it on the dashboard, take a screenshot of the dashboard with real numbers

---

## Launch week — day-by-day

### Day 0 (Sunday before launch Monday)

- [ ] Final smoke test on `review.baamplatform.com` — every page renders, every form submits, no console errors
- [ ] Refund test transaction in Stripe
- [ ] Set up a launch-day Slack/Telegram private channel with your inner circle (2-3 trusted people) for moral support and bug triage
- [ ] Take a deep breath. Tomorrow you'll be telling everyone what you've built.

### Day 1 (Monday) — Tier 1 outreach

This is the most important day. These are the people most likely to say yes within 24 hours.

- [ ] **Morning (9–11am):** Personal phone call or in-person visit to Dr. Huang Clinic. Walk them through the dashboard live. Sign them up on the spot at $89 founding price. Get their first review request sent before you leave.
- [ ] **Midday (11am–2pm):** Personal WeChat or call to each remaining BAAM Studio active retainer client. Same pitch:
  > "I built a tool that turns happy customers into Google reviews automatically. It costs $99/month normally but I'm offering it at $89 forever to the first 50 customers. Want to be one of them? I can set it up in 15 minutes — you don't have to do anything but show up to a screen-share."
- [ ] **Afternoon (2–6pm):** Onboard everyone who says yes. Do not batch this — 15 minutes of onboarding per customer is how the relationship is built.
- [ ] **Evening (6–9pm):** Write down what worked and what didn't in the pitch. Update the deck and the script if necessary.

**Day 1 target: 4–6 paying customers from Tier 1.**

### Day 2 (Tuesday) — Tier 1 cleanup + Tier 2 start

- [ ] Morning: follow up with any Tier 1 client who said "let me think about it" — usually they want a second touch
- [ ] Midday: send the EN + 中文 PDF deck to all 15–20 Tier 2 names via WeChat or email. Personal note for each one. No mass send.
- [ ] Afternoon: take the first calls/replies. Onboard anyone ready.
- [ ] **Day 2 target: 2–3 more paying customers (cumulative 6–9)**

### Day 3–5 (Wed–Fri)

- [ ] Continue Tier 2 outreach. By end of Friday you should have contacted every Tier 2 name at least once.
- [ ] Start Tier 3 outreach Friday afternoon if Tier 2 conversion is at or above 30%
- [ ] **Day 5 target: 10–12 paying customers cumulative**

### Day 6–7 (weekend)

- [ ] Saturday: write a launch announcement for your personal WeChat moments + LinkedIn + Xiaohongshu in EN + 中文. Soft-launch announcement, not a sales pitch — "After 12 weeks of building, BAAM Review is live. First 50 customers lock in founding pricing forever. If you run a local business and want to turn customer goodwill into Google reviews and referrals, reply to this post." Include a screen recording of the customer flow.
- [ ] Sunday: rest. Do nothing operational. The product runs itself for one day.

**Week 1 target: 10 paying customers.**

---

## Week 1 metrics — what you actually watch

Not vanity metrics. Three numbers that matter:

### Metric 1: Activation rate

**Definition:** % of accounts who completed setup AND sent their first review request within 7 days of signup.

**Target:** ≥ 80%.

**Why it matters:** Anyone who signs up but doesn't send a request inside a week is going to churn. Activation is the leading indicator of retention.

**Where to find it:** Build a simple admin query during Session 11:
```sql
select
  count(*) filter (where exists (
    select 1 from review_requests rr
    join locations l on l.id = rr.location_id
    where l.account_id = a.id
      and rr.created_at < a.created_at + interval '7 days'
  ))::float / count(*) as activation_rate_7d
from accounts a
where a.created_at >= now() - interval '7 days';
```

**Intervention if low:** Personal call to each non-activated account by day 5. "What's blocking you from sending the first one? Want me to walk you through it on a screen-share?"

### Metric 2: First-review completion rate

**Definition:** Of the review requests sent during week 1, what % resulted in a posted Google review?

**Target:** ≥ 25% (industry baseline is ~10%; BAAM's AI-assisted flow should significantly beat that)

**Why it matters:** This is the wedge feature's proof. If it's at category baseline (~10%), the product story falls apart. If it's at 38% (the prototypes' claim), the founding-customer message becomes "I told you so" with proof.

**Where to find it:**
```sql
select count(*) filter (where status = 'completed')::float / count(*)::float as completion_rate
from review_requests
where created_at >= now() - interval '7 days';
```

**Intervention if low:** Two possible causes — (1) the SMS message copy is wrong for the audience, fix it; or (2) the chip questions don't fit the vertical, audit which verticals are underperforming and tune the chip sets.

### Metric 3: Week-1 voluntary churn

**Definition:** Of accounts who signed up in week 1, how many canceled before week 2?

**Target:** 0

**Why it matters:** Founding customers who churn in week 1 didn't believe the product was worth $89. That's the single most painful signal you can get. Personal conversation required for every one.

**Where to find it:** Stripe dashboard → Subscriptions filtered to canceled status, created in the last 7 days.

**Intervention:** Call them. Don't email. Ask what didn't work. Two paths: either the product genuinely failed them (fix it, refund them, and don't take that money back even if they want to come back later — they're your beta witnesses now), or the timing was wrong and they'll come back in month 3 (note it, follow up in 60 days).

---

## Retention pulse — weeks 2–8

Founding customers won't churn in week 1 (you onboarded them personally, they're invested). The dangerous moment is **weeks 4–6** — the honeymoon ends, the first credit card charge hits, and they ask themselves whether $89/month is worth it.

The dashboard's revenue attribution number is your single most important retention weapon. Every paying customer should see "Estimated revenue impact: $X this month" front-and-center every time they open the app.

### Weekly retention rituals

Every Monday morning, run this script (build it as an admin page in Session 11):

```
For each paying account active >= 14 days:
  - Has the owner logged in during the past 7 days? (yes/no)
  - Have they sent >= 5 review requests this past week? (yes/no)
  - Has at least one new Google review been completed this week? (yes/no)
  - What's their estimated revenue impact for the trailing 30 days?

Output a sorted list, riskiest accounts first (no login + no requests + low revenue impact).
```

For the top 5 risk accounts: send a personal WeChat or email. Not a generic "check in" — a specific observation:
- "Hey, I noticed Wei Zhang's review came in last week via Sarah's referral. That's exactly the loop working. Are you seeing the revenue attribution show up on your dashboard? Want to talk about what's driving it?"
- "I see you haven't sent any requests since Monday. Anything I can help with? I can do another walkthrough or we can change the SMS message if it's not working for your customers."

This is unscalable. **Do it anyway** for the first 50 customers. The CAC of retaining a paying customer is always lower than acquiring a new one, and the data from these conversations becomes Session 13+ product priorities.

---

## Failure modes to watch for

### Failure mode 1: "I love it but I never have time to send the requests"

**Frequency:** Common, especially with restaurant owners and busy clinic operators.

**Fix:** Push them toward Staff Mode (`/app/staff`) and have them give the iPad to the front-desk person. Onboard the front-desk person directly if needed. The owner shouldn't be the sender.

**Product implication:** If 30%+ of accounts hit this, the priority for Session 13 becomes **automated triggers** (Square POS integration, calendar integration with Booksy/Mindbody, generic webhook). Manual sending should become an exception path, not the default.

### Failure mode 2: "The AI draft sounds robotic"

**Frequency:** Should be rare with the v2.0 prompt design, but if it shows up early, take it seriously.

**Fix immediately:** Two paths — (1) the template stub from Session 2 is still in production (didn't switch over to real Claude in Session 5), or (2) the Claude prompt needs vertical-specific tuning. Look at 20 generated drafts side-by-side and see what feels off.

**Product implication:** This is the wedge. If it breaks, BAAM Review is just another review tool. Treat any complaint here as a P0 priority.

### Failure mode 3: "My Google reviews aren't increasing even though customers complete the flow"

**Frequency:** Will happen. The customer copies the draft and clicks "Open Google Maps," but Google Maps doesn't pre-fill the review form on iOS / certain browsers / certain GBP profiles.

**Fix:** Audit the `gbp_review_link` URL format. There are several Google review link patterns (`g.page/review`, `search.google.com/local/writereview`, the maps deep link) and they behave differently across devices. Run a manual test on iOS Safari, iOS Chrome, Android Chrome, and the WeChat in-app browser. The "right" URL depends on the device.

**Product implication:** Session 13 builds a "verify your review link" tool during onboarding that opens the link in the user's actual browser to confirm it pre-fills. Until then, this is a one-by-one fix.

### Failure mode 4: "I signed up but never use it because the dashboard feels overwhelming"

**Frequency:** Less common in founding customers (you onboarded them personally), but increases as you move to cold acquisition in months 3+.

**Fix:** The dashboard's primary CTA is "Send request." If the user can't find that within 5 seconds, the IA is broken. Watch a real onboarding via screen-share. If they hesitate, fix it.

**Product implication:** May warrant a stripped-down "Today" view as the default landing instead of the full dashboard.

### Failure mode 5: SMS deliverability degrades suddenly

**Frequency:** Will happen. A2P 10DLC compliance is brittle.

**Fix:** Check the Twilio console for delivery errors. Common causes — (1) the customer-facing message is being flagged by carriers (rare but happens), (2) the campaign needs re-registration, (3) a specific carrier is blocking. Switch the message wording for affected sends, file a re-review with Twilio.

**Product implication:** Email fallback path needs to be more visible. If SMS deliverability dips below 95%, force a temporary default-to-email mode and notify all accounts.

---

## Founding customer commitments — write these down and honor them

The founding 50 are getting more than discounted pricing. They're getting a relationship. Make it explicit so they tell their network.

- **Founding price locked forever** as long as their subscription stays continuously active (one missed payment doesn't kill it, but a voluntary cancel + later resubscribe does — make this explicit in the FAQ)
- **30-minute personal onboarding** with you, by WeChat or screen-share — not a self-serve onboarding flow
- **Direct WeChat access** to you for any issue, anytime, until you have over 100 customers
- **Quarterly check-ins** for the first year — "what's working, what's not, what's missing"
- **Their logo on the launch page** (if they consent) under "Loved by 50 founding customers"
- **First access to every new feature** with a one-week early window before general release
- **Lifetime priority support** at no extra cost (vs. the standard Growth-tier support response time)

---

## Month 2 — what changes

By end of week 8 you should have:
- 25–35 paying founding customers
- A clear sense of which verticals convert best (likely TCM and immigration law lead; restaurants are second wave; real estate / insurance won't move until those verticals have specific feature support)
- 3-5 customer testimonials and 1-2 written case studies (with revenue numbers)
- Concrete data on activation rate, completion rate, and trailing-30-day revenue attribution per account

Use that data to drive month 2 outreach:
- Case study + testimonial-led WeChat / Xiaohongshu posts in the Chinese-speaking SMB community
- Outreach to BAAM Studio prospects (formerly excluded from BAAM Studio because they're too small for $5k+ websites) — they're a perfect fit for $89/month BAAM Review
- First paid experiment: $500 in Meta ads to a Mandarin-language audience in Flushing, see if cold CAC is sustainable
- Speaking opportunity in the local Chinese SMB community — Brooklyn Chinese American Association events, Flushing Chamber of Commerce, etc.

---

## When to stop calling it "founding launch"

When you hit 50 paying customers, the founding-customer program closes. The landing page banner changes from "23 spots left" to "Loved by 50 founding customers." Pricing reverts to the public $49 / $99 / $499.

That's the moment to consider hiring (a customer success person who speaks Mandarin natively) and to start the paid acquisition experiments in earnest.

But until then: every customer is onboarded by you, every Monday you run the retention script, every issue is handled in-person.

The first 50 are not customers. They're co-creators.

---

## A single page you'll re-read most weeks

1. **Daily, week 1:** target 1-2 new paying customers per day, all onboarded personally
2. **Weekly, weeks 2-8:** run retention script Monday morning, intervene on top 5 risk accounts that day
3. **Monthly:** review activation rate, completion rate, voluntary churn — if any metric is more than 20% below target, that's the focus of the next product session
4. **Always:** the dashboard's revenue attribution number is the most important number in the product. Anything that obscures it is a bug. Anything that makes it more credible is a feature.
5. **Always:** the founding 50 get first access, direct WeChat, locked pricing forever. Honor it. They'll tell everyone.

---

**This is the playbook. The hard part isn't the code — the code is done by week 12. The hard part is the next 8 weeks of relationships.**
