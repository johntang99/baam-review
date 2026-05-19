# SMS / Twilio A2P 10DLC Registration — Reference Pack

Copy-paste reference for registering BAAM Review's SMS sending with Twilio +
The Campaign Registry (TCR). Everything below is derived from the actual
code so the registered campaign matches real traffic — **carriers reject
campaigns whose sample messages don't match what is actually sent.**

Source of truth in code:
- SMS bodies: `lib/messaging/templates.ts` → `buildSmsBody()`
- Send path: `app/app/send/actions.ts` (channel === "sms")
- Opt-out suppression: `opt_outs` table + pre-send check in `app/app/send/actions.ts`
- Auth: `lib/messaging/twilio.ts` (API key preferred, Auth Token fallback)

---

## 0. Account model

- **Identity type:** Business use · **ISV / Reseller / Partner**
  (BAAM sends on behalf of *client businesses*, messages branded as the
  client — that is an ISV by Twilio's definition, not a Direct customer.)
- **Industry (the registering entity = BAAM itself):** Technology
- **Auth:** scoped API Key (`TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET`);
  Account SID still used for the REST URL path. Auth Token kept only as a
  fallback until the key is verified in production, then revoke it.

---

## 1. Business Profile (TrustHub) — [YOU PROVIDE]

Must match IRS EIN letter (CP575) / Secretary of State **exactly**:

| Field | Value |
|---|---|
| Legal business name | _[exact registered entity name]_ |
| EIN / Tax ID | _[XX-XXXXXXX]_ |
| Entity type | _[LLC / Corp / Sole Proprietor]_ |
| Registered address | _[exact address on official filings]_ |
| Website | https://www.baamreview.com |
| Authorized rep | _[name, title, email, phone]_ |

> Status note: identity verification was appealed (manual ops review).
> If BAAM is **not** an incorporated entity with an EIN, use Twilio's
> **Sole Proprietor A2P** path instead (no EIN; limited to ~1 number and
> low daily volume) until incorporation.

---

## 2. A2P Brand

Registered under the Business Profile above (BAAM as the ISV brand).
Standard registration; move to per-client secondary brands later only if
volume / carrier requirements demand it.

---

## 3. A2P Campaign — [READY TO PASTE]

**Use case:** Customer Care (transactional follow-up; one message per
customer visit — *not* recurring marketing)

**Campaign description:**
> BAAM Review is a software platform that lets local service businesses
> (clinics, salons, law offices, auto, hospitality, etc.) send a single
> follow-up text to a customer after their visit, asking them to share
> feedback / leave a review. Messages are branded as the individual
> business. One message per customer visit; not recurring or promotional.

**Sample messages** (exact templates from `buildSmsBody()`, realistic fills
— EN / 中文 / ES):

```
Hi Sarah, thanks for visiting Dr. Huang Clinic. Mind sharing your
experience? It only takes a minute:
https://review.baamplatform.com/r/dr-huang-clinic?t=ab12cd
Reply STOP to opt out.
```
```
您好 美玲，感谢您光临黄医生针灸中医诊所。能否花一分钟分享您的体验？
https://review.baamplatform.com/r/dr-huang-clinic?t=ab12cd
回复 STOP 取消订阅。
```
```
Hola Carlos, gracias por visitar Bella Salon. ¿Podría compartir su
experiencia en un minuto?
https://review.baamplatform.com/r/bella-salon?t=ab12cd
Responda STOP para cancelar.
```

**Opt-in / consent description** (truthful to how the app works — carriers
reject vague answers):
> End customers provide their mobile number directly to the local business
> at the point of service (in person, on an intake form, or at checkout)
> and agree to a one-time follow-up about their visit. The business enters
> only these consented contacts into BAAM Review, which sends a single
> review-request SMS. No purchased, rented, or scraped lists. Opt-outs and
> bounces are automatically suppressed (opt_outs table) and never
> re-contacted.

**Opt-out:** "Reply STOP to opt out" / "回复 STOP 取消订阅" / "Responda STOP
para cancelar" is in **every** message. STOP-handled contacts are
suppressed in the app's `opt_outs` table. Enable the Messaging Service's
**Advanced Opt-Out** (default STOP/HELP).

**HELP reply:**
> BAAM Review: review-request texts. Reply STOP to unsubscribe. Help:
> support@baamplatform.com

| Field | Answer |
|---|---|
| Embedded link | Yes — dedicated domain `review.baamplatform.com/r/…` (not a shared shortener) |
| Embedded phone number | No |
| Age-gated content | No |
| Message frequency | One-time per customer visit |
| Estimated volume | Start low (≤1,000/day); raise later |

---

## 4. Phone number + Messaging Service

1. Buy an SMS-capable US number (Local, area code 845 preferred for the
   Hudson Valley market; Toll-Free as fallback).
2. Set `TWILIO_FROM_NUMBER` (E.164) in `.env.local` **and** Vercel.
3. Create a **Messaging Service**, attach the number, link the approved
   A2P campaign, enable Advanced Opt-Out.
4. Point the number's status callback at
   `https://review.baamplatform.com/api/webhooks/twilio` (delivery status;
   already handled in code — inbound *replies* are not yet handled, see
   backlog).

---

## 5. Go-live checklist

- [ ] Business Profile approved
- [ ] A2P Brand registered
- [ ] A2P Campaign approved
- [ ] SMS-capable number purchased + on a Messaging Service tied to the campaign
- [ ] `TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET` / `TWILIO_ACCOUNT_SID` /
      `TWILIO_FROM_NUMBER` set in **Vercel** (not just local)
- [ ] Auth Token rotated + `TWILIO_AUTH_TOKEN` removed (it was exposed in a
      screenshot during setup)
- [ ] Test send verified end-to-end (API key → Twilio → delivery webhook → STOP)

## Backlog (not blocking launch)

- Inbound reply handling: the Twilio webhook is **status-callback only**.
  Non-STOP customer replies are currently dropped. Minimum next step: an
  inbound auto-responder (TwiML) so replies aren't met with silence;
  better: forward replies to the business.
