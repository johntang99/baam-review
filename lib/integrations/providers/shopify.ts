import "server-only";
import { asRecord, str, type MappedContact, type ProviderAdapter } from "./index";

/**
 * Shopify order webhooks. Point a `orders/fulfilled` (recommended — after the
 * purchase) or `orders/paid` / `orders/create` webhook at
 *   POST /api/integrations/shopify?key=<location key>
 * Shopify includes the customer's email/phone directly in the order payload,
 * so no OAuth/API callback is needed.
 */

const RELEVANT_TOPICS = new Set([
  "orders/fulfilled",
  "orders/paid",
  "orders/create",
]);

export const shopifyAdapter: ProviderAdapter = {
  id: "shopify",
  label: "Shopify",
  map(body, headers) {
    // Ignore irrelevant topics (cancellations, refunds, etc.). If the header
    // is absent (manual test), fall through and map by content.
    const topic = headers.get("x-shopify-topic");
    if (topic && !RELEVANT_TOPICS.has(topic)) return null;

    const order = asRecord(body);
    const customer = asRecord(order.customer);

    const email = str(order.email) ?? str(customer.email);
    const phone =
      str(customer.phone) ?? str(order.phone) ?? str(order.contact_email);
    if (!email && !phone) return null;

    const name =
      [str(customer.first_name), str(customer.last_name)]
        .filter(Boolean)
        .join(" ") || null;

    // First line item's title as light "service" context, if present.
    const items = Array.isArray(order.line_items) ? order.line_items : [];
    const service = items.length > 0 ? str(asRecord(items[0]).title) : null;

    const id = order.id != null ? String(order.id) : null;

    return {
      name,
      email,
      phone,
      service,
      externalId: id ? `shopify-${id}` : null,
      transactedAt: str(order.created_at),
    } satisfies MappedContact;
  },
};
