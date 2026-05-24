"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncReviewsForUser } from "@/lib/google/sync-reviews";

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

  // GBP tokens are per-user. Use the connector's token to fetch reviews,
  // not the current user's — an account manager clicking Sync on an
  // assigned location still goes through the original sales' Google
  // identity.
  const { data: loc } = await supabase
    .from("locations")
    .select("connected_by_user_id")
    .eq("id", locationId)
    .maybeSingle();
  const connectorId = loc?.connected_by_user_id ?? user.id;

  const summaries = await syncReviewsForUser(connectorId);
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
