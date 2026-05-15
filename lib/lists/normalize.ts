// Email / phone / language normalization + per-row validation.
// Plan (§2.2) specifies libphonenumber-js; v1 has no such dep and the
// managed-service footprint is US (§2.2 "sufficient for US"). Reconciled to
// an in-house US-centric normalizer. Swap in libphonenumber-js later if
// international support is needed.

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = raw.trim().toLowerCase();
  if (!e) return null;
  // Boundary validation only — list senders paste real addresses.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/**
 * US phone → E.164 (+1XXXXXXXXXX). Returns null if it can't be coerced to a
 * 10-digit US number (optionally with a leading country code 1).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Display E.164 US number as (XXX) XXX-XXXX; pass through anything else. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export type Lang = "en" | "zh" | "es";

export function normalizeLanguage(
  raw: string | null | undefined,
): Lang | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (["en", "english", "eng"].includes(s)) return "en";
  if (["zh", "中文", "chinese", "mandarin", "zh-cn", "zh-tw", "cn"].includes(s))
    return "zh";
  if (["es", "español", "espanol", "spanish", "spa"].includes(s)) return "es";
  return null;
}

export type ExcludedReason =
  | "duplicate_60d"
  | "opted_out"
  | "no_contact"
  | "manual";

export interface ValidatedRow {
  name: string;
  email: string | null;
  phone: string | null;
  language: Lang;
  languageWasUnknown: boolean;
  notes: string;
  visitDate: string | null;
  channel: "email" | "sms";
  // null = ready (or warning-only). non-null = auto-excluded.
  excludedReason: ExcludedReason | null;
  warnings: string[]; // e.g. ["No phone"], ["Unknown language"]
}

// §5 + §3.6: hardcode Mei Hong as a known 60-day duplicate for the Session 13
// demo. Replaced by the real 60-day query in Session 14 Phase Gate 1.
const SESSION13_KNOWN_DUPLICATES = new Set(["meihong88@163.com"]);

export interface RawRow {
  name: string;
  email: string;
  phone: string;
  language: string;
  notes: string;
  visitDate?: string;
}

export function validateRow(
  raw: RawRow,
  defaultLanguage: Lang,
  optedOut: Set<string>,
): ValidatedRow {
  const email = normalizeEmail(raw.email);
  const phone = normalizePhone(raw.phone);
  const langNorm = normalizeLanguage(raw.language);
  const language = langNorm ?? defaultLanguage;
  const languageWasUnknown = !!raw.language && langNorm === null;

  const warnings: string[] = [];
  let excludedReason: ExcludedReason | null = null;

  if (!email && !phone) {
    excludedReason = "no_contact";
  } else if (email && SESSION13_KNOWN_DUPLICATES.has(email)) {
    excludedReason = "duplicate_60d";
  } else if (
    (email && optedOut.has(email)) ||
    (phone && optedOut.has(phone))
  ) {
    excludedReason = "opted_out";
  }

  if (!excludedReason) {
    if (!phone) warnings.push("No phone");
    if (languageWasUnknown) warnings.push("Unknown language");
  }

  // Default channel: email if we have one, else SMS.
  const channel: "email" | "sms" = email ? "email" : "sms";

  return {
    name: raw.name.trim() || "(no name)",
    email,
    phone,
    language,
    languageWasUnknown,
    notes: raw.notes.trim(),
    visitDate: raw.visitDate?.trim() || null,
    channel,
    excludedReason,
    warnings,
  };
}
