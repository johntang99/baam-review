import "server-only";

export interface AuditGoogleConfig {
  googlePlacesApiKey: string;
  outscraperApiKey: string;
  cacheTtlFreeMs: number;
  cacheTtlPaidMs: number;
  strictPaidReviewHistory: boolean;
  competitorOutscraperTimeoutMs: number;
  competitorBackgroundRefreshAgeMs: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function getAuditGoogleConfig(): AuditGoogleConfig {
  const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;
  const outscraperApiKey = process.env.OUTSCRAPER_API_KEY;
  const strictPaidReviewHistory = parseBooleanEnv(
    process.env.AUDIT_STRICT_REVIEW_HISTORY,
  );
  const competitorOutscraperTimeoutMs = parseBoundedIntEnv(
    process.env.AUDIT_COMPETITOR_OUTSCRAPER_TIMEOUT_MS,
    60_000,
    15_000,
    180_000,
  );
  const cacheTtlPaidHours = parseBoundedIntEnv(
    process.env.AUDIT_CACHE_TTL_PAID_HOURS,
    72,
    24,
    168,
  );
  const competitorBackgroundRefreshAgeHours = parseBoundedIntEnv(
    process.env.AUDIT_COMPETITOR_BG_REFRESH_AGE_HOURS,
    12,
    1,
    72,
  );

  if (!googlePlacesApiKey) {
    throw new Error("getAuditGoogleConfig: GOOGLE_PLACES_API_KEY is not set");
  }
  if (!outscraperApiKey) {
    throw new Error("getAuditGoogleConfig: OUTSCRAPER_API_KEY is not set");
  }

  return {
    googlePlacesApiKey,
    outscraperApiKey,
    cacheTtlFreeMs: 7 * ONE_DAY_MS,
    cacheTtlPaidMs: cacheTtlPaidHours * 60 * 60 * 1000,
    strictPaidReviewHistory,
    competitorOutscraperTimeoutMs,
    competitorBackgroundRefreshAgeMs:
      competitorBackgroundRefreshAgeHours * 60 * 60 * 1000,
  };
}

function parseBooleanEnv(raw: string | undefined): boolean {
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function parseBoundedIntEnv(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return Math.min(max, Math.max(min, rounded));
}
