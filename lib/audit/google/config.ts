import "server-only";

export interface AuditGoogleConfig {
  googlePlacesApiKey: string;
  outscraperApiKey: string;
  cacheTtlFreeMs: number;
  cacheTtlPaidMs: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function getAuditGoogleConfig(): AuditGoogleConfig {
  const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;
  const outscraperApiKey = process.env.OUTSCRAPER_API_KEY;

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
    cacheTtlPaidMs: 1 * ONE_DAY_MS,
  };
}
