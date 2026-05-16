"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { recordListLifecycle } from "@/lib/lists/track";
import { isLanguage, type Language } from "@/lib/i18n/review";
import type { Database } from "@/lib/database.types";

type FeedbackInsert = Database["public"]["Tables"]["private_feedback"]["Insert"];

export async function submitPrivateFeedback(formData: FormData) {
  const slug = readString(formData, "slug");
  const message = readString(formData, "message");
  if (!slug) throw new Error("Missing location reference");
  if (!message) throw new Error("Message is required");

  const supabase = createServiceClient();

  const { data: location } = await supabase
    .from("locations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!location) throw new Error("Location not found");

  const ratingRaw = readString(formData, "rating");
  const rating =
    ratingRaw && /^[1-5]$/.test(ratingRaw) ? Number(ratingRaw) : null;

  const langRaw = readString(formData, "lang");
  const language: Language = isLanguage(langRaw) ? langRaw : "en";

  const token = readString(formData, "token");
  let request_id: string | null = null;
  if (token) {
    const { data: r } = await supabase
      .from("review_requests")
      .select("id, location_id")
      .eq("tracking_token", token)
      .maybeSingle();
    if (r && r.location_id === location.id) request_id = r.id;
  }

  const payload: FeedbackInsert = {
    location_id: location.id,
    request_id,
    message,
    rating,
    language,
    contact_email: readString(formData, "email"),
    contact_phone: readString(formData, "phone"),
  };

  const { error } = await supabase.from("private_feedback").insert(payload);
  if (error) throw new Error(error.message);

  // Track + mark request completed.
  await supabase.from("landing_events").insert({
    location_id: location.id,
    request_id,
    event_type: "private_feedback_submitted",
    language,
    metadata: { rating, has_contact: !!(payload.contact_email || payload.contact_phone) },
  });

  if (request_id) {
    await supabase
      .from("review_requests")
      .update({
        completed_platform: "private_feedback",
        completed_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .is("completed_at", null);

    // PG2: a private-feedback leaver has acted on the ask — mark the linked
    // list_customer reviewed so it drops out of resend eligibility.
    await recordListLifecycle(supabase, request_id, "reviewed");
  }

  redirect(`/r/${slug}/thank-you?via=private&lang=${language}`);
}

function readString(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}
