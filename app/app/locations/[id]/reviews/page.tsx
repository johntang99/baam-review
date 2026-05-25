import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getInternalContext,
  canAccessLocation,
  getVisibleLocationIds,
} from "@/lib/auth/staff";
import { PageHeader } from "@/components/admin/page-header";
import { InContentLocationPicker } from "@/components/locations/in-content-location-picker";
import { ReviewsList } from "./reviews-list";

export const metadata = {
  title: "Google reviews — BAAM Review",
};

export const dynamic = "force-dynamic";

export default async function LocationReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/locations/${id}/reviews`);

  const internal = await getInternalContext(supabase, user.id);
  const allowed = await canAccessLocation(supabase, internal, id);
  if (!allowed) redirect("/app/locations");
  const visibleIds = await getVisibleLocationIds(supabase, internal);

  let locationsQuery = supabase
    .from("locations")
    .select("id, display_name, brand_color, logo_url")
    .order("created_at", { ascending: false });
  if (visibleIds !== null) {
    locationsQuery = locationsQuery.in(
      "id",
      visibleIds.length > 0
        ? visibleIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  }
  const [{ data: location }, { data: locations }] = await Promise.all([
    supabase
      .from("locations")
      .select("id, slug, display_name, google_resource_name, reviews_synced_at")
      .eq("id", id)
      .maybeSingle(),
    locationsQuery,
  ]);
  if (!location) notFound();

  const { data: reviews } = await supabase
    .from("google_reviews")
    .select(
      "id, google_review_id, reviewer_display_name, reviewer_profile_photo_url, rating, comment, review_create_time, reply_comment, reply_update_time, alerted_at",
    )
    .eq("location_id", location.id)
    .order("review_create_time", { ascending: false });

  return (
    <main className="px-10 py-10">
      <div className="max-w-3xl space-y-6">
        <div className="space-y-3">
          <Link
            href="/app/locations"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-text-soft hover:text-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All locations
          </Link>
          <InContentLocationPicker
            locations={locations ?? []}
            currentId={location.id}
          />
        </div>
        <div>
          <PageHeader
            eyebrow="Google reviews"
            title={location.display_name}
            description={
              location.google_resource_name
                ? "Reviews fetched from Google Business Profile. Sync pulls the latest; 1- and 2-star reviews fire an email alert."
                : "We'll resolve this location's Google resource on first sync."
            }
          />
        </div>

        <ReviewsList
          locationId={location.id}
          reviews={reviews ?? []}
          reviewsSyncedAt={location.reviews_synced_at}
        />
      </div>
    </main>
  );
}
