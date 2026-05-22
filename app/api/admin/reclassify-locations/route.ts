/**
 * Backfill locations.review_category by re-running classifyByGoogleCategory
 * on the existing locations.business_type values.
 *
 * Existed because locations created before migration 0026 (or before
 * auto-classification shipped in the picker action) all default to 'other'.
 * This endpoint reuses the same TypeScript classifier the picker uses so
 * the mapping logic doesn't drift.
 *
 * - Scoped to the calling user's account_id (RLS plus an explicit filter).
 * - Idempotent: only touches rows where review_category is still 'other'
 *   AND business_type is non-null. Manual overrides are preserved.
 * - Read-only on rows the classifier can't place.
 *
 * Usage:
 *   POST /api/admin/reclassify-locations
 *   Returns: { updated: number, skipped: number, total: number, results: [...] }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyByGoogleCategory } from "@/lib/review/google-category-mapping";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Scope to the caller's account.
  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "No account" }, { status: 403 });
  }

  const { data: locations, error } = await supabase
    .from("locations")
    .select("id, display_name, business_type, review_category")
    .eq("account_id", profile.account_id)
    .eq("review_category", "other");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updated = 0;
  let skipped = 0;
  const results: Array<{
    id: string;
    name: string;
    business_type: string | null;
    from: string;
    to: string;
    changed: boolean;
  }> = [];

  for (const loc of locations ?? []) {
    if (!loc.business_type) {
      skipped++;
      results.push({
        id: loc.id,
        name: loc.display_name,
        business_type: null,
        from: loc.review_category,
        to: loc.review_category,
        changed: false,
      });
      continue;
    }

    const classified = classifyByGoogleCategory(loc.business_type);
    if (classified === "other") {
      skipped++;
      results.push({
        id: loc.id,
        name: loc.display_name,
        business_type: loc.business_type,
        from: loc.review_category,
        to: classified,
        changed: false,
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from("locations")
      .update({ review_category: classified })
      .eq("id", loc.id);

    if (updateError) {
      results.push({
        id: loc.id,
        name: loc.display_name,
        business_type: loc.business_type,
        from: loc.review_category,
        to: `ERROR: ${updateError.message}`,
        changed: false,
      });
      skipped++;
      continue;
    }

    updated++;
    results.push({
      id: loc.id,
      name: loc.display_name,
      business_type: loc.business_type,
      from: loc.review_category,
      to: classified,
      changed: true,
    });
  }

  return NextResponse.json({
    updated,
    skipped,
    total: locations?.length ?? 0,
    results,
  });
}
