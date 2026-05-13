import "server-only";

const V4_BASE = "https://mybusiness.googleapis.com/v4";

/**
 * Create a local post on a Google Business Profile listing. Uses the legacy
 * v4 endpoint (same as reviews) because Google hasn't migrated posts to the
 * newer Business Information API yet.
 *
 * Scope required: business.manage (same scope we already use for reviews).
 *
 * Docs: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts
 */

export interface PostMedia {
  /** Public URL Google can fetch the image from. Must be JPEG/PNG/GIF. */
  sourceUrl: string;
}

export interface PostCallToAction {
  /**
   * Google supports a small enum: BOOK, ORDER, SHOP, LEARN_MORE, SIGN_UP,
   * CALL. CALL pairs with the location's phone number (no URL needed). All
   * others require a URL.
   */
  actionType:
    | "BOOK"
    | "ORDER"
    | "SHOP"
    | "LEARN_MORE"
    | "SIGN_UP"
    | "CALL";
  url?: string;
}

export interface CreateLocalPostInput {
  accessToken: string;
  /** Full GBP resource path: `accounts/{a}/locations/{l}` */
  locationResourceName: string;
  /** Body text, max 1500 chars per Google's docs. */
  summary: string;
  /** Optional CTA button. */
  callToAction?: PostCallToAction;
  /** One or more image URLs Google should fetch and attach. */
  media?: PostMedia[];
}

export interface LocalPostResult {
  name: string; // accounts/{a}/locations/{l}/localPosts/{id}
  state: string;
  searchUrl?: string;
}

export async function createLocalPost(
  input: CreateLocalPostInput,
): Promise<LocalPostResult> {
  const url = `${V4_BASE}/${input.locationResourceName}/localPosts`;

  const body: Record<string, unknown> = {
    topicType: "STANDARD",
    summary: input.summary.slice(0, 1500),
    languageCode: "en", // GBP accepts en|zh-Hans|es etc; we default to en
  };
  if (input.media && input.media.length > 0) {
    body.media = input.media.map((m) => ({
      mediaFormat: "PHOTO",
      sourceUrl: m.sourceUrl,
    }));
  }
  if (input.callToAction) {
    body.callToAction = {
      actionType: input.callToAction.actionType,
      ...(input.callToAction.url ? { url: input.callToAction.url } : {}),
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GBP localPost create failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    name?: string;
    state?: string;
    searchUrl?: string;
  };
  return {
    name: json.name ?? "",
    state: json.state ?? "UNKNOWN",
    searchUrl: json.searchUrl,
  };
}
