import "server-only";
import {
  CITIES,
  getCityBySlug,
  type CityEntry,
} from "./cities";
import {
  getPublishedContent,
  listPublishedContent,
} from "@/lib/admin/content";

/**
 * Async city resolver — merges DB editorial overrides with the code
 * registry. Used by `/local/[city]/page.tsx` and by sitemap city
 * enumeration so DB-only cities (added through /admin/cities without
 * a corresponding code entry) still get rendered.
 */
export async function resolveCity(slug: string): Promise<CityEntry | null> {
  const dbItem = await getPublishedContent("city_page", slug, "en").catch(
    () => null,
  );
  const registry = getCityBySlug(slug);

  if (!dbItem && !registry) return null;

  // Start from the registry (might be null), layer DB values over.
  const base: CityEntry = registry ?? {
    slug,
    displayName: slug,
    state: "",
    matchNames: [slug],
    intro: "",
    whyHere: "",
  };

  if (!dbItem) return base;

  const fm = dbItem.frontmatter as Record<string, unknown>;
  return {
    slug,
    displayName: (fm.displayName as string) || base.displayName,
    state: (fm.state as string) || base.state,
    postalCode: (fm.postalCode as string) || base.postalCode,
    matchNames: Array.isArray(fm.matchNames)
      ? (fm.matchNames as string[])
      : base.matchNames,
    intro: (fm.intro as string) || base.intro,
    whyHere: (fm.whyHere as string) || base.whyHere,
  };
}

/** All publishable city slugs (registry + DB), unique. */
export async function listAllCitySlugs(): Promise<string[]> {
  const dbItems = await listPublishedContent("city_page").catch(() => []);
  const slugs = new Set<string>([
    ...CITIES.map((c) => c.slug),
    ...dbItems.map((i) => i.slug),
  ]);
  return Array.from(slugs);
}
