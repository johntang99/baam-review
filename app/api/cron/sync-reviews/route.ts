import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncReviewsForAccount } from "@/lib/google/sync-reviews";

/**
 * Vercel Cron entry point. Configured in vercel.json to run every 6 hours.
 *
 * Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to scheduled
 * invocations. We verify against CRON_SECRET env to reject unauthorized
 * calls (the route URL is public and discoverable).
 *
 * Loops over every connected account and syncs each, swallowing per-account
 * errors so one bad account doesn't break the others.
 */
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes — plenty for many accounts.

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = createServiceClient();

  // Only accounts with a Google connection are sync candidates.
  const { data: accounts } = await supabase
    .from("google_oauth_tokens")
    .select("account_id");

  const results: Array<{
    account_id: string;
    summaries: Awaited<ReturnType<typeof syncReviewsForAccount>>;
    error?: string;
  }> = [];

  for (const row of accounts ?? []) {
    try {
      const summaries = await syncReviewsForAccount(row.account_id);
      results.push({ account_id: row.account_id, summaries });
    } catch (e) {
      results.push({
        account_id: row.account_id,
        summaries: [],
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ok: true, accountsSynced: results.length, results });
}
