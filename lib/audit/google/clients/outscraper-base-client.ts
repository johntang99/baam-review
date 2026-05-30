import "server-only";
import { OutscraperError } from "../errors";

const BASE_URL = "https://api.app.outscraper.com";
const SYNC_TIMEOUT_MS = 90_000;

export abstract class OutscraperBaseClient {
  constructor(protected apiKey: string) {}

  protected async getJson<T>(
    path: string,
    params: Record<string, string | number | boolean>,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

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
          `request timed out after ${SYNC_TIMEOUT_MS}ms`,
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
