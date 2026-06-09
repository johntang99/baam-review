// Audit identifier helpers.
//
// Audits are keyed by a UUID, but the public-facing URL uses the short code
// shown in the dashboard, e.g. "BR-2504-B903" (the UUID's first 8 hex chars).
// `auditIdFilter` resolves either form back to a database lookup: an exact
// match for a full UUID, or a UUID range covering the hex prefix for a short
// code. (Postgres `uuid` columns don't support LIKE, but they do support
// range comparison, which matches a prefix cleanly.)

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The short, human-facing code for an audit, e.g. "BR-2504-B903". */
export function shortAuditId(id: string): string {
  return `BR-${id.slice(0, 4)}-${id.slice(4, 8)}`.toUpperCase();
}

export type AuditIdFilter = { exact: string } | { lo: string; hi: string };

/**
 * Resolve a route param (full UUID or short code like "BR-2504-B903" /
 * "2504b903") to a Supabase filter. Returns null if the param can't be
 * interpreted as an audit id.
 */
export function auditIdFilter(param: string): AuditIdFilter | null {
  const p = param.trim();
  if (UUID_RE.test(p)) return { exact: p.toLowerCase() };

  const hex = p.replace(/^br-/i, "").replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{1,32}$/.test(hex)) return null;

  // Cover every UUID that starts with this hex prefix.
  const lo = toUuid((hex + "0".repeat(32)).slice(0, 32));
  const hi = toUuid((hex + "f".repeat(32)).slice(0, 32));
  return { lo, hi };
}

function toUuid(hex32: string): string {
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20, 32)}`;
}
