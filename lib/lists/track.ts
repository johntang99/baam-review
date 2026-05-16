import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Lifecycle propagation for the Lists feature (Session 14 §4.2).
 *
 * A list_customer is linked to its review_requests row via
 * list_customers.send_request_id (a real FK — more precise than the plan's
 * "email lookup within 30 days", which we deliberately don't use). When a
 * webhook event or a review completion lands on a review_request, we mirror
 * it onto the linked list_customer's status (single source of truth) and
 * append an immutable list_events row (history).
 *
 * Status is monotonic: it only advances. A late 'delivered' webhook can't
 * pull an 'opened' customer backwards, and terminal states
 * (reviewed/bounced/optout/excluded) are never overwritten.
 */
export type LifecycleEvent =
  | "delivered"
  | "opened"
  | "clicked"
  | "reviewed"
  | "bounced"
  | "optout";

const RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  reviewed: 5,
};
const TERMINAL = new Set(["reviewed", "bounced", "optout", "excluded"]);

type Service = SupabaseClient<Database>;

/**
 * Apply a lifecycle event to the list_customer linked to `reviewRequestId`.
 * No-op (returns false) when the request isn't part of a list. Safe to call
 * unconditionally from webhook / completion handlers.
 */
export async function recordListLifecycle(
  service: Service,
  reviewRequestId: string,
  event: LifecycleEvent,
  meta: { channel?: "email" | "sms" } = {},
): Promise<boolean> {
  const { data: lc } = await service
    .from("list_customers")
    .select("id, list_id, location_id, status, email, phone, channel")
    .eq("send_request_id", reviewRequestId)
    .maybeSingle();
  if (!lc) return false;

  // Never move out of a terminal state.
  if (TERMINAL.has(lc.status)) return false;

  const channel = (meta.channel ?? lc.channel) as "email" | "sms";

  if (event === "bounced" || event === "optout") {
    const excludedReason = event === "bounced" ? "bounced" : "opted_out";
    await service
      .from("list_customers")
      .update({
        status: event === "bounced" ? "bounced" : "optout",
        excluded_reason: excludedReason,
        selected: false,
      })
      .eq("id", lc.id);

    // Deliverability hygiene (SOP §4.2): suppress the contact so future
    // imports auto-exclude it. Upsert-style: ignore if already present.
    const contact =
      channel === "sms" ? lc.phone : (lc.email ?? lc.phone);
    if (contact) {
      await service
        .from("opt_outs")
        .upsert(
          {
            location_id: lc.location_id,
            contact,
            channel,
          },
          { onConflict: "location_id,contact", ignoreDuplicates: true },
        );
    }
  } else {
    // Forward-only status advance.
    const next = RANK[event];
    const cur = RANK[lc.status] ?? 0;
    if (next > cur) {
      await service
        .from("list_customers")
        .update({ status: event })
        .eq("id", lc.id);
    }
  }

  await service.from("list_events").insert({
    list_customer_id: lc.id,
    list_id: lc.list_id,
    location_id: lc.location_id,
    event_type: event,
    metadata: { channel },
  });

  return true;
}
