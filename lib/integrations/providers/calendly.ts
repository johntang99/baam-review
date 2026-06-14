import "server-only";
import { asRecord, str, type MappedContact, type ProviderAdapter } from "./index";

/**
 * Calendly v2 webhooks. Subscribe to `invitee.created` and point it at
 *   POST /api/integrations/calendly?key=<location key>
 * The payload carries the invitee's email + name directly.
 *
 * Note on timing: Calendly fires on BOOKING, not after the appointment. That's
 * fine here — the contact joins the review queue, and staff send the email
 * one-by-one *after* the visit anyway. (No "appointment completed" webhook
 * exists in Calendly.)
 */
export const calendlyAdapter: ProviderAdapter = {
  id: "calendly",
  label: "Calendly",
  map(body) {
    const root = asRecord(body);
    if (str(root.event) !== "invitee.created") return null; // ignore cancels/reschedules

    const p = asRecord(root.payload);
    const email = str(p.email);
    const phone = str(p.text_reminder_number);
    if (!email && !phone) return null;

    const name =
      str(p.name) ||
      [str(p.first_name), str(p.last_name)].filter(Boolean).join(" ") ||
      null;

    const ev = asRecord(p.scheduled_event);

    return {
      name,
      email,
      phone,
      service: str(ev.name), // event type, e.g. "Acupuncture — 60 min"
      externalId: str(p.uri), // unique invitee URI
      transactedAt: str(ev.start_time),
    } satisfies MappedContact;
  },
};
