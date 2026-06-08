import { notFound } from "next/navigation";
import {
  getContentItemAdmin,
  listContentItemsAdmin,
  type ContentItem,
} from "@/lib/admin/content";
import { getMarketingPageDef } from "@/lib/seo/marketing-pages";
import { MarketingPageEditor } from "./editor";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Marketing page editor route. Looks up the page definition by slug,
 * then finds (or creates) the DB row that backs it. The editor is
 * always rendered with both the static field definition + the
 * stored values; this means a freshly-defined page is editable
 * immediately, with all fields empty.
 *
 * Auto-provision: if no DB row exists yet for a registered page slug,
 * we redirect to a separate create endpoint via a POST so that
 * subsequent edits go through the standard PATCH flow rather than
 * needing a different "first save creates" branch.
 */
export default async function AdminMarketingEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const def = getMarketingPageDef(slug);
  if (!def) notFound();

  // We look up by slug rather than id since marketing pages have a
  // 1:1 mapping (slug ↔ DB row). Listing all is cheap (few rows).
  const all = await listContentItemsAdmin("marketing_page");
  let item: ContentItem | null = all.find((i) => i.slug === slug) ?? null;

  if (!item) {
    // Auto-create the row so the editor can PATCH it on save. We
    // redirect to a tiny server action route that handles the
    // creation, then bounces back here. Inline creation can't happen
    // in a server component because revalidatePath inside a write
    // would conflict with the render pass.
    redirect(`/admin/marketing/${slug}/bootstrap`);
  } else {
    // Refetch fresh to satisfy editor's preference for the full item.
    item = (await getContentItemAdmin(item.id)) ?? item;
  }

  return <MarketingPageEditor def={def} initial={item} />;
}
