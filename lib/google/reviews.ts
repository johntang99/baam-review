import "server-only";

// Reviews are still on the legacy My Business API v4 — Google split the
// account / business-information endpoints into separate hosts but never
// migrated reviews. Same OAuth token, scope business.manage.
const V4_BASE = "https://mybusiness.googleapis.com/v4";

const RATING_BY_NAME: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export interface GoogleReview {
  reviewId: string;
  reviewerDisplayName: string | null;
  reviewerProfilePhotoUrl: string | null;
  rating: number;
  comment: string | null;
  createTime: string;
  updateTime: string;
  reply: { comment: string; updateTime: string } | null;
}

interface ReviewsApiResponse {
  reviews?: Array<{
    reviewId: string;
    reviewer?: { displayName?: string; profilePhotoUrl?: string };
    starRating: string;
    comment?: string;
    createTime: string;
    updateTime: string;
    reviewReply?: { comment?: string; updateTime?: string };
  }>;
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}

/**
 * Fetch all reviews for a location. Paginates internally; returns the full
 * list ordered newest-first. Pass `resourceName` like
 * "accounts/12345/locations/67890".
 */
export async function fetchReviews(
  accessToken: string,
  resourceName: string,
  opts: { maxPages?: number } = {},
): Promise<GoogleReview[]> {
  const maxPages = opts.maxPages ?? 10;
  const out: GoogleReview[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const url = new URL(`${V4_BASE}/${resourceName}/reviews`);
    url.searchParams.set("pageSize", "50");
    url.searchParams.set("orderBy", "updateTime desc");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GBP reviews list failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as ReviewsApiResponse;
    for (const r of json.reviews ?? []) {
      out.push({
        reviewId: r.reviewId,
        reviewerDisplayName: r.reviewer?.displayName ?? null,
        reviewerProfilePhotoUrl: r.reviewer?.profilePhotoUrl ?? null,
        rating: RATING_BY_NAME[r.starRating] ?? 0,
        comment: r.comment ?? null,
        createTime: r.createTime,
        updateTime: r.updateTime,
        reply: r.reviewReply
          ? {
              comment: r.reviewReply.comment ?? "",
              updateTime: r.reviewReply.updateTime ?? r.updateTime,
            }
          : null,
      });
    }
    pageToken = json.nextPageToken;
    pages += 1;
  } while (pageToken && pages < maxPages);

  return out;
}
