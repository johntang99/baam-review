"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncReviewsForAccount } from "@/lib/google/sync-reviews";

export interface SyncResult {
  ok: boolean;
  inserted?: number;
  updated?: number;
  alerts?: number;
  error?: string;
}

export async function syncReviews(locationId: string): Promise<SyncResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) {
    return { ok: false, error: "No account for current user." };
  }

  const summaries = await syncReviewsForAccount(profile.account_id);
  const mine = summaries.find((s) => s.locationId === locationId);

  if (!mine) {
    return { ok: false, error: "Location not in account or no GBP connection." };
  }

  if (mine.error) {
    return { ok: false, error: mine.error };
  }

  revalidatePath(`/app/locations/${locationId}/reviews`);
  revalidatePath("/app");
  revalidatePath("/app/reviews");

  return {
    ok: true,
    inserted: mine.inserted,
    updated: mine.updated,
    alerts: mine.alerts,
  };
}
