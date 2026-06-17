import "server-only";
import { asRecord, str, type MappedContact, type ProviderAdapter } from "./index";

/**
 * Typeform form-response webhooks (Connect → Webhooks).
 *   POST /api/integrations/typeform?key=<location key>
 * We read the email/phone answers by their answer TYPE, and a name from a text
 * answer whose field title contains "name".
 */
export const typeformAdapter: ProviderAdapter = {
  id: "typeform",
  label: "Typeform",
  map(body): MappedContact | null {
    const ev = asRecord(body);
    const fr = asRecord(ev.form_response);
    const answers = Array.isArray(fr.answers) ? fr.answers : [];

    // field ref → title (to spot a "name" question)
    const fields = Array.isArray(asRecord(fr.definition).fields)
      ? (asRecord(fr.definition).fields as unknown[])
      : [];
    const titleByRef = new Map<string, string>();
    for (const f of fields) {
      const fr2 = asRecord(f);
      const ref = str(fr2.ref);
      if (ref) titleByRef.set(ref, (str(fr2.title) ?? "").toLowerCase());
    }

    let email: string | null = null;
    let phone: string | null = null;
    let name: string | null = null;
    for (const ans of answers) {
      const a = asRecord(ans);
      const type = str(a.type);
      if (type === "email" && !email) email = str(a.email);
      else if (type === "phone_number" && !phone) phone = str(a.phone_number);
      else if (type === "text" && !name) {
        const ref = str(asRecord(a.field).ref);
        const title = ref ? titleByRef.get(ref) ?? "" : "";
        if (title.includes("name")) name = str(a.text);
      }
    }
    if (!email && !phone) return null;

    return {
      name,
      email,
      phone,
      service: str(asRecord(fr.definition).title),
      externalId: str(fr.token),
      transactedAt: str(fr.submitted_at),
    };
  },
};
