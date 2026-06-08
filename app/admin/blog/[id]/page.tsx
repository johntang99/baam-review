import { notFound } from "next/navigation";
import { getContentItemAdmin } from "@/lib/admin/content";
import { BlogPostEditor } from "./editor";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * /admin/blog/<id> — editor for a single blog post. Server fetches
 * the row, hands it off to a client component that owns the form
 * state + markdown preview + save logic.
 */
export default async function AdminBlogEditPage({ params }: RouteParams) {
  const { id } = await params;
  const post = await getContentItemAdmin(id);
  if (!post || post.kind !== "blog_post") notFound();

  return <BlogPostEditor initial={post} />;
}
