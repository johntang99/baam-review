import { NextResponse, type NextRequest } from "next/server";
import { consumeApiKey } from "@/lib/integrations/api-keys";
import { enqueueReviewRequest } from "@/lib/integrations/enqueue";
import { getProviderAdapter, type MappedContact } from "@/lib/integrations/providers";
import { getConnection } from "@/lib/integrations/connections";

/**
 * Native connector webhook (Phase 4). A client points their vendor's own
 * webhook here:
 *   POST /api/integrations/<provider>?key=<location API key>
 *
 * The per-provider adapter translates the vendor payload → our contact shape,
 * then enqueueReviewRequest appends it to the location's weekly queue. Auth +
 * rate limiting reuse the same per-location API key as the generic endpoint
 * (key via ?key= query — since vendor webhook configs usually only let you set
 * a URL — or Authorization/x-api-key header).
 *
 * Responses: 201 queued · 200 ignored/skipped · 401 bad key · 404 unknown
 * provider · 429 rate-limited.
 */
export const dynamic = "force-dynamic";

function readKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return (
    request.headers.get("x-api-key") ??
    request.nextUrl.searchParams.get("key")
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const adapter = getProviderAdapter(provider);
  if (!adapter) {
    return NextResponse.json(
      { ok: false, error: `Unknown provider "${provider}"` },
      { status: 404 },
    );
  }

  const auth = await consumeApiKey(readKey(request));
  if (!auth.ok && auth.reason === "rate_limited") {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded — slow down and retry." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing API key" },
      { status: 401 },
    );
  }

  // Parse the body per the provider's content type (Acuity posts form-encoded).
  const raw = await request.text();
  let body: unknown;
  if (adapter.parse === "form") {
    body = Object.fromEntries(new URLSearchParams(raw));
  } else {
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }
  }

  // Fetch-based providers (e.g. Acuity) need the location's stored credentials
  // to call the vendor API; direct providers map the payload synchronously.
  let mapped: MappedContact | null;
  if (adapter.needsConnection) {
    const conn = await getConnection(auth.locationId, adapter.id);
    if (!conn) {
      return NextResponse.json({
        ok: true,
        status: "not_connected",
        provider: adapter.id,
      });
    }
    mapped = adapter.resolve
      ? await adapter.resolve(body, request.headers, conn.credentials)
      : null;
  } else {
    mapped = adapter.map ? adapter.map(body, request.headers) : null;
  }

  if (!mapped) {
    // Event isn't relevant (wrong type / cancellation / no contact) — ack so
    // the vendor doesn't retry.
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const result = await enqueueReviewRequest({
    location: auth.locationId, // bound to the key
    name: mapped.name ?? null,
    email: mapped.email ?? null,
    phone: mapped.phone ?? null,
    service: mapped.service ?? null,
    transactedAt: mapped.transactedAt ?? null,
    externalId: mapped.externalId ?? null,
  });

  if (result.status === "queued") {
    return NextResponse.json(
      { ok: true, status: "queued", id: result.listCustomerId },
      { status: 201 },
    );
  }
  return NextResponse.json({ ok: true, status: "skipped", reason: result.reason });
}
