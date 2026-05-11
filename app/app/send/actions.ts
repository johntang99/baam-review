"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateTrackingToken } from "@/lib/tokens";
import { buildSmsBody, buildEmail } from "@/lib/messaging/templates";
import { sendSmsViaTwilio, isTwilioConfigured } from "@/lib/messaging/twilio";
import { sendEmailViaResend } from "@/lib/messaging/resend";
import { checkVelocity } from "@/lib/messaging/velocity";
import { isLanguage, type Language } from "@/lib/i18n/review";

export interface SendResult {
  ok: boolean;
  error?: string;
  requestId?: string;
  flagged?: boolean;
  trackingUrl?: string;
}

export async function sendReviewRequest(formData: FormData): Promise<SendResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) {
    return { ok: false, error: "No account for current user." };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("suspended_at, name")
    .eq("id", profile.account_id)
    .maybeSingle();
  if (account?.suspended_at) {
    return { ok: false, error: "This account is currently suspended." };
  }

  const locationId = getString(formData, "location_id");
  const recipientName = getString(formData, "recipient_name");
  const channelRaw = getString(formData, "channel");
  const recipientPhone = getString(formData, "recipient_phone");
  const recipientEmail = getString(formData, "recipient_email");
  const langRaw = getString(formData, "language");

  if (!locationId) return { ok: false, error: "Pick a location." };
  if (!recipientName) return { ok: false, error: "Customer name is required." };
  if (channelRaw !== "sms" && channelRaw !== "email") {
    return { ok: false, error: "Pick a channel (SMS or email)." };
  }
  const channel = channelRaw;
  const language: Language = isLanguage(langRaw) ? langRaw : "en";

  if (channel === "sms" && !recipientPhone) {
    return { ok: false, error: "Phone number is required for SMS." };
  }
  if (channel === "email" && !recipientEmail) {
    return { ok: false, error: "Email is required." };
  }
  if (channel === "sms" && !isTwilioConfigured()) {
    return {
      ok: false,
      error: "SMS is not configured yet (Twilio keys missing). Use email for now.",
    };
  }

  // Fetch location via RLS-typed client to verify ownership.
  const { data: location } = await supabase
    .from("locations")
    .select(
      "id, slug, display_name, default_language, supported_languages, sender_email, sender_name, sender_verified_at",
    )
    .eq("id", locationId)
    .maybeSingle();
  if (!location) return { ok: false, error: "Location not found." };

  const velocity = await checkVelocity(location.id);
  if (velocity.kind === "block") {
    return {
      ok: false,
      error: `Send blocked: too many requests (${velocity.current}/${velocity.limit} in the last ${velocity.reason === "velocity:hourly" ? "hour" : "24h"}). Slow down and try again later.`,
    };
  }

  const token = generateTrackingToken();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4001";
  const trackingUrl = `${appUrl}/r/${location.slug}?t=${token}`;

  const vars = {
    name: recipientName,
    businessName: location.display_name,
    link: trackingUrl,
  };

  let messageBody: string;
  let providerId: string | null = null;
  let sendError: string | null = null;

  if (channel === "sms") {
    const { body } = buildSmsBody(language, vars);
    messageBody = body;
    const r = await sendSmsViaTwilio({
      to: recipientPhone!,
      body,
      statusCallback: `${appUrl}/api/webhooks/twilio`,
    });
    providerId = r.providerId;
    sendError = r.error;
  } else {
    const email = buildEmail(language, vars);
    messageBody = email.body;

    // Sender selection (per-location):
    // 1. If the location has a verified custom sender_email, send from there.
    // 2. Otherwise fall back to the shared no-reply but use the location's
    //    display name (or its sender_name override) so the inbox preview
    //    is recognizable instead of generic "No-Reply".
    let from: string | undefined;
    if (location.sender_email && location.sender_verified_at) {
      const senderName = location.sender_name || location.display_name;
      from = formatFromHeader(senderName, location.sender_email);
    } else {
      const senderName = location.sender_name || location.display_name;
      const defaultAddr =
        extractEmail(process.env.RESEND_FROM ?? "") || process.env.RESEND_FROM;
      if (defaultAddr) from = formatFromHeader(senderName, defaultAddr);
    }

    // Reply-To set to the sending user's address so customer can reply to a
    // real person, not no-reply@. Helps Gmail classify as personal, not bulk.
    const r = await sendEmailViaResend({
      to: recipientEmail!,
      subject: email.subject,
      text: email.body,
      html: email.html,
      replyTo: user.email ?? undefined,
      from,
    });
    providerId = r.providerId;
    sendError = r.error;
  }

  if (sendError) {
    return { ok: false, error: sendError };
  }

  // Insert the request row via service client so we can populate the system
  // fields (sent_at, flagged_at) atomically regardless of RLS posture.
  const service = createServiceClient();
  const flaggedAt =
    velocity.kind === "flag" ? new Date().toISOString() : null;
  const flagReason = velocity.kind === "flag" ? velocity.reason : null;

  const { data: inserted, error: insertErr } = await service
    .from("review_requests")
    .insert({
      location_id: location.id,
      recipient_name: recipientName,
      recipient_phone: channel === "sms" ? recipientPhone : null,
      recipient_email: channel === "email" ? recipientEmail : null,
      language,
      channel,
      tracking_token: token,
      message_sent: messageBody,
      sent_at: new Date().toISOString(),
      flagged_at: flaggedAt,
      flag_reason: flagReason,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr) {
    // Message was already sent, but we couldn't log it. Surface a soft warning;
    // the customer still receives the link. Worth alerting in production.
    console.error("Failed to insert review_request after successful send", insertErr, providerId);
    return {
      ok: true,
      flagged: false,
      trackingUrl,
      error: "Message sent, but we couldn't log it. Please notify support.",
    };
  }

  revalidatePath("/app/send");
  revalidatePath("/app");

  return {
    ok: true,
    requestId: inserted.id,
    flagged: velocity.kind === "flag",
    trackingUrl,
  };
}

function formatFromHeader(name: string, email: string): string {
  // RFC 5322: quote display name when it contains characters like commas,
  // colons, semicolons, etc. Stripping these is simplest.
  const safe = name.replace(/["<>]/g, "").trim();
  return safe ? `${safe} <${email}>` : email;
}

function extractEmail(s: string): string | null {
  const m = s.match(/<([^>]+)>/);
  return m ? m[1] : null;
}

function getString(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
