import "server-only";
import { OutscraperBaseClient } from "../../google/clients/outscraper-base-client";
import { OutscraperError } from "../../google/errors";

export interface RawYelpReview {
  review_id?: string;
  author_title?: string;
  author_image?: string;
  author_location?: string;
  author_reviews_count?: number;
  review_text?: string;
  review_rating?: number;
  review_likes?: number;
  datetime_utc?: string;
  timestamp?: number;
  owner_reply?: string | null;
  owner_reply_title?: string | null;
  owner_reply_datetime_utc?: string | null;
  owner_reply_timestamp?: number | null;
  business_name?: string;
}

export interface RawYelpBusinessProfile {
  business_name?: string;
  query?: string;
  rating?: number;
  reviews_count?: number;
  last_review_datetime_utc?: string;
  is_claimed?: boolean;
  has_photos?: boolean;
  photos_count?: number;
  has_hours?: boolean;
  description?: string;
}

interface YelpReviewsResponse {
  status?: string;
  data?: Array<RawYelpReview[]>;
}

export class YelpReviewsClient extends OutscraperBaseClient {
  async fetchReviewsByUrl(
    yelpUrl: string,
    options: { limit?: number } = {},
  ): Promise<RawYelpReview[]> {
    const response = await this.getJson<YelpReviewsResponse>("/yelp/reviews", {
      query: yelpUrl,
      reviewsLimit: options.limit ?? 5,
      sort: "newest",
      language: "en",
      async: false,
    });

    if (response.status && response.status !== "Success") {
      throw new OutscraperError(`yelp/reviews status=${response.status}`);
    }

    const inner = response.data?.[0];
    if (!Array.isArray(inner)) {
      throw new OutscraperError("yelp/reviews response missing inner array");
    }

    // Empty Yelp profile sentinel
    if (inner.length === 1 && inner[0]?.review_id === "__NO_REVIEWS_FOUND__") {
      return [];
    }

    return inner;
  }
}
