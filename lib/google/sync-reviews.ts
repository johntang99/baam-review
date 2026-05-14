import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getValidAccessToken,
  listGoogleAccounts,
  listGoogleLocations,
} from "@/lib/google/business-profile";
import { fetchReviews } from "@/lib/google/reviews";
import { sendLowRatingAlert } from "@/lib/alerts/low-rating";

export interface SyncSummary {
  locationId: string;
  locationName: string;
  inserted: number;
  updated: number;
  alerts: number;
  error?: string;
}

/**
 * Sync all locations for a single account, in sequence to be polite to
 * Google's rate limits. Use this from a manual-trigger button or a Vercel
 * cron job — same code path.
 */
export async function syncReviewsForAccount(
  accountId: string,
): Promise<SyncSummary[]> {
  const supabase = createServiceClient();

  // Resolve the access token (auto-refreshes if expired).
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(accountId);
  } catch {
    return [];
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("primary_email, name, suspended_at")
    .eq("id", accountId)
    .maybeSingle();
  if (!account || account.suspended_at) return [];

  const { data: locations } = await supabase
    .from("locations")
    .select(
      "id, display_name, google_place_id, google_resource_name, website_url",
    )
    .eq("account_id", accountId);

  if (!locations || locations.length === 0) return [];

  // Fetch the GBP location list when ANY of our locations is missing either
  // a resource_name or a website_url. Pulls websiteUri straight from Google
  // so owners don't need to type it in manually. Skipped only when every
  // location already has both, since the API call is non-trivial.
  const needResource = locations.filter((l) => !l.google_resource_name);
  const needWebsite = locations.filter((l) => !l.website_url);
  if (needResource.length > 0 || needWebsite.length > 0) {
    try {
      const gbpAccounts = await listGoogleAccounts(accessToken);
      const placeIdToResource = new Map<string, string>();
      const placeIdToWebsite = new Map<string, string>();
      for (const gbpAcct of gbpAccounts) {
        const gbpLocs = await listGoogleLocations(accessToken, gbpAcct.name);
        for (const loc of gbpLocs) {
          if (loc.placeId) {
            // loc.name is "locations/12345"; we need accounts/{id}/locations/12345
            placeIdToResource.set(
              loc.placeId,
              `${gbpAcct.name}/${loc.name}`,
            );
            if (loc.websiteUri) {
              placeIdToWebsite.set(loc.placeId, loc.websiteUri);
            }
          }
        }
      }
      for (const ourLoc of locations) {
        if (!ourLoc.google_place_id) continue;
        const updates: { google_resource_name?: string; website_url?: string } =
          {};
        if (!ourLoc.google_resource_name) {
          const resource = placeIdToResource.get(ourLoc.google_place_id);
          if (resource) updates.google_resource_name = resource;
        }
        if (!ourLoc.website_url) {
          const site = placeIdToWebsite.get(ourLoc.google_place_id);
          if (site) updates.website_url = site;
        }
        if (Object.keys(updates).length === 0) continue;
        await supabase.from("locations").update(updates).eq("id", ourLoc.id);
        if (updates.google_resource_name)
          ourLoc.google_resource_name = updates.google_resource_name;
        if (updates.website_url) ourLoc.website_url = updates.website_url;
      }
    } catch (e) {
      console.error("GBP location backfill failed", e);
    }
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://review.baamplatform.com";

  const summaries: SyncSummary[] = [];

  for (const loc of locations) {
    const summary: SyncSummary = {
      locationId: loc.id,
      locationName: loc.display_name,
      inserted: 0,
      updated: 0,
      alerts: 0,
    };

    if (!loc.google_resource_name) {
      summary.error = "No GBP resource name resolved";
      summaries.push(summary);
      continue;
    }

    let reviews;
    try {
      reviews = await fetchReviews(accessToken, loc.google_resource_name);
    } catch (e) {
      summary.error = e instanceof Error ? e.message : "Fetch failed";
      summaries.push(summary);
      continue;
    }

    for (const r of reviews) {
      const { data: existing } = await supabase
        .from("google_reviews")
        .select("id, alerted_at, review_update_time, reply_comment")
        .eq("location_id", loc.id)
        .eq("google_review_id", r.reviewId)
        .maybeSingle();

      if (existing) {
        // Update if the review or reply changed.
        if (
          existing.review_update_time !== r.updateTime ||
          (r.reply?.comment ?? null) !== existing.reply_comment
        ) {
          await supabase
            .from("google_reviews")
            .update({
              rating: r.rating,
              comment: r.comment,
              review_update_time: r.updateTime,
              reply_comment: r.reply?.comment ?? null,
              reply_update_time: r.reply?.updateTime ?? null,
              reviewer_display_name: r.reviewerDisplayName,
              reviewer_profile_photo_url: r.reviewerProfilePhotoUrl,
              fetched_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          summary.updated += 1;
        }
        continue;
      }

      // New review. Insert.
      const { data: inserted } = await supabase
        .from("google_reviews")
        .insert({
          location_id: loc.id,
          google_review_id: r.reviewId,
          reviewer_display_name: r.reviewerDisplayName,
          reviewer_profile_photo_url: r.reviewerProfilePhotoUrl,
          rating: r.rating,
          comment: r.comment,
          review_create_time: r.createTime,
          review_update_time: r.updateTime,
          reply_comment: r.reply?.comment ?? null,
          reply_update_time: r.reply?.updateTime ?? null,
        })
        .select("id")
        .single();

      summary.inserted += 1;

      // Fire alert for new low-rating reviews. Skip if we've already alerted
      // (existing path covers updates; this is the first-seen path).
      if (r.rating <= 2 && inserted && account.primary_email) {
        try {
          await sendLowRatingAlert({
            to: account.primary_email,
            locationName: loc.display_name,
            reviewerName: r.reviewerDisplayName,
            rating: r.rating,
            comment: r.comment,
            reviewCreateTime: r.createTime,
            appUrl,
            locationId: loc.id,
          });
          await supabase
            .from("google_reviews")
            .update({ alerted_at: new Date().toISOString() })
            .eq("id", inserted.id);
          summary.alerts += 1;
        } catch (e) {
          console.error("Low-rating alert failed", e);
        }
      }
    }

    // Stamp the sync time so the UI can show "last synced 2m ago".
    await supabase
      .from("locations")
      .update({ reviews_synced_at: new Date().toISOString() })
      .eq("id", loc.id);

    summaries.push(summary);
  }

  return summaries;
}
