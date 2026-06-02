import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Honour optional `next` form param so callers can pick where the
  // signed-out user lands. Only relative paths are accepted to prevent
  // open-redirect. Default = main app homepage (legacy behaviour).
  const formData = await request.formData().catch(() => null);
  const nextRaw = formData?.get("next");
  const next =
    typeof nextRaw === "string" && nextRaw.startsWith("/") ? nextRaw : "/";

  return NextResponse.redirect(new URL(next, request.url), { status: 303 });
}
