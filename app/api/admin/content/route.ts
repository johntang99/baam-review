import { NextResponse } from "next/server";
import {
  createContentItem,
  type ContentKind,
  type ContentLocale,
  type ContentStatus,
} from "@/lib/admin/content";
import { requireBaamInternalApi } from "@/lib/admin/auth-guard";

export const runtime = "nodejs";

const ALLOWED_KINDS: ContentKind[] = [
  "blog_post",
  "case_study",
  "city_page",
  "marketing_page",
];

interface CreateBody {
  kind?: string;
  slug?: string;
  locale?: string;
  frontmatter?: unknown;
  body?: string;
  status?: string;
}

/**
 * POST /api/admin/content — create a new content item.
 *
 * Returns `{ id }` on success so the client can redirect into the
 * editor for the new row. All validation happens here; the data layer
 * trusts its inputs.
 */
export async function POST(request: Request) {
  const guard = await requireBaamInternalApi();
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status },
    );
  }

  let payload: CreateBody;
  try {
    payload = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const kind = payload.kind as ContentKind | undefined;
  if (!kind || !ALLOWED_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: "kind must be one of: " + ALLOWED_KINDS.join(", ") },
      { status: 400 },
    );
  }

  const slug = (payload.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    return NextResponse.json(
      { error: "slug must be alphanumeric with dashes" },
      { status: 400 },
    );
  }

  const locale = (payload.locale ?? "en") as ContentLocale;
  if (locale !== "en" && locale !== "zh") {
    return NextResponse.json(
      { error: "locale must be 'en' or 'zh'" },
      { status: 400 },
    );
  }

  const status = (payload.status ?? "draft") as ContentStatus;
  if (status !== "draft" && status !== "published") {
    return NextResponse.json(
      { error: "status must be 'draft' or 'published'" },
      { status: 400 },
    );
  }

  const frontmatter =
    payload.frontmatter && typeof payload.frontmatter === "object"
      ? (payload.frontmatter as Record<string, unknown>)
      : {};

  const result = await createContentItem(
    {
      kind,
      slug,
      locale,
      frontmatter,
      body: payload.body ?? "",
      status,
    },
    guard.userId,
  );

  if (!result.ok) {
    // Most likely cause of a server-side rejection: unique-index
    // violation on (kind, slug, locale). Surface a useful message.
    const message = result.error?.includes("duplicate")
      ? "A post with that slug already exists for this locale."
      : (result.error ?? "Couldn't create.");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ id: result.id });
}
