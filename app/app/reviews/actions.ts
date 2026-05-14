"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncReviewsForAccount } from "@/lib/google/sync-reviews";

export interface SyncAllResult {
  ok: boolean;
  inserted?: number;
  updated?: number;
  alerts?: number;
  locations?: number;
  errors?: string[];
  error?: string;
}

/**
 * Sync every location in the current account. Backs the Sync button on the
 * global /app/reviews inbox. Returns aggregated totals across locations and
 * collects per-location errors so a partial failure still reports useful info.
 */
export async function syncAllReviews(): Promise<SyncAllResult> {
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

  let summaries;
  try {
    summaries = await syncReviewsForAccount(profile.account_id);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Sync failed.",
    };
  }

  if (summaries.length === 0) {
    return {
      ok: false,
      error: "No locations connected to Google Business Profile yet.",
    };
  }

  const inserted = summaries.reduce((s, x) => s + x.inserted, 0);
  const updated = summaries.reduce((s, x) => s + x.updated, 0);
  const alerts = summaries.reduce((s, x) => s + x.alerts, 0);
  const errors = summaries
    .filter((s) => s.error)
    .map((s) => `${s.locationName}: ${s.error}`);

  revalidatePath("/app/reviews");
  revalidatePath("/app");

  return {
    ok: errors.length < summaries.length,
    inserted,
    updated,
    alerts,
    locations: summaries.length,
    errors: errors.length > 0 ? errors : undefined,
  };
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
