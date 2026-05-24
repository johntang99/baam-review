import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncReviewsForUser } from "@/lib/google/sync-reviews";

/**
 * Vercel Cron entry point. Configured in vercel.json to run every 6 hours.
 *
 * Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to scheduled
 * invocations. We verify against CRON_SECRET env to reject unauthorized
 * calls (the route URL is public and discoverable).
 *
 * Loops over every user with a Google OAuth token and syncs the locations
 * they connected, swallowing per-user errors so one bad token doesn't
 * break the others.
 */
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes — plenty for many users.

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = createServiceClient();

  const { data: users } = await supabase
    .from("google_oauth_tokens")
    .select("user_id");

  const results: Array<{
    user_id: string;
    summaries: Awaited<ReturnType<typeof syncReviewsForUser>>;
    error?: string;
  }> = [];

  for (const row of users ?? []) {
    try {
      const summaries = await syncReviewsForUser(row.user_id);
      results.push({ user_id: row.user_id, summaries });
    } catch (e) {
      results.push({
        user_id: row.user_id,
        summaries: [],
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ok: true, usersSynced: results.length, results });
}
