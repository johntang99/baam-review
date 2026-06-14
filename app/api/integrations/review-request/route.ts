import { NextResponse, type NextRequest } from "next/server";
import { consumeApiKey } from "@/lib/integrations/api-keys";
import { enqueueReviewRequest } from "@/lib/integrations/enqueue";

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

  let body: {
    name?: string;
    email?: string;
    phone?: string;
    language?: string;
    service?: string;
    transacted_at?: string;
    external_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const result = await enqueueReviewRequest({
    location: auth.locationId, // bound to the key, never from the body
    name: body.name ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    language: body.language ?? null,
    service: body.service ?? null,
    transactedAt: body.transacted_at ?? null,
    externalId: body.external_id ?? null,
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
