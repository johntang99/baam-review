import "server-only";
import { OutscraperError } from "../errors";

const BASE_URL = "https://api.app.outscraper.com";
const SYNC_TIMEOUT_MS = 90_000;

export abstract class OutscraperBaseClient {
  constructor(protected apiKey: string) {}

  protected async getJson<T>(
    path: string,
    params: Record<string, string | number | boolean>,
    // Per-call abort budget. Defaults to the generous SYNC_TIMEOUT_MS for the
    // essential primary-business fetch; callers that fetch optional data (e.g.
    // competitor reviews) pass a shorter value so one slow scrape can't eat the
    // serverless time budget — it just degrades to Google reviews instead.
    timeoutMs: number = SYNC_TIMEOUT_MS,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { "X-API-KEY": this.apiKey },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "(no body)");
        throw new OutscraperError(`HTTP ${response.status}: ${body}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof OutscraperError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new OutscraperError(
          `request timed out after ${timeoutMs}ms`,
        );
      }
      throw new OutscraperError(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
