"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getValidAccessToken } from "@/lib/google/business-profile";
import { postReviewReply, deleteReviewReply } from "@/lib/google/post-reply";

export interface PostReplyResult {
  ok: boolean;
  error?: string;
}

export async function postReply(opts: {
  reviewId: string;
  comment: string;
}): Promise<PostReplyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const comment = opts.comment.trim();
  if (!comment) {
    return { ok: false, error: "Reply cannot be empty." };
  }
  if (comment.length > 4000) {
    return { ok: false, error: "Reply is too long (max 4000 chars)." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) {
    return { ok: false, error: "No account for current user." };
  }

  // Fetch the review + its location's GBP resource path. RLS scopes both
  // reads to the user's account.
  const { data: review } = await supabase
    .from("google_reviews")
    .select("id, google_review_id, location_id")
    .eq("id", opts.reviewId)
    .maybeSingle();
  if (!review) return { ok: false, error: "Review not found." };

  const { data: location } = await supabase
    .from("locations")
    .select("id, google_resource_name, connected_by_user_id")
    .eq("id", review.location_id)
    .maybeSingle();
  if (!location?.google_resource_name) {
    return {
      ok: false,
      error: "Location is missing its Google resource path. Reconnect Google for this location.",
    };
  }

  // The reply must be posted with the connector's Google identity (since
  // *their* gmail is what Google sees as a Manager on this GBP). If
  // connected_by is missing on legacy rows, fall back to the current user.
  const tokenUserId = location.connected_by_user_id ?? user.id;

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(tokenUserId);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't get Google token.",
    };
  }

  let posted;
  try {
    posted = await postReviewReply({
      accessToken,
      reviewResourceName: `${location.google_resource_name}/reviews/${review.google_review_id}`,
      comment,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Google rejected the reply.",
    };
  }

  // Persist locally so the UI doesn't have to wait for the next sync to show
  // the reply. The next cron run will reconfirm.
  const service = createServiceClient();
  await service
    .from("google_reviews")
    .update({
      reply_comment: posted.comment,
      reply_update_time: posted.updateTime,
    })
    .eq("id", review.id);

  revalidatePath(`/app/locations/${location.id}/reviews`);
  revalidatePath("/app");
  revalidatePath("/app/reviews");

  return { ok: true };
}

export async function removeReply(reviewId: string): Promise<PostReplyResult> {
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

  const { data: review } = await supabase
    .from("google_reviews")
    .select("id, google_review_id, location_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review) return { ok: false, error: "Review not found." };

  const { data: location } = await supabase
    .from("locations")
    .select("id, google_resource_name, connected_by_user_id")
    .eq("id", review.location_id)
    .maybeSingle();
  if (!location?.google_resource_name) {
    return { ok: false, error: "Missing Google resource path." };
  }

  const tokenUserId = location.connected_by_user_id ?? user.id;

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(tokenUserId);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't get Google token.",
    };
  }

  try {
    await deleteReviewReply({
      accessToken,
      reviewResourceName: `${location.google_resource_name}/reviews/${review.google_review_id}`,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Google rejected the delete.",
    };
  }

  const service = createServiceClient();
  await service
    .from("google_reviews")
    .update({
      reply_comment: null,
      reply_update_time: null,
    })
    .eq("id", review.id);

  revalidatePath(`/app/locations/${location.id}/reviews`);
  revalidatePath("/app");

  return { ok: true };
}
