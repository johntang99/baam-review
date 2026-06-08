import { redirect } from "next/navigation";
import { requireBaamInternal } from "@/lib/admin/auth-guard";
import { createContentItem } from "@/lib/admin/content";
import { getMarketingPageDef } from "@/lib/seo/marketing-pages";

export const dynamic = "force-dynamic";

/**
 * One-shot route that creates the DB row for a registered marketing
 * page slug if it doesn't exist yet, then redirects to the editor.
 * Centralizes the "auto-provision on first visit" behavior so the
 * editor itself doesn't need a special first-save branch.
 */
export default async function MarketingPageBootstrap({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const def = getMarketingPageDef(slug);
  if (!def) redirect("/admin/marketing");

  const internal = await requireBaamInternal();

  await createContentItem(
    {
      kind: "marketing_page",
      slug,
      locale: "en",
      frontmatter: Object.fromEntries(
        def.fields.map((f) => [f.key, ""]),
      ),
      body: "",
      status: "draft",
    },
    internal.userId,
  );

  redirect(`/admin/marketing/${slug}`);
}
