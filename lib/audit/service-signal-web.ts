import "server-only";

interface WebsiteSignalResult {
  url: string;
  text: string;
}

export async function fetchWebsiteServiceSignalText(
  inputUrl: string | null | undefined,
  options: { timeoutMs?: number } = {},
): Promise<WebsiteSignalResult | null> {
  const url = normalizeWebsiteUrl(inputUrl);
  if (!url) return null;

  const timeoutMs = options.timeoutMs ?? 2200;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BAAMReviewAuditBot/1.0; +https://baamreview.com)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;

    const rawHtml = (await response.text()).slice(0, 220_000);
    const signalText = extractSignalText(rawHtml);
    if (signalText.length < 24) return null;

    return {
      url: response.url || url,
      text: signalText.slice(0, 4500),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWebsiteUrl(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function extractSignalText(html: string): string {
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const parts: string[] = [];
  const title = extractFirstGroup(cleaned, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) parts.push(title);

  const metaDescription =
    extractMetaContent(cleaned, "description") ||
    extractMetaPropertyContent(cleaned, "og:description");
  if (metaDescription) parts.push(metaDescription);

  const headings = Array.from(
    cleaned.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi),
  )
    .slice(0, 8)
    .map((match) => normalizeText(match[1]))
    .filter(Boolean);
  parts.push(...headings);

  const bodyText = normalizeText(cleaned.replace(/<[^>]+>/g, " "));
  if (bodyText) parts.push(bodyText.slice(0, 1800));

  return unique(parts)
    .map(normalizeText)
    .filter((value) => value.length > 0)
    .join(" | ");
}

function extractMetaContent(html: string, name: string): string {
  const escaped = escapeRegex(name);
  const direct = new RegExp(
    `<meta[^>]*name=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const reverse = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${escaped}["'][^>]*>`,
    "i",
  );
  return (
    normalizeText(extractFirstGroup(html, direct)) ||
    normalizeText(extractFirstGroup(html, reverse))
  );
}

function extractMetaPropertyContent(html: string, property: string): string {
  const escaped = escapeRegex(property);
  const direct = new RegExp(
    `<meta[^>]*property=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const reverse = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${escaped}["'][^>]*>`,
    "i",
  );
  return (
    normalizeText(extractFirstGroup(html, direct)) ||
    normalizeText(extractFirstGroup(html, reverse))
  );
}

function extractFirstGroup(input: string, pattern: RegExp): string {
  const match = input.match(pattern);
  return match?.[1] ?? "";
}

function normalizeText(input: string): string {
  if (!input) return "";
  return decodeHtmlEntities(input)
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
