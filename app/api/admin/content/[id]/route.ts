import { NextResponse } from "next/server";
import {
  deleteContentItem,
  updateContentItem,
  type ContentLocale,
  type ContentStatus,
} from "@/lib/admin/content";
import { requireBaamInternalApi } from "@/lib/admin/auth-guard";

export const runtime = "nodejs";

interface PatchBody {
  slug?: string;
  locale?: string;
  frontmatter?: unknown;
  body?: string;
  status?: string;
}

/**
 * PATCH /api/admin/content/<id> — update an existing content item.
 *
 * Partial-update semantics: only the fields present in the payload
 * are touched. The data layer auto-stamps `updated_at` and
 * `updated_by`; if status flips to 'published' for the first time,
 * `published_at` is also stamped.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireBaamInternalApi();
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status },
    );
  }
  const { id } = await params;

  let payload: PatchBody;
  try {
    payload = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (payload.slug !== undefined) {
    const slug = payload.slug.trim();
    if (!slug) {
      return NextResponse.json(
        { error: "slug cannot be empty" },
        { status: 400 },
      );
    }
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
      return NextResponse.json(
        { error: "slug must be alphanumeric with dashes" },
        { status: 400 },
      );
    }
    patch.slug = slug;
  }
  if (payload.locale !== undefined) {
    if (payload.locale !== "en" && payload.locale !== "zh") {
      return NextResponse.json(
        { error: "locale must be 'en' or 'zh'" },
        { status: 400 },
      );
    }
    patch.locale = payload.locale as ContentLocale;
  }
  if (payload.frontmatter !== undefined) {
    if (
      payload.frontmatter === null ||
      typeof payload.frontmatter !== "object"
    ) {
      return NextResponse.json(
        { error: "frontmatter must be an object" },
        { status: 400 },
      );
    }
    patch.frontmatter = payload.frontmatter as Record<string, unknown>;
  }
  if (payload.body !== undefined) patch.body = payload.body;
  if (payload.status !== undefined) {
    if (payload.status !== "draft" && payload.status !== "published") {
      return NextResponse.json(
        { error: "status must be 'draft' or 'published'" },
        { status: 400 },
      );
    }
    patch.status = payload.status as ContentStatus;
  }

  const result = await updateContentItem(id, patch, guard.userId);
  if (!result.ok) {
    const message = result.error?.includes("duplicate")
      ? "A post with that slug already exists for this locale."
      : result.error === "not_found_or_forbidden"
        ? "Not found."
        : (result.error ?? "Update failed.");
    const status = result.error === "not_found_or_forbidden" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/content/<id> — permanently remove. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireBaamInternalApi();
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status },
    );
  }
  const { id } = await params;

  const result = await deleteContentItem(id);
  if (!result.ok) {
    const status = result.error === "not_found_or_forbidden" ? 404 : 400;
    return NextResponse.json(
      { error: result.error ?? "Delete failed." },
      { status },
    );
  }
  return NextResponse.json({ ok: true });
}
