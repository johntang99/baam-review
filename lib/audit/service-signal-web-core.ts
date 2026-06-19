export interface WebsiteSignalResult {
  url: string;
  text: string;
}

const SECONDARY_PATH_HINTS = [
  "/services",
  "/service",
  "/about",
  "/about-us",
  "/what-we-do",
  "/programs",
  "/program",
  "/products",
  "/menu",
  "/specialties",
  "/practice-areas",
];

const SERVICE_PAGE_SIGNAL_PATTERN =
  /\b(service|services|about|program|programs|products?|solutions?|specialt(y|ies)|practice|menu|tutoring|treatment|procedures?|what we do)\b/i;

export async function fetchWebsiteServiceSignalText(
  inputUrl: string | null | undefined,
  options: { timeoutMs?: number; perPageTimeoutMs?: number; maxSecondaryPages?: number } = {},
): Promise<WebsiteSignalResult | null> {
  const url = normalizeWebsiteUrl(inputUrl);
  if (!url) return null;

  const timeoutMs = clampNumber(options.timeoutMs ?? 2400, 900, 6000);
  const perPageTimeoutMs = clampNumber(options.perPageTimeoutMs ?? 1400, 700, 3500);
  const maxSecondaryPages = clampNumber(options.maxSecondaryPages ?? 3, 0, 5);

  try {
    const homePage = await fetchHtmlPage(url, timeoutMs);
    if (!homePage) return null;

    const parts: string[] = [];
    const homeSignal = extractSignalText(homePage.html);
    if (homeSignal.length > 0) {
      parts.push(`home: ${homeSignal}`);
    }

    const secondaryUrls = buildSecondaryPageUrls(
      homePage.html,
      homePage.url,
      maxSecondaryPages,
    );
    if (secondaryUrls.length > 0) {
      const secondaryPages = await Promise.all(
        secondaryUrls.map((pageUrl) => fetchHtmlPage(pageUrl, perPageTimeoutMs)),
      );
      for (const page of secondaryPages) {
        if (!page) continue;
        const signal = extractSignalText(page.html);
        if (signal.length < 24) continue;
        parts.push(`${labelFromUrl(page.url)}: ${signal}`);
      }
    }

    const signalText = mergeSignalParts(parts);
    if (signalText.length < 24) return null;

    return {
      url: homePage.url || url,
      text: signalText,
    };
  } catch {
    return null;
  }
}

async function fetchHtmlPage(url: string, timeoutMs: number) {
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

    const html = (await response.text()).slice(0, 260_000);
    return { url: response.url || url, html };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWebsiteUrl(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function buildSecondaryPageUrls(html: string, baseUrl: string, maxSecondaryPages: number) {
  if (maxSecondaryPages <= 0) return [];
  const scored = new Map<string, number>();
  const baseCanonical = canonicalizeUrl(baseUrl);
  const base = safeUrl(baseUrl);
  if (!base) return [];

  const add = (candidateUrl: string, score: number) => {
    const canonical = canonicalizeUrl(candidateUrl);
    if (!canonical || canonical === baseCanonical) return;
    const prev = scored.get(canonical) ?? -Infinity;
    if (score > prev) scored.set(canonical, score);
  };

  for (const hintPath of SECONDARY_PATH_HINTS) {
    const hinted = new URL(hintPath, base).toString();
    add(hinted, 0.7);
  }

  const anchorMatches = Array.from(
    html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ).slice(0, 120);
  for (const match of anchorMatches) {
    const href = match[1] ?? "";
    const anchorText = normalizeText(match[2] ?? "");
    const absolute = toInternalAbsoluteUrl(baseUrl, href);
    if (!absolute) continue;
    const score = scoreSecondaryLink(absolute, anchorText);
    if (score <= 0) continue;
    add(absolute, score);
  }

  return Array.from(scored.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].length - b[0].length;
    })
    .slice(0, maxSecondaryPages)
    .map(([pageUrl]) => pageUrl);
}

function scoreSecondaryLink(url: string, anchorText: string) {
  const lowerUrl = url.toLowerCase();
  const lowerAnchor = anchorText.toLowerCase();
  const bundle = `${lowerUrl} ${lowerAnchor}`;
  let score = 0;
  if (SERVICE_PAGE_SIGNAL_PATTERN.test(bundle)) score += 0.9;
  if (/\b(service|services|what-we-do)\b/.test(bundle)) score += 0.5;
  if (/\b(about|about-us|our-story|who-we-are)\b/.test(bundle)) score += 0.35;
  if (/\b(program|programs|courses?|curriculum)\b/.test(bundle)) score += 0.4;
  if (/\b(products?|menu|catalog|solutions?)\b/.test(bundle)) score += 0.35;
  if (/\/(services?|about|programs?|products?|menu)\b/.test(lowerUrl)) score += 0.35;
  if (/\b(contact|login|account|privacy|terms|blog|news|faq)\b/.test(bundle)) score -= 0.4;
  return score;
}

function toInternalAbsoluteUrl(baseUrl: string, href: string) {
  const raw = (href ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("#")) return "";
  if (/^(mailto:|tel:|javascript:)/i.test(raw)) return "";
  const absolute = safeUrl(raw, baseUrl);
  if (!absolute) return "";
  if (!/^https?:$/i.test(absolute.protocol)) return "";
  const base = safeUrl(baseUrl);
  if (!base) return "";
  if (!sameHost(base.hostname, absolute.hostname)) return "";
  if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|xml|json)$/i.test(absolute.pathname)) return "";
  absolute.hash = "";
  absolute.search = "";
  return absolute.toString();
}

function labelFromUrl(pageUrl: string) {
  const parsed = safeUrl(pageUrl);
  if (!parsed) return "page";
  const path = parsed.pathname.replace(/^\/+|\/+$/g, "");
  if (!path) return "home";
  return path
    .split("/")
    .slice(0, 2)
    .join(" ")
    .replace(/[-_]+/g, " ");
}

function extractSignalText(html: string) {
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
    .slice(0, 12)
    .map((match) => normalizeText(match[1]))
    .filter(Boolean);
  parts.push(...headings);

  const navLabels = Array.from(
    cleaned.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi),
  )
    .slice(0, 40)
    .map((match) => normalizeText(match[1]))
    .filter((label) => label.length >= 3 && label.length <= 70)
    .filter((label) => SERVICE_PAGE_SIGNAL_PATTERN.test(label));
  parts.push(...navLabels.slice(0, 10));

  const bodyText = normalizeText(cleaned.replace(/<[^>]+>/g, " "));
  if (bodyText) parts.push(bodyText.slice(0, 2100));

  return unique(parts)
    .map(normalizeText)
    .filter((value) => value.length > 0)
    .join(" | ");
}

function mergeSignalParts(parts: string[]) {
  return unique(parts.map((part) => normalizeText(part)).filter(Boolean)).join(" | ").slice(0, 7000);
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

function safeUrl(value: string, base?: string) {
  try {
    return base ? new URL(value, base) : new URL(value);
  } catch {
    return null;
  }
}

function canonicalizeUrl(value: string) {
  const parsed = safeUrl(value);
  if (!parsed) return "";
  parsed.hash = "";
  parsed.search = "";
  const normalizedPath =
    parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, "") : parsed.pathname;
  return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
}

function sameHost(a: string, b: string) {
  const normalize = (host: string) => host.toLowerCase().replace(/^www\./, "");
  return normalize(a) === normalize(b);
}

function clampNumber(value: number, min: number, max: number) {
  const numeric = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
