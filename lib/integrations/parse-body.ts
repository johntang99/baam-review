import "server-only";
import type { NextRequest } from "next/server";

/**
 * Parse an inbound webhook body as JSON *or* form-encoded. Different callers
 * send different things: our own helper sends JSON, but "Webhooks by Zapier"
 * defaults to application/x-www-form-urlencoded, and some POS/automation tools
 * omit the content-type entirely. Returns a flat record; never throws (an
 * empty/garbage body becomes {} → enqueue skips it as no_contact, a 200).
 */
export async function parseWebhookBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  const ct = (request.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      return (await request.json()) as Record<string, unknown>;
    }
    if (
      ct.includes("application/x-www-form-urlencoded") ||
      ct.includes("multipart/form-data")
    ) {
      const fd = await request.formData();
      return Object.fromEntries(
        [...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]),
      );
    }
    // Unknown/missing content-type: sniff the raw body.
    const raw = (await request.text()).trim();
    if (!raw) return {};
    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        /* fall through to urlencoded */
      }
    }
    return Object.fromEntries(new URLSearchParams(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Read a field allowing common aliases (camelCase / snake_case / vendor names). */
export function pickField(
  body: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}
