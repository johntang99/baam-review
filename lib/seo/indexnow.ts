import "server-only";

/**
 * IndexNow push — instant-index protocol Bing supports (and via Bing,
 * ChatGPT's web index). Lets us tell search engines "this URL just
 * changed" without waiting for the regular crawl cycle. Useful when:
 *
 *   - A new blog post is published
 *   - A new city or industry page goes live
 *   - A research report ships
 *
 * IndexNow's only catch: every site has to host a key file at
 * `/<key>.txt` whose contents are the key itself. That proves
 * ownership. We serve that file from the route handler at
 * /app/[indexnow_key]/route.ts (built in the next step of the
 * implementation plan).
 *
 * Usage:
 *
 *   import { pingIndexNow } from "@/lib/seo/indexnow";
 *   await pingIndexNow(["https://baamreview.com/blog/my-new-post"]);
 *
 * Failures are logged but never thrown — IndexNow is a fire-and-
 * forget optimization, not a critical path. Don't let a Bing API
 * blip break the publish flow.
 */

const BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://baamreview.com"
).trim();

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

interface IndexNowResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/** Submit one or more URLs to IndexNow. URLs must be on the same host
 *  the IndexNow key is registered for. */
export async function pingIndexNow(urls: string[]): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    // Not configured yet — skip silently. Letting publish keep working
    // even before SEO infra is fully wired matters more than a console
    // warning every deploy.
    return { ok: false, error: "INDEXNOW_KEY not set" };
  }
  if (urls.length === 0) return { ok: true };

  // Strip empty entries; ensure all URLs are absolute and on our host.
  const host = new URL(BASE_URL).host;
  const cleanUrls = urls
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
    .filter((u) => {
      try {
        return new URL(u).host === host;
      } catch {
        return false;
      }
    });
  if (cleanUrls.length === 0) return { ok: true };

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${BASE_URL}/${key}.txt`,
        urlList: cleanUrls,
      }),
    });
    if (!res.ok) {
      console.warn(
        `[indexnow] failed with status ${res.status} for ${cleanUrls.length} url(s)`,
      );
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.warn(`[indexnow] error:`, message);
    return { ok: false, error: message };
  }
}

/** Convenience wrapper that builds a full URL from a path. */
export async function pingIndexNowForPath(
  path: string,
): Promise<IndexNowResult> {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  return pingIndexNow([url]);
}
