import "server-only";

const V4_BASE = "https://mybusiness.googleapis.com/v4";

/**
 * Post a reply to a Google review.
 *
 * GBP API endpoint (PUT): accounts/{accountId}/locations/{locationId}/reviews/{reviewId}/reply
 * Body: { comment: "your reply text" }
 *
 * The same OAuth token used for read works for write — scope business.manage
 * covers both. There is also a DELETE on the same path to remove a reply.
 *
 * Returns the API response so the caller can persist the updateTime that
 * Google echoes back.
 */
export interface PostedReply {
  comment: string;
  updateTime: string;
}

export async function postReviewReply(opts: {
  accessToken: string;
  /**
   * Full GBP review resource path:
   *   accounts/{accountId}/locations/{locationId}/reviews/{reviewId}
   */
  reviewResourceName: string;
  comment: string;
}): Promise<PostedReply> {
  const url = `${V4_BASE}/${opts.reviewResourceName}/reply`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment: opts.comment }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GBP reply failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    comment?: string;
    updateTime?: string;
  };

  return {
    comment: json.comment ?? opts.comment,
    updateTime: json.updateTime ?? new Date().toISOString(),
  };
}

export async function deleteReviewReply(opts: {
  accessToken: string;
  reviewResourceName: string;
}): Promise<void> {
  const url = `${V4_BASE}/${opts.reviewResourceName}/reply`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GBP reply delete failed (${res.status}): ${text}`);
  }
}
