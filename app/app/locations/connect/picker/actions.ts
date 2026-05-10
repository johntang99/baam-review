"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { googleReviewUrl } from "@/lib/google/business-profile";
import { buildLocationSlug } from "@/lib/slug";

export async function createLocationFromGoogle(formData: FormData) {
  const placeId = formData.get("place_id");
  const title = formData.get("title");
  const address = formData.get("address");
  const websiteUri = formData.get("website_uri");
  const primaryCategory = formData.get("primary_category");

  if (typeof placeId !== "string" || !placeId) {
    throw new Error("Missing Google place ID");
  }
  if (typeof title !== "string" || !title) {
    throw new Error("Missing location title");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/locations");

  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    throw new Error("No account for current user");
  }

  const slug = buildLocationSlug(title);

  const { error } = await supabase.from("locations").insert({
    account_id: profile.account_id,
    slug,
    google_place_id: placeId,
    google_review_url: googleReviewUrl(placeId),
    display_name: title,
    address: typeof address === "string" ? address || null : null,
    business_type:
      typeof primaryCategory === "string" && primaryCategory
        ? primaryCategory.toLowerCase()
        : null,
    custom_url: typeof websiteUri === "string" ? websiteUri || null : null,
  });

  if (error) {
    throw new Error(`Failed to create location: ${error.message}`);
  }

  redirect("/app/locations");
}
