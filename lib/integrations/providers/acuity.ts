import "server-only";
import { asRecord, str, type MappedContact, type ProviderAdapter } from "./index";

/**
 * Acuity Scheduling. Its webhook is form-encoded and carries only an
 * appointment id (no contact), so we fetch the appointment via Acuity's API
 * using the location's stored Basic-auth credentials (User ID + API Key).
 *
 * Setup per client: connect Acuity in Location Setup (their User ID + API Key
 * from Acuity → Account → Integrations → API), then add the webhook URL
 *   POST https://baamreview.com/api/integrations/acuity?key=<location key>
 * in Acuity → Integrations → Webhooks for the "Order/Appointment Scheduled"
 * event.
 */

const ACUITY_API = "https://acuityscheduling.com/api/v1";

/** Map a fetched Acuity appointment object → contact. Pure (unit-testable). */
export function mapAcuityAppointment(appt: unknown): MappedContact | null {
  const a = asRecord(appt);
  const email = str(a.email);
  const phone = str(a.phone);
  if (!email && !phone) return null;
  const name =
    [str(a.firstName), str(a.lastName)].filter(Boolean).join(" ") || null;
  const id = a.id != null ? String(a.id) : null;
  return {
    name,
    email,
    phone,
    service: str(a.type), // appointment type, e.g. "Acupuncture"
    externalId: id ? `acuity-${id}` : null,
    transactedAt: str(a.datetime),
  };
}

export const acuityAdapter: ProviderAdapter = {
  id: "acuity",
  label: "Acuity Scheduling",
  parse: "form",
  needsConnection: true,
  async resolve(body, _headers, credentials) {
    const b = asRecord(body);
    const action = str(b.action);
    // Acuity actions: appointment.scheduled / .rescheduled / .canceled /
    // .changed. Only act on new/rescheduled bookings.
    if (action && !/scheduled|rescheduled/i.test(action)) return null;

    const id = b.id != null ? String(b.id) : null;
    if (!id) return null;

    const userId = str(credentials.userId);
    const apiKey = str(credentials.apiKey);
    if (!userId || !apiKey) return null;

    const basic = Buffer.from(`${userId}:${apiKey}`).toString("base64");
    let appt: unknown;
    try {
      const res = await fetch(`${ACUITY_API}/appointments/${id}`, {
        headers: { Authorization: `Basic ${basic}` },
      });
      if (!res.ok) return null;
      appt = await res.json();
    } catch {
      return null;
    }
    return mapAcuityAppointment(appt);
  },
};
