export const SMS_CONSENT_FORM_VERSION = "sms-consent-v1";
export const SMS_CONSENT_SOURCE_PATH = "/sms-consent";

export const SMS_CONSENT_DISCLOSURE_TEXT =
  "Optional SMS Consent: By checking this optional box, you agree to receive SMS messages from BAAM Review on behalf of the business name entered above for post-visit review requests and related follow-ups. Message frequency varies (typically 1-2 messages per visit). Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not required to use services, submit this form, make a purchase, or complete any transaction. Terms: https://baamreview.com/legal/terms Privacy: https://baamreview.com/legal/privacy.";

/**
 * Normalizes user-entered phone numbers to a best-effort E.164 value.
 * - Keeps +country code when provided.
 * - Assumes +1 for 10-digit NANP numbers.
 */
export function normalizePhoneToE164(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return null;
    if (digits.startsWith("0")) return null;
    return `+${digits}`;
  }

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;

  return null;
}
