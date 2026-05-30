import "server-only";
import { OutscraperError } from "../errors";
import { OutscraperBaseClient } from "./outscraper-base-client";

export interface RawOutscraperReview {
  review_id?: string;
  author_title?: string;
  author_id?: string;
  author_image?: string;
  review_text?: string;
  review_rating?: number;
  review_timestamp?: number;
  review_datetime_utc?: string;
  review_likes?: number;
  owner_answer?: string;
  owner_answer_timestamp?: number;
  owner_answer_datetime_utc?: string;
}

interface OutscraperReviewsResponse {
  status: string;
  data?: Array<{
    reviews_data?: RawOutscraperReview[];
  }>;
}

export class OutscraperGoogleReviewsClient extends OutscraperBaseClient {
  async fetchReviews(
    placeId: string,
    options: { limit?: number } = {},
  ): Promise<RawOutscraperReview[]> {
    const response = await this.getJson<OutscraperReviewsResponse>(
      "/maps/reviews-v3",
      {
        query: placeId,
        reviewsLimit: options.limit ?? 1000,
        sort: "newest",
        language: "en",
        async: false,
      },
    );

    if (response.status !== "Success") {
      throw new OutscraperError(`status=${response.status}`);
    }

    const reviews = response.data?.[0]?.reviews_data;
    if (!Array.isArray(reviews)) {
      throw new OutscraperError("response missing reviews_data");
    }
    return reviews;
  }
}
