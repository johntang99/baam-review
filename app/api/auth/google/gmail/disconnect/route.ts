import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  canAccessLocation,
  getInternalContext,
  isFullServiceCustomerReadOnly,
} from "@/lib/auth/staff";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextRaw = request.nextUrl.searchParams.get("next") ?? "";
  const safeNext =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/app/send";
  const locationId = request.nextUrl.searchParams.get("location_id");

  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(safeNext)}`, request.url),
    );
  }

  if (await isFullServiceCustomerReadOnly(supabase, user.id)) {
    return NextResponse.redirect(new URL("/app/billing", request.url));
  }
  if (!locationId) {
    const url = new URL(safeNext, request.url);
    url.searchParams.set("gmail_oauth_error", "location_required");
    return NextResponse.redirect(url);
  }

  const internal = await getInternalContext(supabase, user.id);
  const allowed = await canAccessLocation(supabase, internal, locationId);
  if (!allowed) {
    const url = new URL(safeNext, request.url);
    url.searchParams.set("gmail_oauth_error", "location_forbidden");
    return NextResponse.redirect(url);
  }

  const service = createServiceClient();
  await service.from("gmail_oauth_tokens").delete().eq("location_id", locationId);

  const url = new URL(safeNext, request.url);
  url.searchParams.set("gmail_oauth", "disconnected");
  return NextResponse.redirect(url);
}
