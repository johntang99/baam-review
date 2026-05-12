"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const SELECTED_LOCATION_COOKIE = "baam_selected_location_id";

/**
 * Focus the sidebar on a specific location and stay on /app/reviews.
 * Used by the "Open in location" link on Google review cards: clicking
 * shouldn't navigate to the management area, just narrow the inbox to
 * that location.
 */
export async function focusLocationInReviews(
  locationId: string,
  tab: string | undefined,
): Promise<void> {
  const store = await cookies();
  store.set(SELECTED_LOCATION_COOKIE, locationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  const qs = tab && tab !== "all" ? `?tab=${tab}` : "";
  redirect(`/app/reviews${qs}`);
}

export async function markFeedbackRead(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("private_feedback")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  revalidatePath("/app/reviews");
  revalidatePath("/app");
}

export async function markFeedbackUnread(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("private_feedback")
    .update({ read_at: null })
    .eq("id", id);

  revalidatePath("/app/reviews");
  revalidatePath("/app");
}
