import "server-only";
import { asRecord, str, type MappedContact, type ProviderAdapter } from "./index";

/**
 * Cal.com booking webhooks (Settings → Developer → Webhooks).
 *   POST /api/integrations/calcom?key=<location key>
 * Subscribe BOOKING_CREATED (and/or BOOKING_RESCHEDULED). The attendee's
 * email/name are in the payload.
 */
const RELEVANT = new Set(["BOOKING_CREATED", "BOOKING_RESCHEDULED"]);

export const calcomAdapter: ProviderAdapter = {
  id: "calcom",
  label: "Cal.com",
  map(body): MappedContact | null {
    const ev = asRecord(body);
    const trigger = str(ev.triggerEvent);
    if (trigger && !RELEVANT.has(trigger)) return null;

    const p = asRecord(ev.payload);
    const attendees = Array.isArray(p.attendees) ? p.attendees : [];
    const a = asRecord(attendees[0]);
    const email = str(a.email);
    const phone = str(a.phoneNumber) ?? str(a.phone);
    const name = str(a.name);
    if (!email && !phone) return null;

    return {
      name,
      email,
      phone,
      service: str(p.title) ?? str(p.type),
      externalId: str(p.uid) ?? str(p.bookingId),
      transactedAt: str(p.startTime),
    };
  },
};
