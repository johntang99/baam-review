import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Called by /api/embed.js when the snippet first runs on a customer's
 * site. Logs to embed_loads so admin can see which sites have the
 * snippet live (and which origins drive traffic).
 *
 * The fetch from embed.js uses mode: 'no-cors' so the browser sends
 * Origin / Referer but doesn't expect a CORS-safe response. We respond
 * 204 with permissive CORS headers to be polite.
 */
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return new Response(null, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const supabase = createServiceClient();
  const { data: location } = await supabase
    .from("locations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!location) {
    return new Response(null, {
      status: 404,
      headers: corsHeaders(),
    });
  }

  const origin =
    request.headers.get("origin") ||
    request.headers.get("referer") ||
    null;

  await supabase.from("embed_loads").insert({
    location_id: location.id,
    origin_url: origin ? origin.slice(0, 500) : null,
  });

  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
  };
}
