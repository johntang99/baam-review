"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { googleReviewUrl } from "@/lib/google/business-profile";
import { buildLocationSlug } from "@/lib/slug";
import { classifyByGoogleCategory } from "@/lib/review/google-category-mapping";
import { getStripe } from "@/lib/billing/stripe";
import { applyStripeSubscription } from "@/lib/billing/sync";
import { sendEmailViaResend } from "@/lib/messaging/resend";

export async function createLocationFromGoogle(formData: FormData) {
  const placeId = formData.get("place_id");
  const title = formData.get("title");
  const address = formData.get("address");
  const websiteUri = formData.get("website_uri");
  const primaryCategory = formData.get("primary_category");
  const customerRecordIdRaw = formData.get("customer_record_id");
  const customerRecordId =
    typeof customerRecordIdRaw === "string" && customerRecordIdRaw
      ? customerRecordIdRaw
      : null;

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

  // If this picker session came from the Onboarding queue, the customer's
  // Stripe subscription is already saved against a customer_records row.
  // Pull it now so we can bind the new location back and trigger billing
  // wire-up below.
  const service = createServiceClient();
  const customerRecord = customerRecordId
    ? (
        await service
          .from("customer_records")
          .select(
            "id, email, business_name, stripe_customer_id, stripe_subscription_id, onboarding_status, location_id",
          )
          .eq("id", customerRecordId)
          .maybeSingle()
      ).data
    : null;

  if (customerRecordId && !customerRecord) {
    throw new Error("Customer record not found");
  }
  // Guard against double-binding: if staff goes back and clicks again on a
  // queue row that's already been connected, fail loud instead of creating
  // a second location with the same paid sub.
  if (customerRecord?.location_id) {
    throw new Error(
      "This customer is already connected to a location. Refresh /app/onboarding.",
    );
  }

  const slug = buildLocationSlug(title);

  const { data: inserted, error } = await supabase
    .from("locations")
    .insert({
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
      // Auto-classify into a BAAM Review category bucket from Google's
      // primary-category string. Drives the trilingual service / quality
      // chip presets on /r/[slug]. Admin can override in location settings.
      review_category: classifyByGoogleCategory(
        typeof primaryCategory === "string" ? primaryCategory : null,
      ),
      // Save GBP's website URI to the dedicated `website_url` column — used
      // by /s/<advocate_id> as the "learn more" target for friends who land
      // on a recommendation card. `custom_url` stays free for owners to point
      // at alternate review platforms (Xiaohongshu, etc.).
      website_url: typeof websiteUri === "string" ? websiteUri || null : null,
      // Multilingual is the BAAM Review wedge — default all three on. Owner can
      // narrow this in Location Settings if their customer base is monolingual.
      default_language: "en",
      supported_languages: ["en", "zh", "es"],
      customer_record_id: customerRecord?.id ?? null,
    })
    .select("id, slug, display_name")
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to create location: ${error?.message ?? "unknown"}`);
  }

  // If this was a Start Now customer, finish the billing handoff: attach
  // account+location to the Stripe sub so future webhook events route to
  // location_subscriptions, then upsert the row immediately (don't wait on
  // a webhook fire), update the customer_record, and email the customer.
  if (customerRecord) {
    try {
      const stripe = getStripe();
      const updatedSub = await stripe.subscriptions.update(
        customerRecord.stripe_subscription_id,
        {
          metadata: {
            account_id: profile.account_id,
            location_id: inserted.id,
            plan: "full_service",
            interval: "month",
            source: "start_now_fullservice",
          },
        },
      );
      await applyStripeSubscription(updatedSub);
    } catch (e) {
      console.error(
        "[picker] Failed to wire Stripe sub to location",
        customerRecord.stripe_subscription_id,
        e,
      );
      // Don't roll back the location — staff can rerun reconcile manually.
    }

    await service
      .from("customer_records")
      .update({
        onboarding_status: "gbp_connected",
        location_id: inserted.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerRecord.id);

    // Best-effort customer email. Failure is logged, not fatal.
    try {
      await sendCustomerLiveEmail({
        to: customerRecord.email,
        businessName: customerRecord.business_name ?? inserted.display_name,
      });
    } catch (e) {
      console.warn("[picker] customer live email failed", e);
    }

    redirect("/app/onboarding");
  }

  redirect("/app/locations/connect/picker");
}

async function sendCustomerLiveEmail(opts: {
  to: string;
  businessName: string;
}) {
  const from = process.env.RESEND_FROM;
  if (!from) return;

  const lines = [
    `Good news — we've connected ${opts.businessName} to BAAM Review.`,
    "",
    "Your manager invite was accepted and your Google Business Profile is",
    "now linked. Over the next few days we'll:",
    "",
    "  • Configure the reward your team will offer reviewers",
    "  • Wire up automated replies in English / 中文 / Español",
    "  • Send the first review-request batch to your recent customers",
    "",
    "You don't need to do anything else right now. We'll email you when",
    "the first batch goes out and again after the first reviews land.",
    "",
    "Reply to this email anytime if you have questions.",
    "",
    "— The BAAM Review team",
  ];
  const text = lines.join("\n");
  await sendEmailViaResend({
    to: opts.to,
    subject: `${opts.businessName} is connected — we're taking it from here`,
    text,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:14px;line-height:1.65;color:#1A1F1C;max-width:560px">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>")}</div>`,
    replyTo: "baamplatform@gmail.com",
    from,
  });
}
