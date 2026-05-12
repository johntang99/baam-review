import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { ShareBuilder } from "./share-builder";

export const metadata = { title: "Share review — BAAM Review" };

export default async function ShareReviewPage({
  params,
}: {
  params: Promise<{ id: string; reviewId: string }>;
}) {
  const { id, reviewId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/locations/${id}/reviews/${reviewId}/share`);

  // RLS scopes both queries to the user's account.
  const [{ data: location }, { data: review }] = await Promise.all([
    supabase
      .from("locations")
      .select("id, slug, display_name, brand_color, default_share_theme")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("google_reviews")
      .select(
        "id, google_review_id, reviewer_display_name, rating, comment, review_create_time",
      )
      .eq("id", reviewId)
      .maybeSingle(),
  ]);

  if (!location || !review) notFound();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://review.baamplatform.com";

  return (
    <main className="px-10 py-10">
      <div className="max-w-5xl space-y-6">
        <Link
          href={`/app/locations/${location.id}/reviews`}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-soft hover:text-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to reviews
        </Link>

        <PageHeader
          eyebrow={`${review.rating}-star review`}
          title="Share this review"
          description="Pick a theme and size, then download or copy the image URL. Use square for Instagram and Xiaohongshu, story for Stories and TikTok, OG for link previews."
        />

        <ShareBuilder
          appUrl={appUrl}
          locationId={location.id}
          locationName={location.display_name}
          brandColor={location.brand_color ?? "#1F4D3F"}
          defaultTheme={location.default_share_theme ?? "warm-clinic"}
          review={{
            id: review.id,
            googleReviewId: review.google_review_id,
            reviewerName: review.reviewer_display_name,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.review_create_time,
          }}
        />
      </div>
    </main>
  );
}
