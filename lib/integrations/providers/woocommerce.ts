import "server-only";
import { asRecord, str, type MappedContact, type ProviderAdapter } from "./index";

/**
 * WooCommerce order webhooks (WooCommerce → Settings → Advanced → Webhooks).
 *   POST /api/integrations/woocommerce?key=<location key>
 * Topic "Order created/updated". The order payload carries billing contact.
 */
export const woocommerceAdapter: ProviderAdapter = {
  id: "woocommerce",
  label: "WooCommerce",
  map(body, headers): MappedContact | null {
    // Woo sends a topic header; if present, only handle order.* events.
    const topic = headers.get("x-wc-webhook-topic");
    if (topic && !topic.startsWith("order")) return null;

    const o = asRecord(body);
    const b = asRecord(o.billing);
    const email = str(b.email);
    const phone = str(b.phone);
    const name =
      [str(b.first_name), str(b.last_name)].filter(Boolean).join(" ") || null;
    if (!email && !phone) return null; // ping/non-order payloads ignored

    const items = Array.isArray(o.line_items) ? o.line_items : [];
    const service = items.length ? str(asRecord(items[0]).name) : null;
    const id = o.id != null ? String(o.id) : null;
    return {
      name,
      email,
      phone,
      service,
      externalId: id ? `woo-${id}` : null,
      transactedAt:
        str(o.date_paid_gmt) ?? str(o.date_created_gmt) ?? str(o.date_created),
    };
  },
};
