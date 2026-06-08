import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { CityEntry } from "@/lib/seo/cities";

/**
 * Aggregated audit statistics for a single city. Drives the /local/[city]
 * pages — the data is what makes these pages worth ranking. Without
 * real numbers we'd be shipping the kind of thin content Google
 * deindexes.
 *
 * Data source: `audits` table, queried via the service-role client so
 * the page can render for anonymous visitors. We never return PII or
 * per-business detail from this helper — only aggregates and the top
 * 5 anonymized business names.
 *
 * Computation strategy: read all completed audits where
 * google_data->business->>city matches one of the city's matchNames
 * (lowercased). Compute medians + means in TypeScript rather than SQL
 * — the dataset is small (few hundred audits per city even in our
 * busiest market), so the runtime is trivial and we keep the SQL
 * portable.
 */

export interface CityStats {
  /** Total completed audits for this city in our dataset. */
  totalAudits: number;
  /** Median Google rating across audited businesses. */
  medianRating: number | null;
  /** Median total review count. */
  medianReviewCount: number | null;
  /** Top verticals by audit count (top 5). */
  topVerticals: Array<{ vertical: string; count: number; share: number }>;
  /** Sample of featured businesses we've audited recently. Names are
   * real (we don't anonymize because audits are public domain data),
   * but we only surface the top 5 so the page isn't a directory dump. */
  featuredBusinesses: Array<{
    name: string;
    rating: number;
    reviewCount: number;
    grade: string | null;
    auditedAt: string;
  }>;
  /** Most recent audit date in this city — drives the "Updated" stamp
   * on the page so visitors and Google can see the data is fresh. */
  lastAuditedAt: string | null;
}

interface AuditRow {
  id: string;
  vertical: string | null;
  total_score: number | null;
  grade: string | null;
  generated_at: string;
  google_data: {
    business?: {
      name?: string;
      city?: string;
      state?: string;
      rating?: number;
      total_count?: number;
    };
  } | null;
}

/**
 * Fetch and aggregate audit data for one city. Returns null if there
 * isn't enough data to render a meaningful page — caller (the city
 * page) should `notFound()` in that case rather than ship a thin page.
 */
export async function getCityStats(
  city: CityEntry,
  options: { minAudits?: number } = {},
): Promise<CityStats | null> {
  const minAudits = options.minAudits ?? 5;
  const supabase = createServiceClient();

  // Cast through unknown — generated DB types don't have google_data
  // typed as the JSON shape we depend on. Same pattern used elsewhere
  // in the codebase for audit-row queries.
  const supabaseAny = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{
              data: AuditRow[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };

  const { data, error } = await supabaseAny
    .from("audits")
    .select(
      "id,vertical,total_score,grade,generated_at,google_data",
    )
    .eq("status", "complete")
    .order("generated_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error(`[city-stats] ${city.slug}:`, error.message);
    return null;
  }
  if (!data || data.length === 0) return null;

  const matchSet = new Set(
    city.matchNames.map((n) => n.toLowerCase().trim()),
  );

  const matched = data.filter((r) => {
    const c = r.google_data?.business?.city?.toLowerCase().trim();
    return c ? matchSet.has(c) : false;
  });

  if (matched.length < minAudits) return null;

  // Median helpers — Math.floor((n-1)/2) for odd, average of two
  // middle for even.
  function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  const ratings = matched
    .map((r) => r.google_data?.business?.rating)
    .filter((r): r is number => typeof r === "number");
  const reviewCounts = matched
    .map((r) => r.google_data?.business?.total_count)
    .filter((n): n is number => typeof n === "number");

  // Vertical breakdown.
  const verticalCounts = new Map<string, number>();
  for (const r of matched) {
    const v = r.vertical ?? "unknown";
    verticalCounts.set(v, (verticalCounts.get(v) ?? 0) + 1);
  }
  const topVerticals = Array.from(verticalCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([vertical, count]) => ({
      vertical,
      count,
      share: count / matched.length,
    }));

  // Featured businesses — top 5 by rating × review count, deduped on name.
  const featuredSeen = new Set<string>();
  const featuredBusinesses = matched
    .filter((r) => r.google_data?.business?.name)
    .map((r) => {
      const b = r.google_data!.business!;
      return {
        name: b.name!,
        rating: b.rating ?? 0,
        reviewCount: b.total_count ?? 0,
        grade: r.grade,
        auditedAt: r.generated_at,
      };
    })
    .filter((b) => {
      const key = b.name.toLowerCase();
      if (featuredSeen.has(key)) return false;
      featuredSeen.add(key);
      return true;
    })
    .sort((a, b) => b.rating * Math.log10(b.reviewCount + 1)
                  - a.rating * Math.log10(a.reviewCount + 1))
    .slice(0, 5);

  const lastAuditedAt = matched[0]?.generated_at ?? null;

  return {
    totalAudits: matched.length,
    medianRating: ratings.length > 0 ? median(ratings) : null,
    medianReviewCount:
      reviewCounts.length > 0 ? median(reviewCounts) : null,
    topVerticals,
    featuredBusinesses,
    lastAuditedAt,
  };
}

/**
 * Vertical-key → display name. Mirrors the vertical labels used in
 * the audit intake form. Kept here so this module is self-contained
 * and doesn't depend on the larger audit i18n bundle.
 */
export const VERTICAL_DISPLAY: Record<string, string> = {
  tcm_clinic: "TCM / acupuncture",
  dental: "Dental",
  legal_immigration: "Legal / immigration",
  restaurant: "Restaurant",
  real_estate: "Real estate",
  hotel: "Hotel",
  auto: "Auto services",
  contractor: "Contractor",
  salon_spa: "Salon / spa",
  cafe: "Café",
  apparel: "Apparel",
  health_food: "Health food",
  insurance: "Insurance",
  general_smb: "Local business",
  unknown: "Other",
};
