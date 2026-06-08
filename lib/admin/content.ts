import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pingIndexNowForPath } from "@/lib/seo/indexnow";

/**
 * Content data layer for the marketing/SEO admin. Backed by the
 * content_items table (migration 0049). Reads use whichever client the
 * caller passes — RLS keeps customers out for the authed client; the
 * service client bypasses RLS for public renderers.
 *
 * Why the public renderers (e.g. blog post page) read via service-role
 * rather than the cookie-bound client: anonymous visitors have no
 * session and would 0-row their queries under our RLS policy. Using
 * service-role for public reads is safe because we only ever select
 * `status='published'` rows, which are explicitly meant to be public.
 */

export type ContentKind =
  | "blog_post"
  | "case_study"
  | "city_page"
  | "marketing_page";

export type ContentStatus = "draft" | "published";

export type ContentLocale = "en" | "zh";

export interface ContentItem {
  id: string;
  kind: ContentKind;
  slug: string;
  locale: ContentLocale;
  frontmatter: Record<string, unknown>;
  body: string;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
}

interface RawRow {
  id: string;
  kind: string;
  slug: string;
  locale: string;
  frontmatter: Record<string, unknown> | null;
  body: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
}

function rowToItem(r: RawRow): ContentItem {
  return {
    id: r.id,
    kind: r.kind as ContentKind,
    slug: r.slug,
    locale: (r.locale as ContentLocale) ?? "en",
    frontmatter: r.frontmatter ?? {},
    body: r.body ?? "",
    status: r.status as ContentStatus,
    created_at: r.created_at,
    updated_at: r.updated_at,
    created_by: r.created_by,
    updated_by: r.updated_by,
    published_at: r.published_at,
  };
}

// ============================================================
// ADMIN-SIDE READS (authed staff, RLS-bound)
// ============================================================

/** List all items of a given kind (any status). Admin lists call this. */
export async function listContentItemsAdmin(
  kind: ContentKind,
  options: { locale?: ContentLocale } = {},
): Promise<ContentItem[]> {
  const supabase = await createClient();
  // Cast through unknown — generated DB types don't include the
  // content_items table until `supabase gen types` runs after the
  // migration is applied. Same pattern used throughout this codebase
  // for fresh tables.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: RawRow[] | null; error: { message: string } | null }>;
          eq?: (col: string, val: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: RawRow[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };

  if (options.locale) {
    const q = sb.from("content_items").select("*").eq("kind", kind);
    // chained eq for locale
    const second = (q.eq as unknown as (
      col: string,
      val: string,
    ) => {
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => Promise<{ data: RawRow[] | null; error: { message: string } | null }>;
    })("locale", options.locale);
    const { data, error } = await second.order("updated_at", {
      ascending: false,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToItem);
  }

  const { data, error } = await sb
    .from("content_items")
    .select("*")
    .eq("kind", kind)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToItem);
}

/** Read one item by id. Returns null if missing or RLS-hidden. */
export async function getContentItemAdmin(
  id: string,
): Promise<ContentItem | null> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: RawRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data, error } = await sb
    .from("content_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToItem(data) : null;
}

// ============================================================
// ADMIN-SIDE WRITES (authed staff, RLS-bound)
// ============================================================

export interface ContentItemInput {
  kind: ContentKind;
  slug: string;
  locale: ContentLocale;
  frontmatter: Record<string, unknown>;
  body: string;
  status: ContentStatus;
}

export async function createContentItem(
  input: ContentItemInput,
  userId: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      insert: (row: Record<string, unknown>) => {
        select: (cols: string) => {
          maybeSingle: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data, error } = await sb
    .from("content_items")
    .insert({
      kind: input.kind,
      slug: input.slug.trim(),
      locale: input.locale,
      frontmatter: input.frontmatter,
      body: input.body,
      status: input.status,
      published_at: input.status === "published" ? new Date().toISOString() : null,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "insert returned no row" };

  await onContentMutation(input.kind, input.slug);
  return { ok: true, id: data.id };
}

export interface ContentItemPatch {
  slug?: string;
  locale?: ContentLocale;
  frontmatter?: Record<string, unknown>;
  body?: string;
  status?: ContentStatus;
}

export async function updateContentItem(
  id: string,
  patch: ContentItemPatch,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (
          col: string,
          val: string,
        ) => {
          select: (cols: string) => {
            maybeSingle: () => Promise<{
              data: { id: string; kind: string; slug: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };

  // If we're newly publishing, stamp published_at. If demoting to draft,
  // leave published_at alone (it remains as a last-published marker).
  const row: Record<string, unknown> = {
    ...patch,
    updated_by: userId,
  };
  if (patch.status === "published") {
    row.published_at = new Date().toISOString();
  }

  const { data, error } = await sb
    .from("content_items")
    .update(row)
    .eq("id", id)
    .select("id, kind, slug")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_found_or_forbidden" };

  await onContentMutation(data.kind as ContentKind, data.slug);
  return { ok: true };
}

export async function deleteContentItem(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (
          col: string,
          val: string,
        ) => {
          select: (cols: string) => {
            maybeSingle: () => Promise<{
              data: { kind: string; slug: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };
  const { data, error } = await sb
    .from("content_items")
    .delete()
    .eq("id", id)
    .select("kind, slug")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_found_or_forbidden" };

  await onContentMutation(data.kind as ContentKind, data.slug);
  return { ok: true };
}

// ============================================================
// PUBLIC-SIDE READS (service-role, status=published only)
// ============================================================

/** List all published items of a given kind. Used by public renderers
 *  (blog index, case-studies page, etc). */
export async function listPublishedContent(
  kind: ContentKind,
  options: { locale?: ContentLocale } = {},
): Promise<ContentItem[]> {
  const supabase = createServiceClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => unknown;
      };
    };
  };

  // Chain manually so we can layer `.eq('locale', ...)` only when set.
  let query = sb
    .from("content_items")
    .select("*")
    .eq("kind", kind) as unknown as {
    eq: (
      col: string,
      val: string,
    ) => {
      eq: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{
          data: RawRow[] | null;
          error: { message: string } | null;
        }>;
      };
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => Promise<{
        data: RawRow[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  let filtered = query.eq("status", "published");
  if (options.locale) {
    filtered = (filtered.eq as unknown as (
      col: string,
      val: string,
    ) => typeof filtered)("locale", options.locale);
  }

  const { data, error } = await filtered.order("published_at", {
    ascending: false,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToItem);
}

/** Read one published item by (kind, slug, locale). */
export async function getPublishedContent(
  kind: ContentKind,
  slug: string,
  locale: ContentLocale = "en",
): Promise<ContentItem | null> {
  const supabase = createServiceClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          eq: (
            col: string,
            val: string,
          ) => {
            eq: (
              col: string,
              val: string,
            ) => {
              eq: (
                col: string,
                val: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: RawRow | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        };
      };
    };
  };
  const { data, error } = await sb
    .from("content_items")
    .select("*")
    .eq("kind", kind)
    .eq("slug", slug)
    .eq("locale", locale)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToItem(data) : null;
}

// ============================================================
// CACHE INVALIDATION on mutation
// ============================================================

/** Call after any write so Next.js's data cache invalidates the
 *  pages that depend on this content. We use revalidatePath rather
 *  than tag-based invalidation because none of our public pages use
 *  the `fetch({ next: { tags } })` pattern — they all read directly
 *  from Supabase, so path-based invalidation is what actually
 *  refreshes the rendered HTML.
 *
 *  IndexNow ping happens alongside revalidation — Bing (and via
 *  Bing, ChatGPT/Copilot) gets notified of the URL change within
 *  seconds. The ping is fire-and-forget and never throws, so a Bing
 *  outage doesn't break the publish flow. */
async function onContentMutation(kind: ContentKind, slug: string) {
  // Paths that need revalidation + IndexNow notification per kind.
  // Listed once and looped to keep the two side-effects in sync.
  const paths: string[] = [];

  switch (kind) {
    case "blog_post":
      paths.push("/blog", `/blog/${slug}`);
      break;
    case "case_study":
      // /case-studies renders cards from all published case studies,
      // so any case-study save affects the index page (no per-slug
      // public path exists).
      paths.push("/case-studies");
      break;
    case "city_page":
      paths.push(`/local/${slug}`);
      break;
    case "marketing_page":
      // Marketing slugs map directly to public paths (about → /about).
      paths.push(`/${slug}`);
      break;
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  // IndexNow ping — fire and forget. We don't await Promise.all here
  // because we don't want a slow Bing API to make the admin save feel
  // slow; the ping resolves in the background. Errors are logged
  // inside pingIndexNowForPath.
  for (const path of paths) {
    pingIndexNowForPath(path).catch(() => {
      /* logged inside helper */
    });
  }
}
