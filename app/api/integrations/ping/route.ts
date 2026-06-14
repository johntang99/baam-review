import { NextResponse, type NextRequest } from "next/server";
import { verifyApiKey } from "@/lib/integrations/api-keys";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Connection test for the intake integration (Phase 3 — no-code setup).
 *
 *   GET /api/integrations/ping
 *   Authorization: Bearer <location API key>   (or header: x-api-key)
 *
 * Returns the location the key is bound to, so Zapier / Make / n8n "Test
 * connection" shows the business name and confirms the key works. Verifies the
 * key but does NOT consume a rate-limit token (connection tests can be
 * frequent and shouldn't eat a client's enqueue budget).
 */
export const dynamic = "force-dynamic";

function readKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-api-key");
}

export async function GET(request: NextRequest) {
  const verified = await verifyApiKey(readKey(request));
  if (!verified) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing API key" },
      { status: 401 },
    );
  }
  const svc = createServiceClient();
  const { data: loc } = await svc
    .from("locations")
    .select("id, display_name")
    .eq("id", verified.locationId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    location: { id: verified.locationId, name: loc?.display_name ?? null },
  });
}
