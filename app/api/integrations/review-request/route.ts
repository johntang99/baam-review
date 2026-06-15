import { NextResponse, type NextRequest } from "next/server";
import { consumeApiKey } from "@/lib/integrations/api-keys";
import { enqueueReviewRequest } from "@/lib/integrations/enqueue";
import { parseWebhookBody, pickField } from "@/lib/integrations/parse-body";

/**
 * Universal intake endpoint (Phase 2 of the Integrations & Contact Intake SOP).
 *
 *   POST /api/integrations/review-request
 *   Authorization: Bearer <location API key>      (or header: x-api-key)
 *   { "name": "...", "email": "...", "phone": "...", "service": "...",
 *     "language": "en|zh|es", "transacted_at": "<iso>", "external_id": "..." }
 *
 * The location is derived from the API key (a key is bound to one location), so
 * the body never specifies it. The contact is appended to the location's
 * rolling integration queue via enqueueReviewRequest — it is NOT sent here;
 * email goes out via the human one-by-one Gmail flow. Idempotent on
 * external_id; opted-out / duplicate / no-contact return 200 with a status so
 * callers (POS/Zapier/n8n) treat them as handled, not errors.
 */
export const dynamic = "force-dynamic";

function readKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-api-key");
}

export async function POST(request: NextRequest) {
  const auth = await consumeApiKey(readKey(request));
  if (!auth.ok && auth.reason === "invalid") {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing API key" },
      { status: 401 },
    );
  }
  if (!auth.ok && auth.reason === "rate_limited") {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded — slow down and retry." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  // Narrow to the success case for TypeScript.
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Accept JSON or form-encoded (Zapier/Make/n8n/POS all differ), and tolerate
  // common field-name aliases so non-technical Zap setups still map cleanly.
  const body = await parseWebhookBody(request);

  const result = await enqueueReviewRequest({
    location: auth.locationId, // bound to the key, never from the body
    name: pickField(body, "name", "full_name", "customer_name", "first_name"),
    email: pickField(body, "email", "email_address"),
    phone: pickField(body, "phone", "phone_number", "mobile", "tel"),
    language: pickField(body, "language", "lang"),
    service: pickField(body, "service", "service_name", "item"),
    transactedAt: pickField(
      body,
      "transacted_at",
      "transactedAt",
      "appointment_at",
      "date",
    ),
    externalId: pickField(body, "external_id", "externalId", "id"),
  });

  if (result.status === "queued") {
    return NextResponse.json(
      { ok: true, status: "queued", id: result.listCustomerId },
      { status: 201 },
    );
  }
  // Skips are expected, idempotent outcomes — 200 so callers don't retry.
  return NextResponse.json({ ok: true, status: "skipped", reason: result.reason });
}
