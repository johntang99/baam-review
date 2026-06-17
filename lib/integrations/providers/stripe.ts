import "server-only";
import { asRecord, str, type MappedContact, type ProviderAdapter } from "./index";

/**
 * Stripe payment webhooks. Point a webhook (Developers → Webhooks) at
 *   POST /api/integrations/stripe?key=<location key>
 * for `checkout.session.completed` (best — has customer_details) and/or
 * `charge.succeeded`. Stripe puts the buyer's email/name/phone right in the
 * event, so no API callback is needed. (We auth by ?key=, not Stripe's
 * signature.)
 */
const RELEVANT = new Set([
  "checkout.session.completed",
  "charge.succeeded",
  "payment_intent.succeeded",
]);

export const stripeAdapter: ProviderAdapter = {
  id: "stripe",
  label: "Stripe",
  map(body): MappedContact | null {
    const ev = asRecord(body);
    const type = str(ev.type);
    if (type && !RELEVANT.has(type)) return null;

    const obj = asRecord(asRecord(ev.data).object);
    // checkout.session → customer_details; charge → billing_details.
    const cd = asRecord(obj.customer_details);
    const bd = asRecord(obj.billing_details);
    const details = str(cd.email) ? cd : bd;

    const email =
      str(details.email) ?? str(obj.receipt_email) ?? str(obj.email);
    const phone = str(details.phone);
    const name = str(details.name);
    if (!email && !phone) return null;

    const created =
      typeof obj.created === "number"
        ? new Date(obj.created * 1000).toISOString()
        : null;
    const id = str(obj.id);
    return {
      name,
      email,
      phone,
      service: null,
      externalId: id ? `stripe-${id}` : null,
      transactedAt: created,
    };
  },
};
